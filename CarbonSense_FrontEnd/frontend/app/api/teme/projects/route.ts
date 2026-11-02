import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAuthContext } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthContext(
      ["manager", "admin", "viewer"],
      req.headers.get("authorization")
    );

    const { searchParams } = new URL(req.url);
    const queryUserId = searchParams.get("userId");
    const queryOrgId = searchParams.get("organizationId");
    const queryStatus = searchParams.get("status");

    const targetUserId = auth.context?.userId || queryUserId;
    const targetOrgId = auth.context?.organizationId || queryOrgId;

    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
      .from("teme_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (queryStatus) {
      query = query.eq("status", queryStatus);
    }

    if (targetOrgId && targetUserId) {
      query = query.or(`organization_id.eq.${targetOrgId},user_id.eq.${targetUserId}`);
    } else if (targetOrgId) {
      query = query.eq("organization_id", targetOrgId);
    } else if (targetUserId) {
      query = query.eq("user_id", targetUserId);
    }

    const { data: projects, error } = await query;

    if (error) {
      console.error("[api/teme/projects] Query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, projects: projects || [] });
  } catch (err) {
    console.error("[api/teme/projects] Unhandled error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
