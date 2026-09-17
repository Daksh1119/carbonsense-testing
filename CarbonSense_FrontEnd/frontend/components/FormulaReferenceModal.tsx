"use client";

import Modal from "@/components/ui/Modal";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import { Calculator, ShieldCheck, FileSpreadsheet, ExternalLink, HelpCircle } from "lucide-react";

export interface EmissionFactorReference {
  activity: string;
  category: "Transport" | "Energy" | "Waste" | "Purchases" | "Water";
  scope: "Scope 1" | "Scope 2" | "Scope 3";
  factor: number;
  unit: string;
  formula: string;
  standard: string;
  notes: string;
}

export const CANONICAL_FORMULAS: EmissionFactorReference[] = [
  {
    activity: "Purchased Grid Electricity (India Grid Average)",
    category: "Energy",
    scope: "Scope 2",
    factor: 0.716,
    unit: "kgCO₂e / kWh",
    formula: "CO₂e (kg) = Electricity Usage (kWh) × 0.716 kgCO₂e/kWh × (1 - Renewable %)",
    standard: "Central Electricity Authority (CEA) CO₂ Baseline Database v19 (2022-23)",
    notes: "Direct grid baseline emission factor applicable across all regional load dispatch centres in India.",
  },
  {
    activity: "Diesel Fuel Combustion (Stationary Genset & Vehicles)",
    category: "Transport",
    scope: "Scope 1",
    factor: 2.68,
    unit: "kgCO₂e / Liter",
    formula: "CO₂e (kg) = Diesel Volume (Liters) × 2.680 kgCO₂e/L",
    standard: "IPCC 2006 Guidelines for National GHG Inventories (Energy - Fuel Combustion) & DEFRA 2023",
    notes: "Default net calorific value and carbon oxidation factor for commercial automotive & stationary gas-oil.",
  },
  {
    activity: "Petrol (Motor Gasoline) Combustion",
    category: "Transport",
    scope: "Scope 1",
    factor: 2.31,
    unit: "kgCO₂e / Liter",
    formula: "CO₂e (kg) = Petrol Volume (Liters) × 2.310 kgCO₂e/L",
    standard: "IPCC 2006 Guidelines Vol. 2 & US EPA GHG Emission Factors Hub",
    notes: "Applies to internal combustion engine company fleet cars and two-wheelers.",
  },
  {
    activity: "Compressed Natural Gas (CNG)",
    category: "Transport",
    scope: "Scope 1",
    factor: 2.75,
    unit: "kgCO₂e / kg",
    formula: "CO₂e (kg) = CNG Mass (kg) × 2.750 kgCO₂e/kg",
    standard: "BEE India PAT Scheme Conversion Baseline & IPCC Tier 1",
    notes: "Methane stoichiometric combustion factor based on standard gas quality.",
  },
  {
    activity: "Business Travel (Air - Domestic Economy)",
    category: "Transport",
    scope: "Scope 3",
    factor: 0.245,
    unit: "kgCO₂e / km",
    formula: "CO₂e (kg) = Distance (km) × 0.245 kgCO₂e/km (includes radiative forcing)",
    standard: "UK DEFRA / DESNZ GHG Conversion Factors for Company Reporting (Aviation)",
    notes: "Short-haul domestic flight intensity with standard passenger load factors.",
  },
  {
    activity: "Landfill Waste Disposal (Unsorted Municipal Solid Waste)",
    category: "Waste",
    scope: "Scope 3",
    factor: 0.587,
    unit: "kgCO₂e / kg",
    formula: "CO₂e (kg) = Waste Mass (kg) × 0.587 kgCO₂e/kg",
    standard: "EPA WARM Model v15 & Solid Waste Management Rules 2016",
    notes: "Accounts for anaerobic digestion and fugitive landfill methane generation over decay period.",
  },
  {
    activity: "Municipal Water Supply & Treatment",
    category: "Water",
    scope: "Scope 3",
    factor: 0.344,
    unit: "kgCO₂e / kL",
    formula: "CO₂e (kg) = Water Volume (kL) × 0.344 kgCO₂e/kL",
    standard: "India Municipal Pumping & Treatment Energy Intensity Benchmarks",
    notes: "Based on electrical energy required for intake, central treatment, and distribution pumping.",
  },
];

export default function FormulaReferenceModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title="Carbon Calculation Methodology & Mathematical Formulas"
      description="Standardized formulas, emission factors, and scientific benchmarks used in CarbonSense calculations."
    >
      <div className="space-y-6 text-sm text-slate-300">
        {/* Core Fundamental Equation Banner */}
        <div className="bg-gradient-to-r from-teal-950/70 to-slate-900 border border-teal-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-teal-400 font-semibold text-xs uppercase tracking-wider">
            <Calculator className="size-4" />
            Core Accounting Equation (GHG Protocol Corporate Standard)
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-emerald-300 text-sm md:text-base font-bold">
            Emissions (kg CO₂e) = Activity Quantity × Emission Factor (kg CO₂e / unit)
          </div>
          <p className="text-xs text-slate-400">
            Metric Tonnes Conversion: <code className="text-teal-300">tCO₂e = kgCO₂e / 1,000</code>
          </p>
        </div>

        {/* Detailed Formulas Table */}
        <div className="space-y-3">
          <h4 className="font-semibold text-white flex items-center gap-2 text-xs uppercase tracking-wider text-teal-300">
            <FileSpreadsheet className="size-4 text-teal-400" />
            Activity-Specific Formulations & Factors
          </h4>

          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {CANONICAL_FORMULAS.map((item, idx) => (
              <div
                key={idx}
                className="bg-navy-card/90 border border-navy-border hover:border-teal-500/40 rounded-xl p-4 space-y-2.5 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{item.activity}</span>
                    <Badge variant={item.category === "Energy" ? "warning" : item.category === "Transport" ? "info" : "default"}>
                      {item.category}
                    </Badge>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {item.factor} {item.unit}
                  </span>
                </div>

                <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 font-mono text-xs text-emerald-400 font-semibold">
                  {item.formula}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                  <span className="flex items-center gap-1.5 text-teal-300/90 font-medium">
                    <ShieldCheck className="size-3.5 text-teal-400" />
                    Source: {item.standard}
                  </span>
                  <span className="text-slate-400 italic text-[11px]">{item.notes}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit & Compliance Standards Footer */}
        <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-slate-400">
            All emission factors comply with SEBI BRSR Core, India Bureau of Energy Efficiency (BEE), and ISO 14064 GHG verification standards.
          </p>
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
