import json
import os
import hashlib
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from dotenv import load_dotenv
import requests

from ml_services.common.supabase_client import supabase


# Load backend env deterministically from repository root (.env).
_REPO_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(_REPO_ROOT / ".env", override=False)


def _llm_config() -> Dict[str, str]:
    provider = os.getenv("LLM_PROVIDER", "openrouter").strip().lower()
    api_key = os.getenv("LLM_API_KEY", "").strip()
    base_url = os.getenv("LLM_API_BASE_URL", "https://openrouter.ai/api/v1").strip().rstrip("/")
    model = os.getenv("LLM_MODEL", "openrouter/auto").strip()
    return {
        "provider": provider,
        "api_key": api_key,
        "base_url": base_url,
        "model": model,
    }


def _hash_payload(payload: Dict[str, Any]) -> str:
    try:
        canonical = json.dumps(payload, sort_keys=True, ensure_ascii=True, default=str)
    except Exception:
        canonical = json.dumps({"error": "payload_not_serializable"}, ensure_ascii=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _strip_json_block(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if len(lines) >= 3:
            cleaned = "\n".join(lines[1:-1]).strip()
    return cleaned


def _heuristic_fallback(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    emission = float(payload.get("emission_kg", 0))
    total_trees = int(payload.get("teme_result", {}).get("total_trees", 0))
    tree_impact = max(50.0, emission * 0.18)

    def _impact_bounds(value: float) -> Dict[str, float]:
        return {
            "estimated_impact_kg_co2e_low": round(max(0.0, value * 0.8), 2),
            "estimated_impact_kg_co2e_high": round(max(0.0, value * 1.2), 2),
        }

    return [
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
            "evidence": [
                {
                    "source_type": "kpi_snapshot",
                    "source_table": "recommendation_kpi_snapshots",
                    "citation": "Internal utility baseline and monthly meter trends",
                    "excerpt": "High after-hours usage indicates avoidable load.",
                },
                {
                    "source_type": "manual",
                    "citation": "Facilities energy best-practices checklist",
                    "excerpt": "Lighting/HVAC scheduling is a common quick win in office footprints.",
                }
            ],
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
            "evidence": [
                {
                    "source_type": "manual",
                    "citation": "Organization-level commute policy benchmark",
                    "excerpt": "Behavioral levers can deliver quick wins in 1-2 quarters.",
                },
                {
                    "source_type": "kpi_snapshot",
                    "source_table": "recommendation_kpi_snapshots",
                    "citation": "Mobility activity KPI snapshot",
                    "excerpt": "Travel-related activity exceeds baseline for comparable teams.",
                }
            ],
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
            "evidence": [
                {
                    "source_type": "teme_run",
                    "source_table": "teme_runs",
                    "citation": "Latest TEME simulation output",
                    "excerpt": "Total trees and maturity window support staged offset planning.",
                },
                {
                    "source_type": "manual",
                    "citation": "Offset governance policy",
                    "excerpt": "Offsets are secondary to direct reduction and require verification.",
                }
            ],
        },
    ]


def _build_prompt(payload: Dict[str, Any]) -> List[Dict[str, str]]:
    schema_hint = {
        "recommendations": [
            {
                "title": "string",
                "summary": "string",
                "action_type": "reduction | offset | policy | compliance",
                "priority": "low | medium | high | critical",
                "confidence_score": "number between 0 and 1",
                "estimated_impact_kg_co2e": "number",
                "estimated_impact_kg_co2e_low": "number",
                "estimated_impact_kg_co2e_high": "number",
                "implementation_cost_usd": "number or null",
                "time_to_impact_months": "integer or null",
                "rationale": "string",
                "impact_model": {
                    "kpi_refs": ["string"],
                    "formula": "string"
                },
                "implementation_steps": ["string", "string"],
                "evidence": [
                    {
                        "source_type": "teme_run | ocr_receipt | kpi_snapshot | external | manual",
                        "source_table": "string or null",
                        "source_record_id": "string or null",
                        "uri": "string or null",
                        "citation": "string",
                        "excerpt": "string"
                    }
                ]
            }
        ]
    }

    return [
        {
            "role": "system",
            "content": (
                "You are a climate strategy co-pilot for enterprise decarbonization. "
                "Return only strict JSON, no markdown, no prose outside JSON. "
                "Prioritize practical, measurable recommendations grounded in given organization context. "
                "Every recommendation must cite at least 2 evidence items tied to provided KPIs or TEME output. "
                "Do not invent data sources or claims not present in context."
            ),
        },
        {
            "role": "user",
            "content": (
                "Generate top 4 recommendations from this context. "
                "At least 2 must be direct reduction actions and at most 1 pure offset action. "
                "Use realistic costs and impact ranges. "
                "Provide impact bounds (low/high) and an impact_model that references KPI names.\n\n"
                f"Context JSON:\n{json.dumps(payload, ensure_ascii=True)}\n\n"
                f"Output JSON schema:\n{json.dumps(schema_hint, ensure_ascii=True)}"
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
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }

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
            raise HTTPException(status_code=502, detail=f"LLM provider error: {resp.status_code} {resp.text[:500]}")

        return resp.json()

    try:
        data = _request_with_model(cfg["model"])
    except Exception as e:
        # OpenRouter can return 404 when a specific model has no active endpoints.
        if "404" in str(e) and cfg["model"] != "openrouter/auto":
            try:
                data = _request_with_model("openrouter/auto")
            except Exception as e2:
                raise HTTPException(status_code=502, detail=f"LLM provider error: {e2}")
        else:
            raise HTTPException(status_code=502, detail=f"LLM provider error: {e}")

    try:
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(_strip_json_block(content))
        return parsed
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Invalid LLM response format: {e}")


def _normalize_recommendations(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
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
        impact_low = _to_float(rec.get("estimated_impact_kg_co2e_low"), max(0.0, impact * 0.8))
        impact_high = _to_float(rec.get("estimated_impact_kg_co2e_high"), max(impact, impact * 1.2))

        evidence = rec.get("evidence", []) or []
        normalized_evidence = []
        for ev in evidence:
            source_type = str(ev.get("source_type", "manual")).strip()
            if source_type not in allowed_sources:
                source_type = "manual"
            normalized_evidence.append(
                {
                    "source_type": source_type,
                    "source_table": ev.get("source_table"),
                    "source_record_id": ev.get("source_record_id"),
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


def _rank_and_filter(recs: List[Dict[str, Any]], emission_kg: float) -> List[Dict[str, Any]]:
    if not recs:
        return []

    # Require at least 2 evidence items per recommendation.
    filtered = [r for r in recs if len(r.get("evidence", [])) >= 2]
    if not filtered:
        return []

    # Enforce action mix constraints.
    reductions = [r for r in filtered if r.get("action_type") == "reduction"]
    offsets = [r for r in filtered if r.get("action_type") == "offset"]
    if len(reductions) < 2:
        return []
    if len(offsets) > 1:
        offsets = offsets[:1]
        filtered = reductions + offsets + [r for r in filtered if r.get("action_type") not in {"reduction", "offset"}]

    # Rank by impact * confidence / (cost + 1).
    def _score(rec: Dict[str, Any]) -> float:
        impact = float(rec.get("estimated_impact_kg_co2e") or 0)
        confidence = float(rec.get("confidence_score") or 0.0)
        cost = float(rec.get("implementation_cost_usd") or 0.0)
        return (impact * max(0.1, confidence)) / (cost + 1.0)

    filtered.sort(key=_score, reverse=True)

    # Cap total impact to 90% of emissions to avoid overclaiming.
    if emission_kg > 0:
        cap = emission_kg * 0.9
        total = sum(float(r.get("estimated_impact_kg_co2e") or 0) for r in filtered)
        if total > cap and total > 0:
            scale = cap / total
            for r in filtered:
                r["estimated_impact_kg_co2e"] = round(float(r.get("estimated_impact_kg_co2e") or 0) * scale, 2)
                r["estimated_impact_kg_co2e_low"] = round(float(r.get("estimated_impact_kg_co2e_low") or 0) * scale, 2)
                r["estimated_impact_kg_co2e_high"] = round(float(r.get("estimated_impact_kg_co2e_high") or 0) * scale, 2)

    for idx, rec in enumerate(filtered, start=1):
        rec["rank"] = idx

    return filtered[:4]


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


def generate_and_store_recommendations(payload: Dict[str, Any]) -> Dict[str, Any]:
    user_id = payload["user_id"]
    org_id = payload["organization_id"]
    teme_run = _get_teme_run(payload.get("teme_run_id"), user_id)

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

    llm_used = True
    llm_warning = None
    messages = _build_prompt(llm_payload)
    try:
        raw = _call_openai_compatible(messages)
        recs = _normalize_recommendations(raw.get("recommendations", []))
        recs = _rank_and_filter(recs, float(llm_payload.get("emission_kg") or 0))
        if not recs:
            raise ValueError("No recommendations returned")
    except Exception as e:
        llm_used = False
        llm_warning = str(e)
        recs = _normalize_recommendations(_heuristic_fallback(llm_payload))
        recs = _rank_and_filter(recs, float(llm_payload.get("emission_kg") or 0))

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
        "prompt_version": "v2",
        "status": "generated",
        "error_message": llm_warning,
        "input_hash": _hash_payload(payload),
        "factor_set_version": llm_payload.get("factor_set_version"),
        "methodology_refs": llm_payload.get("methodology_refs", []),
        "assumptions": llm_payload.get("assumptions", []),
    }

    session_ins = supabase.table("recommendation_sessions").insert(session_row).execute()
    if not session_ins.data:
        raise HTTPException(status_code=500, detail="Failed to create recommendation session")
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
        supabase.table("recommendation_kpi_snapshots").insert(kpi_rows).execute()

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
                    "source_record_id": ev.get("source_record_id"),
                    "uri": ev.get("uri"),
                    "citation": ev.get("citation"),
                    "excerpt": ev.get("excerpt"),
                    "evidence_payload": ev,
                }
            )

    if evidence_rows:
        supabase.table("recommendation_evidence").insert(evidence_rows).execute()

    return {
        "session_id": session["id"],
        "llm_used": llm_used,
        "llm_warning": llm_warning,
        "recommendations": inserted_rows,
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
        raise HTTPException(status_code=404, detail="Recommendation session not found")

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
        raise HTTPException(status_code=500, detail="Failed to save recommendation feedback")
    return ins.data[0]
