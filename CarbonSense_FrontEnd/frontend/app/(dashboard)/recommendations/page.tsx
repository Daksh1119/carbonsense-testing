"use client";

import { useRouter } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { useRecommendations } from "@/hooks";
import { showInfoToast, showSuccessToast } from "@/lib/toast";
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

export default function RecommendationsPage() {
  const router = useRouter();
  const { recommendations: liveRecommendations, isLoading, error, llmUsed, llmWarning, refetch } = useRecommendations();

  const recommendations = liveRecommendations.map((rec, idx) => ({
        title: rec.title,
        impact: rec.impact >= 150 ? "High" : rec.impact >= 70 ? "Medium" : "Low",
        certainty: rec.certainty,
        timeToImpact: rec.timeToImpact,
        cost: rec.cost > 0
          ? new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
              notation: "compact",
              maximumFractionDigits: 1,
            }).format(rec.cost)
          : "TBD",
        savings: `${Math.round(rec.impact)} kgCO₂e`,
        category: rec.category,
        icon: rec.type === "offset" ? Leaf : rec.category.toLowerCase().includes("energy") ? Zap : rec.category.toLowerCase().includes("transport") ? Factory : Users,
        priority: idx + 1,
        description: rec.description,
        steps: rec.steps,
      }));

  const totalPotential = recommendations
    .map((r) => r.savings)
    .map((s) => Number((String(s).match(/[\d.]+/) || ["0"])[0]))
    .reduce((a, b) => a + b, 0);
  const highImpactCount = recommendations.filter((r) => r.impact === "High").length;
  const avgCertainty =
    recommendations.length > 0
      ? recommendations.reduce((sum, r) => sum + Number(r.certainty || 0), 0) / recommendations.length
      : 0;

  const topTwoTitles = recommendations.slice(0, 2).map((r) => r.title);

  const handleGenerateRoadmap = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 48;
    const marginTop = 56;
    const marginBottom = 52;
    const contentWidth = pageWidth - marginX * 2;
    const lineColor: [number, number, number] = [210, 219, 230];
    const accentColor: [number, number, number] = [11, 213, 176];
    const mutedText: [number, number, number] = [90, 101, 117];

    const generatedOn = new Date().toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    let y = marginTop;

    const ensureSpace = (requiredHeight: number) => {
      if (y + requiredHeight > pageHeight - marginBottom) {
        doc.addPage();
        y = marginTop;
      }
    };

    const drawLabelValue = (label: string, value: string) => {
      const safeValue = value.replace(/\u20b9/g, "INR ");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(45, 55, 72);
      doc.text(label, marginX, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(31, 41, 55);
      doc.text(safeValue, marginX + 110, y);
      y += 15;
    };

    doc.setDrawColor(...lineColor);
    doc.setFillColor(244, 251, 248);
    doc.roundedRect(marginX, y - 24, contentWidth, 64, 8, 8, "F");

    doc.setTextColor(18, 35, 44);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("CarbonSense Custom Roadmap", marginX + 14, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...mutedText);
    doc.text("Personalized decarbonization action plan", marginX + 14, y + 20);
    y += 58;

    doc.setDrawColor(...lineColor);
    doc.roundedRect(marginX, y, contentWidth, 72, 8, 8, "S");
    y += 20;
    drawLabelValue("Generated On", generatedOn);
    drawLabelValue("Recommendations", String(recommendations.length));
    drawLabelValue("Model Mode", llmUsed ? "LLM Live" : "Fallback");
    y += 12;

    ensureSpace(92);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(18, 35, 44);
    doc.setFontSize(13);
    doc.text("Executive Summary", marginX, y);
    y += 14;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(marginX, y, contentWidth, 58, 8, 8, "F");
    y += 20;
    drawLabelValue("Annual Savings Potential", `${Math.round(totalPotential)} kgCO2e`);
    drawLabelValue("High Impact Actions", `${highImpactCount}`);
    drawLabelValue("Average Confidence", `${Math.round(avgCertainty)}%`);
    y += 10;

    recommendations.forEach((rec, idx) => {
      const safeCost = String(rec.cost).replace(/\u20b9/g, "INR ");
      const titleLines = doc.splitTextToSize(`${idx + 1}. ${rec.title}`, contentWidth - 24) as string[];
      const descriptionLines = doc.splitTextToSize(rec.description, contentWidth - 24) as string[];

      let blockHeight = 28;
      blockHeight += titleLines.length * 14;
      blockHeight += 6 * 15;
      blockHeight += 22;
      blockHeight += descriptionLines.length * 13;
      blockHeight += 20;

      rec.steps.forEach((step) => {
        const stepLines = doc.splitTextToSize(step, contentWidth - 44) as string[];
        blockHeight += stepLines.length * 13;
      });
      blockHeight += 16;

      ensureSpace(blockHeight);

      doc.setDrawColor(...lineColor);
      doc.roundedRect(marginX, y, contentWidth, blockHeight, 8, 8, "S");
      y += 20;

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...accentColor);
      doc.setFontSize(13);
      titleLines.forEach((line) => {
        doc.text(line, marginX + 12, y);
        y += 14;
      });
      y += 4;

      drawLabelValue("Impact", rec.impact);
      drawLabelValue("Certainty", `${rec.certainty}%`);
      drawLabelValue("Time To Impact", rec.timeToImpact);
      drawLabelValue("Estimated Cost", safeCost);
      drawLabelValue("Category", rec.category);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(45, 55, 72);
      doc.text("Description", marginX + 12, y);
      y += 13;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(31, 41, 55);
      descriptionLines.forEach((line) => {
        doc.text(line, marginX + 12, y);
        y += 13;
      });

      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(45, 55, 72);
      doc.text("Implementation Steps", marginX + 12, y);
      y += 13;

      doc.setFont("helvetica", "normal");
      rec.steps.forEach((step, stepIdx) => {
        const stepLines = doc.splitTextToSize(`${stepIdx + 1}. ${step}`, contentWidth - 36) as string[];
        stepLines.forEach((line) => {
          doc.text(line, marginX + 20, y);
          y += 13;
        });
      });

      y += 14;
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i += 1) {
      doc.setPage(i);
      doc.setDrawColor(...lineColor);
      doc.line(marginX, pageHeight - 30, pageWidth - marginX, pageHeight - 30);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...mutedText);
      doc.text(`CarbonSense Roadmap | Page ${i} of ${totalPages}`, marginX, pageHeight - 16);
    }

    doc.save(`carbonsense-roadmap-${new Date().toISOString().slice(0, 10)}.pdf`);
    showSuccessToast("Custom roadmap downloaded");
  };

  const handleLearnAboutAI = () => {
    showInfoToast("Opening AI policy intelligence...");
    router.push("/policy-intelligence");
  };

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
            <TrendingDown className="size-5 text-emerald-400" />
            <p className="text-sm text-slate-400">Avg Certainty</p>
          </div>
          <p className="text-3xl font-bold text-white">{avgCertainty.toFixed(1)}%</p>
          <p className="text-xs text-slate-500 mt-1">confidence level</p>
        </div>
        <div className="glass-card p-5 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-blue-400" />
              <p className="text-sm text-slate-400">AI Recommendations</p>
            </div>
            <Badge
              size="sm"
              variant={
                isLoading || llmUsed === null
                  ? "default"
                  : llmUsed
                  ? "success"
                  : "warning"
              }
            >
              {isLoading || llmUsed === null
                ? "Checking"
                : llmUsed
                ? "LLM Live"
                : "Fallback"}
            </Badge>
          </div>
          <p className="text-3xl font-bold text-white">{recommendations.length}</p>
          <p className="text-xs text-slate-500 mt-1">personalized actions</p>
        </div>
      </div>

      {error && (
        <div className="border border-rose-500/40 bg-rose-500/10 rounded-xl p-4 text-sm text-rose-200">
          {error}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={refetch}>Retry Recommendations</Button>
          </div>
        </div>
      )}

      {!error && !isLoading && llmUsed === false && (
        <div className="border border-amber-500/40 bg-amber-500/10 rounded-xl p-4 text-sm text-amber-100">
          AI model is not configured right now, so fallback recommendation logic was used.
          {llmWarning ? ` (${llmWarning})` : ""}
        </div>
      )}

      {isLoading && (
        <div className="border border-primary/30 bg-primary/10 rounded-xl p-4 text-sm text-primary">
          Generating AI-powered recommendations from your latest emissions data. Please wait...
        </div>
      )}

      {!isLoading && !error && recommendations.length === 0 && (
        <div className="border border-slate-700 bg-navy-muted/40 rounded-xl p-4 text-sm text-slate-300">
          No AI recommendations are available yet. Upload data and retry generation.
        </div>
      )}

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
                {topTwoTitles[0] || "renewable energy transition"}
              </strong>{" "}
              and <strong className="text-primary">{topTwoTitles[1] || "supply chain optimization"}</strong>{" "}
              for maximum immediate impact. Tree planting should complement, not
              replace, reduction strategies.
            </p>
            <div className="flex gap-3">
              <Button variant="primary" size="sm" onClick={handleGenerateRoadmap}>
                Generate Custom Roadmap
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLearnAboutAI}>
                Learn About Our AI
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
