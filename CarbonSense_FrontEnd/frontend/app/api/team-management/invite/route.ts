/**
 * POST /api/team-management/invite
 * Manager or Admin creates an invite for a team member (viewer or manager).
 * Inserts into manager_invites and employee_signup_requests, then sends
 * an invitation email via Gmail SMTP (or Resend fallback).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { requireAuthContext } from '@/lib/serverAuth';
import { sendInviteEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['manager', 'admin'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const body = await req.json();
    const {
      email,
      role = 'viewer',
      firstName = '',
      lastName = '',
      department = '',
      jobTitle = '',
      organizationId: customOrgId,
    } = body as {
      email?: string;
      role?: 'manager' | 'viewer';
      firstName?: string;
      lastName?: string;
      department?: string;
      jobTitle?: string;
      organizationId?: string;
    };

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const targetOrgId = auth.context.role === 'admin' && customOrgId ? customOrgId : auth.context.organizationId;

    if (!targetOrgId) {
      return NextResponse.json({ error: 'Organization not found for current user.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check if user is already an active member in user_profiles
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('id, email, role, organization_id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUser && existingUser.organization_id === targetOrgId) {
      return NextResponse.json(
        { error: `User with email ${normalizedEmail} is already a member of this organization.` },
        { status: 409 }
      );
    }

    // Get organization details
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', targetOrgId)
      .maybeSingle();

    const orgName = org?.name ?? 'Your Organization';

    // Get inviter details
    const { data: inviterProfile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, email')
      .eq('id', auth.context.userId)
      .maybeSingle();

    const inviterName =
      inviterProfile?.first_name && inviterProfile?.last_name
        ? `${inviterProfile.first_name} ${inviterProfile.last_name}`
        : inviterProfile?.email ?? auth.context.email;

    const notesObj = {
      firstName,
      lastName,
      department,
      jobTitle,
      invitedByEmail: auth.context.email,
    };
    const notesStr = JSON.stringify(notesObj);

    // Check if there is already a pending invite in manager_invites
    const { data: existingInvite } = await supabase
      .from('manager_invites')
      .select('id, status, expires_at')
      .eq('email', normalizedEmail)
      .eq('organization_id', targetOrgId)
      .eq('status', 'pending')
      .maybeSingle();

    let inviteRecord;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (existingInvite) {
      // Update existing invite
      const { data: updated, error: updateError } = await supabase
        .from('manager_invites')
        .update({
          role,
          notes: notesStr,
          expires_at: expiresAt,
          invited_by: auth.context.userId,
        })
        .eq('id', existingInvite.id)
        .select('id, token, email, role, expires_at')
        .single();

      if (updateError || !updated) {
        console.error('[invite] Update existing invite error:', updateError);
        return NextResponse.json({ error: 'Failed to update existing invite.' }, { status: 500 });
      }
      inviteRecord = updated;
    } else {
      // Insert new invite
      const { data: inserted, error: insertError } = await supabase
        .from('manager_invites')
        .insert({
          organization_id: targetOrgId,
          invited_by: auth.context.userId,
          email: normalizedEmail,
          role,
          notes: notesStr,
          expires_at: expiresAt,
        })
        .select('id, token, email, role, expires_at')
        .single();

      if (insertError || !inserted) {
        console.error('[invite] Insert invite error:', insertError);
        return NextResponse.json({ error: insertError?.message ?? 'Failed to create invite.' }, { status: 500 });
      }
      inviteRecord = inserted;
    }

    // Also insert or update employee_signup_requests for tracking
    try {
      await supabase.from('employee_signup_requests').insert({
        organization_name: orgName,
        manager_email: auth.context.email,
        status: 'pending',
        form_data: {
          firstName,
          lastName,
          jobTitle: jobTitle || null,
          department: department || null,
          organizationId: targetOrgId,
          organizationName: orgName,
          managerEmail: auth.context.email,
          role,
          invitedEmail: normalizedEmail,
        },
      });
    } catch (reqErr) {
      console.warn('[invite] employee_signup_requests insert notice:', reqErr);
    }

    // Send invitation email via Gmail SMTP / Resend
    let emailSent = false;
    try {
      await sendInviteEmail({
        toEmail: inviteRecord.email,
        role: inviteRecord.role,
        organizationName: orgName,
        invitedByName: inviterName,
        expiresAt: inviteRecord.expires_at,
      });
      emailSent = true;
      console.log(`[invite] Email successfully sent to ${inviteRecord.email}`);
    } catch (mailErr) {
      console.error('[invite] Email dispatch error:', mailErr);
    }

    const signupPath = inviteRecord.role === 'manager' ? '/signup/manager' : '/signup/employee';
    const signupUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}${signupPath}?email=${encodeURIComponent(normalizedEmail)}`;

    return NextResponse.json({
      success: true,
      emailSent,
      message: emailSent
        ? `Invitation email sent to ${normalizedEmail} successfully.`
        : `Invite created for ${normalizedEmail}. Email delivery will be attempted.`,
      invite: {
        id: inviteRecord.id,
        email: inviteRecord.email,
        role: inviteRecord.role,
        organizationName: orgName,
        expiresAt: inviteRecord.expires_at,
        signupUrl,
      },
    });
  } catch (err) {
    console.error('[invite] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
