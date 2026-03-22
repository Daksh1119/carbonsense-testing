import { useState, useEffect } from 'react';
import { EmissionEntry } from '@/lib/types';

interface UseEmissionsParams {
  startDate?: string;
  endDate?: string;
  category?: string;
}

interface UseEmissionsReturn {
  emissions: EmissionEntry[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  addEmission: (emission: Omit<EmissionEntry, 'id' | 'createdAt'>) => Promise<void>;
}

/**
 * useEmissions Hook
 * Manages emissions data fetching and submission
 */
export const useEmissions = (params?: UseEmissionsParams): UseEmissionsReturn => {
  const [emissions, setEmissions] = useState<EmissionEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmissions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Use latest uploaded CSV result when available.
      const latestCsv = typeof window !== 'undefined'
        ? window.sessionStorage.getItem('latest_csv_emissions_summary')
        : null;

      if (latestCsv) {
        const parsed = JSON.parse(latestCsv) as {
          computed_rows?: Array<{
            record_id?: string;
            date?: string;
            category?: string;
            activity_type?: string;
            quantity?: number;
            unit?: string;
            emissions_kg_co2e?: number;
          }>;
          totals?: { total_kg_co2e?: number };
        };

        const csvRows = parsed.computed_rows || [];
        const mapped: EmissionEntry[] = csvRows.map((row, index) => {
          const categoryKey = String(row.category || 'purchases').toLowerCase();
          const category =
            categoryKey === 'transport' ||
            categoryKey === 'energy' ||
            categoryKey === 'food' ||
            categoryKey === 'waste' ||
            categoryKey === 'purchases'
              ? categoryKey
              : 'purchases';

          return {
            id: String(row.record_id || `csv-${index + 1}`),
            date: String(row.date || new Date().toISOString().slice(0, 10)),
            category,
            activity: String(row.activity_type || 'Uploaded Activity'),
            amount: Number(row.quantity || 0),
            unit: String(row.unit || ''),
            co2Amount: Number(row.emissions_kg_co2e || 0),
            createdAt: new Date().toISOString(),
          };
        });

        setEmissions(mapped);
        if (parsed.totals?.total_kg_co2e !== undefined) {
          setTotal(Number(parsed.totals.total_kg_co2e));
        } else {
          setTotal(mapped.reduce((sum, e) => sum + e.co2Amount, 0));
        }
        setIsLoading(false);
        return;
      }

      // TODO: Replace with actual API call
      // const queryParams = new URLSearchParams(params as any);
      // const response = await fetch(`/api/emissions?${queryParams}`);
      // const data = await response.json();

      // Mock data for now
      await new Promise((resolve) => setTimeout(resolve, 800));

      const mockEmissions: EmissionEntry[] = [
        {
          id: '1',
          date: '2024-03-01',
          category: 'transport',
          activity: 'Business Travel (Road)',
          amount: 120,
          unit: 'km',
          co2Amount: 35.5,
          createdAt: '2024-03-01T10:00:00Z',
        },
        {
          id: '2',
          date: '2024-03-02',
          category: 'energy',
          activity: 'Electricity',
          amount: 450,
          unit: 'kWh',
          co2Amount: 225.0,
          createdAt: '2024-03-02T14:30:00Z',
        },
      ];

      setEmissions(mockEmissions);
      setTotal(mockEmissions.reduce((sum, e) => sum + e.co2Amount, 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch emissions');
    } finally {
      setIsLoading(false);
    }
  };

  const addEmission = async (
    emission: Omit<EmissionEntry, 'id' | 'createdAt'>
  ): Promise<void> => {
    try {
      setIsLoading(true);

      // TODO: Replace with actual API call
      // const response = await fetch('/api/emissions', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(emission),
      // });
      // const newEmission = await response.json();

      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const newEmission: EmissionEntry = {
        ...emission,
        id: `emission-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };

      setEmissions((prev) => [newEmission, ...prev]);
      setTotal((prev) => prev + newEmission.co2Amount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add emission');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmissions();
  }, [params?.startDate, params?.endDate, params?.category]);

  return {
    emissions,
    total,
    isLoading,
    error,
    refetch: fetchEmissions,
    addEmission,
  };
};
