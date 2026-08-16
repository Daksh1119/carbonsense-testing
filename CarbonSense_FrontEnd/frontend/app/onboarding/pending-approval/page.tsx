'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store';
import { supabase } from '@/lib/supabaseClient';
import { Clock, AlertTriangle, LogOut, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { showSuccessToast, showErrorToast } from '@/lib/toast';

export default function PendingApprovalPage() {
  const router = useRouter();
  const { user, logout, updateUser } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'pending' | 'rejected' | 'approved'>('pending');
  const [notes, setNotes] = useState<string>('');

  const checkStatus = async (silent = false) => {
    if (!user?.id) return;
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('approval_status, reviewer_notes')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setStatus(data.approval_status as 'pending' | 'rejected' | 'approved');
        setNotes(data.reviewer_notes || '');
        
        // Sync Zustand store
        updateUser({
          approvalStatus: data.approval_status as 'pending' | 'approved' | 'rejected',
          reviewerNotes: data.reviewer_notes || undefined,
        });

        if (data.approval_status === 'approved') {
          showSuccessToast('Your account has been approved! Redirecting...');
          router.replace('/dashboard');
        }
      }
    } catch (err) {
      console.error('[PendingApproval] Error checking approval status:', err);
      if (!silent) showErrorToast('Failed to refresh status.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();

    // Set up polling interval to check approval status every 10 seconds
    const interval = setInterval(() => {
      checkStatus(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [user?.id]);

  const handleEdit = () => {
    router.push('/onboarding/company-profile');
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-teal-400 mx-auto" />
          <p className="text-slate-400 text-sm">Checking your approval status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl animate-[pulse_6s_ease-in-out_infinite]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl animate-[pulse_8s_ease-in-out_infinite]" />
      </div>

      <div className="relative z-10 w-full max-w-lg bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 backdrop-blur-xl shadow-2xl text-center space-y-6">
        {status === 'rejected' ? (
          <>
            <div className="mx-auto w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">Onboarding Request Rejected</h1>
              <p className="text-slate-400 text-sm">
                Your application to use the software was not approved by the administration.
              </p>
            </div>

            {notes && (
              <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-4 text-left">
                <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">Feedback from Admin</h4>
                <p className="text-slate-300 text-sm leading-relaxed">{notes}</p>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleEdit}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm bg-teal-500 text-slate-950 hover:bg-teal-400 rounded-xl transition-all font-bold shadow-lg shadow-teal-500/10"
              >
                Edit and Resubmit <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all font-semibold border border-slate-700/50"
              >
                <LogOut className="w-4 h-4" /> Log Out
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto w-16 h-16 bg-teal-500/10 border border-teal-500/20 rounded-full flex items-center justify-center relative">
              <Clock className="w-8 h-8 text-teal-400 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">Pending Admin Approval</h1>
              <p className="text-slate-400 text-sm">
                Your company onboarding details have been submitted. Our administrators are currently reviewing your request.
              </p>
            </div>

            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 text-left text-xs text-slate-400 space-y-2">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span>Company Name</span>
                <span className="font-semibold text-slate-200">{user?.organization || 'New Organization'}</span>
              </div>
              <div className="flex justify-between">
                <span>Account Role</span>
                <span className="font-semibold text-slate-200 uppercase">{user?.role}</span>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => checkStatus()}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl transition-all font-semibold border border-slate-700/50"
              >
                <RefreshCw className="w-4 h-4" /> Refresh Status
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm bg-slate-800/40 hover:bg-slate-800 text-slate-400 rounded-xl transition-all font-semibold border border-slate-800"
              >
                <LogOut className="w-4 h-4" /> Log Out
              </button>
            </div>
            <p className="text-[10px] text-slate-600 animate-pulse pt-2">
              This screen will auto-refresh when your account is approved.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
