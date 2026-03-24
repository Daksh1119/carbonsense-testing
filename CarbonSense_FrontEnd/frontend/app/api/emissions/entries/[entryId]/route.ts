import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  transportFactors,
  energyFactors,
  wasteFactors,
  purchasesFactors,
} from "@/lib/emissions-factors";

type UpdatePayload = {
  organizationId: string;
  entry: {
    entry_date?: string;
    category?: string;
    activity?: string;
    amount?: number;
    unit?: string;
    co2_kg?: number;
  };
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

function computeCo2Kg(activity: string, amount: number, factorMap: Map<string, number>): number {
  const activityKey = String(activity || "").toLowerCase();
  const factor = factorMap.get(activityKey);
  if (factor === undefined) {
    return 0;
  }
  return Number(amount || 0) * factor;
}

function parseISODate(value?: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString().slice(0, 10);
}

function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function computeUploadTotals(supabase: SupabaseClient, uploadId: string) {
  const { data, error } = await supabase
    .from("emission_entries")
    .select("co2_kg")
    .eq("upload_id", uploadId);

  if (error) {
    throw new Error(error.message || "Failed to compute totals");
  }

  const rows = (data || []) as Array<{ co2_kg: number | null }>;
  const totalKg = rows.reduce((sum, row) => sum + Number(row.co2_kg || 0), 0);
  const recordCount = rows.length;

  return {
    total_emissions_kg: totalKg,
    total_emissions_tco2e: Number((totalKg / 1000).toFixed(4)),
    record_count: recordCount,
  };
}

export async function GET(req: NextRequest, { params }: { params: { entryId: string } }) {
  const entryId = params.entryId;
  const organizationId = req.nextUrl.searchParams.get("organizationId");

  if (!entryId || !organizationId) {
    return NextResponse.json({ detail: "Missing entryId or organizationId" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server config error";
    return NextResponse.json({ detail: message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("emission_entries")
    .select("id, upload_id, organization_id, uploaded_by, entry_date, category, activity, amount, unit, co2_kg, created_at")
    .eq("organization_id", organizationId)
    .eq("id", entryId)
    .single();

  if (error || !data) {
    return NextResponse.json({ detail: error?.message || "Entry not found" }, { status: 404 });
  }

  return NextResponse.json(data, { status: 200 });
}

export async function PATCH(req: NextRequest, { params }: { params: { entryId: string } }) {
  const entryId = params.entryId;
  let payload: UpdatePayload;

  try {
    payload = (await req.json()) as UpdatePayload;
  } catch {
    return NextResponse.json({ detail: "Invalid JSON payload" }, { status: 400 });
  }

  if (!entryId || !payload?.organizationId) {
    return NextResponse.json({ detail: "Missing entryId or organizationId" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server config error";
    return NextResponse.json({ detail: message }, { status: 500 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("emission_entries")
    .select("id, upload_id, activity, amount")
    .eq("organization_id", payload.organizationId)
    .eq("id", entryId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ detail: existingError?.message || "Entry not found" }, { status: 404 });
  }

  const updates = payload.entry || {};
  const patch: Record<string, string | number | null> = {};

  if (updates.entry_date) {
    const parsedDate = parseISODate(updates.entry_date);
    if (parsedDate) {
      patch.entry_date = parsedDate;
    }
  }
  if (updates.category) {
    patch.category = normalizeCategory(updates.category);
  }
  if (typeof updates.activity === "string") {
    patch.activity = updates.activity;
  }
  if (typeof updates.amount === "number") {
    patch.amount = updates.amount;
  }
  if (typeof updates.unit === "string") {
    patch.unit = updates.unit;
  }

  const nextActivity = typeof updates.activity === "string" ? updates.activity : existing.activity;
  const nextAmount = typeof updates.amount === "number" ? updates.amount : Number(existing.amount || 0);
  const factorMap = getFactorMap();
  patch.co2_kg = computeCo2Kg(nextActivity, nextAmount, factorMap);

  const { data: updated, error: updateError } = await supabase
    .from("emission_entries")
    .update(patch)
    .eq("id", entryId)
    .eq("organization_id", payload.organizationId)
    .select("id, upload_id, organization_id, uploaded_by, entry_date, category, activity, amount, unit, co2_kg, created_at")
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ detail: updateError?.message || "Failed to update entry" }, { status: 500 });
  }

  let uploadTotals;
  try {
    uploadTotals = await computeUploadTotals(supabase, existing.upload_id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compute totals";
    return NextResponse.json({ detail: message }, { status: 500 });
  }

  const { error: totalsError } = await supabase
    .from("organization_uploads")
    .update(uploadTotals)
    .eq("id", existing.upload_id)
    .eq("organization_id", payload.organizationId);

  if (totalsError) {
    return NextResponse.json({ detail: totalsError.message || "Failed to update totals" }, { status: 500 });
  }

  return NextResponse.json({ entry: updated, uploadTotals }, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: { params: { entryId: string } }) {
  const entryId = params.entryId;
  const organizationId = req.nextUrl.searchParams.get("organizationId");

  if (!entryId || !organizationId) {
    return NextResponse.json({ detail: "Missing entryId or organizationId" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server config error";
    return NextResponse.json({ detail: message }, { status: 500 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("emission_entries")
    .select("id, upload_id")
    .eq("organization_id", organizationId)
    .eq("id", entryId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ detail: existingError?.message || "Entry not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from("emission_entries")
    .delete()
    .eq("id", entryId)
    .eq("organization_id", organizationId);

  if (deleteError) {
    return NextResponse.json({ detail: deleteError.message || "Failed to delete entry" }, { status: 500 });
  }

  let uploadTotals;
  try {
    uploadTotals = await computeUploadTotals(supabase, existing.upload_id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compute totals";
    return NextResponse.json({ detail: message }, { status: 500 });
  }

  const { error: totalsError } = await supabase
    .from("organization_uploads")
    .update(uploadTotals)
    .eq("id", existing.upload_id)
    .eq("organization_id", organizationId);

  if (totalsError) {
    return NextResponse.json({ detail: totalsError.message || "Failed to update totals" }, { status: 500 });
  }

  return NextResponse.json({ deletedId: entryId, uploadTotals }, { status: 200 });
}
