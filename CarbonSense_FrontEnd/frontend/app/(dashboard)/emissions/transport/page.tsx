"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { showSuccessToast } from "@/lib/toast";
import { transportFactors, getFactorOption } from "@/lib/emissions-factors";
import { useEmissionsDraftStore } from "@/store";
import {
  Truck,
  ArrowRight,
  Leaf,
  TrendingUp,
} from "lucide-react";

export default function TransportPage() {
  const router = useRouter();
  const { setEntry, entries } = useEmissionsDraftStore();

  const defaultOption = entries.transport?.activityType
    ? transportFactors.find((option) => option.label === entries.transport?.activityType)?.value || transportFactors[0].value
    : transportFactors[0].value;

  const [activityType, setActivityType] = useState(defaultOption);
  const [fuelType, setFuelType] = useState(entries.transport?.meta?.fuelType || "Diesel (Avg Biofuel Blend)");
  const [distance, setDistance] = useState(entries.transport?.amount?.toString() || "");
  const [date, setDate] = useState(entries.transport?.date || "");

  const option = getFactorOption(transportFactors, activityType);
  const distanceValue = Number(distance || 0);

  const estimatedImpact = distanceValue > 0
    ? (distanceValue * option.factorKgPerUnit).toFixed(2)
    : "0.00";
  const trend = "+4.2%";

  const handleNext = () => {
    if (distance && date) {
      setEntry("transport", {
        category: "transport",
        activityType: option.label,
        detail: `${distanceValue.toLocaleString()} ${option.unit} • ${fuelType}`,
        amount: distanceValue,
        unit: option.unit,
        date,
        estimatedCo2Kg: Number(estimatedImpact),
        meta: {
          fuelType,
          activity_key: option.value,
        },
      });

      showSuccessToast("Transport data saved!");
    }

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
              Transport Activity
            </h1>
            <p className="text-slate-400">Step 1 of 4 - Specify travel metrics</p>
          </div>
          <BackButton href="/emissions" label="Cancel" variant="ghost" />
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-primary rounded-full" />
          <div className="flex-1 h-2 bg-navy-border rounded-full" />
          <div className="flex-1 h-2 bg-navy-border rounded-full" />
          <div className="flex-1 h-2 bg-navy-border rounded-full" />
        </div>
        <p className="text-sm text-primary font-medium mt-2 text-center">25% Complete</p>
      </div>

      {/* Main Form */}
      <DashboardCard
        title="Transport Details"
        subtitle="Vehicle travel, fleet operations, and logistics"
        icon={<Truck className="size-5" />}
      >
        <div className="space-y-6">
          <p className="text-xs text-slate-500">
            Optional fields — add what you have now, or skip and return later.
          </p>
          {/* Activity Type & Fuel Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Activity Type
              </label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {transportFactors.map((factor) => (
                  <option key={factor.value} value={factor.value}>
                    {factor.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Fuel Type
              </label>
              <select
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value)}
                className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option>Diesel (Avg Biofuel Blend)</option>
                <option>Petrol</option>
                <option>Electric</option>
                <option>Hybrid</option>
                <option>CNG</option>
                <option>LPG</option>
              </select>
            </div>
          </div>

          {/* Distance & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Distance / Quantity
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
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
                Date of Activity
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
                  <TrendingUp className="size-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-400">
                    {trend}
                  </span>
                </div>
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="w-2 bg-primary rounded-full"
                      style={{ height: `${i * 8}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              System auto-detect active • Based on UK DEFRA 2024 factors
            </p>
          </div>
        </div>
      </DashboardCard>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/emissions")}
        >
          Back to Categories
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
            Next: Energy
          </Button>
        </div>
      </div>
    </div>
  );
}
