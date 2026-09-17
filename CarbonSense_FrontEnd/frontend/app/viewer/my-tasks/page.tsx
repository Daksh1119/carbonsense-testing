"use client";

/**
 * /viewer/my-tasks — Group 5.2
 * Shows recommendation items assigned to the current employee/viewer by a manager.
 * Viewers receive detailed instructions, manager's strategic rationale, and
 * an interactive step-by-step checklist to execute the task effectively.
 */

import { useEffect, useState, useCallback } from "react";
import DashboardCard from "@/components/DashboardCard";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { Breadcrumb } from "@/components/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUserStore } from "@/store";
import { showSuccessToast, showErrorToast, showInfoToast } from "@/lib/toast";
import {
  ClipboardList,
  CheckCircle2,
  PlayCircle,
  Loader2,
  AlertCircle,
  Zap,
  TrendingDown,
  Leaf,
  Users,
  Factory,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Target,
  CheckSquare,
  Square,
  Clock,
  ArrowRight,
} from "lucide-react";

type TaskStatus = "proposed" | "in_progress" | "implemented" | "rejected";

interface AssignedTask {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string | null;
  implementation_status: TaskStatus;
  assigned_at: string | null;
  session_id: string | null;
  rationale?: string;
  impact_kg?: number;
  cost_inr?: number;
  time_to_impact_months?: number;
  implementation_steps?: string[];
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  transport: <Zap className="size-4" />,
  energy: <TrendingDown className="size-4" />,
  waste: <Leaf className="size-4" />,
  purchases: <Users className="size-4" />,
  operations: <Factory className="size-4" />,
  offset: <Leaf className="size-4" />,
};

const STATUS_BADGE: Record<TaskStatus, { variant: "default" | "info" | "success" | "warning" | "danger"; label: string }> = {
  proposed: { variant: "default", label: "Not Started" },
  in_progress: { variant: "info", label: "In Progress" },
  implemented: { variant: "success", label: "Done" },
  rejected: { variant: "danger", label: "Dismissed" },
};

const DIFFICULTY_COLOR: Record<string, "success" | "warning" | "danger"> = {
  Easy: "success",
  Medium: "warning",
  Hard: "danger",
};

