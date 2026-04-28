/**
 * GET /api/auth/pending-approvals
 * Returns pending employee signup requests for review.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { requireAuthContext } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['admin', 'manager'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status });
    }

    const supabaseAdmin = getSupabaseAdmin();

    let query = supabaseAdmin
      .from('employee_signup_requests')
      .select('id, user_id, organization_name, manager_email, status, submitted_at, form_data')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false })
      .limit(50);

    if (auth.context.role === 'manager') {
      query = query.eq('manager_email', auth.context.email);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const requests = (data || []).map((row) => {
      const formData = (row.form_data || {}) as Record<string, unknown>;
      return {
        id: row.id,
        userId: row.user_id,
        organizationName: row.organization_name,
        managerEmail: row.manager_email,
        status: row.status,
        submittedAt: row.submitted_at,
        firstName: String(formData.firstName || ''),
        lastName: String(formData.lastName || ''),
        applicantEmail: String(formData.email || ''),
        department: String(formData.department || ''),
        jobTitle: String(formData.jobTitle || ''),
      };
    });

    return NextResponse.json({ success: true, requests });
  } catch (err) {
    const digest = (err as { digest?: string } | null)?.digest;
    if (digest !== 'DYNAMIC_SERVER_USAGE') {
      console.error('[pending-approvals] Unexpected error:', err);
    }
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
