"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { showSuccessToast, showErrorToast, showInfoToast } from "@/lib/toast";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useTeamMembers } from "@/hooks";
import {
  Users,
  UserPlus,
  Upload,
  Edit2,
  Trash2,
  Mail,
  Shield,
  Loader2,
  AlertCircle,
  RefreshCcw,
} from "lucide-react";

type FilterStatus = "all" | "active" | "pending" | "inactive";

function displayName(m: { first_name: string | null; last_name: string | null; email: string }) {
  const full = [m.first_name, m.last_name].filter(Boolean).join(" ");
  return full || m.email;
}

function statusFromMember(m: { approved: boolean }): "active" | "pending" {
  return m.approved ? "active" : "pending";
}

function TeamManagementContent() {
  const router = useRouter();
  const { members, isLoading, error, refetch, removeMember } = useTeamMembers();
  const [selectedFilter, setSelectedFilter] = useState<FilterStatus>("all");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const filteredMembers =
    selectedFilter === "all"
      ? members
      : members.filter((m) => {
          const status = statusFromMember(m);
          if (selectedFilter === "active") return status === "active";
          if (selectedFilter === "pending") return status === "pending";
          return false; // no "inactive" concept yet
        });

  const activeCount = members.filter((m) => m.approved).length;
  const pendingCount = members.filter((m) => !m.approved).length;
  const deptCount = new Set(members.map((m) => m.department).filter(Boolean)).size;

  const getRoleBadgeVariant = (role: string) => {
    if (role === "admin") return "success" as const;
    if (role === "manager") return "warning" as const;
    return "info" as const;
  };

  const getStatusBadgeVariant = (status: string) => {
    if (status === "active") return "success" as const;
    if (status === "pending") return "warning" as const;
    return "danger" as const;
  };

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the team? They will lose access until re-approved.`)) return;
    setRemovingId(id);
    try {
      await removeMember(id);
      showSuccessToast(`${name} has been deactivated`);
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  };

  const handleResendInvite = (email: string) => {
    showInfoToast(`Invitation reminder sent to ${email}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading team members…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center max-w-md">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <p className="text-rose-300 font-medium mb-1">Failed to load team data</p>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm"
        >
          <RefreshCcw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb />
          <h1 className="text-3xl font-bold text-white mb-2 mt-4">Team Management</h1>
          <p className="text-slate-400">Manage team members, roles, and permissions</p>
        </div>
        <BackButton href="/dashboard" label="Back to Dashboard" variant="outline" />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          icon={<UserPlus className="size-4" />}
          onClick={() => router.push("/team-management/add-member")}
        >
          Add Member
        </Button>
        <Button
          variant="outline"
          icon={<Upload className="size-4" />}
          onClick={() => router.push("/team-management/bulk-import")}
        >
          Bulk Import
        </Button>
      </div>

      {/* Stats Cards — live counts from DB */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <DashboardCard title="Active Members" subtitle="Approved users">
          <div className="text-3xl font-bold text-white">{activeCount}</div>
        </DashboardCard>
        <DashboardCard title="Pending" subtitle="Awaiting approval">
          <div className="text-3xl font-bold text-yellow-400">{pendingCount}</div>
        </DashboardCard>
        <DashboardCard title="Departments" subtitle="Across organization">
          <div className="text-3xl font-bold text-white">{deptCount}</div>
        </DashboardCard>
        <DashboardCard title="Total Members" subtitle="All statuses">
          <div className="text-3xl font-bold text-primary">{members.length}</div>
        </DashboardCard>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(["all", "active", "pending"] as FilterStatus[]).map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedFilter === filter
                ? "bg-primary text-background-dark"
                : "bg-navy-muted text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Team Members List */}
      <DashboardCard
        title="Team Members"
        subtitle={`${filteredMembers.length} member(s)`}
        icon={<Users className="size-5" />}
      >
        {filteredMembers.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            {members.length === 0
              ? "No team members yet. Add members using the button above."
              : "No members match this filter."}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMembers.map((member) => {
              const name = displayName(member);
              const status = statusFromMember(member);
              const isRemoving = removingId === member.id;

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 bg-navy-muted/50 border border-navy-border rounded-lg hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                      {name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="text-sm font-semibold text-white">{name}</h4>
                        <Badge variant={getStatusBadgeVariant(status)}>{status}</Badge>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{member.email}</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role}
                        </Badge>
                        {member.department && (
                          <span className="text-xs text-slate-500">{member.department}</span>
                        )}
                        {member.job_title && (
                          <span className="text-xs text-slate-500">{member.job_title}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    {status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Mail className="size-4" />}
                        onClick={() => handleResendInvite(member.email)}
                        disabled={isRemoving}
                      >
                        Resend
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Edit2 className="size-4" />}
                      onClick={() =>
                        router.push(`/team-management/edit-permissions/${member.id}`)
                      }
                      disabled={isRemoving}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={
                        isRemoving ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )
                      }
                      onClick={() => handleRemove(member.id, name)}
                      className="text-red-400 hover:text-red-300"
                      disabled={isRemoving}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DashboardCard>

      {/* Roles Info */}
      <DashboardCard
        title="Role Definitions"
        subtitle="Access levels and permissions"
        icon={<Shield className="size-5" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-navy-muted/50 border border-navy-border rounded-lg">
            <h4 className="text-sm font-semibold text-white mb-2">Manager</h4>
            <p className="text-xs text-slate-400">
              Can view all org data, manage team members, upload emissions, and run compliance actions
            </p>
          </div>
          <div className="p-4 bg-navy-muted/50 border border-navy-border rounded-lg">
            <h4 className="text-sm font-semibold text-white mb-2">Viewer</h4>
            <p className="text-xs text-slate-400">
              Read-only access to dashboards and org-wide compliance snapshots
            </p>
          </div>
          <div className="p-4 bg-navy-muted/50 border border-navy-border rounded-lg">
            <h4 className="text-sm font-semibold text-emerald-400 mb-2">Admin (Platform)</h4>
            <p className="text-xs text-slate-400">
              CarbonSense internal team — full platform access across all organizations
            </p>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}

export default function TeamManagementPage() {
  return (
    <ErrorBoundary>
      <TeamManagementContent />
    </ErrorBoundary>
  );
}
