import { getCurrentUserContext } from "@/lib/recommendations-api";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

function isUuid(value?: string | null): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function getSafeUserContext(): { organizationId: string; userId: string } {
  const ctx = getCurrentUserContext();
  const defaultOrg = process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID || "8b8f7ce2-35c8-4b1a-9eb4-de7d4f29ea1f";
  const defaultUser = process.env.NEXT_PUBLIC_DEFAULT_USER_ID || "17ee8f62-8a18-42b1-be0c-b0498f122034";

  return {
    organizationId: isUuid(ctx.organizationId) ? ctx.organizationId : defaultOrg,
    userId: isUuid(ctx.userId) ? ctx.userId : defaultUser,
  };
}

function buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && `${value}`.length > 0) {
        qs.set(key, String(value));
      }
    });
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return `${apiBaseUrl}${path}${suffix}`;
}

async function fetchJson<T>(url: string, init?: RequestInit, retries = 1): Promise<T> {
  try {
    const response = await fetch(url, init);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.detail || body?.message || `Request failed: ${response.status}`);
    }
    return body as T;
  } catch (err) {
    if (
      retries > 0 &&
      err instanceof Error &&
      (err.message.includes("ConnectionTerminated") ||
        err.message.includes("Failed to fetch") ||
        err.message.includes("Server disconnected"))
    ) {
      await new Promise((res) => setTimeout(res, 300));
      return fetchJson<T>(url, init, retries - 1);
    }
    throw err;
  }
}

export interface PolicyRecord {
  id: string;
  name: string;
  short_name: string | null;
  description: string | null;
  category: string | null;
  layer: string | null;
  applicability: string[] | null;
  requirements?: string[] | null;
  benefits?: string[] | null;
  effective_date?: string | null;
  review_date?: string | null;
  authority?: string | null;
  external_url?: string | null;
  key_deadlines: Record<string, unknown> | null;
  match_score?: number;
  match_reason?: string;
  status?: string;
  compliance_progress?: { completed: number; total: number };
  document_summary?: Record<string, unknown> | null;
  steps?: Array<Record<string, unknown>> | null;
  funding?: Record<string, unknown> | null;
}

export interface ComplianceResultRecord {
  id: string;
  requirement_id: string;
  status: "not_started" | "in_progress" | "overdue" | "completed" | "verified";
  progress_pct: number | null;
  due_date: string | null;
  completed_at: string | null;
  verified: boolean;
  requirement?: {
    id: string;
    name: string;
    level: string;
    type: string;
    verification_method: string;
  };
}

export interface ComplianceDeadlineRecord {
  id: string;
  due_date: string;
  status: string;
  compliance_requirements?: {
    name?: string;
    level?: string;
    type?: string;
  };
}

export interface TopActionRecord {
  requirement_id: string;
  name: string;
  type: string;
  level: string;
  verification_method: string;
  score_gain_estimate: number;
  rupee_impact_estimate: number;
  co2_kg_impact_estimate: number;
  priority_score: number;
  description?: string;
}

export interface ImpactSummary {
  organization_id: string;
  unlocked_rupees_estimate: number;
  pipeline_rupees_estimate: number;
  unlocked_co2_kg_estimate: number;
  pipeline_co2_kg_estimate: number;
}

export interface BenchmarkSummary {
  organization_id: string;
  industry: string;
  your_score: number;
  industry_baseline: number;
  delta_vs_baseline: number;
  estimated_percentile: number;
  method: string;
}

export interface ComplianceScoreRecord {
  organization_id: string;
  data_score: number;
  action_score: number;
  reporting_score: number;
  total_score: number;
  breakdown?: Record<string, unknown>;
}

export interface PolicyRequirementRecord {
  id: string;
  policy_id: string;
  name: string;
  type: string;
  level: string;
  industry: string[];
  verification_method: string;
  description: string;
  is_mandatory: boolean;
  weight: number;
  estimated_rupee_impact: number | null;
  estimated_co2_kg_impact: number | null;
}

