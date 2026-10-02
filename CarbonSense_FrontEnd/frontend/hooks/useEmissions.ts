import { useState, useEffect, useCallback } from 'react';
import { EmissionEntry } from '@/lib/types';
import {
  fetchEmissionsForUpload,
  fetchEmissionsForUploads,
  updateEmissionEntry,
  deleteEmissionEntry,
  EmissionEntryRecord,
} from '@/lib/emissions-api';
import { getCurrentUserContext } from '@/lib/recommendations-api';

interface UseEmissionsParams {
  startDate?: string;
  endDate?: string;
  category?: string;
  uploadId?: string | null;
  uploadIds?: string[] | null;
}

interface UseEmissionsReturn {
  emissions: EmissionEntry[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  addEmission: (emission: Omit<EmissionEntry, 'id' | 'createdAt'>) => Promise<void>;
  updateEmission: (id: string, updates: Partial<EmissionEntry>) => Promise<void>;
  deleteEmission: (id: string) => Promise<void>;
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

  const uploadId = params?.uploadId;
  const uploadIds = params?.uploadIds;
  const hasUploadIdParam = Object.prototype.hasOwnProperty.call(params || {}, 'uploadId');
  const hasUploadIdsParam = Object.prototype.hasOwnProperty.call(params || {}, 'uploadIds');

  const mapEntryRecord = (entry: EmissionEntryRecord): EmissionEntry => ({
    id: entry.id,
    date: entry.entry_date,
    category: entry.category as EmissionEntry['category'],
    activity: entry.activity,
    amount: Number(entry.amount || 0),
    unit: entry.unit || '',
    co2Amount: Number(entry.co2_kg || 0),
    createdAt: entry.created_at,
  });

  const fetchEmissions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { organizationId, userId } = getCurrentUserContext();
      if (organizationId && uploadId) {
        const entries = await fetchEmissionsForUpload(organizationId, uploadId, userId || undefined);
        const mapped: EmissionEntry[] = entries.map(mapEntryRecord);

        setEmissions(mapped);
        setTotal(mapped.reduce((sum, e) => sum + e.co2Amount, 0));
        setIsLoading(false);
        return;
      }

      if (organizationId && uploadIds && uploadIds.length > 0) {
        const entries = await fetchEmissionsForUploads(organizationId, uploadIds, userId || undefined);
        const mapped: EmissionEntry[] = entries.map(mapEntryRecord);

        mapped.sort((left, right) => {
          const l = new Date(left.date).getTime();
          const r = new Date(right.date).getTime();
          return r - l;
        });

        setEmissions(mapped);
        setTotal(mapped.reduce((sum, e) => sum + e.co2Amount, 0));
        setIsLoading(false);
        return;
      }

      // When uploadId is intentionally set to null, keep the view empty instead of loading mock rows.
      if (hasUploadIdParam && !uploadId) {
        setEmissions([]);
        setTotal(0);
        setIsLoading(false);
        return;
      }

      // When uploadIds is intentionally set and empty, keep view empty.
      if (hasUploadIdsParam && (!uploadIds || uploadIds.length === 0)) {
        setEmissions([]);
        setTotal(0);
        setIsLoading(false);
        return;
      }

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

      // Mock data (no artificial delay)

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
  }, [uploadId, uploadIds, hasUploadIdParam, hasUploadIdsParam]);

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

      // Mock API call (no artificial delay)

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

  const updateEmission = async (id: string, updates: Partial<EmissionEntry>): Promise<void> => {
    try {
      setIsLoading(true);
      const { organizationId } = getCurrentUserContext();
      if (!organizationId) {
        throw new Error('Missing organization context.');
      }

      const payload = {
        entry_date: updates.date,
        category: updates.category,
        activity: updates.activity,
        amount: updates.amount,
        unit: updates.unit,
        co2_kg: updates.co2Amount,
      };

      const response = await updateEmissionEntry(organizationId, id, payload);
      const updated = mapEntryRecord(response.entry);

      setEmissions((prev) => prev.map((entry) => (entry.id === id ? updated : entry)));
      setTotal(response.uploadTotals.total_emissions_kg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update emission');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteEmission = async (id: string): Promise<void> => {
    try {
      setIsLoading(true);
      const { organizationId } = getCurrentUserContext();
      if (!organizationId) {
        throw new Error('Missing organization context.');
      }

      const response = await deleteEmissionEntry(organizationId, id);
      setEmissions((prev) => prev.filter((entry) => entry.id !== id));
      setTotal(response.uploadTotals.total_emissions_kg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete emission');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmissions();
  }, [fetchEmissions]);

  return {
    emissions,
    total,
    isLoading,
    error,
    refetch: fetchEmissions,
    addEmission,
    updateEmission,
    deleteEmission,
  };
};
