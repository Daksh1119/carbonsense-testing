/**
 * CarbonSense — Plantation Verification API helpers (client-side reads + form submission)
 *
 * Reads: go straight through Supabase + RLS (no FastAPI).
 * Writes: go through Next.js API routes → FastAPI.
 */

import { supabase } from '@/lib/supabaseClient';
import { getCurrentUserContext } from '@/lib/recommendations-api';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PlantationSite {
  id: string;
  org_id: string;
  teme_run_id: string | null;
  recommendation_id: string | null;
  name: string;
  latitude: number;
  longitude: number;
  area_hectares: number;
  boundary_geojson: object | null;
  target_trees: number | null;
  region_label: string | null;
  status: 'active' | 'completed' | 'archived';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SpeciesEntry {
  name: string;
  count?: number | null;
}

export interface PlantationReport {
  id: string;
  org_id: string;
  site_id: string;
  submitted_by: string;
  submitted_at: string;
  period_label: string;
  period_start: string;
  period_end: string;
  is_interim: boolean;
  latitude: number;
  longitude: number;
  area_hectares: number;
  planting_start_date: string;
  planting_end_date: string;
  trees_planted_this_period: number;
  trees_planted_cumulative: number;
  species: SpeciesEntry[];
  survival_rate_pct: number | null;
  planting_method: string | null;
  implementing_partner: string | null;
  maintenance_activities: string[] | null;
  notes: string | null;
  declaration_accepted: boolean;
  review_status: 'pending' | 'reviewed' | 'needs_attention';
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_note: string | null;
  imagery_status: 'pending' | 'ready' | 'failed' | 'skipped';
}

export interface PlantationReportPhoto {
  id: string;
  report_id: string;
  org_id: string;
  storage_path: string;
  sha256: string;
  caption: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_source: 'exif' | 'device' | 'none' | null;
  taken_at: string | null;
  distance_from_site_m: number | null;
  created_at: string;
}

export interface PlantationFlag {
  id: string;
  report_id: string;
  code: string;
  severity: 'info' | 'warn' | 'alert';
  detail: Record<string, unknown>;
  visible_to_manager: boolean;
}

export interface PlantationImagerySnapshot {
  id: string;
  report_id: string;
  site_id: string;
  provider: string;
  scene_date: string | null;
  cloud_pct: number | null;
  image_path: string | null;
  ndvi_series: Array<{ from: string; to: string; mean: number | null; sample_count: number | null }> | null;
  status: 'ready' | 'failed' | 'skipped';
  error_message: string | null;
  fetched_at: string;
}

export interface PhotoMeta {
  gps_lat?: number | null;
  gps_lng?: number | null;
  gps_source?: 'exif' | 'device' | 'none';
  taken_at?: string | null;
  caption?: string | null;
}

export interface SubmitReportPayload {
  site_id: string;
  is_interim?: boolean;
  planting_start_date: string;
  planting_end_date: string;
  trees_planted_this_period: number;
  trees_planted_cumulative: number;
  species: SpeciesEntry[];
  survival_rate_pct?: number | null;
  planting_method?: string | null;
  implementing_partner?: string | null;
  maintenance_activities?: string[];
  notes?: string | null;
  declaration_accepted: true;
}

export interface PlantationConfig {
  min_photos: number;
  max_photos: number;
  fy_start_month: number;
  density_warn_per_ha: number;
  photo_max_distance_m: number;
  overlap_radius_m: number;
  india_bbox: { lat_min: number; lat_max: number; lng_min: number; lng_max: number };
  photo_max_bytes: number;
  daily_report_limit: number;
  allowed_mime_types: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Quarter / period helpers (mirrors server logic)
// ─────────────────────────────────────────────────────────────────────────────

const FY_START_MONTH = 4; // April — must match server

export function fyQuarter(refDate = new Date()): {
  label: string;
  start: Date;
  end: Date;
} {
  const month = refDate.getMonth() + 1; // 1-indexed
  const year = refDate.getFullYear();
  const fyStartYear = month >= FY_START_MONTH ? year : year - 1;
  const fyEndYear = fyStartYear + 1;

  const monthInFY = (month - FY_START_MONTH + 12) % 12; // 0-11
  const qIndex = Math.floor(monthInFY / 3); // 0-3

  const fyLabel = `FY${fyStartYear}-${String(fyEndYear).slice(-2)}`;
  const label = `${fyLabel}-Q${qIndex + 1}`;

  const startMonth = ((FY_START_MONTH + qIndex * 3 - 1) % 12) + 1;
  const startYear = startMonth >= FY_START_MONTH ? fyStartYear : fyEndYear;
  const start = new Date(startYear, startMonth - 1, 1);

  const endMonth = ((startMonth + 1) % 12) + 1;
  const endYear = endMonth < startMonth ? startYear + 1 : startYear;
  const end = new Date(endYear, startMonth + 1, 0); // last day of 3rd month

  return { label, start, end };
}

export function reportDueDate(periodEnd: Date): Date {
  const due = new Date(periodEnd);
  due.setDate(due.getDate() + 15);
  return due;
}

export function formatIST(isoString: string): string {
  return new Date(isoString).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase reads (RLS-enforced)
// ─────────────────────────────────────────────────────────────────────────────

export async function listSites(): Promise<PlantationSite[]> {
  const { data, error } = await supabase
    .from('plantation_sites')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load sites: ${error.message}`);
  return (data ?? []) as PlantationSite[];
}

export async function getSite(siteId: string): Promise<PlantationSite | null> {
  const { data, error } = await supabase
    .from('plantation_sites')
    .select('*')
    .eq('id', siteId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load site: ${error.message}`);
  return (data as PlantationSite) ?? null;
}

export async function listReports(siteId?: string): Promise<PlantationReport[]> {
  let query = supabase
    .from('plantation_reports')
    .select('*')
    .order('submitted_at', { ascending: false });
  if (siteId) query = query.eq('site_id', siteId);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load reports: ${error.message}`);
  return (data ?? []) as PlantationReport[];
}

export async function getReport(reportId: string): Promise<PlantationReport | null> {
  const { data, error } = await supabase
    .from('plantation_reports')
    .select('*')
    .eq('id', reportId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load report: ${error.message}`);
  return (data as PlantationReport) ?? null;
}

export async function getReportPhotos(reportId: string): Promise<PlantationReportPhoto[]> {
  const { data, error } = await supabase
    .from('plantation_report_photos')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at');
  if (error) throw new Error(`Failed to load photos: ${error.message}`);
  return (data ?? []) as PlantationReportPhoto[];
}

export async function getReportFlags(reportId: string): Promise<PlantationFlag[]> {
  const { data, error } = await supabase
    .from('plantation_report_flags')
    .select('*')
    .eq('report_id', reportId)
    .order('severity');
  if (error) throw new Error(`Failed to load flags: ${error.message}`);
  return (data ?? []) as PlantationFlag[];
}

export async function getImagerySnapshot(reportId: string): Promise<PlantationImagerySnapshot | null> {
  const { data, error } = await supabase
    .from('plantation_imagery_snapshots')
    .select('*')
    .eq('report_id', reportId)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load imagery: ${error.message}`);
  return (data as PlantationImagerySnapshot) ?? null;
}

/** Get a signed URL for a plantation photo (10 min expiry) */
export async function getPhotoSignedUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('plantation-proofs')
    .createSignedUrl(storagePath, 600); // 10 min
  if (error || !data) return null;
  return data.signedUrl;
}

/** Get a signed URL for a satellite imagery PNG (10 min expiry) */
export async function getImagerySignedUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('plantation-imagery')
    .createSignedUrl(storagePath, 600);
  if (error || !data) return null;
  return data.signedUrl;
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes — Next.js API routes → FastAPI
// ─────────────────────────────────────────────────────────────────────────────

async function _getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

export async function fetchPlantationConfig(): Promise<PlantationConfig> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  const res = await fetch(`${apiUrl}/plantation/config`);
  if (!res.ok) throw new Error('Failed to fetch plantation config');
  return res.json() as Promise<PlantationConfig>;
}

export async function createSite(payload: {
  name: string;
  latitude: number;
  longitude: number;
  area_hectares: number;
  target_trees?: number | null;
  region_label?: string | null;
  teme_run_id?: string | null;
  recommendation_id?: string | null;
  boundary_geojson?: object | null;
}): Promise<PlantationSite> {
  const { userId } = getCurrentUserContext();
  const token = await _getToken();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  const res = await fetch(`${apiUrl}/plantation/sites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ user_id: userId, ...payload }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? 'Failed to create site');
  }
  const body = await res.json();
  return body.site as PlantationSite;
}

