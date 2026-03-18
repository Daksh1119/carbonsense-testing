"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { showSuccessToast } from "@/lib/toast";
import { Shield, Save } from "lucide-react";

export default function EditPermissionsPage() {
  const router = useRouter();
  const params = useParams();
  const memberId = params.id;

  // Mock data - in real app, fetch from API
  const [memberData, setMemberData] = useState({
    name: "Michael Rodriguez",
    email: "michael.r@company.com",
    role: "Analyst",
    department: "Sustainability",
  });

  const [permissions, setPermissions] = useState({
    viewDashboard: true,
    enterEmissions: true,
    editEmissions: true,
    deleteEmissions: false,
    viewReports: true,
    exportData: true,
    manageTeam: false,
    manageSettings: false,
    viewAnalytics: true,
    approveEntries: false,
  });

  const handleSave = () => {
    showSuccessToast(`Permissions updated for ${memberData.name}`);
    setTimeout(() => {
      router.push("/team");
    }, 1500);
  };

  const permissionGroups = [
    {
      title: "Dashboard & Viewing",
      permissions: [
        { key: "viewDashboard", label: "View Dashboard" },
        { key: "viewReports", label: "View Reports" },
        { key: "viewAnalytics", label: "View Analytics" },
      ],
    },
    {
      title: "Data Entry",
      permissions: [
        { key: "enterEmissions", label: "Enter Emissions Data" },
        { key: "editEmissions", label: "Edit Own Entries" },
        { key: "deleteEmissions", label: "Delete Entries" },
        { key: "approveEntries", label: "Approve/Review Entries" },
      ],
    },
    {
      title: "Data Management",
      permissions: [
        { key: "exportData", label: "Export Data" },
      ],
    },
    {
      title: "Administration",
      permissions: [
        { key: "manageTeam", label: "Manage Team Members" },
        { key: "manageSettings", label: "Manage Organization Settings" },
      ],
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb />
          <h1 className="text-3xl font-bold text-white mb-2 mt-4">
            Edit Permissions
          </h1>
          <p className="text-slate-400">
            Manage access rights for {memberData.name}
          </p>
        </div>
        <BackButton href="/team" label="Cancel" variant="ghost" />
      </div>

      {/* Member Info */}
      <DashboardCard title="Member Information">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-400 mb-1">Name</p>
            <p className="text-white font-medium">{memberData.name}</p>
          </div>
          <div>
            <p className="text-slate-400 mb-1">Email</p>
            <p className="text-white font-medium">{memberData.email}</p>
          </div>
          <div>
            <p className="text-slate-400 mb-1">Current Role</p>
            <select
              value={memberData.role}
              onChange={(e) =>
                setMemberData({ ...memberData, role: e.target.value })
              }
              className="px-3 py-2 bg-navy-muted border border-navy-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
            >
              <option>Admin</option>
              <option>Manager</option>
              <option>Analyst</option>
              <option>Viewer</option>
            </select>
          </div>
          <div>
            <p className="text-slate-400 mb-1">Department</p>
            <p className="text-white font-medium">{memberData.department}</p>
          </div>
        </div>
      </DashboardCard>

      {/* Permissions */}
      <DashboardCard
        title="Permissions"
        subtitle="Select the actions this member can perform"
        icon={<Shield className="size-5" />}
      >
        <div className="space-y-6">
          {permissionGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              <h4 className="text-sm font-semibold text-white mb-3">
                {group.title}
              </h4>
              <div className="space-y-2">
                {group.permissions.map((permission) => (
                  <div
                    key={permission.key}
                    className="flex items-center justify-between p-3 bg-navy-muted/50 border border-navy-border rounded-lg"
                  >
                    <span className="text-sm text-slate-300">
                      {permission.label}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions[permission.key as keyof typeof permissions]}
                        onChange={(e) =>
                          setPermissions({
                            ...permissions,
                            [permission.key]: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-navy-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>

      {/* Role Quick Presets */}
      <DashboardCard title="Quick Presets" subtitle="Apply common permission sets">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button variant="outline" size="sm">
            Admin (All)
          </Button>
          <Button variant="outline" size="sm">
            Manager
          </Button>
          <Button variant="outline" size="sm">
            Analyst
          </Button>
          <Button variant="outline" size="sm">
            Viewer
          </Button>
        </div>
      </DashboardCard>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          icon={<Save className="size-4" />}
          onClick={handleSave}
        >
          Save Changes
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push("/team")}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
