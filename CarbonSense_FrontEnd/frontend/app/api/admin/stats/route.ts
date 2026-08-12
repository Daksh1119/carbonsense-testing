/**
 * GET /api/admin/stats
 * Live platform stats for the admin dashboard.
 * Returns org count, user counts by role, pending invite count, recent activity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { requireAuthContext } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['admin'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const supabase = getSupabaseAdmin();

    // Run all queries in parallel
    const [orgsRes, profilesRes, invitesRes, signupReqsRes, recentOrgsRes] = await Promise.all([
      // Total organizations
      supabase.from('organizations').select('id, name, profile_status, created_at', { count: 'exact' }),

      // User profiles grouped by role
      supabase.from('user_profiles').select('id, role, email, organization_id, created_at, approved'),

      // Pending invites
      supabase
        .from('manager_invites')
        .select('id, email, role, status, created_at, organization_id, organizations(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20),

      // Pending viewer signup requests
      supabase
        .from('employee_signup_requests')
        .select('id, user_id, organization_name, manager_email, submitted_at, form_data')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })
        .limit(20),

      // Most recent 5 orgs (for the companies list)
      supabase
        .from('organizations')
        .select('id, name, profile_status, created_at, sector')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const profiles = profilesRes.data ?? [];
    const managers = profiles.filter((p) => p.role === 'manager');
    const viewers = profiles.filter((p) => p.role === 'viewer');
    const orgs = orgsRes.data ?? [];

    // Build org enrichment: map org_id → viewer count, manager name
    const orgViewerCount: Record<string, number> = {};
    const orgManagerEmail: Record<string, string> = {};
    for (const p of viewers) {
      if (p.organization_id) orgViewerCount[p.organization_id] = (orgViewerCount[p.organization_id] ?? 0) + 1;
    }
    for (const m of managers) {
      if (m.organization_id && !orgManagerEmail[m.organization_id]) {
        orgManagerEmail[m.organization_id] = m.email;
      }
    }

    const companiesList = (recentOrgsRes.data ?? []).map((org) => ({
      id: org.id,
      name: org.name,
      sector: org.sector ?? 'Unknown',
      profileStatus: org.profile_status ?? 'not_started',
      managerEmail: orgManagerEmail[org.id] ?? null,
      viewerCount: orgViewerCount[org.id] ?? 0,
      createdAt: org.created_at,
    }));

    // Pending viewer requests enriched
    const pendingViewerRequests = (signupReqsRes.data ?? []).map((row) => {
      const fd = (row.form_data ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        userId: row.user_id,
        organizationName: row.organization_name,
        managerEmail: row.manager_email,
        submittedAt: row.submitted_at,
        firstName: String(fd.firstName ?? ''),
        lastName: String(fd.lastName ?? ''),
        email: String(fd.email ?? ''),
        department: String(fd.department ?? ''),
        jobTitle: String(fd.jobTitle ?? ''),
      };
    });

    // Auto-heal manager_invites: if user_profile exists and is an active manager/user, mark invite as accepted
    const activeEmails = new Set(
      profiles
        .filter((p) => p.email && (p.role === 'manager' || p.approved || p.organization_id))
        .map((p) => p.email.toLowerCase().trim())
    );

    const pendingInvitesFiltered = [];
    const now = new Date().toISOString();

    for (const inv of (invitesRes.data ?? [])) {
      const invEmail = (inv.email || '').toLowerCase().trim();
      if (invEmail && activeEmails.has(invEmail)) {
        await supabase
          .from('manager_invites')
          .update({ status: 'accepted', accepted_at: now })
          .eq('id', inv.id);
      } else {
        pendingInvitesFiltered.push(inv);
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalOrgs: orgs.length,
        totalManagers: managers.length,
        totalViewers: viewers.length,
        pendingInvites: pendingInvitesFiltered.length,
        pendingViewerRequests: pendingViewerRequests.length,
      },
      companiesList,
      pendingInvites: pendingInvitesFiltered,
      pendingViewerRequests,
    });
  } catch (err) {
    console.error('[admin/stats] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
