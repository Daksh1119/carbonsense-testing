"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardCard from "@/components/DashboardCard";
import StatsCard from "@/components/StatsCard";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import ProgressBar from "@/components/ProgressBar";
import ScoreRing from "@/components/ScoreRing";
import ScoreSparkline from "@/components/ScoreSparkline";
import RequirementDetailModal from "@/components/RequirementDetailModal";
import UpdateProgressModal from "@/components/UpdateProgressModal";
import EvidenceUploadPanel from "@/components/EvidenceUploadPanel";
import { Breadcrumb, BackButton } from "@/components/navigation";
import {
  fetchComplianceScore,
  fetchComplianceDeadlines,
  fetchComplianceResults,
  fetchRequirementSteps,
  verifyComplianceResult,
  type ComplianceResultRecord,
} from "@/lib/policy-compliance-api";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Download,
} from "lucide-react";

function formatDate(value?: string | null): string {
  if (!value) return "TBD";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "TBD";
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(value?: string | null): number {
  if (!value) return 0;
  const now = new Date();
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return 0;
  return Math.max(0, Math.ceil((dt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function normalizeTask(item: ComplianceResultRecord) {
  const level = (item.requirement?.level || "L3").toUpperCase();
  const priority = level === "L1" ? "critical" : level === "L2" ? "high" : "medium";
  const isDone = item.verified || item.status === "verified" || item.status === "completed";
  const rawPct = Number(item.progress_pct || 0);
  const calculatedProgress = isDone
    ? 100
    : rawPct > 0
    ? rawPct
    : item.status === "in_progress"
    ? 50
    : 0;

  return {
    id: item.id,
    requirementId: item.requirement_id,
    requirement: item.requirement,
    level: item.requirement?.level || "basic",
    title: item.requirement?.name || "Compliance requirement",
    deadline: formatDate(item.due_date),
    dueDateRaw: item.due_date || null,
    daysLeft: daysUntil(item.due_date),
    status: isDone ? "completed" : (item.status === "not_started" ? "pending" : item.status),
    progress: Math.max(0, Math.min(100, calculatedProgress)),
    priority,
    completedDate: formatDate(item.completed_at),
    verifiedBy: item.verified ? "Verified via Evidence Upload" : "Pending verification",
  };
}

export default function CompliancePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ReturnType<typeof normalizeTask>[]>([]);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [tab, setTab] = useState<"all" | "basic" | "industry_specific" | "action_based">("all");
  const [selectedTask, setSelectedTask] = useState<ReturnType<typeof normalizeTask> | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [stepRows, setStepRows] = useState<Array<Record<string, unknown>>>([]);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [score, setScore] = useState<{ total_score: number; data_score: number; action_score: number; reporting_score: number }>({
    total_score: 0,
    data_score: 0,
    action_score: 0,
    reporting_score: 0,
  });

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [results, deadlines] = await Promise.all([
          fetchComplianceResults(),
          fetchComplianceDeadlines(90),
        ]);
        const liveScore = await fetchComplianceScore().catch(() => null);

        if (!isMounted) return;
        setTasks(results.map(normalizeTask));
        setUpcomingCount(deadlines.length);
        if (liveScore) {
          setScore({
            total_score: Number(liveScore.total_score || 0),
            data_score: Number(liveScore.data_score || 0),
            action_score: Number(liveScore.action_score || 0),
            reporting_score: Number(liveScore.reporting_score || 0),
          });
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load compliance data");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const refresh = async () => {
    const [results, deadlines, liveScore] = await Promise.all([
      fetchComplianceResults(),
      fetchComplianceDeadlines(90),
      fetchComplianceScore().catch(() => null),
    ]);
    setTasks(results.map(normalizeTask));
    setUpcomingCount(deadlines.length);
    if (liveScore) {
      setScore({
        total_score: Number(liveScore.total_score || 0),
        data_score: Number(liveScore.data_score || 0),
        action_score: Number(liveScore.action_score || 0),
        reporting_score: Number(liveScore.reporting_score || 0),
      });
    }
  };

  const openDetail = (task: ReturnType<typeof normalizeTask>) => {
    setSelectedTask(task);
    setDetailOpen(true);
  };

  const openProgress = async (task: ReturnType<typeof normalizeTask>) => {
    setSelectedTask(task);
    const steps = await fetchRequirementSteps(task.id).catch(() => []);
    setStepRows(steps);
    setProgressOpen(true);
  };

  const openEvidence = (task: ReturnType<typeof normalizeTask>) => {
    setSelectedTask(task);
    setEvidenceOpen(true);
  };

  const verifyNow = async (task: ReturnType<typeof normalizeTask>) => {
    const resultId = task.id;
    const type = String(task.requirement?.type || "");
    if (type === "action") {
      openEvidence(task);
      return;
    }
    await verifyComplianceResult(resultId, {
      status: type === "reporting" ? "completed" : "verified",
      verified: type !== "reporting",
      verification_source: type === "data" ? "data" : "manual",
      notes: JSON.stringify({ verified_at: new Date().toISOString(), type }),
    });
    await refresh();
  };

  const complianceOverview = useMemo(() => {
    const completed = tasks.filter((t) => t.status === "completed" || t.status === "verified").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const overdue = tasks.filter((t) => t.status === "overdue").length;

    return [
      {
        title: "Completed",
        value: String(completed),
        color: "text-emerald-400",
        icon: CheckCircle2,
      },
      {
        title: "In Progress",
        value: String(inProgress),
        color: "text-amber-400",
        icon: Clock,
      },
      {
        title: "Overdue",
        value: String(overdue),
        color: "text-rose-400",
        icon: AlertTriangle,
      },
      {
        title: "Upcoming",
        value: String(upcomingCount),
        color: "text-blue-400",
        icon: FileText,
      },
    ];
  }, [tasks, upcomingCount]);

  const activeTasks = useMemo(
    () => tasks.filter((t) => !["completed", "verified"].includes(t.status)),
    [tasks]
  );

  const completedTasks = useMemo(
    () => tasks.filter((t) => ["completed", "verified"].includes(t.status)).slice(0, 5),
    [tasks]
  );

  const visibleTasks = useMemo(() => {
    if (tab === "all") return tasks;
    return tasks.filter((task) => String(task.level || "").toLowerCase() === tab);
  }, [tasks, tab]);

  const taskDisplayLimit = 8;
  const renderedTasks = useMemo(() => {
    return showAllTasks ? visibleTasks : visibleTasks.slice(0, taskDisplayLimit);
  }, [showAllTasks, visibleTasks]);

  const calendarByMonth = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach((task) => {
      if (!task.dueDateRaw) return;
      const dt = new Date(task.dueDateRaw);
      if (Number.isNaN(dt.getTime())) return;
      const key = dt.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).slice(0, 3).map(([month, count]) => ({ month, count }));
  }, [tasks]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb />
      
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Compliance Command
          </h1>
          <p className="text-slate-400">
            Track regulatory requirements and audit readiness
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BackButton href="/dashboard" label="Back" variant="outline" showIcon={false} />
          <Button variant="primary" icon={<Download className="size-4" />}>
            Export Audit Trail
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Live compliance data is currently unavailable. Showing available task data only.
        </div>
      ) : null}

      {/* Group 3C.1 — Compliance score framing (plain language) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-sky-500/8 border border-sky-500/20 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-1">Data Score</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            How much of your required emissions data is recorded. Increases as you upload or enter data.
          </p>
        </div>
        <div className="bg-teal-500/8 border border-teal-500/20 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-teal-400 uppercase tracking-wider mb-1">Action Score</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Rises when you mark a Recommendation as <strong className="text-white">Implemented</strong> or a Policy as <strong className="text-white">Adopted</strong>. Real actions, not paperwork.
          </p>
        </div>
        <div className="bg-purple-500/8 border border-purple-500/20 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1">Reporting Score</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Tracks regulatory disclosure progress — submission of reports, evidence, and audit documentation.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        <ScoreRing
          value={score.total_score}
          max={100}
          label="Total Compliance Score"
          color={score.total_score >= 80 ? "green" : score.total_score >= 50 ? "amber" : "rose"}
          subLabel="Data + Action + Reporting"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatsCard title="Data" value={String(Math.round(score.data_score))} icon={<CheckCircle2 className="size-6 text-blue-400" />} />
          <StatsCard title="Action" value={String(Math.round(score.action_score))} icon={<ShieldCheck className="size-6 text-teal-400" />} />
          <StatsCard title="Reporting" value={String(Math.round(score.reporting_score))} icon={<FileText className="size-6 text-purple-400" />} />
        </div>
      </div>

      <DashboardCard
        title="Compliance Score Trend"
        subtitle="Rolling 180-day trajectory (fallback to current score when history is limited)"
        icon={<FileText className="size-5" />}
      >
        <ScoreSparkline currentScore={score.total_score} />
      </DashboardCard>

      <div className="flex flex-wrap gap-3 rounded-xl border border-navy-border bg-navy-muted/20 p-4">
        {(["all", "basic", "industry_specific", "action_based"] as const).map((value) => (
          <button key={value} onClick={() => setTab(value)} className={`rounded-full px-4 py-2 text-sm capitalize ${tab === value ? "bg-primary text-background-dark" : "bg-navy-muted text-slate-300"}`}>
            {value.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {complianceOverview.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <StatsCard
              key={index}
              title={stat.title}
              value={stat.value}
              icon={<Icon className={`size-6 ${stat.color}`} />}
            />
          );
        })}
      </div>

      {/* Active Tasks */}
      <DashboardCard
        title="Active Compliance Tasks"
        subtitle="Pending regulatory requirements and deadlines"
        icon={<ShieldCheck className="size-5" />}
      >
        {isLoading ? <p className="text-sm text-slate-400">Loading compliance tasks...</p> : null}
        <div className="space-y-4">
          {renderedTasks.map((task) => (
            <div
              key={task.id}
              className={`p-5 rounded-lg border-2 transition-all ${
                task.status === "overdue"
                  ? "bg-rose-500/5 border-rose-500/30"
                  : task.status === "in-progress"
                  ? "bg-amber-500/5 border-amber-500/30"
                  : "bg-navy-muted/30 border-navy-border"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-base font-bold text-white">
                      {task.title}
                    </h4>
                    <Badge
                      variant={
                        task.priority === "critical"
                          ? "danger"
                          : task.priority === "high"
                          ? "warning"
                          : "default"
                      }
                    >
                      {task.priority.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <div className="flex items-center gap-1">
                      <Clock className="size-4" />
                      <span>Deadline: {task.deadline}</span>
                    </div>
                    <span
                      className={`font-semibold ${
                        task.daysLeft < 30
                          ? "text-rose-400"
                          : task.daysLeft < 60
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {task.daysLeft} days left
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openDetail(task)}>
                    View Details
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => openProgress(task)}>
                    Update Progress
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => verifyNow(task)}>
                    Mark Complete
                  </Button>
                </div>
              </div>
              <div>
                <ProgressBar
                  value={task.progress}
                  label="Completion Progress"
                  showLabel
                  color={
                    task.status === "overdue"
                      ? "danger"
                      : task.status === "in-progress"
                      ? "warning"
                      : "primary"
                  }
                />
              </div>
            </div>
          ))}
          {visibleTasks.length > taskDisplayLimit ? (
            <div className="pt-1">
              <Button variant="outline" size="sm" onClick={() => setShowAllTasks((value) => !value)}>
                {showAllTasks ? `Show Top ${taskDisplayLimit}` : `Show All (${visibleTasks.length})`}
              </Button>
            </div>
          ) : null}
        </div>
      </DashboardCard>

      {/* Completed Tasks */}
      <DashboardCard
        title="Completed & Verified"
        subtitle="Successfully completed compliance activities"
        icon={<CheckCircle2 className="size-5 text-emerald-400" />}
      >
        <div className="space-y-3">
          {completedTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-6 text-emerald-400" />
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    {task.title}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Verified by: {task.verifiedBy}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Completed</p>
                <p className="text-sm font-medium text-emerald-400">
                  {task.completedDate}
                </p>
              </div>
            </div>
          ))}
          {!isLoading && completedTasks.length === 0 ? (
            <p className="text-sm text-slate-400">No completed compliance records yet.</p>
          ) : null}
        </div>
      </DashboardCard>

      {/* Compliance Calendar */}
      <DashboardCard
        title="Upcoming Deadlines (Next 90 Days)"
        icon={<Clock className="size-5" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {calendarByMonth.map((month) => {
            const status = month.count >= 4 ? "urgent" : month.count >= 2 ? "warning" : "normal";
            return (
            <div
              key={month.month}
              className="p-4 bg-navy-muted/50 border border-navy-border rounded-lg text-center hover:border-primary/30 transition-colors"
            >
              <p className="text-2xl font-bold text-white mb-1">
                {month.count}
              </p>
              <p className="text-sm text-slate-400">{month.month}</p>
              <Badge
                variant={
                  status === "urgent"
                    ? "danger"
                    : status === "warning"
                    ? "warning"
                    : "info"
                }
                size="sm"
              >
                {status === "urgent"
                  ? "URGENT"
                  : status === "warning"
                  ? "ATTENTION"
                  : "SCHEDULED"}
              </Badge>
            </div>
            );
          })}
          {!isLoading && calendarByMonth.length === 0 ? (
            <p className="text-sm text-slate-400 md:col-span-3">
              No upcoming deadlines found for the next 90 days.
            </p>
          ) : null}
        </div>
      </DashboardCard>

      <RequirementDetailModal isOpen={detailOpen} onClose={() => setDetailOpen(false)} requirement={selectedTask?.requirement || null} policyId={String((selectedTask?.requirement as Record<string, unknown>)?.policy_id || "")} />
      <UpdateProgressModal isOpen={progressOpen} onClose={() => setProgressOpen(false)} steps={stepRows} onSuccess={refresh} />
      <EvidenceUploadPanel isOpen={evidenceOpen} onClose={() => setEvidenceOpen(false)} requirementId={selectedTask?.requirementId || null} onSuccess={refresh} />
    </div>
  );
}
