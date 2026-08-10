"use client";

/**
 * Admin Recommendation Catalog — Group 5.1
 * Full CRUD on recommendation_catalog table:
 *   - Browse entries by sector / category
 *   - Add new entries via modal
 *   - Edit existing entries inline-modal
 *   - Deactivate (soft-delete via is_active flag)
 * An admin can update catalog content without any deploy.
 */

import { useEffect, useState, useCallback } from "react";
import DashboardCard from "@/components/DashboardCard";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { supabase } from "@/lib/supabaseClient";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import {
  Plus,
  Edit2,
  Trash2,
  Loader2,
  BookOpen,
  Search,
  AlertCircle,
  RefreshCcw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CatalogEntry = {
  id: string;
  sector: string;
  category: string;
  title: string;
  description: string;
  typical_impact_range: string | null;
  typical_cost_range_inr: string | null;
  difficulty: string | null;
  source_note: string | null;
  is_active?: boolean;
  created_at?: string;
};

const EMPTY_ENTRY: Omit<CatalogEntry, "id" | "created_at"> = {
  sector: "",
  category: "Energy",
  title: "",
  description: "",
  typical_impact_range: "",
  typical_cost_range_inr: "",
  difficulty: "Medium",
  source_note: "",
  is_active: true,
};

const SECTORS = ["Manufacturing", "IT/ITES", "Textiles", "F&B", "Retail", "Logistics", "Construction", "Healthcare", "Other"];
const CATEGORIES = ["Transport", "Energy", "Waste", "Purchases"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];

// ─── Entry Modal ──────────────────────────────────────────────────────────────

function EntryModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: Partial<CatalogEntry> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !entry?.id;
  const [form, setForm] = useState<Omit<CatalogEntry, "id" | "created_at">>({
    ...EMPTY_ENTRY,
    ...(entry || {}),
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof EMPTY_ENTRY, v: string | boolean | null) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.sector.trim() || !form.title.trim() || !form.description.trim()) {
      showErrorToast("Sector, Title, and Description are required.");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const { error } = await supabase.from("recommendation_catalog").insert([form]);
        if (error) throw error;
        showSuccessToast("Catalog entry added.");
      } else {
        const { error } = await supabase.from("recommendation_catalog").update(form).eq("id", entry!.id!);
        if (error) throw error;
        showSuccessToast("Catalog entry updated.");
      }
      onSaved();
    } catch (e) {
      showErrorToast(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 bg-navy-muted border border-navy-border rounded-lg text-white text-sm focus:outline-none focus:border-primary placeholder:text-slate-600";
  const selectClass =
    "w-full px-3 py-2 bg-navy-muted border border-navy-border rounded-lg text-white text-sm focus:outline-none focus:border-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-navy-card border border-navy-border rounded-2xl p-6 w-full max-w-xl space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold text-white">{isNew ? "Add Catalog Entry" : "Edit Catalog Entry"}</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Sector *</label>
            <select className={selectClass} value={form.sector} onChange={(e) => set("sector", e.target.value)}>
              <option value="">— Select —</option>
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Category *</label>
            <select className={selectClass} value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Title *</label>
          <input className={inputClass} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Switch to LED lighting across facility" />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Description *</label>
          <textarea
            className={`${inputClass} h-24 resize-none`}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Plain-language explanation of the recommendation..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Typical Impact Range</label>
            <input className={inputClass} value={form.typical_impact_range || ""} onChange={(e) => set("typical_impact_range", e.target.value)} placeholder="e.g. 2–8 tCO₂e/year" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Typical Cost (INR)</label>
            <input className={inputClass} value={form.typical_cost_range_inr || ""} onChange={(e) => set("typical_cost_range_inr", e.target.value)} placeholder="e.g. ₹50,000–₹2,00,000" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Difficulty</label>
            <select className={selectClass} value={form.difficulty || "Medium"} onChange={(e) => set("difficulty", e.target.value)}>
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Active</label>
            <select className={selectClass} value={form.is_active ? "true" : "false"} onChange={(e) => set("is_active", e.target.value === "true")}>
              <option value="true">Active</option>
              <option value="false">Inactive (hidden from managers)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Source Note</label>
          <input className={inputClass} value={form.source_note || ""} onChange={(e) => set("source_note", e.target.value)} placeholder="e.g. BEE MSME Energy Guide, 2023" />
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="size-4 animate-spin inline mr-2" />Saving…</> : (isNew ? "Add Entry" : "Save Changes")}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RecommendationCatalogPage() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalEntry, setModalEntry] = useState<Partial<CatalogEntry> | null | "new">(null);
  const [search, setSearch] = useState("");
  const [filterSector, setFilterSector] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("recommendation_catalog")
        .select("*")
        .order("sector")
        .order("category")
        .order("title");
      if (err) throw err;
      setEntries((data as CatalogEntry[]) ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleDeactivate = async (entry: CatalogEntry) => {
    const { error: err } = await supabase
      .from("recommendation_catalog")
      .update({ is_active: !entry.is_active })
      .eq("id", entry.id);
    if (err) { showErrorToast(err.message); return; }
    showSuccessToast(entry.is_active ? "Entry deactivated." : "Entry re-activated.");
    fetchEntries();
  };

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
    const matchSector = !filterSector || e.sector === filterSector;
    const matchCat = !filterCategory || e.category === filterCategory;
    return matchSearch && matchSector && matchCat;
  });

  const diffColor = (d: string | null) => {
    if (d === "Easy") return "success" as const;
    if (d === "Hard") return "danger" as const;
    return "warning" as const;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Recommendation Catalog</h1>
          <Breadcrumb />
        </div>
        <div className="flex gap-3">
          <BackButton href="/admin/dashboard" label="Back to Admin" variant="outline" />
          <Button icon={<Plus className="size-4" />} onClick={() => setModalEntry("new")}>
            Add Entry
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entries…"
            className="w-full pl-9 pr-3 py-2 bg-navy-muted border border-navy-border rounded-lg text-sm text-white focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={filterSector}
          onChange={(e) => setFilterSector(e.target.value)}
          className="px-3 py-2 bg-navy-muted border border-navy-border rounded-lg text-sm text-white focus:outline-none"
        >
          <option value="">All Sectors</option>
          {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 bg-navy-muted border border-navy-border rounded-lg text-sm text-white focus:outline-none"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <Button variant="outline" size="sm" icon={<RefreshCcw className="size-3.5" />} onClick={fetchEntries}>
          Refresh
        </Button>
      </div>

      {/* Count summary */}
      <p className="text-sm text-slate-400">
        {filtered.length} of {entries.length} entries shown ·{" "}
        {entries.filter((e) => e.is_active !== false).length} active
      </p>

      {/* Table */}
      <DashboardCard title="Catalog Entries" icon={<BookOpen className="size-5" />}>
        {loading ? (
          <div className="flex items-center gap-3 py-8 text-slate-400">
            <Loader2 className="size-5 animate-spin" /><span>Loading catalog…</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-rose-400 py-4">
            <AlertCircle className="size-4" /><span>{error}</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-slate-400 text-sm py-8 text-center">No entries match your filters. <button className="underline text-teal-400 ml-1" onClick={() => setModalEntry("new")}>Add one?</button></p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-navy-border text-xs text-slate-500 uppercase tracking-wide">
                  <th className="pb-3 pr-4">Title</th>
                  <th className="pb-3 pr-4">Sector</th>
                  <th className="pb-3 pr-4">Category</th>
                  <th className="pb-3 pr-4">Difficulty</th>
                  <th className="pb-3 pr-4">Impact</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-border/50">
                {filtered.map((entry) => (
                  <tr key={entry.id} className={`${entry.is_active === false ? "opacity-50" : ""}`}>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-white">{entry.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{entry.description}</p>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">{entry.sector}</td>
                    <td className="py-3 pr-4">
                      <Badge variant="info">{entry.category}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      {entry.difficulty && <Badge variant={diffColor(entry.difficulty)}>{entry.difficulty}</Badge>}
                    </td>
                    <td className="py-3 pr-4 text-slate-400 text-xs">{entry.typical_impact_range || "—"}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={entry.is_active !== false ? "success" : "default"}>
                        {entry.is_active !== false ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setModalEntry(entry)}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeactivate(entry)}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                          title={entry.is_active !== false ? "Deactivate" : "Re-activate"}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>

      {/* Modal */}
      {modalEntry !== null && (
        <EntryModal
          entry={modalEntry === "new" ? null : modalEntry}
          onClose={() => setModalEntry(null)}
          onSaved={() => { setModalEntry(null); fetchEntries(); }}
        />
      )}
    </div>
  );
}
