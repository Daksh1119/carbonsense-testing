from __future__ import annotations

import os
import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
from fastapi import HTTPException

from ml_services.common.supabase_client import supabase


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _normalize_multiline_text(value: str) -> str:
    raw = str(value or "").replace("\r\n", "\n").replace("\r", "\n")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in raw.split("\n")]

    cleaned: List[str] = []
    previous_blank = False
    for line in lines:
        is_blank = line == ""
        if is_blank and previous_blank:
            continue
        cleaned.append(line)
        previous_blank = is_blank

    return "\n".join(cleaned).strip()


def _llm_config() -> Dict[str, str]:
    provider = os.getenv("LLM_PROVIDER", "openrouter").strip().lower()
    base_url = os.getenv("LLM_API_BASE_URL", "https://openrouter.ai/api/v1").strip().rstrip("/")
    model = os.getenv("LLM_MODEL", "openrouter/auto").strip()
    api_key = os.getenv("LLM_API_KEY", "").strip()
    site_url = os.getenv("LLM_SITE_URL", "").strip()
    app_name = os.getenv("LLM_APP_NAME", "CarbonSense").strip()
    embed_model = os.getenv("LLM_EMBED_MODEL", "").strip()
    return {
        "provider": provider,
        "base_url": base_url,
        "model": model,
        "api_key": api_key,
        "site_url": site_url,
        "app_name": app_name,
        "embed_model": embed_model,
    }


def _embedding_enabled() -> bool:
    cfg = _llm_config()
    return bool(cfg["api_key"] and cfg["embed_model"])


def _call_embeddings(texts: List[str]) -> List[List[float]]:
    cfg = _llm_config()
    if not cfg["api_key"] or not cfg["embed_model"]:
        raise HTTPException(status_code=500, detail="Missing embedding configuration")

    resp = requests.post(
        f"{cfg['base_url']}/embeddings",
        headers={
            "Authorization": f"Bearer {cfg['api_key']}",
            "Content-Type": "application/json",
        },
        json={
            "model": cfg["embed_model"],
            "input": texts,
        },
        timeout=45,
    )

    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Embedding request failed: {resp.status_code} {resp.text[:300]}")

    data = resp.json()
    items = data.get("data") or []
    vectors: List[List[float]] = []
    for item in items:
        embedding = item.get("embedding") or []
        vectors.append([float(v) for v in embedding])

    if len(vectors) != len(texts):
        raise HTTPException(status_code=502, detail="Embedding response size mismatch")

    return vectors


def list_policies(
    category: Optional[str] = None,
    industry: Optional[str] = None,
    active_only: bool = True,
    organization_id: Optional[str] = None,
    size: Optional[str] = None,
    total_emissions_kg: Optional[float] = None,
) -> List[Dict[str, Any]]:
    q = supabase.table("policies").select("*").order("name")
    if active_only:
        q = q.eq("is_active", True)
    if category:
        q = q.eq("category", category)

    rows = q.execute().data or []
    if industry:
        ind = industry.strip().lower()
        rows = [
            row
            for row in rows
            if ind in [str(x).lower() for x in (row.get("applicability") or [])] or "sme" in [str(x).lower() for x in (row.get("applicability") or [])]
        ]
    return [_enrich_policy(row, organization_id, industry, size, total_emissions_kg) for row in rows]


def get_policy(
    policy_id: str,
    organization_id: Optional[str] = None,
    industry: Optional[str] = None,
    size: Optional[str] = None,
    total_emissions_kg: Optional[float] = None,
) -> Dict[str, Any]:
    row = (
        supabase.table("policies")
        .select("*")
        .eq("id", policy_id)
        .limit(1)
        .execute()
        .data
    )
    if not row:
        raise HTTPException(status_code=404, detail="Policy not found")

    requirements = (
        supabase.table("compliance_requirements")
        .select("*")
        .eq("policy_id", policy_id)
        .order("level")
        .execute()
        .data
        or []
    )

    out = row[0]
    out["requirements_rows"] = requirements
    return _enrich_policy(out, organization_id, industry, size, total_emissions_kg)


def _safe_lower(value: Any) -> str:
    return str(value or "").strip().lower()


def _to_text_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return [str(item) for item in value if str(item).strip()]
    return []


