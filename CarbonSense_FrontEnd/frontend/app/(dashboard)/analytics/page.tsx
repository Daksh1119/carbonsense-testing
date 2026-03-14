"use client";

import DashboardCard from "@/components/DashboardCard";
import StatsCard from "@/components/StatsCard";
import Badge from "@/components/Badge";
import { Breadcrumb, BackButton } from "@/components/navigation";
import {
  BarChart3,
  TrendingDown,
  PieChart,
  Activity,
  Calendar,
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
  Legend,
} from "recharts";

const categoryData = [
  { category: "Transport", value: 420, percentage: 34 },
  { category: "Energy", value: 380, percentage: 31 },
  { category: "Food & Waste", value: 280, percentage: 22 },
  { category: "Purchases", value: 160, percentage: 13 },
];

const COLORS = ["#0bd5b0", "#3b82f6", "#f59e0b", "#ef4444"];

const monthlyTrend = [
  { month: "Aug", emissions: 1150 },
  { month: "Sep", emissions: 1280 },
  { month: "Oct", emissions: 1190 },
  { month: "Nov", emissions: 1320 },
  { month: "Dec", emissions: 1240 },
  { month: "Jan", emissions: 1180 },
];

const scopeData = [
  { name: "Scope 1", value: 450 },
  { name: "Scope 2", value: 380 },
  { name: "Scope 3", value: 410 },
];

export default function AnalyticsPage() {
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
        <BackButton href="/dashboard" label="Back to Dashboard" variant="outline" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard
          title="Total Emissions (YTD)"
          value="1,240"
          unit="tCO₂e"
          change="-5.2% vs last year"
          changeType="positive"
          icon={<Activity className="size-6" />}
        />
        <StatsCard
          title="Monthly Average"
          value="206"
          unit="tCO₂e"
          change="+2.1% this month"
          changeType="negative"
          icon={<Calendar className="size-6" />}
        />
        <StatsCard
          title="Highest Category"
          value="Transport"
          unit="34% of total"
          icon={<PieChart className="size-6" />}
        />
        <StatsCard
          title="Reduction Target"
          value="12.5%"
          unit="achieved"
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
                  label={({ name, percentage }) => `${name} ${percentage}%`}
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
                    {scope.value} tCO₂e
                  </span>
                  <Badge variant="info">
                    {Math.round((scope.value / 1240) * 100)}%
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
        subtitle="Historical monthly emissions data"
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
            <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#16252d",
                border: "1px solid #1e3a3a",
                borderRadius: "0.5rem",
                color: "#fff",
              }}
            />
            <Line
              type="monotone"
              dataKey="emissions"
              stroke="#0bd5b0"
              strokeWidth={3}
              dot={{ fill: "#0bd5b0", r: 6 }}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="p-4 bg-navy-muted/50 rounded-lg text-center">
            <p className="text-xs text-slate-400 mb-1">Highest Month</p>
            <p className="text-lg font-bold text-rose-400">Nov - 1,320</p>
          </div>
          <div className="p-4 bg-navy-muted/50 rounded-lg text-center">
            <p className="text-xs text-slate-400 mb-1">Lowest Month</p>
            <p className="text-lg font-bold text-emerald-400">Aug - 1,150</p>
          </div>
          <div className="p-4 bg-navy-muted/50 rounded-lg text-center">
            <p className="text-xs text-slate-400 mb-1">Average</p>
            <p className="text-lg font-bold text-white">1,227 tCO₂e</p>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}
