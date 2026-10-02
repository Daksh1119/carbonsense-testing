/**
 * Dashboard API Service
 * Handles all dashboard-related API calls
 */

export interface DashboardSummary {
  totalEmissions: number;
  reductionAchieved: number;
  timeDebtStatus: string;
  policyAlerts: number;
}

export interface CarbonPathData {
  historical: { date: string; value: number }[];
  projected: { date: string; value: number }[];
}

export interface Strategy {
  name: string;
  impact: number;
  certainty: number;
}

/**
 * Fetch dashboard summary data
 */
export const getDashboardSummary = async (): Promise<DashboardSummary> => {
  // TODO: Replace with actual API call
  // const response = await fetch('/api/dashboard/summary');
  // if (!response.ok) throw new Error('Failed to fetch dashboard summary');
  // return response.json();

  return {
    totalEmissions: 1240,
    reductionAchieved: 12.5,
    timeDebtStatus: '15 Years',
    policyAlerts: 2,
  };
};

/**
 * Fetch carbon path data (historical + projected)
 */
export const getCarbonPath = async (): Promise<CarbonPathData> => {
  // TODO: Replace with actual API call
  // const response = await fetch('/api/dashboard/carbon-path');
  // if (!response.ok) throw new Error('Failed to fetch carbon path data');
  // return response.json();

  return {
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
  };
};

/**
 * Fetch strategy comparison data
 */
export const getStrategies = async (): Promise<Strategy[]> => {
  // TODO: Replace with actual API call
  // const response = await fetch('/api/dashboard/strategies');
  // if (!response.ok) throw new Error('Failed to fetch strategies');
  // return response.json();

  return [
    { name: 'Immediate Reduction', impact: 95, certainty: 98 },
    { name: 'Tree Planting (15 years)', impact: 70, certainty: 75 },
  ];
};
