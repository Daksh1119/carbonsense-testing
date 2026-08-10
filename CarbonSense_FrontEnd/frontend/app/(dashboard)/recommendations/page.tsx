"use client";

/**
 * /recommendations — Personalized Recommendations page
 * Groups 3A.1, 3A.2, 3A.3 from CarbonSense_Dynamic_Platform_Plan (4).md
 *
 * Changes vs original:
 * - Loads recommendation_items from the catalog-based endpoint (/recommendations/items)
 * - Falls back to legacy useRecommendations hook data when items list is empty
 * - Per-item "Apply", "In Progress", "Dismiss" status controls
 * - Filterable history view (proposed / in_progress / implemented / rejected)
 * - Status update hits PATCH /recommendations/items/{id}/status
 * - Action Score tooltip explains connection to compliance
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { useRecommendations } from "@/hooks";
import { useUserStore } from "@/store";
import { supabase } from "@/lib/supabaseClient";
import { showInfoToast, showSuccessToast, showErrorToast } from "@/lib/toast";
import {
  Sparkles,
  Zap,
  TrendingDown,
  Users,
  Factory,
  Leaf,
  ArrowRight,
  Target,
  CheckCircle2,
  PlayCircle,
  XCircle,
  Clock,
  Filter,
  Info,
  UserPlus,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ItemStatus = "proposed" | "in_progress" | "implemented" | "rejected";

interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty?: string;
  implementation_status: ItemStatus;
  rank: number;
  catalog_entry_id?: string;
  assigned_to?: string | null; // Group 5.2
}

// Group 5.2
interface ViewerMember {
  id: string;
  display_name: string;
}

// ---------------------------------------------------------------------------
// Status chip
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<ItemStatus, { label: string; color: string; Icon: React.ComponentType<{className?: string}> }> = {
  proposed:     { label: "Proposed",    color: "text-slate-400 bg-slate-700/60",        Icon: Clock },
  in_progress:  { label: "In Progress", color: "text-amber-400 bg-amber-500/15",        Icon: PlayCircle },
  implemented:  { label: "Implemented", color: "text-emerald-400 bg-emerald-500/15",    Icon: CheckCircle2 },
  rejected:     { label: "Dismissed",   color: "text-slate-500 bg-slate-800/60",        Icon: XCircle },
};

function StatusBadge({ status }: { status: ItemStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
      <Icon className="size-3" />
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Filter pills
// ---------------------------------------------------------------------------

const FILTERS: { value: string; label: string }[] = [
  { value: "all",         label: "All" },
  { value: "proposed",    label: "Proposed" },
  { value: "in_progress", label: "In Progress" },
  { value: "implemented", label: "Implemented" },
  { value: "rejected",    label: "Dismissed" },
];

// ---------------------------------------------------------------------------
// Info tooltip
// ---------------------------------------------------------------------------

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        className="text-slate-500 hover:text-teal-400 transition-colors"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <Info className="size-3.5 inline" />
      </button>
      {open && (
        <span className="absolute left-5 top-0 z-50 w-64 bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 shadow-xl">
          {text}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function RecommendationsPage() {
  const router = useRouter();
  const { user } = useUserStore();
  const orgId = user?.organizationId ?? "";
  const userId = user?.id ?? "";

  // Legacy hook for fallback / summary stats
  const { recommendations: liveRecommendations, isLoading: legacyLoading, error: legacyError, llmUsed, llmWarning, refetch } = useRecommendations();

  // Catalog-based items from the new endpoint
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // Group 5.2 — team viewers for assignment
  const [viewers, setViewers] = useState<ViewerMember[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const fetchItems = useCallback(async () => {
    if (!orgId) return;
    setItemsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/recommendations/items?organization_id=${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    } catch { /* fall back silently */ }
    finally { setItemsLoading(false); }
  }, [orgId, apiUrl]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Decide which data source to show
  const useCatalogItems = items.length > 0;

  // Derived legacy recommendations (for fallback + summary stats)
  const legacyRecs = liveRecommendations.map((rec, idx) => ({
    title: rec.title,
    impact: rec.impact >= 150 ? "High" : rec.impact >= 70 ? "Medium" : "Low",
    certainty: rec.certainty,
    timeToImpact: rec.timeToImpact,
    cost: rec.cost > 0
      ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 }).format(rec.cost)
      : "TBD",
    savings: `${Math.round(rec.impact)} kgCO₂e`,
    category: rec.category,
    icon: rec.type === "offset" ? Leaf : rec.category.toLowerCase().includes("energy") ? Zap : rec.category.toLowerCase().includes("transport") ? Factory : Users,
    priority: idx + 1,
    description: rec.description,
    steps: rec.steps,
  }));

  // Summary stats
  const totalPotential = legacyRecs.map((r) => r.savings).map((s) => Number((String(s).match(/[\d.]+/) || ["0"])[0])).reduce((a, b) => a + b, 0);
  const highImpactCount = legacyRecs.filter((r) => r.impact === "High").length;
  const implementedCount = items.filter((i) => i.implementation_status === "implemented").length;
  const avgCertainty = legacyRecs.length > 0 ? legacyRecs.reduce((sum, r) => sum + Number(r.certainty || 0), 0) / legacyRecs.length : 0;

  // Status update handler
  async function handleStatusUpdate(itemId: string, newStatus: ItemStatus) {
    if (!userId) return;
    setStatusUpdating((prev) => new Set(prev).add(itemId));
    try {
      const res = await fetch(`${apiUrl}/recommendations/items/${itemId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, implementation_status: newStatus }),
      });
      if (!res.ok) throw new Error(await res.text());
      setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, implementation_status: newStatus } : i));
      if (newStatus === "implemented") showSuccessToast("Marked as implemented — your Action Score will update.");
      else if (newStatus === "in_progress") showInfoToast("Marked as in progress.");
      else if (newStatus === "rejected") showInfoToast("Dismissed from your list.");
    } catch (e) {
      showErrorToast("Failed to update status: " + (e as Error).message);
    } finally {
      setStatusUpdating((prev) => { const s = new Set(prev); s.delete(itemId); return s; });
    }
  }

  // Group 5.2 — fetch org viewers for assignment
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data } = await supabase
        .from("organization_members")
        .select("user_id, user_profiles(first_name, last_name)")
        .eq("organization_id", orgId)
        .eq("role", "viewer");
      if (data) {
        setViewers(
          (data as unknown as Array<{ user_id: string; user_profiles: { first_name: string | null; last_name: string | null } | null }>)
            .map((m) => ({
              id: m.user_id,
              display_name: m.user_profiles
                ? `${m.user_profiles.first_name ?? ""} ${m.user_profiles.last_name ?? ""}`.trim() || m.user_id.slice(0, 8)
                : m.user_id.slice(0, 8),
            }))
        );
      }
    })();
  }, [orgId]);

  const handleAssign = async (itemId: string, viewerId: string) => {
    setAssigning(itemId);
    try {
      const { error } = await supabase
        .from("recommendation_items")
        .update({ assigned_to: viewerId || null, status_updated_at: new Date().toISOString() })
        .eq("id", itemId);
      if (error) throw error;
      setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, assigned_to: viewerId || null } : i));
      if (viewerId) {
        const viewer = viewers.find((v) => v.id === viewerId);
        showSuccessToast(`Task assigned to ${viewer?.display_name ?? "viewer"}.`);
      } else {
        showInfoToast("Assignment removed.");
      }
    } catch (e) {
      showErrorToast(`Assignment failed: ${(e as Error).message}`);
    } finally {
      setAssigning(null);
    }
  };

  // PDF roadmap
  const handleGenerateRoadmap = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 48;
    const contentWidth = pageWidth - marginX * 2;
    const accentColor: [number, number, number] = [11, 213, 176];
    const mutedText: [number, number, number] = [90, 101, 117];
    let y = 56;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...accentColor);
    doc.text("CarbonSense Recommendations Roadmap", marginX, y);
    y += 32;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...mutedText);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, marginX, y);
    y += 24;

    const source = useCatalogItems ? items : legacyRecs.map((r, i) => ({
      id: String(i), title: r.title, description: r.description, category: r.category,
      implementation_status: "proposed" as ItemStatus, rank: r.priority,
    }));

    source.forEach((rec, idx) => {
      if (y > pageHeight - 80) { doc.addPage(); y = 48; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text(`${idx + 1}. ${rec.title}`, marginX, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...mutedText);
      const lines = doc.splitTextToSize(rec.description, contentWidth) as string[];
      lines.forEach((l) => { doc.text(l, marginX + 12, y); y += 13; });
      y += 10;
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...mutedText);
      doc.text(`CarbonSense Roadmap | Page ${i} of ${totalPages}`, marginX, pageHeight - 16);
    }
    doc.save(`carbonsense-roadmap-${new Date().toISOString().slice(0, 10)}.pdf`);
    showSuccessToast("Custom roadmap downloaded");
  };

  // Filtered items
  const filteredItems = activeFilter === "all" ? items : items.filter((i) => i.implementation_status === activeFilter);

  const isLoading = itemsLoading || legacyLoading;

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Personalised Recommendations</h1>
          <p className="text-slate-400">
            Curated action plan from the Indian MSME emission reduction catalog — ranked by impact and ease
          </p>
        </div>
        <BackButton href="/dashboard" label="Back to Dashboard" variant="outline" />
      </div>

      {/* Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Target className="size-5 text-primary" />
            <p className="text-sm text-slate-400">Total Potential Savings</p>
          </div>
          <p className="text-3xl font-bold text-primary">{Math.round(totalPotential)} kgCO₂e</p>
          <p className="text-xs text-slate-500 mt-1">per year</p>
        </div>
        <div className="glass-card p-5 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="size-5 text-amber-400" />
            <p className="text-sm text-slate-400">High Impact Actions</p>
          </div>
          <p className="text-3xl font-bold text-white">{highImpactCount}</p>
          <p className="text-xs text-slate-500 mt-1">immediate priority</p>
        </div>
        <div className="glass-card p-5 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="size-5 text-emerald-400" />
            <p className="text-sm text-slate-400">
              Implemented{" "}
              <InfoTooltip text="Each implemented action raises your Compliance Action Score. See Compliance page for details." />
            </p>
          </div>
          <p className="text-3xl font-bold text-emerald-400">{implementedCount}</p>
          <p className="text-xs text-slate-500 mt-1">boosts your Action Score</p>
        </div>
        <div className="glass-card p-5 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="size-5 text-sky-400" />
            <p className="text-sm text-slate-400">Avg Certainty</p>
          </div>
          <p className="text-3xl font-bold text-white">{avgCertainty.toFixed(1)}%</p>
          <p className="text-xs text-slate-500 mt-1">confidence level</p>
        </div>
      </div>

      {/* Error / loading states */}
      {legacyError && (
        <div className="border border-rose-500/40 bg-rose-500/10 rounded-xl p-4 text-sm text-rose-200">
          {legacyError}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
          </div>
        </div>
      )}
      {!legacyError && !isLoading && llmUsed === false && (
        <div className="border border-amber-500/40 bg-amber-500/10 rounded-xl p-4 text-sm text-amber-100">
          AI model is not configured — catalog fallback logic was used.{llmWarning ? ` (${llmWarning})` : ""}
        </div>
      )}
      {isLoading && (
        <div className="border border-primary/30 bg-primary/10 rounded-xl p-4 text-sm text-primary">
          Loading recommendations from your emissions data…
        </div>
      )}

      {/* ── CATALOG ITEMS VIEW ─────────────────────────────────────────── */}
      {useCatalogItems && !isLoading && (
        <>
          {/* Filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="size-4 text-slate-500" />
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeFilter === f.value
                    ? "bg-teal-500 text-background-dark"
                    : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                {f.label}
                {f.value !== "all" && (
                  <span className="ml-1 text-slate-500">
                    ({items.filter((i) => i.implementation_status === f.value).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Items list */}
          <div className="space-y-3">
            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-sm">
                No recommendations in this category yet.
              </div>
            )}
            {filteredItems.map((item) => {
              const isUpdating = statusUpdating.has(item.id);
              const status = item.implementation_status;
              return (
                <div
                  key={item.id}
                  className={`bg-slate-900/50 border rounded-xl p-5 transition-all ${
                    status === "implemented"
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : status === "rejected"
                      ? "border-slate-800/50 opacity-60"
                      : status === "in_progress"
                      ? "border-amber-500/25 bg-amber-500/5"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs text-slate-500 font-mono">#{item.rank}</span>
                        <Badge variant="default">{item.category}</Badge>
                        {item.difficulty && (
                          <Badge
                            variant={
                              item.difficulty === "Easy" ? "success"
                                : item.difficulty === "Medium" ? "warning"
                                : "default"
                            }
                          >
                            {item.difficulty}
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-white font-semibold text-sm mb-1.5">{item.title}</h3>
                      <p className="text-slate-400 text-xs leading-relaxed">{item.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <StatusBadge status={status} />
                      {/* Action buttons */}
                      {status !== "implemented" && status !== "rejected" && (
                        <div className="flex gap-2 mt-1">
                          {status === "proposed" && (
                            <button
                              disabled={isUpdating}
                              onClick={() => handleStatusUpdate(item.id, "in_progress")}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <PlayCircle className="size-3.5" />
                              Start
                            </button>
                          )}
                          <button
                            disabled={isUpdating}
                            onClick={() => handleStatusUpdate(item.id, "implemented")}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 className="size-3.5" />
                            {isUpdating ? "Saving…" : "Mark Implemented"}
                          </button>
                          <button
                            disabled={isUpdating}
                            onClick={() => handleStatusUpdate(item.id, "rejected")}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <XCircle className="size-3.5" />
                            Dismiss
                          </button>
                        </div>
                      )}
                      {(status === "implemented" || status === "rejected") && (
                        <button
                          disabled={isUpdating}
                          onClick={() => handleStatusUpdate(item.id, "proposed")}
                          className="text-xs text-slate-500 hover:text-slate-300 underline transition-colors"
                        >
                          Undo
                        </button>
                      )}

                      {/* Group 5.2 — Assign to viewer */}
                      {viewers.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <UserPlus className="size-3 text-slate-500" />
                          <select
                            value={item.assigned_to ?? ""}
                            onChange={(e) => handleAssign(item.id, e.target.value)}
                            disabled={assigning === item.id}
                            className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                          >
                            <option value="">Assign to…</option>
                            {viewers.map((v) => (
                              <option key={v.id} value={v.id}>{v.display_name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── LEGACY FALLBACK VIEW (when no catalog items yet) ────────────── */}
      {!useCatalogItems && !isLoading && !legacyError && (
        <>
          {legacyRecs.length === 0 ? (
            <div className="border border-slate-700 bg-navy-muted/40 rounded-xl p-4 text-sm text-slate-300">
              No recommendations available yet. Upload data and retry.
            </div>
          ) : (
            <div className="space-y-4">
              {legacyRecs.map((rec, index) => {
                const Icon = rec.icon;
                return (
                  <DashboardCard
                    key={index}
                    title={`${rec.priority}. ${rec.title}`}
                    subtitle={rec.description}
                    icon={<Icon className="size-5" />}
                    className={rec.priority <= 2 ? "border-primary/30 bg-primary/5" : ""}
                    headerAction={
                      <div className="flex items-center gap-2">
                        <Badge variant={rec.impact === "High" ? "success" : rec.impact === "Medium" ? "warning" : "default"}>
                          {rec.impact} Impact
                        </Badge>
                        <Badge variant="info">{rec.certainty}% Certainty</Badge>
                      </div>
                    }
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Potential Savings</p>
                          <p className="text-2xl font-bold text-primary">{rec.savings}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Time to Impact</p>
                          <p className="text-lg font-semibold text-white">{rec.timeToImpact}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Estimated Cost</p>
                          <p className="text-lg font-semibold text-white">{rec.cost}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Category</p>
                          <Badge variant="default">{rec.category}</Badge>
                        </div>
                      </div>
                      <div className="lg:col-span-2">
                        <h4 className="text-sm font-semibold text-white mb-3">Implementation Steps:</h4>
                        <div className="space-y-2 mb-4">
                          {rec.steps.map((step, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-3 bg-navy-muted/50 rounded-lg">
                              <div className="flex items-center justify-center size-6 rounded-full bg-primary/20 text-primary text-xs font-bold">
                                {idx + 1}
                              </div>
                              <span className="text-sm text-slate-300">{step}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-3">
                          <Button
                            variant={rec.priority <= 2 ? "primary" : "outline"}
                            icon={<ArrowRight className="size-4" />}
                            onClick={() => showInfoToast("Generate custom roadmap or upload emissions data to start tracking live items.")}
                          >
                            Begin Implementation
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => showInfoToast(`Detailed Plan: ${rec.title}`)}
                          >
                            View Detailed Plan
                          </Button>
                        </div>
                      </div>
                    </div>
                  </DashboardCard>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Priority Notice */}
      <div className="bg-gradient-to-r from-primary/20 to-emerald-500/20 border-2 border-primary/30 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <Sparkles className="size-8 text-primary flex-shrink-0" />
          <div>
            <h3 className="text-lg font-bold text-white mb-2">Priority Guidance</h3>
            <p className="text-slate-300 text-sm mb-3">
              Mark recommendations as <strong className="text-emerald-400">Implemented</strong> as you complete them —
              each one directly increases your{" "}
              <strong className="text-primary">Compliance Action Score</strong>.
              Tree planting should complement, not replace, reduction strategies.
            </p>
            <div className="flex gap-3">
              <Button variant="primary" size="sm" onClick={handleGenerateRoadmap}>
                Generate Custom Roadmap
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { showInfoToast("Opening AI policy intelligence..."); router.push("/policy-intelligence"); }}>
                View Matching Policies
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
