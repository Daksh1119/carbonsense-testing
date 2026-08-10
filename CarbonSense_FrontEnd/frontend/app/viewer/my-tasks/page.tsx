"use client";

/**
 * /viewer/my-tasks — Group 5.2
 * Shows recommendation items assigned to the current viewer by a manager.
 * Viewers can update assigned items to "in_progress" — a narrow, explicit
 * write exception scoped only to items where assigned_to = current user.
 */

import { useEffect, useState, useCallback } from "react";
import DashboardCard from "@/components/DashboardCard";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { Breadcrumb } from "@/components/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUserStore } from "@/store";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
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
} from "lucide-react";

type TaskStatus = "proposed" | "in_progress" | "implemented" | "rejected";

type AssignedTask = {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string | null;
  implementation_status: TaskStatus;
  assigned_at: string | null;
  session_id: string | null;
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  transport: <Zap className="size-4" />,
  energy: <TrendingDown className="size-4" />,
  waste: <Leaf className="size-4" />,
  purchases: <Users className="size-4" />,
  operations: <Factory className="size-4" />,
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

  const fetchTasks = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const markInProgress = async (taskId: string) => {
    setUpdating(taskId);
    try {
      const { error: err } = await supabase
        .from("recommendation_items")
        .update({ implementation_status: "in_progress", status_updated_at: new Date().toISOString(), status_updated_by: user?.id })
        .eq("id", taskId)
        .eq("assigned_to", user?.id); // RLS-safe double-check
      if (err) throw err;
      setTasks((prev) =>
        prev.map((t) => t.id === taskId ? { ...t, implementation_status: "in_progress" } : t)
      );
      showSuccessToast("Task marked as In Progress — your manager will see this update.");
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
            Actions assigned to you by your manager. Mark tasks In Progress to let them know you&apos;ve started.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTasks} icon={<Loader2 className={`size-3.5 ${loading ? "animate-spin" : ""}`} />}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-slate-400 py-10">
          <Loader2 className="size-5 animate-spin" />
          <span>Loading your tasks…</span>
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
              icon={<ClipboardList className="size-5" />}
            >
              <div className="space-y-3">
                {active.map((task) => {
                  const statusInfo = STATUS_BADGE[task.implementation_status];
                  const icon = CATEGORY_ICONS[task.category] ?? <ClipboardList className="size-4" />;
                  return (
                    <div
                      key={task.id}
                      className="flex items-start gap-4 rounded-xl border border-navy-border bg-navy-muted/30 p-4"
                    >
                      <div className="flex-shrink-0 mt-0.5 p-2 rounded-lg bg-teal-500/10 text-teal-400">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold text-white text-sm">{task.title}</p>
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          {task.difficulty && (
                            <Badge variant={DIFFICULTY_COLOR[task.difficulty] ?? "default"}>{task.difficulty}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{task.description}</p>
                      </div>
                      {task.implementation_status === "proposed" && (
                        <button
                          onClick={() => markInProgress(task.id)}
                          disabled={updating === task.id}
                          className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-600/20 border border-teal-500/30 text-teal-400 hover:bg-teal-600/30 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {updating === task.id ? <Loader2 className="size-3.5 animate-spin" /> : <PlayCircle className="size-3.5" />}
                          Start
                        </button>
                      )}
                      {task.implementation_status === "in_progress" && (
                        <span className="flex-shrink-0 flex items-center gap-1.5 text-xs text-teal-400">
                          <PlayCircle className="size-3.5" />In progress
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </DashboardCard>
          )}

          {/* Completed */}
          {done.length > 0 && (
            <DashboardCard
              title={`Completed / Dismissed (${done.length})`}
              icon={<CheckCircle2 className="size-5" />}
            >
              <div className="space-y-2">
                {done.map((task) => {
                  const statusInfo = STATUS_BADGE[task.implementation_status];
                  return (
                    <div key={task.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-navy-border/50 bg-navy-muted/10 opacity-70">
                      <CheckCircle2 className="size-4 text-slate-500 flex-shrink-0" />
                      <p className="text-sm text-slate-400 flex-1">{task.title}</p>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
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
