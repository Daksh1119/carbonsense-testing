from datetime import date
import os
import tempfile
from typing import Any, Dict, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from ml_services.common.authz import ensure_permission, ensure_user_in_org
from ml_services.policy_compliance.service import (
    benchmark,
    get_evidence_history,
    get_requirement,
    get_result_steps,
    get_current_score,
    list_requirements,
    list_results,
    recalculate_score,
    rupee_impact_summary,
    score_history,
    top_actions,
    upcoming_deadlines,
    verify_result,
)


router = APIRouter(prefix="/compliance", tags=["Compliance"])


class VerifyResultInput(BaseModel):
    organization_id: str
    user_id: str
    status: Optional[str] = None
    verified: Optional[bool] = None
    verification_source: Optional[str] = None
    evidence_url: Optional[str] = None
    data_snapshot: Dict[str, Any] = Field(default_factory=dict)
    notes: Optional[str] = None


class RecalculateScoreInput(BaseModel):
    organization_id: str
    user_id: str
    snapshot_date: Optional[date] = None


@router.get("/requirements")
def get_requirements(level: Optional[str] = None, industry: Optional[str] = None):
    try:
        data = list_requirements(level=level, industry=industry)
        return {"requirements": data, "count": len(data)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch requirements: {e}")


@router.get("/requirements/{requirement_id}")
def get_requirement_detail(requirement_id: str):
    try:
        return get_requirement(requirement_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch requirement: {e}")


@router.get("/results")
def get_results(organization_id: str, user_id: str, level: Optional[str] = None, status: Optional[str] = None):
    try:
        ensure_user_in_org(user_id, organization_id)
        ensure_permission(user_id, organization_id, "compliance.read")

        data = list_results(organization_id=organization_id,
                            level=level, status=status)
        return {"results": data, "count": len(data)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch compliance results: {e}")


@router.get("/results/{result_id}/steps")
def get_result_steps_route(result_id: str, organization_id: str, user_id: str):
    try:
        ensure_user_in_org(user_id, organization_id)
        ensure_permission(user_id, organization_id, "compliance.read")

        steps = get_result_steps(
            organization_id=organization_id, result_id=result_id)
        return {"steps": steps, "count": len(steps)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch result steps: {e}")


@router.get("/results/{result_id}/evidence-history")
def get_result_evidence_history_route(result_id: str, organization_id: str, user_id: str):
    try:
        ensure_user_in_org(user_id, organization_id)
        ensure_permission(user_id, organization_id, "compliance.read")

        history = get_evidence_history(
            organization_id=organization_id, result_id=result_id)
        return {"history": history, "count": len(history)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch evidence history: {e}")


@router.post("/results/{result_id}/verify")
def verify_result_route(result_id: str, payload: VerifyResultInput):
    try:
        ensure_user_in_org(payload.user_id, payload.organization_id)
        ensure_permission(
            payload.user_id, payload.organization_id, "compliance.verify")

        row = verify_result(
            organization_id=payload.organization_id,
            result_id=result_id,
            status=payload.status,
            verified=payload.verified,
            verification_source=payload.verification_source,
            evidence_url=payload.evidence_url,
            data_snapshot=payload.data_snapshot,
            notes=payload.notes,
        )
        return {"result": row}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to verify compliance result: {e}")


@router.post("/score")
def recalculate_score_route(payload: RecalculateScoreInput):
    try:
        ensure_user_in_org(payload.user_id, payload.organization_id)
        ensure_permission(
            payload.user_id, payload.organization_id, "compliance.score")

        rec = recalculate_score(payload.organization_id,
                                snapshot_date=payload.snapshot_date)
        return {"score": rec}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to recalculate score: {e}")


@router.get("/score")
def get_score(organization_id: str, user_id: str):
    try:
        ensure_user_in_org(user_id, organization_id)
        ensure_permission(user_id, organization_id, "compliance.read")

        score = get_current_score(organization_id)
        return {"score": score}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch compliance score: {e}")


@router.get("/score/history")
def get_score_history(organization_id: str, user_id: str, days: int = 365):
    try:
        ensure_user_in_org(user_id, organization_id)
        ensure_permission(user_id, organization_id, "compliance.read")

        data = score_history(organization_id, days=days)
        return {"history": data, "count": len(data)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch score history: {e}")


@router.get("/deadlines")
def get_deadlines(organization_id: str, user_id: str, days: int = 90):
    try:
        ensure_user_in_org(user_id, organization_id)
        ensure_permission(user_id, organization_id, "compliance.read")

        data = upcoming_deadlines(organization_id, within_days=days)
        return {"deadlines": data, "count": len(data)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch deadlines: {e}")


@router.get("/top-actions")
def get_top_actions(organization_id: str, user_id: str, industry: Optional[str] = None, top_n: int = 3):
    try:
        ensure_user_in_org(user_id, organization_id)
        ensure_permission(user_id, organization_id, "compliance.read")

        data = top_actions(organization_id=organization_id,
                           industry=industry, top_n=top_n)
        return {"actions": data, "count": len(data)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch top actions: {e}")


@router.get("/benchmark")
def get_benchmark(organization_id: str, user_id: str, industry: str = "sme"):
    try:
        ensure_user_in_org(user_id, organization_id)
        ensure_permission(user_id, organization_id, "compliance.read")

        return benchmark(organization_id=organization_id, industry=industry)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch benchmark: {e}")


@router.get("/impact")
def get_impact_summary(organization_id: str, user_id: str):
    try:
        ensure_user_in_org(user_id, organization_id)
        ensure_permission(user_id, organization_id, "compliance.read")

        return rupee_impact_summary(organization_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch impact summary: {e}")


@router.post("/evidence")
async def upload_evidence(
    organization_id: str = Form(...),
    user_id: str = Form(...),
    requirement_id: str = Form(...),
    file: UploadFile = File(...),
):
    try:
        ensure_user_in_org(user_id, organization_id)
        ensure_permission(user_id, organization_id, "compliance.verify")

        blob = await file.read()
        suffix = os.path.splitext(file.filename or "")[1] or ".pdf"

        tmp_path: Optional[str] = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(blob)
                tmp_path = tmp.name

            extraction = None

            # Automatically mark the compliance result as verified in Supabase
            try:
                verify_result(
                    result_id=requirement_id,
                    organization_id=organization_id,
                    user_id=user_id,
                    status="verified",
                    verified=True,
                    verification_source="evidence_upload",
                    evidence_url=file.filename,
                    notes=f"Evidence uploaded: {file.filename}",
                )
            except Exception as verify_err:
                print(f"[Evidence Upload] Result verify warning: {verify_err}")

            return {
                "organization_id": organization_id,
                "requirement_id": requirement_id,
                "file_name": file.filename,
                "content_type": file.content_type,
                "size_bytes": len(blob),
                "ocr_extraction": extraction,
            }
        finally:
            try:
                if tmp_path and os.path.exists(tmp_path):
                    os.remove(tmp_path)
            except Exception:
                pass
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to process evidence: {e}")