export default function MyTasksPage() {
  const { user } = useUserStore();
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  // Expandable details state: default in_progress tasks to open
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Interactive step checkboxes persisted in localStorage
  const [checkedSteps, setCheckedSteps] = useState<Record<string, number[]>>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("cs_viewer_checked_steps");
        if (saved) setCheckedSteps(JSON.parse(saved));
      } catch { /* ignore */ }
    }
  }, []);

  const toggleStep = (taskId: string, stepIdx: number) => {
    setCheckedSteps((prev) => {
      const current = prev[taskId] || [];
      const updated = current.includes(stepIdx)
        ? current.filter((i) => i !== stepIdx)
        : [...current, stepIdx];
      const next = { ...prev, [taskId]: updated };
      try {
        localStorage.setItem("cs_viewer_checked_steps", JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  const toggleExpand = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const fetchTasks = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      // Primary source: enriched API endpoint
      const res = await fetch("/api/viewer/tasks", {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      if (res.ok) {
        const data = await res.json();
        const loadedTasks: AssignedTask[] = data.tasks || [];
        setTasks(loadedTasks);

        // Auto-expand any active/in_progress tasks so employee sees steps immediately
        setExpandedTasks(new Set(loadedTasks.filter((t) => t.implementation_status === "in_progress").map((t) => t.id)));
      } else {
        // Fallback: direct query
        const { data, error: err } = await supabase
          .from("recommendation_items")
          .select("id, title, description, category, difficulty, implementation_status, status_updated_at, session_id")
          .eq("assigned_to", user.id)
          .order("status_updated_at", { ascending: false });

        if (err) throw err;
        setTasks(
          (data ?? []).map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
            category: String(row.category || "").toLowerCase(),
            difficulty: row.difficulty,
            implementation_status: (row.implementation_status || "proposed") as TaskStatus,
            assigned_at: row.status_updated_at,
            session_id: row.session_id,
          }))
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const updateStatus = async (taskId: string, newStatus: TaskStatus) => {
    setUpdating(taskId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch("/api/viewer/tasks", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ taskId, status: newStatus }),
      });

      if (!res.ok) {
        // Fallback to direct supabase update
        const { error: err } = await supabase
          .from("recommendation_items")
          .update({
            implementation_status: newStatus,
            status_updated_at: new Date().toISOString(),
            status_updated_by: user?.id,
          })
          .eq("id", taskId)
          .eq("assigned_to", user?.id);

        if (err) throw err;
      }

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, implementation_status: newStatus } : t))
      );

      if (newStatus === "in_progress") {
        setExpandedTasks((prev) => new Set(prev).add(taskId));
        showSuccessToast("Task marked In Progress — your manager will see this update.");
      } else if (newStatus === "implemented") {
        showSuccessToast("Great job! Task marked as Done — Compliance Action Score updated.");
      } else {
        showInfoToast("Task status updated.");
      }
    } catch (e) {
      showErrorToast(`Update failed: ${(e as Error).message}`);
    } finally {
      setUpdating(null);
    }
  };

  const active = tasks.filter((t) => t.implementation_status !== "implemented" && t.implementation_status !== "rejected");
  const done = tasks.filter((t) => t.implementation_status === "implemented" || t.implementation_status === "rejected");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">My Tasks</h1>
          <Breadcrumb />
          <p className="text-slate-400 text-sm mt-1">
            Sustainability actions delegated to you by your manager. Follow the detailed action roadmap and mark steps as you complete them.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTasks} icon={<Loader2 className={`size-3.5 ${loading ? "animate-spin" : ""}`} />}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-slate-400 py-10">
          <Loader2 className="size-5 animate-spin" />
          <span>Loading your task action plans…</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-rose-400 py-6">
          <AlertCircle className="size-4" />
          <span>{error}</span>
        </div>
      ) : tasks.length === 0 ? (
        <DashboardCard title="My Tasks" icon={<ClipboardList className="size-5" />}>
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <ClipboardList className="size-10 text-slate-600" />
            <p className="text-slate-400">No tasks assigned to you yet.</p>
            <p className="text-xs text-slate-500">Your manager can assign sustainability actions to you from the Recommendations page.</p>
          </div>
        </DashboardCard>
      ) : (
        <>
          {/* Active tasks */}
          {active.length > 0 && (
            <DashboardCard
              title={`Active Tasks (${active.length})`}
              icon={<ClipboardList className="size-5 text-teal-400" />}
            >
              <div className="space-y-4">
                {active.map((task) => {
                  const statusInfo = STATUS_BADGE[task.implementation_status];
                  const icon = CATEGORY_ICONS[task.category] ?? <ClipboardList className="size-4" />;
                  const isExpanded = expandedTasks.has(task.id);
                  const steps = task.implementation_steps || [];
                  const checkedList = checkedSteps[task.id] || [];
                  const progressPct = steps.length > 0 ? Math.round((checkedList.length / steps.length) * 100) : 0;

                  return (
                    <div
                      key={task.id}
                      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                        task.implementation_status === "in_progress"
                          ? "border-amber-500/30 bg-slate-900/70"
                          : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                      }`}
                    >
                      {/* Top Header Row */}
                      <div className="p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex items-start gap-3.5 flex-1 min-w-0">
                            <div className="flex-shrink-0 mt-0.5 p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                              {icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <p className="font-semibold text-white text-base leading-snug">{task.title}</p>
                                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                                {task.difficulty && (
                                  <Badge variant={DIFFICULTY_COLOR[task.difficulty] ?? "default"}>
                                    {task.difficulty}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed">{task.description}</p>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {task.implementation_status === "proposed" && (
                              <button
                                onClick={() => updateStatus(task.id, "in_progress")}
                                disabled={updating === task.id}
                                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold transition-colors disabled:opacity-50"
                              >
                                {updating === task.id ? <Loader2 className="size-3.5 animate-spin" /> : <PlayCircle className="size-3.5" />}
                                Start Task
                              </button>
                            )}
                            {task.implementation_status === "in_progress" && (
                              <button
                                onClick={() => updateStatus(task.id, "implemented")}
                                disabled={updating === task.id}
                                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 text-xs font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-emerald-950/40"
                              >
                                {updating === task.id ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                                Mark Done
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Quick Targets Strip & Progress */}
                        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-4 flex-wrap text-xs text-slate-400">
                          <div className="flex items-center gap-4 flex-wrap">
                            {task.impact_kg && (
                              <div className="flex items-center gap-1.5">
                                <TrendingDown className="size-3.5 text-teal-400" />
                                <span>Target Savings: <strong className="text-teal-300">{Math.round(task.impact_kg).toLocaleString()} kgCO₂e</strong></span>
                              </div>
                            )}
                            {task.time_to_impact_months && (
                              <div className="flex items-center gap-1.5">
                                <Clock className="size-3.5 text-slate-400" />
                                <span>Timeline: <strong className="text-slate-200">{task.time_to_impact_months} months</strong></span>
                              </div>
                            )}
                            {steps.length > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-slate-500">|</span>
                                <span className="text-slate-300 font-medium">
                                  {checkedList.length} of {steps.length} steps completed ({progressPct}%)
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Accordion Toggle */}
                          <button
                            onClick={() => toggleExpand(task.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-400 hover:text-teal-300 transition-colors ml-auto"
                          >
                            <span>{isExpanded ? "Hide Action Plan" : "View Action Plan & Steps"}</span>
                            {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Action Details & Checklist Drawer */}
                      {isExpanded && (
                        <div className="border-t border-slate-800 bg-slate-950/60 p-4 sm:p-5 space-y-4">
                          {/* Manager's Context & Strategic Rationale */}
                          {task.rationale && (
                            <div className="p-3.5 rounded-xl bg-teal-950/20 border border-teal-500/20">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-300 mb-1">
                                <Sparkles className="size-3.5 text-teal-400" />
                                <span>Why this task matters &amp; manager&apos;s objective</span>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed">
                                {task.rationale}
                              </p>
                            </div>
                          )}

                          {/* Step-by-Step Interactive Checklist */}
                          <div>
                            <div className="flex items-center justify-between mb-2.5">
                              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                <Target className="size-3.5 text-teal-400" />
                                <span>What you need to do (Execution Checklist)</span>
                              </h4>
                              <span className="text-[11px] text-slate-400">
                                Click steps to track your progress
                              </span>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-3">
                              <div
                                className="bg-teal-400 h-full transition-all duration-300 rounded-full"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>

                            <div className="space-y-2">
                              {steps.map((step, idx) => {
                                const isChecked = checkedList.includes(idx);
                                return (
                                  <div
                                    key={idx}
                                    onClick={() => toggleStep(task.id, idx)}
                                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer select-none ${
                                      isChecked
                                        ? "bg-teal-950/20 border-teal-500/30 text-slate-300"
                                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-200"
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      className="flex-shrink-0 mt-0.5 text-teal-400 focus:outline-none"
                                      aria-label={isChecked ? "Uncheck step" : "Check step"}
                                    >
                                      {isChecked ? (
                                        <CheckSquare className="size-4 text-teal-400" />
                                      ) : (
                                        <Square className="size-4 text-slate-500 hover:text-slate-300" />
                                      )}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                      <span className={`text-xs leading-relaxed block ${isChecked ? "line-through text-slate-400" : "text-slate-200 font-medium"}`}>
                                        <strong className="text-teal-400 font-semibold mr-1.5">Step {idx + 1}:</strong>
                                        {step}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </DashboardCard>
          )}

          {/* Completed / Dismissed Tasks */}
          {done.length > 0 && (
            <DashboardCard
              title={`Completed / Dismissed (${done.length})`}
              icon={<CheckCircle2 className="size-5 text-emerald-400" />}
            >
              <div className="space-y-2.5">
                {done.map((task) => {
                  const statusInfo = STATUS_BADGE[task.implementation_status];
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-slate-800 bg-slate-950/30"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CheckCircle2 className="size-4 text-emerald-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-slate-200 font-medium truncate">{task.title}</p>
                          <p className="text-xs text-slate-500 truncate">{task.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        {task.implementation_status === "implemented" && (
                          <button
                            onClick={() => updateStatus(task.id, "in_progress")}
                            disabled={updating === task.id}
                            className="text-xs text-slate-400 hover:text-white underline transition-colors"
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </DashboardCard>
          )}
        </>
      )}
    </div>
  );
}
