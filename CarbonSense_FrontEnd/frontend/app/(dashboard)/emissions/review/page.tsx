"use client";

import { useRouter } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import { showSuccessToast } from "@/lib/toast";
import {
  TrendingUp,
  CheckCircle,
  Truck,
  Zap,
  Trash2,
  Edit2,
  Leaf,
} from "lucide-react";

export default function ReviewPage() {
  const router = useRouter();

  // Mock data - in real app, this would come from state management or API
  const activities = [
    {
      category: "Transport",
      icon: Truck,
      type: "Business Travel (Road)",
      detail: "150 KM • Diesel",
      date: "March 5, 2026",
      emissions: 18.60,
      color: "text-blue-400",
    },
    {
      category: "Energy",
      icon: Zap,
      type: "Grid Electricity",
      detail: "450 kWh • Mixed Grid",
      date: "February 2026",
      emissions: 104.85,
      color: "text-yellow-400",
    },
    {
      category: "Waste",
      icon: Trash2,
      type: "General Waste",
      detail: "75 KG • Landfill",
      date: "March 1, 2026",
      emissions: 43.80,
      color: "text-green-400",
    },
  ];

  const totalEmissions = activities.reduce((sum, activity) => sum + activity.emissions, 0).toFixed(2);

  const handleSubmit = () => {
    showSuccessToast("All emission entries saved successfully!");
    setTimeout(() => {
      router.push("/detailed-log");
    }, 1500);
  };

  const handleEdit = (category: string) => {
    const paths: { [key: string]: string } = {
      "Transport": "/emissions/transport",
      "Energy": "/emissions/energy",
      "Waste": "/emissions/waste",
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
            <p className="text-slate-400">Step 4 of 4 - Verify your entries before submission</p>
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
                    <p className="text-white font-medium">{activity.date}</p>
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
          onClick={() => router.push("/emissions/waste")}
        >
          Previous: Waste
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
