/**
 * CarbonSense - TypeScript Type Definitions
 * Centralized type definitions for the entire application
 */

// ==================== User & Authentication ====================

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'member' | 'viewer';
  organization?: string;
  organizationId?: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

// ==================== Emissions ====================

export type EmissionCategory = 'transport' | 'energy' | 'food' | 'waste' | 'purchases';

export interface EmissionEntry {
  id: string;
  date: string;
  category: EmissionCategory;
  activity: string;
  amount: number;
  unit: string;
  co2Amount: number; // kg CO2e
  createdAt: string;
  updatedAt?: string;
}

export interface EmissionSummary {
  totalEmissions: number; // tCO2e
  byCategory: {
    category: EmissionCategory;
    amount: number;
  }[];
  trend: {
    value: number;
    isPositive: boolean;
  };
}

// ==================== Dashboard ====================

export interface DashboardMetrics {
  totalEmissions: number;
  reductionAchieved: number;
  timeDebtStatus: string;
  policyAlerts: number;
  carbonPath: {
    date: string;
    historical?: number;
    projected?: number;
  }[];
  strategies: {
    name: string;
    impact: number;
    certainty: number;
  }[];
}

// ==================== TEME (Tree Engine) ====================

export interface TreeSpecies {
  id: string;
  name: string;
  scientificName: string;
  survivalRate: number; // percentage
  costPerSapling: number; // INR
  avgAbsorptionPerYear: number; // kg CO2/year
  timeToMaturity: number; // years
  pros: string[];
  cons: string[];
}

export interface PlantingRecord {
  id: string;
  speciesId: string;
  quantity: number;
  location: string;
  plantedDate: string;
  expectedOffsetDate: string;
  status: 'planned' | 'in-progress' | 'completed';
}

// ==================== Policy ====================

export type PolicyUrgency = 'high' | 'medium' | 'low';

export interface Policy {
  id: string;
  title: string;
  description: string;
  urgency: PolicyUrgency;
  sectors: string[];
  deadline: string;
  actions: string[];
  source?: string;
  createdAt: string;
}

export interface PolicyAlert extends Policy {
  isRead: boolean;
  affectsOrganization: boolean;
}

// ==================== Recommendations ====================

export type RecommendationType = 'reduction' | 'offset';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  type: RecommendationType;
  impact: number; // kg CO2e
  cost: number; // INR
  difficulty: DifficultyLevel;
  certainty: number; // percentage
  timeline: string;
  category: EmissionCategory;
}

// ==================== Notifications ====================

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  actionUrl?: string;
}

// ==================== Team & Permissions ====================

export type UserRole = 'admin' | 'manager' | 'member' | 'viewer';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  joinedDate: string;
  lastActive: string;
  status: 'active' | 'inactive' | 'pending';
}

export interface Permission {
  resource: string;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
}

// ==================== Analytics ====================

export interface TimeSeriesData {
  date: string;
  value: number;
}

export interface CategoryBreakdown {
  category: string;
  value: number;
  percentage: number;
  color: string;
}

export interface ForecastData {
  date: string;
  value: number;
  confidence: number; // percentage
  lower: number;
  upper: number;
}

// ==================== Settings ====================

export interface OrganizationSettings {
  id: string;
  name: string;
  industry: string;
  size: string;
  country: string;
  timezone: string;
  fiscalYearStart: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  defaultView: string;
}

// ==================== API Response Types ====================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==================== Form Types ====================

export interface FormFieldError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: FormFieldError[];
}

// ==================== Chart Types ====================

export interface ChartConfig {
  title: string;
  description?: string;
  dataKey: string;
  xAxisKey: string;
  yAxisKey: string;
  colors: string[];
}

// ==================== File Upload ====================

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface FileUploadConfig {
  maxSize: number; // bytes
  allowedTypes: string[];
  multiple: boolean;
}

// ==================== Compliance ====================

export type ComplianceStatus = 'compliant' | 'pending' | 'non-compliant' | 'at-risk';

export interface ComplianceItem {
  id: string;
  policyId: string;
  title: string;
  status: ComplianceStatus;
  deadline: string;
  assignedTo: string;
  completedAt?: string;
  notes?: string;
}

// ==================== Data Ingestion ====================

export type DataSource = 'manual' | 'csv' | 'api' | 'ocr' | 'bank-statement';

export interface DataIngestionRecord {
  id: string;
  source: DataSource;
  fileName?: string;
  recordCount: number;
  successCount: number;
  failedCount: number;
  status: 'processing' | 'completed' | 'failed';
  uploadedAt: string;
  processedAt?: string;
  errors?: string[];
}

// ==================== Utility Types ====================

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export type SortOrder = 'asc' | 'desc';

export interface SortConfig {
  key: string;
  order: SortOrder;
}

export interface FilterConfig {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between';
  value: any;
}
