import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  transportFactors,
  energyFactors,
  wasteFactors,
  purchasesFactors,
} from "@/lib/emissions-factors";

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

export async function GET(req: NextRequest, { params }: { params: { uploadId: string } }) {
  const uploadId = params.uploadId;
  const organizationId = req.nextUrl.searchParams.get("organizationId");

  if (!uploadId || !organizationId) {
    return NextResponse.json({ detail: "Missing uploadId or organizationId" }, { status: 400 });
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
    .select(
      "id, upload_id, organization_id, uploaded_by, entry_date, category, activity, amount, unit, co2_kg, created_at"
    )
    .eq("organization_id", organizationId)
    .eq("upload_id", uploadId)
    .order("entry_date", { ascending: false });

  if (error) {
    return NextResponse.json({ detail: error.message || "Failed to load emission entries" }, { status: 500 });
  }

  const factorMap = getFactorMap();
  const computed = (data || []).map((entry) => ({
    ...entry,
    co2_kg: computeCo2Kg(entry.activity, Number(entry.amount || 0), factorMap),
  }));

  return NextResponse.json(computed, { status: 200 });
}
