"use client";

import { useRouter } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Button";
import { Breadcrumb } from "@/components/navigation";
import {
  Truck,
  Zap,
  Trash2,
  ShoppingCart,
  ArrowRight,
} from "lucide-react";

const activityCategories = [
  {
    id: "transport",
    name: "Transport",
    description: "Vehicle travel, fleet operations, and logistics",
    icon: Truck,
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    href: "/emissions/transport",
    examples: "Business travel, employee commute, freight",
  },
  {
    id: "energy",
    name: "Energy",
    description: "Electricity consumption and facility operations",
    icon: Zap,
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    href: "/emissions/energy",
    examples: "Grid electricity, renewable energy, heating",
  },
  {
    id: "waste",
    name: "Waste",
    description: "Waste disposal and material management",
    icon: Trash2,
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    href: "/emissions/waste",
    examples: "Landfill, recycling, composting, incineration",
  },
  {
    id: "purchases",
    name: "Purchases",
    description: "Goods, services, and supplier spend",
    icon: ShoppingCart,
    color: "bg-primary/20 text-primary border-primary/30",
    href: "/emissions/purchases",
    examples: "Office supplies, vendors, travel spend",
  },
];

export default function EmissionsPage() {
  const router = useRouter();

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header with Breadcrumb */}
      <div className="mb-8">
        <Breadcrumb />
        <h1 className="text-3xl font-bold text-white mb-2 mt-4">
          New Activity Entry
        </h1>
        <p className="text-slate-400">
          Select a category to begin tracking your carbon emissions
        </p>
      </div>

      {/* Category Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {activityCategories.map((category) => (
          <div
            key={category.id}
            className="group relative bg-background-dark border border-navy-border rounded-xl p-6 hover:border-primary/50 transition-all duration-300 cursor-pointer"
            onClick={() => router.push(category.href)}
          >
            {/* Icon Header */}
            <div className="flex items-start justify-between mb-4">
              <div
                className={`${category.color} border rounded-lg p-3 group-hover:scale-110 transition-transform duration-300`}
              >
                <category.icon className="size-6" />
              </div>
              <ArrowRight className="size-5 text-slate-500 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
            </div>

            {/* Content */}
            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition-colors">
              {category.name}
            </h3>
            <p className="text-sm text-slate-400 mb-3">
              {category.description}
            </p>
            <p className="text-xs text-slate-500">
              Examples: {category.examples}
            </p>

            {/* Hover Effect Overlay */}
            <div className="absolute inset-0 bg-primary/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          </div>
        ))}
      </div>

      {/* Quick Tips */}
      <DashboardCard
        title="Quick Tips"
        subtitle="Best practices for accurate emissions tracking"
        className="mt-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="font-semibold text-white mb-2">📋 Be Specific</h4>
            <p className="text-slate-400">
              Include precise measurements and dates for accurate calculations
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-2">🔄 Regular Updates</h4>
            <p className="text-slate-400">
              Track activities daily or weekly for comprehensive reporting
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-2">✅ Review Often</h4>
            <p className="text-slate-400">
              Check the Review section to validate entries before final submission
            </p>
          </div>
        </div>
      </DashboardCard>

      {/* Back Button */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard")}
        >
          Back to Dashboard
        </Button>
        <Button
          variant="primary"
          onClick={() => router.push("/emissions/review")}
        >
          Review & Submit
        </Button>
      </div>
    </div>
  );
}
