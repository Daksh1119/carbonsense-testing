/**
 * Policy API Service
 * Handles all policy-related API calls
 */

import { fetchPolicies, type PolicyRecord } from '@/lib/policy-compliance-api';

export interface PolicyAlert {
  id: string;
  title: string;
  deadline: string;
  urgency: 'critical' | 'urgent' | 'warning' | 'info';
  description: string;
  actions: string[];
  status: 'pending' | 'in-progress' | 'completed';
}

export interface FundingOpportunity {
  id: string;
  title: string;
  amount: string;
  eligibility: string;
  deadline: string;
  description: string;
  ccus: boolean;
}

/**
 * Fetch policy alerts
 */
export const getPolicyAlerts = async (): Promise<PolicyAlert[]> => {
  const policies = await fetchPolicies({ activeOnly: true });

  const parseDeadline = (policy: PolicyRecord): Date | null => {
    const candidate = policy.review_date || policy.effective_date || Object.values(policy.key_deadlines || {})[0];
    if (!candidate) return null;
    const parsed = new Date(String(candidate));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getStatus = (policy: PolicyRecord): PolicyAlert['status'] => {
    const completed = Number(policy.compliance_progress?.completed || 0);
    const total = Number(policy.compliance_progress?.total || 0);
    if (total > 0 && completed >= total) return 'completed';
    if (completed > 0) return 'in-progress';
    if ((policy.status || '').toLowerCase() === 'compliant') return 'completed';
    return 'pending';
  };

  const getUrgency = (policy: PolicyRecord): PolicyAlert['urgency'] => {
    const deadline = parseDeadline(policy);
    const daysLeft = deadline ? Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
    const score = Number(policy.match_score || 0);
    const progress = Number(policy.compliance_progress?.completed || 0);

    if ((policy.status || '').toLowerCase() === 'compliant') return 'info';
    if (daysLeft !== null && daysLeft <= 7) return 'critical';
    if (daysLeft !== null && daysLeft <= 30) return 'urgent';
    if (score >= 75) return 'critical';
    if (score >= 50 || progress > 0) return 'urgent';
    return 'warning';
  };

  const formatDeadline = (policy: PolicyRecord): string => {
    const deadline = parseDeadline(policy);
    if (!deadline) return 'Rolling';
    const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    return daysLeft === 0 ? 'Due now' : `${daysLeft} days remaining`;
  };

  const mapActions = (policy: PolicyRecord): string[] => {
    const requirements = policy.requirements || [];
    if (requirements.length > 0) return requirements.slice(0, 3);
    const steps = policy.steps || [];
    return steps
      .map((step) => String(step?.title || step?.description || '').trim())
      .filter(Boolean)
      .slice(0, 3);
  };

  return policies
    .map((policy) => ({
      id: policy.id,
      title: policy.short_name || policy.name,
      deadline: formatDeadline(policy),
      urgency: getUrgency(policy),
      description:
        policy.match_reason ||
        policy.description ||
        policy.authority ||
        `Policy category: ${policy.category || 'general'}`,
      actions: mapActions(policy),
      status: getStatus(policy),
    }))
    .sort((left, right) => {
      const rank = { critical: 0, urgent: 1, warning: 2, info: 3 } as const;
      return rank[left.urgency] - rank[right.urgency] || left.title.localeCompare(right.title);
    });
};

/**
 * Fetch funding opportunities
 */
export const getFundingOpportunities = async (): Promise<FundingOpportunity[]> => {
  // TODO: Replace with actual API call
  // const response = await fetch('/api/policy/funding');
  // if (!response.ok) throw new Error('Failed to fetch funding opportunities');
  // return response.json();

  // Mock data for now
  await new Promise((resolve) => setTimeout(resolve, 600));

  return [
    {
      id: '1',
      title: 'DOE Clean Energy Grant',
      amount: '₹6.2M – ₹8.6M',
      eligibility: 'Manufacturing sector with emissions > 500 tCO₂',
      deadline: 'Application deadline: June 30, 2026',
      description: 'Funding for renewable energy transition and carbon capture technologies.',
      ccus: true,
    },
    {
      id: '2',
      title: 'Private Offset Fund',
      amount: 'Post-KYC Evaluation',
      eligibility: 'Verified carbon reduction projects',
      deadline: 'Rolling applications',
      description: 'Private sector funding for tree planting and offset initiatives.',
      ccus: false,
    },
  ];
};

/**
 * Update policy alert status
 */
export const updatePolicyStatus = async (
  id: string,
  status: PolicyAlert['status']
): Promise<void> => {
  // TODO: Replace with actual API call
  // const response = await fetch(`/api/policy/alerts/${id}`, {
  //   method: 'PATCH',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ status }),
  // });
  // if (!response.ok) throw new Error('Failed to update policy status');

  // Mock API call
  await new Promise((resolve) => setTimeout(resolve, 500));
};
