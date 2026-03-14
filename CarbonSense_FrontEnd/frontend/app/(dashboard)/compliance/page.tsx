"use client";

import DashboardCard from "@/components/DashboardCard";
import StatsCard from "@/components/StatsCard";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import ProgressBar from "@/components/ProgressBar";
import { Breadcrumb, BackButton } from "@/components/navigation";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Download,
} from "lucide-react";

const complianceOverview = [
  {
    title: "Completed",
    value: "8",
    color: "text-emerald-400",
    icon: CheckCircle2,
  },
  {
    title: "In Progress",
    value: "3",
    color: "text-amber-400",
    icon: Clock,
  },
  {
    title: "Overdue",
    value: "1",
    color: "text-rose-400",
    icon: AlertTriangle,
  },
  {
    title: "Upcoming",
    value: "5",
    color: "text-blue-400",
    icon: FileText,
  },
];

const complianceTasks = [
  {
    title: "EU CSRD Compliance Report",
    deadline: "March 20, 2026",
    daysLeft: 15,
    status: "overdue",
    progress: 45,
    priority: "critical",
  },
  {
    title: "Quarterly Emissions Report Q1",
    deadline: "April 15, 2026",
    daysLeft: 41,
    status: "in-progress",
    progress: 70,
    priority: "high",
  },
  {
    title: "ISO 14064 Recertification",
    deadline: "May 1, 2026",
    daysLeft: 57,
    status: "pending",
    progress: 20,
    priority: "medium",
  },
  {
    title: "Carbon Tax Assessment 2025",
    deadline: "May 22, 2026",
    daysLeft: 78,
    status: "pending",
    progress: 10,
    priority: "medium",
  },
];

const completedTasks = [
  {
    title: "Annual Sustainability Report 2025",
    completedDate: "Jan 10, 2026",
    verifiedBy: "Internal Audit Team",
  },
  {
    title: "Scope 1 & 2 Verification",
    completedDate: "Feb 5, 2026",
    verifiedBy: "Bureau Veritas",
  },
];

export default function CompliancePage() {
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

      {/* Stats Grid */}
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
        <div className="space-y-4">
          {complianceTasks.map((task, index) => (
            <div
              key={index}
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
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                  <Button variant="primary" size="sm">
                    Update Progress
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
        </div>
      </DashboardCard>

      {/* Completed Tasks */}
      <DashboardCard
        title="Completed & Verified"
        subtitle="Successfully completed compliance activities"
        icon={<CheckCircle2 className="size-5 text-emerald-400" />}
      >
        <div className="space-y-3">
          {completedTasks.map((task, index) => (
            <div
              key={index}
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
        </div>
      </DashboardCard>

      {/* Compliance Calendar */}
      <DashboardCard
        title="Upcoming Deadlines (Next 90 Days)"
        icon={<Clock className="size-5" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { month: "March", count: 2, status: "urgent" },
            { month: "April", count: 3, status: "warning" },
            { month: "May", count: 4, status: "normal" },
          ].map((month, index) => (
            <div
              key={index}
              className="p-4 bg-navy-muted/50 border border-navy-border rounded-lg text-center hover:border-primary/30 transition-colors"
            >
              <p className="text-2xl font-bold text-white mb-1">
                {month.count}
              </p>
              <p className="text-sm text-slate-400">{month.month} 2026</p>
              <Badge
                variant={
                  month.status === "urgent"
                    ? "danger"
                    : month.status === "warning"
                    ? "warning"
                    : "info"
                }
                size="sm"
              >
                {month.status === "urgent"
                  ? "URGENT"
                  : month.status === "warning"
                  ? "ATTENTION"
                  : "SCHEDULED"}
              </Badge>
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}
