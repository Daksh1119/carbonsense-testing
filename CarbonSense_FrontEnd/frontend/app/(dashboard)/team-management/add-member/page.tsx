"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { supabase } from "@/lib/supabaseClient";
import { useUserStore } from "@/store";
import { UserPlus, Save, Loader2 } from "lucide-react";

type RbacRole = "manager" | "viewer";

export default function AddMemberPage() {
  const router = useRouter();
  const { user } = useUserStore();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "viewer" as RbacRole,
    department: "",
    jobTitle: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.email) {
      showErrorToast("First name and email are required");
      return;
    }

    if (!user?.organizationId || !user?.organization) {
      showErrorToast("Your account is not linked to an organization. Contact your administrator.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Insert into employee_signup_requests — the existing approval backend.
      // The platform admin or manager then approves/rejects via the approval flow.
      const { error } = await supabase.from("employee_signup_requests").insert({
        organization_name: user.organization,
        manager_email: user.email,
        status: "pending",
        form_data: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          jobTitle: formData.jobTitle || null,
          department: formData.department || null,
          organizationId: user.organizationId,
          organizationName: user.organization,
          managerEmail: user.email,
          // Role hint stored in form_data — approval flow uses this to set user_profiles.role
          role: formData.role,
          invitedEmail: formData.email,
        },
      });

      if (error) throw new Error(error.message);

      showSuccessToast(`Signup request created for ${formData.email}`);
      setTimeout(() => router.push("/team-management"), 1500);
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Failed to create signup request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-slate-600";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb />
          <h1 className="text-3xl font-bold text-white mb-2 mt-4">Add Team Member</h1>
          <p className="text-slate-400">Create a signup request for a new team member</p>
        </div>
        <BackButton href="/team-management" label="Cancel" variant="ghost" />
      </div>

      {/* Form */}
      <DashboardCard
        title="Member Information"
        subtitle="Fill in the details of the new team member"
        icon={<UserPlus className="size-5" />}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                First Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className={inputClass}
                placeholder="Jane"
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className={inputClass}
                placeholder="Smith"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email Address <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={inputClass}
              placeholder="jane.smith@company.com"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Role <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as RbacRole })}
                className={inputClass}
                disabled={isSubmitting}
              >
                <option value="viewer">Viewer — Read-only access</option>
                <option value="manager">Manager — Full org access</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Department
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className={inputClass}
                placeholder="Sustainability"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Job Title</label>
            <input
              type="text"
              value={formData.jobTitle}
              onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
              className={inputClass}
              placeholder="Carbon Analyst"
              disabled={isSubmitting}
            />
          </div>

          <div className="pt-6 border-t border-navy-border flex gap-3">
            <Button
              type="submit"
              variant="primary"
              icon={
                isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )
              }
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting…" : "Create Request"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/team-management")}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DashboardCard>

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-sm text-blue-300">
          💡 A signup request will be created in the system. Once the member signs up using
          their email, the platform administrator will approve their account and grant access.
        </p>
      </div>
    </div>
  );
}
