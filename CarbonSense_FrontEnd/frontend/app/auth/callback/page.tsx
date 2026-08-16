'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useUserStore } from '@/store';
import { Loader2 } from 'lucide-react';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const processAuth = async () => {
      try {
        const intentRole = searchParams.get('intent_role') || 'manager';

        // Check if session is already active in browser client
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (session && active) {
          await syncUser(session.access_token, intentRole);
          return;
        }

        // Listen for onAuthStateChange to catch the exchange event
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          if (newSession && active) {
            subscription.unsubscribe();
            await syncUser(newSession.access_token, intentRole);
          }
        });

        // Safety fallback timeout
        setTimeout(() => {
          if (active && !session) {
            subscription.unsubscribe();
            router.replace('/login');
          }
        }, 5000);
      } catch (err) {
        console.error('[AuthCallback] Error:', err);
        if (active) {
          setError('Authentication failed. Redirecting to login...');
          setTimeout(() => router.replace('/login'), 2000);
        }
      }
    };

    const syncUser = async (token: string, intentRole: string) => {
      try {
        const res = await fetch('/api/auth/oauth-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ intentRole }),
        });

        const data = await res.json();
        if (res.ok && data.targetPath) {
          const userRes = await supabase.auth.getUser();
          const curUser = userRes.data.user;

          if (curUser) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', curUser.id)
              .maybeSingle();

            if (profile && active) {
              useUserStore.getState().login(
                {
                  id: profile.id,
                  name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email,
                  email: profile.email,
                  role: profile.role,
                  organization: profile.organization_name ?? undefined,
                  organizationId: profile.organization_id ?? undefined,
                  approvalStatus: profile.approval_status,
                  reviewerNotes: profile.reviewer_notes ?? undefined,
                  createdAt: profile.created_at,
                },
                token
              );
            }
          }

          if (active) {
            router.replace(data.targetPath);
          }
        } else {
          if (active) router.replace('/login');
        }
      } catch {
        if (active) router.replace('/login');
      }
    };

    processAuth();

    return () => {
      active = false;
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
      <div className="text-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-teal-400 mx-auto" />
        <p className="text-slate-400 text-sm">
          {error ? error : 'Completing authentication and setting up your portal...'}
        </p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
          <Loader2 className="w-10 h-10 animate-spin text-teal-400 mx-auto" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
