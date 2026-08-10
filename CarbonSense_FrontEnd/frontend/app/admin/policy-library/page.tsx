"use client";

/**
 * Admin Policy Library — Group 5.1
 * CRUD on the policies table:
 *   - Edit portal links, deadlines, applicability tags per policy
 *   - Toggle is_active
 * Changes reflect immediately on the manager's Policy Intelligence page without deploy.
 */

import { useEffect, useState, useCallback } from "react";
import DashboardCard from "@/components/DashboardCard";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { supabase } from "@/lib/supabaseClient";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import {
  Edit2,
  Loader2,
  Shield,
  Search,
  AlertCircle,
  RefreshCcw,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PolicyRow = {
  id: string;
  name: string;
  short_name: string | null;
  category: string | null;
  layer: string | null;
  authority: string | null;
  external_url: string | null;
  effective_date: string | null;
  review_date: string | null;
  applicability: string[] | null;
  is_active: boolean;
};

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function PolicyEditModal({
  policy,
  onClose,
  onSaved,
}: {
  policy: PolicyRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    external_url: policy.external_url || "",
    effective_date: policy.effective_date || "",
    review_date: policy.review_date || "",
    authority: policy.authority || "",
    applicability: (policy.applicability || []).join(", "),
    is_active: policy.is_active,
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("policies")
        .update({
          external_url: form.external_url || null,
          effective_date: form.effective_date || null,
          review_date: form.review_date || null,
          authority: form.authority || null,
          applicability: form.applicability
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          is_active: form.is_active,
        })
        .eq("id", policy.id);
      if (error) throw error;
      showSuccessToast("Policy updated.");
      onSaved();
    } catch (e) {
      showErrorToast(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 bg-navy-muted border border-navy-border rounded-lg text-white text-sm focus:outline-none focus:border-primary placeholder:text-slate-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-navy-card border border-navy-border rounded-2xl p-6 w-full max-w-xl space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div>
          <h2 className="text-lg font-bold text-white">{policy.name}</h2>
          <p className="text-xs text-slate-500">{policy.short_name} · {policy.category}</p>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Official Portal URL{" "}
            <span className="text-amber-400">— manually verify before saving</span>
          </label>
          <input
            className={inputClass}
            value={form.external_url}
            onChange={(e) => set("external_url", e.target.value)}
            placeholder="https://beeindia.gov.in/..."
          />
          {form.external_url && (
            <a
              href={form.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-teal-400 underline mt-1 inline-flex items-center gap-1"
            >
              <ExternalLink className="size-3" /> Open to verify
            </a>
          )}
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Authority / Issuing Body</label>
          <input
            className={inputClass}
            value={form.authority}
            onChange={(e) => set("authority", e.target.value)}
            placeholder="e.g. Bureau of Energy Efficiency (BEE)"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Effective Date</label>
            <input
              type="date"
              className={inputClass}
              value={form.effective_date}
              onChange={(e) => set("effective_date", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Review / Deadline Date</label>
            <input
              type="date"
              className={inputClass}
              value={form.review_date}
              onChange={(e) => set("review_date", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Applicability Tags (comma-separated)</label>
          <input
            className={inputClass}
            value={form.applicability}
            onChange={(e) => set("applicability", e.target.value)}
            placeholder="sme, manufacturing, msme, small"
          />
          <p className="text-[10px] text-slate-600 mt-1">
            Used for policy matching. Tags should match sector/size keywords (e.g. sme, msme, large, manufacturing, it/ites).
          </p>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Status</label>
          <select
            className="w-full px-3 py-2 bg-navy-muted border border-navy-border rounded-lg text-white text-sm focus:outline-none"
            value={form.is_active ? "true" : "false"}
            onChange={(e) => set("is_active", e.target.value === "true")}
          >
            <option value="true">Active (shown to managers)</option>
            <option value="false">Inactive (hidden from managers)</option>
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="size-4 animate-spin inline mr-2" />Saving…</> : "Save Changes"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPolicyLibraryPage() {
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PolicyRow | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("policies")
        .select("id,name,short_name,category,layer,authority,external_url,effective_date,review_date,applicability,is_active")
        .order("category")
        .order("name");
      if (err) throw err;
      setPolicies((data as PolicyRow[]) ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  const categories = Array.from(new Set(policies.map((p) => p.category).filter((c): c is string => Boolean(c))));

  const filtered = policies.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.authority || "").toLowerCase().includes(q);
    const matchCat = !filterCategory || p.category === filterCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Policy Library</h1>
          <Breadcrumb />
        </div>
        <div className="flex gap-3">
          <BackButton href="/admin/dashboard" label="Back to Admin" variant="outline" />
        </div>
      </div>

      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
        ⚠️ <strong>Important:</strong> Always verify government URLs by opening them directly before saving. Never rely on AI-generated links for official portals — CarbonSense never auto-generates official government URLs.
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search policies…"
            className="w-full pl-9 pr-3 py-2 bg-navy-muted border border-navy-border rounded-lg text-sm text-white focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 bg-navy-muted border border-navy-border rounded-lg text-sm text-white focus:outline-none"
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c!} value={c!}>{c}</option>)}
        </select>
        <Button variant="outline" size="sm" icon={<RefreshCcw className="size-3.5" />} onClick={fetchPolicies}>
          Refresh
        </Button>
      </div>

      <p className="text-sm text-slate-400">
        {filtered.length} of {policies.length} policies ·{" "}
        {policies.filter((p) => !p.external_url).length} missing portal URL ·{" "}
        {policies.filter((p) => !p.is_active).length} inactive
      </p>

      <DashboardCard title="All Policies" icon={<Shield className="size-5" />}>
        {loading ? (
          <div className="flex items-center gap-3 py-8 text-slate-400">
            <Loader2 className="size-5 animate-spin" /><span>Loading policies…</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-rose-400 py-4">
            <AlertCircle className="size-4" /><span>{error}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-navy-border text-xs text-slate-500 uppercase tracking-wide">
                  <th className="pb-3 pr-4">Policy Name</th>
                  <th className="pb-3 pr-4">Category</th>
                  <th className="pb-3 pr-4">Authority</th>
                  <th className="pb-3 pr-4 text-center">Portal Link</th>
                  <th className="pb-3 pr-4">Review Date</th>
                  <th className="pb-3 pr-4 text-center">Active</th>
                  <th className="pb-3 text-right">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-border/50">
                {filtered.map((policy) => (
                  <tr key={policy.id} className={policy.is_active ? "" : "opacity-50"}>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-white">{policy.name}</p>
                      <p className="text-xs text-slate-500">{policy.short_name}</p>
                    </td>
                    <td className="py-3 pr-4">
                      {policy.category && <Badge variant="info">{policy.category}</Badge>}
                    </td>
                    <td className="py-3 pr-4 text-slate-400 text-xs">{policy.authority || "—"}</td>
                    <td className="py-3 pr-4 text-center">
                      {policy.external_url ? (
                        <a href={policy.external_url} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300">
                          <CheckCircle2 className="size-4 inline" />
                        </a>
                      ) : (
                        <span title="No URL set"><XCircle className="size-4 text-rose-400 inline" /></span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-400 text-xs">{policy.review_date || "—"}</td>
                    <td className="py-3 pr-4 text-center">
                      <Badge variant={policy.is_active ? "success" : "default"}>
                        {policy.is_active ? "Yes" : "No"}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => setEditing(policy)}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        title="Edit policy"
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>

      {editing && (
        <PolicyEditModal
          policy={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchPolicies(); }}
        />
      )}
    </div>
  );
}
