import { useState, useEffect } from 'react';

interface DashboardData {
  totalEmissions: number;
  reductionAchieved: number;
  timeDebtStatus: string;
  policyAlerts: number;
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

      // TODO: Replace with actual API call
      // const response = await fetch('/api/dashboard/summary');
      // const data = await response.json();

      // Mock data for now
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const mockData: DashboardData = {
        totalEmissions: 1240,
        reductionAchieved: 12.5,
        timeDebtStatus: '15 Years',
        policyAlerts: 2,
        carbonPath: {
          historical: [
            { date: '2024-01', value: 1100 },
            { date: '2024-02', value: 1150 },
            { date: '2024-03', value: 1200 },
            { date: '2024-04', value: 1180 },
            { date: '2024-05', value: 1220 },
            { date: '2024-06', value: 1240 },
          ],
          projected: [
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

      setData(mockData);
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
