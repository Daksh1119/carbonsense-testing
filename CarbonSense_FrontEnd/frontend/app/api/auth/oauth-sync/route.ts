/**
 * POST /api/auth/oauth-sync
 * Syncs user profile and role metadata after browser-side OAuth resolution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const intentRole = body.intentRole || 'manager';

    const supabaseAdmin = getSupabaseAdmin();
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = authData.user.id;
    const userEmail = authData.user.email ?? '';
    const userMeta = authData.user.user_metadata || {};
    const normalizedEmail = userEmail.toLowerCase().trim();
    const now = new Date().toISOString();

    // Check existing profile
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('role, approval_status, organization_id')
      .eq('id', userId)
      .maybeSingle();

    // Check pending invite
    const { data: invite } = await supabaseAdmin
      .from('manager_invites')
      .select('id, organization_id, role')
      .eq('email', normalizedEmail)
      .eq('status', 'pending')
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let role = profile?.role ?? intentRole;
    let approvalStatus = profile?.approval_status ?? (role === 'admin' ? 'approved' : 'pending');
    let organizationId = profile?.organization_id ?? null;

    if (invite) {
      role = invite.role;
      approvalStatus = 'approved';
      organizationId = invite.organization_id;
      await supabaseAdmin
        .from('manager_invites')
        .update({ status: 'accepted', accepted_at: now })
        .eq('id', invite.id);
    } else if (intentRole === 'manager' && profile?.role !== 'admin') {
      role = 'manager';
      approvalStatus = profile?.approval_status ?? 'pending';
    } else if (intentRole === 'viewer' && profile?.role !== 'admin') {
      role = 'viewer';
      approvalStatus = profile?.approval_status ?? 'pending';
    }

    if (!profile) {
      await supabaseAdmin.from('user_profiles').insert({
        id: userId,
        email: normalizedEmail,
        role,
        approval_status: approvalStatus,
        organization_id: organizationId,
        first_name: userMeta.full_name?.split(' ')[0] ?? userMeta.name ?? null,
        last_name: userMeta.full_name?.split(' ').slice(1).join(' ') ?? null,
        avatar_url: userMeta.avatar_url ?? userMeta.picture ?? null,
      });
    } else {
      await supabaseAdmin.from('user_profiles').update({
        role,
        approval_status: approvalStatus,
        organization_id: organizationId,
        updated_at: now,
      }).eq('id', userId);
    }

    // Sync GoTrue metadata
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...userMeta,
        role,
        approval_status: approvalStatus,
        organization_id: organizationId,
      },
    });

    let targetPath = '/dashboard';
    if (role === 'admin') {
      targetPath = '/admin/dashboard';
    } else if (role === 'viewer') {
      targetPath = '/viewer/dashboard';
    } else if (role === 'manager') {
      if (!organizationId) {
        targetPath = '/onboarding/company-profile';
      } else {
        const { data: org } = await supabaseAdmin
          .from('organizations')
          .select('profile_status, name')
          .eq('id', organizationId)
          .maybeSingle();
        if (!org || org.profile_status === 'not_started' || !org.name || org.name.startsWith('New Organization')) {
          targetPath = '/onboarding/company-profile';
        } else if (approvalStatus === 'pending' || approvalStatus === 'rejected') {
          targetPath = '/onboarding/pending-approval';
        } else {
          targetPath = '/dashboard';
        }
      }
    }

    return NextResponse.json({
      success: true,
      role,
      approvalStatus,
      targetPath,
    });
  } catch (err) {
    console.error('[oauth-sync] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
