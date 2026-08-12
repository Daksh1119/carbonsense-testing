import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get("organizationId");
  const userId = req.nextUrl.searchParams.get("userId");
  const uploadIdsRaw = req.nextUrl.searchParams.get("uploadIds");

  if (!organizationId && !userId) {
    return NextResponse.json({ detail: "Missing organizationId or userId" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server config error";
    return NextResponse.json({ detail: message }, { status: 500 });
  }

  let query = supabase
    .from("emission_entries")
    .select(
      "id, upload_id, organization_id, uploaded_by, entry_date, category, activity, amount, unit, co2_kg, created_at"
    )
    .order("entry_date", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  } else if (userId) {
    query = query.eq("uploaded_by", userId);
  }

  if (uploadIdsRaw) {
    const ids = uploadIdsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length > 0) {
      query = query.in("upload_id", ids);
    }
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ detail: error.message || "Failed to load emission entries" }, { status: 500 });
  }

  return NextResponse.json(data || [], { status: 200 });
}
