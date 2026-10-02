"""
CarbonSense — Plantation Verification FastAPI Router
Route prefix: /plantation
"""

from __future__ import annotations

import hashlib
import io
import json
import math
import os
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field, validator

from ml_services.common.authz import ensure_user_in_org
from ml_services.common.supabase_client import supabase

router = APIRouter(prefix="/plantation", tags=["Plantation"])

# ─────────────────────────────────────────────────────────────────────────────
# Constants (single source of truth; also exposed via GET /plantation/config)
# ─────────────────────────────────────────────────────────────────────────────
FY_START_MONTH: int = int(os.getenv("PLANTATION_FY_START_MONTH", "4"))
MIN_PHOTOS: int = int(os.getenv("PLANTATION_MIN_PHOTOS", "1"))
MAX_PHOTOS: int = int(os.getenv("PLANTATION_MAX_PHOTOS", "6"))
DENSITY_WARN_PER_HA: int = int(os.getenv("PLANTATION_DENSITY_WARN_PER_HA", "3000"))
PHOTO_MAX_DIST_M: int = int(os.getenv("PLANTATION_PHOTO_MAX_DISTANCE_M", "1000"))
OVERLAP_RADIUS_M: int = int(os.getenv("PLANTATION_OVERLAP_RADIUS_M", "100"))
PHOTO_MAX_BYTES: int = 3 * 1024 * 1024       # 3 MB per photo
TOTAL_REQUEST_MAX_BYTES: int = 20 * 1024 * 1024  # 20 MB total
DAILY_REPORT_LIMIT: int = 10                  # submissions per org per day
IMAGERY_REFRESH_COOLDOWN_HOURS: int = 24

# Allowed MIME types
ALLOWED_MIME: frozenset[str] = frozenset(
    ["image/jpeg", "image/png", "image/webp"]
)
# Magic bytes: JPEG, PNG, WebP (RIFF...WEBP)
MAGIC_JPEG = b"\xff\xd8\xff"
MAGIC_PNG = b"\x89PNG\r\n\x1a\n"
MAGIC_RIFF = b"RIFF"
MAGIC_WEBP_SIG = b"WEBP"

INDIA_BBOX = {"lat_min": 6.5, "lat_max": 37.5, "lng_min": 68.0, "lng_max": 97.5}

# CDSE / Sentinel Hub config
CDSE_TOKEN_URL: str = os.getenv(
    "CDSE_TOKEN_URL",
    "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
)
CDSE_SH_BASE_URL: str = os.getenv("CDSE_SH_BASE_URL", "https://sh.dataspace.copernicus.eu")
CDSE_CLIENT_ID: str = os.getenv("CDSE_CLIENT_ID", "")
CDSE_CLIENT_SECRET: str = os.getenv("CDSE_CLIENT_SECRET", "")

# Token cache for CDSE
_cdse_token_cache: dict[str, Any] = {}


# ─────────────────────────────────────────────────────────────────────────────
# Helper: resolve caller's org_id from their profile (server-side, never trust client)
# ─────────────────────────────────────────────────────────────────────────────
def _resolve_org_id(user_id: str) -> str:
    """Fetch organization_id from user_profiles using service role. Returns str UUID."""
    try:
        res = (
            supabase.table("user_profiles")
            .select("organization_id, role")
            .eq("id", user_id)
            .single()
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=403, detail="User profile not found")
        return str(res.data["organization_id"] or "")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Profile lookup failed: {e}")


def _ensure_manager(user_id: str) -> str:
    """Verify caller is a manager. Returns their org_id."""
    try:
        res = (
            supabase.table("user_profiles")
            .select("organization_id, role")
            .eq("id", user_id)
            .single()
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=403, detail="User profile not found")
        role = res.data.get("role", "")
        if role != "manager":
            raise HTTPException(status_code=403, detail="Only managers can perform this action")
        org_id = str(res.data.get("organization_id") or "")
        if not org_id:
            raise HTTPException(status_code=403, detail="User has no organization")
        return org_id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auth check failed: {e}")


def _ensure_admin(user_id: str) -> None:
    """Verify caller is an admin."""
    try:
        res = (
            supabase.table("user_profiles")
            .select("role")
            .eq("id", user_id)
            .single()
            .execute()
        )
        if not res.data or res.data.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only admins can perform this action")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auth check failed: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Helper: Indian Financial Year quarter computation
