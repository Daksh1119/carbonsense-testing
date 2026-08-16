import { useState, useEffect, useCallback } from 'react';
import {
  generateRecommendations,
  getCurrentUserContext,
} from '@/lib/recommendations-api';
import { supabase } from '@/lib/supabaseClient';
import { getUserProfile } from '@/lib/authHelpers';
import { useUserStore } from '@/store';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface Recommendation {
  id: string;
  title: string;
  description: string;
  type: 'reduction' | 'offset';
  impact: number;
  cost: number;
  difficulty: 'easy' | 'medium' | 'hard';
  certainty: number;
  timeToImpact: string;
  category: string;
  steps: string[];
  rationale?: string;
}

interface UseRecommendationsReturn {
  recommendations: Recommendation[];
  isLoading: boolean;
  error: string | null;
  llmUsed: boolean | null;
  llmWarning: string | null;
  refetch: () => void;
  generateFresh: () => void;
}

/**
 * Maps a raw recommendation row (from DB or API) to the UI Recommendation shape.
 */
function mapRecToUi(rec: any, idx: number): Recommendation {
  const certainty = Math.round(Number(rec.confidence_score || 0) * 100);
  const rawSteps =
    rec.recommendation_payload?.implementation_steps ||
    rec.implementation_steps ||
    [];
  const parsedSteps = Array.isArray(rawSteps)
    ? rawSteps.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
    : [];
  const difficulty: 'easy' | 'medium' | 'hard' =
    rec.priority === 'critical' || rec.priority === 'high'
      ? 'hard'
      : rec.priority === 'medium'
      ? 'medium'
      : 'easy';
  return {
    id: rec.id,
    title: rec.title,
    description: rec.summary || rec.description || '',
    type: rec.action_type === 'offset' ? 'offset' : 'reduction',
    impact: Number(rec.estimated_impact_kg_co2e || 0),
    cost: Number(rec.implementation_cost_usd || 0) * 83,
    difficulty,
    certainty,
    timeToImpact: rec.time_to_impact_months
      ? `${rec.time_to_impact_months} months`
      : 'TBD',
    category: rec.action_type || 'General',
    steps:
      parsedSteps.length > 0
        ? parsedSteps.slice(0, 5)
        : [
            'Assign owner and timeline',
            'Execute pilot implementation',
            'Track weekly KPI movement',
            'Scale after verified impact',
          ],
    rationale: rec.rationale || undefined,
  };
}

/**
 * useRecommendations Hook
 *
 * Strategy (cache-first to prevent repeated LLM calls and changing values):
 * 1. On mount: fetch already-stored recommendation_items from GET /recommendations/items
 * 2. If items exist → use them immediately, do NOT call /generate
 * 3. If no items exist → call /generate once (backend will also cache this)
 * 4. generateFresh() forces a brand-new generation (passes force_refresh=true)
 */
export const useRecommendations = (uploadId?: string): UseRecommendationsReturn => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [llmUsed, setLlmUsed] = useState<boolean | null>(null);
  const [llmWarning, setLlmWarning] = useState<string | null>(null);

  // ------------------------------------------------------------------
  // Resolve user / org context
  // ------------------------------------------------------------------
  const resolveContext = useCallback(async () => {
    let { userId, organizationId } = getCurrentUserContext();
    if (!userId || !organizationId) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        userId = userId || session.user.id;
        organizationId =
          organizationId ||
          session.user.user_metadata?.organization_id ||
          session.user.user_metadata?.organizationId;
        if (!organizationId) {
          const profile = await getUserProfile(userId);
          if (profile?.organization_id) {
            organizationId = profile.organization_id;
            useUserStore.getState().updateUser({
              organizationId: profile.organization_id,
              organization: profile.organization_name ?? undefined,
            });
          }
        }
      }
    }
    if (!userId || !organizationId) {
      throw new Error(
        'Missing user/organization context. Please refresh or log in again.'
      );
    }
    return { userId, organizationId };
  }, []);

  // ------------------------------------------------------------------
  // Generate recommendations (calls /generate, backend handles per-upload caching)
  // ------------------------------------------------------------------
  const callGenerate = useCallback(
    async (forceRefresh = false) => {
      const { userId, organizationId } = await resolveContext();

      const csvRaw =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('latest_csv_emissions_summary')
          : null;
      const csvSummary = csvRaw ? JSON.parse(csvRaw) : null;

      const response = await generateRecommendations({
        organization_id: organizationId,
        user_id: userId,
        project_name: 'Uploaded CSV Decarbonization Plan',
        location: 'India',
        emission_kg: Number(csvSummary?.totals?.total_kg_co2e || 0),
        time_horizon_years: 15,
        kpi_snapshots: csvSummary?.kpi_snapshots || [],
        teme_result: {
          csv_summary: {
            by_category_kg_co2e:
              csvSummary?.breakdown?.by_category_kg_co2e || {},
            by_scope_kg_co2e: csvSummary?.breakdown?.by_scope_kg_co2e || {},
            records_processed: csvSummary?.totals?.records_processed || 0,
          },
        },
        force_refresh: forceRefresh,
        emissions_upload_id: uploadId || undefined,
      });

      const mapped: Recommendation[] = (response.recommendations || []).map(
        (rec, idx) => mapRecToUi(rec, idx)
      );
      setRecommendations(mapped);
      setLlmUsed(Boolean(response.llm_used));
      setLlmWarning(response.llm_warning || null);
    },
    [resolveContext, uploadId]
  );

  // ------------------------------------------------------------------
  // Main effect — calls backend generate (which returns cached session per upload)
  // ------------------------------------------------------------------
  const fetchRecommendations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await callGenerate(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch recommendations'
      );
      setLlmUsed(null);
      setLlmWarning(null);
    } finally {
      setIsLoading(false);
    }
  }, [callGenerate]);

  // ------------------------------------------------------------------
  // Force a fresh generation (user-triggered refresh)
  // ------------------------------------------------------------------
  const generateFresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await callGenerate(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to regenerate recommendations'
      );
    } finally {
      setIsLoading(false);
    }
  }, [callGenerate]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return {
    recommendations,
    isLoading,
    error,
    llmUsed,
    llmWarning,
    refetch: fetchRecommendations,
    generateFresh,
  };
};