export async function fetchPolicies(params?: {
  category?: string;
  industry?: string;
  activeOnly?: boolean;
  organizationId?: string;
  size?: string;
  totalEmissionsKg?: number;
}): Promise<PolicyRecord[]> {
  const { organizationId: safeOrganizationId } = getSafeUserContext();
  const url = buildUrl("/policies", {
    category: params?.category,
    industry: params?.industry,
    active_only: params?.activeOnly ?? true,
    organization_id: params?.organizationId || safeOrganizationId,
    size: params?.size,
    total_emissions_kg: params?.totalEmissionsKg,
  });
  const payload = await fetchJson<{ policies: PolicyRecord[] }>(url);
  return payload.policies || [];
}

export async function fetchComplianceResults(params?: {
  level?: string;
  status?: string;
}): Promise<ComplianceResultRecord[]> {
  const { organizationId, userId } = getSafeUserContext();
  if (!organizationId || !userId) {
    return [];
  }
  const url = buildUrl("/compliance/results", {
    organization_id: organizationId,
    user_id: userId,
    level: params?.level,
    status: params?.status,
  });
  const payload = await fetchJson<{ results: ComplianceResultRecord[] }>(url);
  return payload.results || [];
}

export async function fetchComplianceDeadlines(days = 90): Promise<ComplianceDeadlineRecord[]> {
  const { organizationId, userId } = getSafeUserContext();
  if (!organizationId || !userId) {
    return [];
  }
  const url = buildUrl("/compliance/deadlines", {
    organization_id: organizationId,
    user_id: userId,
    days,
  });
  const payload = await fetchJson<{ deadlines: ComplianceDeadlineRecord[] }>(url);
  return payload.deadlines || [];
}

export async function fetchTopActions(topN = 3, industry?: string): Promise<TopActionRecord[]> {
  const { organizationId, userId } = getSafeUserContext();
  if (!organizationId || !userId) {
    return [];
  }
  const url = buildUrl("/compliance/top-actions", {
    organization_id: organizationId,
    user_id: userId,
    top_n: topN,
    industry,
  });
  const payload = await fetchJson<{ actions: TopActionRecord[] }>(url);
  return payload.actions || [];
}

export async function fetchImpactSummary(): Promise<ImpactSummary> {
  const { organizationId, userId } = getSafeUserContext();
  const url = buildUrl("/compliance/impact", {
    organization_id: organizationId,
    user_id: userId,
  });
  return fetchJson<ImpactSummary>(url);
}

export async function fetchBenchmark(industry = "sme"): Promise<BenchmarkSummary> {
  const { organizationId, userId } = getSafeUserContext();
  const url = buildUrl("/compliance/benchmark", {
    organization_id: organizationId,
    user_id: userId,
    industry,
  });
  return fetchJson<BenchmarkSummary>(url);
}

export async function fetchComplianceScore(): Promise<ComplianceScoreRecord> {
  const { organizationId, userId } = getSafeUserContext();
  const url = buildUrl("/compliance/score", {
    organization_id: organizationId,
    user_id: userId,
  });
  const payload = await fetchJson<{ score: ComplianceScoreRecord }>(url);
  return payload.score;
}

export async function fetchComplianceScoreHistory(days = 365): Promise<Array<Record<string, unknown>>> {
  const { organizationId, userId } = getSafeUserContext();
  const url = buildUrl("/compliance/score/history", {
    organization_id: organizationId,
    user_id: userId,
    days,
  });
  const payload = await fetchJson<{ history: Array<Record<string, unknown>> }>(url);
  return payload.history || [];
}

export async function fetchPolicyById(policyId: string): Promise<PolicyRecord> {
  const { organizationId } = getSafeUserContext();
  const url = buildUrl(`/policies/${policyId}`, {
    organization_id: organizationId,
  });
  return fetchJson<PolicyRecord>(url);
}

export async function fetchRequirementById(requirementId: string): Promise<PolicyRequirementRecord> {
  const url = buildUrl(`/compliance/requirements/${requirementId}`);
  return fetchJson<PolicyRequirementRecord>(url);
}

