import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import {
  transportFactors,
  energyFactors,
  wasteFactors,
  purchasesFactors,
} from "@/lib/emissions-factors";

type UploadRow = {
  record_id?: string;
  date?: string;
  category?: string;
  source_category?: string;
  activity_type?: string;
  quantity?: number;
  unit?: string;
  emissions_kg_co2e?: number;
};

type ManualEntry = {
  category: string;
  activity: string;
  amount: number;
  unit: string;
  entry_date: string;
  co2_kg: number;
};

type UploadPayload = {
  organizationId: string;
  userId: string;
  sourceType?: "csv" | "manual";
  file?: {
    name: string;
    size: number;
    type?: string;
    sha256: string;
  };
  summary?: {
    totals?: {
      total_kg_co2e?: number;
      total_tco2e?: number;
      records_processed?: number;
    };
    period_start?: string;
    period_end?: string;
    computed_rows?: UploadRow[];
  };
  entries?: ManualEntry[];
};

function inferFileFormat(
  sourceType?: string,
  fileName?: string,
  mimeType?: string
): "csv" | "tsv" | "json" | "xlsx" | "xls" | "manual" | "other" {
  const normalizedSource = String(sourceType || "").toLowerCase();
  if (normalizedSource === "manual") return "manual";

  const name = String(fileName || "").trim().toLowerCase();
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".tsv")) return "tsv";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".xlsx")) return "xlsx";
  if (name.endsWith(".xls")) return "xls";

  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("csv")) return "csv";
  if (mime.includes("tab-separated")) return "tsv";
  if (mime.includes("json")) return "json";
  if (mime.includes("spreadsheetml")) return "xlsx";
  if (mime.includes("ms-excel")) return "xls";

  return "other";
}

function normalizeCategory(value?: string): string {
  const category = String(value || "purchases").toLowerCase();
  const allowed = ["transport", "energy", "food", "waste", "purchases"];
  return allowed.includes(category) ? category : "purchases";
}

// Emission factors keyed by activity_type as it appears in uploaded CSV/TSV/JSON files.
const CSV_EMISSION_FACTORS: Record<string, number> = {
  electricity_grid_kwh:  0.708,   // Scope 2 — India CEA grid baseline (indicative)
  diesel_liter:          2.68,    // Scope 1 — IPCC/EPA fuel combustion defaults
  petrol_liter:          2.31,    // Scope 1 — IPCC/EPA fuel combustion defaults
  cng_kg:                2.75,    // Scope 1 — IPCC/EPA fuel combustion defaults
  flight_km_economy:     0.15,    // Scope 3 — DEFRA distance-based aviation factors
  rail_km:               0.035,   // Scope 3 — DEFRA rail passenger factors
  bus_km:                0.089,   // Scope 3 — DEFRA bus factors
  landfill_waste_kg:     0.57,    // Scope 3 — EPA WARM/DEFRA waste defaults
  recycled_waste_kg:     0.02,    // Scope 3 — EPA WARM recycling defaults
  paper_kg:              0.94,    // Scope 3 — DEFRA material factor
  hotel_night:           15.0,    // Scope 3 — Hotel stay intensity benchmark
  purchased_goods_inr:   0.0005,  // Scope 3 — Spend-based EEIO placeholder for INR
};

function getFactorMap(): Map<string, number> {
  return new Map(
    [...transportFactors, ...energyFactors, ...wasteFactors, ...purchasesFactors].map((factor) => [
      factor.value,
      factor.factorKgPerUnit,
    ])
  );
}

function computeCo2Kg(row: UploadRow, factorMap?: Map<string, number>): number {
  const activityKey = String(row.activity_type || "").toLowerCase().trim();
  const directFactor = CSV_EMISSION_FACTORS[activityKey];
  if (directFactor !== undefined) {
    return Number(row.quantity || 0) * directFactor;
  }
  if (factorMap) {
    const factor = factorMap.get(activityKey);
    if (factor !== undefined) {
      return Number(row.quantity || 0) * factor;
    }
  }
  return 0;
}

