'use client';

/**
 * Admin Plantation Verification page (/admin/plantation)
 *
 * Shows:
 *  - KPI strip (total reports, pending, orgs with activity)
 *  - Reports table (all orgs) with review status, flags, imagery, search/filter
 *  - Inline review panel (review_plantation_report RPC)
 *  - Link to satellite imagery refresh
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TreePine, Search, RefreshCw, ShieldCheck, AlertTriangle,
  Clock, CheckCircle2, BarChart3, Building2, Camera,
  ChevronDown, ChevronUp, MapPin, Info,
} from 'lucide-react';
import DashboardCard from '@/components/DashboardCard';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import { supabase } from '@/lib/supabaseClient';
import { showSuccessToast, showErrorToast } from '@/lib/toast';
import { reviewReport, getReportFlags, type PlantationFlag } from '@/lib/plantation-api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminReportRow {
  id: string;
  org_id: string;
  org_name: string;
  site_id: string;
  site_name: string;
  submitted_at: string;
  period_label: string;
  is_interim: boolean;
  trees_planted_cumulative: number;
  trees_planted_this_period: number;
  survival_rate_pct: number | null;
  review_status: 'pending' | 'reviewed' | 'needs_attention';
  admin_note: string | null;
  imagery_status: 'pending' | 'ready' | 'failed' | 'skipped';
  latitude: number;
  longitude: number;
  area_hectares: number;
  photo_count?: number;
  flag_count?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(s: AdminReportRow['review_status']) {
  if (s === 'reviewed') return <Badge variant="success">Reviewed</Badge>;
  if (s === 'needs_attention') return <Badge variant="danger">Needs Attention</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

function imageryBadge(s: AdminReportRow['imagery_status']) {
  if (s === 'ready') return <Badge variant="info" size="sm">Ready</Badge>;
  if (s === 'failed') return <Badge variant="warning" size="sm">Failed</Badge>;
  if (s === 'skipped') return <Badge variant="default" size="sm">Skipped</Badge>;
  return <Badge variant="default" size="sm">Pending</Badge>;
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminPlantationPage() {
  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Review panel
  const [reviewTarget, setReviewTarget] = useState<AdminReportRow | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'pending' | 'reviewed' | 'needs_attention'>('reviewed');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // Flags for expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedFlags, setExpandedFlags] = useState<PlantationFlag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Use the admin view via service role (or direct Supabase query for admin)
      const { data, error } = await supabase
        .from('plantation_reports_admin_v')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      setReports((data ?? []) as AdminReportRow[]);
    } catch (err: any) {
      showErrorToast(err?.message ?? 'Failed to load plantation reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadFlags = async (reportId: string) => {
    if (expandedId === reportId) { setExpandedId(null); return; }
    setExpandedId(reportId);
    setFlagsLoading(true);
    try {
      const flags = await getReportFlags(reportId);
      setExpandedFlags(flags);
    } catch {
      setExpandedFlags([]);
    } finally {
      setFlagsLoading(false);
    }
  };

  const handleReview = async () => {
    if (!reviewTarget) return;
    setReviewing(true);
    try {
      await reviewReport(reviewTarget.id, reviewStatus, reviewNote || undefined);
      showSuccessToast(`Report ${reviewTarget.period_label} marked as "${reviewStatus}"`);
      setReviewTarget(null);
      setReviewNote('');
      load();
    } catch (err: any) {
      showErrorToast(err?.message ?? 'Review failed');
    } finally {
      setReviewing(false);
    }
  };

  const handleRefreshImagery = async (reportId: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token ?? '';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
      const form = new FormData();
      // Get current user id
      const uid = session.session?.user?.id ?? '';
      form.set('user_id', uid);
      const res = await fetch(`${apiUrl}/plantation/reports/${reportId}/refresh-imagery`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.detail ?? 'Refresh failed');
      }
      showSuccessToast('Imagery refresh queued — check back in a few minutes.');
    } catch (err: any) {
      showErrorToast(err?.message ?? 'Imagery refresh failed');
    }
  };

  // Filtered + searched reports
  const filtered = useMemo(() => {
    return reports.filter((r) => {
      const matchesSearch =
        !search ||
        r.org_name.toLowerCase().includes(search.toLowerCase()) ||
        r.site_name.toLowerCase().includes(search.toLowerCase()) ||
        r.period_label.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || r.review_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [reports, search, statusFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const total = reports.length;
    const pending = reports.filter((r) => r.review_status === 'pending').length;
    const attention = reports.filter((r) => r.review_status === 'needs_attention').length;
    const orgs = new Set(reports.map((r) => r.org_id)).size;
    return { total, pending, attention, orgs };
  }, [reports]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <TreePine className="w-7 h-7 text-primary" />
            Plantation Verification
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Review and verify plantation reports submitted by companies.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Reports', value: kpis.total, icon: BarChart3, color: 'text-sky-400', bg: 'bg-sky-500/10' },
          { label: 'Pending Review', value: kpis.pending, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Needs Attention', value: kpis.attention, icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10' },
          { label: 'Active Companies', value: kpis.orgs, icon: Building2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        ].map((k) => (
          <div key={k.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className={`inline-flex p-2 rounded-lg ${k.bg} mb-2`}>
              <k.icon className={`w-4 h-4 ${k.color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{loading ? '—' : k.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <DashboardCard
        title="Plantation Reports"
        subtitle={loading ? 'Loading…' : `${filtered.length} of ${reports.length} reports`}
      >
        {/* Filters */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search company, site, or period…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-primary/50"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="needs_attention">Needs Attention</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-800/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-500 py-8 text-sm">No reports match your filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  {['Company', 'Site', 'Period', 'Submitted', 'Trees (Σ)', 'Status', 'Imagery', 'Flags', 'Actions'].map((h) => (
                    <th key={h} className="pb-3 pr-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {filtered.map((r) => (
                  <>
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-700/20 transition-colors ${expandedId === r.id ? 'bg-slate-700/10' : ''}`}
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="text-white font-medium whitespace-nowrap max-w-32 truncate">{r.org_name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-slate-300 whitespace-nowrap max-w-28 truncate block">{r.site_name}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="text-slate-300">{r.period_label}</span>
                          {r.is_interim && <Badge variant="info" size="sm">Interim</Badge>}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-400 text-xs whitespace-nowrap">{formatDate(r.submitted_at)}</td>
                      <td className="py-3 pr-4 text-white font-medium">{r.trees_planted_cumulative.toLocaleString('en-IN')}</td>
                      <td className="py-3 pr-4">{statusBadge(r.review_status)}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          {imageryBadge(r.imagery_status)}
                          {(r.imagery_status === 'failed' || r.imagery_status === 'skipped') && (
                            <button
                              onClick={() => handleRefreshImagery(r.id)}
                              className="text-slate-500 hover:text-primary transition-colors"
                              title="Re-run imagery job"
                            >
                              <RefreshCw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <button
                          onClick={() => loadFlags(r.id)}
                          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-primary transition-colors"
                        >
                          {(r.flag_count ?? 0) > 0 && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                          <span>{r.flag_count ?? 0}</span>
                          {expandedId === r.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => {
                            setReviewTarget(r);
                            setReviewStatus(r.review_status === 'pending' ? 'reviewed' : r.review_status);
                            setReviewNote(r.admin_note ?? '');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/30 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 transition-colors whitespace-nowrap"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Review
                        </button>
                      </td>
                    </tr>

                    {/* Expanded flags row */}
                    {expandedId === r.id && (
                      <tr key={`${r.id}-flags`} className="bg-slate-800/30">
                        <td colSpan={9} className="px-4 py-3">
                          {flagsLoading ? (
                            <p className="text-xs text-slate-500 animate-pulse">Loading flags…</p>
                          ) : expandedFlags.length === 0 ? (
                            <p className="text-xs text-slate-500 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              No flags on this report.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {expandedFlags.map((f) => (
                                <div key={f.id} className="flex items-start gap-2 text-xs">
                                  {f.severity === 'alert' && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 mt-0.5 flex-shrink-0" />}
                                  {f.severity === 'warn' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />}
                                  {f.severity === 'info' && <Info className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />}
                                  <span className="text-slate-300 font-medium">{f.code}</span>
                                  <span className="text-slate-500">{JSON.stringify(f.detail)}</span>
                                  {!f.visible_to_manager && (
                                    <span className="text-rose-400 text-[10px] bg-rose-500/10 px-1.5 rounded">admin-only</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>

      {/* Review modal */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Review Report</h3>
                <p className="text-xs text-slate-400">
                  {reviewTarget.org_name} · {reviewTarget.site_name} · {reviewTarget.period_label}
                </p>
              </div>
            </div>

            {/* Report summary */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2.5">
                <p className="text-slate-500">Trees Planted (Σ)</p>
                <p className="text-white font-semibold">{reviewTarget.trees_planted_cumulative.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2.5">
                <p className="text-slate-500">Area</p>
                <p className="text-white font-semibold">{reviewTarget.area_hectares} ha</p>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2.5">
                <p className="text-slate-500">Imagery</p>
                <p className="text-white font-semibold capitalize">{reviewTarget.imagery_status}</p>
              </div>
            </div>

            {/* Status selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Review Decision</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'reviewed', label: 'Approve', color: 'border-emerald-500 text-emerald-400 bg-emerald-500/10' },
                  { value: 'needs_attention', label: 'Needs Attention', color: 'border-rose-500 text-rose-400 bg-rose-500/10' },
                  { value: 'pending', label: 'Reset to Pending', color: 'border-amber-500 text-amber-400 bg-amber-500/10' },
                ] as const).map(({ value, label, color }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReviewStatus(value)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-colors ${
                      reviewStatus === value ? color : 'border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Admin note */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="admin-note">
                Admin Note <span className="text-slate-500 font-normal">optional — visible to manager</span>
              </label>
              <textarea
                id="admin-note"
                rows={3}
                maxLength={1000}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Explain the decision or request clarification…"
                className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 resize-none"
              />
              <p className="text-xs text-slate-600 text-right mt-0.5">{reviewNote.length}/1000</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setReviewTarget(null); setReviewNote(''); }}
                className="flex-1 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <Button onClick={handleReview} disabled={reviewing} className="flex-1">
                {reviewing ? 'Saving…' : 'Save Decision'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
