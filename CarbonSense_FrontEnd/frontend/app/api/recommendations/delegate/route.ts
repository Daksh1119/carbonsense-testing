/**
 * /api/recommendations/delegate
 * POST: Delegate a recommendation to an employee (viewer).
 * GET: Fetch delegated recommendations for an organization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { requireAuthContext } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['manager', 'admin', 'viewer'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('organizationId') || auth.context.organizationId;

    if (!orgId) {
      return NextResponse.json({ items: [] });
    }

    const supabase = getSupabaseAdmin();
    const { data: items, error } = await supabase
      .from('recommendation_items')
      .select('id, title, description, category, difficulty, implementation_status, assigned_to, rank, user_profiles!recommendation_items_assigned_to_fkey(first_name, last_name, email)')
      .eq('organization_id', orgId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, items: items ?? [] });
  } catch (err) {
    console.error('[delegate GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['manager', 'admin'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const body = await req.json();
    const {
      recommendationId,
      title,
      description,
      category = 'General',
      difficulty = 'Medium',
      impact,
      cost,
      assignedTo,
      organizationId: customOrgId,
    } = body as {
      recommendationId?: string;
      title: string;
      description?: string;
      category?: string;
      difficulty?: string;
      impact?: number;
      cost?: number;
      assignedTo: string | null;
      organizationId?: string;
    };

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const orgId = auth.context.role === 'admin' && customOrgId ? customOrgId : auth.context.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is missing' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    // 1. If recommendationId is provided, try to update it directly
    if (recommendationId) {
      // Also update recommendations table so it stays in sync
      try {
        await supabase
          .from('recommendations')
          .update({
            assigned_to: assignedTo || null,
            status_updated_at: now,
            status_updated_by: auth.context.userId,
          })
          .eq('id', recommendationId);
      } catch (recErr) {
        console.warn('[delegate] Non-fatal recommendations update error:', recErr);
      }

      const { data: updated, error: updateError } = await supabase
        .from('recommendation_items')
        .update({
          assigned_to: assignedTo || null,
          status_updated_at: now,
          status_updated_by: auth.context.userId,
        })
        .eq('id', recommendationId)
        .select('id, title, assigned_to, implementation_status')
        .maybeSingle();

      if (!updateError && updated) {
        return NextResponse.json({ success: true, item: updated });
      }
    }

    // 2. Otherwise find or create a recommendation_session for this organization
    let { data: session } = await supabase
      .from('recommendation_sessions')
      .select('id')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) {
      const { data: newSession, error: sessionErr } = await supabase
        .from('recommendation_sessions')
        .insert({
          organization_id: orgId,
          user_id: auth.context.userId,
          project_name: 'Decarbonization Roadmap',
          location: 'India',
          emission_kg: 0,
          status: 'generated',
        })
        .select('id')
        .single();

      if (sessionErr) {
        console.error('[delegate] Session creation error:', sessionErr);
        return NextResponse.json({ error: sessionErr.message }, { status: 500 });
      }
      session = newSession;
    }

    // 3. Check if an item with this title already exists in recommendation_items for this org
    const { data: existingItem } = await supabase
      .from('recommendation_items')
      .select('id')
      .eq('organization_id', orgId)
      .eq('title', title)
      .maybeSingle();

    if (existingItem) {
      const { data: updated, error: updateErr } = await supabase
        .from('recommendation_items')
        .update({
          assigned_to: assignedTo || null,
          status_updated_at: now,
          status_updated_by: auth.context.userId,
        })
        .eq('id', existingItem.id)
        .select('id, title, assigned_to, implementation_status')
        .single();

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, item: updated });
    }

    // If no employee was selected (unassigning), do not insert a blank unassigned task
    if (!assignedTo) {
      return NextResponse.json({ success: true, message: 'Task unassigned' });
    }

    // 4. Insert new recommendation item
    const { data: newItem, error: insertErr } = await supabase
      .from('recommendation_items')
      .insert({
        session_id: session.id,
        organization_id: orgId,
        user_id: auth.context.userId,
        title,
        description: description || title,
        category,
        difficulty: ['Easy', 'Medium', 'Hard'].includes(difficulty) ? difficulty : 'Medium',
        impact_tco2e: impact ? Number((impact / 1000).toFixed(2)) : null,
        cost_inr: cost ?? null,
        assigned_to: assignedTo || null,
        implementation_status: 'proposed',
        status_updated_at: now,
        status_updated_by: auth.context.userId,
      })
      .select('id, title, assigned_to, implementation_status')
      .single();

    if (insertErr) {
      console.error('[delegate] Insert recommendation item error:', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: newItem });
  } catch (err) {
    console.error('[delegate POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
