'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getUserProfile } from '@/lib/authHelpers';
import { useUserStore } from '@/store';

/**
 * AuthProvider
 * Syncs the Supabase session → Zustand store.
 *
 * Fast path (SIGNED_IN):
 *   - Reads role directly from JWT user_metadata (no DB call)
 *   - Calls login() immediately so ProtectedRoute unlocks
 *   - Fetches full profile in the background for display data only
 *
 * Slow path (bootstrap / TOKEN_REFRESHED):
 *   - Fetches full profile from DB (already have a session, not time-critical)
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setSession, login, setLoading } = useUserStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // ─── Helpers ───────────────────────────────────────────────────────────────

    const loginFromJWT = (session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>) => {
      const meta = session.user.user_metadata ?? {};
      const role = (meta.role ?? 'viewer') as 'admin' | 'manager' | 'viewer';
      login(
        {
          id: session.user.id,
          name: meta.full_name || meta.name || session.user.email || '',
          email: session.user.email ?? '',
          role,
          organizationId: meta.organization_id || meta.organizationId || undefined,
          approvalStatus: meta.approval_status || (meta.approved === false ? 'pending' : 'approved'),
          createdAt: session.user.created_at,
        },
        session.access_token
      );
    };

    const enrichFromDB = async (session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>) => {
      try {
        let profile = await getUserProfile(session.user.id);
        if (!profile) {
          // Check for pending manager invite
          try {
            await fetch('/api/auth/check-invite', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
            });
            profile = await getUserProfile(session.user.id);
          } catch (e) {
            console.error('[AuthProvider] check-invite error:', e);
          }
        }

        if (!profile) return;
        const approvalStatus = profile.approval_status;
        login(
          {
            id: profile.id,
            name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email,
            email: profile.email,
            role: profile.role as 'admin' | 'manager' | 'viewer',
            organization: profile.organization_name ?? undefined,
            organizationId: profile.organization_id ?? undefined,
            approvalStatus,
            reviewerNotes: profile.reviewer_notes ?? undefined,
            department: profile.department ?? undefined,
            employeeId: profile.employee_id ?? undefined,
            phone: profile.phone ?? undefined,
            avatar: profile.avatar_url ?? undefined,
            createdAt: profile.created_at,
          },
          session.access_token
        );


        // Group 2.1 — onboarding redirect for new managers
        if (profile.role === 'manager') {
          let hasOrgProfile = false;
          if (profile.organization_id) {
            try {
              const { data: org } = await supabase
                .from('organizations')
                .select('profile_status, name')
                .eq('id', profile.organization_id)
                .maybeSingle();
              if (org && org.profile_status !== 'not_started' && org.name && !org.name.startsWith('New Organization')) {
                hasOrgProfile = true;
              }
            } catch { /* non-fatal */ }
          }

          if (!hasOrgProfile) {
            if (!pathname.startsWith('/onboarding/company-profile')) {
              router.replace('/onboarding/company-profile');
            }
          } else {
            // Manager has submitted onboarding. Now check approvalStatus.
            if (approvalStatus === 'pending' || approvalStatus === 'rejected') {
              if (pathname !== '/onboarding/pending-approval') {
                router.replace('/onboarding/pending-approval');
              }
            } else if (approvalStatus === 'approved') {
              if (pathname.startsWith('/onboarding')) {
                router.replace('/dashboard');
              }
            }
          }
        }
      } catch {
        /* non-critical — JWT data already in store */
      }
    };


    // ─── Bootstrap: resolve existing session on page load ──────────────────────
    const bootstrap = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setSession(session);
          // Set initial JWT state
          loginFromJWT(session);
          // Await DB profile enrichment to ensure exact role & approved status
          await enrichFromDB(session);
        } else {
          setSession(null);
        }
      } catch (err) {
        console.error('[AuthProvider] Bootstrap error:', err);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };


    bootstrap();

    // ─── Listen for auth state changes ─────────────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setSession(null);
          useUserStore.setState({
            user: null,
            token: null,
            isAuthenticated: false,
            supabaseSession: null,
            isLoading: false,
          });
          return;
        }

        setSession(session);

        if (event === 'SIGNED_IN') {
          // Fast path — role from JWT, no DB wait
          loginFromJWT(session);
          enrichFromDB(session);       // background profile update
        }

        if (event === 'TOKEN_REFRESHED') {
          // Just update the token; user data is already in store
          useUserStore.setState({ token: session.access_token, supabaseSession: session });
        }
      }
    );

    return () => { subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
