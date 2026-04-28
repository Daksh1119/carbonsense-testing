'use client';

import Link from 'next/link';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { useUserStore } from '@/store';
import { getRoleDashboardPath } from '@/lib/authHelpers';

export default function UnauthorizedPage() {
  const { user } = useUserStore();
  const dashboardPath = user ? getRoleDashboardPath(user.role) : '/login';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mb-6">
          <ShieldX className="w-10 h-10 text-red-400" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-slate-400 mb-2 text-sm">
          You don&apos;t have permission to access this page.
        </p>

        {user && (
          <p className="text-sm text-slate-500 mb-6">
            Your current role: <span className="text-white font-medium capitalize">{user.role}</span>
          </p>
        )}

        <Link
          href={dashboardPath}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
        >
          <ArrowLeft className="w-4 h-4" />
          Go to your dashboard
        </Link>
      </div>
    </div>
  );
}
