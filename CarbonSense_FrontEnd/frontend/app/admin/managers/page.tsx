'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import DashboardCard from '@/components/DashboardCard';
import Badge from '@/components/Badge';
import { showSuccessToast, showErrorToast } from '@/lib/toast';
import {
  Users, Building2, Search, CheckCircle, Clock,
  Mail, RefreshCw, XCircle, Trash2, AlertTriangle, ShieldCheck, ArrowRight
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface Manager {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  organization_id: string | null;
  approval_status: string;
  reviewer_notes?: string | null;
  created_at: string;
  orgName?: string;
}

export default function AdminManagersPage() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Manager | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

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
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name, organization_id, approval_status, reviewer_notes, created_at')
        .eq('role', 'manager')
        .order('created_at', { ascending: false });

      if (profileError) throw profileError;

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
    } catch (err) {
      console.error('[AdminManagers] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);

    const handleSilentRefresh = () => {
      fetchData(true);
    };

    const channel = supabase
      .channel('admin-managers-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, handleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organizations' }, handleSilentRefresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const handleQuickApprove = async (managerId: string, action: 'approve' | 'reject') => {
    setProcessingId(managerId);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/pending-managers', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId, action }),
      });
      const data = await res.json();
      if (res.ok) {
        showSuccessToast(action === 'approve' ? 'Manager approved!' : 'Manager rejected.');
        fetchData(true);
      } else {
        showErrorToast(data.error ?? 'Action failed.');
      }
    } catch {
      showErrorToast('Failed to update status.');
    } finally {
      setProcessingId(null);
    }
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
      if (!res.ok) {
        showErrorToast(data.error || 'Failed to remove manager.');
        return;
      }
      showSuccessToast('Manager removed successfully.');
      setDeleteTarget(null);
      fetchData();
    } catch {
      showErrorToast('Unexpected error removing manager.');
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

  const pendingCount = managers.filter((m) => m.approval_status === 'pending').length;
  const approvedCount = managers.filter((m) => m.approval_status === 'approved').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Managers</h1>
          <p className="text-slate-400 mt-1">Company carbon program leads registered on the platform.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/admin/access"
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-teal-500/10"
          >
            <ShieldCheck className="w-4 h-4" />
            Review Requests
            {pendingCount > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs bg-slate-950 text-teal-300 rounded-full font-bold">
                {pendingCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Total Managers', value: managers.length, icon: Users, color: 'text-teal-400', bg: 'bg-teal-500/10' },
          { label: 'Approved Active', value: approvedCount, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Pending Approval', value: pendingCount, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
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

      {/* Managers list */}
      <DashboardCard title="All Managers" subtitle={`${filtered.length} registered`}>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500/50"
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
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((manager) => (
              <div
                key={manager.id}
                className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-700/30 rounded-xl hover:border-slate-600/50 transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-teal-400">
                      {((manager.first_name?.[0] ?? manager.email[0]) || '?').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">
                        {manager.first_name || manager.last_name
                          ? `${manager.first_name ?? ''} ${manager.last_name ?? ''}`.trim()
                          : manager.email}
                      </p>
                      <Badge
                        variant={
                          manager.approval_status === 'approved'
                            ? 'success'
                            : manager.approval_status === 'rejected'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {manager.approval_status === 'approved' ? 'active' : manager.approval_status === 'rejected' ? 'rejected' : 'pending'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                      <Mail className="w-3 h-3 text-slate-500" />
                      <span>{manager.email}</span>
                      <span>·</span>
                      <span className="text-slate-400">{manager.orgName ?? 'Unassigned'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  {manager.approval_status === 'pending' && (
                    <button
                      onClick={() => handleQuickApprove(manager.id, 'approve')}
                      disabled={processingId === manager.id}
                      className="px-3 py-1 text-xs font-bold bg-teal-500 text-slate-950 rounded-lg hover:bg-teal-400 transition-colors disabled:opacity-50"
                    >
                      Approve
                    </button>
                  )}
                  {manager.approval_status === 'rejected' && (
                    <button
                      onClick={() => handleQuickApprove(manager.id, 'approve')}
                      disabled={processingId === manager.id}
                      className="px-3 py-1 text-xs font-semibold bg-slate-800 text-teal-400 border border-teal-500/20 rounded-lg hover:bg-teal-500/10 transition-colors disabled:opacity-50"
                    >
                      Re-Approve
                    </button>
                  )}
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

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-red-500/10 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Remove Manager Account</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-6">
              Are you sure you want to remove <span className="font-semibold text-white">{deleteTarget.email}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-800 rounded-xl border border-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteManager}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl disabled:opacity-50"
              >
                {isDeleting ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
