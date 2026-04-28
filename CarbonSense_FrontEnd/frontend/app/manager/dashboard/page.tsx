'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUserStore } from '@/store';
import { BarChart3, Users, Upload, TrendingDown, Clock, UserCheck } from 'lucide-react';

interface PendingApproval {
  id: string;
  userId: string;
  organizationName?: string;
  managerEmail?: string;
  status: string;
  submittedAt?: string;
  firstName?: string;
  lastName?: string;
  applicantEmail?: string;
  department?: string;
  jobTitle?: string;
}

const iconTone: Record<string, string> = {
  teal: 'bg-teal-500/10 text-teal-400',
  sky: 'bg-sky-500/10 text-sky-400',
  emerald: 'bg-emerald-500/10 text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-400',
};

export default function ManagerDashboardPage() {
  const { user, token } = useUserStore();
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(true);
  const [actioningRequestId, setActioningRequestId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const activeApprovals = useMemo(
    () => pendingApprovals.filter((request) => request.status === 'pending'),
    [pendingApprovals]
  );

  const loadPendingApprovals = async () => {
    if (!token) {
      setLoadingApprovals(false);
      return;
    }

    setLoadingApprovals(true);
    setError('');
    try {
      const res = await fetch('/api/auth/pending-approvals', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load pending approvals.');
      }

      setPendingApprovals(Array.isArray(data?.requests) ? data.requests : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending approvals.');
    } finally {
      setLoadingApprovals(false);
    }
  };

  useEffect(() => {
    if (user?.role !== 'manager') {
      setLoadingApprovals(false);
      return;
    }
    loadPendingApprovals();
    // loadPendingApprovals is token-bound by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, token]);

  const reviewRequest = async (requestId: string, action: 'approve' | 'reject') => {
    setActioningRequestId(requestId);
    setError('');
    try {
      const res = await fetch('/api/auth/approve-employee', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ requestId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to review request.');
      }

      setPendingApprovals((current) =>
        current.map((request) =>
          request.id === requestId
            ? { ...request, status: action === 'approve' ? 'approved' : 'rejected' }
            : request
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review request.');
    } finally {
      setActioningRequestId(null);
    }
  };

  const cards = [
    { title: 'Total Emissions', value: '—', sub: 'tCO2e this period', icon: TrendingDown, color: 'teal' },
    { title: 'Data Uploads', value: '—', sub: 'pending processing', icon: Upload, color: 'sky' },
    { title: 'Team Members', value: '—', sub: 'active users', icon: Users, color: 'emerald' },
    {
      title: 'Pending Approvals',
      value: String(activeApprovals.length),
      sub: 'employee requests',
      icon: UserCheck,
      color: 'amber',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {user?.name || 'Manager'}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {user?.organization || 'Your organization'} — Carbon Management Overview
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div
            key={c.title}
            className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">{c.title}</span>
              <div className={`p-2 rounded-lg ${iconTone[c.color] || ''}`}>
                <c.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{c.value}</p>
            <p className="text-xs text-slate-500 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-400" />
            Monthly Emissions Trend
          </h2>
          <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
            Chart data will populate after data ingestion
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Pending Employee Approvals
          </h2>
          <div className="space-y-3">
            {error && (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {loadingApprovals ? (
              <div className="h-24 flex items-center justify-center text-slate-500 text-sm">
                Loading pending requests...
              </div>
            ) : activeApprovals.length === 0 ? (
              <div className="h-24 flex items-center justify-center text-slate-600 text-sm">
                No pending requests
              </div>
            ) : (
              activeApprovals.slice(0, 5).map((request) => (
                <div key={request.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-white font-medium">
                        {[request.firstName, request.lastName].filter(Boolean).join(' ') || 'Employee'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {request.applicantEmail || 'No applicant email'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {request.jobTitle || 'Role not provided'} {request.department ? `• ${request.department}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => reviewRequest(request.id, 'approve')}
                        disabled={actioningRequestId === request.id}
                        className="text-xs px-2.5 py-1.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewRequest(request.id, 'reject')}
                        disabled={actioningRequestId === request.id}
                        className="text-xs px-2.5 py-1.5 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {!loadingApprovals && activeApprovals.length > 0 && (
              <button
                type="button"
                onClick={loadPendingApprovals}
                className="text-xs text-amber-300 hover:text-amber-200"
              >
                Refresh approvals
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
