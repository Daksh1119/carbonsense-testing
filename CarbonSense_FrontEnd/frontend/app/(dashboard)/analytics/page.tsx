"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import StatsCard from "@/components/StatsCard";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { useEmissions, useEmissionsUploads } from "@/hooks";
import { EmissionsUploadRecord, getUploadDisplayType, getUploadDisplayName } from "@/lib/emissions-api";
import { clsx } from "clsx";
import {
  BarChart3,
  TrendingDown,
  PieChart,
  Activity,
  Calendar,
  ArrowRight,
  Search,
  Filter,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RechartsPie,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  ReferenceLine,
} from "recharts";

const COLORS = ["#0bd5b0", "#3b82f6", "#f59e0b", "#ef4444"];

const CATEGORY_TO_SCOPE: Record<string, string> = {
  transport: "Scope 3",
  energy: "Scope 2",
  food: "Scope 3",
  waste: "Scope 3",
  purchases: "Scope 3",
};

type CsvSummary = {
  totals?: {
    total_kg_co2e?: number;
  };
  breakdown?: {
    by_category_kg_co2e?: Record<string, number>;
    by_scope_kg_co2e?: Record<string, number>;
  };
  computed_rows?: Array<{
    date?: string;
    emissions_kg_co2e?: number;
  }>;
};

type TrendPoint = {
  month: string;
  monthLabel: string;
  monthKey: string;
  emissions: number;
  emissionsKg: number;
  hasData: boolean;
  isCurrentMonth: boolean;
  uploadCount: number;
  byCategory: {
    transport: number;
    energy: number;
    waste: number;
    purchases: number;
  };
};

const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const resolveUploadMonthDate = (upload: Pick<EmissionsUploadRecord, "period_start" | "period_end" | "created_at">) => {
  const candidates = [upload.period_end, upload.period_start, upload.created_at];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    }
  }

  return null;
};

// Calculate ISO Week Monday Start & Sunday End dates for clear enterprise reporting
function getIsoWeekDateRange(year: number, weekNo: number): { start: string; end: string } {
  const simple = new Date(Date.UTC(year, 0, 1 + (weekNo - 1) * 7));
  const dow = simple.getUTCDay();
  const isoWeekStart = simple;
  if (dow <= 4) {
    isoWeekStart.setUTCDate(simple.getUTCDate() - (simple.getUTCDay() || 7) + 1);
  } else {
    isoWeekStart.setUTCDate(simple.getUTCDate() + (8 - (simple.getUTCDay() || 7)));
  }
  const isoWeekEnd = new Date(isoWeekStart);
  isoWeekEnd.setUTCDate(isoWeekStart.getUTCDate() + 6);

  const formatShort = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return {
    start: formatShort(isoWeekStart),
    end: formatShort(isoWeekEnd),
  };
}

function AnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedUploadId = searchParams.get("uploadId");

  const { uploads, isLoading: uploadsLoading } = useEmissionsUploads();
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);

  // Upload Search & Filtering state for enterprise scalability (e.g. 50+ uploads)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedFormat, setSelectedFormat] = useState<string>("all");

  const activeUploadIds = useMemo(
    () => (selectedUploadId ? [selectedUploadId] : uploads.map((upload) => upload.id)),
    [selectedUploadId, uploads]
  );
  const { emissions } = useEmissions({ uploadIds: activeUploadIds });
  const [csvSummary, setCsvSummary] = useState<CsvSummary | null>(null);

  type Granularity = 'weekly' | 'monthly' | 'yearly';
  const [granularity, setGranularity] = useState<Granularity>('monthly');

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("latest_csv_emissions_summary");
      if (!raw) return;
      const parsed = JSON.parse(raw) as CsvSummary;
      setCsvSummary(parsed);
    } catch {
      setCsvSummary(null);
    }
  }, []);

  useEffect(() => {
    if (uploads.length === 0) return;

    if (requestedUploadId && uploads.some((upload) => upload.id === requestedUploadId)) {
      setSelectedUploadId(requestedUploadId);
      return;
    }

    if (selectedUploadId && !uploads.some((upload) => upload.id === selectedUploadId)) {
      setSelectedUploadId(null);
    }
  }, [uploads, requestedUploadId, selectedUploadId]);

  const selectedUpload = uploads.find((upload) => upload.id === selectedUploadId) || null;

  // Extract unique available years from upload records
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const u of uploads) {
      const d = resolveUploadMonthDate(u) || new Date(u.created_at);
      years.add(String(d.getFullYear()));
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [uploads]);

  // Filter uploads based on Search, Year, and Format dropdowns
  const filteredUploads = useMemo(() => {
    return uploads.filter((u) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = String(u.original_file_name || "").toLowerCase().includes(query);
        const matchesSource = String(u.source_type || "").toLowerCase().includes(query);
        if (!matchesName && !matchesSource) return false;
      }

      if (selectedYear !== "all") {
        const d = resolveUploadMonthDate(u) || new Date(u.created_at);
        if (String(d.getFullYear()) !== selectedYear) return false;
      }

      if (selectedFormat !== "all") {
        const fmt = getUploadDisplayType(u).toLowerCase();
        if (fmt !== selectedFormat.toLowerCase()) return false;
      }

      return true;
    });
  }, [uploads, searchQuery, selectedYear, selectedFormat]);

  const getSourceBadge = (sourceType?: string) => {
    const type = String(sourceType || "").toLowerCase();
    if (type === "manual") {
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    }
    return "bg-slate-500/20 text-slate-300 border-slate-500/30";
  };

  const derivedSummary = useMemo<CsvSummary | null>(() => {
    if (emissions.length === 0) return null;

    const totalsKg = emissions.reduce((sum, entry) => sum + entry.co2Amount, 0);
    const byCategory: Record<string, number> = {};
    const byScope: Record<string, number> = {};
    const computedRows = emissions.map((entry) => {
      const category = String(entry.category || "purchases").toLowerCase();
      byCategory[category] = (byCategory[category] || 0) + entry.co2Amount;

      const scopeKey = CATEGORY_TO_SCOPE[category] || "Scope 3";
      byScope[scopeKey] = (byScope[scopeKey] || 0) + entry.co2Amount;

      return {
        date: entry.date,
        emissions_kg_co2e: entry.co2Amount,
      };
    });

    return {
      totals: {
        total_kg_co2e: totalsKg,
      },
      breakdown: {
        by_category_kg_co2e: byCategory,
        by_scope_kg_co2e: byScope,
      },
      computed_rows: computedRows,
    };
  }, [emissions]);

  const activeSummary = derivedSummary || csvSummary;

  const categoryData = useMemo(() => {
    const byCategory = activeSummary?.breakdown?.by_category_kg_co2e;
    if (!byCategory || Object.keys(byCategory).length === 0) {
      return [
        { category: "Transport", value: 0, percentage: 0 },
        { category: "Energy", value: 0, percentage: 0 },
        { category: "Waste", value: 0, percentage: 0 },
        { category: "Purchases", value: 0, percentage: 0 },
      ];
    }

    const total = Object.values(byCategory).reduce((sum, val) => sum + Number(val || 0), 0) || 1;
    return Object.entries(byCategory).map(([category, value]) => ({
      category: category.charAt(0).toUpperCase() + category.slice(1),
      value: Math.round(Number(value)),
      percentage: Math.round((Number(value) / total) * 100),
    }));
  }, [activeSummary]);

  const scopeData = useMemo(() => {
    const byScope = activeSummary?.breakdown?.by_scope_kg_co2e;
    if (!byScope || Object.keys(byScope).length === 0) {
      return [
        { name: "Scope 1", value: 0 },
        { name: "Scope 2", value: 0 },
        { name: "Scope 3", value: 0 },
      ];
    }

    const normalized = {
      "Scope 1": 0,
      "Scope 2": 0,
      "Scope 3": 0,
      ...byScope,
    } as Record<string, number>;

    return ["Scope 1", "Scope 2", "Scope 3"].map((name) => ({
      name,
      value: Math.round(Number(normalized[name] || 0)),
    }));
  }, [activeSummary]);

  // Real dynamic grouping by granularity (weekly, monthly, yearly) scoped to active upload filter
  const granularityTrend = useMemo<TrendPoint[]>(() => {
    const activeUploadsList = selectedUploadId
      ? uploads.filter((u) => u.id === selectedUploadId)
      : uploads;

    if (activeUploadsList.length === 0 && emissions.length === 0) {
      return [];
    }

    const getWeekKey = (date: Date) => {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    };

    const getWeekShortLabel = (weekKey: string, multiYear: boolean) => {
      const [year, weekStr] = weekKey.split('-W');
      return multiYear ? `W${weekStr} ('${year.slice(2)})` : `W${weekStr}`;
    };

    const getWeekFullLabel = (weekKey: string) => {
      const [yearStr, weekStr] = weekKey.split('-W');
      const year = Number(yearStr);
      const weekNo = Number(weekStr);
      const range = getIsoWeekDateRange(year, weekNo);
      return `Week ${weekStr}, ${year} (${range.start} - ${range.end})`;
    };

    if (granularity === 'weekly') {
      const weeklyBuckets = new Map<string, {
        label: string;
        emissionsKg: number;
        count: number;
        byCategory: { transport: number; energy: number; waste: number; purchases: number };
      }>();

      if (emissions.length > 0) {
        for (const entry of emissions) {
          const entryDate = entry.date ? new Date(entry.date) : new Date();
          if (Number.isNaN(entryDate.getTime())) continue;

          const key = getWeekKey(entryDate);
          const cat = String(entry.category || "purchases").toLowerCase();
          const existing = weeklyBuckets.get(key) || {
            label: getWeekFullLabel(key),
            emissionsKg: 0,
            count: 0,
            byCategory: { transport: 0, energy: 0, waste: 0, purchases: 0 },
          };
          existing.emissionsKg += entry.co2Amount;
          existing.count += 1;
          if (cat in existing.byCategory) {
            existing.byCategory[cat as keyof typeof existing.byCategory] += entry.co2Amount;
          }
          weeklyBuckets.set(key, existing);
        }
      } else {
        for (const upload of activeUploadsList) {
          const date = resolveUploadMonthDate(upload) || new Date(upload.created_at);
          const key = getWeekKey(date);
          const existing = weeklyBuckets.get(key) || {
            label: getWeekFullLabel(key),
            emissionsKg: 0,
            count: 0,
            byCategory: { transport: 0, energy: 0, waste: 0, purchases: 0 },
          };
          existing.emissionsKg += upload.total_emissions_kg || 0;
          existing.count += 1;
          weeklyBuckets.set(key, existing);
        }
      }

      const sortedEntries = Array.from(weeklyBuckets.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      const yearsPresent = new Set(sortedEntries.map(([k]) => k.split('-W')[0]));
      const multiYear = yearsPresent.size > 1;

      return sortedEntries.map(([key, bucket]) => ({
        month: getWeekShortLabel(key, multiYear),
        monthLabel: bucket.label,
        monthKey: key,
        emissions: Number((bucket.emissionsKg / 1000).toFixed(3)),
        emissionsKg: Math.round(bucket.emissionsKg),
        hasData: bucket.emissionsKg > 0,
        isCurrentMonth: false,
        uploadCount: bucket.count,
        byCategory: bucket.byCategory,
      }));
    }

    if (granularity === 'yearly') {
      const yearlyBuckets = new Map<string, {
        emissionsKg: number;
        count: number;
        byCategory: { transport: number; energy: number; waste: number; purchases: number };
      }>();

      if (emissions.length > 0) {
        for (const entry of emissions) {
          const entryDate = entry.date ? new Date(entry.date) : new Date();
          if (Number.isNaN(entryDate.getTime())) continue;
          const yearKey = String(entryDate.getFullYear());
          const cat = String(entry.category || "purchases").toLowerCase();

          const existing = yearlyBuckets.get(yearKey) || {
            emissionsKg: 0,
            count: 0,
            byCategory: { transport: 0, energy: 0, waste: 0, purchases: 0 },
          };
          existing.emissionsKg += entry.co2Amount;
          existing.count += 1;
          if (cat in existing.byCategory) {
            existing.byCategory[cat as keyof typeof existing.byCategory] += entry.co2Amount;
          }
          yearlyBuckets.set(yearKey, existing);
        }
      } else {
        for (const upload of activeUploadsList) {
          const date = resolveUploadMonthDate(upload) || new Date(upload.created_at);
          const yearKey = String(date.getFullYear());
          const existing = yearlyBuckets.get(yearKey) || {
            emissionsKg: 0,
            count: 0,
            byCategory: { transport: 0, energy: 0, waste: 0, purchases: 0 },
          };
          existing.emissionsKg += upload.total_emissions_kg || 0;
          existing.count += 1;
          yearlyBuckets.set(yearKey, existing);
        }
      }

      return Array.from(yearlyBuckets.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([yearKey, bucket]) => ({
          month: yearKey,
          monthLabel: `Year ${yearKey}`,
          monthKey: yearKey,
          emissions: Number((bucket.emissionsKg / 1000).toFixed(3)),
          emissionsKg: Math.round(bucket.emissionsKg),
          hasData: bucket.emissionsKg > 0,
          isCurrentMonth: yearKey === String(new Date().getFullYear()),
          uploadCount: bucket.count,
          byCategory: bucket.byCategory,
        }));
    }

    // Monthly View
    const monthlyBuckets = new Map<string, {
      label: string;
      emissionsKg: number;
      count: number;
      byCategory: { transport: number; energy: number; waste: number; purchases: number };
    }>();

    if (emissions.length > 0) {
      for (const entry of emissions) {
        const entryDate = entry.date ? new Date(entry.date) : new Date();
        if (Number.isNaN(entryDate.getTime())) continue;
        const monthKey = getMonthKey(entryDate);
        const monthLabel = entryDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
        const cat = String(entry.category || "purchases").toLowerCase();

        const existing = monthlyBuckets.get(monthKey) || {
          label: monthLabel,
          emissionsKg: 0,
          count: 0,
          byCategory: { transport: 0, energy: 0, waste: 0, purchases: 0 },
        };
        existing.emissionsKg += entry.co2Amount;
        existing.count += 1;
        if (cat in existing.byCategory) {
          existing.byCategory[cat as keyof typeof existing.byCategory] += entry.co2Amount;
        }
        monthlyBuckets.set(monthKey, existing);
      }
    } else {
      for (const upload of activeUploadsList) {
        const date = resolveUploadMonthDate(upload) || new Date(upload.created_at);
        const monthKey = getMonthKey(date);
        const monthLabel = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });

        const existing = monthlyBuckets.get(monthKey) || {
          label: monthLabel,
          emissionsKg: 0,
          count: 0,
          byCategory: { transport: 0, energy: 0, waste: 0, purchases: 0 },
        };
        existing.emissionsKg += upload.total_emissions_kg || 0;
        existing.count += 1;
        monthlyBuckets.set(monthKey, existing);
      }
    }

    return Array.from(monthlyBuckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, bucket]) => {
        const [year, monthNum] = key.split('-');
        const dateObj = new Date(Number(year), Number(monthNum) - 1, 1);
        const shortName = dateObj.toLocaleDateString("en-US", { month: "short" });
        return {
          month: shortName,
          monthLabel: bucket.label,
          monthKey: key,
          emissions: Number((bucket.emissionsKg / 1000).toFixed(3)),
          emissionsKg: Math.round(bucket.emissionsKg),
          hasData: bucket.emissionsKg > 0,
          isCurrentMonth: key === getMonthKey(new Date()),
          uploadCount: bucket.count,
          byCategory: bucket.byCategory,
        };
      });
  }, [granularity, emissions, uploads, selectedUploadId]);

  const selectedUploadTotalKg = Math.round(activeSummary?.totals?.total_kg_co2e || 0);
  const selectedUploadTotalTco2e = Number((selectedUploadTotalKg / 1000).toFixed(2));
  
  const trendPoints = granularityTrend;
  const periodLabelSingular = granularity === 'weekly' ? 'Week' : granularity === 'yearly' ? 'Year' : 'Month';
  const periodLabelPlural = granularity === 'weekly' ? 'Weeks' : granularity === 'yearly' ? 'Years' : 'Months';

  const highestPeriod = trendPoints.length > 0
    ? trendPoints.reduce((prev, curr) => (curr.emissions > prev.emissions ? curr : prev), trendPoints[0])
    : null;
  const lowestPeriod = trendPoints.length > 0
    ? trendPoints.reduce((prev, curr) => (curr.emissions < prev.emissions ? curr : prev), trendPoints[0])
    : null;
  
  const totalTrendEmissions = trendPoints.reduce((sum, item) => sum + item.emissions, 0);
  const averageTrend = trendPoints.length > 0
    ? Number((totalTrendEmissions / trendPoints.length).toFixed(2))
    : 0;

  const currentPeriodPoint = trendPoints.length > 0 ? trendPoints[trendPoints.length - 1] : null;
  const previousPeriodPoint = trendPoints.length > 1 ? trendPoints[trendPoints.length - 2] : null;
  
  const currentPeriodDeltaPct = previousPeriodPoint && previousPeriodPoint.emissions > 0
    ? Number((((currentPeriodPoint!.emissions - previousPeriodPoint.emissions) / previousPeriodPoint.emissions) * 100).toFixed(1))
    : null;

  const topCategory = categoryData.reduce((prev, curr) => (curr.value > prev.value ? curr : prev), categoryData[0]);

  const currentPeriodTag = currentPeriodDeltaPct === null
    ? "Not enough prior period data"
    : currentPeriodDeltaPct < 0
      ? "Decreasing trend"
      : currentPeriodDeltaPct > 0
        ? "Increasing trend"
        : "Stable trend";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Analytics & Simulation
          </h1>
          <p className="text-slate-400">
            Deep insights into emissions patterns and forecasting
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Granularity selector */}
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
            {(['weekly', 'monthly', 'yearly'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                  granularity === g
                    ? 'bg-teal-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            icon={<ArrowRight className="size-4" />}
            onClick={() => router.push("/recommendations")}
          >
            View Recommendations
          </Button>
          <BackButton href="/dashboard" label="Back to Dashboard" variant="outline" />
        </div>
      </div>

      {/* Uploads Filter & Management Section (Enterprise Scalability) */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Upload Datasets</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-500/20 text-teal-400 border border-teal-500/30">
                Showing {filteredUploads.length} of {uploads.length} upload(s)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Select an upload file to isolate its dataset or choose 'All Uploads' for cumulative enterprise analytics.</p>
          </div>

          {/* Upload Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search file name..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>

            {availableYears.length > 0 && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-teal-500"
              >
                <option value="all">All Years</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>Year {yr}</option>
                ))}
              </select>
            )}

            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-teal-500 uppercase"
            >
              <option value="all">All Formats</option>
              <option value="csv">CSV</option>
              <option value="tsv">TSV</option>
              <option value="json">JSON</option>
              <option value="manual">Manual</option>
            </select>
          </div>
        </div>

        {/* Scrollable Upload Pill List */}
        <div className="flex flex-wrap gap-2.5 max-h-56 overflow-y-auto pr-1">
          {uploads.length === 0 && !uploadsLoading ? (
            <div className="text-sm text-slate-500 dark:text-slate-400 py-2">
              No uploads recorded yet. Upload emissions data to enable analytics.
            </div>
          ) : filteredUploads.length === 0 ? (
            <div className="text-sm text-slate-400 py-2">
              No dataset matching "{searchQuery}".
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSelectedUploadId(null)}
                className={clsx(
                  "px-3 py-2 rounded-lg text-left border transition-all min-w-[170px]",
                  selectedUploadId === null
                    ? "bg-teal-600 text-white border-teal-600 shadow-md"
                    : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-500"
                )}
              >
                <span className="text-xs font-semibold block">All Uploads</span>
                <span className={clsx("text-[11px] block mt-0.5", selectedUploadId === null ? "text-white/80" : "text-slate-500 dark:text-slate-400")}> 
                  {uploads.length} total file(s)
                </span>
              </button>

              {filteredUploads.map((upload) => {
                const isActive = upload.id === selectedUploadId;
                const resolvedDate = resolveUploadMonthDate(upload) || new Date(upload.created_at);
                const uploadDate = resolvedDate.toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                });
                const totalTco2e = Number(((upload.total_emissions_kg || 0) / 1000).toFixed(2));

                return (
                  <button
                    type="button"
                    key={upload.id}
                    onClick={() => setSelectedUploadId(upload.id)}
                    className={clsx(
                      "px-3 py-2 rounded-lg text-left border transition-all min-w-[180px] flex-1 max-w-[240px]",
                      isActive
                        ? "bg-teal-600 text-white border-teal-600 shadow-md"
                        : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-500"
                    )}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-semibold">{uploadDate}</span>
                      <span
                        className={clsx(
                          "px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wide border",
                          getSourceBadge(upload.source_type),
                          isActive ? "border-transparent text-white bg-white/20" : ""
                        )}
                      >
                        {getUploadDisplayType(upload)}
                      </span>
                    </div>
                    <span className={clsx("text-[11px] truncate text-left block font-mono", isActive ? "text-white/90" : "text-slate-400")}>
                      {getUploadDisplayName(upload)}
                    </span>
                    <div className="flex items-center justify-between mt-1 text-[10px]">
                      <span className={isActive ? "text-white/80" : "text-slate-500"}>{upload.record_count || 0} entries</span>
                      <span className={clsx("font-semibold", isActive ? "text-white" : "text-teal-400")}>{totalTco2e} tCO₂e</span>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard
          title="Total for Selected View"
          value={selectedUploadTotalTco2e.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          unit="tCO₂e"
          change={selectedUpload ? getUploadDisplayName(selectedUpload) : "All uploads included"}
          changeType="neutral"
          icon={<Activity className="size-6" />}
        />
        <StatsCard
          title={`Average Per ${periodLabelSingular}`}
          value={averageTrend.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          unit="tCO₂e"
          change={currentPeriodDeltaPct === null ? "Comparison available after next period data" : `${currentPeriodDeltaPct > 0 ? "+" : ""}${currentPeriodDeltaPct}% compared with prior ${periodLabelSingular.toLowerCase()}`}
          changeType={currentPeriodDeltaPct !== null && currentPeriodDeltaPct <= 0 ? "positive" : "negative"}
          icon={<Calendar className="size-6" />}
        />
        <StatsCard
          title="Highest Category"
          value={topCategory?.category || "Transport"}
          unit={`${topCategory?.percentage || 0}% of total`}
          icon={<PieChart className="size-6" />}
        />
        <StatsCard
          title={`Current ${periodLabelSingular} Status`}
          value={currentPeriodTag}
          unit={currentPeriodPoint?.monthLabel || `Current ${periodLabelSingular.toLowerCase()}`}
          change={currentPeriodPoint?.hasData ? `${currentPeriodPoint.uploadCount} transaction(s) mapped` : "No uploaded data in current period"}
          changeType={currentPeriodDeltaPct !== null && currentPeriodDeltaPct <= 0 ? "positive" : "neutral"}
          icon={<TrendingDown className="size-6" />}
        />
      </div>

      {/* Category & Scope Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCard
          title="Emissions by Category"
          subtitle="Breakdown of carbon sources"
          icon={<PieChart className="size-5" />}
        >
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPie>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, percentage }) => `${category} ${percentage}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#16252d",
                    border: "1px solid #1e3a3a",
                    borderRadius: "0.5rem",
                    color: "#fff",
                  }}
                />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {categoryData.map((cat, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-navy-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index] }}
                  ></div>
                  <span className="text-sm text-slate-300">
                    {cat.category}
                  </span>
                </div>
                <span className="text-sm font-bold text-white">
                  {cat.value.toLocaleString()} kg
                </span>
              </div>
            ))}
          </div>
        </DashboardCard>

        <DashboardCard
          title="Scope Analysis"
          subtitle="GHG Protocol scope breakdown"
          icon={<BarChart3 className="size-5" />}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={scopeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a3a" />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
              />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#16252d",
                  border: "1px solid #1e3a3a",
                  borderRadius: "0.5rem",
                  color: "#fff",
                }}
              />
              <Bar dataKey="value" fill="#0bd5b0" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {scopeData.map((scope, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-navy-muted/50 rounded-lg"
              >
                <span className="text-sm text-slate-300">{scope.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {scope.value.toLocaleString()} kg CO₂e
                  </span>
                  <Badge variant="info">
                      {Math.round((scope.value / Math.max(selectedUploadTotalKg, 1)) * 100)}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>

      {/* Granularity Trend Chart */}
      <DashboardCard
        title={`Emissions Trend — ${granularity.charAt(0).toUpperCase() + granularity.slice(1)} View`}
        subtitle="Chronological carbon trajectory based on recorded transaction dates."
        icon={<Activity className="size-5" />}
      >
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={granularityTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a3a" />
            <XAxis
              dataKey="month"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => Number(value).toFixed(1)}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const point = payload[0].payload as TrendPoint;
                return (
                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white shadow-xl min-w-[200px]">
                    <div className="font-semibold text-teal-400 border-b border-slate-800 pb-1.5 mb-2">
                      {point.monthLabel}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Emissions:</span>
                        <span className="font-bold text-white">{point.emissions} tCO₂e</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Emissions in KG:</span>
                        <span className="font-mono text-slate-300">{point.emissionsKg.toLocaleString()} kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Transactions:</span>
                        <span className="text-slate-300">{point.uploadCount} record(s)</span>
                      </div>
                    </div>
                    {point.byCategory && (
                      <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-1 text-[11px]">
                        <div className="text-slate-400 font-medium mb-1">Category Breakdown:</div>
                        <div className="flex justify-between">
                          <span className="text-teal-400">Transport:</span>
                          <span>{Math.round(point.byCategory.transport)} kg</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-400">Energy:</span>
                          <span>{Math.round(point.byCategory.energy)} kg</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-amber-400">Waste:</span>
                          <span>{Math.round(point.byCategory.waste)} kg</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-rose-400">Purchases:</span>
                          <span>{Math.round(point.byCategory.purchases)} kg</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }}
            />

            <ReferenceLine
              y={averageTrend}
              stroke="#64748b"
              strokeDasharray="4 4"
              label={{ value: `Avg ${averageTrend.toFixed(2)} tCO₂e`, fill: "#94a3b8", fontSize: 11, position: "insideTopRight" }}
            />

            <Line
              type="monotone"
              dataKey="emissions"
              stroke="#0bd5b0"
              strokeWidth={3}
              dot={(props) => {
                const point = props.payload as TrendPoint;
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={point?.isCurrentMonth ? 7 : 5}
                    fill={point?.isCurrentMonth ? "#f8fafc" : point?.hasData ? "#0bd5b0" : "#475569"}
                    stroke={point?.isCurrentMonth ? "#0bd5b0" : "#0f172a"}
                    strokeWidth={point?.isCurrentMonth ? 2 : 1.5}
                  />
                );
              }}
              activeDot={{ r: 8, fill: "#0bd5b0" }}
            >
              <LabelList
                dataKey="emissions"
                position="top"
                fill="#94a3b8"
                fontSize={11}
                formatter={(value: number | string) => Number(value).toFixed(1)}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>

        {/* Dynamic Summary Cards Below Chart */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-navy-muted/50 rounded-lg text-center">
            <p className="text-xs text-slate-400 mb-1">Highest {periodLabelSingular}</p>
            <p className="text-lg font-bold text-rose-400">
              {highestPeriod?.monthLabel || "-"} - {(highestPeriod?.emissions || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} tCO₂e
            </p>
          </div>
          <div className="p-4 bg-navy-muted/50 rounded-lg text-center">
            <p className="text-xs text-slate-400 mb-1">Lowest {periodLabelSingular}</p>
            <p className="text-lg font-bold text-emerald-400">
              {lowestPeriod?.monthLabel || "-"} - {(lowestPeriod?.emissions || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} tCO₂e
            </p>
          </div>
          <div className="p-4 bg-navy-muted/50 rounded-lg text-center">
            <p className="text-xs text-slate-400 mb-1">Period Average</p>
            <p className="text-lg font-bold text-white">{averageTrend.toLocaleString("en-US", { maximumFractionDigits: 2 })} tCO₂e</p>
          </div>
          <div className="p-4 bg-navy-muted/50 rounded-lg text-center">
            <p className="text-xs text-slate-400 mb-1">Latest {periodLabelSingular}</p>
            <p className={`text-lg font-bold ${currentPeriodDeltaPct !== null && currentPeriodDeltaPct <= 0 ? "text-emerald-400" : "text-white"}`}>
              {currentPeriodPoint?.monthLabel || "-"} - {(currentPeriodPoint?.emissions || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} tCO₂e
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {currentPeriodDeltaPct === null
                ? "Comparison available after next period data"
                : `${currentPeriodDeltaPct > 0 ? "+" : ""}${currentPeriodDeltaPct}% compared with prior ${periodLabelSingular.toLowerCase()} (${currentPeriodTag})`}
            </p>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading analytics...</div>}>
      <AnalyticsContent />
    </Suspense>
  );
}
