/**
 * Emissions API Service
 * Handles all emissions-related API calls
 */

import { EmissionEntry } from '@/lib/types';

export interface EmissionsQueryParams {
  startDate?: string;
  endDate?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export interface EmissionsResponse {
  entries: EmissionEntry[];
  total: number;
  totalEmissions: number;
}

/**
 * Fetch emissions history with optional filters
 */
export const getEmissions = async (params?: EmissionsQueryParams): Promise<EmissionsResponse> => {
  // TODO: Replace with actual API call
  // const queryParams = new URLSearchParams(params as any);
  // const response = await fetch(`/api/emissions?${queryParams}`);
  // if (!response.ok) throw new Error('Failed to fetch emissions');
  // return response.json();

  // Mock data (no artificial delay)
  const mockEntries: EmissionEntry[] = [
    {
      id: 'EMI-0001',
      date: '2024-03-01',
      category: 'transport',
      activity: 'Business Travel (Road)',
      amount: 120,
      unit: 'km',
      co2Amount: 35.5,
      createdAt: '2024-03-01T10:00:00Z',
    },
    {
      id: 'EMI-0002',
      date: '2024-03-02',
      category: 'energy',
      activity: 'Electricity',
      amount: 450,
      unit: 'kWh',
      co2Amount: 225.0,
      createdAt: '2024-03-02T14:30:00Z',
    },
    {
      id: 'EMI-0003',
      date: '2024-03-03',
      category: 'food',
      activity: 'Catering',
      amount: 25,
      unit: 'meals',
      co2Amount: 15.5,
      createdAt: '2024-03-03T12:00:00Z',
    },
  ];

  const totalEmissions = mockEntries.reduce((sum, e) => sum + e.co2Amount, 0);

  return {
    entries: mockEntries,
    total: mockEntries.length,
    totalEmissions,
  };
};

/**
 * Add a new emission entry
 */
export const addEmission = async (
  emission: Omit<EmissionEntry, 'id' | 'createdAt'>
): Promise<EmissionEntry> => {
  // TODO: Replace with actual API call
  // const response = await fetch('/api/emissions', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(emission),
  // });
  // if (!response.ok) throw new Error('Failed to add emission');
  // return response.json();

  const newEmission: EmissionEntry = {
    ...emission,
    id: `EMI-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    createdAt: new Date().toISOString(),
  };

  return newEmission;
};

/**
 * Update an existing emission entry
 */
export const updateEmission = async (
  id: string,
  updates: Partial<EmissionEntry>
): Promise<EmissionEntry> => {
  // TODO: Replace with actual API call
  // const response = await fetch(`/api/emissions/${id}`, {
  //   method: 'PATCH',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(updates),
  // });
  // if (!response.ok) throw new Error('Failed to update emission');
  // return response.json();

  return {
    id,
    ...updates,
  } as EmissionEntry;
};

/**
 * Delete an emission entry
 */
export const deleteEmission = async (id: string): Promise<void> => {
  // TODO: Replace with actual API call
  // const response = await fetch(`/api/emissions/${id}`, {
  //   method: 'DELETE',
  // });
  // if (!response.ok) throw new Error('Failed to delete emission');
};
