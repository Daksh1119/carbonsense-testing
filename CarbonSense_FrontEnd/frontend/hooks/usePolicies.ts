import { useEffect, useState } from 'react';
import { usePolicyStore } from '../store';
import { fetchPolicies as fetchPolicyAlerts, type PolicyRecord } from '@/lib/policy-compliance-api';

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

function formatDeadline(policy: PolicyRecord): string {
  if (policy.review_date) return policy.review_date;
  if (policy.effective_date) return policy.effective_date;
  if (!policy.key_deadlines) return 'Rolling';
  const firstDeadline = Object.values(policy.key_deadlines)[0];
  return firstDeadline ? String(firstDeadline) : 'Rolling';
}

function urgencyFromLayer(layer?: string | null): 'high' | 'medium' | 'low' {
  const value = (layer || '').toLowerCase();
  if (value === 'core' || value === 'mandatory') return 'high';
  if (value === 'secondary' || value === 'optional') return 'medium';
  return 'low';
}

function mapPolicy(policy: PolicyRecord): Policy {
  return {
    id: policy.id,
    title: policy.short_name || policy.name,
    description:
      policy.description ||
      policy.authority ||
      `Policy category: ${policy.category || 'general'}`,
    urgency: urgencyFromLayer(policy.layer),
    sectors: policy.applicability || [],
    deadline: formatDeadline(policy),
    actions: (policy.requirements || []).slice(0, 3),
    isRead: false,
    createdAt: policy.effective_date || new Date().toISOString(),
  };
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

  const loadPolicies = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const livePolicies = await fetchPolicyAlerts({ activeOnly: true });
      setPolicies(livePolicies.map(mapPolicy));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch policies');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPolicies();
  }, []);

  return {
    policies,
    unreadCount,
    isLoading,
    error,
    refetch: loadPolicies,
  };
};
