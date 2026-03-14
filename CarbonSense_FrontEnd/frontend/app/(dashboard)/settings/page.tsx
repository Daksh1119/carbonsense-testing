"use client";

import { useState } from "react";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import { Breadcrumb, BackButton } from "@/components/navigation";
import {
  Settings as SettingsIcon,
  User,
  Building2,
  Bell,
  Lock,
  Database,
  Zap,
  Save,
  Briefcase,
} from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");

  const tabs = [
    { id: "profile", name: "Profile", icon: User },
    { id: "organization", name: "Organization", icon: Building2 },
    { id: "sme", name: "SME Settings", icon: Briefcase },
    { id: "notifications", name: "Notifications", icon: Bell },
    { id: "security", name: "Security", icon: Lock },
    { id: "integrations", name: "Integrations", icon: Zap },
    { id: "data", name: "Data Management", icon: Database },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-400">
            Manage your account, organization, and platform preferences
          </p>
        </div>
        <BackButton href="/dashboard" label="Back to Dashboard" variant="outline" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1">
          <div className="glass-card rounded-xl p-4 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="size-5" />
                  <span className="text-sm font-medium">{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          {activeTab === "profile" && (
            <DashboardCard
              title="Profile Settings"
              subtitle="Manage your personal information"
              icon={<User className="size-5" />}
            >
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      defaultValue="Sarah"
                      className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      defaultValue="Chen"
                      className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    defaultValue="sarah.chen@company.com"
                    className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Job Title
                  </label>
                  <input
                    type="text"
                    defaultValue="Chief Climate Officer"
                    className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="primary" icon={<Save className="size-4" />}>
                    Save Changes
                  </Button>
                  <Button variant="ghost">Cancel</Button>
                </div>
              </div>
            </DashboardCard>
          )}

          {activeTab === "organization" && (
            <DashboardCard
              title="Organization Settings"
              subtitle="Configure your company profile"
              icon={<Building2 className="size-5" />}
            >
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    defaultValue="Acme Manufacturing Ltd."
                    className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Industry Sector
                    </label>
                    <select className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                      <option>Manufacturing</option>
                      <option>Technology</option>
                      <option>Retail</option>
                      <option>Healthcare</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Company Size
                    </label>
                    <select className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                      <option>1-50 employees</option>
                      <option>51-200 employees</option>
                      <option>201-500 employees</option>
                      <option>500+ employees</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Carbon Reduction Target
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      defaultValue="30"
                      className="flex-1 px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    <select className="px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                      <option>% by 2030</option>
                      <option>% by 2035</option>
                      <option>% by 2040</option>
                      <option>% by 2050</option>
                    </select>
                  </div>
                </div>
                <Button variant="primary" icon={<Save className="size-4" />}>
                  Save Changes
                </Button>
              </div>
            </DashboardCard>
          )}

          {activeTab === "sme" && (
            <DashboardCard
              title="SME Settings"
              subtitle="Small and Medium Enterprise configuration"
              icon={<Briefcase className="size-5" />}
            >
              <div className="space-y-6">
                {/* Enterprise Classification */}
                <div>
                  <h4 className="text-sm font-semibold text-white mb-3">
                    Enterprise Classification
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Enterprise Type
                      </label>
                      <select className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                        <option>Small Enterprise (10-50 employees)</option>
                        <option>Medium Enterprise (51-250 employees)</option>
                        <option>Large Enterprise (250+ employees)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Annual Revenue (INR)
                      </label>
                      <select className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                        <option>₹10-50 Cr</option>
                        <option>₹50-100 Cr</option>
                        <option>₹100-250 Cr</option>
                        <option>₹250Cr+</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Energy Usage Category */}
                <div className="pt-6 border-t border-navy-border">
                  <h4 className="text-sm font-semibold text-white mb-3">
                    Energy Usage Profile
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Energy Intensity
                      </label>
                      <select className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                        <option>Low (Office-based)</option>
                        <option>Medium (Light Manufacturing)</option>
                        <option>High (Heavy Industry)</option>
                        <option>Very High (Energy-Intensive)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Primary Energy Source
                      </label>
                      <select className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                        <option>Grid Electricity</option>
                        <option>Renewable Energy</option>
                        <option>Natural Gas</option>
                        <option>Mixed Sources</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Compliance Region */}
                <div className="pt-6 border-t border-navy-border">
                  <h4 className="text-sm font-semibold text-white mb-3">
                    Compliance & Reporting
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Primary Compliance Region
                      </label>
                      <select className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                        <option>India (BEE, GRIHA)</option>
                        <option>European Union (CSRD, ETS)</option>
                        <option>United States (EPA, SEC)</option>
                        <option>United Kingdom (SECR, CCA)</option>
                        <option>International (ISO 14064, GHG Protocol)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Reporting Framework
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-navy-border bg-navy-muted text-primary focus:ring-2 focus:ring-primary" />
                          <span className="text-sm text-slate-300">GHG Protocol</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 rounded border-navy-border bg-navy-muted text-primary focus:ring-2 focus:ring-primary" />
                          <span className="text-sm text-slate-300">CDP (Carbon Disclosure Project)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 rounded border-navy-border bg-navy-muted text-primary focus:ring-2 focus:ring-primary" />
                          <span className="text-sm text-slate-300">TCFD (Task Force on Climate-related Financial Disclosures)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 rounded border-navy-border bg-navy-muted text-primary focus:ring-2 focus:ring-primary" />
                          <span className="text-sm text-slate-300">SBTi (Science Based Targets initiative)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Operational Details */}
                <div className="pt-6 border-t border-navy-border">
                  <h4 className="text-sm font-semibold text-white mb-3">
                    Operational Settings
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Number of Facilities
                      </label>
                      <input
                        type="number"
                        defaultValue="3"
                        className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Fleet Size (vehicles)
                      </label>
                      <input
                        type="number"
                        defaultValue="12"
                        className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>

                <Button variant="primary" icon={<Save className="size-4" />}>
                  Save SME Settings
                </Button>
              </div>
            </DashboardCard>
          )}

          {activeTab === "notifications" && (
            <DashboardCard
              title="Notification Preferences"
              subtitle="Manage how you receive updates"
              icon={<Bell className="size-5" />}
            >
              <div className="space-y-4">
                {[
                  {
                    title: "Policy Alerts",
                    description: "Notifications about upcoming compliance deadlines",
                    enabled: true,
                  },
                  {
                    title: "Emission Thresholds",
                    description: "Alerts when emissions exceed set limits",
                    enabled: true,
                  },
                  {
                    title: "Recommendations",
                    description: "New AI-generated reduction recommendations",
                    enabled: false,
                  },
                  {
                    title: "Weekly Reports",
                    description: "Weekly summary of carbon activities",
                    enabled: true,
                  },
                ].map((notification, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-navy-muted/50 border border-navy-border rounded-lg"
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-white">
                        {notification.title}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        {notification.description}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked={notification.enabled}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-navy-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                ))}
              </div>
            </DashboardCard>
          )}

          {activeTab === "security" && (
            <DashboardCard
              title="Security Settings"
              subtitle="Manage your account security"
              icon={<Lock className="size-5" />}
            >
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-white mb-3">
                    Change Password
                  </h4>
                  <div className="space-y-3">
                    <input
                      type="password"
                      placeholder="Current Password"
                      className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="password"
                      placeholder="New Password"
                      className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="password"
                      placeholder="Confirm New Password"
                      className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <Button variant="primary" className="mt-3">
                    Update Password
                  </Button>
                </div>
                <div className="pt-6 border-t border-navy-border">
                  <div className="flex items-center justify-between p-4 bg-navy-muted/50 border border-navy-border rounded-lg">
                    <div>
                      <h4 className="text-sm font-semibold text-white">
                        Two-Factor Authentication
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                    <Badge variant="warning">Not Enabled</Badge>
                  </div>
                  <Button variant="outline" className="mt-3">
                    Enable 2FA
                  </Button>
                </div>
              </div>
            </DashboardCard>
          )}

          {activeTab === "integrations" && (
            <DashboardCard
              title="Integrations"
              subtitle="Connect external services and APIs"
              icon={<Zap className="size-5" />}
            >
              <div className="space-y-3">
                {[
                  {
                    name: "Banking API",
                    description: "Automatic transaction import",
                    status: "connected",
                  },
                  {
                    name: "Google Drive",
                    description: "Receipt and document storage",
                    status: "connected",
                  },
                  {
                    name: "Slack",
                    description: "Team notifications",
                    status: "not-connected",
                  },
                  {
                    name: "Microsoft Teams",
                    description: "Collaboration integration",
                    status: "not-connected",
                  },
                ].map((integration, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-navy-muted/50 border border-navy-border rounded-lg"
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-white">
                        {integration.name}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        {integration.description}
                      </p>
                    </div>
                    {integration.status === "connected" ? (
                      <Badge variant="success">Connected</Badge>
                    ) : (
                      <Button variant="outline" size="sm">
                        Connect
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </DashboardCard>
          )}

          {activeTab === "data" && (
            <DashboardCard
              title="Data Management"
              subtitle="Export, backup, and manage your emissions data"
              icon={<Database className="size-5" />}
            >
              <div className="space-y-6">
                {/* Export Data */}
                <div>
                  <h4 className="text-sm font-semibold text-white mb-3">
                    Export Data
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-navy-muted/50 border border-navy-border rounded-lg">
                      <div>
                        <h5 className="text-sm font-medium text-white">CSV Export</h5>
                        <p className="text-xs text-slate-400 mt-1">
                          Download all emissions data in spreadsheet format
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        Export CSV
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-navy-muted/50 border border-navy-border rounded-lg">
                      <div>
                        <h5 className="text-sm font-medium text-white">JSON Export</h5>
                        <p className="text-xs text-slate-400 mt-1">
                          Download structured data with full metadata
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        Export JSON
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-navy-muted/50 border border-navy-border rounded-lg">
                      <div>
                        <h5 className="text-sm font-medium text-white">PDF Report</h5>
                        <p className="text-xs text-slate-400 mt-1">
                          Generate comprehensive emissions report
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        Generate PDF
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Data Backup */}
                <div className="pt-6 border-t border-navy-border">
                  <h4 className="text-sm font-semibold text-white mb-3">
                    Automatic Backup
                  </h4>
                  <div className="p-4 bg-navy-muted/50 border border-navy-border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h5 className="text-sm font-medium text-white">Daily Backups</h5>
                        <p className="text-xs text-slate-400 mt-1">
                          Last backup: Today at 2:00 AM
                        </p>
                      </div>
                      <Badge variant="success">Active</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        Backup Now
                      </Button>
                      <Button variant="ghost" size="sm">
                        View History
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Data Retention */}
                <div className="pt-6 border-t border-navy-border">
                  <h4 className="text-sm font-semibold text-white mb-3">
                    Data Retention
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Retention Period
                      </label>
                      <select className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                        <option>Keep all data indefinitely</option>
                        <option>7 years (recommended for compliance)</option>
                        <option>5 years</option>
                        <option>3 years</option>
                        <option>1 year</option>
                      </select>
                    </div>
                    <p className="text-xs text-slate-400">
                      ℹ️ Most carbon reporting standards require data retention for at least 5-7 years
                    </p>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="pt-6 border-t border-red-500/20">
                  <h4 className="text-sm font-semibold text-red-400 mb-3">
                    Danger Zone
                  </h4>
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <h5 className="text-sm font-medium text-white mb-2">
                      Delete All Data
                    </h5>
                    <p className="text-xs text-slate-400 mb-3">
                      Permanently delete all emissions data, reports, and history. This action cannot be undone.
                    </p>
                    <Button variant="outline" className="border-red-500 text-red-400 hover:bg-red-500/10">
                      Delete All Data
                    </Button>
                  </div>
                </div>
              </div>
            </DashboardCard>
          )}
        </div>
      </div>
    </div>
  );
}