# ─────────────────────────────────────────────────────────────────────────────
def _fy_quarter(ref_date: date) -> tuple[str, date, date]:
    """
    Returns (period_label, period_start, period_end) for the quarter
    containing ref_date, aligned to the Indian FY (starts April = month 4).

    Examples:
      2026-10-02 → ('FY2026-27-Q2', 2026-07-01, 2026-09-30)
      2026-10-02 (Oct is Q3) → ('FY2026-27-Q3', 2026-10-01, 2026-12-31)
    """
    # Quarter boundaries relative to FY start month (April = month 4)
    # Q1: Apr–Jun, Q2: Jul–Sep, Q3: Oct–Dec, Q4: Jan–Mar
    month = ref_date.month
    year = ref_date.year

    # Determine FY year and quarter index (0-based)
    if month >= FY_START_MONTH:
        fy_start_year = year
    else:
        fy_start_year = year - 1

    # Quarter month offsets from FY start (0=Apr, 3=Jul, 6=Oct, 9=Jan)
    month_in_fy = (month - FY_START_MONTH) % 12  # 0-11
    q_index = month_in_fy // 3  # 0=Q1, 1=Q2, 2=Q3, 3=Q4

    fy_end_year = fy_start_year + 1
    fy_label = f"FY{fy_start_year}-{str(fy_end_year)[-2:]}"
    q_label = f"Q{q_index + 1}"
    period_label = f"{fy_label}-{q_label}"

    # Compute start/end dates
    start_month = (FY_START_MONTH + q_index * 3 - 1) % 12 + 1
    start_year = fy_start_year if start_month >= FY_START_MONTH else fy_end_year
    period_start = date(start_year, start_month, 1)

    end_month = (start_month + 2 - 1) % 12 + 1
    end_year = start_year if end_month >= start_month else start_year + 1
    # Last day of end_month
    if end_month == 12:
        period_end = date(end_year, 12, 31)
    else:
        period_end = date(end_year, end_month + 1, 1) - timedelta(days=1)

    return period_label, period_start, period_end


# ─────────────────────────────────────────────────────────────────────────────
# Helper: Haversine distance in metres
# ─────────────────────────────────────────────────────────────────────────────
def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─────────────────────────────────────────────────────────────────────────────
# Helper: validate photo magic bytes
# ─────────────────────────────────────────────────────────────────────────────
def _valid_image_magic(data: bytes) -> bool:
    if data[:3] == MAGIC_JPEG:
        return True
    if data[:8] == MAGIC_PNG:
        return True
    if data[:4] == MAGIC_RIFF and data[8:12] == MAGIC_WEBP_SIG:
        return True
    return False


