"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import StatsCard from "@/components/StatsCard";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { useEmissions, useEmissionsUploads } from "@/hooks";
import { EmissionsUploadRecord, getUploadDisplayType } from "@/lib/emissions-api";
import { clsx } from "clsx";
import {
  BarChart3,
  TrendingDown,
  PieChart,
  Activity,
  Calendar,
  ArrowRight,
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

const defaultCategoryData = [
  { category: "Transport", value: 420, percentage: 34 },
  { category: "Energy", value: 380, percentage: 31 },
  { category: "Food & Waste", value: 280, percentage: 22 },
  { category: "Purchases", value: 160, percentage: 13 },
];

const COLORS = ["#0bd5b0", "#3b82f6", "#f59e0b", "#ef4444"];

const defaultScopeData = [
  { name: "Scope 1", value: 450 },
  { name: "Scope 2", value: 380 },
  { name: "Scope 3", value: 410 },
];

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
  hasData: boolean;
  isCurrentMonth: boolean;
  uploadCount: number;
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

export default function AnalyticsPage() {
  const router = useRouter();
  const { uploads, isLoading: uploadsLoading } = useEmissionsUploads();
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
  const activeUploadIds = useMemo(
    () => (selectedUploadId ? [selectedUploadId] : uploads.map((upload) => upload.id)),
    [selectedUploadId, uploads]
  );
  const { emissions } = useEmissions({ uploadIds: activeUploadIds });
  const [csvSummary, setCsvSummary] = useState<CsvSummary | null>(null);
  const [requestedUploadId, setRequestedUploadId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("latest_csv_emissions_summary");
      if (!raw) return;
      const parsed = JSON.parse(raw) as CsvSummary;
      setCsvSummary(parsed);
    } catch {
      setCsvSummary(null);
    }

    const uploadId = new URLSearchParams(window.location.search).get("uploadId");
    setRequestedUploadId(uploadId);
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
      return defaultCategoryData;
    }

    const total = Object.values(byCategory).reduce((sum, val) => sum + Number(val || 0), 0) || 1;
    return Object.entries(byCategory).map(([category, value]) => ({
      category,
      value: Math.round(Number(value)),
      percentage: Math.round((Number(value) / total) * 100),
    }));
  }, [activeSummary]);

  const scopeData = useMemo(() => {
    const byScope = activeSummary?.breakdown?.by_scope_kg_co2e;
    if (!byScope || Object.keys(byScope).length === 0) {
      return defaultScopeData;
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

  const monthlyTrend = useMemo<TrendPoint[]>(() => {
    const now = new Date();
    const rollingWindow = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        month: monthDate.toLocaleDateString("en-US", { month: "short" }),
        monthLabel: monthDate.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        monthKey: getMonthKey(monthDate),
        emissions: 0,
        hasData: false,
        isCurrentMonth: index === 5,
        uploadCount: 0,
      };
    });

    const indexByMonth = new Map<string, number>(
      rollingWindow.map((point, index) => [point.monthKey, index])
    );

    for (const upload of uploads) {
      const monthDate = resolveUploadMonthDate(upload);
      if (!monthDate) continue;

      const monthKey = getMonthKey(monthDate);
      const idx = indexByMonth.get(monthKey);
      if (idx === undefined) continue;

      const totalTco2e = Number(((upload.total_emissions_kg || 0) / 1000).toFixed(3));
      rollingWindow[idx].emissions = Number((rollingWindow[idx].emissions + totalTco2e).toFixed(3));
      rollingWindow[idx].hasData = rollingWindow[idx].hasData || totalTco2e > 0;
      rollingWindow[idx].uploadCount += 1;
    }

    return rollingWindow;
  }, [uploads]);

  const selectedUploadTotalKg = Math.round(activeSummary?.totals?.total_kg_co2e || 0);
  const selectedUploadTotalTco2e = Number((selectedUploadTotalKg / 1000).toFixed(2));
  const rollingSixMonthTotalTco2e = Number(
    monthlyTrend.reduce((sum, item) => sum + item.emissions, 0).toFixed(2)
  );
  const monthlyAvgTco2e = Number((rollingSixMonthTotalTco2e / Math.max(monthlyTrend.length, 1)).toFixed(2));
  const topCategory = categoryData.reduce((prev, curr) => (curr.value > prev.value ? curr : prev), categoryData[0]);
  const highestMonth = monthlyTrend.reduce((prev, curr) => (curr.emissions > prev.emissions ? curr : prev), monthlyTrend[0]);
  const lowestMonth = monthlyTrend.reduce((prev, curr) => (curr.emissions < prev.emissions ? curr : prev), monthlyTrend[0]);
  const averageTrend = Number(
    (monthlyTrend.reduce((sum, item) => sum + item.emissions, 0) / Math.max(monthlyTrend.length, 1)).toFixed(2)
  );
  const currentMonthPoint = monthlyTrend[monthlyTrend.length - 1];
  const previousMonthPoint = monthlyTrend.length > 1 ? monthlyTrend[monthlyTrend.length - 2] : null;
  const currentMonthDeltaPct = previousMonthPoint && previousMonthPoint.emissions > 0
    ? Number((((currentMonthPoint.emissions - previousMonthPoint.emissions) / previousMonthPoint.emissions) * 100).toFixed(1))
    : null;
  const currentMonthTag = currentMonthDeltaPct === null
    ? "Not enough data yet"
    : currentMonthDeltaPct < 0
      ? "Getting better"
      : currentMonthDeltaPct > 0
        ? "Increasing"
        : "Stable";

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

      {/* Uploads List */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Uploads</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">By default, all uploads are included. Select one upload only if you want a narrower view.</p>
          </div>
          {selectedUpload && (
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border",
                  getSourceBadge(selectedUpload.source_type)
                )}
              >
                {getUploadDisplayType(selectedUpload)}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(selectedUpload.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {uploads.length === 0 && !uploadsLoading ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              No uploads yet. Analytics will appear after the first upload.
            </div>
          ) : (
            <>
            <button
              type="button"
              onClick={() => setSelectedUploadId(null)}
              className={clsx(
                "px-3 py-2 rounded-lg text-left border transition-all min-w-[180px]",
                selectedUploadId === null
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                  : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500"
              )}
            >
              <span className="text-sm font-semibold block">All Uploads</span>
              <span className={clsx("text-xs block", selectedUploadId === null ? "text-white/80" : "text-slate-500 dark:text-slate-400")}> 
                {uploads.length} upload(s)
              </span>
            </button>

            {uploads.map((upload) => {
              const isActive = upload.id === selectedUploadId;
              const uploadDate = new Date(upload.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              return (
                <button
                  type="button"
                  key={upload.id}
                  onClick={() => setSelectedUploadId(upload.id)}
                  className={clsx(
                    "px-3 py-2 rounded-lg text-left border transition-all min-w-[180px]",
                    isActive
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{uploadDate}</span>
                    <span
                      className={clsx(
                        "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border",
                        getSourceBadge(upload.source_type),
                        isActive ? "border-transparent" : ""
                      )}
                    >
                      {getUploadDisplayType(upload)}
                    </span>
                  </div>
                  <span className={clsx("text-xs truncate text-left block", isActive ? "text-white/80" : "text-slate-500 dark:text-slate-400")}>
                    {upload.original_file_name}
                  </span>
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
          change={selectedUpload ? selectedUpload.original_file_name : "All uploads included"}
          changeType="neutral"
          icon={<Activity className="size-6" />}
        />
        <StatsCard
          title="Average for Last 6 Months"
          value={monthlyAvgTco2e.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          unit="tCO₂e"
          change={currentMonthDeltaPct === null ? "Comparison available after next month upload" : `${currentMonthDeltaPct > 0 ? "+" : ""}${currentMonthDeltaPct}% compared with last month`}
          changeType={currentMonthDeltaPct !== null && currentMonthDeltaPct <= 0 ? "positive" : "negative"}
          icon={<Calendar className="size-6" />}
        />
        <StatsCard
          title="Highest Category"
          value={topCategory?.category || "Transport"}
          unit={`${topCategory?.percentage || 34}% of total`}
          icon={<PieChart className="size-6" />}
        />
        <StatsCard
          title="Current Month Status"
          value={currentMonthTag}
          unit={currentMonthPoint?.monthLabel || "Current month"}
          change={currentMonthPoint?.hasData ? `${currentMonthPoint.uploadCount} upload(s) mapped` : "No uploaded data in current month"}
          changeType={currentMonthDeltaPct !== null && currentMonthDeltaPct <= 0 ? "positive" : "neutral"}
          icon={<TrendingDown className="size-6" />}
        />
      </div>

      {/* Category Breakdown */}
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
                  {cat.value} kg
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

      {/* Monthly Trend */}
      <DashboardCard
        title="6-Month Emissions Trend"
        subtitle="Last 6 months up to the current month. Updated automatically when new uploads are added."
        icon={<Activity className="size-5" />}
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyTrend}>
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
              formatter={(value: number | string) => [
                `${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })} tCO₂e`,
                "Emissions",
              ]}
              labelFormatter={(_label: string, payload) => {
                const point = payload?.[0]?.payload as TrendPoint | undefined;
                const uploadTag = point?.hasData ? `${point.uploadCount} upload(s)` : "No upload data";
                return `${point?.monthLabel || _label} • ${uploadTag}`;
              }}
              contentStyle={{
                backgroundColor: "#16252d",
                border: "1px solid #1e3a3a",
                borderRadius: "0.5rem",
                color: "#fff",
              }}
            />

            <ReferenceLine
              y={averageTrend}
              stroke="#64748b"
              strokeDasharray="4 4"
              label={{ value: `Average ${averageTrend.toFixed(2)}`, fill: "#94a3b8", fontSize: 11, position: "insideTopRight" }}
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
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-navy-muted/50 rounded-lg text-center">
            <p className="text-xs text-slate-400 mb-1">Highest Month</p>
            <p className="text-lg font-bold text-rose-400">
              {highestMonth?.monthLabel} - {highestMonth?.emissions.toLocaleString("en-US", { maximumFractionDigits: 2 })} tCO₂e
            </p>
          </div>
          <div className="p-4 bg-navy-muted/50 rounded-lg text-center">
            <p className="text-xs text-slate-400 mb-1">Lowest Month</p>
            <p className="text-lg font-bold text-emerald-400">
              {lowestMonth?.monthLabel} - {lowestMonth?.emissions.toLocaleString("en-US", { maximumFractionDigits: 2 })} tCO₂e
            </p>
          </div>
          <div className="p-4 bg-navy-muted/50 rounded-lg text-center">
            <p className="text-xs text-slate-400 mb-1">Average</p>
            <p className="text-lg font-bold text-white">{averageTrend.toLocaleString("en-US", { maximumFractionDigits: 2 })} tCO₂e</p>
          </div>
          <div className="p-4 bg-navy-muted/50 rounded-lg text-center">
            <p className="text-xs text-slate-400 mb-1">Current Month</p>
            <p className={`text-lg font-bold ${currentMonthDeltaPct !== null && currentMonthDeltaPct <= 0 ? "text-emerald-400" : "text-white"}`}>
              {currentMonthPoint.monthLabel} - {currentMonthPoint.emissions.toLocaleString("en-US", { maximumFractionDigits: 2 })} tCO₂e
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {currentMonthDeltaPct === null
                ? "Comparison available after next month upload"
                : `${currentMonthDeltaPct > 0 ? "+" : ""}${currentMonthDeltaPct}% compared with last month (${currentMonthTag})`}
            </p>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}
