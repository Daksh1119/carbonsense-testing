import { useState, useEffect } from 'react';
import { fetchEmissionsUploads } from '@/lib/emissions-api';
import { getCurrentUserContext } from '@/lib/recommendations-api';

interface DashboardData {
  totalEmissions: number;
  reductionAchieved: number;
  timeDebtStatus: string;
  policyAlerts: number;
  latestPeriodLabel: string;
  carbonPath: {
    historical: { date: string; value: number }[];
    projected: { date: string; value: number }[];
  };
  strategies: {
    name: string;
    impact: number;
    certainty: number;
  }[];
}

interface UseDashboardDataReturn {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * useDashboardData Hook
 * Fetches and manages dashboard summary data
 */
export const useDashboardData = (): UseDashboardDataReturn => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { organizationId } = getCurrentUserContext();
      if (!organizationId) {
        throw new Error('Missing organization context.');
      }

      const uploads = await fetchEmissionsUploads(organizationId);
      const sorted = [...uploads]
        .filter((upload) => upload.period_start)
        .sort((a, b) => String(a.period_start).localeCompare(String(b.period_start)));

      const latestUpload = uploads[0];
      const previousUpload = uploads.length > 1 ? uploads[1] : null;

      const latestTotalKg = latestUpload?.total_emissions_kg ?? 0;
      const latestPeriodLabel = latestUpload?.period_start
        ? new Date(latestUpload.period_start).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : 'Latest';
      const previousTotalKg = previousUpload?.total_emissions_kg ?? null;

      const reductionAchieved = previousTotalKg && previousTotalKg > 0
        ? Number((((previousTotalKg - latestTotalKg) / previousTotalKg) * 100).toFixed(1))
        : 0;

      const historical = sorted.map((upload) => ({
        date: String(upload.period_start),
        value: Number(((upload.total_emissions_kg || 0) / 1000).toFixed(2)),
      }));

      const lastHistoricalValue = historical.length > 0
        ? historical[historical.length - 1].value
        : 1240;

      const projectionStart = historical.length > 0
        ? new Date(String(historical[historical.length - 1].date))
        : new Date('2024-06-01');

      const projected = Array.from({ length: 6 }).map((_, index) => {
        const next = new Date(projectionStart.getFullYear(), projectionStart.getMonth() + index + 1, 1);
        const value = Number((lastHistoricalValue * Math.pow(0.97, index + 1)).toFixed(2));
        return {
          date: next.toISOString().slice(0, 7),
          value,
        };
      });

      const dashboardData: DashboardData = {
        totalEmissions: Number(((latestTotalKg || 0) / 1000).toFixed(2)),
        reductionAchieved,
        timeDebtStatus: '15 Years',
        policyAlerts: 2,
        latestPeriodLabel,
        carbonPath: {
          historical: historical.length > 0
            ? historical
            : [
                { date: '2024-01', value: 1100 },
                { date: '2024-02', value: 1150 },
                { date: '2024-03', value: 1200 },
                { date: '2024-04', value: 1180 },
                { date: '2024-05', value: 1220 },
                { date: '2024-06', value: 1240 },
              ],
          projected: projected.length > 0
            ? projected
            : [
                { date: '2024-07', value: 1200 },
                { date: '2024-08', value: 1150 },
                { date: '2024-09', value: 1100 },
                { date: '2024-10', value: 1050 },
                { date: '2024-11', value: 1000 },
                { date: '2024-12', value: 950 },
              ],
        },
        strategies: [
          { name: 'Immediate Reduction', impact: 95, certainty: 98 },
          { name: 'Tree Planting (15 years)', impact: 70, certainty: 75 },
        ],
      };

      setData(dashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
};