export async function fetchRequirementSteps(resultId: string): Promise<Array<Record<string, unknown>>> {
  const { organizationId, userId } = getSafeUserContext();
  const url = buildUrl(`/compliance/results/${resultId}/steps`, {
    organization_id: organizationId,
    user_id: userId,
  });
  const payload = await fetchJson<{ steps: Array<Record<string, unknown>> }>(url);
  return payload.steps || [];
}

export async function fetchRequirementEvidenceHistory(resultId: string): Promise<Array<Record<string, unknown>>> {
  const { organizationId, userId } = getSafeUserContext();
  const url = buildUrl(`/compliance/results/${resultId}/evidence-history`, {
    organization_id: organizationId,
    user_id: userId,
  });
  const payload = await fetchJson<{ history: Array<Record<string, unknown>> }>(url);
  return payload.history || [];
}

export async function verifyComplianceResult(
  resultId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { organizationId, userId } = getSafeUserContext();
  const url = buildUrl(`/compliance/results/${resultId}/verify`);
  return fetchJson<Record<string, unknown>>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organization_id: organizationId, user_id: userId, ...payload }),
  });
}

export async function uploadComplianceEvidence(formData: FormData): Promise<Record<string, unknown>> {
  const { organizationId, userId } = getSafeUserContext();
  if (!formData.has("organization_id")) formData.set("organization_id", organizationId);
  if (!formData.has("user_id")) formData.set("user_id", userId);
  const response = await fetch(`${apiBaseUrl}/compliance/evidence`, {
    method: "POST",
    body: formData,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.detail || `Request failed: ${response.status}`);
  }
  return body;
}

export async function askPolicyQuestion(payload: {
  policyId?: string;
  question: string;
  organizationId?: string;
  userId?: string;
  industry?: string;
  organizationSize?: string;
  totalEmissionsKg?: number;
}): Promise<{ answer: string; model: string; interaction_id?: string; interaction?: Record<string, unknown> }> {
  const { organizationId, userId } = getSafeUserContext();
  const response = await fetch(`${apiBaseUrl}/policies/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organization_id: payload.organizationId || organizationId,
      user_id: payload.userId || userId,
      question: payload.question,
      policy_id: payload.policyId,
      industry: payload.industry || "manufacturing",
      organization_size: payload.organizationSize || "sme",
      total_emissions_kg: payload.totalEmissionsKg || 0,
      context: {},
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.detail || `Request failed: ${response.status}`);
  }
  return {
    answer: String(body?.answer || body?.response || ""),
    model: String(body?.model || body?.model_used || "unknown"),
    interaction_id: body?.interaction_id || body?.interaction?.id,
    interaction: body?.interaction,
  };
}

// ---------------------------------------------------------------------------
// Group 3B.3 — Policy adoption status
// ---------------------------------------------------------------------------

export type PolicyAdoptionStatus = "not_started" | "in_progress" | "adopted" | "not_applicable";

export interface PolicyAdoptionRecord {
  id: string;
  organization_id: string;
  policy_id: string;
  status: PolicyAdoptionStatus;
  status_updated_at: string | null;
  evidence_url: string | null;
  notes: string | null;
}

/** Fetch all adoption rows for an org (from organization_policy_adoption table via Supabase). */
export async function fetchPolicyAdoptions(organizationId: string): Promise<PolicyAdoptionRecord[]> {
  const { supabase } = await import("@/lib/supabaseClient");
  const { data, error } = await supabase
    .from("organization_policy_adoption")
    .select("*")
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  return (data ?? []) as PolicyAdoptionRecord[];
}

/** Upsert a policy adoption row (insert or update). */
export async function upsertPolicyAdoption(
  organizationId: string,
  policyId: string,
  status: PolicyAdoptionStatus,
  userId: string
): Promise<PolicyAdoptionRecord> {
  const { supabase } = await import("@/lib/supabaseClient");
  const { data, error } = await supabase
    .from("organization_policy_adoption")
    .upsert(
      {
        organization_id: organizationId,
        policy_id: policyId,
        status,
        status_updated_at: new Date().toISOString(),
        status_updated_by: userId,
      },
      { onConflict: "organization_id,policy_id" }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as PolicyAdoptionRecord;
}

