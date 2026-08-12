"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { showSuccessToast } from "@/lib/toast";
import { energyFactors, getFactorOption } from "@/lib/emissions-factors";
import { ENERGY_CONFIGS } from "@/lib/emissions-factors";
import { useEmissionsDraftStore } from "@/store";
import {
  Zap,
  ArrowRight,
  Leaf,
  TrendingUp,
} from "lucide-react";

export default function EnergyPage() {
  const router = useRouter();
  const { setEntry, entries } = useEmissionsDraftStore();

  const defaultCategory = entries.energy?.activityType
    ? ENERGY_CONFIGS.find((cfg) => cfg.label === entries.energy?.activityType)?.value || ENERGY_CONFIGS[0].value
    : ENERGY_CONFIGS[0].value;

  const [energyCategory, setEnergyCategory] = useState(defaultCategory);

  const currentConfig = ENERGY_CONFIGS.find((cfg) => cfg.value === energyCategory) || ENERGY_CONFIGS[0];

  const defaultSubValue = entries.energy?.meta?.source || currentConfig.subOptions[0].value;
  const initialSubOption = currentConfig.subOptions.find((opt) => opt.value === defaultSubValue || opt.label === defaultSubValue)?.value || currentConfig.subOptions[0].value;

  const [subOptionValue, setSubOptionValue] = useState(initialSubOption);
  const [consumption, setConsumption] = useState(entries.energy?.amount?.toString() || "");
  const [date, setDate] = useState(entries.energy?.date || "");

  const handleCategoryChange = (newCategoryValue: string) => {
    setEnergyCategory(newCategoryValue);
    const newConfig = ENERGY_CONFIGS.find((cfg) => cfg.value === newCategoryValue) || ENERGY_CONFIGS[0];
    setSubOptionValue(newConfig.subOptions[0].value);
  };

  const selectedSubOption = currentConfig.subOptions.find((opt) => opt.value === subOptionValue) || currentConfig.subOptions[0];
  const consumptionValue = Number(consumption || 0);

  const estimatedImpact = consumptionValue > 0
    ? (consumptionValue * selectedSubOption.factorKgPerUnit).toFixed(2)
    : "0.00";
  const trend = "-2.8%";

  const handleNext = () => {
    if (consumption && date) {
      setEntry("energy", {
        category: "energy",
        activityType: currentConfig.label,
        detail: `${consumptionValue.toLocaleString()} ${currentConfig.unit} • ${selectedSubOption.label}`,
        amount: consumptionValue,
        unit: currentConfig.unit,
        date,
        estimatedCo2Kg: Number(estimatedImpact),
        meta: {
          source: selectedSubOption.label,
          subOptionValue: selectedSubOption.value,
          activity_key: currentConfig.value,
        },
      });

      showSuccessToast("Energy data saved!");
    }

    router.push("/emissions/waste");
  };

  const handlePrevious = () => {
    router.push("/emissions/transport");
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Breadcrumb />
        <div className="flex items-center justify-between mt-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Energy Activity
            </h1>
            <p className="text-slate-400">Step 2 of 4 - Electricity consumption and facility operations</p>
          </div>
          <BackButton href="/emissions" label="Cancel" variant="ghost" />
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-primary rounded-full" />
          <div className="flex-1 h-2 bg-primary rounded-full" />
          <div className="flex-1 h-2 bg-navy-border rounded-full" />
          <div className="flex-1 h-2 bg-navy-border rounded-full" />
        </div>
        <p className="text-sm text-primary font-medium mt-2 text-center">50% Complete</p>
      </div>

      {/* Main Form */}
      <DashboardCard
        title="Energy Details"
        subtitle="Electricity consumption and renewable energy usage"
        icon={<Zap className="size-5" />}
      >
        <div className="space-y-6">
          <p className="text-xs text-slate-500">
            Optional fields — add what you have now, or skip and return later.
          </p>
          {/* Energy Type & Dependent Sub-Option */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Energy Type
              </label>
              <select
                value={energyCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {ENERGY_CONFIGS.map((cfg) => (
                  <option key={cfg.value} value={cfg.value}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {currentConfig.subCategoryLabel}
              </label>
              <select
                value={subOptionValue}
                onChange={(e) => setSubOptionValue(e.target.value)}
                className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {currentConfig.subOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Consumption & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Consumption
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={consumption}
                  onChange={(e) => setConsumption(e.target.value)}
                  className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="0.00"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium uppercase">
                  {currentConfig.unit}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Billing Period
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
                  <TrendingUp className="size-4 text-emerald-400 rotate-180" />
                  <span className="text-sm font-semibold text-emerald-400">
                    {trend}
                  </span>
                </div>
                <div className="flex gap-1 mt-2">
                  {[5, 4, 3, 2, 1].map((i) => (
                    <div
                      key={i}
                      className="w-2 bg-emerald-400 rounded-full"
                      style={{ height: `${i * 8}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              System auto-detect active • Based on UK National Grid factors
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
          Previous: Transport
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
            Next: Waste
          </Button>
        </div>
      </div>
    </div>
  );
}
