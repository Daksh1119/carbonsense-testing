/**
 * GET /auth/callback
 * Handles Supabase OAuth code exchange and redirects to the correct dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { getRouteHandlerSupabase } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', req.url));
  }

  const supabase = getRouteHandlerSupabase();

  // Exchange code for session and persist auth cookies on the response.
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('[auth/callback] Exchange error:', error);
    return NextResponse.redirect(new URL('/login?error=auth_failed', req.url));
  }

  const userId = data.session.user.id;
  const userEmail = data.session.user.email ?? '';
  const userMeta = data.session.user.user_metadata || {};

  const adminClient = getSupabaseAdmin();

  // Check if profile exists
  const { data: profile } = await adminClient
    .from('user_profiles')
    .select('role, approved')
    .eq('id', userId)
    .maybeSingle();

  let role = profile?.role ?? 'viewer';
  let approved = profile?.approved ?? false;

  if (!profile) {
    // New Google user — create profile in pending state.
    await adminClient.from('user_profiles').insert({
      id: userId,
      email: userEmail,
      role: 'viewer',
      approved: false,
      first_name: userMeta.full_name?.split(' ')[0] ?? userMeta.name ?? null,
      last_name: userMeta.full_name?.split(' ').slice(1).join(' ') ?? null,
      avatar_url: userMeta.avatar_url ?? userMeta.picture ?? null,
    });

    role = 'viewer';
    approved = false;
  }

  // Align JWT metadata for fast role checks in client state hydration.
  await adminClient.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...userMeta,
      role,
      approved,
    },
  });

  const dashMap: Record<string, string> = {
    admin: '/dashboard',
    manager: '/manager/dashboard',
    viewer: '/viewer/dashboard',
  };
  return NextResponse.redirect(new URL(dashMap[role] || '/login', req.url));
}
