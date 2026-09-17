/**
 * GET /api/team-management/invites
 * POST /api/team-management/invites (Resend invite)
 * DELETE /api/team-management/invites (Cancel invite)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { requireAuthContext } from '@/lib/serverAuth';
import { sendInviteEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['manager', 'admin'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const targetOrgId = auth.context.organizationId;
    if (!targetOrgId && auth.context.role !== 'admin') {
      return NextResponse.json({ invites: [] });
    }

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('manager_invites')
      .select('id, email, role, status, created_at, expires_at, accepted_at, notes, organization_id, organizations(name)')
      .order('created_at', { ascending: false });

    if (targetOrgId) {
      query = query.eq('organization_id', targetOrgId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, invites: data ?? [] });
  } catch (err) {
    console.error('[invites GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * POST: Resend an invite email
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['manager', 'admin'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const { inviteId, email } = (await req.json()) as { inviteId?: string; email?: string };
    if (!inviteId && !email) {
      return NextResponse.json({ error: 'inviteId or email is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let query = supabase.from('manager_invites').select('id, email, role, status, expires_at, organization_id, organizations(name)').eq('status', 'pending');

    if (inviteId) {
      query = query.eq('id', inviteId);
    } else if (email) {
      query = query.eq('email', email.toLowerCase().trim());
      if (auth.context.organizationId) {
        query = query.eq('organization_id', auth.context.organizationId);
      }
    }

    const { data: invite, error: fetchErr } = await query.maybeSingle();
    if (fetchErr || !invite) {
      return NextResponse.json({ error: 'Pending invite not found.' }, { status: 404 });
    }

    // Refresh expiration to 7 days from now
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('manager_invites').update({ expires_at: newExpiresAt }).eq('id', invite.id);

    // Get inviter profile
    const { data: inviterProfile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, email')
      .eq('id', auth.context.userId)
      .maybeSingle();

    const inviterName =
      inviterProfile?.first_name && inviterProfile?.last_name
        ? `${inviterProfile.first_name} ${inviterProfile.last_name}`
        : inviterProfile?.email ?? auth.context.email;

    // Send the email
    const orgName = (invite as any).organizations?.name ?? 'Your Organization';
    await sendInviteEmail({
      toEmail: invite.email,
      role: invite.role,
      organizationName: orgName,
      invitedByName: inviterName,
      expiresAt: newExpiresAt,
    });

    return NextResponse.json({
      success: true,
      message: `Invitation email resent to ${invite.email}.`,
    });
  } catch (err) {
    console.error('[invites POST resend] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * DELETE: Cancel an invite
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['manager', 'admin'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const { searchParams } = new URL(req.url);
    const inviteId = searchParams.get('id');

    if (!inviteId) {
      return NextResponse.json({ error: 'Invite id is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('manager_invites')
      .update({ status: 'cancelled' })
      .eq('id', inviteId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Invite cancelled.' });
  } catch (err) {
    console.error('[invites DELETE] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
