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
  const supabase = getRouteHandlerSupabase();

  let session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      session = data.session;
    } else {
      console.error('[auth/callback] Exchange error:', error);
    }
  }

  if (!session) {
    // Try fetching existing session from cookies
    const { data: sessionData } = await supabase.auth.getSession();
    session = sessionData.session;
  }

  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const userId = session.user.id;
  const userEmail = session.user.email ?? '';
  const userMeta = session.user.user_metadata || {};


  const adminClient = getSupabaseAdmin();

  // Check if profile exists
  const { data: profile } = await adminClient
    .from('user_profiles')
    .select('role, approved, organization_id')
    .eq('id', userId)
    .maybeSingle();

  const normalizedEmail = userEmail.toLowerCase().trim();
  const now = new Date().toISOString();

  // Check if there's a pending invite for this email
  const { data: invite } = await adminClient
    .from('manager_invites')
    .select('id, organization_id, role')
    .eq('email', normalizedEmail)
    .eq('status', 'pending')
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let role = profile?.role ?? 'viewer';
  let approved = profile?.approved ?? false;
  let organizationId = profile?.organization_id ?? null;

  if (invite) {
    // Override with invited role + org
    role = invite.role as string;
    approved = true;
    organizationId = invite.organization_id;

    // Mark invite as accepted
    await adminClient
      .from('manager_invites')
      .update({ status: 'accepted', accepted_at: now })
      .eq('id', invite.id);
  }

  if (!profile) {
    // New user profile
    await adminClient.from('user_profiles').insert({
      id: userId,
      email: normalizedEmail,
      role,
      approved,
      organization_id: organizationId,
      first_name: userMeta.full_name?.split(' ')[0] ?? userMeta.name ?? null,
      last_name: userMeta.full_name?.split(' ').slice(1).join(' ') ?? null,
      avatar_url: userMeta.avatar_url ?? userMeta.picture ?? null,
    });
  } else if (invite) {
    // Update existing profile with invite privileges
    await adminClient.from('user_profiles').update({
      role,
      approved,
      organization_id: organizationId,
      updated_at: now,
    }).eq('id', userId);
  }

  // Align JWT metadata for fast role checks in client state hydration.
  await adminClient.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...userMeta,
      role,
      approved,
      organization_id: organizationId,
    },
  });

  const dashMap: Record<string, string> = {
    admin: '/admin/dashboard',
    manager: '/dashboard',
    viewer: '/viewer/dashboard',
  };

  let targetPath = dashMap[role] || '/login';

  if (role === 'manager') {
    if (!organizationId) {
      targetPath = '/onboarding/company-profile';
    } else {
      const { data: org } = await adminClient
        .from('organizations')
        .select('profile_status, name')
        .eq('id', organizationId)
        .maybeSingle();
      if (!org || org.profile_status === 'not_started' || !org.name || org.name.startsWith('New Organization')) {
        targetPath = '/onboarding/company-profile';
      }
    }
  }

  return NextResponse.redirect(new URL(targetPath, req.url));
}