def _get_org_profile(organization_id: Optional[str]) -> Dict[str, Any]:
    if not organization_id:
        return {}

    try:
        rows = (
            supabase.table("organizations")
            .select("*")
            .eq("id", organization_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        return rows[0] if rows else {}
    except Exception:
        return {}


def _extract_org_identity(
    organization_id: Optional[str] = None,
    industry: Optional[str] = None,
    size: Optional[str] = None,
    total_emissions_kg: Optional[float] = None,
) -> Dict[str, Any]:
    profile = _get_org_profile(organization_id)
    org_industry = industry or profile.get("industry") or profile.get("sector") or profile.get("business_type") or "sme"
    org_size = size or profile.get("size") or profile.get("organization_size") or profile.get("company_size") or "sme"
    emissions = total_emissions_kg
    if emissions is None:
        for key in ("total_emissions_kg", "scope1_kg", "scope2_kg", "emissions_kg"):
            value = profile.get(key)
            if isinstance(value, (int, float)):
                emissions = float(value)
                break
    return {
        "industry": _safe_lower(org_industry),
        "size": _safe_lower(org_size),
        "total_emissions_kg": float(emissions or 0),
        "profile": profile,
    }


def _policy_category_label(category: str) -> str:
    mapping = {
        "energy": "Energy",
        "waste": "Waste",
        "esg": "ESG",
        "msme": "MSME",
        "environmental": "Environmental",
        "transport": "Transport",
        "renewable": "Renewable",
        "climate": "Climate",
        "reporting": "Reporting",
        "carbon_market": "Carbon Market",
        "trade": "Trade",
    }
    return mapping.get(_safe_lower(category), str(category or "General").title())


def _build_document_summary(policy: Dict[str, Any]) -> Dict[str, Any]:
    requirements = _to_text_list(policy.get("requirements"))
    benefits = _to_text_list(policy.get("benefits"))
    applicability = _to_text_list(policy.get("applicability"))
    summary = policy.get("document_summary") if isinstance(policy.get("document_summary"), dict) else None
    if summary:
        return summary

    return {
        "official_title": policy.get("name"),
        "gazette_reference": policy.get("authority") or "Official policy source",
        "key_mandates": requirements[:5],
        "applies_to": applicability,
        "penalties": ["Non-compliance may affect audits, permits, or incentive eligibility."],
        "key_dates": [str(policy.get("effective_date") or "") or "Review on request"],
        "source_url": policy.get("external_url"),
        "benefits": benefits[:5],
    }


def _build_policy_steps(policy: Dict[str, Any], requirements_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    steps = policy.get("steps") if isinstance(policy.get("steps"), list) else None
    if steps:
        return steps

    synthesized: List[Dict[str, Any]] = []
    for idx, req in enumerate(requirements_rows[:5], start=1):
        synthesized.append(
            {
                "step_number": idx,
                "title": str(req.get("name") or f"Step {idx}"),
                "description": str(req.get("description") or "Complete the related requirement."),
                "why_it_matters": f"This supports {policy.get('name')} compliance.",
                "verification_type": str(req.get("verification_method") or "manual"),
                "linked_requirement_id": req.get("id"),
            }
        )
    return synthesized


def _policy_official_url(policy: Dict[str, Any]) -> str:
    explicit = str(policy.get("external_url") or "").strip()
    if explicit:
        return explicit

    name = _safe_lower(policy.get("name"))
    short = _safe_lower(policy.get("short_name"))
    authority = _safe_lower(policy.get("authority"))

    if "pat" in name or "perform, achieve, trade" in name:
        return "https://beeindia.gov.in/en/content/perform-achieve-and-trade-pat"
    if "ccts" in short or "carbon credit trading scheme" in name:
        return "https://beeindia.gov.in/en/content/carbon-credit-trading-scheme"
    if "napcc" in short or "national action plan on climate change" in name:
        return "https://moef.gov.in/en/division/environment/napcc/"
    if "green hydrogen" in name:
        return "https://mnre.gov.in/national-green-hydrogen-mission/"
    if "solar subsidy" in name or "rooftop" in name:
        return "https://solarrooftop.gov.in/"
    if "rpo" in short:
        return "https://mnre.gov.in/en/renewable-energy/policy-and-legislation/"
    if "rec" in short:
        return "https://www.irecmarket.com/"
    if "air act" in short or "air (prevention and control of pollution)" in name:
        return "https://cpcb.nic.in/"
    if "water act" in short or "water (prevention and control of pollution)" in name:
        return "https://cpcb.nic.in/"
    if "fame" in short or "ev policy" in name or "electric vehicle" in name:
        return "https://heavyindustries.gov.in/scheme/fame-india-scheme"
    if "brsr" in short or "sebi" in authority:
        return "https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&ssid=73&smid=0"
    if "cbam" in short or "carbon border" in name:
        return "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en"
    if "ghg protocol" in name:
        return "https://ghgprotocol.org/"
    if "iso 14001" in name:
        return "https://www.iso.org/iso-14001-environmental-management.html"
    if "solid waste" in name:
        return "https://moef.gov.in/en/acts-rules-and-notifications/"
    if "hazardous waste" in name:
        return "https://moef.gov.in/en/acts-rules-and-notifications/"
    if "plastic waste" in name or "epr" in short:
        return "https://cpcb.nic.in/plastic-waste-management/"
    if "e-waste" in name:
        return "https://cpcb.nic.in/e-waste/"
    if "energy conservation act" in name:
        return "https://beeindia.gov.in/en/content/energy-conservation-act"
    if "ujala" in short:
        return "https://eeslindia.org/en/our-businesses/ujala/"
    if "zed" in short:
        return "https://zed.msme.gov.in/"
    if "clcss" in short:
        return "https://clcss.dcmsme.gov.in/"
    if "msme green rating" in name:
        return "https://msme.gov.in/"
    if "pcb cto" in short or "consent to operate" in name:
        return "https://cpcb.nic.in/"
    if "msme" in authority or "msme" in name:
        return "https://msme.gov.in/"
    if "bee" in authority or "energy conservation" in name:
        return "https://beeindia.gov.in/"
    if "moefcc" in authority or "environment" in name or "waste" in name:
        return "https://moef.gov.in/"
    if "cerc" in authority or "rec" in short or "rpo" in short:
        return "https://cercind.gov.in/"

    return "https://www.india.gov.in/topics/environment-forest"


def _build_policy_funding(policy: Dict[str, Any], requirements_rows: List[Dict[str, Any]], match_score: int) -> Dict[str, Any]:
    funding = policy.get("funding") if isinstance(policy.get("funding"), dict) else None
    if funding:
        if not funding.get("application_url"):
            funding["application_url"] = _policy_official_url(policy)
        return funding

    rupee_values = [float(v or 0) for v in [policy.get("estimated_rupee_impact")]]
    rupee_values.extend(
        float(req.get("estimated_rupee_impact") or 0)
        for req in requirements_rows
        if req.get("estimated_rupee_impact") is not None
    )
    estimate = max(rupee_values) if rupee_values else 0
    if estimate <= 0:
        requirements_weight = sum(float(req.get("weight") or 0) for req in requirements_rows)
        category_factor = {
            "energy": 62000,
            "renewable": 80000,
            "msme": 54000,
            "transport": 58000,
            "waste": 46000,
            "environmental": 42000,
            "esg": 38000,
            "reporting": 32000,
            "trade": 70000,
            "carbon_market": 76000,
            "climate": 50000,
        }.get(_safe_lower(policy.get("category")), 45000)
        seed = sum(ord(ch) for ch in str(policy.get("id") or policy.get("name") or "")) % 11
        estimate = category_factor + (match_score * 650) + (requirements_weight * 2400) + (seed * 1800)

    floor = int(round(max(12000.0, estimate * 0.55) / 1000.0) * 1000)
    ceiling = int(round(max(floor + 3000.0, estimate * 1.35) / 1000.0) * 1000)
    return {
        "scheme_name": policy.get("short_name") or policy.get("name"),
        "benefit_type": "compliance and incentive readiness",
        "amount": f"₹{floor:,} – ₹{ceiling:,}",
        "eligibility": ", ".join(_to_text_list(policy.get("applicability"))[:3]) or "Applicable organization types",
        "deadline": str(policy.get("review_date") or policy.get("effective_date") or "Rolling"),
        "application_url": _policy_official_url(policy),
        "how_to_apply": ["Review applicability", "Prepare evidence", "Track progress in compliance tasks"],
        "eligibility_questions": [
            {"id": "industry", "text": "What is your industry?", "type": "text"},
            {"id": "size", "text": "What is your organization size?", "type": "text"},
        ],
    }


def _match_score_for_policy(policy: Dict[str, Any], org: Dict[str, Any]) -> int:
    applicability = {_safe_lower(item) for item in _to_text_list(policy.get("applicability"))}
    category = _safe_lower(policy.get("category"))
    score = 0

    if org.get("industry") and org.get("industry") in applicability:
        score += 30
    elif org.get("industry") == "sme" and "sme" in applicability:
        score += 30

    if org.get("size") and org.get("size") in applicability:
        score += 20
    elif org.get("size") in {"small", "smse", "sme"} and "sme" in applicability:
        score += 20

    emissions = float(org.get("total_emissions_kg") or 0)
    if emissions > 50000 and category in {"energy", "environmental", "climate"}:
        score += 25
    elif emissions > 10000 and category in {"energy", "environmental"}:
        score += 15
    elif emissions > 0:
        score += 8

    requirements = policy.get("requirements") or []
    if requirements:
        score += min(10, len(requirements) * 2)

    return min(score, 100)


def _policy_match_reason(policy: Dict[str, Any], org: Dict[str, Any]) -> str:
    reasons: List[str] = []
    applicability = {_safe_lower(item) for item in _to_text_list(policy.get("applicability"))}
    if org.get("industry") and org.get("industry") in applicability:
        reasons.append(f"your {org['industry']} profile")
    if org.get("size") and org.get("size") in applicability:
        reasons.append(f"your {org['size']} organization size")
    if float(org.get("total_emissions_kg") or 0) > 0:
        reasons.append(f"current emissions footprint ({int(float(org.get('total_emissions_kg') or 0))} kgCO2e)")
    if not reasons:
        reasons.append("your compliance profile")
    return f"Chosen because {', '.join(reasons)} align with {policy.get('authority') or policy.get('name')} requirements."


def _policy_status_from_results(policy_id: str, organization_id: Optional[str]) -> Dict[str, Any]:
    if not organization_id:
        return {"status": "Applicable", "completed": 0, "total": 0}

    requirements = (
        supabase.table("compliance_requirements")
        .select("id")
        .eq("policy_id", policy_id)
        .execute()
        .data
        or []
    )
    if not requirements:
        return {"status": "Applicable", "completed": 0, "total": 0}

    requirement_ids = [req["id"] for req in requirements]
    results = (
        supabase.table("compliance_results")
        .select("requirement_id,status,verified")
        .eq("organization_id", organization_id)
        .in_("requirement_id", requirement_ids)
        .execute()
        .data
        or []
    )
    completed = 0
    in_progress = 0
    for row in results:
        if _status_is_achieved(row):
            completed += 1
        elif _safe_lower(row.get("status")) == "in_progress":
            in_progress += 1

    status = "Applicable"
    if completed and completed >= len(requirement_ids):
        status = "Compliant"
    elif completed > 0:
        status = "In Progress"
    elif in_progress > 0:
        status = "In Progress"

    return {"status": status, "completed": completed, "total": len(requirement_ids)}


def _enrich_policy(policy: Dict[str, Any], organization_id: Optional[str], industry: Optional[str], size: Optional[str], total_emissions_kg: Optional[float]) -> Dict[str, Any]:
    org = _extract_org_identity(organization_id=organization_id, industry=industry, size=size, total_emissions_kg=total_emissions_kg)
    requirements_rows = (
        supabase.table("compliance_requirements")
        .select("*")
        .eq("policy_id", policy.get("id"))
        .order("created_at")
        .execute()
        .data
        or []
    )
    match_score = _match_score_for_policy(policy, org)
    status_info = _policy_status_from_results(str(policy.get("id")), organization_id)

    enriched = dict(policy)
    enriched["match_score"] = match_score
    enriched["match_reason"] = _policy_match_reason(policy, org)
    enriched["status"] = status_info["status"]
    enriched["compliance_progress"] = {"completed": status_info["completed"], "total": status_info["total"]}
    enriched["external_url"] = _policy_official_url(policy)
    enriched["document_summary"] = _build_document_summary(policy)
    enriched["steps"] = _build_policy_steps(policy, requirements_rows)
    enriched["funding"] = _build_policy_funding(policy, requirements_rows, match_score)
    return enriched


def _keyword_score(text: str, keywords: List[str]) -> int:
    t = text.lower()
    return sum(1 for k in keywords if k and k in t)


def _load_policy_chunks(policy_id: Optional[str] = None, limit: int = 300) -> List[Dict[str, Any]]:
    q = supabase.table("policy_chunks").select("id,policy_id,chunk_text,chunk_order,embedding,source")
    if policy_id:
        q = q.eq("policy_id", policy_id)
    return q.order("chunk_order").limit(limit).execute().data or []


def _backfill_policy_embeddings(policy_id: Optional[str] = None, limit: int = 50) -> int:
    if not _embedding_enabled():
        return 0

    q = supabase.table("policy_chunks").select("id,chunk_text")
    if policy_id:
        q = q.eq("policy_id", policy_id)
    rows = q.is_("embedding", "null").order("chunk_order").limit(limit).execute().data or []
    if not rows:
        return 0

    texts = [str(row.get("chunk_text") or "") for row in rows]
    vectors = _call_embeddings(texts)

    updated = 0
    for row, vector in zip(rows, vectors):
        try:
            supabase.table("policy_chunks").update({"embedding": vector}).eq("id", row["id"]).execute()
            updated += 1
        except Exception:
            continue

    return updated


def _vector_retrieve_policy_context(question: str, policy_id: Optional[str] = None, top_k: int = 5) -> List[Dict[str, Any]]:
    if not _embedding_enabled():
        return []

    _backfill_policy_embeddings(policy_id=policy_id, limit=50)
    question_embedding = _call_embeddings([_normalize_text(question)])[0]

    try:
        params: Dict[str, Any] = {
            "query_embedding": question_embedding,
            "match_count": max(top_k, 1),
        }
        if policy_id:
            params["filter_policy_id"] = policy_id

        response = supabase.rpc("match_policy_chunks", params).execute()
        rows = response.data or []
        return [
            {
                "id": row.get("id"),
                "policy_id": row.get("policy_id"),
                "chunk_text": row.get("chunk_text"),
                "similarity": float(row.get("similarity") or 0),
                "retrieval_mode": "vector",
            }
            for row in rows
        ]
    except Exception:
        return []


def _lexical_retrieve_policy_context(question: str, policy_id: Optional[str] = None, top_k: int = 5) -> List[Dict[str, Any]]:
    question = _normalize_text(question)
    if not question:
        return []

    words = [w for w in re.findall(r"[a-zA-Z0-9_]{3,}", question.lower()) if len(w) >= 3]
    chunks = _load_policy_chunks(policy_id=policy_id, limit=300)

    scored: List[Tuple[float, Dict[str, Any]]] = []
    for ch in chunks:
        score = float(_keyword_score(ch.get("chunk_text", ""), words))
        if policy_id and str(ch.get("policy_id")) == policy_id:
            score += 2.0
        if score > 0:
            scored.append((score, ch))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [
        {
            **item[1],
            "similarity": float(item[0]),
            "retrieval_mode": "lexical",
        }
        for item in scored[:top_k]
    ]


def _dedupe_context_rows(rows: List[Dict[str, Any]], top_k: int = 5) -> List[Dict[str, Any]]:
    deduped: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        key = str(row.get("id") or row.get("chunk_text") or "")
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(row)
        if len(deduped) >= top_k:
            break
    return deduped


def _retrieve_policy_context(question: str, policy_id: Optional[str] = None, top_k: int = 5) -> List[Dict[str, Any]]:
    question = _normalize_text(question)
    if not question:
        return []

    vector_rows = _vector_retrieve_policy_context(question, policy_id=policy_id, top_k=top_k)
    lexical_rows = _lexical_retrieve_policy_context(question, policy_id=policy_id, top_k=top_k)

    if vector_rows:
        return _dedupe_context_rows(vector_rows + lexical_rows, top_k=top_k)

    return _dedupe_context_rows(lexical_rows, top_k=top_k)


def _chat_completion(system_prompt: str, user_prompt: str) -> Tuple[str, str]:
    cfg = _llm_config()
    if not cfg["api_key"]:
        raise HTTPException(status_code=500, detail="Missing LLM_API_KEY")

    url = f"{cfg['base_url']}/chat/completions"
    headers = {
        "Authorization": f"Bearer {cfg['api_key']}",
        "Content-Type": "application/json",
    }
    if cfg["provider"] == "openrouter":
        if cfg["site_url"]:
            headers["HTTP-Referer"] = cfg["site_url"]
        if cfg["app_name"]:
            headers["X-Title"] = cfg["app_name"]

    body = {
        "model": cfg["model"],
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    resp = requests.post(url, headers=headers, json=body, timeout=45)
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {resp.status_code} {resp.text[:300]}")

    data = resp.json()
    choices = data.get("choices") or []
    if not choices:
        raise HTTPException(status_code=502, detail="LLM response had no choices")

    text = (choices[0].get("message") or {}).get("content") or ""
    return _normalize_multiline_text(text), cfg["model"]


def ask_policy(
    organization_id: str,
    user_question: str,
    industry: Optional[str] = None,
    size: Optional[str] = None,
    total_emissions_kg: Optional[float] = None,
    policy_id: Optional[str] = None,
) -> Dict[str, Any]:
    policy_context: Dict[str, Any] = {}
    if policy_id:
        policy_context = get_policy(policy_id)

    chunks = _retrieve_policy_context(user_question, policy_id=policy_id, top_k=5)
    context_block = "\n\n".join(
        [
            f"[chunk {idx + 1} | {c.get('retrieval_mode', 'lexical')} | similarity={round(float(c.get('similarity') or 0), 3)}]\n{c.get('chunk_text', '')}"
            for idx, c in enumerate(chunks)
        ]
    )

    policy_name = policy_context.get("name") if policy_context else "General Indian policy context"
    policy_desc = policy_context.get("description") if policy_context else ""
    requirements_summary = "; ".join([str(r.get("name") or "") for r in policy_context.get("requirements_rows", [])[:6]])

    system_prompt = (
        "You are a carbon compliance advisor for Indian SMEs. "
        "Be practical, concise, and action-first. "
        "Do not provide legal certification. "
        "If unsure, explicitly say so and suggest consulting a qualified advisor."
    )

    user_prompt = (
        f"Organisation industry: {industry or 'unknown'}\n"
        f"Organisation size: {size or 'unknown'}\n"
        f"Current emissions: {total_emissions_kg if total_emissions_kg is not None else 'unknown'} kgCO2e\n"
        f"Policy context: {policy_name} — {policy_desc}\n"
        f"Policy requirements: {requirements_summary or 'No requirements loaded'}\n"
        f"Retrieved context:\n{context_block or 'No additional context found.'}\n\n"
        f"User question: {user_question}\n\n"
        "Respond in markdown with exactly these section headings and bullet points (max 4 bullets per section):\n"
        "## Applicability\n"
        "## What to do this week\n"
        "## What evidence to keep\n"
        "## Risks if ignored\n"
        "Use short bullets only. No long paragraphs."
    )

    llm_response, model_used = _chat_completion(system_prompt, user_prompt)

    ins = (
        supabase.table("policy_interactions")
        .insert(
            {
                "organization_id": organization_id,
                "policy_id": policy_id,
                "user_question": user_question,
                "llm_response": llm_response,
                "model_used": model_used,
            }
        )
        .execute()
    )

    interaction = (ins.data or [{}])[0]
    return {
        "interaction": interaction,
        "response": llm_response,
        "retrieved_chunks": chunks,
        "retrieval_mode": "vector+lexical" if any(c.get("retrieval_mode") == "vector" for c in chunks) else "lexical",
        "model_used": model_used,
    }


def list_requirements(level: Optional[str] = None, industry: Optional[str] = None) -> List[Dict[str, Any]]:
    q = supabase.table("compliance_requirements").select("*, policies(name, short_name, category, layer)").order("created_at")
    if level:
        q = q.eq("level", level)

    rows = q.execute().data or []
    if industry:
        ind = industry.strip().lower()
        rows = [r for r in rows if ind in [str(x).lower() for x in (r.get("industry") or [])] or "sme" in [str(x).lower() for x in (r.get("industry") or [])]]
    return rows


def get_requirement(requirement_id: str) -> Dict[str, Any]:
    rows = (
        supabase.table("compliance_requirements")
        .select("*, policies(name, short_name, category, layer, authority, external_url, description)")
        .eq("id", requirement_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Compliance requirement not found")
    return rows[0]


def get_result_steps(organization_id: str, result_id: str) -> List[Dict[str, Any]]:
    rows = (
        supabase.table("compliance_results")
        .select("*, compliance_requirements(*, policies(*))")
        .eq("organization_id", organization_id)
        .eq("id", result_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Compliance result not found")

    result = rows[0]
    req = result.get("compliance_requirements") or {}
    policy = req.get("policies") or {}
    steps = policy.get("steps") if isinstance(policy.get("steps"), list) else None
    if steps:
        return steps

    synthesized = []
    synthesized.append({"step_number": 1, "title": req.get("name"), "status": result.get("status"), "verification_type": req.get("verification_method")})
    return synthesized


def get_evidence_history(organization_id: str, result_id: str) -> List[Dict[str, Any]]:
    rows = (
        supabase.table("compliance_results")
        .select("id, updated_at, created_at, evidence_url, verification_source, notes, data_snapshot, status, verified")
        .eq("organization_id", organization_id)
        .eq("id", result_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Compliance result not found")

    row = rows[0]
    history: List[Dict[str, Any]] = []
    if row.get("evidence_url") or row.get("notes") or row.get("verification_source"):
        history.append(
            {
                "result_id": row.get("id"),
                "evidence_url": row.get("evidence_url"),
                "verification_source": row.get("verification_source"),
                "notes": row.get("notes"),
                "data_snapshot": row.get("data_snapshot") or {},
                "status": row.get("status"),
                "verified": row.get("verified"),
                "created_at": row.get("created_at"),
                "updated_at": row.get("updated_at"),
            }
        )
    return history


def _default_due_date_for_requirement(requirement: Dict[str, Any]) -> str:
    level = str(requirement.get("level") or "").strip().lower()
    offset_by_level = {
        "basic": 30,
        "industry_specific": 60,
        "action_based": 90,
    }
    days = offset_by_level.get(level, 60)
    return (datetime.now(timezone.utc).date() + timedelta(days=days)).isoformat()


def _ensure_compliance_results_initialized(organization_id: str) -> int:
    requirements = supabase.table("compliance_requirements").select("id, level").execute().data or []
    if not requirements:
        return 0

    existing = (
        supabase.table("compliance_results")
        .select("requirement_id")
        .eq("organization_id", organization_id)
        .execute()
        .data
        or []
    )
    existing_ids = {str(row.get("requirement_id")) for row in existing if row.get("requirement_id")}

    missing = [req for req in requirements if str(req.get("id")) not in existing_ids]
    if not missing:
        return 0

    rows = [
        {
            "organization_id": organization_id,
            "requirement_id": req["id"],
            "status": "not_started",
            "verified": False,
            "score_contribution": 0,
            "due_date": _default_due_date_for_requirement(req),
        }
        for req in missing
    ]

    supabase.table("compliance_results").upsert(rows, on_conflict="organization_id,requirement_id").execute()
    return len(rows)


def list_results(organization_id: str, level: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
    _ensure_compliance_results_initialized(organization_id)

    req_rows = list_requirements(level=level)
    req_by_id = {r["id"]: r for r in req_rows}

    q = supabase.table("compliance_results").select("*").eq("organization_id", organization_id)
    if status:
        q = q.eq("status", status)
    results = q.execute().data or []

    merged: List[Dict[str, Any]] = []
    for row in results:
        req = req_by_id.get(row.get("requirement_id"))
        if not req:
            continue
        item = {**row, "requirement": req}
        merged.append(item)

    return merged


def _status_is_achieved(item: Dict[str, Any]) -> bool:
    status = str(item.get("status") or "").lower()
    verified = bool(item.get("verified"))
    return verified or status in {"completed", "verified"}


def _score_from_requirements_and_results(requirements: List[Dict[str, Any]], results: List[Dict[str, Any]]) -> Dict[str, Any]:
    req_by_id = {r["id"]: r for r in requirements}

    total_by_type = {"data": 0.0, "action": 0.0, "reporting": 0.0}
    achieved_by_type = {"data": 0.0, "action": 0.0, "reporting": 0.0}

    for req in requirements:
        t = str(req.get("type") or "")
        w = float(req.get("weight") or 0)
        if t in total_by_type:
            total_by_type[t] += w

    for res in results:
        req = req_by_id.get(res.get("requirement_id"))
        if not req:
            continue
        t = str(req.get("type") or "")
        if t not in achieved_by_type:
            continue
        if _status_is_achieved(res):
            achieved_by_type[t] += float(req.get("weight") or 0)

    def pct(num: float, den: float) -> float:
        return (num / den) if den > 0 else 0.0

    data_score = round(pct(achieved_by_type["data"], total_by_type["data"]) * 40, 2)
    action_score = round(pct(achieved_by_type["action"], total_by_type["action"]) * 40, 2)
    reporting_score = round(pct(achieved_by_type["reporting"], total_by_type["reporting"]) * 20, 2)
    total_score = round(data_score + action_score + reporting_score, 2)

    return {
        "data_score": data_score,
        "action_score": action_score,
        "reporting_score": reporting_score,
        "total_score": total_score,
        "breakdown": {
            "total_by_type": total_by_type,
            "achieved_by_type": achieved_by_type,
        },
    }


def recalculate_score(organization_id: str, snapshot_date: Optional[date] = None) -> Dict[str, Any]:
    req_rows = supabase.table("compliance_requirements").select("*").execute().data or []
    res_rows = supabase.table("compliance_results").select("*").eq("organization_id", organization_id).execute().data or []

    scores = _score_from_requirements_and_results(req_rows, res_rows)
    snap = snapshot_date or datetime.now(timezone.utc).date()

    record = {
        "organization_id": organization_id,
        "snapshot_date": snap.isoformat(),
        "data_score": scores["data_score"],
        "action_score": scores["action_score"],
        "reporting_score": scores["reporting_score"],
        "total_score": scores["total_score"],
        "breakdown": scores["breakdown"],
    }

    supabase.table("compliance_score_history").upsert(record, on_conflict="organization_id,snapshot_date").execute()
    return record


def get_current_score(organization_id: str) -> Dict[str, Any]:
    latest = (
        supabase.table("compliance_score_history")
        .select("organization_id,snapshot_date,data_score,action_score,reporting_score,total_score,breakdown")
        .eq("organization_id", organization_id)
        .order("snapshot_date", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    if latest:
        return latest[0]
    return recalculate_score(organization_id)


def score_history(organization_id: str, days: int = 365) -> List[Dict[str, Any]]:
    since = (datetime.now(timezone.utc).date() - timedelta(days=max(days, 1))).isoformat()
    return (
        supabase.table("compliance_score_history")
        .select("*")
        .eq("organization_id", organization_id)
        .gte("snapshot_date", since)
        .order("snapshot_date")
        .execute()
        .data
        or []
    )


def verify_result(
    organization_id: str,
    result_id: str,
    status: Optional[str] = None,
    verified: Optional[bool] = None,
    verification_source: Optional[str] = None,
    evidence_url: Optional[str] = None,
    data_snapshot: Optional[Dict[str, Any]] = None,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    rows = (
        supabase.table("compliance_results")
        .select("*")
        .eq("organization_id", organization_id)
        .eq("id", result_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Compliance result not found")

    current = rows[0]
    patch: Dict[str, Any] = {}
    if status:
        patch["status"] = status
    if verified is not None:
        patch["verified"] = verified
        if verified and "status" not in patch:
            patch["status"] = "verified"
    if verification_source is not None:
        patch["verification_source"] = verification_source
    if evidence_url is not None:
        patch["evidence_url"] = evidence_url
    if data_snapshot is not None:
        patch["data_snapshot"] = data_snapshot
    if notes is not None:
        patch["notes"] = notes
    if patch.get("status") in {"completed", "verified"}:
        patch["completed_at"] = datetime.now(timezone.utc).isoformat()

    # Keep score contribution aligned to achieved state and requirement weight.
    req = (
        supabase.table("compliance_requirements")
        .select("id, weight")
        .eq("id", current["requirement_id"])
        .limit(1)
        .execute()
        .data
        or []
    )
    req_weight = float((req[0] if req else {}).get("weight") or 0)
    achieved = bool(patch.get("verified", current.get("verified"))) or str(patch.get("status", current.get("status", ""))).lower() in {"completed", "verified"}
    patch["score_contribution"] = req_weight if achieved else 0

    upd = (
        supabase.table("compliance_results")
        .update(patch)
        .eq("id", result_id)
        .eq("organization_id", organization_id)
        .execute()
    )

    recalculate_score(organization_id)
    return (upd.data or [{}])[0]


def upcoming_deadlines(organization_id: str, within_days: int = 90) -> List[Dict[str, Any]]:
    _ensure_compliance_results_initialized(organization_id)

    start = datetime.now(timezone.utc).date()
    end = start + timedelta(days=max(within_days, 1))

    rows = (
        supabase.table("compliance_results")
        .select("*, compliance_requirements(name, type, level, verification_method, policy_id, policies(name))")
        .eq("organization_id", organization_id)
        .not_.is_("due_date", "null")
        .gte("due_date", start.isoformat())
        .lte("due_date", end.isoformat())
        .order("due_date")
        .execute()
        .data
        or []
    )
    return rows


def top_actions(organization_id: str, industry: Optional[str] = None, top_n: int = 3) -> List[Dict[str, Any]]:
    requirements = list_requirements(industry=industry)
    results = supabase.table("compliance_results").select("*").eq("organization_id", organization_id).execute().data or []
    result_by_req = {r.get("requirement_id"): r for r in results}

    total_by_type = {"data": 0.0, "action": 0.0, "reporting": 0.0}
    for req in requirements:
        t = req.get("type")
        if t in total_by_type:
            total_by_type[t] += float(req.get("weight") or 0)

    dimension_max = {"data": 40.0, "action": 40.0, "reporting": 20.0}
    effort_map = {"data_change": 1.0, "manual": 2.0, "evidence_upload": 2.0, "ocr_extract": 3.0}

    candidates: List[Dict[str, Any]] = []
    for req in requirements:
        existing = result_by_req.get(req["id"], {})
        if _status_is_achieved(existing):
            continue

        req_type = str(req.get("type") or "")
        req_weight = float(req.get("weight") or 0)
        max_for_type = total_by_type.get(req_type, 0)
        score_gain = (req_weight / max_for_type) * dimension_max.get(req_type, 0) if max_for_type > 0 else 0

        rupee_impact = float(req.get("estimated_rupee_impact") or 0)
        co2_impact = float(req.get("estimated_co2_kg_impact") or 0)
        effort = effort_map.get(str(req.get("verification_method") or "manual"), 2.0)

        value = (score_gain + (rupee_impact / 50000.0) + (co2_impact / 1000.0)) / effort
        candidates.append(
            {
                "requirement_id": req["id"],
                "name": req.get("name"),
                "type": req_type,
                "level": req.get("level"),
                "verification_method": req.get("verification_method"),
                "score_gain_estimate": round(score_gain, 2),
                "rupee_impact_estimate": rupee_impact,
                "co2_kg_impact_estimate": co2_impact,
                "effort_estimate": effort,
                "priority_score": round(value, 4),
                "description": req.get("description"),
            }
        )

    candidates.sort(key=lambda x: x["priority_score"], reverse=True)
    return candidates[: max(top_n, 1)]


def benchmark(organization_id: str, industry: str = "sme") -> Dict[str, Any]:
    latest = (
        supabase.table("compliance_score_history")
        .select("total_score,snapshot_date")
        .eq("organization_id", organization_id)
        .order("snapshot_date", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    your_score = float((latest[0] if latest else {}).get("total_score") or 0)

    synthetic = {
        "manufacturing": 42,
        "restaurant": 37,
        "logistics": 40,
        "retail": 39,
        "sme": 41,
    }
    baseline = synthetic.get(industry.lower(), synthetic["sme"])

    delta = round(your_score - baseline, 2)
    percentile = max(1, min(99, int(50 + (delta * 1.7))))

    return {
        "organization_id": organization_id,
        "industry": industry,
        "your_score": round(your_score, 2),
        "industry_baseline": baseline,
        "delta_vs_baseline": delta,
        "estimated_percentile": percentile,
        "method": "Synthetic baseline (to be replaced by live cohort data as org count grows)",
    }


def rupee_impact_summary(organization_id: str) -> Dict[str, Any]:
    requirements = supabase.table("compliance_requirements").select("id, estimated_rupee_impact, estimated_co2_kg_impact").execute().data or []
    req_map = {r["id"]: r for r in requirements}

    results = supabase.table("compliance_results").select("requirement_id,status,verified").eq("organization_id", organization_id).execute().data or []

    unlocked_rupees = 0.0
    unlocked_co2 = 0.0
    pipeline_rupees = 0.0
    pipeline_co2 = 0.0

    for row in results:
        req = req_map.get(row.get("requirement_id"))
        if not req:
            continue
        rupees = float(req.get("estimated_rupee_impact") or 0)
        co2 = float(req.get("estimated_co2_kg_impact") or 0)

        achieved = bool(row.get("verified")) or str(row.get("status") or "").lower() in {"completed", "verified"}
        in_progress = str(row.get("status") or "").lower() in {"in_progress", "not_started", "overdue"}

        if achieved:
            unlocked_rupees += rupees
            unlocked_co2 += co2
        elif in_progress:
            pipeline_rupees += rupees
            pipeline_co2 += co2

    return {
        "organization_id": organization_id,
        "unlocked_rupees_estimate": round(unlocked_rupees, 2),
        "pipeline_rupees_estimate": round(pipeline_rupees, 2),
        "unlocked_co2_kg_estimate": round(unlocked_co2, 2),
        "pipeline_co2_kg_estimate": round(pipeline_co2, 2),
    }
