'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardCard from '@/components/DashboardCard';
import Badge from '@/components/Badge';
import {
  Building2, Users, Activity, TrendingUp, AlertCircle,
  CheckCircle, Clock, Mail, RefreshCw, UserPlus, XCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

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

interface Stats {
  totalOrgs: number;
  totalManagers: number;
  totalViewers: number;
  pendingInvites: number;
  pendingViewerRequests: number;
}

export default function PlatformAdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [companies, setCompanies] = useState<OrgRow[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [pendingViewers, setPendingViewers] = useState<PendingViewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
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
      setPendingInvites(data.pendingInvites ?? []);
      setPendingViewers(data.pendingViewerRequests ?? []);
    } catch {
      setError('Unexpected error loading dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleApproveViewer = async (requestId: string, action: 'approve' | 'reject') => {
    setApprovingId(requestId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      await fetch('/api/auth/approve-employee', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });
      fetchDashboard();
    } finally {
      setApprovingId(null);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    await fetch('/api/admin/invite-manager', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteId, action: 'cancel' }),
    });
    fetchDashboard();
  };

  const statCards = stats ? [
    { label: 'Total Companies', value: stats.totalOrgs, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Active Managers', value: stats.totalManagers, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Total Viewers', value: stats.totalViewers, icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Pending Actions', value: stats.pendingInvites + stats.pendingViewerRequests, icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ] : [];

  const totalPending = (stats?.pendingInvites ?? 0) + (stats?.pendingViewerRequests ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Platform Overview</h1>
          <p className="text-slate-400 mt-1">Live platform data — companies, managers, pending actions.</p>
        </div>
        <button
          onClick={fetchDashboard}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
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
                  <div key={company.id} className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700/50 rounded-lg">
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
          <DashboardCard title="Pending Actions" subtitle={`${totalPending} waiting`}>
            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 bg-slate-900/50 rounded-lg animate-pulse" />
                ))
              ) : totalPending === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">All clear — no pending actions</p>
                </div>
              ) : (
                <>
                  {/* Pending invites */}
                  {pendingInvites.map((inv) => (
                    <div key={inv.id} className="p-3 bg-slate-900/50 border border-slate-700/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Mail className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-xs font-medium text-blue-300">Invite Pending</span>
                      </div>
                      <p className="text-sm font-medium text-white truncate">{inv.email}</p>
                      <p className="text-xs text-slate-400">{inv.organizations?.name ?? '—'} · {inv.role}</p>
                      <button
                        onClick={() => handleCancelInvite(inv.id)}
                        className="mt-2 px-2.5 py-1 text-xs bg-slate-700/50 text-slate-300 border border-slate-600/50 rounded-lg hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors"
                      >
                        <XCircle className="w-3 h-3 inline mr-1" />Cancel
                      </button>
                    </div>
                  ))}

                  {/* Pending viewer requests */}
                  {pendingViewers.map((item) => (
                    <div key={item.id} className="p-3 bg-slate-900/50 border border-slate-700/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-medium text-amber-300">Viewer Request</span>
                      </div>
                      <p className="text-sm font-medium text-white">{item.firstName} {item.lastName}</p>
                      <p className="text-xs text-slate-400">{item.organizationName}</p>
                      <div className="flex gap-2 mt-2">
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
                          <Clock className="w-3 h-3 inline mr-1" />Reject
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
          <a href="/admin/managers" className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group">
            <div className="p-2.5 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
              <UserPlus className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Invite Manager</p>
              <p className="text-xs text-slate-400">Add a new manager to an org</p>
            </div>
          </a>
          <a href="/admin/recommendation-catalog" className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group">
            <div className="p-2.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Manage Catalog</p>
              <p className="text-xs text-slate-400">Edit recommendation entries</p>
            </div>
          </a>
          <a href="/admin/companies" className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group">
            <div className="p-2.5 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
              <Building2 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">View Companies</p>
              <p className="text-xs text-slate-400">All registered organizations</p>
            </div>
          </a>
        </div>
      </DashboardCard>
    </div>
  );
}
