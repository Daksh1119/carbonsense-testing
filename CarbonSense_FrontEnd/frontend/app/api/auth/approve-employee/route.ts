/**
 * PATCH /api/auth/approve-employee
 * Manager/admin endpoint to approve or reject a pending employee.
 * Updates employee_signup_requests.status and user_profiles.approved.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { requireAuthContext } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['admin', 'manager'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status });
    }

    const body = await req.json();
    const { requestId, action, reviewerNotes } = body;

    if (!requestId || !action) {
      return NextResponse.json(
        { error: 'requestId and action (approve|reject) are required.' },
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
    const approved = action === 'approve';
    const now = new Date().toISOString();

    // Validate request ownership and state before applying mutations.
    const { data: signupRequest, error: signupError } = await supabaseAdmin
      .from('employee_signup_requests')
      .select('id, user_id, manager_email, status')
      .eq('id', requestId)
      .maybeSingle();

    if (signupError || !signupRequest) {
      return NextResponse.json({ error: 'Signup request not found.' }, { status: 404 });
    }

    if (signupRequest.status !== 'pending') {
      return NextResponse.json({ error: 'This signup request has already been reviewed.' }, { status: 409 });
    }

    if (
      auth.context.role === 'manager' &&
      signupRequest.manager_email &&
      signupRequest.manager_email.toLowerCase() !== auth.context.email.toLowerCase()
    ) {
      return NextResponse.json({ error: 'You can only review requests routed to your email.' }, { status: 403 });
    }

    // 1. Update signup request
    const { error: reqError } = await supabaseAdmin
      .from('employee_signup_requests')
      .update({
        status: approved ? 'approved' : 'rejected',
        reviewed_at: now,
        reviewer_notes: reviewerNotes ?? null,
      })
      .eq('id', requestId);

    if (reqError) {
      console.error('[approve-employee] Request update error:', reqError);
      return NextResponse.json({ error: reqError.message }, { status: 500 });
    }

    // 2. Update user_profiles.approved
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({ approved, updated_at: now })
      .eq('id', signupRequest.user_id);

    if (profileError) {
      console.error('[approve-employee] Profile update error:', profileError);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // Keep JWT metadata aligned for fast-path role checks in AuthProvider.
    const { data: profileAfter } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', signupRequest.user_id)
      .maybeSingle();

    await supabaseAdmin.auth.admin.updateUserById(signupRequest.user_id, {
      user_metadata: {
        role: (profileAfter?.role as string | undefined) ?? 'viewer',
        approved,
      },
    });

    return NextResponse.json({
      success: true,
      message: approved
        ? 'Employee approved. They can now log in.'
        : 'Employee request rejected.',
    });
  } catch (err) {
    console.error('[approve-employee] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
