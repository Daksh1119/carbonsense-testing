import { GenerateRecommendationsResponse } from './recommendations-api';

export interface EmissionsSummary {
  formula: string;
  totals: {
    total_kg_co2e: number;
    total_tco2e: number;
    records_processed: number;
    records_rejected: number;
  };
  breakdown: {
    by_category_kg_co2e: Record<string, number>;
    by_scope_kg_co2e: Record<string, number>;
    by_emitter_type_kg_co2e?: Record<string, number>;
    top_employees_kg_co2e: Array<{
      employee_id?: string;
      employee_name?: string;
      emitter_id?: string;
      emitter_name?: string;
      emitter_type?: string;
      department: string;
      emissions_kg_co2e: number;
      records: number;
    }>;
    top_machinery_kg_co2e?: Array<{
      emitter_id: string;
      emitter_name: string;
      emitter_type?: string;
      department: string;
      emissions_kg_co2e: number;
      records: number;
    }>;
    top_facilities_kg_co2e?: Array<{
      emitter_id: string;
      emitter_name: string;
      emitter_type?: string;
      department: string;
      emissions_kg_co2e: number;
      records: number;
    }>;
  };
  kpi_snapshots?: Array<{
    kpi_name: string;
    kpi_value: number;
    kpi_unit?: string;
    period_start?: string;
    period_end?: string;
    meta?: Record<string, unknown>;
  }>;
}

export interface IngestionCalculateResponse {
  formula: string;
  totals: {
    total_kg_co2e: number;
    total_tco2e: number;
    records_processed: number;
    records_rejected: number;
  };
  breakdown: {
    by_category_kg_co2e: Record<string, number>;
    by_scope_kg_co2e: Record<string, number>;
    by_emitter_type_kg_co2e?: Record<string, number>;
    top_employees_kg_co2e: Array<{
      employee_id?: string;
      employee_name?: string;
      emitter_id?: string;
      emitter_name?: string;
      emitter_type?: string;
      department: string;
      emissions_kg_co2e: number;
      records: number;
    }>;
    top_machinery_kg_co2e?: Array<{
      emitter_id: string;
      emitter_name: string;
      emitter_type?: string;
      department: string;
      emissions_kg_co2e: number;
      records: number;
    }>;
    top_facilities_kg_co2e?: Array<{
      emitter_id: string;
      emitter_name: string;
      emitter_type?: string;
      department: string;
      emissions_kg_co2e: number;
      records: number;
    }>;
  };
  kpi_snapshots?: Array<{
    kpi_name: string;
    kpi_value: number;
    kpi_unit?: string;
    period_start?: string;
    period_end?: string;
    meta?: Record<string, unknown>;
  }>;
  computed_rows?: Array<Record<string, unknown>>;
  rejected_rows?: Array<Record<string, unknown>>;
}

export interface IngestionRecommendationsResponse extends IngestionCalculateResponse {
  csv_summary?: IngestionCalculateResponse;
  recommendation_result?: GenerateRecommendationsResponse;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function calculateEmissionsFromCSV(
  csvFile: File,
  _organizationId: string,
  _userId: string
): Promise<EmissionsSummary> {
  const formData = new FormData();
  formData.append('file', csvFile);

  const response = await fetch(
    `${apiUrl}/ingestion/company-csv/calculate`,
    {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type header for multipart/form-data - browser will set it automatically
      },
    }
  );

  if (!response.ok) {
    let message = 'Failed to calculate emissions';
    try {
      const error = await response.json();
      message = error.detail || message;
    } catch {
      const text = await response.text();
      message = text || message;
    }
    throw new Error(message);
  }

  return response.json();
}

export async function generateRecommendationsFromCSV(
  csvFile: File,
  organizationId: string,
  userId: string
): Promise<IngestionRecommendationsResponse> {
  const formData = new FormData();
  formData.append('file', csvFile);
  formData.append('organization_id', organizationId);
  formData.append('user_id', userId);

  const response = await fetch(
    `${apiUrl}/ingestion/company-csv/recommendations`,
    {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type header for multipart/form-data - browser will set it automatically
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to generate recommendations');
  }

  return response.json();
}
