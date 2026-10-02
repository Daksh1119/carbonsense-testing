import json
import os
import hashlib
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from fastapi import HTTPException
from dotenv import load_dotenv
import requests

from ml_services.common.supabase_client import supabase
from ml_services.recommendations.knowledge_base import (
    find_entries_for_focus_areas,
    to_evidence_item,
)
from ml_services.recommendations.impact_calculator import apply_deterministic_impacts


# Load backend env deterministically from repository root (.env).
_REPO_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(_REPO_ROOT / ".env", override=True)


def _llm_config() -> Dict[str, str]:
    provider = os.getenv("LLM_PROVIDER", "openrouter").strip().lower()
    api_key = os.getenv("LLM_API_KEY", "").strip()
    base_url = os.getenv("LLM_API_BASE_URL",
                         "https://openrouter.ai/api/v1").strip().rstrip("/")
    model = os.getenv("LLM_MODEL", "openrouter/auto").strip()
    return {
        "provider": provider,
        "api_key": api_key,
        "base_url": base_url,
        "model": model,
    }


def _model_fallbacks() -> List[str]:
    cfg = _llm_config()
    raw = os.getenv("LLM_MODEL_FALLBACKS", "").strip()
    models = [cfg["model"]]
    if raw:
        models.extend([m.strip() for m in raw.split(",") if m.strip()])

    # Stable de-duplication while preserving order.
    seen: Set[str] = set()
    deduped: List[str] = []
    for m in models:
        if m in seen:
            continue
        seen.add(m)
        deduped.append(m)
    return deduped


