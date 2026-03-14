import { useState, useEffect } from 'react';
import { usePolicyStore } from '../store';

interface Policy {
  id: string;
  title: string;
  description: string;
  urgency: 'high' | 'medium' | 'low';
  sectors: string[];
  deadline: string;
  actions: string[];
  isRead: boolean;
  createdAt: string;
}

interface UsePoliciesReturn {
  policies: Policy[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * usePolicies Hook
 * Fetches policy alerts and syncs with global policy store
 */
export const usePolicies = (): UsePoliciesReturn => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { policies, unreadCount, setPolicies } = usePolicyStore();

  const fetchPolicies = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // TODO: Replace with actual API call
      // const response = await fetch('/api/policy/active-policies');
      // const data = await response.json();

      // Mock data for now
      await new Promise((resolve) => setTimeout(resolve, 800));

      const mockPolicies: Policy[] = [
        {
          id: 'policy-1',
          title: 'Budget 2026 CCUS Incentive',
          description:
            '₹50,000 crore allocated for Carbon Capture Utilization and Storage. SMEs in cement and steel sectors can apply for funding.',
          urgency: 'high',
          sectors: ['Manufacturing', 'Cement', 'Steel'],
          deadline: '2026-06-30',
          actions: [
            'Submit Expression of Interest',
            'Prepare technical documentation',
            'Apply for funding by deadline',
          ],
          isRead: false,
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          id: 'policy-2',
          title: 'EU CBAM Compliance',
          description:
            'Carbon Border Adjustment Mechanism now requires quarterly reporting for exports to EU.',
          urgency: 'medium',
          sectors: ['Export', 'Manufacturing'],
          deadline: '2026-04-15',
          actions: [
            'Register on CBAM portal',
            'Submit Q1 emissions report',
            'Pay adjustment fees if applicable',
          ],
          isRead: false,
          createdAt: '2026-02-15T00:00:00Z',
        },
      ];

      setPolicies(mockPolicies);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch policies');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  return {
    policies,
    unreadCount,
    isLoading,
    error,
    refetch: fetchPolicies,
  };
};
