/**
 * POST /api/auth/complete-profile
 * Called after first login to upsert user_profiles with role.
 * Returns the canonical role for the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { requireAuthContext } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['admin', 'manager', 'viewer'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status });
    }

    const body = await req.json();
    const { userId, email, role, firstName, lastName, organizationName } = body;

    if (!userId || !email || !role) {
      return NextResponse.json(
        { error: 'userId, email, and role are required.' },
        { status: 400 }
      );
    }

    if (!['admin', 'manager', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
    }

    // Non-admin users can only complete their own profile and cannot self-escalate roles.
    if (auth.context.role !== 'admin') {
      if (userId !== auth.context.userId) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
      }
      if (role !== auth.context.role) {
        return NextResponse.json({ error: 'Role escalation is not allowed.' }, { status: 403 });
      }
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .upsert(
        {
          id: userId,
          email,
          role,
          first_name: firstName ?? null,
          last_name: lastName ?? null,
          organization_name: organizationName ?? null,
          // Admins and managers are auto-approved; viewers require explicit approval
          approved: role !== 'viewer',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) {
      console.error('[complete-profile] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, role: data.role, approved: data.approved });
  } catch (err) {
    console.error('[complete-profile] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
