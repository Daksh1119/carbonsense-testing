/**
 * POST /api/auth/record-consent
 * Records a manager's consent agreement with timestamp and IP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { requireAuthContext } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['manager'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status });
    }

    const version = req.nextUrl.searchParams.get('version') || 'v1.0';
    const supabaseAdmin = getSupabaseAdmin();

    const { data: existing, error } = await supabaseAdmin
      .from('manager_consents')
      .select('id, agreed_at')
      .eq('user_id', auth.context.userId)
      .eq('consent_version', version)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      hasConsented: Boolean(existing),
      agreedAt: existing?.agreed_at ?? null,
      consentVersion: version,
    });
  } catch (err) {
    console.error('[record-consent:get] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthContext(['manager'], req.headers.get('authorization'));
    if (!auth.context) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status });
    }

    const body = await req.json();
    const { digitalSignature, consentVersion = 'v1.0' } = body;

    if (!digitalSignature) {
      return NextResponse.json(
        { error: 'digitalSignature is required.' },
        { status: 400 }
      );
    }

    // Extract client IP from headers (works behind Vercel/Cloudflare proxies)
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      req.headers.get('x-real-ip') ??
      'unknown';

    const supabaseAdmin = getSupabaseAdmin();

    // Check if consent already recorded for this version
    const { data: existing } = await supabaseAdmin
      .from('manager_consents')
      .select('id')
      .eq('user_id', auth.context.userId)
      .eq('consent_version', consentVersion)
      .maybeSingle();

    if (existing) {
      // Already consented — idempotent success
      return NextResponse.json({ success: true, alreadyRecorded: true });
    }

    const { error } = await supabaseAdmin.from('manager_consents').insert({
      user_id: auth.context.userId,
      consent_version: consentVersion,
      digital_signature: digitalSignature,
      ip_address: ip,
    });

    if (error) {
      console.error('[record-consent] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[record-consent] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
