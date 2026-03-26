"use client";

import { useDashboardData } from "@/hooks";
import StatsCard from "@/components/StatsCard";
import DashboardCard from "@/components/DashboardCard";
import Badge from "@/components/Badge";
import ProgressBar from "@/components/ProgressBar";
import { CardSkeleton, ChartSkeleton, ErrorState } from "@/components/ui";
import Button from "@/components/Button";
import InteractiveChart from "@/components/ui/InteractiveChart";
import { Breadcrumb } from "@/components/navigation";
import { useRouter } from "next/navigation";
import {
  Wind,
  TrendingDown,
  Clock,
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

const policyAlerts = [
  {
    title: "EU CSRD Compliance",
    deadline: "Due in 15 days",
    status: "urgent",
  },
  {
    title: "Scope 3 Audit Report",
    deadline: "Due in 65 days",
    status: "warning",
  },
];

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

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboardData();
  const router = useRouter();

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

  // Transform data for chart
  const emissionsData = [
    ...data.carbonPath.historical.map((item) => ({
      month: new Date(item.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).toUpperCase(),
      name: new Date(item.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).toUpperCase(),
      value: item.value,
      historical: item.value,
      projection: item.value,
    })),
    ...data.carbonPath.projected.map((item) => ({
      month: new Date(item.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).toUpperCase(),
      name: new Date(item.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).toUpperCase(),
      value: item.value,
      historical: 0,
      projection: item.value,
    })),
  ];

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
          value={data.totalEmissions.toLocaleString()}
          unit="tCO₂e"
          change={`Latest update: ${data.latestPeriodLabel}`}
          changeType="neutral"
          icon={<Wind className="size-6" />}
        />
        <StatsCard
          title="Reduction Achieved"
          value={`${data.reductionAchieved}%`}
          change="vs last upload"
          changeType={data.reductionAchieved >= 0 ? "positive" : "negative"}
          icon={<TrendingDown className="size-6" />}
        />
        <StatsCard
          title="Time-Debt Status"
          value={data.timeDebtStatus}
          unit="Offset Maturity Window"
          change={`Updated: ${data.latestPeriodLabel}`}
          changeType="neutral"
          icon={<Clock className="size-6" />}
        />
        <StatsCard
          title="Policy Alerts"
          value={data.policyAlerts.toString()}
          unit="Active"
          change={`Updated: ${data.latestPeriodLabel}`}
          changeType="neutral"
          icon={<AlertTriangle className="size-6" />}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => router.push('/data-ingestion')}
          className="group relative bg-background-dark border border-navy-border rounded-xl p-6 hover:border-primary/50 transition-all duration-300 text-left"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg p-3">
              <Upload className="size-5" />
            </div>
            <ArrowUpRight className="size-4 text-slate-500 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
          </div>
          <h3 className="text-base font-bold text-white mb-1 group-hover:text-primary transition-colors">
            Data Ingestion
          </h3>
          <p className="text-sm text-slate-400">
            Upload CSV, receipts, or bank statements
          </p>
        </button>

        <button
          onClick={() => router.push('/detailed-log')}
          className="group relative bg-background-dark border border-navy-border rounded-xl p-6 hover:border-primary/50 transition-all duration-300 text-left"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg p-3">
              <FileText className="size-5" />
            </div>
            <ArrowUpRight className="size-4 text-slate-500 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
          </div>
          <h3 className="text-base font-bold text-white mb-1 group-hover:text-primary transition-colors">
            Detailed Log
          </h3>
          <p className="text-sm text-slate-400">
            View all emission entries with filters
          </p>
        </button>
      </div>

      {/* Main Chart */}
      <DashboardCard
        title="Carbon Path 2024-2026"
        subtitle="Historical sensor data vs. AI-driven 2026 Projection"
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
        <InteractiveChart
          data={emissionsData}
          type="area"
          dataKey="projection"
          xAxisKey="month"
          color="#0bd5b0"
          height={300}
          showGrid={true}
          showLegend={true}
          animate={true}
        />
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-500"></div>
              <span className="text-xs text-slate-400">Historical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <span className="text-xs text-slate-400">2026 Projection</span>
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
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-rose-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="size-4" />
                IMMEDIATE DEADLINES
              </h4>
              <div className="space-y-3">
                {policyAlerts.map((alert, index) => (
                  <div
                    key={index}
                    className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-lg cursor-pointer hover:bg-rose-500/10 transition-colors"
                    onClick={() => router.push('/policy-intelligence')}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {alert.title}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {alert.deadline}
                        </p>
                      </div>
                      <Badge
                        variant={
                          alert.status === "urgent" ? "danger" : "warning"
                        }
                      >
                        {alert.status === "urgent" ? "URGENT" : "WARNING"}
                      </Badge>
                    </div>
                  </div>
                ))}
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
