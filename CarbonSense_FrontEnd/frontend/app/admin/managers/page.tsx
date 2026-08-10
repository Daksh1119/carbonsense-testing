'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardCard from '@/components/DashboardCard';
import Badge from '@/components/Badge';
import { showSuccessToast, showErrorToast } from '@/lib/toast';
import {
  Users, Building2, Search, CheckCircle, Clock,
  Mail, UserPlus, X, RefreshCw, Send, AlertCircle, XCircle, Trash2, AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface Manager {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  organization_id: string | null;
  approved: boolean;
  created_at: string;
  orgName?: string;
  viewerCount?: number;
}

interface Org {
  id: string;
  name: string;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  organizations: { name: string } | null;
}

export default function AdminManagersPage() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Manager | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteOrgId, setInviteOrgId] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'viewer'>('manager');
  const [inviteNotes, setInviteNotes] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, invitesRes] = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/invite-manager?status=pending', { headers }),
      ]);

      if (statsRes.ok) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, email, first_name, last_name, organization_id, approved, created_at')
          .eq('role', 'manager')
          .order('created_at', { ascending: false });

        const { data: orgsData } = await supabase
          .from('organizations')
          .select('id, name')
          .order('name');

        const orgMap: Record<string, string> = {};
        (orgsData ?? []).forEach((o) => { orgMap[o.id] = o.name; });

        setManagers((profiles ?? []).map((p) => ({
          ...p,
          orgName: p.organization_id ? orgMap[p.organization_id] : 'No Org Assigned',
        })));
        setOrgs(orgsData ?? []);
      }

      if (invitesRes.ok) {
        const invData = await invitesRes.json();
        setInvites(invData.invites ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    if (!inviteEmail || !inviteOrgId) {
      setInviteError('Email and organization choice are required.');
      return;
    }
    setInviteLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/invite-manager', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          organizationId: inviteOrgId === 'NEW_ORG' ? null : inviteOrgId,
          role: inviteRole,
          notes: inviteNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setInviteError(data.error ?? 'Failed to send invite.'); return; }
      
      const targetMsg = inviteOrgId === 'NEW_ORG'
        ? `Invite sent to ${inviteEmail}. They will setup their company profile on signup.`
        : `Invite sent to ${inviteEmail}. They will get ${inviteRole} access upon signup.`;
      
      setInviteSuccess(targetMsg);
      showSuccessToast(targetMsg);
      setInviteEmail(''); setInviteOrgId(''); setInviteNotes('');
      fetchData();
    } catch {
      setInviteError('Unexpected error. Please try again.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    const token = await getToken();
    await fetch('/api/admin/invite-manager', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteId, action: 'cancel' }),
    });
    fetchData();
  };

  const handleDeleteManager = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/managers?id=${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to remove manager');

      showSuccessToast(`Manager ${deleteTarget.email} removed.`);
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      showErrorToast(err?.message ?? 'Failed to remove manager');
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = managers.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.email.toLowerCase().includes(q) ||
      (m.first_name ?? '').toLowerCase().includes(q) ||
      (m.last_name ?? '').toLowerCase().includes(q) ||
      (m.orgName ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Managers</h1>
          <p className="text-slate-400 mt-1">All company carbon program leads registered on the platform.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => { setShowModal(true); setInviteSuccess(''); setInviteError(''); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Invite Manager
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Total Managers', value: managers.length, icon: Users, color: 'text-teal-400', bg: 'bg-teal-500/10' },
          { label: 'Approved', value: managers.filter((m) => m.approved).length, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Pending Invites', value: invites.length, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        ].map((stat) => (
          <div key={stat.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className={`inline-flex p-2 rounded-lg ${stat.bg} mb-3`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <DashboardCard title="Pending Invites" subtitle={`${invites.length} awaiting signup`}>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-slate-900/50 border border-amber-500/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Mail className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{inv.email}</p>
                    <p className="text-xs text-slate-400">
                      {inv.organizations?.name ?? 'New Company (Onboarding)'} · {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleCancelInvite(inv.id)}
                  className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                  title="Cancel invite"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </DashboardCard>
      )}

      {/* Managers list */}
      <DashboardCard title="All Managers" subtitle={`${filtered.length} registered`}>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-slate-900/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No managers found.</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Invite manager
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((manager) => (
              <div key={manager.id} className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-700/30 rounded-xl hover:border-slate-600/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-teal-400">
                      {(manager.first_name?.[0] ?? manager.email[0]).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-white">
                      {manager.first_name && manager.last_name
                        ? `${manager.first_name} ${manager.last_name}`
                        : manager.email}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                      <Mail className="w-3 h-3" />{manager.email}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="hidden md:flex items-center gap-1.5 text-slate-300">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs">{manager.orgName ?? 'Unassigned'}</span>
                  </div>
                  <Badge variant={manager.approved ? 'success' : 'warning'}>
                    {manager.approved ? 'active' : 'pending'}
                  </Badge>
                  <button
                    onClick={() => setDeleteTarget(manager)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Remove Manager"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>

      {/* Invite Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <UserPlus className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Invite Manager</h2>
                  <p className="text-xs text-slate-400">They will get access upon signup.</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="p-6 space-y-4">
              {inviteError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{inviteError}
                </div>
              )}
              {inviteSuccess && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />{inviteSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email Address *</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="manager@company.com"
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Organization *</label>
                <select
                  required
                  value={inviteOrgId}
                  onChange={(e) => setInviteOrgId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500/60 transition-colors"
                >
                  <option value="">Select organization...</option>
                  <option value="NEW_ORG" className="text-emerald-400 font-semibold">
                    + Invite for New Company (Manager completes company setup on signup)
                  </option>
                  {orgs.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Role</label>
                <div className="flex gap-3">
                  {(['manager', 'viewer'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setInviteRole(r)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors capitalize ${
                        inviteRole === r
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Notes (optional)</label>
                <input
                  type="text"
                  value={inviteNotes}
                  onChange={(e) => setInviteNotes(e.target.value)}
                  placeholder="e.g. Head of Sustainability"
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  {inviteLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <><Send className="w-4 h-4" />Send Invite</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Manager Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Remove Manager</h3>
                <p className="text-xs text-slate-400">Remove access from platform</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Are you sure you want to remove manager <strong className="text-white">{deleteTarget.email}</strong>?
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteManager}
                disabled={isDeleting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" />Remove Manager</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
