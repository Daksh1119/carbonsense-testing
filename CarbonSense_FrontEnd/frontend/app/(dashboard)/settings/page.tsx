"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { supabase } from "@/lib/supabaseClient";
import { useUserStore } from "@/store";
import ErrorBoundary from "@/components/ErrorBoundary";
import {
  Settings as SettingsIcon,
  User,
  Building2,
  Bell,
  Lock,
  Database,
  Zap,
  Save,
  Loader2,
  Clock,
  AlertCircle,
  RefreshCcw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

interface UserProfileForm {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  phone: string;
}

interface OrgForm {
  name: string;
  domain: string;
  sector: string;
  company_size_category: string;
  state: string;
  business_description: string;
  target_reduction_pct: string;
}

// ─── Tab config ───────────────────────────────────────────────────

type TabId = "profile" | "organization" | "sme" | "notifications" | "security" | "integrations" | "data";

const TABS: { id: TabId; name: string; icon: React.ComponentType<{ className?: string }>; deferred: boolean }[] = [
  { id: "profile", name: "Profile", icon: User, deferred: false },
  { id: "organization", name: "Organization", icon: Building2, deferred: false },
  { id: "sme", name: "SME Settings", icon: SettingsIcon, deferred: true },
  { id: "notifications", name: "Notifications", icon: Bell, deferred: true },
  { id: "security", name: "Security", icon: Lock, deferred: true },
  { id: "integrations", name: "Integrations", icon: Zap, deferred: true },
  { id: "data", name: "Data Management", icon: Database, deferred: true },
];

// ─── Deferred placeholder ─────────────────────────────────────────

function ComingSoonTab({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4 text-center">
      <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-full">
        <Clock className="w-8 h-8 text-slate-500" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">{name}</h3>
        <p className="text-slate-400 text-sm max-w-sm">
          This section is coming soon and is not yet available. Focus for now is on Profile and Organization settings.
        </p>
      </div>
      <span className="px-3 py-1 text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700 rounded-full">
        Coming Soon
      </span>
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────

function ProfileTab() {
  const { user, updateUser } = useUserStore();
  const [form, setForm] = useState<UserProfileForm>({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    jobTitle: user?.jobTitle ?? "",
    department: user?.department ?? "",
    phone: user?.phone ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Group 2.11 — email change flow
  const [newEmail, setNewEmail] = useState("");
  const [emailChangePending, setEmailChangePending] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showEmailChange, setShowEmailChange] = useState(false);

  // Fetch fresh profile data from Supabase on mount
  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) {
        setIsLoadingProfile(false);
        return;
      }
      const { data, error } = await supabase
        .from("user_profiles")
        .select("first_name, last_name, email, job_title, department, phone")
        .eq("id", user.id)
        .single();

      if (error) {
        setLoadError(error.message);
      } else if (data) {
        setForm({
          firstName: data.first_name ?? "",
          lastName: data.last_name ?? "",
          email: data.email ?? user.email ?? "",
          jobTitle: data.job_title ?? "",
          department: data.department ?? "",
          phone: data.phone ?? "",
        });
      }
      setIsLoadingProfile(false);
    }
    loadProfile();
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;
    setIsSaving(true);

    const { error } = await supabase
      .from("user_profiles")
      .update({
        first_name: form.firstName || null,
        last_name: form.lastName || null,
        job_title: form.jobTitle || null,
        department: form.department || null,
        phone: form.phone || null,
      })
      .eq("id", user.id);

    setIsSaving(false);

    if (error) {
      showErrorToast(`Failed to save profile: ${error.message}`);
      return;
    }

    // Sync local store so Navbar/Sidebar reflect changes without full reload
    updateUser({
      firstName: form.firstName,
      lastName: form.lastName,
      name: [form.firstName, form.lastName].filter(Boolean).join(" ") || user.name,
      jobTitle: form.jobTitle,
      department: form.department,
      phone: form.phone,
    });

    showSuccessToast("Profile saved successfully");
  };

  // Group 2.11 — initiate Supabase Auth email change
  const handleEmailChange = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      showErrorToast("Enter a valid email address.");
      return;
    }
    if (newEmail === form.email) {
      showErrorToast("New email is the same as your current email.");
      return;
    }
    setIsSendingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      setEmailChangePending(true);
      setShowEmailChange(false);
      showSuccessToast(`Verification link sent to ${newEmail} — click it to confirm your new email.`);
    } catch (err) {
      showErrorToast(`Email change failed: ${(err as Error).message}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-slate-600";

  if (isLoadingProfile) {
    return (
      <div className="flex items-center gap-3 text-slate-400 py-8">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading profile…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
        <div className="flex items-center gap-2 mb-1">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span className="text-rose-300 font-medium text-sm">Failed to load profile</span>
        </div>
        <p className="text-slate-400 text-xs">{loadError}</p>
      </div>
    );
  }

  return (
    <DashboardCard
      title="Profile Settings"
      subtitle="Manage your personal information"
      icon={<User className="size-5" />}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">First Name</label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className={inputClass}
              placeholder="Jane"
              disabled={isSaving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Last Name</label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className={inputClass}
              placeholder="Smith"
              disabled={isSaving}
            />
          </div>
        </div>

        {/* Group 2.11 — editable email with Supabase Auth change flow */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
          {emailChangePending ? (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
              <p className="text-sm text-amber-300">
                📧 Verification link sent to <strong>{newEmail}</strong>.
                Click the link in that email to confirm your new address.
              </p>
              <button
                type="button"
                className="text-xs text-slate-400 underline mt-2 hover:text-slate-300"
                onClick={() => { setEmailChangePending(false); setNewEmail(""); }}
              >
                Cancel / use different email
              </button>
            </div>
          ) : showEmailChange ? (
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className={`${inputClass} flex-1`}
                placeholder="new.email@company.com"
                disabled={isSendingEmail}
                autoFocus
              />
              <button
                type="button"
                onClick={handleEmailChange}
                disabled={isSendingEmail}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
              >
                {isSendingEmail ? "Sending…" : "Send Verification"}
              </button>
              <button
                type="button"
                onClick={() => setShowEmailChange(false)}
                className="px-3 py-2 text-slate-400 hover:text-white text-sm rounded-lg hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="email"
                value={form.email}
                className={`${inputClass} opacity-60 cursor-not-allowed flex-1`}
                disabled
              />
              <button
                type="button"
                onClick={() => setShowEmailChange(true)}
                className="px-4 py-2 text-sm text-teal-400 border border-teal-500/30 hover:border-teal-400 bg-teal-500/5 hover:bg-teal-500/10 rounded-lg transition-colors flex-shrink-0"
              >
                Change Email
              </button>
            </div>
          )}
          <p className="text-xs text-slate-500 mt-1">
            A verification link will be sent to your new address before the change takes effect.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Job Title</label>
          <input
            type="text"
            value={form.jobTitle}
            onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
            className={inputClass}
            placeholder="Carbon Analyst"
            disabled={isSaving}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Department</label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className={inputClass}
              placeholder="Sustainability"
              disabled={isSaving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inputClass}
              placeholder="+91 98765 43210"
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
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
            disabled={isSaving}
          >
            {isSaving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>
    </DashboardCard>
  );
}

// ─── Organization Tab ─────────────────────────────────────────────

function OrganizationTab() {
  const { user } = useUserStore();
  const orgId = user?.organizationId ?? "";

  const [form, setForm] = useState<OrgForm>({
    name: "",
    domain: "",
    sector: "",
    company_size_category: "",
    state: "",
    business_description: "",
    target_reduction_pct: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchOrg = useCallback(async () => {
    if (!orgId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);

    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .select("name, domain, sector, company_size_category, state, business_description, target_reduction_pct")
      .eq("id", orgId)
      .single();

    if (orgError) {
      setLoadError(orgError.message);
      setIsLoading(false);
      return;
    }

    setForm({
      name: orgData?.name ?? "",
      domain: orgData?.domain ?? "",
      sector: orgData?.sector ?? "",
      company_size_category: orgData?.company_size_category ?? "",
      state: orgData?.state ?? "",
      business_description: orgData?.business_description ?? "",
      target_reduction_pct: orgData?.target_reduction_pct ? String(orgData.target_reduction_pct) : "",
    });
    setIsLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  const handleSave = async () => {
    if (!orgId) return;
    setIsSaving(true);

    const { error } = await supabase
      .from("organizations")
      .update({
        name: form.name || null,
        domain: form.domain || null,
        sector: form.sector || null,
        company_size_category: form.company_size_category || null,
        state: form.state || null,
        business_description: form.business_description || null,
        target_reduction_pct: form.target_reduction_pct ? parseFloat(form.target_reduction_pct) : null,
      })
      .eq("id", orgId);

    setIsSaving(false);

    if (error) {
      showErrorToast(`Failed to save organization: ${error.message}`);
      return;
    }

    showSuccessToast("Organization settings saved");
  };

  const inputClass =
    "w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-slate-600";
  const selectClass =
    "w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary";

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-slate-400 py-8">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading organization settings…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
        <div className="flex items-center gap-2 mb-1">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span className="text-rose-300 font-medium text-sm">Failed to load organization</span>
        </div>
        <p className="text-slate-400 text-xs mb-3">{loadError}</p>
        <button
          onClick={fetchOrg}
          className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors"
        >
          <RefreshCcw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        Your account is not linked to an organization. Contact your administrator.
      </div>
    );
  }

  return (
    <DashboardCard
      title="Organization Settings"
      subtitle="Configure your company profile"
      icon={<Building2 className="size-5" />}
    >
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Organization Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
            placeholder="Acme Manufacturing Ltd."
            disabled={isSaving}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Industry / Sector</label>
            <input
              type="text"
              value={form.sector}
              onChange={(e) => setForm({ ...form, sector: e.target.value })}
              className={inputClass}
              placeholder="Manufacturing, Textiles, IT, etc."
              disabled={isSaving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Company Size Category</label>
            <input
              type="text"
              value={form.company_size_category}
              onChange={(e) => setForm({ ...form, company_size_category: e.target.value })}
              className={inputClass}
              placeholder="e.g. Small (10-50), Medium (50-250)"
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">State / Region</label>
            <input
              type="text"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className={inputClass}
              placeholder="e.g. Maharashtra, Gujarat"
              disabled={isSaving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Target Reduction (%)</label>
            <input
              type="number"
              value={form.target_reduction_pct}
              onChange={(e) => setForm({ ...form, target_reduction_pct: e.target.value })}
              className={inputClass}
              placeholder="e.g. 15"
              disabled={isSaving}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">What Does Your Organization Do?</label>
          <textarea
            rows={3}
            value={form.business_description}
            onChange={(e) => setForm({ ...form, business_description: e.target.value })}
            className={inputClass}
            placeholder="Briefly describe core operations, production lines, facilities..."
            disabled={isSaving}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Domain (Optional)</label>
          <input
            type="text"
            value={form.domain}
            onChange={(e) => setForm({ ...form, domain: e.target.value })}
            className={inputClass}
            placeholder="acme.com"
            disabled={isSaving}
          />
          <p className="text-xs text-slate-500 mt-1">Used for auto-associating users from this domain.</p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="primary"
            icon={isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>
    </DashboardCard>
  );
}


// ─── Page ─────────────────────────────────────────────────────────

function SettingsContent() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  return (
    <div className="space-y-6">
      <Breadcrumb />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-400">Manage your account and organization preferences</p>
        </div>
        <BackButton href="/dashboard" label="Back to Dashboard" variant="outline" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1">
          <div className="glass-card rounded-xl p-4 space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              if (tab.deferred) {
                return (
                  // Deferred tabs: visually present but non-interactive
                  <div
                    key={tab.id}
                    aria-disabled="true"
                    title="Coming soon"
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-slate-600 cursor-not-allowed select-none"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="size-5" />
                      <span className="text-sm font-medium">{tab.name}</span>
                    </div>
                    <span className="text-[9px] font-semibold uppercase tracking-wide bg-slate-800 text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded-full">
                      Soon
                    </span>
                  </div>
                );
              }

              return (
                <button
                  key={tab.id}
                  id={`settings-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
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

        {/* Content */}
        <div className="lg:col-span-3">
          {activeTab === "profile" && <ProfileTab />}
          {activeTab === "organization" && <OrganizationTab />}
          {/* Deferred tabs — rendered as Coming Soon, never reach dead UI */}
          {TABS.find((t) => t.id === activeTab)?.deferred && (
            <div className="glass-card rounded-xl p-6">
              <ComingSoonTab name={TABS.find((t) => t.id === activeTab)?.name ?? ""} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ErrorBoundary>
      <SettingsContent />
    </ErrorBoundary>
  );
}
