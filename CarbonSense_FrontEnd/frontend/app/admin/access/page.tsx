'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardCard from '@/components/DashboardCard';
import {
  Shield, Users, Key, Lock, Eye, EyeOff, RefreshCw,
  CheckCircle, XCircle, Clock, Mail, Building2, AlertCircle, UserCheck, Phone
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const roles = [
  {
    role: 'Platform Admin',
    description: 'CarbonSense internal team. Full platform visibility and control.',
    color: 'emerald',
    permissions: ['View all organizations', 'Manage companies', 'Invite managers', 'Platform settings', 'View all data', 'Access control'],
  },
  {
    role: 'Manager',
    description: 'Client company carbon program lead. Full CRUD on own organization.',
    color: 'teal',
    permissions: ['Data ingestion', 'Team management', 'Approve viewers', 'Compliance tracking', 'Recommendations', 'Analytics', 'TEME', 'Policy intelligence'],
  },
  {
    role: 'Viewer',
    description: 'Client company employee. Read-only access to own organization dashboards.',
    color: 'sky',
    permissions: ['View dashboards', 'View emissions', 'View reports', 'View targets', 'Personal profile'],
  },
];

interface PendingRequest {
  id: string;
  userId: string;
  organizationName: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  jobTitle: string;
  submittedAt: string;
  managerEmail: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  organizations: { name: string } | null;
}

interface PendingManager {
  id: string;
  email: string;
  role: string;
  first_name: string;
  last_name: string;
  phone: string;
  job_title: string;
  approval_status: string;
  reviewer_notes: string;
  created_at: string;
  organizations: {
    id: string;
    name: string;
    sector: string;
    company_size_category: string;
    state: string;
    business_description: string;
  } | null;
}

export default function AdminAccessPage() {
  const [showToken, setShowToken] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [pendingManagers, setPendingManagers] = useState<PendingManager[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'viewers' | 'managers' | 'invites'>('managers');
  const [rejectingManagerId, setRejectingManagerId] = useState<string | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState<string>('');

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  };

  const fetchData = useCallback(async (isSilent?: boolean | unknown) => {
    const isSilentUpdate = typeof isSilent === 'boolean' ? isSilent : false;
    if (!isSilentUpdate) {
      setLoading(true);
    }
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [reqRes, invRes, mgrRes] = await Promise.all([
        fetch('/api/auth/pending-approvals', { headers }),
        fetch('/api/admin/invite-manager?status=pending', { headers }),
        fetch('/api/admin/pending-managers', { headers }),
      ]);

      if (reqRes.ok) {
        const data = await reqRes.json();
        setPendingRequests(data.requests ?? []);
      }
      if (invRes.ok) {
        const data = await invRes.json();
        setPendingInvites(data.invites ?? []);
      }
      if (mgrRes.ok) {
        const data = await mgrRes.json();
        setPendingManagers(data.managers ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);

    const handleSilentRefresh = () => {
      fetchData(true);
    };

    // Supabase Realtime channel for live updates
    const channel = supabase
      .channel('admin-access-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'manager_invites' }, handleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_signup_requests' }, handleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, handleSilentRefresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const handleApprove = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessingId(requestId);
    setNotification(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/auth/approve-employee', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({ msg: data.message, type: 'success' });
        fetchData();
      } else {
        setNotification({ msg: data.error ?? 'Action failed.', type: 'error' });
      }
    } catch {
      setNotification({ msg: 'Unexpected error.', type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleManagerApprove = async (managerId: string, action: 'approve' | 'reject', notes?: string) => {
    setProcessingId(managerId);
    setNotification(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/pending-managers', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId, action, reviewerNotes: notes }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({ msg: data.message, type: 'success' });
        fetchData();
      } else {
        setNotification({ msg: data.error ?? 'Action failed.', type: 'error' });
      }
    } catch {
      setNotification({ msg: 'Unexpected error.', type: 'error' });
    } finally {
      setProcessingId(null);
      setRejectingManagerId(null);
      setReviewerNotes('');
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    setProcessingId(inviteId);
    try {
      const token = await getToken();
      await fetch('/api/admin/invite-manager', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId, action: 'cancel' }),
      });
      fetchData();
    } finally {
      setProcessingId(null);
    }
  };

  const totalPending = pendingRequests.length + pendingInvites.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Access Control</h1>
          <p className="text-slate-400 mt-1">Role definitions, pending approvals, and active invites.</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {notification && (
        <div className={`flex items-center gap-2 p-4 rounded-xl text-sm border ${
          notification.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {notification.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {notification.msg}
        </div>
      )}

      {/* Role cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {roles.map((r) => (
          <div key={r.role} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg bg-${r.color}-500/10`}>
                <Shield className={`w-4 h-4 text-${r.color}-400`} />
              </div>
              <p className="font-bold text-white text-sm">{r.role}</p>
            </div>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">{r.description}</p>
            <div className="space-y-1.5">
              {r.permissions.map((p) => (
                <div key={p} className="flex items-center gap-2 text-xs text-slate-300">
                  <div className={`w-1.5 h-1.5 rounded-full bg-${r.color}-400 flex-shrink-0`} />
                  {p}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-800 gap-1 mt-4">
        <button
          onClick={() => setActiveTab('managers')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all duration-200 ${
            activeTab === 'managers'
              ? 'border-teal-500 text-teal-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Manager Requests ({pendingManagers.length})
        </button>
        <button
          onClick={() => setActiveTab('viewers')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all duration-200 ${
            activeTab === 'viewers'
              ? 'border-teal-500 text-teal-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Viewer Requests ({pendingRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('invites')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all duration-200 ${
            activeTab === 'invites'
              ? 'border-teal-500 text-teal-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Active Invites ({pendingInvites.length})
        </button>
      </div>

      {activeTab === 'managers' && (
        <DashboardCard
          title="Pending Manager Registrations"
          subtitle={loading ? 'Loading...' : `${pendingManagers.length} awaiting review`}
        >
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 bg-slate-900/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : pendingManagers.length === 0 ? (
            <div className="text-center py-10">
              <UserCheck className="w-10 h-10 text-teal-400 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No pending manager requests — all clear!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingManagers.map((mgr) => (
                <div key={mgr.id} className="p-5 bg-slate-900/50 border border-slate-800 rounded-xl space-y-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white text-base">
                          {mgr.first_name || 'Anonymous'} {mgr.last_name || 'User'}
                        </p>
                        {mgr.approval_status === 'rejected' && (
                          <span className="px-2 py-0.5 text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded-full font-medium">
                            Previously Rejected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-500" /> {mgr.email}
                      </p>
                      {mgr.phone && (
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-500" /> {mgr.phone}
                        </p>
                      )}
                      {mgr.job_title && (
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-slate-500" /> {mgr.job_title}
                        </p>
                      )}
                    </div>

                    <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 md:w-80 space-y-2 text-xs flex-shrink-0">
                      <div className="font-semibold text-slate-300 border-b border-slate-800 pb-1.5 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-teal-400" /> Organisation Details
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Name:</span>
                        <span className="font-medium text-slate-300">{mgr.organizations?.name || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Sector:</span>
                        <span className="font-medium text-slate-300">{mgr.organizations?.sector || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Size Category:</span>
                        <span className="font-medium text-slate-300">{mgr.organizations?.company_size_category || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">State:</span>
                        <span className="font-medium text-slate-300">{mgr.organizations?.state || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {mgr.organizations?.business_description && (
                    <div className="bg-slate-950/20 border border-slate-800 rounded-lg p-3">
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Organisation Activities</p>
                      <p className="text-xs text-slate-300 leading-relaxed italic">
                        "{mgr.organizations.business_description}"
                      </p>
                    </div>
                  )}

                  {mgr.reviewer_notes && (
                    <div className="bg-red-950/10 border border-red-950/30 rounded-lg p-3">
                      <p className="text-[10px] uppercase font-bold text-red-400 tracking-wider mb-1">Previous Rejection Notes</p>
                      <p className="text-xs text-slate-400">{mgr.reviewer_notes}</p>
                    </div>
                  )}

                  {rejectingManagerId === mgr.id ? (
                    <div className="bg-slate-950/40 p-4 border border-red-900/30 rounded-xl space-y-3">
                      <label className="block text-xs font-semibold text-slate-400">Rejection Reason (Feedback for the manager)</label>
                      <textarea
                        value={reviewerNotes}
                        onChange={(e) => setReviewerNotes(e.target.value)}
                        placeholder="Provide details on why this application is rejected..."
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500 transition-colors"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleManagerApprove(mgr.id, 'reject', reviewerNotes)}
                          disabled={processingId === mgr.id || !reviewerNotes.trim()}
                          className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50"
                        >
                          Confirm Rejection
                        </button>
                        <button
                          onClick={() => {
                            setRejectingManagerId(null);
                            setReviewerNotes('');
                          }}
                          className="px-3 py-1.5 text-xs font-semibold bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 border-t border-slate-800/80 pt-3">
                      <button
                        onClick={() => handleManagerApprove(mgr.id, 'approve')}
                        disabled={processingId !== null}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-teal-500 text-slate-950 rounded-lg hover:bg-teal-400 transition-all font-bold disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Approve Account
                      </button>
                      <button
                        onClick={() => setRejectingManagerId(mgr.id)}
                        disabled={processingId !== null}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject Request
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DashboardCard>
      )}

      {activeTab === 'viewers' && (
        <DashboardCard
          title="Pending Viewer Requests"
          subtitle={loading ? 'Loading...' : `${pendingRequests.length} awaiting approval`}
        >
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 bg-slate-900/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-10">
              <UserCheck className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No pending viewer requests — all clear!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => (
                <div key={req.id} className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-amber-400">
                          {(req.firstName?.[0] ?? req.email?.[0] ?? '?').toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-white text-sm">
                          {req.firstName} {req.lastName}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                          <Mail className="w-3 h-3" />{req.email}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                          <Building2 className="w-3 h-3" />{req.organizationName ?? '—'} · {req.jobTitle ?? req.department ?? 'No title'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-slate-500">
                        {new Date(req.submittedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 border-t border-slate-805/40 pt-3">
                    <button
                      onClick={() => handleApprove(req.id, 'approve')}
                      disabled={processingId === req.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />Approve
                    </button>
                    <button
                      onClick={() => handleApprove(req.id, 'reject')}
                      disabled={processingId === req.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>
      )}

      {activeTab === 'invites' && (
        <DashboardCard
          title="Active Invites"
          subtitle={`${pendingInvites.length} pending`}
        >
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-16 bg-slate-900/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : pendingInvites.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No active invites. Go to Managers to invite someone.</p>
          ) : (
            <div className="space-y-2">
              {pendingInvites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700/30 rounded-xl hover:border-slate-600/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Mail className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{inv.email}</p>
                      <p className="text-xs text-slate-400">
                        {inv.organizations?.name ?? '—'} · {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-0.5 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                      <Clock className="w-3 h-3 inline mr-1" />pending
                    </span>
                    <button
                      onClick={() => handleCancelInvite(inv.id)}
                      disabled={processingId === inv.id}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Cancel invite"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>
      )}

      {/* Service Role Key */}
      <DashboardCard title="Service Role Key" subtitle="Used by API routes to bypass RLS">
        <div className="flex items-center gap-3 p-3 bg-slate-900/50 border border-slate-700/30 rounded-lg">
          <Key className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div className="flex-1 font-mono text-xs text-slate-300 truncate">
            {showToken ? 'SUPABASE_SERVICE_ROLE_KEY set in .env' : '••••••••••••••••••••••••••••••••••'}
          </div>
          <button onClick={() => setShowToken(!showToken)} className="text-slate-500 hover:text-slate-300 transition-colors">
            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <Lock className="w-4 h-4 text-slate-600" />
        </div>
        <p className="text-xs text-slate-500 mt-2">Never expose this key in client-side code.</p>
      </DashboardCard>
    </div>
  );
}
