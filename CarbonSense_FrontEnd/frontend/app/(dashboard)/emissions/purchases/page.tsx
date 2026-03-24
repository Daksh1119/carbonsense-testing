"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { showSuccessToast } from "@/lib/toast";
import { purchasesFactors, getFactorOption } from "@/lib/emissions-factors";
import { useEmissionsDraftStore } from "@/store";
import { ShoppingCart, ArrowRight, Leaf, TrendingUp } from "lucide-react";

export default function PurchasesPage() {
  const router = useRouter();
  const { setEntry, entries } = useEmissionsDraftStore();

  const defaultOption = entries.purchases?.activityType || purchasesFactors[0].value;
  const [purchaseType, setPurchaseType] = useState(defaultOption);
  const [vendor, setVendor] = useState(entries.purchases?.meta?.vendor || "");
  const [spend, setSpend] = useState(entries.purchases?.amount?.toString() || "");
  const [date, setDate] = useState(entries.purchases?.date || "");

  const option = getFactorOption(purchasesFactors, purchaseType);
  const amountValue = Number(spend || 0);
  const estimatedImpact = amountValue > 0
    ? (amountValue * option.factorKgPerUnit).toFixed(2)
    : "0.00";
  const trend = "-1.9%";

  const handleNext = () => {
    if (spend && date) {
      setEntry("purchases", {
        category: "purchases",
        activityType: option.label,
        detail: `${amountValue.toLocaleString()} ${option.unit} • ${vendor || "Vendor"}`,
        amount: amountValue,
        unit: option.unit,
        date,
        estimatedCo2Kg: Number(estimatedImpact),
        meta: {
          vendor: vendor || "Vendor",
          activity_key: option.value,
        },
      });

      showSuccessToast("Purchases data saved!");
    }

    router.push("/emissions/review");
  };

  const handlePrevious = () => {
    router.push("/emissions/waste");
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Breadcrumb />
        <div className="flex items-center justify-between mt-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Purchases Activity
            </h1>
            <p className="text-slate-400">Step 4 of 4 - Goods, services, and supplier spend</p>
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
          <div className="flex-1 h-2 bg-primary rounded-full" />
        </div>
        <p className="text-sm text-primary font-medium mt-2 text-center">100% Complete</p>
      </div>

      {/* Main Form */}
      <DashboardCard
        title="Purchases Details"
        subtitle="Goods, services, and supplier spend"
        icon={<ShoppingCart className="size-5" />}
      >
        <div className="space-y-6">
          <p className="text-xs text-slate-500">
            Optional fields — add what you have now, or skip and return later.
          </p>
          {/* Purchase Type & Vendor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Purchase Type
              </label>
              <select
                value={purchaseType}
                onChange={(e) => setPurchaseType(e.target.value)}
                className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {purchasesFactors.map((factor) => (
                  <option key={factor.value} value={factor.value}>
                    {factor.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Vendor / Supplier
              </label>
              <input
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full px-4 py-3 bg-navy-muted border border-navy-border rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Supplier name"
              />
            </div>
          </div>

          {/* Spend & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Spend Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={spend}
                  onChange={(e) => setSpend(e.target.value)}
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
                Purchase Date
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
                  {[4, 3, 2, 3, 2].map((i, idx) => (
                    <div
                      key={idx}
                      className="w-2 bg-primary rounded-full"
                      style={{ height: `${i * 8}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              System auto-detect active • Based on supplier spend factors
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
          Previous: Waste
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
            Next: Review & Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