# ─────────────────────────────────────────────────────────────────────────────
# Helper: compute sanity flags
# ─────────────────────────────────────────────────────────────────────────────
def _compute_flags(
    report_id: str,
    org_id: str,
    site_lat: float,
    site_lng: float,
    area_ha: float,
    trees_cumulative: int,
    target_trees: Optional[int],
    planting_method: Optional[str],
    photos_meta: list[dict],  # [{gps_lat, gps_lng, taken_at, sha256, distance_from_site_m}]
    existing_sha256s: set[str],
) -> list[dict]:
    flags: list[dict] = []

    # Per-photo flags
    for i, p in enumerate(photos_meta):
        if not p.get("gps_lat") or not p.get("gps_lng"):
            flags.append({
                "report_id": report_id, "org_id": org_id,
                "code": "PHOTO_NO_GPS", "severity": "warn",
                "detail": {"photo_index": i},
                "visible_to_manager": True,
            })
        elif p.get("distance_from_site_m") is not None and p["distance_from_site_m"] > PHOTO_MAX_DIST_M:
            flags.append({
                "report_id": report_id, "org_id": org_id,
                "code": "PHOTO_FAR_FROM_SITE", "severity": "warn",
                "detail": {"photo_index": i, "distance_m": p["distance_from_site_m"]},
                "visible_to_manager": True,
            })

        # Duplicate hash check (across reports globally)
        sha = p.get("sha256", "")
        if sha and sha in existing_sha256s:
            flags.append({
                "report_id": report_id, "org_id": org_id,
                "code": "NO_PHOTOS_REUSED", "severity": "warn",
                "detail": {"photo_index": i, "sha256": sha[:16]},
                "visible_to_manager": True,
            })

    # Density check
    if area_ha > 0:
        density = trees_cumulative / area_ha
        # Miyawaki can legitimately exceed density threshold
        if density > DENSITY_WARN_PER_HA and planting_method != "miyawaki_dense":
            flags.append({
                "report_id": report_id, "org_id": org_id,
                "code": "DENSITY_HIGH", "severity": "warn",
                "detail": {"density_per_ha": round(density, 1), "threshold": DENSITY_WARN_PER_HA},
                "visible_to_manager": True,
            })

    # Exceeds target
    if target_trees and trees_cumulative > target_trees * 1.20:
        flags.append({
            "report_id": report_id, "org_id": org_id,
            "code": "EXCEEDS_TARGET", "severity": "info",
            "detail": {"cumulative": trees_cumulative, "target": target_trees},
            "visible_to_manager": True,
        })

    # Outside India
    if not (
        INDIA_BBOX["lat_min"] <= site_lat <= INDIA_BBOX["lat_max"]
        and INDIA_BBOX["lng_min"] <= site_lng <= INDIA_BBOX["lng_max"]
    ):
        flags.append({
            "report_id": report_id, "org_id": org_id,
            "code": "COORDS_OUTSIDE_INDIA", "severity": "info",
            "detail": {"lat": site_lat, "lng": site_lng},
            "visible_to_manager": True,
        })

    # Overlap check: any other org's site within OVERLAP_RADIUS_M
    # Uses lat/lng bounding box approximation (~1 deg lat ≈ 111 km)
    try:
        deg_offset = OVERLAP_RADIUS_M / 111_000.0
        nearby = (
            supabase.table("plantation_sites")
            .select("id, org_id")
            .neq("org_id", org_id)
            .gte("latitude",  site_lat - deg_offset)
            .lte("latitude",  site_lat + deg_offset)
            .gte("longitude", site_lng - deg_offset)
            .lte("longitude", site_lng + deg_offset)
            .execute()
        )
        if nearby.data:
            flags.append({
                "report_id": report_id, "org_id": org_id,
                "code": "OVERLAPS_OTHER_ORG", "severity": "alert",
                "detail": {"nearby_site_count": len(nearby.data)},
                "visible_to_manager": False,   # admin-only
            })
    except Exception:
        pass  # Non-fatal

    return flags


# ─────────────────────────────────────────────────────────────────────────────
# CDSE / Sentinel Hub imagery helpers
# ─────────────────────────────────────────────────────────────────────────────
def _get_cdse_token() -> Optional[str]:
    """Fetch/cache a CDSE OAuth2 access token."""
    if not CDSE_CLIENT_ID or not CDSE_CLIENT_SECRET:
        return None
    now = time.monotonic()
    cached = _cdse_token_cache.get("token")
    expires_at = _cdse_token_cache.get("expires_at", 0.0)
    if cached and now < expires_at - 30:
        return cached
    try:
        resp = httpx.post(
            CDSE_TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": CDSE_CLIENT_ID,
                "client_secret": CDSE_CLIENT_SECRET,
            },
            timeout=15,
        )
        resp.raise_for_status()
        token_data = resp.json()
        token = token_data["access_token"]
        expires_in = float(token_data.get("expires_in", 3600))
        _cdse_token_cache["token"] = token
        _cdse_token_cache["expires_at"] = now + expires_in
        return token
    except Exception as e:
        print(f"[CDSE] Token fetch failed: {e}")
        return None


def _bbox_from_site(lat: float, lng: float, area_ha: float) -> dict:
    """Compute a square bbox centred on site."""
    half_side_m = max(400.0, math.sqrt(area_ha * 10_000) / 2 + 250)
    deg_lat = half_side_m / 111_000.0
    deg_lng = half_side_m / (111_000.0 * math.cos(math.radians(lat)))
    return {
        "min_lat": lat - deg_lat, "max_lat": lat + deg_lat,
        "min_lng": lng - deg_lng, "max_lng": lng + deg_lng,
    }