def _hash_payload(payload: Dict[str, Any]) -> str:
    try:
        canonical = json.dumps(payload, sort_keys=True,
                               ensure_ascii=True, default=str)
    except Exception:
        canonical = json.dumps(
            {"error": "payload_not_serializable"}, ensure_ascii=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _strip_json_block(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if len(lines) >= 3:
            cleaned = "\n".join(lines[1:-1]).strip()
    return cleaned


def _safe_float(v: Any, default: float = 0.0) -> float:
    try:
        return float(v)
    except Exception:
        return default


def _safe_int(v: Any, default: int = 0) -> int:
    try:
        return int(v)
    except Exception:
        return default


def _get_org_profile(org_id: str) -> Dict[str, Any]:
    try:
        q = (
            supabase.table("organizations")
            .select("id,name,industry,created_at")
            .eq("id", org_id)
            .limit(1)
            .execute()
        )
        if q.data:
            return q.data[0]
    except Exception:
        pass
    return {"id": org_id}


def _build_evidence_catalog(payload: Dict[str, Any], org_profile: Dict[str, Any], teme_run: Dict[str, Any]) -> List[Dict[str, Any]]:
    catalog: List[Dict[str, Any]] = []

    # Organization profile evidence (manual source to satisfy DB source_type checks).
    if org_profile.get("name") or org_profile.get("industry"):
        catalog.append(
            {
                "evidence_id": "org_profile",
                "source_type": "manual",
                "source_table": "organizations",
                "source_record_id": str(org_profile.get("id") or ""),
                "citation": "Organization profile",
                "excerpt": f"Org={org_profile.get('name') or 'Unknown'}, industry={org_profile.get('industry') or 'Unknown'}.",
                "tags": ["organization", "industry", "profile"],
            }
        )

    kpis = payload.get("kpi_snapshots", []) or []
    for i, k in enumerate(kpis, start=1):
        kpi_name = str(k.get("kpi_name") or f"kpi_{i}").strip()
        kpi_value = _safe_float(k.get("kpi_value"), 0.0)
        kpi_unit = str(k.get("kpi_unit") or "").strip()
        norm = kpi_name.lower().replace(" ", "_")
        catalog.append(
            {
                "evidence_id": f"kpi::{norm}::{i}",
                "source_type": "kpi_snapshot",
                "source_table": "recommendation_kpi_snapshots",
                "source_record_id": None,
                "citation": f"KPI snapshot: {kpi_name}",
                "excerpt": f"{kpi_name}={round(kpi_value, 4)} {kpi_unit}".strip(),
                "tags": ["kpi", norm],
            }
        )

    if teme_run.get("id"):
        result = teme_run.get("result") or payload.get("teme_result") or {}
        total_trees = _safe_int(result.get("total_trees"), 0)
        maturity = _safe_int(result.get("avg_maturity_years"), 0)
        emission_kg = _safe_float(teme_run.get(
            "emission_kg") or payload.get("emission_kg"), 0.0)
        catalog.append(
            {
                "evidence_id": "teme::latest_run",
                "source_type": "teme_run",
                "source_table": "teme_runs",
                "source_record_id": str(teme_run.get("id") or ""),
                "citation": "Latest TEME run",
                "excerpt": (
                    f"project={teme_run.get('project_name') or 'N/A'}, emission_kg={round(emission_kg, 4)}, "
                    f"total_trees={total_trees}, avg_maturity_years={maturity}"
                ),
                "tags": ["teme", "offset", "survival"],
            }
        )

    # Always include methodology references as traceable manual evidence.
    for ref_idx, ref in enumerate(payload.get("methodology_refs", []) or [], start=1):
        ref_name = str(ref).strip()
        if not ref_name:
            continue
        catalog.append(
            {
                "evidence_id": f"methodology::{ref_idx}",
                "source_type": "external",
                "source_table": None,
                "source_record_id": None,
                "citation": ref_name,
                "excerpt": "Methodology reference provided by CarbonSense context.",
                "tags": ["methodology", "factors"],
            }
        )

    # Priority 5: Inject trend comparison evidence against preceding upload
    org_id = payload.get("organization_id")
    upload_id = payload.get("emissions_upload_id")
    if org_id:
        trend_items = _build_trend_evidence(org_id, upload_id, kpis)
        catalog.extend(trend_items)

    return catalog


def _build_trend_evidence(
    org_id: str,
    current_upload_id: Optional[str],
    current_kpis: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Compare current upload's KPIs against the immediately preceding upload for this org.
    Returns trend evidence items (e.g. 'Transport emissions increased +12.4% vs Oct 2025').
    """
    if not org_id or not current_kpis:
        return []
    try:
        query = (
            supabase.table("organization_uploads")
            .select("id, original_file_name, total_emissions_kg, created_at, period_start, period_end")
            .eq("organization_id", org_id)
            .order("created_at", desc=True)
            .limit(5)
        )
        res = query.execute()
        uploads = res.data or []
        if not uploads:
            return []

        # Find previous upload (skip current if matched)
        prev_upload = None
        for u in uploads:
            if current_upload_id and str(u.get("id")) == str(current_upload_id):
                continue
            prev_upload = u
            break

        if not prev_upload:
            return []

        prev_id = prev_upload.get("id")
        prev_entries_res = (
            supabase.table("emission_entries")
            .select("category, co2_kg")
            .eq("upload_id", prev_id)
            .execute()
        )
        prev_entries = prev_entries_res.data or []
        prev_by_cat: Dict[str, float] = {}
        for pe in prev_entries:
            c = str(pe.get("category") or "other").lower().strip()
            prev_by_cat[c] = prev_by_cat.get(c, 0.0) + float(pe.get("co2_kg") or 0)

        prev_file = prev_upload.get("original_file_name") or "previous upload"
        trend_items = []
        for curr_kpi in current_kpis:
            kpi_name = str(curr_kpi.get("kpi_name") or "").lower()
            cat = kpi_name.replace("_kg", "").strip()
            curr_val = _safe_float(curr_kpi.get("kpi_value"), 0.0)
            if cat in prev_by_cat and prev_by_cat[cat] > 0 and curr_val > 0:
                prev_val = prev_by_cat[cat]
                diff_pct = round(((curr_val - prev_val) / prev_val) * 100, 1)
                direction = "increased" if diff_pct > 0 else "decreased"
                sign = "+" if diff_pct > 0 else ""
                trend_items.append(
                    {
                        "evidence_id": f"trend::{cat}",
                        "source_type": "trend_comparison",
                        "source_table": "organization_uploads",
                        "source_record_id": prev_id,
                        "citation": f"Trend vs {prev_file}: {cat.title()}",
                        "excerpt": f"{cat.title()} emissions {direction} by {sign}{diff_pct}% ({curr_val:.1f} vs {prev_val:.1f} kgCO2e)",
                        "tags": ["trend", cat, "kpi"],
                    }
                )
        return trend_items
    except Exception as e:
        print(f"[recommendations] Could not build trend evidence: {e}")
        return []


def _enrich_evidence_from_knowledge_base(
    catalog: List[Dict[str, Any]],
    focus_areas: List[str],
) -> List[Dict[str, Any]]:
    """
    Augment an existing evidence catalog with curated knowledge base entries.
    KB entries carry verified citations (GHG Protocol, IEA, ENERGY STAR, etc.)
    so the LLM must ground its recommendations in real, traceable sources.
    At most 6 KB entries are injected to keep the prompt manageable.
    """
    existing_ids: Set[str] = {str(e.get("evidence_id") or "") for e in catalog}
    kb_entries = find_entries_for_focus_areas(focus_areas)
    added = 0
    for entry in kb_entries:
        ev = to_evidence_item(entry)
        if ev["evidence_id"] in existing_ids:
            continue
        # Strip internal metadata before adding to the LLM payload.
        ev_clean = {k: v for k, v in ev.items() if not k.startswith("_")}
        catalog.append(ev_clean)
        existing_ids.add(ev["evidence_id"])
        added += 1
        if added >= 6:
            break
    return catalog


def _derive_focus_areas(payload: Dict[str, Any]) -> List[str]:
    kpis = payload.get("kpi_snapshots", []) or []
    if not kpis:
        return ["scope_2_energy", "transport", "purchases"]

    ranked = sorted(
        kpis,
        key=lambda k: _safe_float(k.get("kpi_value"), 0.0),
        reverse=True,
    )
    top_names = [str(k.get("kpi_name") or "").strip().lower()
                 for k in ranked[:5] if str(k.get("kpi_name") or "").strip()]

    areas: List[str] = []
    for name in top_names:
        if any(tok in name for tok in ["scope_2", "electricity", "power", "energy", "hvac", "lighting"]):
            areas.append("scope_2_energy")
        elif any(tok in name for tok in ["flight", "travel", "transport", "commute", "diesel", "fuel"]):
            areas.append("transport")
        elif any(tok in name for tok in ["purchases", "goods", "vendor", "procurement", "supply"]):
            areas.append("purchases")
        elif any(tok in name for tok in ["waste", "water"]):
            areas.append("operations")
        else:
            areas.append("general_efficiency")

    if not areas:
        areas = ["scope_2_energy", "transport", "purchases"]

    # Deduplicate while preserving order.
    deduped: List[str] = []
    seen: Set[str] = set()
    for a in areas:
        if a in seen:
            continue
        seen.add(a)
        deduped.append(a)
    return deduped


def _target_recommendation_count(payload: Dict[str, Any], evidence_catalog: List[Dict[str, Any]]) -> int:
    requested = payload.get("target_recommendation_count")
    if requested is not None:
        v = _safe_int(requested, 4)
        return max(2, min(8, v))

    emission_kg = _safe_float(payload.get("emission_kg"), 0.0)
    kpi_count = len(payload.get("kpi_snapshots", []) or [])
    evidence_count = len(evidence_catalog)

    count = 3
    if emission_kg >= 50000:
        count += 1
    if emission_kg >= 250000:
        count += 1
    if kpi_count >= 5:
        count += 1
    if evidence_count >= 12:
        count += 1
    return max(3, min(7, count))


def _heuristic_fallback(
    payload: Dict[str, Any],
    target_count: int,
    evidence_catalog: Optional[List[Dict[str, Any]]] = None,
    focus_areas: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    emission = float(payload.get("emission_kg", 0))
    total_trees = int(payload.get("teme_result", {}).get("total_trees", 0))
    tree_impact = max(50.0, emission * 0.18)
    focus = focus_areas or []
    evidence_catalog = evidence_catalog or []

    def _pick_evidence(tags: List[str], fallback_min: int = 2) -> List[Dict[str, Any]]:
        selected = []
        for ev in evidence_catalog:
            ev_tags = set([str(t).lower() for t in (ev.get("tags") or [])])
            if any(t.lower() in ev_tags for t in tags):
                selected.append(ev)
        if len(selected) < fallback_min:
            selected.extend(
                [ev for ev in evidence_catalog if ev not in selected])
        trimmed = selected[: max(2, fallback_min)]
        out = []
        for ev in trimmed:
            out.append(
                {
                    "evidence_id": ev.get("evidence_id"),
                    "source_type": ev.get("source_type", "manual"),
                    "source_table": ev.get("source_table"),
                    "source_record_id": ev.get("source_record_id"),
                    "uri": ev.get("uri"),
                    "citation": ev.get("citation"),
                    "excerpt": ev.get("excerpt"),
                }
            )
        return out

    def _impact_bounds(value: float) -> Dict[str, float]:
        return {
            "estimated_impact_kg_co2e_low": round(max(0.0, value * 0.8), 2),
            "estimated_impact_kg_co2e_high": round(max(0.0, value * 1.2), 2),
        }

    templates = [
        {
            "title": "Optimize HVAC and lighting schedules",
            "summary": "Deploy occupancy-based controls and LED retrofits to reduce avoidable electricity use.",
            "action_type": "reduction",
            "priority": "high",
            "confidence_score": 0.82,
            "estimated_impact_kg_co2e": round(emission * 0.22, 2),
            **_impact_bounds(emission * 0.22),
            "implementation_cost_usd": 12000,
            "time_to_impact_months": 2,
            "rationale": "Electricity optimization is the fastest controllable lever in most office operations.",
            "impact_model": {
                "kpi_refs": ["scope_2_kg"],
                "formula": "impact = scope_2_kg * 0.22",
            },
            "implementation_steps": [
                "Audit floor-wise electricity load",
                "Install occupancy sensors and control schedules",
                "Replace high-usage fixtures with LEDs",
                "Track baseline vs post-implementation savings",
            ],
            "evidence": _pick_evidence(["scope_2_energy", "kpi", "organization", "methodology"], fallback_min=2),
        },
        {
            "title": "Low-carbon commute policy for employees",
            "summary": "Launch hybrid work and transit incentives focused on high-commute departments.",
            "action_type": "reduction",
            "priority": "medium",
            "confidence_score": 0.76,
            "estimated_impact_kg_co2e": round(emission * 0.14, 2),
            **_impact_bounds(emission * 0.14),
            "implementation_cost_usd": 5000,
            "time_to_impact_months": 3,
            "rationale": "Commuting emissions are policy-addressable and can be reduced without heavy capex.",
            "impact_model": {
                "kpi_refs": ["transport_kg"],
                "formula": "impact = transport_kg * 0.14",
            },
            "implementation_steps": [
                "Identify top commuting hotspots",
                "Define hybrid eligibility by role",
                "Subsidize public transport/carpooling",
                "Review impact quarterly",
            ],
            "evidence": _pick_evidence(["transport", "kpi", "organization", "methodology"], fallback_min=2),
        },
        {
            "title": "TEME-backed native species offset plan",
            "summary": "Execute the modeled tree-planting strategy as a secondary lever after direct reductions.",
            "action_type": "offset",
            "priority": "medium",
            "confidence_score": 0.71,
            "estimated_impact_kg_co2e": round(tree_impact, 2),
            **_impact_bounds(tree_impact),
            "implementation_cost_usd": max(3000, total_trees * 3),
            "time_to_impact_months": 12,
            "rationale": "Offsets are meaningful when paired with direct reduction and validated survival assumptions.",
            "impact_model": {
                "kpi_refs": ["teme_total_trees"],
                "formula": "impact = max(50, emission_kg * 0.18)",
            },
            "implementation_steps": [
                "Finalize species mix from TEME output",
                "Secure land and maintenance contracts",
                "Track survival and growth annually",
                "Recalibrate offsets with observed mortality",
            ],
            "evidence": _pick_evidence(["teme", "offset", "methodology", "organization"], fallback_min=2),
        },
        {
            "title": "Supplier decarbonization scorecard",
            "summary": "Target top Scope 3 procurement hotspots using supplier-level intensity and contract clauses.",
            "action_type": "policy",
            "priority": "high",
            "confidence_score": 0.74,
            "estimated_impact_kg_co2e": round(emission * 0.12, 2),
            **_impact_bounds(emission * 0.12),
            "implementation_cost_usd": 8000,
            "time_to_impact_months": 5,
            "rationale": "Procurement clauses and preferred-vendor policies reduce embedded emissions at scale.",
            "impact_model": {
                "kpi_refs": ["scope_3_purchases_kg", "purchased_goods_kg"],
                "formula": "impact = purchases_related_kg * 0.12",
            },
            "implementation_steps": [
                "Identify top 20 emitting vendors by spend and category",
                "Set supplier disclosure and reduction requirements",
                "Embed low-carbon criteria in renewal cycles",
                "Track quarterly supplier-specific intensity trends",
            ],
            "evidence": _pick_evidence(["purchases", "kpi", "organization", "methodology"], fallback_min=2),
        },
        {
            "title": "Fleet and travel demand control",
            "summary": "Cut high-emission travel through trip substitution rules and route optimization governance.",
            "action_type": "reduction",
            "priority": "medium",
            "confidence_score": 0.72,
            "estimated_impact_kg_co2e": round(emission * 0.1, 2),
            **_impact_bounds(emission * 0.1),
            "implementation_cost_usd": 6000,
            "time_to_impact_months": 4,
            "rationale": "Travel controls produce measurable reductions without long infrastructure lead times.",
            "impact_model": {
                "kpi_refs": ["travel_kg", "transport_kg"],
                "formula": "impact = transport_related_kg * 0.10",
            },
            "implementation_steps": [
                "Set thresholds where virtual meetings are mandatory",
                "Prioritize rail over short-haul flights",
                "Enforce route and occupancy optimization",
                "Publish monthly compliance and emissions dashboard",
            ],
            "evidence": _pick_evidence(["transport", "kpi", "organization", "methodology"], fallback_min=2),
        },
    ]

    if "purchases" in focus and "scope_2_energy" not in focus:
        templates = [t for t in templates if t["title"] !=
                     "Optimize HVAC and lighting schedules"] + [templates[0]]

    return templates[: max(2, min(target_count, len(templates)))]


def _build_prompt(payload: Dict[str, Any], target_count: int) -> List[Dict[str, str]]:
    """
    Compact prompt builder — keeps the context under ~1,200 tokens to stay
    within free-tier rate limits on Groq / OpenRouter while still giving the
    LLM all the information it needs to produce grounded recommendations.
    """
    # ── Compact context summary (replaces the full JSON dump) ──────────────
    emission_kg = float(payload.get("emission_kg") or 0)
    org_name = (payload.get("organization_profile") or {}).get("organization_name") or "Unknown"
    industry = (payload.get("organization_profile") or {}).get("industry") or "Unknown"
    location = payload.get("location") or "India"
    focus_areas = payload.get("focus_areas") or []

    # Top-5 KPIs by value
    kpis = sorted(
        payload.get("kpi_snapshots") or [],
        key=lambda k: float(k.get("kpi_value") or 0),
        reverse=True
    )[:5]
    kpi_lines = "; ".join(
        f"{k.get('kpi_name')}={round(float(k.get('kpi_value') or 0), 1)}{k.get('kpi_unit', '')}"
        for k in kpis
    )

    # Up to 4 evidence items — just evidence_id + citation
    evidence_catalog = payload.get("evidence_catalog") or []
    evidence_ids = [str(e.get("evidence_id") or "") for e in evidence_catalog[:4] if e.get("evidence_id")]
    evidence_lines = "; ".join(
        f"{e.get('evidence_id')}: {str(e.get('citation') or '')[:80]}"
        for e in evidence_catalog[:4]
        if e.get("evidence_id")
    )

    compact_context = (
        f"Org: {org_name} | Industry: {industry} | Location: {location}\n"
        f"Total emissions: {round(emission_kg, 1)} kgCO2e\n"
        f"Focus areas: {', '.join(focus_areas)}\n"
        f"Top KPIs: {kpi_lines}\n"
        f"Evidence catalog IDs available: {', '.join(evidence_ids)}\n"
        f"Evidence: {evidence_lines}"
    )

    # ── Compact output schema ───────────────────────────────────────────────
    schema_hint = {
        "recommendations": [
            {
                "title": "str",
                "summary": "str (1-2 sentences)",
                "action_type": "reduction|offset|policy|compliance",
                "priority": "low|medium|high|critical",
                "confidence_score": "0.0-1.0",
                "estimated_impact_kg_co2e": "number",
                "estimated_impact_kg_co2e_low": "number",
                "estimated_impact_kg_co2e_high": "number",
                "implementation_cost_usd": "number|null",
                "time_to_impact_months": "int|null",
                "rationale": "str (1 sentence)",
                "impact_model": {"kpi_refs": ["str"], "formula": "str"},
                "implementation_steps": ["str x3-5"],
                "evidence": [
                    {"evidence_id": "must match catalog ID above", "source_type": "str",
                     "citation": "str", "excerpt": "str"}
                ]
            }
        ]
    }

    return [
        {
            "role": "system",
            "content": (
                "You are a climate strategy co-pilot for enterprise decarbonization. "
                "Return ONLY strict JSON — no markdown fences, no prose outside JSON. "
                "Every recommendation MUST cite ≥2 evidence_ids from the catalog. "
                "Do not invent data. Keep summaries and rationale concise (1-2 sentences max). "
                "CRITICAL RULES FOR IMPACT NUMBERS: "
                f"(1) The organisation's TOTAL emissions are {round(emission_kg, 1)} kgCO2e. "
                f"(2) No single recommendation may claim more than {round(emission_kg * 0.30, 1)} kgCO2e savings "
                f"(30% of total is already very aggressive). "
                "(3) The sum of ALL recommendations combined must not exceed 90% of total emissions. "
                "(4) Use ONLY the emission numbers from the context provided — do NOT invent large round numbers."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Generate {target_count} carbon reduction recommendations. "
                "Rules: ≥60% must be 'reduction' action_type; max 1 'offset'; "
                "impact bounds (low=80%, high=120% of central estimate); "
                f"3-5 implementation_steps per recommendation.\n\n"
                f"Context:\n{compact_context}\n\n"
                f"Output schema:\n{json.dumps(schema_hint, ensure_ascii=True)}"
            ),
        },
    ]


def _call_openai_compatible(messages: List[Dict[str, str]]) -> Dict[str, Any]:
    cfg = _llm_config()
    if not cfg["api_key"]:
        raise HTTPException(status_code=400, detail="LLM_API_KEY is missing")

    def _request_with_model(model_name: str) -> Dict[str, Any]:
        body = {
            "model": model_name,
            "messages": messages,
            "temperature": 0.1,
            "max_tokens": 1500,
            "response_format": {"type": "json_object"},
        }

        if cfg["provider"] == "openrouter":
            body["provider"] = {
                "require_parameters": True,
            }

            if os.getenv("LLM_OPENROUTER_DATA_COLLECTION", "deny").strip().lower() in {"allow", "deny"}:
                body["provider"]["data_collection"] = os.getenv(
                    "LLM_OPENROUTER_DATA_COLLECTION", "deny").strip().lower()

            if os.getenv("LLM_OPENROUTER_ZDR", "false").strip().lower() == "true":
                body["provider"]["zdr"] = True

            if os.getenv("LLM_OPENROUTER_ENABLE_RESPONSE_HEALING", "true").strip().lower() == "true":
                body["plugins"] = [{"id": "response-healing"}]

        resp = requests.post(
            f"{cfg['base_url']}/chat/completions",
            json=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {cfg['api_key']}",
                "HTTP-Referer": os.getenv("LLM_SITE_URL", "http://localhost:3000"),
                "X-Title": os.getenv("LLM_APP_NAME", "CarbonSense"),
            },
            timeout=45,
        )

        if resp.status_code >= 400:
            raise HTTPException(
                status_code=502, detail=f"LLM provider error: {resp.status_code} {resp.text[:500]}")

        return resp.json()

    data = None
    last_error: Optional[Exception] = None
    for model_name in _model_fallbacks():
        try:
            data = _request_with_model(model_name)
            break
        except Exception as e:
            last_error = e
            continue

    if data is None:
        # OpenRouter can return 404 when a specific model has no active endpoints.
        if cfg["provider"] == "openrouter" and cfg["model"] != "openrouter/auto":
            try:
                data = _request_with_model("openrouter/auto")
            except Exception as e2:
                raise HTTPException(
                    status_code=502, detail=f"LLM provider error: {e2}")
        else:
            raise HTTPException(
                status_code=502, detail=f"LLM provider error: {last_error}")

    try:
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(_strip_json_block(content))
        return parsed
    except Exception as e:
        raise HTTPException(
            status_code=502, detail=f"Invalid LLM response format: {e}")


def _validate_with_evaluator(
    recs: List[Dict[str, Any]],
    llm_payload: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Optional second-pass LLM critic that checks each recommendation for:
      - Consistency with the organisation's KPI data
      - Realistic cost and timeline claims
      - Proper evidence citation (not hallucinated)
      - Duplication with other recommendations

    Only runs when LLM_EVALUATOR_ENABLED=true in .env.
    Returns a filtered/corrected list of recommendations.
    If the evaluator fails or rejects >50%, the original list is returned.
    """
    enabled = os.getenv("LLM_EVALUATOR_ENABLED", "false").strip().lower() == "true"
    if not enabled or not recs:
        return recs

    cfg = _llm_config()
    if not cfg["api_key"]:
        return recs

    eval_schema = {
        "evaluations": [
            {
                "rank": "integer — matches the recommendation rank",
                "verdict": "pass | flag | reject",
                "reason": "one-sentence explanation",
                "corrected_confidence_score": "number 0-1 or null if unchanged",
            }
        ]
    }

    recs_summary = [
        {
            "rank": r.get("rank"),
            "title": r.get("title"),
            "estimated_impact_kg_co2e": r.get("estimated_impact_kg_co2e"),
            "implementation_cost_usd": r.get("implementation_cost_usd"),
            "confidence_score": r.get("confidence_score"),
            "evidence_count": len(r.get("evidence") or []),
        }
        for r in recs
    ]

    messages = [
        {
            "role": "system",
            "content": (
                "You are a critical sustainability auditor reviewing AI-generated carbon reduction recommendations. "
                "Your job is to flag or reject any recommendation that: "
                "(a) overclaims emission reductions relative to the organisation KPI data, "
                "(b) cites fewer than 2 evidence items, "
                "(c) has an unrealistic cost/timeline, or "
                "(d) duplicates another recommendation. "
                "Return only strict JSON with no prose outside it. "
                "Be conservative: only reject if clearly wrong. Use 'flag' for borderline cases."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Evaluate these {len(recs)} recommendations against the organisation context.\n\n"
                f"Organisation emission_kg: {llm_payload.get('emission_kg', 0)}\n"
                f"Focus areas: {llm_payload.get('focus_areas', [])}\n\n"
                f"Recommendations to evaluate:\n{json.dumps(recs_summary, ensure_ascii=True)}\n\n"
                f"Output JSON schema:\n{json.dumps(eval_schema, ensure_ascii=True)}"
            ),
        },
    ]

    try:
        body = {
            "model": _llm_config()["model"],
            "messages": messages,
            "temperature": 0.0,
            "response_format": {"type": "json_object"},
        }
        resp = requests.post(
            f"{cfg['base_url']}/chat/completions",
            json=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {cfg['api_key']}",
                "HTTP-Referer": os.getenv("LLM_SITE_URL", "http://localhost:3000"),
                "X-Title": os.getenv("LLM_APP_NAME", "CarbonSense-Evaluator"),
            },
            timeout=30,
        )
        if resp.status_code >= 400:
            return recs  # Evaluator failed — return original.

        content = resp.json()["choices"][0]["message"]["content"]
        eval_result = json.loads(_strip_json_block(content))
        evaluations = eval_result.get("evaluations", [])

        # Build lookup by rank.
        verdict_map: Dict[int, Dict[str, Any]] = {e["rank"]: e for e in evaluations if "rank" in e}

        kept: List[Dict[str, Any]] = []
        rejected_count = 0
        for rec in recs:
            ev = verdict_map.get(rec.get("rank"))
            if ev is None:
                kept.append(rec)  # No evaluation — keep.
                continue
            verdict = str(ev.get("verdict", "pass")).lower()
            if verdict == "reject":
                rejected_count += 1
                continue
            # Apply any confidence correction from the evaluator.
            if ev.get("corrected_confidence_score") is not None:
                try:
                    corrected = float(ev["corrected_confidence_score"])
                    rec = {**rec, "confidence_score": max(0.0, min(1.0, corrected))}
                except Exception:
                    pass
            kept.append(rec)

        # Safety valve: if evaluator rejects >50%, ignore its output.
        if rejected_count > len(recs) / 2:
            return recs

        return kept if kept else recs

    except Exception:
        # Evaluator errors are non-fatal — return original recommendations.
        return recs


def _normalize_recommendations(items: List[Dict[str, Any]], allowed_evidence_ids: Optional[Set[str]] = None) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    allowed_priority = {"low", "medium", "high", "critical"}
    allowed_sources = {"teme_run", "ocr_receipt", "kpi_snapshot", "external", "manual"}

    def _to_float(value: Any, default: float = 0.0) -> float:
        try:
            return float(value)
        except Exception:
            return default

    def _evidence_score(evidence_items: List[Dict[str, Any]]) -> float:
        if not evidence_items:
            return 0.0
        score = 0.0
        for ev in evidence_items:
            if ev.get("citation"):
                score += 0.4
            if ev.get("excerpt"):
                score += 0.3
            if ev.get("source_table") or ev.get("uri"):
                score += 0.3
        return max(0.0, min(1.0, score / max(1, len(evidence_items))))

    for idx, rec in enumerate(items, start=1):
        priority = str(rec.get("priority", "medium")).strip().lower()
        if priority not in allowed_priority:
            priority = "medium"

        try:
            confidence = float(rec.get("confidence_score", 0.6))
        except Exception:
            confidence = 0.6
        confidence = max(0.0, min(1.0, confidence))

        impact = _to_float(rec.get("estimated_impact_kg_co2e"), 0.0)
        impact_low = _to_float(
            rec.get("estimated_impact_kg_co2e_low"), max(0.0, impact * 0.8))
        impact_high = _to_float(
            rec.get("estimated_impact_kg_co2e_high"), max(impact, impact * 1.2))

        evidence = rec.get("evidence", []) or []
        normalized_evidence = []
        for ev in evidence:
            source_type = str(ev.get("source_type", "manual")).strip()
            if source_type not in allowed_sources:
                source_type = "manual"
            evidence_id = str(ev.get("evidence_id") or "").strip()
            if allowed_evidence_ids is not None and evidence_id and evidence_id not in allowed_evidence_ids:
                continue
            normalized_evidence.append(
                {
                    "evidence_id": evidence_id or None,
                    "source_type": source_type,
                    "source_table": ev.get("source_table"),
                    "source_record_id": ev.get("source_record_id") or evidence_id or None,
                    "uri": ev.get("uri"),
                    "citation": ev.get("citation"),
                    "excerpt": ev.get("excerpt"),
                }
            )

        out.append(
            {
                "rank": idx,
                "title": str(rec.get("title", f"Recommendation {idx}"))[:240],
                "summary": str(rec.get("summary", ""))[:1200],
                "action_type": str(rec.get("action_type", "reduction"))[:64],
                "priority": priority,
                "confidence_score": confidence,
                "estimated_impact_kg_co2e": impact,
                "estimated_impact_kg_co2e_low": impact_low,
                "estimated_impact_kg_co2e_high": impact_high,
                "implementation_cost_usd": rec.get("implementation_cost_usd"),
                "time_to_impact_months": rec.get("time_to_impact_months"),
                "rationale": str(rec.get("rationale", ""))[:2000],
                "implementation_steps": rec.get("implementation_steps", []),
                "impact_model": rec.get("impact_model", {}),
                "evidence": normalized_evidence,
                "evidence_score": _evidence_score(normalized_evidence),
            }
        )

    return out


def _rank_and_filter(recs: List[Dict[str, Any]], emission_kg: float, target_count: int, focus_areas: List[str]) -> List[Dict[str, Any]]:
    if not recs:
        return []

    # Require at least 2 evidence items per recommendation.
    filtered = [
        r
        for r in recs
        if len(r.get("evidence", [])) >= 2
        and len([s for s in (r.get("implementation_steps") or []) if str(s).strip()]) >= 3
        and float(r.get("confidence_score") or 0.0) >= 0.45
    ]
    if not filtered:
        return []

    # Enforce action mix constraints.
    reductions = [r for r in filtered if r.get("action_type") == "reduction"]
    offsets = [r for r in filtered if r.get("action_type") == "offset"]
    min_reductions = 2 if target_count >= 4 else 1
    if len(reductions) < min_reductions:
        return []
    if len(offsets) > 1:
        offsets = offsets[:1]
        filtered = reductions + offsets + \
            [r for r in filtered if r.get("action_type") not in {
                "reduction", "offset"}]

    max_impact = max([_safe_float(r.get("estimated_impact_kg_co2e"), 0.0)
                     for r in filtered] + [1.0])

    # Rank by weighted realism score, not only impact/cost.
    def _score(rec: Dict[str, Any]) -> float:
        impact = _safe_float(rec.get("estimated_impact_kg_co2e"), 0.0)
        confidence = _safe_float(rec.get("confidence_score"), 0.0)
        cost = _safe_float(rec.get("implementation_cost_usd"), 0.0)
        months = _safe_float(rec.get("time_to_impact_months"), 6.0)
        evidence_score = _safe_float(rec.get("evidence_score"), 0.0)

        kpi_refs = [str(x).lower() for x in (
            (rec.get("impact_model") or {}).get("kpi_refs") or [])]
        relevance = 0.0
        for area in focus_areas:
            if area in " ".join(kpi_refs):
                relevance += 0.25
        relevance = min(1.0, relevance)

        impact_norm = max(0.0, min(1.0, impact / max_impact))
        affordability = 1.0 / (1.0 + max(0.0, cost) / 20000.0)
        speed = 1.0 / (1.0 + max(1.0, months) / 12.0)
        feasibility = 0.6 * affordability + 0.4 * speed

        return (
            0.32 * evidence_score
            + 0.24 * confidence
            + 0.20 * relevance
            + 0.14 * impact_norm
            + 0.10 * feasibility
        )

    filtered.sort(key=_score, reverse=True)

    # Cap total impact to 90% of emissions to avoid overclaiming.
    if emission_kg > 0:
        cap = emission_kg * 0.9
        total = sum(float(r.get("estimated_impact_kg_co2e") or 0)
                    for r in filtered)
        if total > cap and total > 0:
            scale = cap / total
            for r in filtered:
                r["estimated_impact_kg_co2e"] = round(
                    float(r.get("estimated_impact_kg_co2e") or 0) * scale, 2)
                r["estimated_impact_kg_co2e_low"] = round(
                    float(r.get("estimated_impact_kg_co2e_low") or 0) * scale, 2)
                r["estimated_impact_kg_co2e_high"] = round(
                    float(r.get("estimated_impact_kg_co2e_high") or 0) * scale, 2)

    for idx, rec in enumerate(filtered, start=1):
        rec["rank"] = idx

    # Per-recommendation hard cap: no single action can claim more than
    # 30% of the organisation's total emissions. Guards against any
    # LLM-hallucinated large round numbers that slipped through.
    if emission_kg > 0:
        per_rec_ceiling = emission_kg * 0.30
        for r in filtered:
            impact = float(r.get("estimated_impact_kg_co2e") or 0)
            if impact > per_rec_ceiling:
                scale = per_rec_ceiling / impact
                r["estimated_impact_kg_co2e"]      = round(impact * scale, 2)
                r["estimated_impact_kg_co2e_low"]  = round(float(r.get("estimated_impact_kg_co2e_low")  or 0) * scale, 2)
                r["estimated_impact_kg_co2e_high"] = round(float(r.get("estimated_impact_kg_co2e_high") or 0) * scale, 2)

    # Cap total impact to 90% of emissions to avoid overclaiming.
    if emission_kg > 0:
        cap = emission_kg * 0.9
        total = sum(float(r.get("estimated_impact_kg_co2e") or 0)
                    for r in filtered)
        if total > cap and total > 0:
            scale = cap / total
            for r in filtered:
                r["estimated_impact_kg_co2e"] = round(
                    float(r.get("estimated_impact_kg_co2e") or 0) * scale, 2)
                r["estimated_impact_kg_co2e_low"] = round(
                    float(r.get("estimated_impact_kg_co2e_low") or 0) * scale, 2)
                r["estimated_impact_kg_co2e_high"] = round(
                    float(r.get("estimated_impact_kg_co2e_high") or 0) * scale, 2)

    return filtered[: max(2, min(target_count, len(filtered)))]


def _get_teme_run(teme_run_id: Optional[str], user_id: str) -> Dict[str, Any]:
    if not teme_run_id:
        q = (
            supabase.table("teme_runs")
            .select("id,user_id,project_name,emission_kg,result,created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if not q.data:
            return {}
        return q.data[0]

    q = (
        supabase.table("teme_runs")
        .select("id,user_id,project_name,emission_kg,result,created_at")
        .eq("id", teme_run_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not q.data:
        return {}
    return q.data[0]



def _fetch_upload_context(upload_id: str) -> Dict[str, Any]:
    """
    Fetch emission data for a specific upload from Supabase.
    Returns a dict with emission_kg, kpi_snapshots and breakdown,
    or an empty dict if the upload is not found.
    """
    try:
        # Get the upload header row (total_emissions_kg, period, file name)
        upload_res = (
            supabase.table("organization_uploads")
            .select("id,original_file_name,period_start,period_end,total_emissions_kg,organization_id")
            .eq("id", upload_id)
            .limit(1)
            .execute()
        )
        if not upload_res.data:
            return {}
        upload = upload_res.data[0]

        emission_kg = float(upload.get("total_emissions_kg") or 0)
        project_name = str(upload.get("original_file_name") or "Emissions Upload").strip()
        period_start = upload.get("period_start")
        period_end = upload.get("period_end")
        organization_id = upload.get("organization_id")

        # Get emission entries for this upload to build KPI snapshots + breakdown
        entries_res = (
            supabase.table("emission_entries")
            .select("category,co2_kg,entry_date")
            .eq("upload_id", upload_id)
            .execute()
        )
        entries = entries_res.data or []

        # Build category breakdown
        by_category: Dict[str, float] = {}
        for e in entries:
            cat = str(e.get("category") or "other").lower().strip()
            by_category[cat] = round(by_category.get(cat, 0.0) + float(e.get("co2_kg") or 0), 4)

        computed_from_entries = sum(float(e.get("co2_kg") or 0) for e in entries)
        if emission_kg <= 0 and computed_from_entries > 0:
            emission_kg = round(computed_from_entries, 4)

        # If no entries but we have total_emissions_kg, still produce minimal KPIs
        if not by_category and emission_kg > 0:
            by_category["total"] = round(emission_kg, 4)

        # Build KPI snapshots from category totals
        kpi_snapshots = [
            {
                "kpi_name": f"{cat}_kg",
                "kpi_value": round(val, 2),
                "kpi_unit": "kgCO2e",
                "period_start": period_start,
                "period_end": period_end,
                "meta": {"source": "organization_uploads", "upload_id": upload_id},
            }
            for cat, val in by_category.items()
            if val > 0
        ]

        return {
            "emission_kg": emission_kg,
            "project_name": project_name,
            "kpi_snapshots": kpi_snapshots,
            "period_start": period_start,
            "period_end": period_end,
            "by_category_kg_co2e": by_category,
            "organization_id": organization_id,
        }
    except Exception as exc:
        print(f"[recommendations] Could not fetch upload context for {upload_id}: {exc}")
        return {}


def _build_cache_key(payload: Dict[str, Any]) -> str:
    """
    Build a stable, lightweight cache key.

    - When `emissions_upload_id` is present we use it directly — this guarantees
      exactly one recommendation session per uploaded file, regardless of whether
      emission_kg changed due to rounding.
    - Otherwise we fall back to the quantised emission + KPI hash (org-level cache).
    """
    # Per-upload key: one session per file, guaranteed unique.
    upload_id = str(payload.get("emissions_upload_id") or "").strip()
    if upload_id:
        org_id = str(payload.get("organization_id") or "")
        raw = f"upload::{org_id}::{upload_id}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    # Org-level fallback (when navigating to /recommendations without a specific upload)
    emission_kg = round(float(payload.get("emission_kg") or 0) / 500) * 500
    org_id = str(payload.get("organization_id") or "")
    location = str(payload.get("location") or "India").strip().lower()

    # Hash of top-5 KPI names+values (rounded) so different data produces a new key
    kpis = sorted(
        payload.get("kpi_snapshots") or [],
        key=lambda k: float(k.get("kpi_value") or 0),
        reverse=True,
    )[:5]
    kpi_sig = "|".join(
        f"{k.get('kpi_name')}:{round(float(k.get('kpi_value') or 0) / 100) * 100}"
        for k in kpis
    )

    raw = f"{org_id}::{emission_kg}::{location}::{kpi_sig}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _lookup_cached_session(org_id: str, cache_key: str) -> Optional[Dict[str, Any]]:
    """
    Return an existing recommendation session if one was generated in the last
    7 days for this org with the same cache key. Returns None on any failure.
    """
    try:
        from datetime import datetime, timezone, timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        res = (
            supabase.table("recommendation_sessions")
            .select("id, organization_id, project_name, emission_kg, error_message, llm_model, llm_provider, status, created_at")
            .eq("organization_id", org_id)
            .eq("input_hash", cache_key)
            .eq("status", "generated")
            .gte("created_at", cutoff)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        session = res.data[0]
        # Fetch the recommendations for this session
        rec_res = (
            supabase.table("recommendations")
            .select("*")
            .eq("session_id", session["id"])
            .order("rank", desc=False)
            .execute()
        )
        recs = rec_res.data or []
        if not recs:
            return None  # Session exists but has no recs — re-generate

        # Discard stale cached sessions that have 0 impact or 0 emission
        total_impact = sum(float(r.get("estimated_impact_kg_co2e") or 0) for r in recs)
        session_emission = float(session.get("emission_kg") or 0)
        if total_impact <= 0 or session_emission <= 0:
            print(f"[recommendations] Cached session {session['id']} has invalid impact ({total_impact}) or emission ({session_emission}) — skipping cache to regenerate")
            return None

        return {
            "session_id": session["id"],
            "llm_used": True,
            "llm_warning": session.get("error_message"),
            "recommendations": recs,
            "_cache_hit": True,
            "emission_kg": float(session.get("emission_kg") or 0),
            "project_name": session.get("project_name"),
        }
    except Exception:
        return None  # Cache lookup failure is non-fatal — just re-generate


def generate_and_store_recommendations(payload: Dict[str, Any], force_refresh: bool = False) -> Dict[str, Any]:
    user_id = payload["user_id"]
    org_id = payload["organization_id"]
    emissions_upload_id = str(payload.get("emissions_upload_id") or "").strip() or None

    # If no upload_id was passed and emission_kg is 0, auto-resolve the latest upload for this org
    if not emissions_upload_id and float(payload.get("emission_kg") or 0) <= 0:
        try:
            latest_upload = (
                supabase.table("organization_uploads")
                .select("id")
                .eq("organization_id", org_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if latest_upload.data:
                emissions_upload_id = str(latest_upload.data[0]["id"])
                print(f"[recommendations] Auto-selected latest upload {emissions_upload_id} for org={org_id}")
        except Exception as exc:
            print(f"[recommendations] Could not auto-fetch latest upload: {exc}")

    # ── If an upload_id is given, enrich payload with that upload's actual data ─
    # This ensures each upload gets its own tailored context rather than relying
    # on whatever was cached in sessionStorage at the frontend.
    if emissions_upload_id:
        upload_ctx = _fetch_upload_context(emissions_upload_id)
        if upload_ctx and upload_ctx.get("emission_kg", 0) > 0:
            # Merge: upload data takes precedence over anything passed from frontend
            payload = {
                **payload,
                "emission_kg": upload_ctx["emission_kg"],
                "project_name": upload_ctx.get("project_name") or payload.get("project_name"),
                "kpi_snapshots": upload_ctx.get("kpi_snapshots") or payload.get("kpi_snapshots", []),
                "emissions_upload_id": emissions_upload_id,
            }
            if upload_ctx.get("by_category_kg_co2e"):
                payload.setdefault("teme_result", {})
                if not isinstance(payload["teme_result"], dict):
                    payload["teme_result"] = {}
                payload["teme_result"].setdefault("csv_summary", {})
                payload["teme_result"]["csv_summary"]["by_category_kg_co2e"] = upload_ctx["by_category_kg_co2e"]
            print(f"[recommendations] Enriched payload from upload {emissions_upload_id}: "
                  f"{upload_ctx['emission_kg']:.1f} kgCO2e, {len(upload_ctx['kpi_snapshots'])} KPIs")

    # ── Idempotency: return cached session if one exists within 7 days ─────
    # Skip cache when force_refresh=True (explicit user action) or when
    # the caller is a background ingestion pipeline (no user-visible context).
    if not force_refresh:
        cache_key = _build_cache_key(payload)
        cached = _lookup_cached_session(org_id, cache_key)
        if cached:
            print(f"[recommendations] Cache hit for org={org_id}, upload={emissions_upload_id}, "
                  f"session={cached['session_id']} — skipping LLM call")
            return cached
    else:
        cache_key = _build_cache_key(payload)

    teme_run = _get_teme_run(payload.get("teme_run_id"), user_id)

    org_profile = _get_org_profile(org_id)

    llm_payload = {
        "organization_id": org_id,
        "user_id": user_id,
        "project_name": payload.get("project_name") or teme_run.get("project_name") or "Decarbonization Plan",
        "location": payload.get("location"),
        "emission_kg": payload.get("emission_kg") or teme_run.get("emission_kg") or 0,
        "time_horizon_years": payload.get("time_horizon_years", 15),
        "kpi_snapshots": payload.get("kpi_snapshots", []),
        "teme_result": teme_run.get("result", payload.get("teme_result", {})),
        "factor_set_version": os.getenv("EMISSION_FACTOR_SET_VERSION", "default"),
        "methodology_refs": [
            "GHG Protocol Corporate Standard",
            "DEFRA conversion factors",
            "EPA/IPCC combustion factors",
        ],
        "assumptions": [
            "Emission factors vary by geography and year",
            "KPI snapshots are aggregated from supplied activity data",
        ],
    }

    llm_payload["organization_profile"] = {
        "organization_name": org_profile.get("name"),
        "industry": org_profile.get("industry"),
        "created_at": org_profile.get("created_at"),
    }
    llm_payload["focus_areas"] = _derive_focus_areas(llm_payload)
    llm_payload["evidence_catalog"] = _build_evidence_catalog(
        llm_payload, org_profile, teme_run)

    # ── Layer 1: Inject curated knowledge base entries as verified evidence ──
    # KB entries carry GHG Protocol / IEA / ENERGY STAR citations so the LLM
    # must ground its reasoning in real, traceable sources.
    llm_payload["evidence_catalog"] = _enrich_evidence_from_knowledge_base(
        llm_payload["evidence_catalog"], llm_payload["focus_areas"]
    )

    llm_payload["target_recommendation_count"] = _target_recommendation_count(
        llm_payload, llm_payload["evidence_catalog"])
    llm_payload["recommendation_constraints"] = {
        "min_evidence_items_per_recommendation": 2,
        "min_implementation_steps": 3,
        "max_offset_actions": 1,
        "require_kpi_linkage": True,
    }

    llm_used = True
    llm_warning = None
    messages = _build_prompt(
        llm_payload, llm_payload["target_recommendation_count"])
    allowed_evidence_ids = {str(e.get("evidence_id"))
                            for e in llm_payload["evidence_catalog"] if e.get("evidence_id")}
    # Gather KB entries for deterministic impact calculation (Layer 2).
    from ml_services.recommendations.knowledge_base import get_all_entries as _get_all_kb
    _kb_entries = _get_all_kb()

    try:
        raw = _call_openai_compatible(messages)
        recs = _normalize_recommendations(
            raw.get("recommendations", []), allowed_evidence_ids=allowed_evidence_ids)

        # ── Layer 2: Replace LLM-guessed impacts with deterministic calculations ──
        # Each recommendation is matched to a KB entry and the CO2 impact is
        # recalculated from the org's actual KPI values using GHG-Protocol-based
        # reduction factors. The LLM's original values are preserved for audit.
        recs = apply_deterministic_impacts(
            recs,
            llm_payload.get("kpi_snapshots") or [],
            float(llm_payload.get("emission_kg") or 0),
            _kb_entries,
        )

        recs = _rank_and_filter(
            recs,
            float(llm_payload.get("emission_kg") or 0),
            int(llm_payload["target_recommendation_count"]),
            llm_payload["focus_areas"],
        )

        # ── Layer 3 (optional): Two-stage evaluator LLM ──
        # Only active when LLM_EVALUATOR_ENABLED=true in .env.
        # Filters out hallucinated or inconsistent recommendations.
        recs = _validate_with_evaluator(recs, llm_payload)

        if not recs:
            raise ValueError("No recommendations returned")
    except Exception as e:
        llm_used = False
        llm_warning = str(e)
        recs = _normalize_recommendations(
            _heuristic_fallback(
                llm_payload,
                target_count=int(llm_payload["target_recommendation_count"]),
                evidence_catalog=llm_payload["evidence_catalog"],
                focus_areas=llm_payload["focus_areas"],
            ),
            allowed_evidence_ids=allowed_evidence_ids,
        )
        recs = _rank_and_filter(
            recs,
            float(llm_payload.get("emission_kg") or 0),
            int(llm_payload["target_recommendation_count"]),
            llm_payload["focus_areas"],
        )

    cfg = _llm_config()
    session_row = {
        "organization_id": org_id,
        "user_id": user_id,
        "project_name": llm_payload["project_name"],
        "location": llm_payload.get("location"),
        "emission_kg": llm_payload.get("emission_kg"),
        "teme_run_id": teme_run.get("id"),
        "input_payload": payload,
        "context_snapshot": llm_payload,
        "llm_provider": cfg["provider"],
        "llm_model": cfg["model"],
        "prompt_version": "v3_evidence_grounded",
        "status": "generated",
        "error_message": llm_warning,
        "input_hash": cache_key if not force_refresh else _build_cache_key(payload),
        "factor_set_version": llm_payload.get("factor_set_version"),
        "methodology_refs": llm_payload.get("methodology_refs", []),
        "assumptions": llm_payload.get("assumptions", []),
    }

    session_ins = supabase.table(
        "recommendation_sessions").insert(session_row).execute()
    if not session_ins.data:
        raise HTTPException(
            status_code=500, detail="Failed to create recommendation session")
    session = session_ins.data[0]

    kpi_rows = []
    for kpi in payload.get("kpi_snapshots", []):
        kpi_rows.append(
            {
                "session_id": session["id"],
                "user_id": user_id,
                "kpi_name": kpi.get("kpi_name"),
                "kpi_value": kpi.get("kpi_value"),
                "kpi_unit": kpi.get("kpi_unit"),
                "period_start": kpi.get("period_start"),
                "period_end": kpi.get("period_end"),
                "meta": kpi.get("meta", {}),
            }
        )
    if kpi_rows:
        supabase.table("recommendation_kpi_snapshots").insert(
            kpi_rows).execute()

    rec_rows: List[Dict[str, Any]] = []
    evidence_rows: List[Dict[str, Any]] = []

    for rec in recs:
        row = {
            "session_id": session["id"],
            "user_id": user_id,
            "rank": rec["rank"],
            "title": rec["title"],
            "summary": rec["summary"],
            "action_type": rec["action_type"],
            "priority": rec["priority"],
            "status": "proposed",
            "confidence_score": rec["confidence_score"],
            "estimated_impact_kg_co2e": rec.get("estimated_impact_kg_co2e"),
            "estimated_impact_kg_co2e_low": rec.get("estimated_impact_kg_co2e_low"),
            "estimated_impact_kg_co2e_high": rec.get("estimated_impact_kg_co2e_high"),
            "implementation_cost_usd": rec.get("implementation_cost_usd"),
            "time_to_impact_months": rec.get("time_to_impact_months"),
            "rationale": rec.get("rationale"),
            "evidence_score": rec.get("evidence_score", 0.0),
            "recommendation_payload": {
                "implementation_steps": rec.get("implementation_steps", []),
                "impact_model": rec.get("impact_model", {}),
                "generator": "llm" if llm_used else "heuristic_fallback",
            },
        }
        rec_rows.append(row)

    inserted = supabase.table("recommendations").insert(rec_rows).execute()
    inserted_rows = inserted.data or []

    by_rank = {r.get("rank"): r for r in inserted_rows}
    for rec in recs:
        inserted_row = by_rank.get(rec["rank"])
        if not inserted_row:
            continue
        for ev in rec.get("evidence", [])[:4]:
            evidence_rows.append(
                {
                    "recommendation_id": inserted_row["id"],
                    "session_id": session["id"],
                    "user_id": user_id,
                    "source_type": str(ev.get("source_type", "manual"))[:64],
                    "source_table": ev.get("source_table"),
                    "source_record_id": ev.get("source_record_id") or ev.get("evidence_id"),
                    "uri": ev.get("uri"),
                    "citation": ev.get("citation"),
                    "excerpt": ev.get("excerpt"),
                    "evidence_payload": ev,
                }
            )

    if evidence_rows:
        supabase.table("recommendation_evidence").insert(
            evidence_rows).execute()

    return {
        "session_id": session["id"],
        "llm_used": llm_used,
        "llm_warning": llm_warning,
        "recommendations": inserted_rows,
        "emission_kg": float(llm_payload.get("emission_kg") or 0),
        "project_name": llm_payload.get("project_name"),
    }


def list_session_recommendations(session_id: str, user_id: str) -> Dict[str, Any]:
    session_q = (
        supabase.table("recommendation_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not session_q.data:
        raise HTTPException(
            status_code=404, detail="Recommendation session not found")

    rec_q = (
        supabase.table("recommendations")
        .select("*")
        .eq("session_id", session_id)
        .eq("user_id", user_id)
        .order("rank", desc=False)
        .execute()
    )

    return {
        "session": session_q.data[0],
        "recommendations": rec_q.data or [],
    }


def save_feedback(session_id: str, recommendation_id: str, user_id: str, feedback: Dict[str, Any]) -> Dict[str, Any]:
    row = {
        "session_id": session_id,
        "recommendation_id": recommendation_id,
        "user_id": user_id,
        "feedback_type": feedback["feedback_type"],
        "feedback_text": feedback.get("feedback_text"),
        "feedback_payload": feedback.get("feedback_payload", {}),
    }

    ins = supabase.table("recommendation_feedback").insert(row).execute()
    if not ins.data:
        raise HTTPException(
            status_code=500, detail="Failed to save recommendation feedback")
    return ins.data[0]
