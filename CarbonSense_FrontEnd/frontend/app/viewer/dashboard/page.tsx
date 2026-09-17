'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUserStore } from '@/store';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import {
  Leaf,
  TrendingDown,
  BarChart3,
  Target,
  AlertCircle,
  RefreshCcw,
  Info,
  ClipboardList,
  CheckCircle2,
  PlayCircle,
  ArrowRight,
  Loader2,
  Zap,
  Building2,
} from 'lucide-react';
import ErrorBoundary from '@/components/ErrorBoundary';
import Badge from '@/components/Badge';
import { showSuccessToast, showErrorToast } from '@/lib/toast';
import { fetchEmissionsUploadsScoped } from '@/lib/emissions-api';
import { fetchComplianceScore } from '@/lib/policy-compliance-api';
import type { ComplianceScoreRecord } from '@/lib/policy-compliance-api';

interface AssignedTaskItem {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string | null;
  implementation_status: 'proposed' | 'in_progress' | 'implemented' | 'rejected';
  status_updated_at: string | null;
}

interface EmissionsSummary {
  totalTco2e: number;
  latestPeriodLabel: string;
  uploadCount: number;
  isBaseline?: boolean;
  baselineConfidence?: string;
  changePct?: number | null;
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

/** Format a % change with colour signal */
function ChangeChip({ pct }: { pct: number }) {
  const down = pct < 0;
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${down ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
        }`}
    >
      {down ? '▼' : '▲'} {Math.abs(pct).toFixed(1)}% from last period
    </span>
  );
}

function ViewerDashboardContent() {
  const { user } = useUserStore();
  const orgId = user?.organizationId ?? '';

  const [emissions, setEmissions] = useState<EmissionsSummary | null>(null);
  const [complianceScore, setComplianceScore] = useState<ComplianceScoreRecord | null>(null);
  const [assignedTasks, setAssignedTasks] = useState<AssignedTaskItem[]>([]);
  const [taskUpdating, setTaskUpdating] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

  const fetchData = useCallback(async () => {
    if (!orgId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Group 2.9 — try latest_cycle_per_org first (reads from the view)
      const [cycleRes, uploadsRes, scoreRes, tasksRes] = await Promise.allSettled([
        fetch(`${apiUrl}/assessment-cycles/${orgId}/latest`).then((r) => r.json()),
        fetchEmissionsUploadsScoped({ organizationId: orgId }),
        fetchComplianceScore(),
        user?.id
          ? supabase
              .from('recommendation_items')
              .select('id, title, description, category, difficulty, implementation_status, status_updated_at')
              .eq('assigned_to', user.id)
              .order('status_updated_at', { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);

      // --- Assigned tasks for current employee ---
      if (tasksRes.status === 'fulfilled' && tasksRes.value?.data) {
        setAssignedTasks(
          (tasksRes.value.data as any[]).map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            category: String(r.category || '').toLowerCase(),
            difficulty: r.difficulty,
            implementation_status: r.implementation_status || 'proposed',
            status_updated_at: r.status_updated_at,
          }))
        );
      }

      // --- Emissions: calculate accurate cumulative enterprise total from uploads ---
      let emissionsSummary: EmissionsSummary | null = null;

      if (uploadsRes.status === 'fulfilled' && Array.isArray(uploadsRes.value) && uploadsRes.value.length > 0) {
        const data = uploadsRes.value;
        const sorted = [...data].sort(
          (a: { created_at: string }, b: { created_at: string }) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const totalTco2e = (data as Array<{ total_emissions_tco2e?: number | null; total_emissions_kg?: number | null }>)
          .reduce((sum: number, u) => sum + (u.total_emissions_tco2e ?? ((u.total_emissions_kg || 0) / 1000)), 0);
        const latestUpload = sorted[0] as { period_start?: string } | undefined;
        const latestPeriodLabel = latestUpload?.period_start
          ? new Date(latestUpload.period_start).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
          : 'Latest';

        emissionsSummary = {
          totalTco2e: Number(totalTco2e.toFixed(2)),
          latestPeriodLabel: `${latestPeriodLabel} (${data.length} uploads)`,
          uploadCount: data.length,
        };
      } else if (cycleRes.status === 'fulfilled' && cycleRes.value?.cycle) {
        const cycle = cycleRes.value.cycle;
        emissionsSummary = {
          totalTco2e: cycle.total_emissions_tco2e ?? 0,
          latestPeriodLabel: cycle.period_label ?? 'Latest cycle',
          uploadCount: 1,
          isBaseline: cycle.source_type === 'company_profile',
          baselineConfidence: cycle.source_type === 'company_profile' ? 'estimated' : undefined,
        };

        // Fetch trend to compute % change vs previous cycle
        try {
          const trend = await fetch(`${apiUrl}/assessment-cycles/${orgId}/trend`).then((r) => r.json());
          const series = trend?.series ?? [];
          if (series.length >= 2) {
            const latest = series[series.length - 1];
            emissionsSummary.changePct = latest.change_pct ?? null;
          }
        } catch { /* non-fatal */ }
      }

      setEmissions(emissionsSummary);

      // Compliance score
      if (scoreRes.status === 'fulfilled') {
        setComplianceScore(scoreRes.value);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, apiUrl]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  const hasEmissionsData = emissions !== null;
  const complianceTotal = complianceScore?.total_score ?? null;

  const footprintSub = () => {
    if (!hasEmissionsData) return 'No data yet';
    if (emissions.isBaseline) return `Estimated — ${emissions.latestPeriodLabel} (profile baseline)`;
    return `As of ${emissions.latestPeriodLabel}`;
  };

  const cards = [
    {
      title: 'Org. Carbon Footprint',
      value: hasEmissionsData ? `${emissions.totalTco2e.toFixed(2)} tCO₂e` : '—',
      sub: footprintSub(),
      icon: Leaf,
      color: 'sky',
      extra: hasEmissionsData && emissions.changePct != null ? (
        <ChangeChip pct={emissions.changePct} />
      ) : null,
      badge: emissions?.isBaseline ? 'Estimated' : null,
    },
    {
      title: 'Compliance Score',
      value: complianceTotal !== null ? `${complianceTotal}%` : '—',
      sub: complianceScore
        ? `Data: ${complianceScore.data_score}% · Action: ${complianceScore.action_score}%`
        : 'Score will appear when compliance is set up',
      icon: TrendingDown,
      color: complianceTotal !== null && complianceTotal >= 70 ? 'emerald' : 'amber',
      extra: null,
      badge: null,
    },
    {
      title: 'Total Uploads',
      value: hasEmissionsData ? String(emissions.uploadCount) : '—',
      sub: hasEmissionsData ? 'Emissions data batches' : 'No uploads yet',
      icon: BarChart3,
      color: 'teal',
      extra: null,
      badge: null,
    },
    {
      title: 'Reporting Score',
      value: complianceScore?.reporting_score != null ? `${complianceScore.reporting_score}%` : '—',
      sub: 'Reporting & disclosure progress',
      icon: Target,
      color: 'purple',
      extra: null,
      badge: null,
    },
  ];

  const markInProgress = async (taskId: string) => {
    setTaskUpdating(taskId);
    try {
      const { error: err } = await supabase
        .from('recommendation_items')
        .update({
          implementation_status: 'in_progress',
          status_updated_at: new Date().toISOString(),
          status_updated_by: user?.id,
        })
        .eq('id', taskId)
        .eq('assigned_to', user?.id);
      if (err) throw err;
      setAssignedTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, implementation_status: 'in_progress' } : t))
      );
      showSuccessToast('Task marked as In Progress — your manager will see this update.');
    } catch (e) {
      showErrorToast(`Update failed: ${(e as Error).message}`);
    } finally {
      setTaskUpdating(null);
    }
  };

  const markImplemented = async (taskId: string) => {
    setTaskUpdating(taskId);
    try {
      const { error: err } = await supabase
        .from('recommendation_items')
        .update({
          implementation_status: 'implemented',
          status_updated_at: new Date().toISOString(),
          status_updated_by: user?.id,
        })
        .eq('id', taskId)
        .eq('assigned_to', user?.id);
      if (err) throw err;
      setAssignedTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, implementation_status: 'implemented' } : t))
      );
      showSuccessToast('Great job! Task marked as Done — Compliance Action Score boosted.');
    } catch (e) {
      showErrorToast(`Update failed: ${(e as Error).message}`);
    } finally {
      setTaskUpdating(null);
    }
  };

  const activeTasks = assignedTasks.filter((t) => t.implementation_status !== 'implemented' && t.implementation_status !== 'rejected');
  const completedTasks = assignedTasks.filter((t) => t.implementation_status === 'implemented');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome, {user?.name || 'Employee'}
          </h1>
          {user?.organization && (
            <div className="flex items-center gap-2 mt-1.5">
              <Building2 className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-sm font-semibold text-teal-300">{user.organization}</span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400">Your personal sustainability tasks &amp; company carbon insights</span>
            </div>
          )}
          {!user?.organization && (
            <p className="text-sm text-slate-400 mt-1">Your personal sustainability tasks and company carbon insights</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {user?.organization && (
            <span className="px-3 py-1 text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full flex items-center gap-1.5">
              <Building2 className="w-3 h-3" />
              {user.organization}
            </span>
          )}
          <span className="px-3 py-1 text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full">
            Employee / Viewer
          </span>
        </div>
      </div>

      {/* ── MY ASSIGNED TASKS WIDGET (EMPLOYEE-SPECIFIC ACTION HUB) ── */}
      <div className="bg-gradient-to-r from-teal-950/50 via-slate-900 to-navy-card border border-teal-500/30 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/20 rounded-xl border border-teal-500/40 text-teal-400">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                My Assigned Sustainability Tasks
                {activeTasks.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-teal-500 text-slate-950 font-extrabold">
                    {activeTasks.length} Active
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Actions assigned directly to you by your manager. Updating your tasks boosts your organization&apos;s Compliance Action Score.
              </p>
            </div>
          </div>
          <Link
            href="/viewer/my-tasks"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors"
          >
            <span>View All Tasks ({assignedTasks.length})</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {assignedTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-5 text-center space-y-1.5">
            <p className="text-sm text-slate-300 font-medium">No tasks assigned to you right now</p>
            <p className="text-xs text-slate-500">
              When your manager delegates actions to you from the Recommendations catalog, they will appear right here with one-click completion.
            </p>
          </div>
        ) : activeTasks.length === 0 ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-5 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm text-emerald-300 font-semibold">All assigned tasks completed!</p>
                <p className="text-xs text-slate-400">You have completed all {completedTasks.length} sustainability task(s) assigned to you.</p>
              </div>
            </div>
            <Link
              href="/viewer/my-tasks"
              className="text-xs text-emerald-400 hover:underline flex-shrink-0"
            >
              Review completed →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTasks.slice(0, 3).map((task) => {
              const isUpdating = taskUpdating === task.id;
              return (
                <div
                  key={task.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-teal-500/40 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm truncate">{task.title}</span>
                      <Badge variant={task.implementation_status === 'in_progress' ? 'info' : 'default'}>
                        {task.implementation_status === 'in_progress' ? 'In Progress' : 'Pending'}
                      </Badge>
                      {task.difficulty && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          {task.difficulty}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{task.description}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                    {task.implementation_status === 'proposed' && (
                      <button
                        onClick={() => markInProgress(task.id)}
                        disabled={isUpdating}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300 hover:bg-teal-500/25 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {isUpdating ? <Loader2 className="size-3.5 animate-spin" /> : <PlayCircle className="size-3.5" />}
                        Start
                      </button>
                    )}
                    <button
                      onClick={() => markImplemented(task.id)}
                      disabled={isUpdating}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      {isUpdating ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                      Mark Done
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Baseline explanation (Group 2.9) */}
      {emissions?.isBaseline && (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-5 py-3 flex items-start gap-3">
          <Info className="size-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-300/90">
            <strong>Rough estimate based on your organisation's industry average.</strong>{' '}
            This number will become more accurate once your manager uploads real emissions data.
          </p>
        </div>
      )}

      {/* KPI Cards */}
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
            {c.badge && (
              <span className="inline-block text-[10px] font-semibold px-2 py-0.5 bg-amber-500/15 text-amber-400 rounded-full mb-1">
                {c.badge}
              </span>
            )}
            <p className="text-xs text-slate-500 mt-1">{c.sub}</p>
            {c.extra && <div className="mt-2">{c.extra}</div>}
          </div>
        ))}
      </div>

      {/* Compliance breakdown */}
      {complianceScore && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-emerald-400" />
            Compliance Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Data Score', value: complianceScore.data_score, color: 'bg-sky-400', tooltip: 'How much of your required emissions data has been recorded' },
              { label: 'Action Score', value: complianceScore.action_score, color: 'bg-teal-400', tooltip: 'Based on implemented recommendations and adopted policies' },
              { label: 'Reporting Score', value: complianceScore.reporting_score, color: 'bg-purple-400', tooltip: 'Progress on regulatory disclosure and reporting requirements' },
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
                <p className="text-xs text-slate-600">{item.tooltip}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No-data state */}
      {!hasEmissionsData && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sky-400" />
            Company-Wide Carbon Summary
          </h2>
          <div className="h-32 flex items-center justify-center text-slate-500 text-sm">
            Summary data will appear once your manager uploads emissions data or completes the company profile
          </div>
        </div>
      )}

      {/* Read-only tip */}
      <div className="bg-sky-500/5 border border-sky-500/15 rounded-xl p-4">
        <p className="text-sm text-sky-300/80">
          💡 <strong>Tip:</strong> This is a read-only view of your organisation's carbon data.
          Contact your manager to upload emissions data or update compliance records.
          <span className="ml-1">
            Not sure what these numbers mean?{' '}
            <a href="/viewer/glossary" className="underline hover:text-sky-200 transition-colors">
              Open the Glossary
            </a>.
          </span>
        </p>
      </div>
    </div>
  );
}

/**
 * /viewer/dashboard — Live, read-only org carbon insights for viewer-role users.
 * Group 2.9: reads from latest_cycle_per_org, shows profile baseline if no upload.
 */
export default function ViewerDashboardPage() {
  return (
    <ErrorBoundary>
      <ViewerDashboardContent />
    </ErrorBoundary>
  );
}
