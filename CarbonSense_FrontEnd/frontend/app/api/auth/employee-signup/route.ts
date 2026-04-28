/**
 * POST /api/auth/employee-signup
 * Receives employee signup form data, creates the Supabase Auth user
 * in pending state, and inserts an employee_signup_requests row.
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

    if (!email || !password || !firstName || !lastName || !managerEmail) {
      return NextResponse.json(
        { error: 'Required fields: email, password, firstName, lastName, managerEmail.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Create the Supabase Auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // requires email confirmation
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: 'viewer',
      },
    });

    if (authError || !authData.user) {
      console.error('[employee-signup] Auth error:', authError);
      // Surface friendly duplicate-email error
      if (authError?.message?.includes('already registered')) {
        return NextResponse.json(
          { error: 'An account with this email already exists.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: authError?.message ?? 'User creation failed.' }, { status: 500 });
    }

    const userId = authData.user.id;

    // 2. Insert user_profile (viewer, not approved)
    await supabaseAdmin.from('user_profiles').insert({
      id: userId,
      email,
      role: 'viewer',
      approved: false,
      first_name: firstName,
      last_name: lastName,
      job_title: jobTitle ?? null,
      department: department ?? null,
      employee_id: employeeId ?? null,
      phone: phone ?? null,
      organization_name: organizationName ?? null,
      organization_id: organizationId ?? null,
    });

    // 3. Insert signup request
    const { data: signupRequest, error: signupInsertError } = await supabaseAdmin
      .from('employee_signup_requests')
      .insert({
      user_id: userId,
      organization_name: organizationName ?? null,
      manager_email: managerEmail,
      status: 'pending',
      form_data: {
        email,
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

    // Optional manager notification hook (Supabase Edge Function / Resend webhook).
    const notificationWebhook = process.env.MANAGER_APPROVAL_WEBHOOK_URL;
    if (notificationWebhook) {
      try {
        await fetch(notificationWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signupRequestId: signupRequest?.id,
            managerEmail,
            employeeEmail: email,
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
      message: 'Registration submitted. Your manager will review and approve your account.',
      userId,
    });
  } catch (err) {
    console.error('[employee-signup] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
