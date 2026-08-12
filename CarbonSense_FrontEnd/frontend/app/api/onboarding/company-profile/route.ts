/**
 * POST /api/onboarding/company-profile
 * Creates or updates an organization profile during manager onboarding.
 * Uses getSupabaseAdmin() to safely insert/update organizations table,
 * link user_profiles, and sync Supabase Auth metadata without RLS policy violations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { requireAuthContext } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['manager', 'admin'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const body = await req.json();
    const { patch } = body as { patch?: Record<string, any> };

    if (!patch) {
      return NextResponse.json({ error: 'patch payload is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const userId = auth.context.userId;

    // Fetch caller's user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id, role, email')
      .eq('id', userId)
      .maybeSingle();

    let orgId = profile?.organization_id ?? null;
    const now = new Date().toISOString();

    if (!orgId) {
      // 1. Create new organization
      const { data: newOrg, error: createErr } = await supabase
        .from('organizations')
        .insert({
          ...patch,
        })
        .select('id, name')
        .single();

      if (createErr || !newOrg) {
        console.error('[onboarding company-profile] Create org error:', createErr);
        return NextResponse.json({ error: createErr?.message ?? 'Failed to create organization.' }, { status: 500 });
      }

      orgId = newOrg.id;

      // 2. Link user_profile to new org
      await supabase
        .from('user_profiles')
        .update({
          organization_id: orgId,
          organization_name: patch.name || newOrg.name,
          updated_at: now,
        })
        .eq('id', userId);

      // 3. Update Supabase Auth user metadata
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          organization_id: orgId,
          role: profile?.role ?? 'manager',
        },
      });
    } else {
      // Update existing organization
      const { error: updateErr } = await supabase
        .from('organizations')
        .update({
          ...patch,
        })
        .eq('id', orgId);

      if (updateErr) {
        console.error('[onboarding company-profile] Update org error:', updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      // Sync name to user_profile if provided
      if (patch.name) {
        await supabase
          .from('user_profiles')
          .update({
            organization_name: patch.name,
            updated_at: now,
          })
          .eq('id', userId);
      }
    }

    return NextResponse.json({
      success: true,
      organizationId: orgId,
      organizationName: patch.name ?? 'Organization',
    });
  } catch (err) {
    console.error('[onboarding company-profile] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
