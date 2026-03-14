"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import {
  Zap,
  ArrowRight,
  Leaf,
  TrendingUp,
} from "lucide-react";

export default function EnergyPage() {
  const router = useRouter();

  const [energyType, setEnergyType] = useState("Grid Electricity");
  const [source, setSource] = useState("Mixed Grid Supply");
  const [consumption, setConsumption] = useState("");
  const [date, setDate] = useState("");

  const estimatedImpact = consumption ? (parseFloat(consumption) * 0.233).toFixed(2) : "0.00";
  const trend = "-2.8%";

  const handleNext = () => {
    if (!consumption || !date) {
      showErrorToast("Please fill in all required fields");
      return;
    }

    showSuccessToast("Energy data saved!");
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
          {/* Energy Type & Source */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Energy Type <span className="text-red-400">*</span>
              </label>
              <select
                value={energyType}
                onChange={(e) => setEnergyType(e.target.value)}
                className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option>Grid Electricity</option>
                <option>Renewable Energy</option>
                <option>Natural Gas</option>
                <option>Heating Oil</option>
                <option>District Heating</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Source <span className="text-red-400">*</span>
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option>Mixed Grid Supply</option>
                <option>Solar Power</option>
                <option>Wind Power</option>
                <option>Hydro Power</option>
                <option>Green Energy Contract</option>
              </select>
            </div>
          </div>

          {/* Consumption & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Consumption <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={consumption}
                  onChange={(e) => setConsumption(e.target.value)}
                  className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="0.00"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                  kWh
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Billing Period <span className="text-red-400">*</span>
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
        <Button
          variant="primary"
          icon={<ArrowRight className="size-4" />}
          onClick={handleNext}
        >
          Next: Waste
        </Button>
      </div>
    </div>
  );
}
