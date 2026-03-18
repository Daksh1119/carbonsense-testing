"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { UserPlus, Save } from "lucide-react";

export default function AddMemberPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "Analyst",
    department: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email) {
      showErrorToast("Please fill in all required fields");
      return;
    }

    showSuccessToast(`Invitation sent to ${formData.email}!`);
    setTimeout(() => {
      router.push("/team-management");
    }, 1500);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb />
          <h1 className="text-3xl font-bold text-white mb-2 mt-4">
            Add Team Member
          </h1>
          <p className="text-slate-400">
            Invite a new member to join your team
          </p>
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
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email Address <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="john@company.com"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Role <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
                className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option>Admin</option>
                <option>Manager</option>
                <option>Analyst</option>
                <option>Viewer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Department
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) =>
                  setFormData({ ...formData, department: e.target.value })
                }
                className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Sustainability"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-navy-border">
            <div className="flex gap-3">
              <Button
                type="submit"
                variant="primary"
                icon={<Save className="size-4" />}
              >
                Send Invitation
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/team-management")}
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </DashboardCard>

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-sm text-blue-300">
          💡 An email invitation will be sent to the member. They&apos;ll need to accept the
          invitation and set up their account before gaining access to the platform.
        </p>
      </div>
    </div>
  );
}
