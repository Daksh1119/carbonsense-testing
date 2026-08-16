import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

export type AppRole = 'admin' | 'manager' | 'viewer';

export interface RequestAuthContext {
  userId: string;
  email: string;
  role: AppRole;
  organizationId?: string | null;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}

export interface AuthResolution {
  context?: RequestAuthContext;
  error?: string;
  status: number;
}

function parseBearerToken(authorizationHeader?: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function getRouteHandlerSupabase() {
  const cookieStore = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}

export async function requireAuthContext(
  requiredRoles?: AppRole[],
  authorizationHeader?: string | null
): Promise<AuthResolution> {
  const routeSupabase = getRouteHandlerSupabase();
  let { data: authData, error: authError } = await routeSupabase.auth.getUser();

  // Fallback for SPA fetches that provide Authorization but have no server cookie session.
  if (authError || !authData.user) {
    const bearerToken = parseBearerToken(authorizationHeader);
    if (bearerToken) {
      const supabaseAdmin = getSupabaseAdmin();
      const { data, error } = await supabaseAdmin.auth.getUser(bearerToken);
      authData = data;
      authError = error;
    }
  }

  if (authError || !authData.user) {
    return { error: 'Unauthorized', status: 401 };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('role, organization_id, approval_status')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { error: 'User profile not found.', status: 403 };
  }

  const role = profile.role as AppRole;
  if (requiredRoles && !requiredRoles.includes(role)) {
    return { error: 'Forbidden', status: 403 };
  }

  return {
    status: 200,
    context: {
      userId: authData.user.id,
      email: authData.user.email ?? '',
      role,
      organizationId: profile.organization_id,
      approvalStatus: profile.approval_status,
    },
  };
}