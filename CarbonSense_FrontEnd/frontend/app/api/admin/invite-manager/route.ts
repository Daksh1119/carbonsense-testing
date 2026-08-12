/**
 * POST /api/admin/invite-manager
 * Admin creates an invite for a specific email + org.
 * Inserts a row into manager_invites. When that user signs up,
 * the complete-signup hook picks up the invite and grants the role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { requireAuthContext } from '@/lib/serverAuth';
import { sendInviteEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['admin'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const body = await req.json();
    const { email, organizationId, role = 'manager', notes } = body as {
      email?: string;
      organizationId?: string;
      role?: string;
      notes?: string;
    };

    if (!email) {
      return NextResponse.json({ error: 'email is required.' }, { status: 400 });
    }

    if (!['manager', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'role must be "manager" or "viewer".' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const isNewOrg = !organizationId || organizationId === 'NEW_ORG';
    const targetOrgId = isNewOrg ? null : organizationId;

    // Check if this email already has a pending invite
    let query = supabase
      .from('manager_invites')
      .select('id, status')
      .eq('email', email.toLowerCase().trim())
      .eq('status', 'pending');

    if (targetOrgId) {
      query = query.eq('organization_id', targetOrgId);
    } else {
      query = query.is('organization_id', null);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'A pending invite already exists for this email.' },
        { status: 409 }
      );
    }

    let orgName = 'New Organization (Setup on Signup)';
    if (targetOrgId) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', targetOrgId)
        .maybeSingle();

      if (!org) {
        return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
      }
      orgName = org.name;
    }


    // Insert invite
    const { data: invite, error: insertError } = await supabase
      .from('manager_invites')
      .insert({
        organization_id: targetOrgId,
        invited_by: auth.context.userId,
        email: email.toLowerCase().trim(),
        role,
        notes: notes ?? null,
      })
      .select('id, token, email, role, expires_at')
      .single();

    if (insertError || !invite) {
      console.error('[invite-manager] Insert error:', insertError);
      return NextResponse.json({ error: insertError?.message ?? 'Failed to create invite.' }, { status: 500 });
    }

    // Fetch inviter name for the email
    const { data: inviterProfile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, email')
      .eq('id', auth.context.userId)
      .maybeSingle();

    const inviterName =
      inviterProfile?.first_name && inviterProfile?.last_name
        ? `${inviterProfile.first_name} ${inviterProfile.last_name}`
        : inviterProfile?.email ?? 'CarbonSense Admin';

    // Send invite email (non-fatal)
    await sendInviteEmail({
      toEmail: invite.email,
      role: invite.role,
      organizationName: orgName,
      invitedByName: inviterName,
      expiresAt: invite.expires_at,
    });

    const signupPath = invite.role === 'manager' ? '/signup/manager' : '/signup/employee';
    const signupUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}${signupPath}?email=${encodeURIComponent(email)}`;

    return NextResponse.json({
      success: true,
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        organizationName: orgName,
        expiresAt: invite.expires_at,
        inviteNote: `Invite email sent to ${email}. They can sign up at ${signupUrl} and will automatically receive the ${role} role.`,
      },
    });
  } catch (err) {
    console.error('[invite-manager] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * GET /api/admin/invite-manager
 * Returns all invites for the admin's orgs.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['admin'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // optional filter

    let query = supabase
      .from('manager_invites')
      .select('id, email, role, status, created_at, expires_at, accepted_at, notes, organization_id, organizations(name)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let resultInvites = data ?? [];

    if (status === 'pending' && resultInvites.length > 0) {
      const { data: activeProfiles } = await supabase
        .from('user_profiles')
        .select('email, role, approved, organization_id');

      const activeEmails = new Set(
        (activeProfiles ?? [])
          .filter((p) => p.email && (p.role === 'manager' || p.approved || p.organization_id))
          .map((p) => p.email.toLowerCase().trim())
      );

      const now = new Date().toISOString();
      const filtered = [];
      for (const inv of resultInvites) {
        const invEmail = (inv.email || '').toLowerCase().trim();
        if (invEmail && activeEmails.has(invEmail)) {
          await supabase
            .from('manager_invites')
            .update({ status: 'accepted', accepted_at: now })
            .eq('id', inv.id);
        } else {
          filtered.push(inv);
        }
      }
      resultInvites = filtered;
    }

    return NextResponse.json({ success: true, invites: resultInvites });
  } catch (err) {
    console.error('[invite-manager GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/invite-manager
 * Cancel or re-send an invite.
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['admin'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const { inviteId, action } = await req.json() as { inviteId?: string; action?: string };
    if (!inviteId || !action) {
      return NextResponse.json({ error: 'inviteId and action required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (action === 'cancel') {
      await supabase.from('manager_invites').update({ status: 'cancelled' }).eq('id', inviteId);
      return NextResponse.json({ success: true, message: 'Invite cancelled.' });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    console.error('[invite-manager PATCH] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
