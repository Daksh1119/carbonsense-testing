'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import DashboardCard from '@/components/DashboardCard';
import Badge from '@/components/Badge';
import {
  Building2, Users, Activity, TrendingUp, AlertCircle,
  CheckCircle, Clock, Mail, RefreshCw, UserPlus, XCircle, ShieldCheck,
  ChevronRight, Phone, MapPin, Briefcase
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { showSuccessToast, showErrorToast } from '@/lib/toast';

interface OrgRow {
  id: string;
  name: string;
  sector: string;
  profileStatus: string;
  managerEmail: string | null;
  viewerCount: number;
  createdAt: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  organizations: { name: string } | null;
}

interface PendingViewer {
  id: string;
  organizationName: string;
  firstName: string;
  lastName: string;
  email: string;
  submittedAt: string;
}

interface PendingManager {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    sector: string;
    company_size_category: string;
    state: string;
    business_description: string;
  } | null;
}

interface Stats {
  totalOrgs: number;
  totalManagers: number;
  totalViewers: number;
  pendingManagerRequests: number;
  pendingInvites: number;
  pendingViewerRequests: number;
}

export default function PlatformAdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [companies, setCompanies] = useState<OrgRow[]>([]);
  const [pendingManagers, setPendingManagers] = useState<PendingManager[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [pendingViewers, setPendingViewers] = useState<PendingViewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (isSilent?: boolean | unknown) => {
    const isSilentUpdate = typeof isSilent === 'boolean' ? isSilent : false;
    if (!isSilentUpdate) {
      setLoading(true);
    }
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setError('Not authenticated.'); return; }

      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setError('Failed to load dashboard data.'); return; }

      const data = await res.json();
      setStats(data.stats);
      setCompanies(data.companiesList ?? []);
      setPendingManagers(data.pendingManagerRequests ?? []);
      setPendingInvites(data.pendingInvites ?? []);
      setPendingViewers(data.pendingViewerRequests ?? []);
    } catch {
      setError('Unexpected error loading dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(false);

    const handleSilentRefresh = () => {
      fetchDashboard(true);
    };

    const channel = supabase
      .channel('admin-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, handleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organizations' }, handleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_signup_requests' }, handleSilentRefresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDashboard]);

  const handleApproveManager = async (managerId: string, action: 'approve' | 'reject') => {
    setApprovingId(managerId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/admin/pending-managers', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId, action }),
      });
      const data = await res.json();
      if (res.ok) {
        showSuccessToast(action === 'approve' ? 'Manager approved!' : 'Manager rejected.');
        fetchDashboard(true);
      } else {
        showErrorToast(data.error ?? 'Action failed.');
      }
    } catch {
      showErrorToast('Failed to update status.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleApproveViewer = async (requestId: string, action: 'approve' | 'reject') => {
    setApprovingId(requestId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/auth/approve-employee', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });
      const data = await res.json();
      if (res.ok) {
        showSuccessToast(action === 'approve' ? 'Viewer request approved!' : 'Viewer request rejected.');
        fetchDashboard(true);
      } else {
        showErrorToast(data.error || 'Failed to process request.');
      }
    } catch {
      showErrorToast('Network error processing request.');
    } finally {
      setApprovingId(null);
    }
  };

  const totalPending = pendingManagers.length + pendingViewers.length + pendingInvites.length;

  const statCards = [
    { label: 'Total Companies', value: stats?.totalOrgs ?? 0, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Total Managers', value: stats?.totalManagers ?? 0, icon: Users, color: 'text-teal-400', bg: 'bg-teal-500/10' },
    { label: 'Pending Approvals', value: (stats?.pendingManagerRequests ?? 0) + (stats?.pendingViewerRequests ?? 0), icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Total Viewers', value: stats?.totalViewers ?? 0, icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Platform Overview</h1>
          <p className="text-slate-400 mt-1">Cross-organization monitoring and access control.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchDashboard}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/admin/access"
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-teal-500/10"
          >
            <ShieldCheck className="w-4 h-4" />
            Review Requests
            {totalPending > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs bg-slate-950 text-teal-300 rounded-full font-bold">
                {totalPending}
              </span>
            )}
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">{error}</div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-5 animate-pulse h-24" />
            ))
          : statCards.map((stat) => (
              <div key={stat.label} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2.5 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
              </div>
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Companies Table */}
        <div className="lg:col-span-2">
          <DashboardCard title="Companies" subtitle={`${companies.length} registered`}>
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 bg-slate-900/50 rounded-lg animate-pulse" />
              ))}</div>
            ) : companies.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No organizations yet.</p>
            ) : (
              <div className="space-y-3">
                {companies.map((company) => (
                  <div key={company.id} className="flex items-center justify-between p-3.5 bg-slate-900/50 border border-slate-700/50 rounded-xl hover:border-slate-600 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Building2 className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{company.name}</p>
                        <p className="text-xs text-slate-400">
                          {company.managerEmail ? `Manager: ${company.managerEmail}` : 'No manager assigned'} · {company.viewerCount} viewers
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">{company.sector}</span>
                      <Badge variant={company.profileStatus === 'complete' ? 'success' : 'warning'}>
                        {company.profileStatus === 'complete' ? 'active' : 'setup'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>

        {/* Pending Approvals */}
        <div>
          <DashboardCard
            title="Pending Actions"
            subtitle={`${totalPending} waiting for review`}
          >
            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 bg-slate-900/50 rounded-xl animate-pulse" />
                ))
              ) : totalPending === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">All clear — no pending actions</p>
                </div>
              ) : (
                <>
                  {/* Pending Manager Requests */}
                  {pendingManagers.map((item) => (
                    <div key={item.id} className="p-3.5 bg-slate-900/80 border border-teal-500/30 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                          <span className="text-xs font-bold text-teal-300">Manager Onboarding</span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                        </span>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-white">
                          {[item.firstName, item.lastName].filter(Boolean).join(' ') || item.email}
                        </p>
                        <p className="text-xs text-teal-200/90 font-medium">
                          {item.organization?.name ?? 'Company name pending'}
                        </p>
                      </div>

                      {item.organization && (
                        <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-400">
                          <span className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">
                            {item.organization.sector}
                          </span>
                          {item.organization.state && (
                            <span className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">
                              {item.organization.state}
                            </span>
                          )}
                        </div>
                      )}

                      {item.organization?.business_description && (
                        <p className="text-xs text-slate-300 line-clamp-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                          "{item.organization.business_description}"
                        </p>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleApproveManager(item.id, 'approve')}
                          disabled={approvingId === item.id}
                          className="flex-1 py-1.5 text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleApproveManager(item.id, 'reject')}
                          disabled={approvingId === item.id}
                          className="px-3 py-1.5 text-xs font-medium bg-slate-800 text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Pending Viewer Requests */}
                  {pendingViewers.map((item) => (
                    <div key={item.id} className="p-3 bg-slate-900/50 border border-slate-700/50 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-medium text-amber-300">Viewer Request</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{item.firstName} {item.lastName}</p>
                        <p className="text-xs text-slate-400">{item.organizationName}</p>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleApproveViewer(item.id, 'approve')}
                          disabled={approvingId === item.id}
                          className="px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle className="w-3 h-3 inline mr-1" />Approve
                        </button>
                        <button
                          onClick={() => handleApproveViewer(item.id, 'reject')}
                          disabled={approvingId === item.id}
                          className="px-2.5 py-1 text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600/50 rounded-lg hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </DashboardCard>
        </div>
      </div>

      {/* Quick actions */}
      <DashboardCard title="Quick Actions" subtitle="Common admin tasks">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/admin/access" className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl hover:border-teal-500/30 hover:bg-teal-500/5 transition-all group">
            <div className="p-2.5 bg-teal-500/10 rounded-lg group-hover:bg-teal-500/20 transition-colors">
              <ShieldCheck className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Review Requests</p>
              <p className="text-xs text-slate-400">Approve pending managers & viewers</p>
            </div>
          </Link>
          <Link href="/admin/recommendation-catalog" className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group">
            <div className="p-2.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Manage Catalog</p>
              <p className="text-xs text-slate-400">Edit recommendation entries</p>
            </div>
          </Link>
          <Link href="/admin/companies" className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group">
            <div className="p-2.5 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
              <Building2 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">View Companies</p>
              <p className="text-xs text-slate-400">All registered organizations</p>
            </div>
          </Link>
        </div>
      </DashboardCard>
    </div>
  );
}
