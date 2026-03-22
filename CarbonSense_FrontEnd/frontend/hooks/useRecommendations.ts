import { useState, useEffect } from 'react';
import {
  generateRecommendations,
  getCurrentUserContext,
} from '@/lib/recommendations-api';

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
}

/**
 * useRecommendations Hook
 * Fetches AI-powered carbon reduction recommendations
 */
export const useRecommendations = (): UseRecommendationsReturn => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [llmUsed, setLlmUsed] = useState<boolean | null>(null);
  const [llmWarning, setLlmWarning] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { userId, organizationId } = getCurrentUserContext();
      if (!userId || !organizationId) {
        throw new Error('Missing user/organization context. Please login again.');
      }

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
            by_category_kg_co2e: csvSummary?.breakdown?.by_category_kg_co2e || {},
            by_scope_kg_co2e: csvSummary?.breakdown?.by_scope_kg_co2e || {},
            records_processed: csvSummary?.totals?.records_processed || 0,
          },
        },
      });

      const mapped: Recommendation[] = (response.recommendations || []).map((rec) => {
        const certainty = Math.round(Number(rec.confidence_score || 0) * 100);
        const parsedSteps = Array.isArray(rec.recommendation_payload?.implementation_steps)
          ? rec.recommendation_payload.implementation_steps.filter((s) => typeof s === 'string' && s.trim().length > 0)
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
          description: rec.summary,
          type: rec.action_type === 'offset' ? 'offset' : 'reduction',
          impact: Number(rec.estimated_impact_kg_co2e || 0),
          cost: Number(rec.implementation_cost_usd || 0) * 83,
          difficulty,
          certainty,
          timeToImpact: rec.time_to_impact_months ? `${rec.time_to_impact_months} months` : 'TBD',
          category: rec.action_type || 'General',
          steps: parsedSteps.length > 0
            ? parsedSteps.slice(0, 5)
            : [
                'Assign owner and timeline',
                'Execute pilot implementation',
                'Track weekly KPI movement',
                'Scale after verified impact',
              ],
          rationale: rec.rationale || undefined,
        };
      });

      setRecommendations(mapped);
      setLlmUsed(Boolean(response.llm_used));
      setLlmWarning(response.llm_warning || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recommendations');
      setLlmUsed(null);
      setLlmWarning(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  return {
    recommendations,
    isLoading,
    error,
    llmUsed,
    llmWarning,
    refetch: fetchRecommendations,
  };
};
