/**
 * Policy API Service
 * Handles all policy-related API calls
 */

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
  // TODO: Replace with actual API call
  // const response = await fetch('/api/policy/alerts');
  // if (!response.ok) throw new Error('Failed to fetch policy alerts');
  // return response.json();

  // Mock data for now
  await new Promise((resolve) => setTimeout(resolve, 600));

  return [
    {
      id: '1',
      title: 'EU CSRD Compliance',
      deadline: '15 days remaining',
      urgency: 'critical',
      description: 'Corporate Sustainability Reporting Directive compliance requirements',
      actions: ['Submit sustainability report', 'Third-party audit', 'Board approval'],
      status: 'pending',
    },
    {
      id: '2',
      title: 'Scope 3 Audit Report',
      deadline: '65 days remaining',
      urgency: 'warning',
      description: 'Annual Scope 3 emissions verification audit',
      actions: ['Collect supply chain data', 'Engage auditor', 'Prepare documentation'],
      status: 'in-progress',
    },
  ];
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