function parseFlexibleDate(value?: string): Date | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const isoLike = raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (isoLike) {
    const year = Number(isoLike[1]);
    const month = Number(isoLike[2]);
    const day = Number(isoLike[3]);
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const dmyLike = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (dmyLike) {
    const day = Number(dmyLike[1]);
    const month = Number(dmyLike[2]);
    const year = Number(dmyLike[3]);
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function parseDateOrToday(value?: string): Date {
  return parseFlexibleDate(value) || new Date();
}

function toDateOnlyString(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPeriodFromRows(rows: UploadRow[]): { periodStart: string; periodEnd: string } {
  const dates = rows
    .map((row) => parseFlexibleDate(row.date))
    .filter((item): item is Date => item instanceof Date);

  if (dates.length === 0) {
    const today = new Date();
    return {
      periodStart: toDateOnlyString(today),
      periodEnd: toDateOnlyString(today),
    };
  }

  const earliest = dates.reduce((a, b) => (a < b ? a : b));
  const latest = dates.reduce((a, b) => (a > b ? a : b));

  return {
    periodStart: toDateOnlyString(earliest),
    periodEnd: toDateOnlyString(latest),
  };
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function isUuid(value?: string | null): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function resolveUuid(inputValue: string | undefined): string | null {
  const raw = String(inputValue || "").trim();
  if (isUuid(raw)) return raw;
  return null;
}

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isDuplicateUploadError(message?: string): boolean {
  const text = String(message || "").toLowerCase();
  return text.includes("duplicate key value violates unique constraint");
}

function isNetworkError(message?: string): boolean {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("enotfound") ||
    text.includes("fetch failed") ||
    text.includes("network error") ||
    text.includes("econnrefused") ||
    text.includes("etimedout")
  );
}

export async function POST(req: NextRequest) {
  let payload: UploadPayload;

  try {
    payload = (await req.json()) as UploadPayload;
  } catch {
    return NextResponse.json({ detail: "Invalid JSON payload" }, { status: 400 });
  }

  if (!payload?.organizationId || !payload?.userId) {
    return NextResponse.json({ detail: "Missing organizationId or userId" }, { status: 400 });
  }

  const resolvedOrganizationId = resolveUuid(payload.organizationId);
  const resolvedUserId = resolveUuid(payload.userId);

  if (!resolvedOrganizationId || !resolvedUserId) {
    return NextResponse.json(
      {
        detail: "organizationId and userId must be valid UUIDs.",
      },
      { status: 400 }
    );
  }

  const sourceType = payload.sourceType || "csv";
  const rows = payload.summary?.computed_rows || [];
  const entries = payload.entries || [];

  if (sourceType === "csv" && !payload.file?.name) {
    return NextResponse.json({ detail: "Missing file metadata" }, { status: 400 });
  }

  if (sourceType === "manual" && entries.length === 0) {
    return NextResponse.json({ detail: "Missing manual entries" }, { status: 400 });
  }

  const totals = payload.summary?.totals || {};
  const factorMap = getFactorMap();
  const computedRows = rows.map((row) => ({
    ...row,
    emissions_kg_co2e: typeof row.emissions_kg_co2e === "number" 
      ? row.emissions_kg_co2e 
      : computeCo2Kg(row, factorMap),
  }));
  const computedTotalKg = computedRows.reduce(
    (sum, row) => sum + Number(row.emissions_kg_co2e || 0),
    0
  );

  if (sourceType === "csv" && computedRows.length === 0) {
    return NextResponse.json(
      {
        detail: "No valid rows found after schema validation. Upload not persisted.",
      },
      { status: 422 }
    );
  }

  const periodSource = sourceType === "manual"
    ? entries.map((entry) => ({ date: entry.entry_date }))
    : computedRows;
  const periodFromRows = getPeriodFromRows(periodSource);
  const periodStart = toDateOnlyString(parseDateOrToday(payload.summary?.period_start));
  const periodEnd = toDateOnlyString(parseDateOrToday(payload.summary?.period_end));
  const resolvedPeriodStart = payload.summary?.period_start ? periodStart : periodFromRows.periodStart;
  const resolvedPeriodEnd = payload.summary?.period_end ? periodEnd : periodFromRows.periodEnd;

  const uploadMeta = payload.file || {
    name: `manual-entry-${Date.now()}.json`,
    size: JSON.stringify(entries).length,
    type: "application/json",
    sha256: crypto.createHash("sha256").update(JSON.stringify(entries)).digest("hex"),
  };

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server config error";
    return NextResponse.json({ detail: message }, { status: 500 });
  }

  const { data: upload, error: uploadError } = await supabase
    .from("organization_uploads")
    .insert({
      organization_id: resolvedOrganizationId,
      uploaded_by: resolvedUserId,
      source_type: sourceType,
      original_file_name: uploadMeta.name,
      file_sha256: uploadMeta.sha256,
      file_size_bytes: uploadMeta.size,
      mime_type: uploadMeta.type || "text/csv",
      upload_status: "processed",
      parse_status: "parsed",
      row_count: sourceType === "manual" ? entries.length : rows.length,
      period_start: resolvedPeriodStart,
      period_end: resolvedPeriodEnd,
      total_emissions_kg: sourceType === "manual"
        ? entries.reduce((sum, entry) => sum + Number(entry.co2_kg || 0), 0)
        : computedTotalKg,
      total_emissions_tco2e: sourceType === "manual"
        ? Number((entries.reduce((sum, entry) => sum + Number(entry.co2_kg || 0), 0) / 1000).toFixed(4))
        : Number((computedTotalKg / 1000).toFixed(4)),
      record_count: sourceType === "manual"
        ? entries.length
        : totals.records_processed ?? computedRows.length,
    })
    .select(
      "id, organization_id, uploaded_by, source_type, original_file_name, created_at, period_start, period_end, total_emissions_kg, total_emissions_tco2e, record_count"
    )
    .single();

  if (uploadError || !upload) {
    if (isDuplicateUploadError(uploadError?.message)) {
      const { data: existingUpload } = await supabase
        .from("organization_uploads")
        .select(
          "id, organization_id, uploaded_by, source_type, original_file_name, created_at, period_start, period_end, total_emissions_kg, total_emissions_tco2e, record_count"
        )
        .eq("organization_id", resolvedOrganizationId)
        .eq("file_sha256", uploadMeta.sha256)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingUpload) {
        return NextResponse.json(
          {
            ...existingUpload,
            file_format: inferFileFormat(existingUpload.source_type, existingUpload.original_file_name, undefined),
            duplicate: true,
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { detail: "This file was already uploaded for this organization.", duplicate: true },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { detail: uploadError?.message || "Failed to store upload metadata" },
      { status: 500 }
    );
  }

  const entryPayload = sourceType === "manual"
    ? entries.map((entry) => ({
        organization_id: resolvedOrganizationId,
        upload_id: upload.id,
        uploaded_by: resolvedUserId,
        entry_date: toDateOnlyString(parseDateOrToday(entry.entry_date)),
        category: normalizeCategory(entry.category),
        activity: String(entry.activity || "Manual Entry"),
        amount: Number(entry.amount || 0),
        unit: String(entry.unit || ""),
        co2_kg: Number(entry.co2_kg || 0),
      }))
    : computedRows.map((row) => ({
      organization_id: resolvedOrganizationId,
        upload_id: upload.id,
      uploaded_by: resolvedUserId,
        entry_date: toDateOnlyString(parseDateOrToday(row.date)),
        category: normalizeCategory(row.category || row.source_category),
        activity: String(row.activity_type || "Uploaded Activity"),
        amount: Number(row.quantity || 0),
        unit: String(row.unit || ""),
        co2_kg: Number(row.emissions_kg_co2e || 0),
      }));

  if (entryPayload.length > 0) {
    const batches = chunkArray(entryPayload, 500);
    for (const batch of batches) {
      const { error: entryError } = await supabase.from("emission_entries").insert(batch);
      if (entryError) {
        return NextResponse.json(
          { detail: entryError.message || "Failed to store emission entries" },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json(
    {
      ...upload,
      file_format: inferFileFormat(sourceType, uploadMeta.name, uploadMeta.type),
    },
    { status: 200 }
  );
}

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get("organizationId");
  const userId = req.nextUrl.searchParams.get("userId");

  if (!organizationId && !userId) {
    return NextResponse.json({ detail: "Missing organizationId or userId" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server config error";
    // Local/demo mode: return an empty list so UI can continue to render.
    if (message.includes("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json({ detail: message }, { status: 500 });
  }

  const hasValidOrganizationId = isUuid(organizationId);
  const hasValidUserId = isUuid(userId);

  // Common local/demo placeholders (e.g. demo-org, userId=1) should not hit UUID columns.
  if (organizationId && !hasValidOrganizationId && userId && !hasValidUserId) {
    return NextResponse.json([], { status: 200 });
  }

  let query = supabase
    .from("organization_uploads")
    .select(
      "id, organization_id, uploaded_by, source_type, original_file_name, created_at, period_start, period_end, total_emissions_kg, total_emissions_tco2e, record_count"
    )
    .order("created_at", { ascending: false });

  if (hasValidOrganizationId) {
    query = query.eq("organization_id", organizationId);
  } else if (hasValidUserId) {
    query = query.eq("uploaded_by", userId);
  } else {
    return NextResponse.json([], { status: 200 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any[] | null = null;
  let error: { message?: string } | null = null;

  try {
    const result = await query;
    data = result.data;
    error = result.error;

    if ((!data || data.length === 0) && hasValidOrganizationId && hasValidUserId) {
      const fallbackResult = await supabase
        .from("organization_uploads")
        .select(
          "id, organization_id, uploaded_by, source_type, original_file_name, created_at, period_start, period_end, total_emissions_kg, total_emissions_tco2e, record_count"
        )
        .eq("uploaded_by", userId)
        .order("created_at", { ascending: false });

      data = fallbackResult.data;
      error = fallbackResult.error;
    }
  } catch (thrownError) {
    // Network-level throw (e.g. ENOTFOUND, fetch failed) — treat as empty dataset.
    const msg = thrownError instanceof Error ? thrownError.message : String(thrownError);
    if (isNetworkError(msg)) {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json({ detail: msg || "Failed to load uploads" }, { status: 500 });
  }

  if (error) {
    // Network/DNS errors mean Supabase is unreachable — return empty list so UI still renders.
    if (isNetworkError(error.message)) {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json({ detail: error.message || "Failed to load uploads" }, { status: 500 });
  }

  // Auto-repair missing or unpopulated period bounds from actual underlying emission_entries
  if (data && data.length > 0) {
    const unpopulatedIds = data
      .filter((row) => !row.period_start || !row.period_end)
      .map((row) => row.id);

    if (unpopulatedIds.length > 0) {
      try {
        const { data: entryDates } = await supabase
          .from("emission_entries")
          .select("upload_id, entry_date")
          .in("upload_id", unpopulatedIds);

        if (entryDates && entryDates.length > 0) {
          const boundsMap = new Map<string, { min: string; max: string }>();
          for (const entry of entryDates) {
            if (!entry.entry_date) continue;
            const current = boundsMap.get(entry.upload_id) || { min: entry.entry_date, max: entry.entry_date };
            if (entry.entry_date < current.min) current.min = entry.entry_date;
            if (entry.entry_date > current.max) current.max = entry.entry_date;
            boundsMap.set(entry.upload_id, current);
          }

          for (const row of data) {
            const bounds = boundsMap.get(row.id);
            if (bounds) {
              row.period_start = bounds.min;
              row.period_end = bounds.max;

              // Persist back to Supabase in background (best-effort, ignore errors)
              void Promise.resolve(
                supabase
                  .from("organization_uploads")
                  .update({ period_start: bounds.min, period_end: bounds.max })
                  .eq("id", row.id)
              ).catch(() => {});
            }
          }
        }
      } catch {
        // Ignore period auto-repair errors — not critical to serve the response.
      }
    }
  }

  const normalized = (data || []).map((row) => ({
    ...row,
    file_format: inferFileFormat(row.source_type, row.original_file_name, undefined),
  }));

  return NextResponse.json(normalized, {
    status: 200,
    headers: {
      // Return cached data instantly; refresh in background after 30s.
      // max-age=30 means fresh for 30s; stale-while-revalidate=60 serves
      // the cached copy for up to 60s more while fetching a new copy.
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
    },
  });
}
