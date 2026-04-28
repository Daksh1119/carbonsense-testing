/**
 * CarbonSense — Auth Helper Functions
 * Wraps Supabase auth calls with typed, role-aware utilities.
 */

import { supabase } from '@/lib/supabaseClient';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type Role = 'admin' | 'manager' | 'viewer';

export interface AuthResult {
  success: boolean;
  user?: SupabaseUser;
  session?: Session;
  role?: Role;
  approved?: boolean;
  error?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: Role;
  organization_id?: string;
  organization_name?: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  department?: string;
  employee_id?: string;
  phone?: string;
  avatar_url?: string;
  approved: boolean;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────
// Role routing
// ─────────────────────────────────────────────

export function getRoleDashboardPath(role: Role): string {
  switch (role) {
    case 'admin':   return '/dashboard';
    case 'manager': return '/manager/dashboard';
    case 'viewer':  return '/viewer/dashboard';
    default:        return '/login';
  }
}

// ─────────────────────────────────────────────
// Profile helpers
// ─────────────────────────────────────────────

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as UserProfile;
}

export async function getCurrentUserRole(): Promise<Role | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await getUserProfile(user.id);
  return profile?.role ?? null;
}

// ─────────────────────────────────────────────
// Sign-in methods
// ─────────────────────────────────────────────

export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { success: false, error: error?.message ?? 'Sign-in failed.' };
  }

  // Fast-path role from JWT metadata. Fallback to profile lookup for legacy users.
  let role = data.user.user_metadata?.role as Role | undefined;
  let approved = data.user.user_metadata?.approved ?? true;

  if (!role) {
    const profile = await getUserProfile(data.user.id);
    role = profile?.role;
    approved = profile?.approved ?? approved;
  }

  return {
    success: true,
    user: data.user,
    session: data.session ?? undefined,
    role,
    approved,
  };
}

export async function signInWithGoogle(): Promise<void> {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}

export async function signInWithOTP(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false, // OTP only for existing users
    },
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function verifyOTP(email: string, token: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error || !data.user) {
    return { success: false, error: error?.message ?? 'Invalid or expired code.' };
  }

  const profile = await getUserProfile(data.user.id);

  return {
    success: true,
    user: data.user,
    session: data.session ?? undefined,
    role: profile?.role,
    approved: profile?.approved,
  };
}

// ─────────────────────────────────────────────
// Sign-up
// ─────────────────────────────────────────────

export async function signUpWithEmail(
  email: string,
  password: string,
  metadata: Record<string, unknown> = {}
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });

  if (error || !data.user) {
    return { success: false, error: error?.message ?? 'Sign-up failed.' };
  }

  return { success: true, user: data.user };
}

// ─────────────────────────────────────────────
// Password reset
// ─────────────────────────────────────────────

export async function sendPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ─────────────────────────────────────────────
// Sign-out
// ─────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ─────────────────────────────────────────────
// Session
// ─────────────────────────────────────────────

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
