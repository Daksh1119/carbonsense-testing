/**
 * POST /api/auth/check-invite
 * Called right after a user signs up (from AuthProvider/onAuthStateChange).
 * Checks manager_invites for a pending invite matching the user's email.
 * If found: grants the invited role + links to the org, marks invite accepted.
 * Returns { invited: true/false, role, organizationId } so the client can redirect.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { requireAuthContext } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthContext(
      ['admin', 'manager', 'viewer'],
      req.headers.get('authorization')
    );
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const supabase = getSupabaseAdmin();
    const email = auth.context.email.toLowerCase().trim();
    const userId = auth.context.userId;

    // Look for a pending, non-expired invite matching this email
    const { data: invite } = await supabase
      .from('manager_invites')
      .select('id, organization_id, role, token')
      .eq('email', email)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!invite) {
      return NextResponse.json({ invited: false });
    }

    const now = new Date().toISOString();

    // 1. Upsert user_profiles with the invited role + org
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert(
        {
          id: userId,
          email,
          role: invite.role,
          organization_id: invite.organization_id,
          approved: true, // invite = pre-approved
          updated_at: now,
        },
        { onConflict: 'id' }
      );

    if (profileError) {
      console.error('[check-invite] Profile upsert error:', profileError);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // 2. Update Supabase Auth user metadata so JWT reflects the new role
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { role: invite.role, organization_id: invite.organization_id, approved: true },
    });

    // 3. Mark invite as accepted
    await supabase
      .from('manager_invites')
      .update({ status: 'accepted', accepted_at: now })
      .eq('id', invite.id);

    return NextResponse.json({
      invited: true,
      role: invite.role,
      organizationId: invite.organization_id,
    });
  } catch (err) {
    console.error('[check-invite] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
