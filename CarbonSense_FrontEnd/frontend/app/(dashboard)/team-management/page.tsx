"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { showSuccessToast, showErrorToast, showInfoToast } from "@/lib/toast";
import {
  Users,
  UserPlus,
  Upload,
  Download,
  Edit2,
  Trash2,
  Mail,
  Shield,
  MoreVertical,
} from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  joinDate: string;
  status: "active" | "pending" | "inactive";
}

const mockTeamMembers: TeamMember[] = [
  {
    id: "1",
    name: "Sarah Chen",
    email: "sarah.chen@company.com",
    role: "Chief Climate Officer",
    department: "Sustainability",
    joinDate: "2024-01-15",
    status: "active",
  },
  {
    id: "2",
    name: "Michael Rodriguez",
    email: "michael.r@company.com",
    role: "Carbon Analyst",
    department: "Sustainability",
    joinDate: "2024-03-22",
    status: "active",
  },
  {
    id: "3",
    name: "Emily Watson",
    email: "emily.w@company.com",
    role: "Data Entry Specialist",
    department: "Operations",
    joinDate: "2024-06-10",
    status: "active",
  },
  {
    id: "4",
    name: "David Park",
    email: "david.park@company.com",
    role: "Compliance Manager",
    department: "Legal",
    joinDate: "2025-01-05",
    status: "pending",
  },
];

export default function TeamManagementPage() {
  const router = useRouter();
  const [members, setMembers] = useState<TeamMember[]>(mockTeamMembers);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  const filteredMembers =
    selectedFilter === "all"
      ? members
      : members.filter((m) => m.status === selectedFilter);

  const getRoleBadgeVariant = (role: string) => {
    if (role.includes("Chief") || role.includes("Officer")) return "success";
    if (role.includes("Manager")) return "warning";
    return "info";
  };

  const getStatusBadgeVariant = (status: string) => {
    if (status === "active") return "success";
    if (status === "pending") return "warning";
    return "danger";
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove ${name} from the team?`)) {
      setMembers(members.filter((m) => m.id !== id));
      showSuccessToast(`${name} removed from team`);
    }
  };

  const handleResendInvite = (email: string) => {
    showInfoToast(`Invitation resent to ${email}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb />
          <h1 className="text-3xl font-bold text-white mb-2 mt-4">
            Team Management
          </h1>
          <p className="text-slate-400">
            Manage team members, roles, and permissions
          </p>
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
        <Button
          variant="outline"
          icon={<Download className="size-4" />}
        >
          Export List
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <DashboardCard title="Total Members" subtitle="Active users">
          <div className="text-3xl font-bold text-white">
            {members.filter((m) => m.status === "active").length}
          </div>
        </DashboardCard>
        <DashboardCard title="Pending Invites" subtitle="Awaiting acceptance">
          <div className="text-3xl font-bold text-yellow-400">
            {members.filter((m) => m.status === "pending").length}
          </div>
        </DashboardCard>
        <DashboardCard title="Departments" subtitle="Across organization">
          <div className="text-3xl font-bold text-white">
            {new Set(members.map((m) => m.department)).size}
          </div>
        </DashboardCard>
        <DashboardCard title="Admins" subtitle="Full access">
          <div className="text-3xl font-bold text-primary">
            {members.filter((m) => m.role.includes("Chief") || m.role.includes("Officer")).length}
          </div>
        </DashboardCard>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {["all", "active", "pending", "inactive"].map((filter) => (
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
        <div className="space-y-3">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 bg-navy-muted/50 border border-navy-border rounded-lg hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-4 flex-1">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                  {member.name.split(" ").map((n) => n[0]).join("")}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-white">
                      {member.name}
                    </h4>
                    <Badge variant={getStatusBadgeVariant(member.status)}>
                      {member.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400">{member.email}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <Badge variant={getRoleBadgeVariant(member.role)}>
                      {member.role}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {member.department}
                    </span>
                    <span className="text-xs text-slate-500">
                      Joined {new Date(member.joinDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {member.status === "pending" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Mail className="size-4" />}
                    onClick={() => handleResendInvite(member.email)}
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
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="size-4" />}
                  onClick={() => handleDelete(member.id, member.name)}
                  className="text-red-400 hover:text-red-300"
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>

      {/* Roles & Permissions Info */}
      <DashboardCard
        title="Role Definitions"
        subtitle="Access levels and permissions"
        icon={<Shield className="size-5" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-navy-muted/50 border border-navy-border rounded-lg">
            <h4 className="text-sm font-semibold text-white mb-2">Admin</h4>
            <p className="text-xs text-slate-400">
              Full access to all features, can manage users and settings
            </p>
          </div>
          <div className="p-4 bg-navy-muted/50 border border-navy-border rounded-lg">
            <h4 className="text-sm font-semibold text-white mb-2">Manager</h4>
            <p className="text-xs text-slate-400">
              Can view all data, approve entries, generate reports
            </p>
          </div>
          <div className="p-4 bg-navy-muted/50 border border-navy-border rounded-lg">
            <h4 className="text-sm font-semibold text-white mb-2">Analyst</h4>
            <p className="text-xs text-slate-400">
              Can enter data, view reports, no approval rights
            </p>
          </div>
          <div className="p-4 bg-navy-muted/50 border border-navy-border rounded-lg">
            <h4 className="text-sm font-semibold text-white mb-2">Viewer</h4>
            <p className="text-xs text-slate-400">
              Read-only access to dashboards and reports
            </p>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}
