'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUserStore } from '@/store';
import { Leaf, TrendingDown, BarChart3, Target, AlertCircle, RefreshCcw } from 'lucide-react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { fetchEmissionsUploadsScoped } from '@/lib/emissions-api';
import { fetchComplianceScore } from '@/lib/policy-compliance-api';
import type { ComplianceScoreRecord } from '@/lib/policy-compliance-api';

interface EmissionsSummary {
  totalTco2e: number;
  latestPeriodLabel: string;
  uploadCount: number;
}

function LoadingCard() {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 animate-pulse">
      <div className="h-3 bg-slate-700 rounded w-1/2 mb-4" />
      <div className="h-7 bg-slate-700 rounded w-1/3 mb-2" />
      <div className="h-3 bg-slate-700 rounded w-2/3" />
    </div>
  );
}

function ViewerDashboardContent() {
  const { user } = useUserStore();
  const orgId = user?.organizationId ?? '';

  const [emissions, setEmissions] = useState<EmissionsSummary | null>(null);
  const [complianceScore, setComplianceScore] = useState<ComplianceScoreRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!orgId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [uploads, score] = await Promise.allSettled([
        fetchEmissionsUploadsScoped({ organizationId: orgId }),
        fetchComplianceScore(),
      ]);

      // Process emissions uploads
      if (uploads.status === 'fulfilled') {
        const data = uploads.value;
        const totalTco2e = data.reduce((sum, u) => sum + (u.total_emissions_tco2e ?? 0), 0);
        const latestUpload = data.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        const latestPeriodLabel = latestUpload?.period_start
          ? new Date(latestUpload.period_start).toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric',
            })
          : 'No data yet';
        setEmissions({ totalTco2e, latestPeriodLabel, uploadCount: data.length });
      }

      // Process compliance score
      if (score.status === 'fulfilled') {
        setComplianceScore(score.value);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 bg-slate-800 rounded w-48 animate-pulse mb-2" />
            <div className="h-4 bg-slate-800 rounded w-32 animate-pulse" />
          </div>
          <div className="h-6 bg-slate-800 rounded-full w-28 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <LoadingCard key={i} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center max-w-md">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <p className="text-rose-300 font-medium mb-1">Failed to load dashboard data</p>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm"
        >
          <RefreshCcw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  const hasEmissionsData = emissions !== null && emissions.uploadCount > 0;
  const complianceTotal = complianceScore?.total_score ?? null;

  const cards = [
    {
      title: 'Org. Carbon Footprint',
      value: hasEmissionsData
        ? `${emissions.totalTco2e.toFixed(2)} tCO₂e`
        : '—',
      sub: hasEmissionsData
        ? `As of ${emissions.latestPeriodLabel}`
        : 'No emissions data uploaded yet',
      icon: Leaf,
      color: 'sky',
    },
    {
      title: 'Compliance Score',
      value: complianceTotal !== null ? `${complianceTotal}%` : '—',
      sub: complianceScore
        ? `Data: ${complianceScore.data_score}% · Action: ${complianceScore.action_score}%`
        : 'Score will appear when compliance is set up',
      icon: TrendingDown,
      color: complianceTotal !== null && complianceTotal >= 70 ? 'emerald' : 'amber',
    },
    {
      title: 'Total Uploads',
      value: hasEmissionsData ? String(emissions.uploadCount) : '—',
      sub: hasEmissionsData ? 'Emissions data batches' : 'No uploads yet',
      icon: BarChart3,
      color: 'teal',
    },
    {
      title: 'Reporting Score',
      value: complianceScore?.reporting_score != null
        ? `${complianceScore.reporting_score}%`
        : '—',
      sub: 'Reporting & disclosure progress',
      icon: Target,
      color: 'purple',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with viewer badge */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome, {user?.name || 'Employee'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {user?.organization ? `${user.organization} — ` : ''}Your organization's carbon insights
          </p>
        </div>
        <span className="px-3 py-1 text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full">
          Viewer Access
        </span>
      </div>

      {/* KPI Cards — read-only, no write actions anywhere */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div
            key={c.title}
            className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">{c.title}</span>
              <div className={`p-2 bg-${c.color}-500/10 rounded-lg`}>
                <c.icon className={`w-4 h-4 text-${c.color}-400`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{c.value}</p>
            <p className="text-xs text-slate-500 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Compliance breakdown — read-only */}
      {complianceScore && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-emerald-400" />
            Compliance Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Data Score', value: complianceScore.data_score, color: 'bg-sky-400' },
              { label: 'Action Score', value: complianceScore.action_score, color: 'bg-teal-400' },
              { label: 'Reporting Score', value: complianceScore.reporting_score, color: 'bg-purple-400' },
            ].map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="text-white font-medium">{item.value}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} transition-all duration-500`}
                    style={{ width: `${Math.min(item.value, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Carbon Summary placeholder if no data yet */}
      {!hasEmissionsData && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sky-400" />
            Company-Wide Carbon Summary
          </h2>
          <div className="h-32 flex items-center justify-center text-slate-500 text-sm">
            Summary data will appear once emissions are uploaded by your manager
          </div>
        </div>
      )}

      {/* Read-only tip */}
      <div className="bg-sky-500/5 border border-sky-500/15 rounded-xl p-4">
        <p className="text-sm text-sky-300/80">
          💡 <strong>Tip:</strong> This is a read-only view of your organization's carbon data.
          Contact your manager to upload emissions data or update compliance records.
        </p>
      </div>
    </div>
  );
}

/**
 * /viewer/dashboard — Live, read-only org carbon insights for viewer-role users.
 * Zero write-capable actions in the DOM. Data fetched via org-scoped APIs.
 */
export default function ViewerDashboardPage() {
  return (
    <ErrorBoundary>
      <ViewerDashboardContent />
    </ErrorBoundary>
  );
}
