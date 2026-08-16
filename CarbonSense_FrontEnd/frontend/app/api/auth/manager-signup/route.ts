/**
 * POST /api/auth/manager-signup
 * Dedicated API endpoint for Manager Registration & Account Setup.
 * Checks for a pending invite in manager_invites. Grants role: 'manager',
 * links/creates the organization, and sets approved: true.
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
      phone,
      organizationName,
      organizationId,
      country,
      industry,
    } = body;

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Required fields: email, password, firstName, lastName.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const normalizedEmail = email.toLowerCase().trim();

    // Check if there is a pending invite for this email
    const { data: invite } = await supabaseAdmin
      .from('manager_invites')
      .select('id, organization_id, role')
      .eq('email', normalizedEmail)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let targetOrgId = invite?.organization_id ?? organizationId ?? null;

    // If no organization is assigned yet, set up a new organization for this Manager
    if (!targetOrgId) {
      const finalOrgName = organizationName?.trim() || `${firstName}'s Organization`;
      const { data: newOrg, error: orgError } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: finalOrgName,
          profile_status: 'in_progress',
        })
        .select('id')
        .single();

      if (orgError) {
        console.error('[manager-signup] Org creation error:', orgError);
      }

      if (newOrg) {
        targetOrgId = newOrg.id;
      }
    }

    // 1. Create Supabase Auth User as a Manager (pending approval)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: 'manager',
        organization_id: targetOrgId,
        approval_status: 'pending',
      },
    });

    if (authError || !authData.user) {
      console.error('[manager-signup] Auth error:', authError);
      if (authError?.message?.includes('already registered')) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please log in using the Manager portal.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: authError?.message ?? 'User creation failed.' }, { status: 500 });
    }

    const userId = authData.user.id;
    const now = new Date().toISOString();

    // 2. Insert into user_profiles with pending approval_status
    await supabaseAdmin.from('user_profiles').insert({
      id: userId,
      email: normalizedEmail,
      role: 'manager',
      approval_status: 'pending',
      first_name: firstName,
      last_name: lastName,
      job_title: jobTitle ?? null,
      phone: phone ?? null,
      organization_name: organizationName ?? null,
      organization_id: targetOrgId,
    });

    // 3. Mark invite as accepted if an invite row existed
    if (invite) {
      await supabaseAdmin
        .from('manager_invites')
        .update({ status: 'accepted', accepted_at: now })
        .eq('id', invite.id);
    }

    return NextResponse.json({
      success: true,
      message: 'Manager account setup successfully!',
      loginUrl: '/login/manager',
      userId,
    });
  } catch (err) {
    console.error('[manager-signup] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
