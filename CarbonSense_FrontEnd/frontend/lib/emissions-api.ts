
export interface EmissionsUploadRecord {
  id: string;
  organization_id: string;
  uploaded_by: string;
  source_type: string;
  file_format?: "csv" | "tsv" | "json" | "xlsx" | "xls" | "manual" | "other";
  original_file_name: string;
  created_at: string;
  period_start: string | null;
  period_end: string | null;
  total_emissions_kg: number | null;
  total_emissions_tco2e: number | null;
  record_count: number | null;
}

export function getUploadDisplayType(upload: Pick<EmissionsUploadRecord, "file_format" | "source_type" | "original_file_name">): string {
  if (upload.file_format) return String(upload.file_format).toUpperCase();
  if (String(upload.source_type || "").toLowerCase() === "manual") return "MANUAL";

  const fileName = String(upload.original_file_name || "").toLowerCase();
  if (fileName.endsWith(".csv")) return "CSV";
  if (fileName.endsWith(".tsv")) return "TSV";
  if (fileName.endsWith(".json")) return "JSON";
  if (fileName.endsWith(".xlsx")) return "XLSX";
  if (fileName.endsWith(".xls")) return "XLS";

  return "DATA";
}

export interface EmissionEntryRecord {
  id: string;
  upload_id: string;
  organization_id: string;
  uploaded_by: string;
  entry_date: string;
  category: string;
  activity: string;
  amount: number;
  unit: string;
  co2_kg: number;
  created_at: string;
}

export interface EmissionsUploadTotals {
  total_emissions_kg: number;
  total_emissions_tco2e: number;
  record_count: number;
}

const apiBaseUrl = "";

export async function computeFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface PersistCsvUploadInput {
  organizationId: string;
  userId: string;
  file: File;
  summary: {
    totals?: { total_kg_co2e?: number; total_tco2e?: number; records_processed?: number };
    computed_rows?: Array<{
      record_id?: string;
      date?: string;
      category?: string;
      activity_type?: string;
      quantity?: number;
      unit?: string;
      emissions_kg_co2e?: number;
    }>;
  };
}

export interface ManualEntryInput {
  category: string;
  activity: string;
  amount: number;
  unit: string;
  entry_date: string;
  co2_kg: number;
}

export interface PersistManualEntriesInput {
  organizationId: string;
  userId: string;
  entries: ManualEntryInput[];
}

export async function persistCsvUpload(input: PersistCsvUploadInput): Promise<EmissionsUploadRecord> {
  const fileSha = await computeFileSha256(input.file);

  const response = await fetch(`${apiBaseUrl}/api/emissions/uploads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      organizationId: input.organizationId,
      userId: input.userId,
      file: {
        name: input.file.name,
        size: input.file.size,
        type: input.file.type || "text/csv",
        sha256: fileSha,
      },
      summary: input.summary,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "Failed to store upload metadata.");
  }

  return response.json();
}

export async function persistManualEntries(
  input: PersistManualEntriesInput
): Promise<EmissionsUploadRecord> {
  const response = await fetch(`${apiBaseUrl}/api/emissions/uploads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      organizationId: input.organizationId,
      userId: input.userId,
      sourceType: "manual",
      entries: input.entries,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "Failed to store manual entries.");
  }

  return response.json();
}

export async function fetchEmissionsUploads(organizationId: string): Promise<EmissionsUploadRecord[]> {
  const response = await fetch(`${apiBaseUrl}/api/emissions/uploads?organizationId=${encodeURIComponent(organizationId)}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "Failed to load uploads.");
  }

  return response.json();
}

export async function fetchEmissionsUploadsScoped(params: {
  organizationId?: string;
  userId?: string;
}): Promise<EmissionsUploadRecord[]> {
  const query = new URLSearchParams();
  if (params.organizationId) query.set("organizationId", params.organizationId);
  if (params.userId) query.set("userId", params.userId);

  const response = await fetch(`${apiBaseUrl}/api/emissions/uploads?${query.toString()}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "Failed to load uploads.");
  }

  return response.json();
}

export async function fetchEmissionsForUpload(
  organizationId: string,
  uploadId: string,
  userId?: string
): Promise<EmissionEntryRecord[]> {
  const query = new URLSearchParams();
  query.set("organizationId", organizationId);
  if (userId) query.set("userId", userId);

  const response = await fetch(
    `${apiBaseUrl}/api/emissions/uploads/${uploadId}?${query.toString()}`
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "Failed to load emission entries.");
  }

  return response.json();
}

export async function deleteEmissionsUpload(
  organizationId: string,
  uploadId: string,
  userId?: string
): Promise<{ deleted_upload_id: string; deleted_file_name: string; cascade_deleted_emission_entries: boolean }> {
  const query = new URLSearchParams();
  query.set("organizationId", organizationId);
  if (userId) query.set("userId", userId);

  const response = await fetch(
    `${apiBaseUrl}/api/emissions/uploads/${uploadId}?${query.toString()}`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "Failed to delete upload.");
  }

  return response.json();
}

export async function fetchEmissionEntry(
  organizationId: string,
  entryId: string
): Promise<EmissionEntryRecord> {
  const response = await fetch(
    `${apiBaseUrl}/api/emissions/entries/${entryId}?organizationId=${organizationId}`
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "Failed to load emission entry.");
  }

  return response.json();
}

export interface UpdateEmissionEntryInput {
  entry_date?: string;
  category?: string;
  activity?: string;
  amount?: number;
  unit?: string;
  co2_kg?: number;
}

export async function updateEmissionEntry(
  organizationId: string,
  entryId: string,
  payload: UpdateEmissionEntryInput
): Promise<{ entry: EmissionEntryRecord; uploadTotals: EmissionsUploadTotals }> {
  const response = await fetch(`${apiBaseUrl}/api/emissions/entries/${entryId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ organizationId, entry: payload }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "Failed to update emission entry.");
  }

  return response.json();
}

export async function deleteEmissionEntry(
  organizationId: string,
  entryId: string
): Promise<{ deletedId: string; uploadTotals: EmissionsUploadTotals }> {
  const response = await fetch(
    `${apiBaseUrl}/api/emissions/entries/${entryId}?organizationId=${organizationId}`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "Failed to delete emission entry.");
  }

  return response.json();
}
