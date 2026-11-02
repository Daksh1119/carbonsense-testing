import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAuthContext } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthContext(
      ["manager", "admin", "viewer"],
      req.headers.get("authorization")
    );

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { projectName, inputPayload, result, userId: fallbackUserId, organizationId: fallbackOrgId } = body;

    if (!projectName || !result) {
      return NextResponse.json(
        { error: "Missing required fields: projectName and result are required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Determine target user and organization with verified fallback
    let targetUserId = auth.context?.userId || fallbackUserId;
    let targetOrgId = auth.context?.organizationId || fallbackOrgId;

    if (!targetOrgId && targetUserId) {
      const { data: profile } = await supabaseAdmin
        .from("user_profiles")
        .select("organization_id")
        .eq("id", targetUserId)
        .maybeSingle();
      if (profile?.organization_id) {
        targetOrgId = profile.organization_id;
      }
    }

    const emissionKg = Number(inputPayload?.emission_kg ?? result?.emission_kg ?? 0);
    const totalTrees = Number(result?.total_trees ?? 0);
    const timeToNeutralYears = Number(result?.time_to_neutral_years ?? 0);
    const confidenceScore = Number(result?.confidence_score ?? 0.8);
    const landRequiredHectare = Number(result?.land_required_hectare ?? 0);

    const { data: run, error } = await supabaseAdmin
      .from("teme_runs")
      .insert({
        user_id: targetUserId,
        organization_id: targetOrgId,
        project_name: projectName,
        emission_kg: emissionKg,
        input_payload: inputPayload,
        result,
        total_trees: totalTrees,
        time_to_neutral_years: timeToNeutralYears,
        confidence_score: confidenceScore,
        land_required_hectare: landRequiredHectare,
        status: result?.status || "completed",
      })
      .select("*")
      .single();

    if (error) {
      console.error("[api/teme/save] Insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, run }, { status: 201 });
  } catch (err) {
    console.error("[api/teme/save] Unhandled error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
