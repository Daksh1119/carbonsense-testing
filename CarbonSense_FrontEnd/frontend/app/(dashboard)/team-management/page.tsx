"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { showSuccessToast, showErrorToast, showInfoToast } from "@/lib/toast";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useTeamMembers } from "@/hooks";
import { supabase } from "@/lib/supabaseClient";
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
  Send,
  XCircle,
} from "lucide-react";

type FilterStatus = "all" | "active" | "pending";

interface InviteItem {
  id: string;
  email: string;
  role: "manager" | "viewer";
  status: "pending" | "accepted" | "expired" | "cancelled";
  created_at: string;
  expires_at: string;
  notes?: string | null;
}

interface UnifiedMember {
  id: string;
  email: string;
  role: string;
  status: "active" | "pending";
  name: string;
  department: string | null;
  job_title: string | null;
  isInvite: boolean;
  inviteId?: string;
}

function TeamManagementContent() {
  const router = useRouter();
  const { members, isLoading, error, refetch, removeMember } = useTeamMembers();
  const [selectedFilter, setSelectedFilter] = useState<FilterStatus>("all");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    try {
      setLoadingInvites(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch("/api/team-management/invites", {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const json = await res.json();
        setInvites(json.invites || []);
      }
    } catch (err) {
      console.warn("Failed to fetch pending invites:", err);
    } finally {
      setLoadingInvites(false);
    }
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  // Combine registered members + pending invites
  const existingEmails = new Set(members.map((m) => m.email.toLowerCase().trim()));

  const pendingInvites = invites.filter(
    (inv) => inv.status === "pending" && !existingEmails.has(inv.email.toLowerCase().trim())
  );

  const unifiedMembers: UnifiedMember[] = [
    ...members.map((m) => ({
      id: m.id,
      email: m.email,
      role: m.role,
      status: (m.approval_status === "approved" ? "active" : "pending") as "active" | "pending",
      name: [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email,
      department: m.department,
      job_title: m.job_title,
      isInvite: false,
    })),
    ...pendingInvites.map((inv) => {
      let parsedNotes: any = {};
      try {
        if (inv.notes) parsedNotes = JSON.parse(inv.notes);
      } catch {}

      const fullName = [parsedNotes.firstName, parsedNotes.lastName].filter(Boolean).join(" ");

      return {
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: "pending" as const,
        name: fullName || inv.email,
        department: parsedNotes.department || null,
        job_title: parsedNotes.jobTitle || null,
        isInvite: true,
        inviteId: inv.id,
      };
    }),
  ];

  const filteredMembers =
    selectedFilter === "all"
      ? unifiedMembers
      : unifiedMembers.filter((m) => m.status === selectedFilter);

  const activeCount = unifiedMembers.filter((m) => m.status === "active").length;
  const pendingCount = unifiedMembers.filter((m) => m.status === "pending").length;
  const deptCount = new Set(unifiedMembers.map((m) => m.department).filter(Boolean)).size;

  const getRoleBadgeVariant = (role: string) => {
    if (role === "admin") return "success" as const;
    if (role === "manager") return "warning" as const;
    return "info" as const;
  };

  const getStatusBadgeVariant = (status: string, isInvite: boolean) => {
    if (status === "active") return "success" as const;
    if (isInvite) return "warning" as const;
    return "warning" as const;
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

  const handleResendInvite = async (email: string, inviteId?: string) => {
    try {
      setResendingInviteId(inviteId || email);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch("/api/team-management/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(inviteId ? { inviteId } : { email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend invite");

      showSuccessToast(`Invitation email resent to ${email}!`);
      fetchInvites();
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Failed to resend invite");
    } finally {
      setResendingInviteId(null);
    }
  };

  const handleCancelInvite = async (inviteId: string, email: string) => {
    if (!confirm(`Cancel pending invitation for ${email}?`)) return;
    try {
      setCancellingInviteId(inviteId);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch(`/api/team-management/invites?id=${inviteId}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel invite");

      showSuccessToast(`Invitation for ${email} cancelled`);
      fetchInvites();
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Failed to cancel invite");
    } finally {
      setCancellingInviteId(null);
    }
  };

  if (isLoading && loadingInvites) {
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
          onClick={() => {
            refetch();
            fetchInvites();
          }}
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
        <DashboardCard title="Pending" subtitle="Invited & awaiting signup">
          <div className="text-3xl font-bold text-yellow-400">{pendingCount}</div>
        </DashboardCard>
        <DashboardCard title="Departments" subtitle="Across organization">
          <div className="text-3xl font-bold text-white">{deptCount}</div>
        </DashboardCard>
        <DashboardCard title="Total Members" subtitle="All team & invites">
          <div className="text-3xl font-bold text-primary">{unifiedMembers.length}</div>
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
        title="Team Members & Invites"
        subtitle={`${filteredMembers.length} member(s)`}
        icon={<Users className="size-5" />}
      >
        {filteredMembers.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            {unifiedMembers.length === 0
              ? "No team members yet. Add members using the button above."
              : "No members match this filter."}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMembers.map((member) => {
              const isRemoving = removingId === member.id;
              const isResending = resendingInviteId === (member.inviteId || member.email);
              const isCancelling = cancellingInviteId === member.inviteId;

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 bg-navy-muted/50 border border-navy-border rounded-lg hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="relative w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                      {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      {member.isInvite && (
                        <span className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 rounded-full p-0.5" title="Pending Email Invite">
                          <Mail className="size-3" />
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="text-sm font-semibold text-white">{member.name}</h4>
                        {member.isInvite ? (
                          <Badge variant="warning">Invited via Email</Badge>
                        ) : (
                          <Badge variant={getStatusBadgeVariant(member.status, false)}>{member.status}</Badge>
                        )}
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
                    {member.isInvite ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={
                            isResending ? (
                              <Loader2 className="size-4 animate-spin text-amber-400" />
                            ) : (
                              <Send className="size-4 text-primary" />
                            )
                          }
                          onClick={() => handleResendInvite(member.email, member.inviteId)}
                          disabled={isResending || isCancelling}
                        >
                          {isResending ? "Sending…" : "Resend Invite"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={
                            isCancelling ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )
                          }
                          onClick={() => handleCancelInvite(member.inviteId!, member.email)}
                          className="text-red-400 hover:text-red-300"
                          disabled={isResending || isCancelling}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        {member.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={
                              isResending ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Mail className="size-4" />
                              )
                            }
                            onClick={() => handleResendInvite(member.email)}
                            disabled={isRemoving || isResending}
                          >
                            {isResending ? "Sending…" : "Resend"}
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
                          onClick={() => handleRemove(member.id, member.name)}
                          className="text-red-400 hover:text-red-300"
                          disabled={isRemoving}
                        >
                          Remove
                        </Button>
                      </>
                    )}
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
