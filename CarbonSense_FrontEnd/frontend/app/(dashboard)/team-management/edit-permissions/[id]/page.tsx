"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { supabase } from "@/lib/supabaseClient";
import { useUserStore } from "@/store";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Shield, Save, Loader2, AlertCircle, RefreshCcw } from "lucide-react";

type RbacRole = "manager" | "viewer";

interface MemberProfile {
  id: string;
  email: string;
  role: RbacRole;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  department: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
}

const ROLE_PERMISSIONS: Record<RbacRole, { group: string; items: string[] }[]> = {
  manager: [
    {
      group: "Dashboard & Analytics",
      items: ["View Manager Dashboard", "View Emissions Analytics", "View Compliance Reports"],
    },
    {
      group: "Data Management",
      items: ["Upload Emissions Data (CSV / Manual)", "Edit & Delete Own Entries", "Run TEME Estimates"],
    },
    {
      group: "Team & Org",
      items: ["Manage Team Members", "Approve Viewer Access Requests", "Edit Organization Settings"],
    },
    {
      group: "Policy & Compliance",
      items: ["View & Match Policies", "Update Compliance Status", "Upload Evidence Documents"],
    },
  ],
  viewer: [
    {
      group: "Dashboard & Reports",
      items: ["View Viewer Dashboard", "View Personal Carbon Footprint", "Download Carbon Reports"],
    },
    {
      group: "Data",
      items: ["Read-only Emissions Summary"],
    },
  ],
};

function displayName(m: MemberProfile) {
  const full = [m.first_name, m.last_name].filter(Boolean).join(" ");
  return full || m.email;
}

function EditPermissionsContent() {
  const router = useRouter();
  const params = useParams();
  const memberId = params.id as string;
  const { user } = useUserStore();
  const orgId = user?.organizationId ?? "";

  const [member, setMember] = useState<MemberProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<RbacRole>("viewer");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMember() {
      if (!memberId || !orgId) {
        setLoadError("Missing member ID or organization context.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, email, role, first_name, last_name, job_title, department, approval_status")
        .eq("id", memberId)
        .eq("organization_id", orgId)
        .single();

      if (error || !data) {
        setLoadError(
          error?.message ?? "Member not found or you do not have permission to edit this member."
        );
        setIsLoading(false);
        return;
      }

      const profile = data as MemberProfile;
      setMember(profile);
      setSelectedRole(profile.role === "manager" ? "manager" : "viewer");
      setIsLoading(false);
    }

    fetchMember();
  }, [memberId, orgId]);

  const handleSave = async () => {
    if (!member) return;
    setIsSaving(true);

    const { error } = await supabase
      .from("user_profiles")
      .update({ role: selectedRole })
      .eq("id", member.id)
      .eq("organization_id", orgId);

    setIsSaving(false);

    if (error) {
      showErrorToast(`Failed to update role: ${error.message}`);
      return;
    }

    showSuccessToast(`Role updated to "${selectedRole}" for ${displayName(member)}`);
    setTimeout(() => router.push("/team-management"), 1200);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading member details…</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 max-w-md mx-auto">
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center w-full">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <p className="text-rose-300 font-medium mb-1">Could not load member</p>
          <p className="text-slate-400 text-sm">{loadError}</p>
        </div>
        <button
          onClick={() => router.push("/team-management")}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
        >
          <RefreshCcw className="w-4 h-4" />
          Back to Team
        </button>
      </div>
    );
  }

  if (!member) return null;

  const name = displayName(member);
  const permsByRole = ROLE_PERMISSIONS[selectedRole];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb />
          <h1 className="text-3xl font-bold text-white mb-2 mt-4">Edit Permissions</h1>
          <p className="text-slate-400">Manage access role for {name}</p>
        </div>
        <BackButton href="/team-management" label="Cancel" variant="ghost" />
      </div>

      {/* Member Info */}
      <DashboardCard title="Member Information">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-400 mb-1">Name</p>
            <p className="text-white font-medium">{name}</p>
          </div>
          <div>
            <p className="text-slate-400 mb-1">Email</p>
            <p className="text-white font-medium">{member.email}</p>
          </div>
          {member.job_title && (
            <div>
              <p className="text-slate-400 mb-1">Job Title</p>
              <p className="text-white font-medium">{member.job_title}</p>
            </div>
          )}
          {member.department && (
            <div>
              <p className="text-slate-400 mb-1">Department</p>
              <p className="text-white font-medium">{member.department}</p>
            </div>
          )}
          <div>
            <p className="text-slate-400 mb-1">Status</p>
            <p className={member.approval_status === 'approved' ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
              {member.approval_status === 'approved' ? "Active" : "Pending Approval"}
            </p>
          </div>
        </div>
      </DashboardCard>

      {/* Role Selection */}
      <DashboardCard
        title="Assign Role"
        subtitle="The role determines what this member can see and do"
        icon={<Shield className="size-5" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {(["viewer", "manager"] as RbacRole[]).map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                selectedRole === role
                  ? role === "manager"
                    ? "border-teal-500 bg-teal-500/10"
                    : "border-sky-500 bg-sky-500/10"
                  : "border-navy-border bg-navy-muted/50 hover:border-slate-600"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-3 h-3 rounded-full border-2 ${
                    selectedRole === role
                      ? role === "manager"
                        ? "border-teal-400 bg-teal-400"
                        : "border-sky-400 bg-sky-400"
                      : "border-slate-600"
                  }`}
                />
                <span
                  className={`font-semibold text-sm capitalize ${
                    selectedRole === role
                      ? role === "manager"
                        ? "text-teal-300"
                        : "text-sky-300"
                      : "text-slate-300"
                  }`}
                >
                  {role}
                </span>
                {member.role === role && (
                  <span className="ml-auto text-xs text-slate-500 italic">current</span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {role === "manager"
                  ? "Full org access: upload data, manage team, run compliance actions"
                  : "Read-only: view dashboard and compliance summary"}
              </p>
            </button>
          ))}
        </div>

        {/* Permission preview for selected role */}
        <div className="space-y-4 border-t border-navy-border pt-4">
          <h4 className="text-sm font-semibold text-slate-300">
            Permissions included with{" "}
            <span
              className={selectedRole === "manager" ? "text-teal-400" : "text-sky-400"}
            >
              {selectedRole}
            </span>{" "}
            role:
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {permsByRole.map((group) => (
              <div key={group.group}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  {group.group}
                </p>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-slate-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </DashboardCard>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          icon={
            isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )
          }
          onClick={handleSave}
          disabled={isSaving || selectedRole === member.role}
        >
          {isSaving ? "Saving…" : selectedRole === member.role ? "No Changes" : "Save Role"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push("/team-management")}
          disabled={isSaving}
        >
          Cancel
        </Button>
      </div>

      {selectedRole === member.role && (
        <p className="text-xs text-slate-500">
          The selected role matches the current role — no changes will be made.
        </p>
      )}
    </div>
  );
}

export default function EditPermissionsPage() {
  return (
    <ErrorBoundary>
      <EditPermissionsContent />
    </ErrorBoundary>
  );
}
