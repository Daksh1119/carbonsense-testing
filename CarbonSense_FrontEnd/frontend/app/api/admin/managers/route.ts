/**
 * DELETE /api/admin/managers
 * Allows Admin to remove a manager profile or demote to viewer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { requireAuthContext } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['admin'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const userId = searchParams.get('id') || body.userId;
    const action = body.action ?? 'delete'; // 'delete' or 'demote'

    if (!userId) {
      return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: targetUser } = await supabase
      .from('user_profiles')
      .select('id, email, role')
      .eq('id', userId)
      .maybeSingle();

    if (!targetUser) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }

    if (action === 'demote') {
      // Demote to viewer
      await supabase
        .from('user_profiles')
        .update({ role: 'viewer', organization_id: null, updated_at: new Date().toISOString() })
        .eq('id', userId);

      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { role: 'viewer' },
      });

      return NextResponse.json({
        success: true,
        message: `Manager ${targetUser.email} demoted to Viewer.`,
      });
    }

    // Delete user profile and Supabase Auth user
    await supabase.from('user_profiles').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);

    return NextResponse.json({
      success: true,
      message: `Manager ${targetUser.email} removed completely from platform.`,
    });
  } catch (err) {
    console.error('[managers DELETE] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
