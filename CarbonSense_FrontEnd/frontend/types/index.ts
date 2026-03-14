// Emissions Types
export interface EmissionEntry {
  id: string;
  category: "transport" | "energy" | "food" | "waste" | "purchases";
  activityType: string;
  quantity: number;
  unit: string;
  date: string;
  co2Amount: number;
  scope: 1 | 2 | 3;
}

export interface EmissionsSummary {
  totalEmissions: number;
  monthlyAverage: number;
  yearlyChange: number;
  byCategory: Record<string, number>;
  byScope: Record<number, number>;
}

// TEME (Tree Engine) Types
export interface TreeSpecies {
  id: string;
  name: string;
  scientificName: string;
  survivalRate: number;
  co2PerYear: number;
  timeToOffset: string;
  cost: {
    min: number;
    max: number;
    currency: string;
  };
  pros: string[];
  cons: string[];
  recommended: boolean;
  climateZones: string[];
}

export interface PlantingProject {
  id: string;
  name: string;
  location: string;
  startDate: string;
  totalTrees: number;
  species: string[];
  progress: number;
  status: "active" | "completed" | "planned";
}

export interface TimeDebtData {
  year: string;
  expectedAbsorption: number;
  survivalWeightedAbsorption: number;
  immediateReduction: number;
}

// Policy & Compliance Types
export interface PolicyAlert {
  id: string;
  title: string;
  description: string;
  deadline: string;
  daysRemaining: number;
  urgency: "critical" | "warning" | "info";
  status: "pending" | "in-progress" | "completed";
  requiredActions: string[];
  regulatoryBody: string;
}

export interface FundingOpportunity {
  id: string;
  title: string;
  description: string;
  amount: {
    min?: number;
    max?: number;
    currency: string;
    display: string;
  };
  eligibility: string;
  deadline: string;
  ccusEligible: boolean;
  applicationLink?: string;
}

export interface ComplianceTask {
  id: string;
  title: string;
  deadline: string;
  daysLeft: number;
  status: "overdue" | "in-progress" | "pending" | "completed";
  progress: number;
  priority: "critical" | "high" | "medium" | "low";
}

// Recommendations Types
export interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  certainty: number;
  timeToImpact: string;
  cost: {
    min: number;
    max: number;
    currency: string;
  };
  savings: {
    amount: number;
    unit: string;
    timeframe: string;
  };
  category: string;
  priority: number;
  implementationSteps: string[];
}

// User & Organization Types
export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "member" | "viewer";
  organization?: string;
  organizationId?: string;
  createdAt: string;
  // Optional legacy fields for backwards compatibility
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  avatar?: string;
}

export interface Organization {
  id: string;
  name: string;
  industry: string;
  size: string;
  location: string;
  carbonTarget: {
    percentage: number;
    targetYear: number;
  };
  ccusEligible: boolean;
}

// Analytics Types
export interface AnalyticsData {
  totalEmissions: number;
  monthlyAverage: number;
  highestCategory: string;
  reductionTarget: number;
  categoryBreakdown: {
    category: string;
    value: number;
    percentage: number;
  }[];
  scopeAnalysis: {
    scope: string;
    value: number;
  }[];
  monthlyTrend: {
    month: string;
    emissions: number;
  }[];
}

// Chart Data Types
export interface ChartDataPoint {
  [key: string]: string | number | null;
}

// Notification Types
export interface Notification {
  id: string;
  type: "policy" | "threshold" | "recommendation" | "report";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionLink?: string;
}
