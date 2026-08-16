/**
 * POST /api/onboarding/company-profile
 * Creates or updates an organization profile during manager onboarding.
 * Uses getSupabaseAdmin() to safely insert/update organizations table,
 * link user_profiles, and sync Supabase Auth metadata without RLS policy violations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { requireAuthContext } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['manager', 'admin'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const body = await req.json();
    const { patch } = body as { patch?: Record<string, any> };

    if (!patch) {
      return NextResponse.json({ error: 'patch payload is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const userId = auth.context.userId;

    // Fetch caller's user profile including current approval_status and reviewer_notes
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id, role, email, approval_status, reviewer_notes')
      .eq('id', userId)
      .maybeSingle();

    let orgId = profile?.organization_id ?? null;
    const now = new Date().toISOString();

    // Preserve 'approved' status if already approved; only default to 'pending' for fresh signups
    const approvalStatusToSet = profile?.approval_status === 'approved' ? 'approved' : 'pending';

    // Extract phone from patch if present so we don't save user phone to organizations table
    const phone = patch.phone;
    delete patch.phone;

    if (!orgId) {
      // 1. Create new organization
      const { data: newOrg, error: createErr } = await supabase
        .from('organizations')
        .insert({
          ...patch,
        })
        .select('id, name')
        .single();

      if (createErr || !newOrg) {
        console.error('[onboarding company-profile] Create org error:', createErr);
        return NextResponse.json({ error: createErr?.message ?? 'Failed to create organization.' }, { status: 500 });
      }

      orgId = newOrg.id;

      // 2. Link user_profile to new org, set phone and keep existing/pending approval_status
      await supabase
        .from('user_profiles')
        .update({
          organization_id: orgId,
          organization_name: patch.name || newOrg.name,
          phone: phone ?? null,
          approval_status: approvalStatusToSet,
          reviewer_notes: approvalStatusToSet === 'approved' ? profile?.reviewer_notes : null,
          updated_at: now,
        })
        .eq('id', userId);

      // 3. Update Supabase Auth user metadata
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          organization_id: orgId,
          role: profile?.role ?? 'manager',
          approval_status: approvalStatusToSet,
        },
      });
    } else {
      // Update existing organization
      const { error: updateErr } = await supabase
        .from('organizations')
        .update({
          ...patch,
        })
        .eq('id', orgId);

      if (updateErr) {
        console.error('[onboarding company-profile] Update org error:', updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      // Sync name to user_profile, set phone and preserve existing/pending approval_status
      await supabase
        .from('user_profiles')
        .update({
          organization_name: patch.name || undefined,
          phone: phone ?? null,
          approval_status: approvalStatusToSet,
          updated_at: now,
        })
        .eq('id', userId);

      // Update Supabase Auth user metadata
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          organization_id: orgId,
          role: profile?.role ?? 'manager',
          approval_status: approvalStatusToSet,
        },
      });
    }

    return NextResponse.json({
      success: true,
      organizationId: orgId,
      organizationName: patch.name ?? 'Organization',
    });
  } catch (err) {
    console.error('[onboarding company-profile] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
