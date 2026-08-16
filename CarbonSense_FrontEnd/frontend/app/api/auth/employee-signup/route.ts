/**
 * POST /api/auth/employee-signup
 * Receives employee signup form data, creates the Supabase Auth user.
 * Checks manager_invites first — if the email has a pending invite, grants
 * the invited role (manager/viewer) + org automatically (no approval queue).
 * Otherwise creates a viewer in pending state for manager approval.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email,
      password,
      firstName,
      lastName,
      jobTitle,
      department,
      employeeId,
      phone,
      organizationName,
      organizationId,
      country,
      managerEmail,
    } = body;

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Required fields: email, password, firstName, lastName.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const normalizedEmail = email.toLowerCase().trim();

    // ── Invite check ──────────────────────────────────────────────────────────
    // If admin has pre-invited this email, grant the invited role automatically.
    const { data: invite } = await supabaseAdmin
      .from('manager_invites')
      .select('id, organization_id, role')
      .eq('email', normalizedEmail)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const invitedRole = invite?.role ?? null;
    const invitedOrgId = invite?.organization_id ?? organizationId ?? null;

    // 1. Create the Supabase Auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: invitedRole ?? 'viewer',
        organization_id: invitedOrgId,
        approval_status: invitedRole !== null ? 'approved' : 'pending',
      },
    });

    if (authError || !authData.user) {
      console.error('[employee-signup] Auth error:', authError);
      if (authError?.message?.includes('already registered')) {
        return NextResponse.json(
          { error: 'An account with this email already exists.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: authError?.message ?? 'User creation failed.' }, { status: 500 });
    }

    const userId = authData.user.id;
    const now = new Date().toISOString();

    // 2. Insert user_profile
    await supabaseAdmin.from('user_profiles').insert({
      id: userId,
      email: normalizedEmail,
      role: invitedRole ?? 'viewer',
      approval_status: invitedRole !== null ? 'approved' : 'pending',
      first_name: firstName,
      last_name: lastName,
      job_title: jobTitle ?? null,
      department: department ?? null,
      employee_id: employeeId ?? null,
      phone: phone ?? null,
      organization_name: organizationName ?? null,
      organization_id: invitedOrgId,
    });

    // 3a. Invited user → mark invite accepted, skip approval queue
    if (invite) {
      await supabaseAdmin
        .from('manager_invites')
        .update({ status: 'accepted', accepted_at: now })
        .eq('id', invite.id);

      return NextResponse.json({
        success: true,
        invited: true,
        role: invitedRole,
        organizationId: invitedOrgId,
        message: `Welcome! Your ${invitedRole} account is ready. You can log in now.`,
        userId,
      });
    }

    // 3b. Not invited → insert signup request for manager approval (viewer flow)
    if (!managerEmail) {
      return NextResponse.json(
        { error: 'managerEmail is required for self-registration.' },
        { status: 400 }
      );
    }

    const { data: signupRequest, error: signupInsertError } = await supabaseAdmin
      .from('employee_signup_requests')
      .insert({
        user_id: userId,
        organization_name: organizationName ?? null,
        manager_email: managerEmail,
        status: 'pending',
        form_data: {
          email: normalizedEmail,
          firstName, lastName, jobTitle, department,
          employeeId, phone, organizationName,
          organizationId, country, managerEmail,
        },
      })
      .select('id')
      .single();

    if (signupInsertError) {
      console.error('[employee-signup] Signup request insert error:', signupInsertError);
      return NextResponse.json({ error: signupInsertError.message }, { status: 500 });
    }

    const notificationWebhook = process.env.MANAGER_APPROVAL_WEBHOOK_URL;
    if (notificationWebhook) {
      try {
        await fetch(notificationWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signupRequestId: signupRequest?.id,
            managerEmail,
            employeeEmail: normalizedEmail,
            employeeName: `${firstName} ${lastName}`.trim(),
            organizationName: organizationName ?? null,
          }),
        });
      } catch (notifyErr) {
        console.warn('[employee-signup] Manager notification failed:', notifyErr);
      }
    }

    return NextResponse.json({
      success: true,
      invited: false,
      message: 'Registration submitted. Your manager will review and approve your account.',
      userId,
    });
  } catch (err) {
    console.error('[employee-signup] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
