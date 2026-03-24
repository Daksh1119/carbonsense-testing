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
    computed_rows?: UploadRow[];
  };
  entries?: ManualEntry[];
};

function normalizeCategory(value?: string): string {
  const category = String(value || "purchases").toLowerCase();
  const allowed = ["transport", "energy", "food", "waste", "purchases"];
  return allowed.includes(category) ? category : "purchases";
}

function getFactorMap() {
  return new Map(
    [...transportFactors, ...energyFactors, ...wasteFactors, ...purchasesFactors].map((factor) => [
      factor.value,
      factor.factorKgPerUnit,
    ])
  );
}

function computeCo2Kg(row: UploadRow, factorMap: Map<string, number>): number {
  const activityKey = String(row.activity_type || "").toLowerCase();
  const factor = factorMap.get(activityKey);
  if (factor === undefined) {
    return 0;
  }
  return Number(row.quantity || 0) * factor;
}

function parseISODate(value?: string): Date {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

function getPeriodFromRows(rows: UploadRow[]): { periodStart: string; periodEnd: string } {
  const dates = rows.map((row) => parseISODate(row.date));
  const latest = dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : new Date();
  const periodStart = new Date(latest.getFullYear(), latest.getMonth(), 1);
  const periodEnd = new Date(latest.getFullYear(), latest.getMonth() + 1, 0);

  return {
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
  };
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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
    emissions_kg_co2e: computeCo2Kg(row, factorMap),
  }));
  const computedTotalKg = computedRows.reduce(
    (sum, row) => sum + Number(row.emissions_kg_co2e || 0),
    0
  );
  const periodSource = sourceType === "manual"
    ? entries.map((entry) => ({ date: entry.entry_date }))
    : computedRows;
  const { periodStart, periodEnd } = getPeriodFromRows(periodSource);

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
      organization_id: payload.organizationId,
      uploaded_by: payload.userId,
      source_type: sourceType,
      original_file_name: uploadMeta.name,
      file_sha256: uploadMeta.sha256,
      file_size_bytes: uploadMeta.size,
      mime_type: uploadMeta.type || "text/csv",
      upload_status: "processed",
      parse_status: "parsed",
      row_count: sourceType === "manual" ? entries.length : rows.length,
      period_start: periodStart,
      period_end: periodEnd,
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
    return NextResponse.json(
      { detail: uploadError?.message || "Failed to store upload metadata" },
      { status: 500 }
    );
  }

  const entryPayload = sourceType === "manual"
    ? entries.map((entry) => ({
        organization_id: payload.organizationId,
        upload_id: upload.id,
        uploaded_by: payload.userId,
        entry_date: parseISODate(entry.entry_date).toISOString().slice(0, 10),
        category: normalizeCategory(entry.category),
        activity: String(entry.activity || "Manual Entry"),
        amount: Number(entry.amount || 0),
        unit: String(entry.unit || ""),
        co2_kg: Number(entry.co2_kg || 0),
      }))
    : computedRows.map((row) => ({
        organization_id: payload.organizationId,
        upload_id: upload.id,
        uploaded_by: payload.userId,
        entry_date: parseISODate(row.date).toISOString().slice(0, 10),
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

  return NextResponse.json(upload, { status: 200 });
}

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get("organizationId");

  if (!organizationId) {
    return NextResponse.json({ detail: "Missing organizationId" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server config error";
    return NextResponse.json({ detail: message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("organization_uploads")
    .select(
      "id, organization_id, uploaded_by, source_type, original_file_name, created_at, period_start, period_end, total_emissions_kg, total_emissions_tco2e, record_count"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ detail: error.message || "Failed to load uploads" }, { status: 500 });
  }

  return NextResponse.json(data || [], { status: 200 });
}
