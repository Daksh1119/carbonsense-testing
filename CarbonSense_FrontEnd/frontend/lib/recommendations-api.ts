import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface GeneratedRecommendation {
  id: string;
  session_id: string;
  rank: number;
  title: string;
  summary: string;
  action_type: string;
  priority: "low" | "medium" | "high" | "critical";
  confidence_score: number;
  estimated_impact_kg_co2e: number | null;
  implementation_cost_usd: number | null;
  time_to_impact_months: number | null;
  rationale: string | null;
  recommendation_payload: {
    implementation_steps?: string[];
    generator?: string;
  };
}

export interface GenerateRecommendationsPayload {
  organization_id: string;
  user_id: string;
  project_name?: string;
  location?: string;
  emission_kg?: number;
  time_horizon_years?: number;
  target_recommendation_count?: number;
  teme_run_id?: string;
  teme_result?: Record<string, unknown>;
  kpi_snapshots?: Array<{
    kpi_name: string;
    kpi_value: number;
    kpi_unit?: string;
    period_start?: string;
    period_end?: string;
    meta?: Record<string, unknown>;
  }>;
  /** When true, bypasses the 7-day cache and forces a fresh LLM generation */
  force_refresh?: boolean;
  /** When set, scopes recommendations to this specific upload (per-file isolation) */
  emissions_upload_id?: string;
}

export interface GenerateRecommendationsResponse {
  session_id: string;
  llm_used: boolean;
  llm_warning?: string | null;
  recommendations: GeneratedRecommendation[];
  emission_kg?: number;
  project_name?: string;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabaseClient: SupabaseClient | null = null;

export interface CurrentUserContext {
  userId: string;
  organizationId: string;
}

function isUuid(value?: string | null): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function preferValidUuid(candidate: string, fallback: string): string {
  if (isUuid(candidate)) return candidate;
  if (isUuid(fallback)) return fallback;
  return candidate || fallback;
}

function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}

import { useUserStore } from "@/store";

export function getCurrentUserId(): string {
  if (typeof window === "undefined") return "";

  try {
    const user = useUserStore.getState().user;
    if (user?.id) return user.id;

    const raw = localStorage.getItem("carbonsense-user-storage");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { state?: { user?: { id?: string } } };
    return parsed.state?.user?.id || "";
  } catch {
    return "";
  }
}

export function getCurrentUserContext(): CurrentUserContext {
  if (typeof window === "undefined") {
    return {
      userId: "",
      organizationId: "",
    };
  }

  try {
    const userStoreState = useUserStore.getState();
    const user = userStoreState.user;
    const session = userStoreState.supabaseSession;

    const userId = user?.id || session?.user?.id || "";
    const organizationId =
      user?.organizationId ||
      (user as any)?.organization_id ||
      session?.user?.user_metadata?.organization_id ||
      session?.user?.user_metadata?.organizationId ||
      "";

    if (userId && organizationId) {
      return { userId, organizationId };
    }
  } catch {}

  try {
    const raw = localStorage.getItem("carbonsense-user-storage");
    if (raw) {
      const parsed = JSON.parse(raw) as {
        state?: { user?: { id?: string; organizationId?: string; organization_id?: string } };
      };
      const u = parsed.state?.user;
      if (u?.id) {
        return {
          userId: u.id,
          organizationId: u.organizationId || u.organization_id || "",
        };
      }
    }
  } catch {}

  const fallbackUser = useUserStore.getState().user;
  const fallbackSession = useUserStore.getState().supabaseSession;
  return {
    userId: fallbackUser?.id || fallbackSession?.user?.id || "",
    organizationId:
      fallbackUser?.organizationId ||
      (fallbackUser as any)?.organization_id ||
      fallbackSession?.user?.user_metadata?.organization_id ||
      "",
  };
}

export async function getLatestTEMERun(userId: string): Promise<any | null> {
  if (!userId) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("teme_runs")
    .select("id,project_name,emission_kg,input_payload,result,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read TEME history: ${error.message}`);
  }

  return data;
}

export async function generateRecommendations(
  payload: GenerateRecommendationsPayload
): Promise<GenerateRecommendationsResponse> {
  const endpoint = apiUrl ? `${apiUrl}/recommendations/generate` : "/api/recommendations/generate";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.detail || body?.message || `Failed with status ${res.status}`);
  }

  return body as GenerateRecommendationsResponse;
}
