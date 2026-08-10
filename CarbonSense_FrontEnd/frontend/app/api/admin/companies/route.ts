/**
 * GET /api/admin/companies
 * Returns all registered organizations with manager email, viewer count, and profile status.
 *
 * DELETE /api/admin/companies
 * Deletes an organization and all associated child data (cascade delete).
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

    const [orgsRes, profilesRes] = await Promise.all([
      supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false }),

      supabase
        .from('user_profiles')
        .select('id, email, role, organization_id, first_name, last_name'),
    ]);

    if (orgsRes.error) {
      return NextResponse.json({ error: orgsRes.error.message }, { status: 500 });
    }

    const orgs = orgsRes.data ?? [];
    const profiles = profilesRes.data ?? [];

    const viewersCount: Record<string, number> = {};
    const managersMap: Record<string, string> = {};

    for (const p of profiles) {
      if (!p.organization_id) continue;
      if (p.role === 'viewer') {
        viewersCount[p.organization_id] = (viewersCount[p.organization_id] ?? 0) + 1;
      } else if (p.role === 'manager' && !managersMap[p.organization_id]) {
        const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
        managersMap[p.organization_id] = name || p.email;
      }
    }

    const companies = orgs.map((org) => ({
      id: org.id,
      name: org.name,
      industry: org.industry ?? 'General',
      sector: org.sector ?? 'General',
      profileStatus: org.profile_status ?? 'not_started',
      managerName: managersMap[org.id] ?? 'Unassigned',
      viewerCount: viewersCount[org.id] ?? 0,
      createdAt: org.created_at,
    }));

    return NextResponse.json({ success: true, companies });
  } catch (err) {
    console.error('[companies GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['admin'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const organizationId = searchParams.get('id') || body.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch org name before deleting
    const { data: targetOrg } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', organizationId)
      .maybeSingle();

    if (!targetOrg) {
      return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
    }

    // Try calling PL/pgSQL function if available
    const { error: rpcError } = await supabase.rpc('delete_organization_cascade', {
      target_org_id: organizationId,
    });

    if (rpcError) {
      // Fallback: Perform manual sequential cascade deletion
      console.warn('[companies DELETE] RPC delete_organization_cascade not available, doing manual cascade:', rpcError.message);

      await supabase.from('task_assignments').delete().eq('organization_id', organizationId);
      await supabase.from('tasks').delete().eq('organization_id', organizationId);
      await supabase.from('recommendations').delete().eq('organization_id', organizationId);
      await supabase.from('policy_compliance').delete().eq('organization_id', organizationId);
      await supabase.from('emissions_records').delete().eq('organization_id', organizationId);
      await supabase.from('data_ingestion_jobs').delete().eq('organization_id', organizationId);
      await supabase.from('facility_profiles').delete().eq('organization_id', organizationId);
      await supabase.from('manager_invites').delete().eq('organization_id', organizationId);
      await supabase.from('employee_signup_requests').delete().eq('organization_name', targetOrg.name);

      // Unlink users
      await supabase
        .from('user_profiles')
        .update({ organization_id: null, organization_name: null })
        .eq('organization_id', organizationId);

      // Delete org
      const { error: deleteError } = await supabase
        .from('organizations')
        .delete()
        .eq('id', organizationId);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Organization "${targetOrg.name}" and all associated data deleted successfully.`,
    });
  } catch (err) {
    console.error('[companies DELETE] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
