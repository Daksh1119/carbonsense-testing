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


export async function GET(req: NextRequest, { params }: { params: { uploadId: string } }) {
  const uploadId = params.uploadId;
  const organizationId = req.nextUrl.searchParams.get("organizationId");
  const userId = req.nextUrl.searchParams.get("userId");

  if (!uploadId || (!organizationId && !userId)) {
    return NextResponse.json({ detail: "Missing uploadId and organizationId/userId" }, { status: 400 });
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
    .eq("upload_id", uploadId)
    .order("entry_date", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  } else if (userId) {
    query = query.eq("uploaded_by", userId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ detail: error.message || "Failed to load emission entries" }, { status: 500 });
  }

  return NextResponse.json(data || [], { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: { params: { uploadId: string } }) {
  const uploadId = params.uploadId;
  const organizationId = req.nextUrl.searchParams.get("organizationId");
  const userId = req.nextUrl.searchParams.get("userId");

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

  let checkQuery = supabase
    .from("organization_uploads")
    .select("id, organization_id, uploaded_by, source_type, original_file_name")
    .eq("id", uploadId)
    .eq("organization_id", organizationId)
    .limit(1);

  if (userId) {
    checkQuery = checkQuery.eq("uploaded_by", userId);
  }

  const { data: uploadRow, error: checkError } = await checkQuery.maybeSingle();

  if (checkError) {
    return NextResponse.json({ detail: checkError.message || "Failed to validate upload" }, { status: 500 });
  }

  if (!uploadRow) {
    return NextResponse.json({ detail: "Upload not found for this organization/user context" }, { status: 404 });
  }

  // Deleting parent row cascades to emission_entries via FK ON DELETE CASCADE.
  const { error: deleteError } = await supabase
    .from("organization_uploads")
    .delete()
    .eq("id", uploadId)
    .eq("organization_id", organizationId);

  if (deleteError) {
    return NextResponse.json({ detail: deleteError.message || "Failed to delete upload" }, { status: 500 });
  }

  return NextResponse.json(
    {
      deleted_upload_id: uploadId,
      deleted_file_name: uploadRow.original_file_name,
      cascade_deleted_emission_entries: true,
    },
    { status: 200 }
  );
}
