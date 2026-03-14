"use client";

import DashboardCard from "@/components/DashboardCard";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import {
  Sparkles,
  Zap,
  TrendingDown,
  Users,
  Factory,
  Leaf,
  ArrowRight,
  Target,
} from "lucide-react";

const recommendations = [
  {
    title: "Switch to Renewable Energy Grid",
    impact: "High",
    certainty: 98,
    timeToImpact: "Immediate",
    cost: "₹2.5M–₹4.2M",
    savings: "380 tCO₂e/year",
    category: "Energy",
    icon: Zap,
    priority: 1,
    description:
      "Transition 60% of facility power to solar + wind hybrid system. ROI: 3.2 years.",
    steps: [
      "Conduct energy audit",
      "Select renewable provider",
      "Install infrastructure",
      "Monitor performance",
    ],
  },
  {
    title: "Optimize Supply Chain Logistics",
    impact: "High",
    certainty: 95,
    timeToImpact: "3–6 months",
    cost: "₹800K–₹1.5M",
    savings: "285 tCO₂e/year",
    category: "Transport",
    icon: Factory,
    priority: 2,
    description:
      "Route optimization + EV fleet transition for last-mile delivery.",
    steps: [
      "Analyze current routes",
      "Implement AI routing",
      "Pilot EV vehicles",
      "Scale fleet transition",
    ],
  },
  {
    title: "Employee Behavioral Program",
    impact: "Medium",
    certainty: 75,
    timeToImpact: "6–12 months",
    cost: "₹200K–₹400K",
    savings: "120 tCO₂e/year",
    category: "Behavioral",
    icon: Users,
    priority: 3,
    description:
      "Gamified carbon awareness program + remote work policy expansion.",
    steps: [
      "Launch awareness campaign",
      "Implement tracking app",
      "Introduce incentives",
      "Measure impact",
    ],
  },
  {
    title: "Tree Planting Initiative (Neem + Bamboo)",
    impact: "Medium",
    certainty: 70,
    timeToImpact: "10–15 years",
    cost: "₹450K–₹680K",
    savings: "Delayed offset potential",
    category: "Offset",
    icon: Leaf,
    priority: 4,
    description:
      "Plant 2,000 trees with survival-weighted modeling. Secondary to reduction.",
    steps: [
      "Select planting sites",
      "Procure saplings",
      "Conduct plantation drive",
      "Monitor growth annually",
    ],
  },
];

export default function RecommendationsPage() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Personalized Recommendations
          </h1>
          <p className="text-slate-400">
            AI-powered action plan ranked by impact, certainty, and time to results
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
          <p className="text-3xl font-bold text-primary">785 tCO₂e</p>
          <p className="text-xs text-slate-500 mt-1">per year</p>
        </div>
        <div className="glass-card p-5 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="size-5 text-amber-400" />
            <p className="text-sm text-slate-400">High Impact Actions</p>
          </div>
          <p className="text-3xl font-bold text-white">2</p>
          <p className="text-xs text-slate-500 mt-1">immediate priority</p>
        </div>
        <div className="glass-card p-5 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="size-5 text-emerald-400" />
            <p className="text-sm text-slate-400">Avg Certainty</p>
          </div>
          <p className="text-3xl font-bold text-white">84.5%</p>
          <p className="text-xs text-slate-500 mt-1">confidence level</p>
        </div>
        <div className="glass-card p-5 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="size-5 text-blue-400" />
            <p className="text-sm text-slate-400">AI Recommendations</p>
          </div>
          <p className="text-3xl font-bold text-white">4</p>
          <p className="text-xs text-slate-500 mt-1">personalized actions</p>
        </div>
      </div>

      {/* Recommendations Grid */}
      <div className="space-y-4">
        {recommendations.map((rec, index) => {
          const Icon = rec.icon;
          return (
            <DashboardCard
              key={index}
              title={`${rec.priority}. ${rec.title}`}
              subtitle={rec.description}
              icon={<Icon className="size-5" />}
              className={`${
                rec.priority <= 2
                  ? "border-primary/30 bg-primary/5"
                  : ""
              }`}
              headerAction={
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      rec.impact === "High"
                        ? "success"
                        : rec.impact === "Medium"
                        ? "warning"
                        : "default"
                    }
                  >
                    {rec.impact} Impact
                  </Badge>
                  <Badge variant="info">{rec.certainty}% Certainty</Badge>
                </div>
              }
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Metrics */}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">
                      Potential Savings
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {rec.savings}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">
                      Time to Impact
                    </p>
                    <p className="text-lg font-semibold text-white">
                      {rec.timeToImpact}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">
                      Estimated Cost
                    </p>
                    <p className="text-lg font-semibold text-white">
                      {rec.cost}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Category</p>
                    <Badge variant="default">{rec.category}</Badge>
                  </div>
                </div>

                {/* Middle: Implementation Steps */}
                <div className="lg:col-span-2">
                  <h4 className="text-sm font-semibold text-white mb-3">
                    Implementation Steps:
                  </h4>
                  <div className="space-y-2 mb-4">
                    {rec.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 bg-navy-muted/50 rounded-lg"
                      >
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
                    >
                      Begin Implementation
                    </Button>
                    <Button variant="ghost">View Detailed Plan</Button>
                  </div>
                </div>
              </div>
            </DashboardCard>
          );
        })}
      </div>

      {/* Priority Notice */}
      <div className="bg-gradient-to-r from-primary/20 to-emerald-500/20 border-2 border-primary/30 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <Sparkles className="size-8 text-primary flex-shrink-0" />
          <div>
            <h3 className="text-lg font-bold text-white mb-2">
              AI Recommendation Priority
            </h3>
            <p className="text-slate-300 text-sm mb-3">
              Our multi-agent AI system recommends prioritizing{" "}
              <strong className="text-primary">
                renewable energy transition
              </strong>{" "}
              and <strong className="text-primary">supply chain optimization</strong>{" "}
              for maximum immediate impact. Tree planting should complement, not
              replace, reduction strategies.
            </p>
            <div className="flex gap-3">
              <Button variant="primary" size="sm">
                Generate Custom Roadmap
              </Button>
              <Button variant="ghost" size="sm">
                Learn About Our AI
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
