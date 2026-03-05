from typing import Dict, List
from datetime import datetime, timedelta
from collections import defaultdict
from ml_services.common.supabase_client import supabase


def _sum_by_category(rows: List[Dict]) -> Dict[str, float]:
    out = defaultdict(float)
    for r in rows:
        for i in (r.get("mapped_items") or []):
            out[i.get("category", "unknown")] += float(i.get("carbon_kg", 0.0))
    return {k: round(v, 4) for k, v in out.items()}


def _sum_by_department(rows: List[Dict]) -> Dict[str, float]:
    out = defaultdict(float)
    for r in rows:
        d = r.get("employee_department") or "unassigned"
        out[d] += float(r.get("carbon_total_kg", 0.0))
    return {k: round(v, 4) for k, v in out.items()}


def generate_org_receipt_report(organization_id: str, start_date: str, end_date: str) -> Dict:
    q = (
        supabase.table("receipts_ocr_results")
        .select("*")
        .eq("organization_id", organization_id)
        .gte("processed_at", start_date)
        .lte("processed_at", end_date)
        .execute()
    )
    receipts = q.data or []

    total_carbon = sum(float(r.get("carbon_total_kg", 0.0)) for r in receipts)
    total_receipts = len(receipts)
    categories = _sum_by_category(receipts)
    dept = _sum_by_department(receipts)

    dept_leaderboard = sorted(
        [{"department": k, "carbon_kg": v} for k, v in dept.items()],
        key=lambda x: x["carbon_kg"]
    )

    all_items = []
    for r in receipts:
        all_items.extend(r.get("mapped_items") or [])
    top_items = sorted(all_items, key=lambda x: x.get("carbon_kg", 0.0), reverse=True)[:20]

    # previous period
    s = datetime.fromisoformat(start_date)
    e = datetime.fromisoformat(end_date)
    delta = e - s
    prev_end = s
    prev_start = s - delta

    prev_q = (
        supabase.table("receipts_ocr_results")
        .select("carbon_total_kg")
        .eq("organization_id", organization_id)
        .gte("processed_at", prev_start.isoformat())
        .lt("processed_at", prev_end.isoformat())
        .execute()
    )
    prev_total = sum(float(r.get("carbon_total_kg", 0.0)) for r in (prev_q.data or []))
    trend_pct = ((total_carbon - prev_total) / max(prev_total, 1.0)) * 100.0

    recommendations = []
    if categories.get("food", 0.0) > 500:
        recommendations.append({
            "type": "policy",
            "title": "High food emissions detected",
            "suggestion": "Consider low-carbon cafeteria rotation",
            "potential_reduction_kg": round(categories["food"] * 0.2, 2),
        })
    if categories.get("transport", 0.0) > 1000:
        recommendations.append({
            "type": "policy",
            "title": "High transport reimbursements",
            "suggestion": "Incentivize public transport reimbursement policy",
            "potential_reduction_kg": round(categories["transport"] * 0.15, 2),
        })

    return {
        "organization_id": organization_id,
        "period": {"start": start_date, "end": end_date},
        "summary": {
            "total_carbon_kg": round(total_carbon, 2),
            "total_receipts": total_receipts,
            "avg_per_receipt_kg": round(total_carbon / max(total_receipts, 1), 3),
            "trend_vs_previous_pct": round(trend_pct, 1),
        },
        "category_breakdown": categories,
        "department_leaderboard": dept_leaderboard,
        "top_carbon_items": top_items,
        "recommendations": recommendations,
    }