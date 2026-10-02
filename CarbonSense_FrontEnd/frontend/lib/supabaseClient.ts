/**
 * CarbonSense — Supabase Client
 * Provides browser-side and server-side Supabase client instances.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[CarbonSense] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Check your .env.local file.'
  );
}

/**
 * Browser-side Supabase client (singleton).
 * Use this in client components and hooks.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Use a fixed storage key to avoid WebLock conflicts in React Strict Mode
    // and when Supabase is temporarily unreachable.
    storageKey: 'carbonsense-auth-token',
    lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
      // Bypass the WebLock API entirely to prevent AbortError: Lock broken
      // by another request with the 'steal' option.
      return fn();
    },
  },
});

/**
 * Server-side Supabase admin client.
 * Uses the service role key — NEVER expose to the browser.
 * Only import this in server-only files (API route handlers, server actions).
 */
export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      '[CarbonSense] SUPABASE_SERVICE_ROLE_KEY is required for server-side admin operations.'
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