export async function submitReport(
  payload: SubmitReportPayload,
  photos: File[],
  photoMeta: PhotoMeta[],
): Promise<{ report_id: string; submitted_at: string; period_label: string; flags_visible_to_manager: unknown[] }> {
  const { userId } = getCurrentUserContext();
  const token = await _getToken();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

  const form = new FormData();
  form.set('payload', JSON.stringify({ user_id: userId, ...payload }));
  form.set('photo_meta', JSON.stringify(photoMeta));
  for (const photo of photos) {
    form.append('photos', photo);
  }

  const res = await fetch(`${apiUrl}/plantation/reports`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? 'Failed to submit report');
  }
  return res.json();
}

export async function reviewReport(
  reportId: string,
  status: 'pending' | 'reviewed' | 'needs_attention',
  note?: string,
): Promise<void> {
  const { error } = await supabase.rpc('review_plantation_report', {
    p_report_id: reportId,
    p_status: status,
    p_note: note ?? null,
  });
  if (error) throw new Error(`Review failed: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Flag helpers
// ─────────────────────────────────────────────────────────────────────────────

export const FLAG_LABELS: Record<string, { title: string; desc: string }> = {
  PHOTO_NO_GPS: { title: 'No GPS in photo', desc: 'This photo does not contain location data.' },
  PHOTO_FAR_FROM_SITE: { title: 'Photo far from site', desc: 'Photo GPS is more than 1 km from the registered site coordinates.' },
  PHOTO_OUT_OF_PERIOD: { title: 'Photo out of period', desc: 'Photo timestamp is outside the expected reporting window.' },
  DENSITY_HIGH: { title: 'High planting density', desc: 'Cumulative trees per hectare exceeds the expected maximum. Verify your counts.' },
  EXCEEDS_TARGET: { title: 'Exceeds TEME target', desc: 'Cumulative trees exceed 120% of the TEME plan target.' },
  COORDS_OUTSIDE_INDIA: { title: 'Coordinates outside India', desc: 'Site coordinates are outside India\'s bounding box.' },
  NO_PHOTOS_REUSED: { title: 'Duplicate photo', desc: 'A photo with identical content was already used in another report.' },
};
