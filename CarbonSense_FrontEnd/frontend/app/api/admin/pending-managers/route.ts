/**
 * GET/PATCH /api/admin/pending-managers
 * Endpoint for Platform Admins to review and approve/reject manager sign-ups.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { requireAuthContext } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['admin'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select(`
        id,
        email,
        role,
        first_name,
        last_name,
        phone,
        job_title,
        approval_status,
        reviewer_notes,
        approval_reviewed_at,
        organization_id,
        created_at
      `)
      .eq('role', 'manager')
      .in('approval_status', ['pending', 'rejected'])
      .order('created_at', { ascending: false });

    if (profileError) {
      console.error('[pending-managers GET] Supabase error:', profileError);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const orgIds = (profiles || []).map((p) => p.organization_id).filter(Boolean);
    const orgMap: Record<string, any> = {};

    if (orgIds.length > 0) {
      const { data: orgsData } = await supabaseAdmin
        .from('organizations')
        .select('id, name, sector, company_size_category, state, business_description')
        .in('id', orgIds);

      (orgsData || []).forEach((o) => {
        orgMap[o.id] = o;
      });
    }

    const managers = (profiles || []).map((p) => ({
      ...p,
      organizations: p.organization_id ? (orgMap[p.organization_id] || null) : null,
    }));

    return NextResponse.json({ success: true, managers });
  } catch (err) {
    console.error('[pending-managers GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['admin'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status });
    }

    const body = await req.json();
    const { managerId, action, reviewerNotes } = body;

    if (!managerId || !action) {
      return NextResponse.json(
        { error: 'managerId and action (approve|reject) are required.' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "approve" or "reject".' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const isApprove = action === 'approve';
    const status = isApprove ? 'approved' : 'rejected';
    const now = new Date().toISOString();

    // 1. Update user_profiles.approval_status and audit trail fields
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({
        approval_status: status,
        reviewer_notes: reviewerNotes ?? null,
        approval_reviewed_at: now,
        approval_reviewed_by: auth.context.userId,
        updated_at: now,
      })
      .eq('id', managerId);

    if (profileError) {
      console.error('[pending-managers PATCH] Profile update error:', profileError);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // 2. Keep JWT user_metadata aligned for AuthProvider check (preserving other metadata)
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(managerId);
    const existingMeta = userData?.user?.user_metadata || {};

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(managerId, {
      user_metadata: {
        ...existingMeta,
        role: 'manager',
        approval_status: status,
      },
    });

    if (authError) {
      console.error('[pending-managers PATCH] Auth metadata update error:', authError);
    }

    // 3. Update organization profile_status to complete if manager is approved
    const { data: managerProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('organization_id')
      .eq('id', managerId)
      .maybeSingle();

    if (managerProfile?.organization_id) {
      await supabaseAdmin
        .from('organizations')
        .update({
          profile_status: isApprove ? 'complete' : 'partial',
          updated_at: now,
        })
        .eq('id', managerProfile.organization_id);
    }

    return NextResponse.json({
      success: true,
      message: isApprove
        ? 'Manager account approved successfully.'
        : 'Manager account rejected.',
    });
  } catch (err) {
    console.error('[pending-managers PATCH] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