def _run_imagery_job(
    report_id: str,
    site_id: str,
    org_id: str,
    lat: float,
    lng: float,
    area_ha: float,
    submit_date: date,
) -> None:
    """
    Background task: fetch Sentinel-2 thumbnail + NDVI series from CDSE.
    Never blocks the HTTP response. Fails soft.
    """
    token = _get_cdse_token()
    if not token:
        _upsert_snapshot(report_id, site_id, org_id, "skipped", error="No CDSE credentials configured")
        return

    if area_ha < 1.0:
        _upsert_snapshot(report_id, site_id, org_id, "skipped",
                         error="Site < 1 ha: satellite stats unreliable at 10 m resolution")
        return

    bbox = _bbox_from_site(lat, lng, area_ha)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # ── True-colour thumbnail ──
    image_path: Optional[str] = None
    scene_date: Optional[str] = None
    cloud_pct: Optional[float] = None

    for days_back in [30, 90]:
        time_from = (submit_date - timedelta(days=days_back)).isoformat()
        time_to = submit_date.isoformat()
        process_payload = {
            "input": {
                "bounds": {
                    "bbox": [bbox["min_lng"], bbox["min_lat"], bbox["max_lng"], bbox["max_lat"]],
                    "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
                },
                "data": [{
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "timeRange": {"from": f"{time_from}T00:00:00Z", "to": f"{time_to}T23:59:59Z"},
                        "maxCloudCoverage": 30,
                        "mosaickingOrder": "leastCC",
                    },
                }],
            },
            "output": {"width": 512, "height": 512, "responses": [{"identifier": "default", "format": {"type": "image/png"}}]},
            "evalscript": (
                "//VERSION=3\n"
                "function setup() { return { input: ['B04','B03','B02'], output: { bands: 3 } }; }\n"
                "function evaluatePixel(s) { return [3.5*s.B04, 3.5*s.B03, 3.5*s.B02]; }"
            ),
        }
        try:
            resp = httpx.post(
                f"{CDSE_SH_BASE_URL}/api/v1/process",
                headers=headers, json=process_payload, timeout=60,
            )
            if resp.status_code == 429:
                _upsert_snapshot(report_id, site_id, org_id, "failed", error="CDSE rate limit exceeded")
                return
            if resp.status_code == 402:
                _upsert_snapshot(report_id, site_id, org_id, "failed", error="CDSE quota exhausted")
                return
            if resp.status_code == 200 and resp.content:
                # Upload PNG to storage
                path = f"{org_id}/{site_id}/{report_id}.png"
                try:
                    supabase.storage.from_("plantation-imagery").upload(
                        path, resp.content, {"content-type": "image/png", "upsert": "true"}
                    )
                    image_path = path
                    # Try to get scene date from response header
                    scene_date = resp.headers.get("X-ProcessingDate", "")[:10] or None
                    cloud_pct = None
                    break
                except Exception as e:
                    print(f"[Imagery] Storage upload failed: {e}")
                    break
        except Exception as e:
            print(f"[Imagery] Process API failed ({days_back}d): {e}")
            continue

    # ── NDVI series (12-month, monthly buckets) ──
    ndvi_series: Optional[list] = None
    if token:
        stats_payload = {
            "input": {
                "bounds": {
                    "bbox": [bbox["min_lng"], bbox["min_lat"], bbox["max_lng"], bbox["max_lat"]],
                    "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
                },
                "data": [{"type": "sentinel-2-l2a", "dataFilter": {"maxCloudCoverage": 30}}],
            },
            "aggregation": {
                "timeRange": {
                    "from": (submit_date - timedelta(days=365)).isoformat() + "T00:00:00Z",
                    "to": submit_date.isoformat() + "T23:59:59Z",
                },
                "aggregationInterval": {"of": "P30D"},
            },
            "calculations": {
                "ndvi": {
                    "histogramBins": None,
                    "statistics": {"default": {"percentiles": {"k": [25, 50, 75]}}},
                },
            },
            "evalscript": (
                "//VERSION=3\n"
                "function setup() { return { input: [{bands:['B04','B08','SCL'],units:'DN'}], output: [{id:'ndvi',bands:1}], mosaicking:'ORBIT' }; }\n"
                "function evaluatePixel(s) {\n"
                "  var scl = s.SCL;\n"
                "  if (scl==3||scl==7||scl==8||scl==9||scl==10||scl==11) return [NaN];\n"
                "  var ndvi=(s.B08-s.B04)/(s.B08+s.B04);\n"
                "  return [ndvi];\n"
                "}\n"
            ),
        }
        try:
            resp_s = httpx.post(
                f"{CDSE_SH_BASE_URL}/api/v1/statistics",
                headers=headers, json=stats_payload, timeout=60,
            )
            if resp_s.status_code == 200:
                s_data = resp_s.json()
                intervals = s_data.get("data", [])
                ndvi_series = [
                    {
                        "from": iv.get("interval", {}).get("from", "")[:10],
                        "to": iv.get("interval", {}).get("to", "")[:10],
                        "mean": iv.get("outputs", {}).get("ndvi", {}).get("bands", {}).get("B0", {}).get("stats", {}).get("mean"),
                        "sample_count": iv.get("outputs", {}).get("ndvi", {}).get("bands", {}).get("B0", {}).get("stats", {}).get("sampleCount"),
                    }
                    for iv in intervals
                ]
        except Exception as e:
            print(f"[Imagery] Statistics API failed: {e}")

    status = "ready" if image_path else ("failed" if not ndvi_series else "skipped")
    _upsert_snapshot(
        report_id, site_id, org_id,
        status=status,
        image_path=image_path,
        scene_date=scene_date,
        cloud_pct=cloud_pct,
        ndvi_series=ndvi_series,
    )


