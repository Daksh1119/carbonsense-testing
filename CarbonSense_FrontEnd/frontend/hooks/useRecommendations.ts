import { useState, useEffect } from 'react';

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
}

interface UseRecommendationsReturn {
  recommendations: Recommendation[];
  isLoading: boolean;
  error: string | null;
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

  const fetchRecommendations = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // TODO: Replace with actual API call
      // const response = await fetch('/api/recommendations');
      // const data = await response.json();

      // Mock data for now
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const mockRecommendations: Recommendation[] = [
        {
          id: 'rec-1',
          title: 'Switch to Renewable Energy',
          description:
            'Transition 80% of electricity consumption to solar/wind energy. This provides immediate and permanent reduction.',
          type: 'reduction',
          impact: 450,
          cost: 250000,
          difficulty: 'medium',
          certainty: 95,
          timeToImpact: 'Immediate',
          category: 'Energy',
        },
        {
          id: 'rec-2',
          title: 'Optimize Fleet Routes',
          description:
            'Implement AI-powered route optimization for delivery vehicles to reduce fuel consumption by 15%.',
          type: 'reduction',
          impact: 120,
          cost: 50000,
          difficulty: 'easy',
          certainty: 90,
          timeToImpact: '1 month',
          category: 'Transport',
        },
        {
          id: 'rec-3',
          title: 'Plant Native Trees (Neem)',
          description:
            'Plant 500 neem trees with 75% survival rate. Full carbon offset achieved in 15-18 years.',
          type: 'offset',
          impact: 300,
          cost: 22500,
          difficulty: 'easy',
          certainty: 75,
          timeToImpact: '15-18 years',
          category: 'TEME',
        },
        {
          id: 'rec-4',
          title: 'Install LED Lighting',
          description:
            'Replace all fluorescent and incandescent bulbs with LED. Save 60% on lighting energy.',
          type: 'reduction',
          impact: 80,
          cost: 35000,
          difficulty: 'easy',
          certainty: 98,
          timeToImpact: 'Immediate',
          category: 'Energy',
        },
      ];

      setRecommendations(mockRecommendations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recommendations');
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
    refetch: fetchRecommendations,
  };
};
