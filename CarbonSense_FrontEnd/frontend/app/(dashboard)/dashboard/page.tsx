"use client";

import { useEffect, useState } from "react";
import { useDashboardData } from "@/hooks";
import StatsCard from "@/components/StatsCard";
import DashboardCard from "@/components/DashboardCard";
import Badge from "@/components/Badge";
import ProgressBar from "@/components/ProgressBar";
import ScoreRing from "@/components/ScoreRing";
import { CardSkeleton, ChartSkeleton, ErrorState } from "@/components/ui";
import Button from "@/components/Button";
import { Breadcrumb } from "@/components/navigation";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store";


import {
  Area,
  AreaChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Wind,
  TrendingDown,
  Clock,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Zap,
  TreePine,
  FileText,
  ArrowUpRight,
  Plus,
  Eye,
  ExternalLink,
  Upload,
} from "lucide-react";

const fundingOpportunities = [
  {
    title: "DOE Clean Grant",
    amount: "₹6.2M–₹8.6M",
  },
  {
    title: "Private Offset Fund",
    amount: "Post-KYC Eval",
  },
];

const formatMonthLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }).toUpperCase();
};

const formatFullMonthLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const formatTco2e = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return `${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })} tCO₂e`;
};

const formatDeadlineDate = (value?: string | null) => {
  if (!value) return "TBD";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "TBD";
  return parsed.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getDeadlineTone = (priority: string) => {
  if (priority === "critical") return "danger" as const;
  if (priority === "high") return "warning" as const;
  return "default" as const;
};

const getComplianceRingColor = (score: number) => {
  if (score >= 80) return "green" as const;
  if (score >= 60) return "teal" as const;
  if (score >= 40) return "amber" as const;
  return "rose" as const;
};

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboardData();
  const router = useRouter();
  const { user } = useUserStore();

  // Group 4.3 — fetch cycle boundary data for ReferenceLine markers
  const [cycleMarkers, setCycleMarkers] = useState<Array<{ monthLabel: string; label: string }>>([]);

  useEffect(() => {
    const orgId = user?.organizationId;
    if (!orgId) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
    fetch(`${apiUrl}/assessment-cycles/${orgId}/trend`)
      .then((r) => r.ok ? r.json() : null)
      .then((trend) => {
        const series = trend?.series ?? [];
        const markers = series
          .filter((s: { period_start?: string }) => s.period_start)
          .map((s: { period_start: string; source_type?: string }) => ({
            monthLabel: formatMonthLabel(s.period_start),
            label: s.source_type === 'company_profile' ? 'Profile'
                 : s.source_type === 'manual_entry' ? 'Manual'
                 : 'Upload',
          }));
        setCycleMarkers(markers);
      })
      .catch(() => {});
  }, [user?.organizationId]);

  // Show error state
  if (error && !isLoading) {
    return (
      <div className="space-y-6">
        <ErrorState
          title="Failed to load dashboard"
          message={error}
          onRetry={refetch}
        />
      </div>
    );
  }

  // Show loading skeletons
  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>

        {/* Main Chart Skeleton */}
        <ChartSkeleton />

        {/* Two Column Layout Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  const latestHistoricalPoint = data.carbonPath.historical.length > 0
    ? data.carbonPath.historical[data.carbonPath.historical.length - 1]
    : null;
  const previousHistoricalPoint = data.carbonPath.historical.length > 1
    ? data.carbonPath.historical[data.carbonPath.historical.length - 2]
    : null;
  const finalProjectionPoint = data.carbonPath.projected.length > 0
    ? data.carbonPath.projected[data.carbonPath.projected.length - 1]
    : null;

  const monthOverMonthChange = latestHistoricalPoint && previousHistoricalPoint && previousHistoricalPoint.value > 0
    ? Number((((latestHistoricalPoint.value - previousHistoricalPoint.value) / previousHistoricalPoint.value) * 100).toFixed(1))
    : null;

  const carbonPathTrendLabel = monthOverMonthChange === null
    ? "Not enough data yet"
    : monthOverMonthChange < 0
      ? "Getting better"
      : monthOverMonthChange > 0
        ? "Increasing"
        : "Stable";

  const carbonPathData = (() => {
    const lastHistoricalIndex = data.carbonPath.historical.length - 1;

    const historicalSeries = data.carbonPath.historical.map((item, index) => ({
      month: formatMonthLabel(item.date),
      monthLong: formatFullMonthLabel(item.date),
      historical: item.value,
      projection: index === lastHistoricalIndex ? item.value : null,
      phaseTag: index === lastHistoricalIndex ? "Current Month" : "Historical",
      isCurrentMonth: index === lastHistoricalIndex,
      isProjectionPoint: false,
      showProjectionLabel: false,
    }));

    const projectedSeries = data.carbonPath.projected.map((item, index) => ({
      month: formatMonthLabel(item.date),
      monthLong: formatFullMonthLabel(item.date),
      historical: null,
      projection: item.value,
      phaseTag: "Projected",
      isCurrentMonth: false,
      isProjectionPoint: true,
      showProjectionLabel: index === data.carbonPath.projected.length - 1,
    }));

    return [...historicalSeries, ...projectedSeries];
  })();

  const carbonPathYAxisMax = (() => {
    const values = carbonPathData
      .flatMap((point) => [point.historical, point.projection])
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    if (values.length === 0) return 10;

    const rawMax = Math.max(...values);
    const paddedMax = rawMax * 1.12;
    return Math.max(10, Math.ceil(paddedMax / 5) * 5);
  })();

  return (
    <div className="space-y-6">
      {/* Page Header with Breadcrumb */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Executive Dashboard</h1>
          <Breadcrumb />
        </div>
        <Button 
          onClick={() => router.push('/emissions')} 
          icon={<Plus className="h-4 w-4" />}
        >
          Add Emission
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Emissions"
          value={data.totalEmissionsHasData ? data.totalEmissions.toLocaleString() : "None"}
          unit={data.totalEmissionsHasData ? "tCO₂e" : undefined}
          change={`${data.totalEmissionsMeta} • Refreshed ${data.refreshedAtLabel}`}
          changeType="neutral"
          icon={<Wind className="size-6" />}
          onClick={() => router.push('/detailed-log')}
          actionLabel="Open detailed log"
        />
        <StatsCard
          title="Reduction Achieved"
          value={`${data.reductionAchieved}%`}
          change={`${data.reductionBaselineLabel} • ${data.reductionFormula}`}
          changeType={data.reductionAchieved >= 0 ? "positive" : "negative"}
          icon={<TrendingDown className="size-6" />}
          onClick={() => router.push('/analytics')}
          actionLabel="Open analytics details"
        />
        <StatsCard
          title="Time-Debt Status"
          value={data.timeDebtYears ?? "N/A"}
          unit={data.timeDebtYears !== null ? "Years" : "Awaiting TEME"}
          change={data.timeDebtMeta}
          changeType="neutral"
          icon={<Clock className="size-6" />}
          onClick={() => router.push('/tree-engine')}
          actionLabel="Open tree engine and time-debt model"
        />
        <StatsCard
          title="Policy Alerts"
          value={data.policyAlerts.toString()}
          unit="Active"
          change={data.policyMeta}
          changeType="neutral"
          icon={<AlertTriangle className="size-6" />}
          onClick={() => router.push('/policy-intelligence')}
          actionLabel="Open policy intelligence"
        />
      </div>

      {/* Emissions Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => router.push('/emissions')}
          className="group relative bg-background-dark border border-navy-border rounded-xl p-6 hover:border-primary/50 transition-all duration-300 text-left"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-lg p-3">
              <Plus className="size-5" />
            </div>
            <ArrowUpRight className="size-4 text-slate-500 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
          </div>
          <h3 className="text-base font-bold text-white mb-1 group-hover:text-primary transition-colors">
            Add Emission
          </h3>
          <p className="text-sm text-slate-400">
            Start a new transport, energy, waste, or purchases entry
          </p>
        </button>

        <button
          onClick={() => router.push('/data-ingestion')}
          className="group relative bg-background-dark border border-navy-border rounded-xl p-6 hover:border-primary/50 transition-all duration-300 text-left"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg p-3">
              <Upload className="size-5" />
            </div>
            <ArrowUpRight className="size-4 text-slate-500 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
          </div>
          <h3 className="text-base font-bold text-white mb-1 group-hover:text-primary transition-colors">
            Upload File
          </h3>
          <p className="text-sm text-slate-400">
            Upload CSV, TSV, or JSON where supported and review schema guidance
          </p>
        </button>

        <button
          onClick={() => router.push('/detailed-log')}
          className="group relative bg-background-dark border border-navy-border rounded-xl p-6 hover:border-primary/50 transition-all duration-300 text-left"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg p-3">
              <FileText className="size-5" />
            </div>
            <ArrowUpRight className="size-4 text-slate-500 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
          </div>
          <h3 className="text-base font-bold text-white mb-1 group-hover:text-primary transition-colors">
            Detailed Log
          </h3>
          <p className="text-sm text-slate-400">
            Open the upload-wise emissions history and drilldown table
          </p>
        </button>
      </div>

      {/* Policy & Compliance Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => router.push('/policy-intelligence')}
          className="group relative bg-background-dark border border-navy-border rounded-xl p-6 hover:border-primary/50 transition-all duration-300 text-left"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg p-3">
              <Shield className="size-5" />
            </div>
            <ArrowUpRight className="size-4 text-slate-500 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
          </div>
          <h3 className="text-base font-bold text-white mb-1 group-hover:text-primary transition-colors">
            View Policy
          </h3>
          <p className="text-sm text-slate-400">
            Open policy intelligence and funding details
          </p>
        </button>

        <button
          onClick={() => router.push('/compliance')}
          className="group relative bg-background-dark border border-navy-border rounded-xl p-6 hover:border-primary/50 transition-all duration-300 text-left"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg p-3">
              <CheckCircle2 className="size-5" />
            </div>
            <ArrowUpRight className="size-4 text-slate-500 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
          </div>
          <h3 className="text-base font-bold text-white mb-1 group-hover:text-primary transition-colors">
            Check Compliance
          </h3>
          <p className="text-sm text-slate-400">
            Review tasks, deadlines, and score rings
          </p>
        </button>

        <button
          onClick={() => router.push('/compliance?action=upload')}
          className="group relative bg-background-dark border border-navy-border rounded-xl p-6 hover:border-primary/50 transition-all duration-300 text-left"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg p-3">
              <Upload className="size-5" />
            </div>
            <ArrowUpRight className="size-4 text-slate-500 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
          </div>
          <h3 className="text-base font-bold text-white mb-1 group-hover:text-primary transition-colors">
            Upload Evidence
          </h3>
          <p className="text-sm text-slate-400">
            Open the evidence panel directly
          </p>
        </button>
      </div>

      {/* Main Chart */}
      <DashboardCard
        title="Carbon Path 2024-2026"
        subtitle="Recorded monthly emissions with evidence-based forecast for upcoming months"
        headerAction={
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => router.push('/analytics')}
            icon={<Eye className="h-4 w-4" />}
          >
            View Analytics
          </Button>
        }
      >
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={carbonPathData} margin={{ top: 16, right: 18, left: -4, bottom: 0 }}>
              <defs>
                <linearGradient id="historicalFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64748b" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#64748b" stopOpacity={0.04} />
                </linearGradient>
                <linearGradient id="projectionFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0bd5b0" stopOpacity={0.24} />
                  <stop offset="95%" stopColor="#0bd5b0" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a3a" />
              <XAxis
                dataKey="month"
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, carbonPathYAxisMax]}
                tickFormatter={(value) => `${Number(value).toFixed(1)}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#16252d",
                  border: "1px solid #1e3a3a",
                  borderRadius: "0.5rem",
                  color: "#fff",
                }}
                formatter={(value: number | string, name: string, item: { payload?: { phaseTag?: string } }) => {
                  const numeric = Number(value);
                  if (!Number.isFinite(numeric)) return ["N/A", name];
                  const label = name === "historical" ? "Recorded" : "Expected";
                  const suffix = item?.payload?.phaseTag ? ` (${item.payload.phaseTag})` : "";
                  return [`${numeric.toLocaleString("en-US", { maximumFractionDigits: 2 })} tCO₂e`, `${label}${suffix}`];
                }}
                labelFormatter={(_label: string, payload) => {
                  const point = payload?.[0]?.payload as { monthLong?: string } | undefined;
                  return point?.monthLong || _label;
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }}
                formatter={(value) => (value === "historical" ? "Recorded Months" : "Expected Months")}
              />

              {latestHistoricalPoint && (
                <ReferenceLine
                  x={formatMonthLabel(latestHistoricalPoint.date)}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  label={{ value: "Current", fill: "#94a3b8", fontSize: 11, position: "insideTopRight" }}
                />
              )}

              {/* Group 4.3 — cycle boundary markers */}
              {cycleMarkers.map((marker, idx) => (
                <ReferenceLine
                  key={`cycle-${idx}`}
                  x={marker.monthLabel}
                  stroke="#0bd5b0"
                  strokeOpacity={0.35}
                  strokeWidth={1.5}
                  strokeDasharray="2 4"
                  label={{
                    value: marker.label,
                    fill: "#0bd5b0",
                    fontSize: 9,
                    position: "insideTopLeft",
                    opacity: 0.7,
                  }}
                />
              ))}

              <Area
                type="monotone"
                dataKey="historical"
                name="historical"
                stroke="#64748b"
                fill="url(#historicalFill)"
                strokeWidth={2}
                connectNulls={false}
                dot={(props) => {
                  const point = props.payload as { isCurrentMonth?: boolean };
                  return (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={point?.isCurrentMonth ? 5 : 3}
                      fill={point?.isCurrentMonth ? "#f8fafc" : "#64748b"}
                      stroke="#0f172a"
                      strokeWidth={1}
                    />
                  );
                }}
                activeDot={{ r: 6, fill: "#f8fafc", stroke: "#64748b", strokeWidth: 2 }}
              />

              <Area
                type="linear"
                dataKey="projection"
                name="projection-area"
                stroke="none"
                fill="url(#projectionFill)"
                fillOpacity={1}
                isAnimationActive={false}
                connectNulls={false}
                legendType="none"
              />

              <Line
                type="linear"
                dataKey="projection"
                name="projection"
                stroke="#0bd5b0"
                strokeWidth={4}
                strokeDasharray="6 4"
                connectNulls={false}
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 6, fill: "#0bd5b0", stroke: "#0f172a", strokeWidth: 2 }}
              >
                <LabelList
                  dataKey="projection"
                  position="top"
                  fill="#0bd5b0"
                  fontSize={11}
                  formatter={(value: number | string, entry: { payload?: { showProjectionLabel?: boolean } }) => {
                    if (!entry?.payload?.showProjectionLabel) return "";
                    return Number(value).toLocaleString("en-US", { maximumFractionDigits: 1 });
                  }}
                />
              </Line>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          <div className="p-3 bg-navy-muted/40 rounded-lg border border-navy-border/50">
            <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">Latest Actual</p>
            <p className="text-sm font-semibold text-white">{latestHistoricalPoint ? formatTco2e(latestHistoricalPoint.value) : "N/A"}</p>
            <p className="text-xs text-slate-400 mt-1">{latestHistoricalPoint ? formatFullMonthLabel(latestHistoricalPoint.date) : "No uploaded month"}</p>
          </div>
          <div className="p-3 bg-navy-muted/40 rounded-lg border border-navy-border/50">
            <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">Month-over-Month Status</p>
            <p className={`text-sm font-semibold ${monthOverMonthChange !== null && monthOverMonthChange < 0 ? "text-emerald-400" : monthOverMonthChange !== null && monthOverMonthChange > 0 ? "text-rose-400" : "text-slate-200"}`}>
              {carbonPathTrendLabel}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {monthOverMonthChange === null ? "Compare after next month upload" : `${monthOverMonthChange > 0 ? "+" : ""}${monthOverMonthChange}% compared with last month`}
            </p>
          </div>
          <div className="p-3 bg-navy-muted/40 rounded-lg border border-navy-border/50">
            <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">Expected Level (End Month)</p>
            <p className="text-sm font-semibold text-primary">{finalProjectionPoint ? formatTco2e(finalProjectionPoint.value) : "N/A"}</p>
            <p className="text-xs text-slate-400 mt-1">{finalProjectionPoint ? formatFullMonthLabel(finalProjectionPoint.date) : "No estimate yet"}</p>
          </div>
          <div className="p-3 bg-navy-muted/40 rounded-lg border border-navy-border/50">
            <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">Forecast Confidence</p>
            <p className="text-sm font-semibold text-white">{data.forecastQuality.confidenceScore}% ({data.forecastQuality.reliabilityLabel})</p>
            <p className="text-xs text-slate-400 mt-1">
              {data.forecastQuality.backtestMonths} backtest month(s) • MAPE {data.forecastQuality.mape !== null ? `${data.forecastQuality.mape}%` : "N/A"}
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-navy-border/60 bg-navy-muted/30 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Forecast Evidence</p>
          <p className="text-sm text-slate-200">{data.forecastQuality.method}</p>
          <p className="text-xs text-slate-400 mt-1">
            Training months: {data.forecastQuality.trainingMonths} • MAE: {data.forecastQuality.mae !== null ? `${data.forecastQuality.mae} tCO₂e` : "N/A"} • RMSE: {data.forecastQuality.rmse !== null ? `${data.forecastQuality.rmse} tCO₂e` : "N/A"} • Volatility index: {data.forecastQuality.volatility}
          </p>
          <p className="text-xs text-amber-300/90 mt-1">{data.forecastQuality.caveat}</p>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-500"></div>
              <span className="text-xs text-slate-400">Recorded Months</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <span className="text-xs text-slate-400">Expected Months</span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/detailed-log')}
            icon={<Eye className="h-4 w-4" />}
          >
            View Detailed Log
          </Button>
        </div>
      </DashboardCard>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strategy Comparison */}
        <DashboardCard
          title="Strategy Comparison"
          icon={<Zap className="size-5" />}
          headerAction={
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => router.push('/recommendations')}
              icon={<Eye className="h-4 w-4" />}
            >
              View All
            </Button>
          }
        >
          <div className="space-y-6">
            {data.strategies.map((strategy, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {index === 0 ? (
                      <Zap className="size-4 text-primary" />
                    ) : (
                      <TreePine className="size-4 text-emerald-500" />
                    )}
                    <span className="text-sm font-medium text-white">
                      {strategy.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${index === 0 ? 'text-primary' : 'text-emerald-500'}`}>
                      {strategy.certainty}%
                    </span>
                    <Badge variant={strategy.certainty >= 90 ? "success" : "warning"}>
                      {strategy.certainty >= 90 ? "Certainty" : "Survival"}
                    </Badge>
                  </div>
                </div>
                <ProgressBar 
                  value={strategy.certainty} 
                  color={index === 0 ? "primary" : "success"} 
                  size="md" 
                />
                <p className="text-xs text-slate-400 mt-2">
                  {index === 0 
                    ? "High-impact & supply-chain optimization" 
                    : "Delayed impact • 10-15y Maturity"}
                </p>
              </div>
            ))}
          </div>
        </DashboardCard>

        {/* Policy Snapshot */}
        <DashboardCard
          title="Policy Snapshot"
          icon={<FileText className="size-5" />}
          headerAction={
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => router.push('/policy-intelligence')}
              icon={<ExternalLink className="h-4 w-4" />}
            >
              View All Policies
            </Button>
          }
        >
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
              <ScoreRing
                value={data.complianceScore.total_score}
                max={100}
                label="Compliance Score"
                subLabel={`${Math.min(data.complianceDeadlines.length, 8)} shown • ${data.complianceDeadlineCount} in next 90 days`}
                color={getComplianceRingColor(data.complianceScore.total_score)}
              />
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Due Soon</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{data.complianceDueSoonCount}</p>
                  <p className="text-xs text-slate-400">Deadlines within 30 days</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Critical</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{data.complianceCriticalDeadlineCount}</p>
                  <p className="text-xs text-slate-400">Deadlines within 7 days</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Policy Alerts</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{data.policyAlerts}</p>
                  <p className="text-xs text-slate-400">Active policy reminders</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-rose-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="size-4" />
                UPCOMING DEADLINES
                <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-xs text-rose-200">
                  {Math.min(data.complianceDeadlines.length, 8)} / {data.complianceDeadlineCount}
                </span>
              </h4>
              <div className="space-y-3">
                {data.complianceDeadlines.length > 0 ? (
                  data.complianceDeadlines.map((deadline) => (
                    <div
                      key={deadline.id}
                      className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-lg cursor-pointer hover:bg-rose-500/10 transition-colors"
                      onClick={() => router.push('/compliance')}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-white">{deadline.title}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            Due {formatDeadlineDate(deadline.dueDate)} • {deadline.daysLeft} days left • {deadline.level}
                          </p>
                        </div>
                        <Badge variant={getDeadlineTone(deadline.priority)}>
                          {deadline.priority.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-400">
                    No upcoming compliance deadlines in the next 90 days.
                  </div>
                )}
                {data.complianceDeadlineCount > data.complianceDeadlines.length ? (
                  <div className="pt-1">
                    <Button size="sm" variant="outline" onClick={() => router.push('/compliance')}>
                      Show all {data.complianceDeadlineCount} deadlines
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                <ArrowUpRight className="size-4" />
                FUNDING OPPORTUNITIES
              </h4>
              <div className="space-y-2">
                {fundingOpportunities.map((fund, index) => (
                  <div
                    key={index}
                    className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between"
                  >
                    <p className="text-sm font-medium text-white">
                      {fund.title}
                    </p>
                    <span className="text-xs text-primary font-semibold">
                      {fund.amount}
                    </span>
                  </div>
                ))}
              </div>
          </div>
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}