def _upsert_snapshot(
    report_id: str, site_id: str, org_id: str, status: str,
    image_path: Optional[str] = None,
    scene_date: Optional[str] = None,
    cloud_pct: Optional[float] = None,
    ndvi_series: Optional[list] = None,
    error: Optional[str] = None,
) -> None:
    try:
        supabase.table("plantation_imagery_snapshots").insert({
            "report_id": report_id,
            "site_id": site_id,
            "org_id": org_id,
            "provider": "cdse_sentinel2",
            "scene_date": scene_date,
            "cloud_pct": cloud_pct,
            "image_path": image_path,
            "ndvi_series": ndvi_series,
            "status": status,
            "error_message": error,
        }).execute()
        # Update imagery_status on the report
        supabase.table("plantation_reports").update(
            {"imagery_status": status}
        ).eq("id", report_id).execute()
    except Exception as e:
        print(f"[Imagery] Snapshot upsert failed: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# Pydantic models
# ═══════════════════════════════════════════════════════════════════════════════

class SpeciesEntry(BaseModel):
    name: str
    count: Optional[int] = None


class CreateSitePayload(BaseModel):
    user_id: str
    name: str = Field(..., min_length=2, max_length=120)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    area_hectares: float = Field(..., gt=0, le=50_000)
    target_trees: Optional[int] = Field(None, ge=0)
    region_label: Optional[str] = None
    teme_run_id: Optional[str] = None
    recommendation_id: Optional[str] = None
    boundary_geojson: Optional[dict] = None


class PhotoMeta(BaseModel):
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
    gps_source: Optional[str] = None  # 'exif' | 'device' | 'none'
    taken_at: Optional[str] = None    # ISO8601 string
    caption: Optional[str] = Field(None, max_length=140)


class ReportPayload(BaseModel):
    user_id: str
    site_id: str
    is_interim: bool = False
    planting_start_date: str   # ISO date
    planting_end_date: str     # ISO date
    trees_planted_this_period: int = Field(..., ge=0)
    trees_planted_cumulative: int = Field(..., ge=0)
    species: List[SpeciesEntry] = Field(..., min_items=1)
    survival_rate_pct: Optional[float] = Field(None, ge=0, le=100)
    planting_method: Optional[str] = None
    implementing_partner: Optional[str] = Field(None, max_length=120)
    maintenance_activities: Optional[List[str]] = None
    notes: Optional[str] = Field(None, max_length=1000)
    declaration_accepted: bool

    @validator("planting_method")
    def validate_method(cls, v):
        allowed = {"nursery_saplings", "direct_seeding", "miyawaki_dense", "other", None}
        if v not in allowed:
            raise ValueError(f"planting_method must be one of {allowed}")
        return v

    @validator("declaration_accepted")
    def must_be_accepted(cls, v):
        if not v:
            raise ValueError("declaration_accepted must be true")
        return v

    @validator("trees_planted_cumulative")
    def cumulative_gte_period(cls, v, values):
        period = values.get("trees_planted_this_period", 0)
        if v < period:
            raise ValueError("trees_planted_cumulative must be >= trees_planted_this_period")
        return v


# ═══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/config")
def get_config():
    """Returns client-side constants so UI and server never drift."""
    return {
        "min_photos": MIN_PHOTOS,
        "max_photos": MAX_PHOTOS,
        "fy_start_month": FY_START_MONTH,
        "density_warn_per_ha": DENSITY_WARN_PER_HA,
        "photo_max_distance_m": PHOTO_MAX_DIST_M,
        "overlap_radius_m": OVERLAP_RADIUS_M,
        "india_bbox": INDIA_BBOX,
        "photo_max_bytes": PHOTO_MAX_BYTES,
        "daily_report_limit": DAILY_REPORT_LIMIT,
        "allowed_mime_types": list(ALLOWED_MIME),
    }


@router.post("/sites")
def create_site(payload: CreateSitePayload):
    """Manager creates a new plantation site (optionally prefilled from a TEME run)."""
    org_id = _ensure_manager(payload.user_id)

    # If teme_run_id provided, verify it belongs to the caller's org (best-effort)
    if payload.teme_run_id:
        try:
            run_res = (
                supabase.table("teme_runs")
                .select("id, organization_id, total_trees, land_required_hectare")
                .eq("id", payload.teme_run_id)
                .maybeSingle()
                .execute()
            )
            if run_res.data and str(run_res.data.get("organization_id", "")) != org_id:
                raise HTTPException(status_code=404, detail="TEME run not found")
        except HTTPException:
            raise
        except Exception:
            pass  # Non-fatal if teme_runs not accessible

    try:
        res = (
            supabase.table("plantation_sites")
            .insert({
                "org_id": org_id,
                "teme_run_id": payload.teme_run_id,
                "recommendation_id": payload.recommendation_id,
                "name": payload.name,
                "latitude": payload.latitude,
                "longitude": payload.longitude,
                "area_hectares": float(payload.area_hectares),
                "target_trees": payload.target_trees,
                "region_label": payload.region_label,
                "boundary_geojson": payload.boundary_geojson,
                "created_by": payload.user_id,
            })
            .select("*")
            .single()
            .execute()
        )
        return {"site": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create site: {e}")


@router.post("/reports")
async def submit_report(
    background_tasks: BackgroundTasks,
    # Form fields
    payload: str = Form(..., description="JSON string of ReportPayload"),
    photo_meta: str = Form(..., description="JSON array of PhotoMeta aligned to photos"),
    # File uploads
    photos: List[UploadFile] = File(...),
):
    """
    Manager submits a plantation report with photo proof.
    multipart/form-data: payload (JSON), photo_meta (JSON array), photos[].
    """
    # ── 1. Parse payload ──
    try:
        report_data = ReportPayload.parse_raw(payload)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid payload: {e}")

    try:
        meta_list: list[PhotoMeta] = [PhotoMeta(**m) for m in json.loads(photo_meta)]
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid photo_meta: {e}")

    # ── 2. Auth: manager only, org_id from server ──
    org_id = _ensure_manager(report_data.user_id)

    # ── 3. Load & validate site ──
    try:
        site_res = (
            supabase.table("plantation_sites")
            .select("*")
            .eq("id", report_data.site_id)
            .maybeSingle()
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Site lookup failed: {e}")

    if not site_res.data:
        raise HTTPException(status_code=404, detail="Site not found")  # 404, not 403

    site = site_res.data
    if str(site["org_id"]) != org_id:
        raise HTTPException(status_code=404, detail="Site not found")

    # ── 4. Validate payload ──
    try:
        p_start = date.fromisoformat(report_data.planting_start_date)
        p_end = date.fromisoformat(report_data.planting_end_date)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid planting date format (use YYYY-MM-DD)")

    if p_end < p_start:
        raise HTTPException(status_code=422, detail="planting_end_date must be >= planting_start_date")
    if p_end > date.today():
        raise HTTPException(status_code=422, detail="planting_end_date cannot be in the future")

    # Compute period server-side
    period_label, period_start, period_end = _fy_quarter(date.today())

    # Snapshot site coordinates (immutable record)
    snap_lat = float(site["latitude"])
    snap_lng = float(site["longitude"])
    snap_area = float(site["area_hectares"])

    # ── 5. Validate photos ──
    if len(photos) < MIN_PHOTOS:
        raise HTTPException(status_code=422, detail=f"At least {MIN_PHOTOS} photo(s) required")
    if len(photos) > MAX_PHOTOS:
        raise HTTPException(status_code=422, detail=f"Maximum {MAX_PHOTOS} photos allowed")
    if len(meta_list) != len(photos):
        raise HTTPException(status_code=422, detail="photo_meta count must match photos count")

    photo_bytes_list: list[bytes] = []
    total_size = 0
    for i, photo in enumerate(photos):
        data = await photo.read()
        total_size += len(data)
        if len(data) > PHOTO_MAX_BYTES:
            raise HTTPException(status_code=413, detail=f"Photo {i+1} exceeds {PHOTO_MAX_BYTES // 1024 // 1024} MB limit")
        if total_size > TOTAL_REQUEST_MAX_BYTES:
            raise HTTPException(status_code=413, detail="Total upload size exceeds 20 MB limit")
        # MIME check
        mime = photo.content_type or ""
        if mime not in ALLOWED_MIME:
            raise HTTPException(status_code=415, detail=f"Photo {i+1}: unsupported type '{mime}'")
        # Magic byte check
        if not _valid_image_magic(data):
            raise HTTPException(status_code=415, detail=f"Photo {i+1}: file header does not match a supported image format")
        # Pillow validation
        try:
            img = Image.open(io.BytesIO(data))
            img.verify()
        except (UnidentifiedImageError, Exception):
            raise HTTPException(status_code=415, detail=f"Photo {i+1}: not a valid image")
        photo_bytes_list.append(data)

    # ── 6. Rate limit: max DAILY_REPORT_LIMIT submissions per org per day ──
    try:
        today_start = datetime.now(tz=timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        count_res = (
            supabase.table("plantation_reports")
            .select("id", count="exact")
            .eq("org_id", org_id)
            .gte("submitted_at", today_start)
            .execute()
        )
        count = count_res.count or 0
        if count >= DAILY_REPORT_LIMIT:
            raise HTTPException(status_code=429, detail=f"Daily report limit ({DAILY_REPORT_LIMIT}) reached. Try again tomorrow.")
    except HTTPException:
        raise
    except Exception:
        pass  # Non-fatal rate limit check

    # ── 7. Insert report ──
    report_id = str(uuid.uuid4())
    try:
        supabase.table("plantation_reports").insert({
            "id": report_id,
            "org_id": org_id,
            "site_id": report_data.site_id,
            "submitted_by": report_data.user_id,
            "period_label": period_label,
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "is_interim": report_data.is_interim,
            "latitude": snap_lat,
            "longitude": snap_lng,
            "area_hectares": snap_area,
            "planting_start_date": report_data.planting_start_date,
            "planting_end_date": report_data.planting_end_date,
            "trees_planted_this_period": report_data.trees_planted_this_period,
            "trees_planted_cumulative": report_data.trees_planted_cumulative,
            "species": [s.dict() for s in report_data.species],
            "survival_rate_pct": report_data.survival_rate_pct,
            "planting_method": report_data.planting_method,
            "implementing_partner": report_data.implementing_partner,
            "maintenance_activities": report_data.maintenance_activities or [],
            "notes": report_data.notes,
            "declaration_accepted": True,
            "review_status": "pending",
            "imagery_status": "pending",
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to insert report: {e}")

    # ── 8. Upload photos + insert photo rows ──
    uploaded_paths: list[str] = []
    photo_rows: list[dict] = []

    # Fetch existing sha256s for duplicate detection
    try:
        sha_res = supabase.table("plantation_report_photos").select("sha256").execute()
        existing_sha256s = {r["sha256"] for r in (sha_res.data or [])}
    except Exception:
        existing_sha256s = set()

    photos_meta_computed: list[dict] = []

    try:
        for i, (data, meta) in enumerate(zip(photo_bytes_list, meta_list)):
            sha = hashlib.sha256(data).hexdigest()
            file_uuid = str(uuid.uuid4())
            ext = "jpg"  # always store as jpg path (content-type preserved)
            storage_path = f"{org_id}/{report_data.site_id}/{report_id}/{file_uuid}.{ext}"

            # Upload to storage
            supabase.storage.from_("plantation-proofs").upload(
                storage_path, data,
                {"content-type": photo_bytes_list and photos[i].content_type or "image/jpeg", "upsert": "false"}
            )
            uploaded_paths.append(storage_path)

            # Compute distance from site
            dist_m: Optional[int] = None
            if meta.gps_lat is not None and meta.gps_lng is not None:
                dist_m = int(_haversine_m(snap_lat, snap_lng, meta.gps_lat, meta.gps_lng))

            photo_rows.append({
                "report_id": report_id,
                "org_id": org_id,
                "storage_path": storage_path,
                "sha256": sha,
                "caption": meta.caption,
                "gps_lat": meta.gps_lat,
                "gps_lng": meta.gps_lng,
                "gps_source": meta.gps_source or "none",
                "taken_at": meta.taken_at,
                "distance_from_site_m": dist_m,
            })
            photos_meta_computed.append({
                "gps_lat": meta.gps_lat,
                "gps_lng": meta.gps_lng,
                "sha256": sha,
                "taken_at": meta.taken_at,
                "distance_from_site_m": dist_m,
            })

        # Bulk insert photo rows
        supabase.table("plantation_report_photos").insert(photo_rows).execute()

    except Exception as e:
        # Compensating cleanup: remove uploaded files
        for path in uploaded_paths:
            try:
                supabase.storage.from_("plantation-proofs").remove([path])
            except Exception:
                pass
        # Also delete the report row
        try:
            supabase.table("plantation_reports").delete().eq("id", report_id).execute()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Photo upload failed: {e}")

    # ── 9. Compute and insert flags ──
    flags = _compute_flags(
        report_id=report_id,
        org_id=org_id,
        site_lat=snap_lat,
        site_lng=snap_lng,
        area_ha=snap_area,
        trees_cumulative=report_data.trees_planted_cumulative,
        target_trees=site.get("target_trees"),
        planting_method=report_data.planting_method,
        photos_meta=photos_meta_computed,
        existing_sha256s=existing_sha256s,
    )
    if flags:
        try:
            supabase.table("plantation_report_flags").insert(flags).execute()
        except Exception as e:
            print(f"[Plantation] Flag insert failed (non-fatal): {e}")

    # ── 10. Schedule imagery background job (never blocks response) ──
    background_tasks.add_task(
        _run_imagery_job,
        report_id=report_id,
        site_id=report_data.site_id,
        org_id=org_id,
        lat=snap_lat,
        lng=snap_lng,
        area_ha=snap_area,
        submit_date=date.today(),
    )

    # ── 11. Return (only flags visible to manager) ──
    manager_flags = [f for f in flags if f.get("visible_to_manager", True)]
    return {
        "report_id": report_id,
        "submitted_at": datetime.now(tz=timezone.utc).isoformat(),
        "period_label": period_label,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "flags_visible_to_manager": [
            {"code": f["code"], "severity": f["severity"], "detail": f["detail"]}
            for f in manager_flags
        ],
    }


@router.post("/reports/{report_id}/refresh-imagery")
def refresh_imagery(report_id: str, user_id: str = Form(...), background_tasks: BackgroundTasks = None):
    """Admin triggers a re-run of the imagery job (once per 24 h per report)."""
    _ensure_admin(user_id)

    # Load report
    try:
        rep_res = (
            supabase.table("plantation_reports")
            .select("site_id, org_id, latitude, longitude, area_hectares, submitted_at")
            .eq("id", report_id)
            .maybeSingle()
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report lookup failed: {e}")

    if not rep_res.data:
        raise HTTPException(status_code=404, detail="Report not found")

    rep = rep_res.data

    # Check 24h cooldown
    try:
        snap_res = (
            supabase.table("plantation_imagery_snapshots")
            .select("fetched_at")
            .eq("report_id", report_id)
            .order("fetched_at", desc=True)
            .limit(1)
            .execute()
        )
        if snap_res.data:
            last_fetch = datetime.fromisoformat(snap_res.data[0]["fetched_at"].replace("Z", "+00:00"))
            elapsed_hours = (datetime.now(tz=timezone.utc) - last_fetch).total_seconds() / 3600
            if elapsed_hours < IMAGERY_REFRESH_COOLDOWN_HOURS:
                raise HTTPException(
                    status_code=429,
                    detail=f"Imagery was last refreshed {elapsed_hours:.1f}h ago. Please wait {IMAGERY_REFRESH_COOLDOWN_HOURS - elapsed_hours:.1f}h."
                )
    except HTTPException:
        raise
    except Exception:
        pass

    submit_date = date.fromisoformat(rep["submitted_at"][:10])
    if background_tasks:
        background_tasks.add_task(
            _run_imagery_job,
            report_id=report_id,
            site_id=rep["site_id"],
            org_id=rep["org_id"],
            lat=float(rep["latitude"]),
            lng=float(rep["longitude"]),
            area_ha=float(rep["area_hectares"]),
            submit_date=submit_date,
        )
    return {"queued": True, "report_id": report_id}
