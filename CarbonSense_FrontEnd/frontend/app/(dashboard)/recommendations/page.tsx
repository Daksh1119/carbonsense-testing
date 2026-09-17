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

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  ThumbsUp,
  ThumbsDown,
  Flag,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Scale,
  Loader2,
} from "lucide-react";
import PolicyReferenceModal from "@/components/PolicyReferenceModal";

// ---------------------------------------------------------------------------
// Evidence citation mapping — mirrors the backend knowledge base sources
// (GHG Protocol, IEA, ENERGY STAR, EPA SmartWay, DEFRA, CDP, IPCC AR6)
// ---------------------------------------------------------------------------
const CATEGORY_EVIDENCE: Record<string, { citation: string; framework: string }[]> = {
  Energy: [
    { citation: "ENERGY STAR Portfolio Manager Technical Reference, 2023", framework: "ENERGY STAR" },
    { citation: "IEA Energy Efficiency 2023, Chapter 3: Buildings", framework: "IEA" },
    { citation: "ASHRAE Standard 90.1-2022: Lighting & HVAC", framework: "ASHRAE" },
    { citation: "GHG Protocol Corporate Standard: Scope 2 Accounting", framework: "GHG Protocol" },
  ],
  Transport: [
    { citation: "EPA SmartWay Program Carrier Efficiency Guide, 2023", framework: "EPA SmartWay" },
    { citation: "IPCC AR6 Working Group III, Chapter 10: Transport", framework: "IPCC AR6" },
    { citation: "DEFRA GHG Reporting Conversion Factors, 2023", framework: "DEFRA" },
    { citation: "GHG Protocol Category 6 & 7: Business Travel & Commuting", framework: "GHG Protocol" },
  ],
  Procurement: [
    { citation: "CDP Supply Chain Report 2023: Supplier Engagement", framework: "CDP" },
    { citation: "GHG Protocol Scope 3 Standard: Category 1 Purchased Goods", framework: "GHG Protocol" },
    { citation: "Science Based Targets initiative (SBTi) Supplier Guidance", framework: "SBTi" },
  ],
  Waste: [
    { citation: "EPA WARM Model v15, 2023", framework: "EPA WARM" },
    { citation: "DEFRA UK Waste Conversion Factors, 2023", framework: "DEFRA" },
    { citation: "GHG Protocol Category 5: Waste Generated in Operations", framework: "GHG Protocol" },
    { citation: "IPCC AR6 WG3 Chapter 7: AFOLU — Waste Methane", framework: "IPCC AR6" },
  ],
  Offset: [
    { citation: "Verra Verified Carbon Standard (VCS) VM0010, 2023", framework: "Verra VCS" },
    { citation: "IPCC AR6 WG3 Chapter 7: Land-based mitigation", framework: "IPCC AR6" },
    { citation: "Gold Standard for the Global Goals: Afforestation/Reforestation", framework: "Gold Standard" },
    { citation: "CarbonSense TEME V4: Survival-adjusted sequestration", framework: "TEME" },
  ],
  Policy: [
    { citation: "World Bank Carbon Pricing Leadership Coalition Guidance", framework: "World Bank" },
    { citation: "SBTi Corporate Standard v2.0, 2023", framework: "SBTi" },
    { citation: "CDP Climate Change 2023: Governance & Targets", framework: "CDP" },
  ],
};

const FRAMEWORK_COLORS: Record<string, string> = {
  "ENERGY STAR": "text-amber-400 bg-amber-500/10 border-amber-500/20",
  IEA:           "text-sky-400 bg-sky-500/10 border-sky-500/20",
  ASHRAE:        "text-violet-400 bg-violet-500/10 border-violet-500/20",
  "GHG Protocol":"text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  "EPA SmartWay":"text-teal-400 bg-teal-500/10 border-teal-500/20",
  "IPCC AR6":    "text-rose-400 bg-rose-500/10 border-rose-500/20",
  DEFRA:         "text-blue-400 bg-blue-500/10 border-blue-500/20",
  CDP:           "text-orange-400 bg-orange-500/10 border-orange-500/20",
  SBTi:          "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  "EPA WARM":    "text-lime-400 bg-lime-500/10 border-lime-500/20",
  "Verra VCS":   "text-green-400 bg-green-500/10 border-green-500/20",
  "Gold Standard":"text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  TEME:          "text-primary bg-primary/10 border-primary/20",
  "World Bank":  "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
};


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ItemStatus = "proposed" | "in_progress" | "implemented" | "rejected";

interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  summary?: string;
  rationale?: string;
  category: string;
  action_type?: string;
  priority?: string;
  difficulty?: string;
  implementation_status: ItemStatus;
  rank: number;
  catalog_entry_id?: string;
  assigned_to?: string | null; // Group 5.2
  estimated_impact_kg_co2e?: number;
  estimated_impact_kg_co2e_low?: number;
  estimated_impact_kg_co2e_high?: number;
  implementation_cost_usd?: number;
  time_to_impact_months?: number;
  confidence_score?: number;
  implementation_steps?: string[];
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

function RecommendationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uploadId = searchParams.get("upload_id") || undefined;

  const { user } = useUserStore();
  const orgId = user?.organizationId ?? "";
  const userId = user?.id ?? "";

  // Hook: scoped per-upload (backend caches session per upload_id)
  const { recommendations: liveRecommendations, isLoading: legacyLoading, error: legacyError, llmUsed, llmWarning, refetch, generateFresh } = useRecommendations(uploadId);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true);
    try {
      await generateFresh();
      // Reload catalog items after fresh generation
      // fetchItems is a useCallback and is stable — safe to call here
      if (orgId) {
        setItemsLoading(true);
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
        const res = await fetch(`${apiBase}/recommendations/items?organization_id=${orgId}`);
        if (res.ok) {
          const data = await res.json();
          setItems(data.items ?? []);
        }
        setItemsLoading(false);
      }
    } catch { /* handled inside hook */ }
    finally { setIsRegenerating(false); }
  }, [generateFresh, orgId]);

  // Catalog-based items from the new endpoint
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // Evidence panel + rating state
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(new Set());
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [ratingSending, setRatingSending] = useState<Set<string>>(new Set());

  // Group 5.2 — team viewers for assignment
  const [viewers, setViewers] = useState<ViewerMember[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedPolicyRef, setSelectedPolicyRef] = useState<any | null>(null);


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

  // Summary stats — use liveRecommendations from the cache-first hook.
  // Because the hook now loads stored items and only generates once, these
  // values are stable across page visits (no more random LLM regeneration).
  const totalPotential = liveRecommendations.reduce((sum, rec) => sum + Number(rec.impact || 0), 0);
  const highImpactCount = items.length > 0
    ? items.filter((i) => i.rank <= 2).length   // top-ranked stored items = high impact
    : liveRecommendations.filter((r) => r.impact >= 150).length;
  const implementedCount = items.filter((i) => i.implementation_status === "implemented").length;
  const avgCertainty = liveRecommendations.length > 0
    ? liveRecommendations.reduce((sum, r) => sum + Number(r.certainty || 0), 0) / liveRecommendations.length
    : 0;

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

  // Rating handler — wired to POST /recommendations/items/{id}/rate
  async function handleRate(itemId: string, rating: string) {
    if (!userId || ratingSending.has(itemId)) return;
    setRatingSending((prev) => new Set(prev).add(itemId));
    try {
      const res = await fetch(`${apiUrl}/recommendations/items/${itemId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, rating }),
      });
      if (!res.ok) throw new Error(await res.text());
      setRatings((prev) => ({ ...prev, [itemId]: rating }));
      if (rating === "helpful") showSuccessToast("Thanks! Your feedback helps improve recommendations.");
      else showInfoToast("Feedback noted — we\u2019ll use this to tune future recommendations.");
    } catch (e) {
      showErrorToast("Couldn\u2019t save feedback: " + (e as Error).message);
    } finally {
      setRatingSending((prev) => { const s = new Set(prev); s.delete(itemId); return s; });
    }
  }

  // Toggle evidence panel visibility for a given item
  function toggleEvidence(itemId: string) {
    setExpandedEvidence((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }


  // Group 5.2 — fetch org viewers from user_profiles
  const [delegatedMap, setDelegatedMap] = useState<Record<string, { assignedTo: string; status: string; id: string }>>({});

  const fetchDelegatedItems = useCallback(async () => {
    if (!orgId) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`/api/recommendations/delegate?organizationId=${orgId}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, { assignedTo: string; status: string; id: string }> = {};
        for (const it of (data.items || [])) {
          if (it.assigned_to) {
            map[it.title] = { assignedTo: it.assigned_to, status: it.implementation_status, id: it.id };
            map[it.id] = { assignedTo: it.assigned_to, status: it.implementation_status, id: it.id };
          }
        }
        setDelegatedMap(map);
      }
    } catch (e) {
      console.warn("Could not fetch delegated items:", e);
    }
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      // Query user_profiles directly for viewers in this org
      const { data } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name, email, job_title")
        .eq("organization_id", orgId)
        .eq("role", "viewer");

      if (data && data.length > 0) {
        setViewers(
          data.map((m) => {
            const name = [m.first_name, m.last_name].filter(Boolean).join(" ");
            const label = name ? `${name} (${m.email})` : m.email;
            return {
              id: m.id,
              display_name: label,
            };
          })
        );
      }
    })();

    fetchDelegatedItems();
  }, [orgId, fetchDelegatedItems]);

  const handleDelegateTask = async (
    title: string,
    description: string,
    category: string,
    viewerId: string,
    recId?: string
  ) => {
    const key = recId || title;
    setAssigning(key);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch("/api/recommendations/delegate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          recommendationId: recId,
          title,
          description,
          category,
          assignedTo: viewerId || null,
          organizationId: orgId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delegation failed");

      setDelegatedMap((prev) => {
        const next = { ...prev };
        if (viewerId) {
          next[title] = { assignedTo: viewerId, status: "proposed", id: data.item?.id || recId || "" };
          if (recId) next[recId] = { assignedTo: viewerId, status: "proposed", id: data.item?.id || recId };
        } else {
          delete next[title];
          if (recId) delete next[recId];
        }
        return next;
      });

      if (recId) {
        setItems((prev) => prev.map((i) => (i.id === recId ? { ...i, assigned_to: viewerId || null } : i)));
      }

      if (viewerId) {
        const viewer = viewers.find((v) => v.id === viewerId);
        showSuccessToast(`Action delegated to ${viewer?.display_name || "employee"}! They can now view and update it from their dashboard.`);
      } else {
        showInfoToast("Delegation removed.");
      }
    } catch (e) {
      showErrorToast(`Delegation failed: ${(e as Error).message}`);
    } finally {
      setAssigning(null);
    }
  };

  const handleAssign = async (itemId: string, viewerId: string) => {
    const it = items.find((i) => i.id === itemId);
    if (it) {
      await handleDelegateTask(it.title, it.description, it.category, viewerId, itemId);
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

  const isLoading = itemsLoading || (legacyLoading && items.length === 0);

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
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={<Scale className="size-3.5 text-teal-400" />}
            onClick={() => {
              setSelectedPolicyRef({
                name: "National Action Plan on Climate Change & Energy Conservation Act",
                short_name: "NAPCC & ECA 2022",
                authority: "Ministry of Power / BEE / MoEFCC",
                category: "Energy",
                layer: "core",
                act_year: "2022",
                gazette_no: "Gazette Notification No. CG-DL-E-20122022-241243",
                citation_standard: "ISO 14064 & GHG Protocol Corporate Standard",
                document_summary: {
                  gazette_reference: "Energy Conservation (Amendment) Act 2022 / BEE Carbon Credit Trading Scheme",
                  key_mandates: [
                    "Prescription of minimum share of consumption of non-fossil sources by designated consumers",
                    "Issuance of Carbon Credit Certificates under Indian Carbon Market (ICM)",
                    "Establishment of domestic carbon accounting and reduction standards for commercial and industrial sectors",
                  ],
                  applies_to: [
                    "Designated Consumers across manufacturing, data centres, transport, and commercial buildings",
                    "MSMEs and supply chain partners adopting voluntary decarbonization targets",
                  ],
                  penalties: [
                    "Failure to comply with non-fossil consumption mandates attracts penalties up to ₹10 Lakh plus value of shortfall per metric tonne of oil equivalent",
                  ],
                  key_dates: [
                    "Annual compliance filing due within 90 days of financial year end",
                  ],
                  source_url: "https://beeindia.gov.in",
                },
                requirements: [
                  "Energy audit report filing with State Designated Agency (SDA)",
                  "Scope 1 & 2 carbon accounting and target baseline setting",
                ],
              });
            }}
          >
            Policy Citations
          </Button>
          <BackButton href="/dashboard" label="Back to Dashboard" variant="outline" />
          <button
            type="button"
            disabled={isRegenerating}
            onClick={handleRegenerate}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-slate-600 text-slate-300 hover:border-primary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Force-generate a fresh set of recommendations using latest data"
          >
            <Sparkles className="size-3.5" />
            {isRegenerating ? "Regenerating…" : "Regenerate"}
          </button>
        </div>
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
              const isEvidenceOpen = expandedEvidence.has(item.id);
              const currentRating = ratings[item.id];
              const isRatingSending = ratingSending.has(item.id);
              const evidenceSources = CATEGORY_EVIDENCE[item.category] ?? CATEGORY_EVIDENCE["Energy"];
              return (
                <div
                  key={item.id}
                  className={`bg-slate-900/50 border rounded-xl transition-all ${
                    status === "implemented"
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : status === "rejected"
                      ? "border-slate-800/50 opacity-60"
                      : status === "in_progress"
                      ? "border-amber-500/25 bg-amber-500/5"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {/* ── Main card row ── */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-xs text-slate-500 font-mono font-semibold">#{item.rank}</span>
                          <Badge variant="default">{item.category}</Badge>
                          {item.action_type && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                              {item.action_type}
                            </span>
                          )}
                          {item.priority && (
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                              item.priority === "critical" || item.priority === "high"
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                : item.priority === "medium"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}>
                              {item.priority} Priority
                            </span>
                          )}
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
                        <h3 className="text-white font-semibold text-base mb-1.5">{item.title}</h3>
                        <p className="text-slate-300 text-xs leading-relaxed">
                          {item.summary || item.description}
                        </p>
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
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap justify-end">
                            <UserPlus className="size-3 text-teal-400" />
                            <select
                              value={item.assigned_to ?? ""}
                              onChange={(e) => handleAssign(item.id, e.target.value)}
                              disabled={assigning === item.id}
                              className={`text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-teal-500 disabled:opacity-50 transition-colors ${
                                item.assigned_to
                                  ? "bg-teal-500/15 border border-teal-500/40 text-teal-300 font-medium"
                                  : "bg-slate-800 border border-slate-700 text-slate-300"
                              }`}
                            >
                              <option value="">Assign Employee…</option>
                              {viewers.map((v) => (
                                <option key={v.id} value={v.id}>
                                  👤 {v.display_name}
                                </option>
                              ))}
                            </select>
                            {item.assigned_to && (
                              <span className="text-[10px] text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                                Delegated to {viewers.find((v) => v.id === item.assigned_to)?.display_name || "Employee"}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Key Metrics Strip ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-800/80">
                      <div className="p-2.5 bg-slate-950/40 rounded-lg border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5">Potential Savings</span>
                        <span className="text-sm font-bold text-teal-400">
                          {item.estimated_impact_kg_co2e != null && item.estimated_impact_kg_co2e > 0
                            ? `${Math.round(item.estimated_impact_kg_co2e).toLocaleString()} kgCO₂e`
                            : "High Impact"}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-950/40 rounded-lg border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5">Estimated Cost</span>
                        <span className="text-sm font-bold text-white">
                          {item.implementation_cost_usd != null && item.implementation_cost_usd > 0
                            ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 }).format(item.implementation_cost_usd * 83)
                            : "Low Capex / Policy"}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-950/40 rounded-lg border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5">Time to Impact</span>
                        <span className="text-sm font-bold text-white">
                          {item.time_to_impact_months != null ? `${item.time_to_impact_months} months` : "1-3 months"}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-950/40 rounded-lg border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5">Certainty Score</span>
                        <span className="text-sm font-bold text-emerald-400">
                          {item.confidence_score != null ? `${Math.round(item.confidence_score * 100)}%` : "80%"}
                        </span>
                      </div>
                    </div>

                    {/* ── Manager's Strategic Rationale Box ── */}
                    {item.rationale && (
                      <div className="mt-3.5 p-3.5 bg-teal-950/20 border border-teal-500/20 rounded-xl">
                        <div className="flex items-center gap-1.5 mb-1.5 text-xs font-semibold text-teal-300">
                          <Sparkles className="size-3.5 text-teal-400" />
                          <span>Manager&apos;s Strategic Rationale &amp; Operational Case</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {item.rationale}
                        </p>
                      </div>
                    )}

                    {/* ── Manager's Action Roadmap (What to do) ── */}
                    {item.implementation_steps && item.implementation_steps.length > 0 && (
                      <div className="mt-3.5">
                        <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Target className="size-3.5 text-teal-400" />
                          <span>Action Plan: What the Manager &amp; Team Should Do</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {item.implementation_steps.map((step, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-2.5 p-2.5 bg-slate-950/40 border border-slate-800/70 rounded-lg"
                            >
                              <span className="flex-shrink-0 size-5 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-[10px] font-bold flex items-center justify-center mt-0.5">
                                {idx + 1}
                              </span>
                              <span className="text-xs text-slate-300 leading-snug">{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Bottom bar: evidence toggle + rating buttons ── */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/60">
                      {/* Evidence toggle */}
                      <button
                        onClick={() => toggleEvidence(item.id)}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-teal-400 transition-colors"
                      >
                        <BookOpen className="size-3.5" />
                        View Sources
                        {isEvidenceOpen
                          ? <ChevronUp className="size-3" />
                          : <ChevronDown className="size-3" />}
                      </button>

                      {/* Rating buttons */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-600 mr-1">Was this useful?</span>
                        {currentRating ? (
                          <span className="text-xs text-teal-400 font-medium">
                            {currentRating === "helpful" ? "✔ Helpful" : currentRating === "not_helpful" ? "✕ Not helpful" : "⚑ Flagged"}
                          </span>
                        ) : (
                          <>
                            <button
                              disabled={isRatingSending}
                              onClick={() => handleRate(item.id, "helpful")}
                              title="This recommendation is helpful"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                            >
                              <ThumbsUp className="size-3.5" />
                            </button>
                            <button
                              disabled={isRatingSending}
                              onClick={() => handleRate(item.id, "not_helpful")}
                              title="This recommendation is not helpful"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                            >
                              <ThumbsDown className="size-3.5" />
                            </button>
                            <button
                              disabled={isRatingSending}
                              onClick={() => handleRate(item.id, "not_relevant")}
                              title="This recommendation is not relevant to us"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-40"
                            >
                              <Flag className="size-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Expandable Evidence Panel ── */}
                  {isEvidenceOpen && (
                    <div className="border-t border-slate-800/80 bg-slate-950/50 rounded-b-xl px-5 py-4">
                      <div className="flex items-center gap-2 mb-3">
                        <BookOpen className="size-3.5 text-teal-400" />
                        <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">Evidence & Sources</span>
                        <span className="text-xs text-slate-600 ml-1">— This recommendation is grounded in these verified frameworks</span>
                      </div>
                      <div className="space-y-2">
                        {evidenceSources.map((src, idx) => (
                          <div key={idx} className="flex items-start gap-2.5">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border flex-shrink-0 mt-0.5 ${
                              FRAMEWORK_COLORS[src.framework] ?? "text-slate-400 bg-slate-800 border-slate-700"
                            }`}>
                              {src.framework}
                            </span>
                            <p className="text-xs text-slate-400 leading-relaxed">{src.citation}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-600 mt-3">
                        Impact ranges derived from GHG Protocol reduction factors applied to your organisation&apos;s actual KPI data.
                        All citations are publicly available.
                      </p>
                    </div>
                  )}
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
                        {delegatedMap[rec.title]?.assignedTo && (
                          <Badge variant="success">Assigned to Employee</Badge>
                        )}
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
                            onClick={() => {
                              const assigned = delegatedMap[rec.title]?.assignedTo;
                              if (assigned) {
                                const vName = viewers.find(v => v.id === assigned)?.display_name || "employee";
                                showSuccessToast(`This action is in progress with ${vName}!`);
                              } else {
                                showInfoToast("Use the delegation dropdown below to assign this task to an employee.");
                              }
                            }}
                          >
                            {delegatedMap[rec.title]?.assignedTo ? "Delegated & In Progress" : "Begin Implementation"}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => showInfoToast(`Detailed Plan: ${rec.title}`)}
                          >
                            View Detailed Plan
                          </Button>
                        </div>

                        {/* Group 5.2 Delegation Section */}
                        <div className="mt-5 pt-4 border-t border-navy-border/60 flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-2">
                            <UserPlus className="size-4 text-teal-400" />
                            <span className="text-xs font-semibold text-slate-300">Delegate Task:</span>
                            <select
                              value={delegatedMap[rec.title]?.assignedTo || ""}
                              onChange={(e) => handleDelegateTask(rec.title, rec.description, rec.category, e.target.value)}
                              disabled={assigning === rec.title}
                              className={`text-xs rounded-lg px-3 py-1.5 focus:outline-none transition-colors ${
                                delegatedMap[rec.title]?.assignedTo
                                  ? "bg-teal-500/15 border border-teal-500/40 text-teal-300 font-medium"
                                  : "bg-navy-muted border border-navy-border text-slate-300 hover:border-slate-500"
                              }`}
                            >
                              <option value="">Choose employee to assign…</option>
                              {viewers.map((v) => (
                                <option key={v.id} value={v.id}>
                                  👤 {v.display_name}
                                </option>
                              ))}
                            </select>
                            {assigning === rec.title && <Loader2 className="size-3.5 animate-spin text-teal-400" />}
                          </div>

                          {delegatedMap[rec.title]?.assignedTo && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-teal-300 bg-teal-500/15 border border-teal-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                                <CheckCircle2 className="size-3.5 text-teal-400" />
                                Assigned to {viewers.find((v) => v.id === delegatedMap[rec.title]?.assignedTo)?.display_name || "Employee"}
                              </span>
                              <button
                                onClick={() => handleDelegateTask(rec.title, rec.description, rec.category, "")}
                                className="text-xs text-slate-500 hover:text-rose-400 underline transition-colors"
                              >
                                Unassign
                              </button>
                            </div>
                          )}
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

      {/* Policy Reference Modal */}
      <PolicyReferenceModal
        isOpen={Boolean(selectedPolicyRef)}
        onClose={() => setSelectedPolicyRef(null)}
        policy={selectedPolicyRef}
      />
    </div>
  );
}

export default function RecommendationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading recommendations…</div>}>
      <RecommendationsContent />
    </Suspense>
  );
}
