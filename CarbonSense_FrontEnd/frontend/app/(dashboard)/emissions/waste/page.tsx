"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { showSuccessToast } from "@/lib/toast";
import { wasteFactors, getFactorOption } from "@/lib/emissions-factors";
import { useEmissionsDraftStore } from "@/store";
import {
  Trash2,
  ArrowRight,
  Leaf,
  TrendingUp,
} from "lucide-react";

export default function WastePage() {
  const router = useRouter();
  const { setEntry, entries } = useEmissionsDraftStore();

  const defaultOption = entries.waste?.activityType
    ? wasteFactors.find((option) => option.label === entries.waste?.activityType)?.value || wasteFactors[0].value
    : wasteFactors[0].value;

  const [wasteType, setWasteType] = useState(defaultOption);
  const [disposalMethod, setDisposalMethod] = useState(entries.waste?.meta?.disposalMethod || "Landfill");
  const [weight, setWeight] = useState(entries.waste?.amount?.toString() || "");
  const [date, setDate] = useState(entries.waste?.date || "");

  const option = getFactorOption(wasteFactors, wasteType);
  const weightValue = Number(weight || 0);

  const estimatedImpact = weightValue > 0
    ? (weightValue * option.factorKgPerUnit).toFixed(2)
    : "0.00";
  const trend = "+1.5%";

  const handleNext = () => {
    if (weight && date) {
      setEntry("waste", {
        category: "waste",
        activityType: option.label,
        detail: `${weightValue.toLocaleString()} ${option.unit} • ${disposalMethod}`,
        amount: weightValue,
        unit: option.unit,
        date,
        estimatedCo2Kg: Number(estimatedImpact),
        meta: {
          disposalMethod,
          activity_key: option.value,
        },
      });

      showSuccessToast("Waste data saved!");
    }

    router.push("/emissions/purchases");
  };

  const handlePrevious = () => {
    router.push("/emissions/energy");
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Breadcrumb />
        <div className="flex items-center justify-between mt-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Waste Activity
            </h1>
            <p className="text-slate-400">Step 3 of 4 - Waste disposal and material management</p>
          </div>
          <BackButton href="/emissions" label="Cancel" variant="ghost" />
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-primary rounded-full" />
          <div className="flex-1 h-2 bg-primary rounded-full" />
          <div className="flex-1 h-2 bg-primary rounded-full" />
          <div className="flex-1 h-2 bg-navy-border rounded-full" />
        </div>
        <p className="text-sm text-primary font-medium mt-2 text-center">75% Complete</p>
      </div>

      {/* Main Form */}
      <DashboardCard
        title="Waste Details"
        subtitle="Waste disposal, recycling, and material management"
        icon={<Trash2 className="size-5" />}
      >
        <div className="space-y-6">
          <p className="text-xs text-slate-500">
            Optional fields — add what you have now, or skip and return later.
          </p>
          {/* Waste Type & Disposal Method */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Waste Type
              </label>
              <select
                value={wasteType}
                onChange={(e) => setWasteType(e.target.value)}
                className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {wasteFactors.map((factor) => (
                  <option key={factor.value} value={factor.value}>
                    {factor.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Disposal Method
              </label>
              <select
                value={disposalMethod}
                onChange={(e) => setDisposalMethod(e.target.value)}
                className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option>Landfill</option>
                <option>Recycling</option>
                <option>Composting</option>
                <option>Incineration</option>
                <option>Anaerobic Digestion</option>
              </select>
            </div>
          </div>

          {/* Weight & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Weight
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="0.00"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                  {option.unit}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Disposal Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Estimated Impact */}
          <div className="bg-navy-deep border border-primary/20 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                  Estimated Carbon Impact
                </p>
                <div className="flex items-baseline gap-2">
                  <Leaf className="size-5 text-primary" />
                  <span className="text-4xl font-bold text-primary">
                    {estimatedImpact}
                  </span>
                  <span className="text-lg text-slate-400">KG CO2E</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 mb-1">TREND (YR AVG)</p>
                <div className="flex items-center gap-1">
                  <TrendingUp className="size-4 text-amber-400" />
                  <span className="text-sm font-semibold text-amber-400">
                    {trend}
                  </span>
                </div>
                <div className="flex gap-1 mt-2">
                  {[1, 3, 2, 4, 3].map((i, idx) => (
                    <div
                      key={idx}
                      className="w-2 bg-amber-400 rounded-full"
                      style={{ height: `${i * 8}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              System auto-detect active • Based on IPCC waste factors
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-xs text-blue-300">
              💡 <strong>Tip:</strong> Recycling reduces emissions by up to 70% compared to landfill. 
              Consider composting organic waste to further reduce your carbon footprint.
            </p>
          </div>
        </div>
      </DashboardCard>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="ghost"
          onClick={handlePrevious}
        >
          Previous: Energy
        </Button>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => router.push("/emissions/review")}
          >
            Review Now
          </Button>
          <Button
            variant="primary"
            icon={<ArrowRight className="size-4" />}
            onClick={handleNext}
          >
            Next: Purchases
          </Button>
        </div>
      </div>
    </div>
  );
}
