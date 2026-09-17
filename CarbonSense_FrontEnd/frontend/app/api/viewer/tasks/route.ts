import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { requireAuthContext } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

interface TaskDetail {
  steps: string[];
  rationale: string;
}

function getCuratedTaskDetails(title: string, category: string): TaskDetail {
  const lower = (title + ' ' + category).toLowerCase();

  if (lower.includes('fleet') || lower.includes('electric vehicle') || lower.includes('ev') || lower.includes('hybrid') || lower.includes('charg')) {
    return {
      steps: [
        'Audit current fleet delivery routes, daily mileage records, and fuel consumption logs.',
        'Assess facility electrical panel capacity and assess on-site charging installation requirements.',
        'Request quotes from commercial EV / hybrid fleet leasing vendors and compare total cost of ownership.',
        'Establish vehicle charging protocols, train drivers on eco-driving, and track monthly kWh per kilometer.',
      ],
      rationale:
        'Commercial transport is a major Scope 1 emissions source. Transitioning fleet units to electric or hybrid models cuts tailpipe emissions, lowers operating fuel costs, and future-proofs logistics against tightening emissions norms.',
    };
  }

  if (lower.includes('rec') || lower.includes('renewable energy certificate') || lower.includes('scope 2') || lower.includes('green tariff')) {
    return {
      steps: [
        'Collate past 12 months of utility electricity invoices to calculate total Scope 2 megawatt-hour (MWh) consumption.',
        'Identify certified domestic renewable energy certificate registries (e.g. I-REC, BEE Green Certificates) with verifiable vintage.',
        'Submit procurement proposal for manager and finance approval matching remaining electricity emissions.',
        'Complete certificate transaction and log official retirement certificates into the CarbonSense compliance ledger.',
      ],
      rationale:
        'Purchasing accredited RECs allows the organization to claim verified zero-carbon electricity, neutralising residual Scope 2 emissions that cannot yet be addressed through on-site solar.',
    };
  }

  if (lower.includes('led') || lower.includes('lighting') || lower.includes('sensor') || lower.includes('smart control') || lower.includes('hvac')) {
    return {
      steps: [
        'Conduct a floor-by-floor lighting and occupancy survey of all office, warehouse, and common areas.',
        'Procure BEE 5-star / ENERGY STAR certified LED fixtures and passive infrared (PIR) occupancy sensors.',
        'Coordinate installation with the facility maintenance team during non-peak operating hours.',
        'Record weekly electricity sub-meter readings over 30 days to quantify verified power savings against baseline.',
      ],
      rationale:
        'Lighting and unmanaged cooling during unoccupied hours generate substantial electricity waste. Modern LEDs with automated occupancy sensors cut lighting load by 40–60% with rapid financial payback.',
    };
  }

  if (lower.includes('offset') || lower.includes('tree') || lower.includes('plant') || lower.includes('afforest')) {
    return {
      steps: [
        'Review the carbon offset project documentation under accredited standards (Verra VCS, Gold Standard, or TEME).',
        'Verify native species selection and confirm a multi-year watering and maintenance covenant with the implementation partner.',
        'Finalize purchase agreement and record geotagged coordinates of the designated planting site.',
        'Archive serial-numbered retirement certificate in company ESG compliance records.',
      ],
      rationale:
        'High-integrity nature-based offsets neutralize residual operational emissions and demonstrate environmental leadership when paired with direct reduction measures.',
    };
  }

  if (lower.includes('supplier') || lower.includes('procure') || lower.includes('vendor') || lower.includes('scorecard')) {
    return {
      steps: [
        'Extract top 20 suppliers by spend across Scope 3 purchased goods and services.',
        'Distribute CarbonSense supplier sustainability questionnaires to gather their energy and emissions data.',
        'Score vendor responses against environmental criteria and identify high-emission partners.',
        'Incorporate preferred low-carbon terms and disclosure clauses into upcoming contract renewals.',
      ],
      rationale:
        'Supply chain emissions typically make up the vast majority of enterprise emissions. Implementing supplier scorecards encourages decarbonization across upstream partners without heavy internal capital expenditure.',
    };
  }

  return {
    steps: [
      'Review project goals with your manager and confirm milestones and timelines.',
      'Gather baseline operational and resource data for the target department or facility.',
      'Execute operational interventions in accordance with the sustainability standard operating procedures.',
      'Monitor weekly performance metrics and report progress back to the management dashboard.',
    ],
    rationale:
      'Structured execution with clear operational steps ensures targeted emission reduction actions deliver measurable environmental and cost benefits.',
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['viewer', 'manager', 'admin'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const userId = auth.context.userId;
    if (!userId) {
      return NextResponse.json({ success: true, tasks: [] });
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch strictly assigned tasks from recommendation_items
    const { data: items, error: itemsErr } = await supabase
      .from('recommendation_items')
      .select('id, session_id, organization_id, title, description, category, difficulty, impact_tco2e, cost_inr, implementation_status, status_updated_at')
      .eq('assigned_to', userId)
      .not('assigned_to', 'is', null)
      .order('status_updated_at', { ascending: false });

    if (itemsErr) {
      console.error('[viewer tasks GET] Error fetching recommendation_items:', itemsErr);
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    // 2. Also fetch any recommendations assigned directly to this user
    const { data: recs } = await supabase
      .from('recommendations')
      .select('id, session_id, title, summary, rationale, action_type, priority, implementation_status, estimated_impact_kg_co2e, implementation_cost_usd, time_to_impact_months, recommendation_payload, status_updated_at')
      .eq('assigned_to', userId)
      .not('assigned_to', 'is', null);

    // Build a lookup map of recommendations by title and by id
    const recMap = new Map<string, any>();
    for (const r of (recs || [])) {
      if (r.id) recMap.set(r.id, r);
      if (r.title) recMap.set(r.title.toLowerCase().trim(), r);
    }

    // 3. Merge and enrich tasks with detailed steps and rationales
    const tasks = [];
    const seenIds = new Set<string>();

    for (const item of (items || [])) {
      seenIds.add(item.id);
      const matchedRec = recMap.get(item.id) || recMap.get((item.title || '').toLowerCase().trim());
      const curated = getCuratedTaskDetails(item.title || '', item.category || '');

      let steps = curated.steps;
      let rationale = curated.rationale;
      let impactKg = item.impact_tco2e ? item.impact_tco2e * 1000 : undefined;
      let costInr = item.cost_inr || undefined;
      let timeToImpactMonths: number | undefined;

      if (matchedRec) {
        const payload = typeof matchedRec.recommendation_payload === 'string'
          ? JSON.parse(matchedRec.recommendation_payload || '{}')
          : (matchedRec.recommendation_payload || {});

        if (Array.isArray(payload.implementation_steps) && payload.implementation_steps.length > 0) {
          steps = payload.implementation_steps;
        }
        if (matchedRec.rationale) {
          rationale = matchedRec.rationale;
        }
        if (matchedRec.estimated_impact_kg_co2e) {
          impactKg = matchedRec.estimated_impact_kg_co2e;
        }
        if (matchedRec.implementation_cost_usd) {
          costInr = Math.round(matchedRec.implementation_cost_usd * 83);
        }
        if (matchedRec.time_to_impact_months) {
          timeToImpactMonths = matchedRec.time_to_impact_months;
        }
      }

      tasks.push({
        id: item.id,
        title: item.title,
        description: item.description,
        category: (item.category || 'energy').toLowerCase(),
        difficulty: item.difficulty || 'Medium',
        implementation_status: item.implementation_status || 'proposed',
        assigned_at: item.status_updated_at,
        session_id: item.session_id,
        rationale,
        impact_kg: impactKg,
        cost_inr: costInr,
        time_to_impact_months: timeToImpactMonths,
        implementation_steps: steps,
      });
    }

    // Also include any direct recommendations that weren't in recommendation_items
    for (const r of (recs || [])) {
      if (seenIds.has(r.id)) continue;
      const curated = getCuratedTaskDetails(r.title || '', r.action_type || '');
      const payload = typeof r.recommendation_payload === 'string'
        ? JSON.parse(r.recommendation_payload || '{}')
        : (r.recommendation_payload || {});

      const steps = Array.isArray(payload.implementation_steps) && payload.implementation_steps.length > 0
        ? payload.implementation_steps
        : curated.steps;

      tasks.push({
        id: r.id,
        title: r.title,
        description: r.summary || r.rationale || r.title,
        category: (r.action_type || 'energy').toLowerCase(),
        difficulty: r.priority === 'high' || r.priority === 'critical' ? 'Hard' : 'Medium',
        implementation_status: r.implementation_status || 'proposed',
        assigned_at: r.status_updated_at,
        session_id: r.session_id,
        rationale: r.rationale || curated.rationale,
        impact_kg: r.estimated_impact_kg_co2e,
        cost_inr: r.implementation_cost_usd ? Math.round(r.implementation_cost_usd * 83) : undefined,
        time_to_impact_months: r.time_to_impact_months,
        implementation_steps: steps,
      });
    }

    return NextResponse.json({ success: true, tasks });
  } catch (err) {
    console.error('[viewer tasks GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['viewer', 'manager', 'admin'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const { taskId, status } = await req.json();
    if (!taskId || !status) {
      return NextResponse.json({ error: 'taskId and status are required' }, { status: 400 });
    }

    const validStatuses = ['proposed', 'in_progress', 'implemented', 'rejected'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    // Update in recommendation_items
    await supabase
      .from('recommendation_items')
      .update({
        implementation_status: status,
        status_updated_at: now,
        status_updated_by: auth.context.userId,
      })
      .eq('id', taskId);

    // Also update recommendations table in case it exists there
    await supabase
      .from('recommendations')
      .update({
        implementation_status: status,
        status_updated_at: now,
        status_updated_by: auth.context.userId,
      })
      .eq('id', taskId);

    return NextResponse.json({ success: true, taskId, status });
  } catch (err) {
    console.error('[viewer tasks PATCH] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
