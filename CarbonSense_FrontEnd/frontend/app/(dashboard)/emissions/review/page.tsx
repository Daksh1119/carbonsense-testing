"use client";

import { useRouter } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { persistManualEntries } from "@/lib/emissions-api";
import { getCurrentUserContext } from "@/lib/recommendations-api";
import { useEmissionsDraftStore } from "@/store";
import {
  TrendingUp,
  CheckCircle,
  Truck,
  Zap,
  Trash2,
  ShoppingCart,
  Edit2,
  Leaf,
} from "lucide-react";

export default function ReviewPage() {
  const router = useRouter();
  const { entries, clearAll } = useEmissionsDraftStore();

  const activities = [
    entries.transport && {
      category: "Transport",
      icon: Truck,
      type: entries.transport.activityType,
      detail: entries.transport.detail,
      date: entries.transport.date,
      emissions: entries.transport.estimatedCo2Kg,
      color: "text-blue-400",
    },
    entries.energy && {
      category: "Energy",
      icon: Zap,
      type: entries.energy.activityType,
      detail: entries.energy.detail,
      date: entries.energy.date,
      emissions: entries.energy.estimatedCo2Kg,
      color: "text-yellow-400",
    },
    entries.waste && {
      category: "Waste",
      icon: Trash2,
      type: entries.waste.activityType,
      detail: entries.waste.detail,
      date: entries.waste.date,
      emissions: entries.waste.estimatedCo2Kg,
      color: "text-green-400",
    },
    entries.purchases && {
      category: "Purchases",
      icon: ShoppingCart,
      type: entries.purchases.activityType,
      detail: entries.purchases.detail,
      date: entries.purchases.date,
      emissions: entries.purchases.estimatedCo2Kg,
      color: "text-primary",
    },
  ].filter(Boolean) as Array<{
    category: string;
    icon: typeof Truck;
    type: string;
    detail: string;
    date: string;
    emissions: number;
    color: string;
  }>;

  const totalEmissions = activities
    .reduce((sum, activity) => sum + activity.emissions, 0)
    .toFixed(2);

  const handleSubmit = async () => {
    if (activities.length === 0) {
      showErrorToast("Add at least one category before submitting.");
      return;
    }

    const { organizationId, userId } = getCurrentUserContext();
    if (!organizationId || !userId) {
      showErrorToast("Missing user or organization context.");
      return;
    }

    try {
      const payloadEntries = Object.values(entries)
        .filter((entry) => entry)
        .map((entry) => ({
          category: entry!.category,
          activity: entry!.activityType,
          amount: entry!.amount,
          unit: entry!.unit,
          entry_date: entry!.date,
          co2_kg: entry!.estimatedCo2Kg,
        }));

      await persistManualEntries({
        organizationId,
        userId,
        entries: payloadEntries,
      });

      clearAll();
      showSuccessToast("All emission entries saved successfully!");
      setTimeout(() => {
        router.push("/detailed-log");
      }, 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit entries";
      showErrorToast(message);
    }
  };

  const handleEdit = (category: string) => {
    const paths: { [key: string]: string } = {
      "Transport": "/emissions/transport",
      "Energy": "/emissions/energy",
      "Waste": "/emissions/waste",
      "Purchases": "/emissions/purchases",
    };
    router.push(paths[category]);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Breadcrumb />
        <div className="flex items-center justify-between mt-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Review & Submit
            </h1>
            <p className="text-slate-400">Final review - Verify your entries before submission</p>
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
        <p className="text-sm text-primary font-medium mt-2 text-center">Ready to submit</p>
      </div>

      {/* Total Emissions Summary */}
      <div className="bg-gradient-to-r from-primary/20 to-emerald-500/20 border border-primary/40 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
              Total Carbon Footprint
            </p>
            <div className="flex items-baseline gap-2">
              <Leaf className="size-6 text-primary" />
              <span className="text-5xl font-bold text-white">
                {totalEmissions}
              </span>
              <span className="text-xl text-slate-400">KG CO2E</span>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-lg px-4 py-2">
              <p className="text-xs text-emerald-400 uppercase tracking-wider">
                Within Target Range
              </p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                -12%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Review Cards */}
      <div className="space-y-4 mb-6">
        {activities.length === 0 && (
          <DashboardCard
            title="No entries yet"
            subtitle="Add any category to build your manual emissions record"
            icon={<TrendingUp className="size-5" />}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">
                You can submit a single category now and add the rest later.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/emissions")}
              >
                Add Entry
              </Button>
            </div>
          </DashboardCard>
        )}
        {activities.map((activity, index) => (
          <DashboardCard
            key={index}
            title={activity.category}
            subtitle={activity.type}
            icon={<activity.icon className="size-5" />}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400 mb-1">Details</p>
                    <p className="text-white font-medium">{activity.detail}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-1">Date</p>
                    <p className="text-white font-medium">
                      {new Date(activity.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-1">Emissions</p>
                    <p className={`font-bold ${activity.color}`}>
                      {activity.emissions} KG CO2E
                    </p>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<Edit2 className="size-4" />}
                onClick={() => handleEdit(activity.category)}
              >
                Edit
              </Button>
            </div>
          </DashboardCard>
        ))}
      </div>

      {/* Confirmation Info */}
      <DashboardCard
        title="Before You Submit"
        subtitle="Please review the following information"
        icon={<CheckCircle className="size-5 text-emerald-400" />}
      >
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle className="size-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <p className="text-slate-300">
              All data will be processed and added to your emissions inventory
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="size-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <p className="text-slate-300">
              Carbon calculations are based on internationally recognized emission factors
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="size-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <p className="text-slate-300">
              You can edit or delete entries from the Detailed Log page after submission
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="size-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <p className="text-slate-300">
              Reports and analytics will be updated automatically
            </p>
          </div>
        </div>
      </DashboardCard>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/emissions/purchases")}
        >
          Previous: Purchases
        </Button>
        <Button
          variant="primary"
          icon={<CheckCircle className="size-4" />}
          onClick={handleSubmit}
        >
          Submit All Entries
        </Button>
      </div>
    </div>
  );
}
