'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUserStore } from '@/store';
import {
  Wind,
  BarChart3,
  Building2,
  TrendingDown,
  Calendar,
  Hash,
  Info,
  RefreshCcw,
  Loader2,
} from 'lucide-react';
import { fetchEmissionsUploadsScoped, EmissionsUploadRecord } from '@/lib/emissions-api';
import Link from 'next/link';

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—';
  return n.toFixed(decimals);
}

function formatDate(v: string | null | undefined): string {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ViewerEmissionsPage() {
  const { user } = useUserStore();
  const orgId = user?.organizationId ?? '';

  const [uploads, setUploads] = useState<EmissionsUploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEmissionsUploadsScoped({ organizationId: orgId });
      const sorted = [...data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setUploads(sorted);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const totalTco2e = uploads.reduce(
    (sum, u) => sum + (u.total_emissions_tco2e ?? (u.total_emissions_kg ?? 0) / 1000),
    0
  );
  const currentYear = new Date().getFullYear();
  const currentYearTotal = uploads
    .filter((u) => {
      const d = new Date(u.period_start ?? u.created_at ?? '');
      return !isNaN(d.getTime()) && d.getFullYear() === currentYear;
    })
    .reduce((sum, u) => sum + (u.total_emissions_tco2e ?? (u.total_emissions_kg ?? 0) / 1000), 0);

  const latestUpload = uploads[0];
  const latestPeriodLabel = latestUpload?.period_start
    ? new Date(latestUpload.period_start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Latest';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wind className="w-6 h-6 text-sky-400" />
            Company Emissions Overview
          </h1>
          {user?.organization && (
            <div className="flex items-center gap-2 mt-1.5">
              <Building2 className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-sm font-semibold text-teal-300">{user.organization}</span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400">Read-only — contact your manager to update records</span>
            </div>
          )}
          {!user?.organization && (
            <p className="text-sm text-slate-400 mt-1">Read-only view of your organisation's carbon emissions records</p>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-sm text-rose-300">
          Failed to load emissions data: {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        </div>
      )}

      {!loading && !error && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400">Total Emissions</span>
                <div className="p-2 bg-sky-500/10 rounded-lg">
                  <Wind className="w-4 h-4 text-sky-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{fmt(totalTco2e)} <span className="text-sm font-normal text-slate-400">tCO₂e</span></p>
              <p className="text-xs text-slate-500 mt-1">Cumulative across all {uploads.length} uploads</p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400">{currentYear} YTD</span>
                <div className="p-2 bg-teal-500/10 rounded-lg">
                  <TrendingDown className="w-4 h-4 text-teal-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{fmt(currentYearTotal)} <span className="text-sm font-normal text-slate-400">tCO₂e</span></p>
              <p className="text-xs text-slate-500 mt-1">This calendar year</p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400">Data Batches</span>
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Hash className="w-4 h-4 text-purple-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{uploads.length}</p>
              <p className="text-xs text-slate-500 mt-1">Emissions uploads recorded</p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400">Latest Period</span>
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Calendar className="w-4 h-4 text-amber-400" />
                </div>
              </div>
              <p className="text-base font-bold text-white">{latestPeriodLabel}</p>
              <p className="text-xs text-slate-500 mt-1">
                {latestUpload ? `${fmt(latestUpload.total_emissions_tco2e ?? (latestUpload.total_emissions_kg ?? 0) / 1000)} tCO₂e` : 'No data yet'}
              </p>
            </div>
          </div>

          {/* Uploads breakdown table */}
          {uploads.length === 0 ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
              <BarChart3 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No emissions data uploaded yet.</p>
              <p className="text-slate-500 text-xs mt-1">Your manager will upload records and they'll appear here.</p>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-sky-400" />
                  Emissions Upload History
                </h2>
                <span className="text-xs text-slate-500">{uploads.length} batches · read-only</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-5 py-3 text-slate-500 font-medium">Period</th>
                      <th className="text-left px-5 py-3 text-slate-500 font-medium">Uploaded</th>
                      <th className="text-left px-5 py-3 text-slate-500 font-medium">Type</th>
                      <th className="text-right px-5 py-3 text-slate-500 font-medium">Records</th>
                      <th className="text-right px-5 py-3 text-slate-500 font-medium">tCO₂e</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {uploads.map((u, idx) => {
                      const tco2e = u.total_emissions_tco2e ?? (u.total_emissions_kg ?? 0) / 1000;
                      const periodLabel = u.period_start
                        ? new Date(u.period_start).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                        : '—';
                      const type = u.file_format?.toUpperCase() ?? u.source_type?.toUpperCase() ?? 'DATA';
                      return (
                        <tr key={u.id} className={idx % 2 === 0 ? 'bg-slate-900/20' : ''}>
                          <td className="px-5 py-3 text-slate-300 font-medium">{periodLabel}</td>
                          <td className="px-5 py-3 text-slate-400">{formatDate(u.created_at)}</td>
                          <td className="px-5 py-3">
                            <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              {type}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-slate-400">{u.record_count ?? '—'}</td>
                          <td className="px-5 py-3 text-right font-semibold text-white">{fmt(tco2e)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-700 bg-slate-900/60">
                      <td colSpan={4} className="px-5 py-3 text-xs font-semibold text-slate-300">Total (All Batches)</td>
                      <td className="px-5 py-3 text-right font-bold text-sky-400 text-sm">{fmt(totalTco2e)} tCO₂e</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Read-only notice */}
          <div className="bg-sky-500/5 border border-sky-500/15 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-sky-300/80">
              <strong>Read-only view.</strong> This data is managed by your organisation&apos;s managers and admins.
              If you have questions about these figures,{' '}
              <span>contact your sustainability manager. Not sure what these terms mean? </span>
              <Link href="/viewer/glossary" className="underline hover:text-sky-200 transition-colors">
                Open the Glossary
              </Link>.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
