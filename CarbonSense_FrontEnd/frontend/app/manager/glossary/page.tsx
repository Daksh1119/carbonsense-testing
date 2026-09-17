'use client';

/**
 * /glossary — Ultra-Interactive Expandable & Zoom-In Focus View Glossary Page
 */

import { useState, useMemo } from 'react';
import {
  BookOpen,
  Calculator,
  Search,
  ShieldCheck,
  Sparkles,
  Maximize2,
  X,
  ArrowRight,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/Badge';
import Button from '@/components/Button';

// ---------------------------------------------------------------------------
// Data Types & Entries
// ---------------------------------------------------------------------------

type TermEntry = {
  id: string;
  category: string;
  term: string;
  full: string;
  definition: string;
  example: string;
  keyTakeaway: string;
  relatedModule: string;
};

const TERMS: TermEntry[] = [
  {
    id: 'tco2e',
    category: 'Core Units',
    term: 'tCO₂e',
    full: 'Tonnes of CO₂ Equivalent',
    definition:
      'The universal unit for measuring greenhouse gas emissions. Different gases (CO₂, Methane, Nitrous Oxide, Fluorinated Gases) are converted into a single equivalent number based on their global warming potential over a 100-year timescale.',
    example: '1 tCO₂e equals the emissions of driving ~4,000 km in a petrol car, or consuming 1,400 kWh of grid power in India.',
    keyTakeaway: 'Standardizes all green gases into one comparable unit across all your operations.',
    relatedModule: 'Emissions Ingestion & Dashboard',
  },
  {
    id: 'scope-1',
    category: 'Emissions Scopes',
    term: 'Scope 1 Emissions',
    full: 'Direct Operational Emissions',
    definition:
      'Emissions from sources your organization directly owns or controls — such as diesel fuel burned in backup generators, natural gas burned in factory boilers, or petrol consumed in company-owned delivery fleets.',
    example: '500 Liters of diesel consumed by your facility backup generator during power cuts.',
    keyTakeaway: 'Directly under your operational control — easiest to measure via fuel receipts.',
    relatedModule: 'Scope 1 Activity Log',
  },
  {
    id: 'scope-2',
    category: 'Emissions Scopes',
    term: 'Scope 2 Emissions',
    full: 'Purchased Electricity & Energy',
    definition:
      'Indirect emissions from purchased grid electricity, steam, or cooling. The physical emissions occur at the thermal power plant, but your business accounts for them because your electricity usage created the demand.',
    example: 'Monthly utility bill of 45,000 kWh for office air conditioning, lighting, and machinery.',
    keyTakeaway: 'Can be rapidly reduced by procuring renewable energy tariffs or installing rooftop solar.',
    relatedModule: 'Facility Energy Analytics',
  },
  {
    id: 'scope-3',
    category: 'Emissions Scopes',
    term: 'Scope 3 Emissions',
    full: 'Value Chain & Indirect Activities',
    definition:
      'All other indirect emissions across your entire supply chain — including employee commuting, business travel, waste management, purchased goods & services, and product distribution.',
    example: 'Commercial air travel taken by executives or daily employee bus/car commuting.',
    keyTakeaway: 'Often accounts for 70%+ of a company’s total footprint, requiring supplier collaboration.',
    relatedModule: 'Value Chain & Waste Ingestion',
  },
  {
    id: 'emission-factor',
    category: 'Methodology',
    term: 'Emission Factor',
    full: 'Activity-to-Carbon Conversion Multiplier',
    definition:
      'A scientific multiplier converting measurable business activity into a CO₂e quantity. For example, India’s national grid emission factor converts 1,000 kWh of electricity into 716 kg of CO₂e.',
    example: 'India Grid Factor = 0.716 kg CO₂e / kWh (Central Electricity Authority).',
    keyTakeaway: 'Sourced directly from CEA, DEFRA, and IPCC published reference tables.',
    relatedModule: 'Calculation Engine',
  },
  {
    id: 'baseline-vs-actual',
    category: 'Methodology',
    term: 'Baseline vs. Actual Footprint',
    full: 'Estimated Benchmark vs. Measured Real Data',
    definition:
      'Baseline emissions are initial estimates calculated from your company profile (facility size, employee count). Actual emissions replace baselines as you upload real monthly utility bills and CSV logs.',
    example: 'Initial profile baseline estimate: 120 tCO₂e/yr → Verified CSV upload: 108.4 tCO₂e/yr.',
    keyTakeaway: 'Baselines provide instant starting insights; CSV/receipt uploads turn them into verified facts.',
    relatedModule: 'Data Ingestion & Benchmark',
  },
  {
    id: 'assessment-cycle',
    category: 'Engine & Scoring',
    term: 'Assessment Cycle',
    full: 'Historical Emissions Period Snapshot',
    definition:
      'A structured time window (annual or monthly) capturing your company’s activity data, forecasted emissions trajectory, and compliance metrics to enable clear year-over-year comparison.',
    example: 'FY 2025–26 Annual Decarbonization Assessment Cycle.',
    keyTakeaway: 'Enables audit-ready snapshot comparison between past, present, and target years.',
    relatedModule: 'Assessment Cycle Manager',
  },
  {
    id: 'action-score',
    category: 'Engine & Scoring',
    term: 'Action Score',
    full: 'Real-World Implementation Rating',
    definition:
      'A dynamic 0–100 rating that increases as your organization completes decarbonization recommendations and adopts environmental compliance policies.',
    example: 'Installing rooftop solar & switching to LED lights increases Action Score by +25 points.',
    keyTakeaway: 'Measures real decarbonization progress rather than theoretical paperwork.',
    relatedModule: 'Compliance & Recommendations',
  },
];

const CALCULATIONS = [
  {
    id: 'calc-scope-1',
    title: 'Scope 1 (Direct Fuel & Fleet Emissions)',
    summary: 'Calculates direct emissions from diesel, gas, and fleet fuel combustion.',
    formula: 'CO₂e (kg) = Fuel Volume (Liters) × Fuel Emission Factor (kg CO₂e / Liter)',
    details: 'Conversion factors are verified against India Ministry of Petroleum & Natural Gas, US EPA GHG Emission Factors Hub, and IPCC 2006 Guidelines (Energy Vol. 2). Diesel: 2.68 kg CO₂e/L; Petrol: 2.31 kg CO₂e/L; CNG: 2.75 kg CO₂e/kg.',
  },
  {
    id: 'calc-scope-2',
    title: 'Scope 2 (Purchased Grid Electricity)',
    summary: 'Calculates electricity emissions based on regional grid carbon intensity.',
    formula: 'CO₂e (kg) = Power Usage (kWh) × CEA Grid Factor (0.716 kg CO₂e / kWh) × (1 - Renewable %)',
    details: 'Standardized against the Central Electricity Authority (CEA) CO₂ Baseline Database for the Indian Power Sector (v19). Verified green tariffs, certified on-site solar, and approved PPAs receive 0.0 kg CO₂e/kWh credit.',
  },
  {
    id: 'calc-scope-3',
    title: 'Scope 3 (Supply Chain, Travel & Waste)',
    summary: 'Calculates value chain emissions across flights, commuting, and municipal waste.',
    formula: 'CO₂e (kg) = Activity Quantity (km, kg, nights) × DEFRA / EPA WARM Factor',
    details: 'Compliant with GHG Protocol Corporate Value Chain (Scope 3) Standard. Domestic flight: 0.245 kg CO₂e/km (DEFRA); Municipal solid landfill waste: 0.587 kg CO₂e/kg (EPA WARM v15 & Solid Waste Management Rules 2016).',
  },
  {
    id: 'calc-teme',
    title: 'TEME Bio-Sequestration & Offset Payback',
    summary: 'Calculates compound tree survival, annual carbon uptake, and time-debt offset year.',
    formula: 'Q(t) = ∑ [N_s × α_s(t) × (Survival_Rate_s)^t]  |  Offset Year = min { t | Cumulative Q(t) ≥ Emissions }',
    details: 'Incorporates species-specific growth curves calibrated from Forest Survey of India (FSI), IPCC AFOLU guidelines, and Monte Carlo hazard modeling (drought, fire, pest hazards).',
  },
  {
    id: 'calc-baseline',
    title: 'Enterprise Baseline Estimation Model',
    summary: 'Estimates organizational footprint prior to complete utility bill record uploads.',
    formula: 'E_total = E_elec (Emp × Benchmark × EF_grid) + E_HVAC (Area × Intensity) + E_fleet (Vehicles × 18,000 km × 0.192)',
    details: 'Formulated from BEE (Bureau of Energy Efficiency) commercial benchmarks, ASHRAE 90.1, and CEA grid carbon coefficients for 9 distinct industry sectors.',
  },
  {
    id: 'calc-recommendations',
    title: 'Decarbonization Recommendation Ranking',
    summary: 'Ranks reduction actions based on ROI, feasibility, and footprint impact.',
    formula: 'Priority Score = Potential CO₂ Savings × Financial ROI × Category Footprint Weight',
    details: 'Actions are selected from a curated catalog of ~25 sector-specific strategies (BEE, GHG Protocol, MoEFCC guidelines, and Energy Conservation Act 2022).',
  },
  {
    id: 'calc-compliance',
    title: 'Composite Compliance Score Framing',
    summary: 'Combines data completeness, verified actions, and policy deadlines.',
    formula: 'Compliance Score = (40% Data Completeness) + (40% Action Score) + (20% Mandatory Deadlines Met)',
    details: 'Directly aligned with SEBI BRSR Core guidelines, CPCB environmental standards, and ISO 14064 greenhouse gas reporting frameworks.',
  },
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function GlossaryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedTerm, setSelectedTerm] = useState<TermEntry | null>(null);
  const [selectedCalc, setSelectedCalc] = useState<typeof CALCULATIONS[0] | null>(null);

  const categories = useMemo(() => {
    const set = new Set(TERMS.map((t) => t.category));
    return ['All', ...Array.from(set)];
  }, []);

  const filteredTerms = useMemo(() => {
    return TERMS.filter((t) => {
      const matchesCat = activeCategory === 'All' || t.category === activeCategory;
      const matchesSearch =
        t.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.full.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.definition.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [searchTerm, activeCategory]);

  return (
    <div className="space-y-10 w-full max-w-7xl mx-auto pb-16">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-950/60 via-slate-900 to-navy-card border border-teal-500/30 rounded-3xl p-8 md:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 size-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-3 max-w-4xl">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-500/20 rounded-2xl border border-teal-500/40 shadow-inner">
              <BookOpen className="size-7 text-teal-400" />
            </div>
            <span className="text-xs font-bold text-teal-400 uppercase tracking-widest bg-teal-500/10 border border-teal-500/20 px-3 py-1 rounded-full">
              Knowledge Base
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Glossary & Calculation Methodology
          </h1>
          <p className="text-slate-300 text-base leading-relaxed">
            Click on any term or formula card to expand it into a <strong className="text-teal-300 font-semibold">Full-Screen Focus View</strong> with complete definitions, real-world examples, and step-by-step guidance.
          </p>
        </div>
      </div>

      {/* Control Bar: Search & Category Tabs */}
      <div className="bg-navy-card/90 border border-navy-border/80 p-5 rounded-2xl shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-teal-400" />
            <input
              type="text"
              placeholder="Search terms, concepts, or formulas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-12 pr-4 py-3 text-base text-white placeholder-slate-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 transition-all"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shadow-sm ${
                  activeCategory === cat
                    ? 'bg-teal-500 text-slate-950 shadow-teal-500/30'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Terms Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="size-6 text-teal-400" />
            <h2 className="text-2xl font-bold text-white tracking-tight">Interactive Term Cards</h2>
          </div>
          <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            Click any card to expand full view
          </span>
        </div>

        {/* 2-Column Responsive Card Grid with Zoom Hover Effect */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredTerms.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelectedTerm(t)}
              className="group relative cursor-pointer bg-gradient-to-b from-navy-card to-slate-900/90 border border-navy-border hover:border-teal-400/60 rounded-2xl p-7 shadow-xl hover:shadow-2xl hover:shadow-teal-500/10 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-teal-300 transition-colors flex items-center gap-2">
                      {t.term}
                    </h3>
                    {t.full && <p className="text-xs font-semibold text-teal-400/90 mt-0.5">{t.full}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 flex-shrink-0">
                      {t.category}
                    </span>
                    <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400 group-hover:bg-teal-500 group-hover:text-slate-950 transition-all">
                      <Maximize2 className="size-4" />
                    </div>
                  </div>
                </div>

                <p className="text-slate-200 text-base leading-relaxed line-clamp-3">{t.definition}</p>

                {t.example && (
                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
                    <Sparkles className="size-4 text-amber-400 flex-shrink-0" />
                    <p className="text-xs text-slate-300 truncate">
                      <strong className="text-amber-300">Example: </strong> {t.example}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-teal-400 font-semibold group-hover:translate-x-1 transition-transform">
                <span>Click for full explanation & formulas</span>
                <ArrowRight className="size-4" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Methodology & Calculation Section */}
      <section className="space-y-6 pt-4">
        <div className="flex items-center gap-3">
          <Calculator className="size-6 text-teal-400" />
          <h2 className="text-2xl font-bold text-white tracking-tight">Calculation Formulas & Methodology</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {CALCULATIONS.map((calc) => (
            <div
              key={calc.id}
              onClick={() => setSelectedCalc(calc)}
              className="group cursor-pointer bg-gradient-to-b from-navy-card to-slate-900 border border-navy-border hover:border-teal-400/50 rounded-2xl p-6 shadow-xl hover:-translate-y-1 transition-all duration-300 space-y-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-3 rounded-full bg-teal-400 shadow-sm shadow-teal-400" />
                  <h3 className="text-white font-bold text-base md:text-lg group-hover:text-teal-300 transition-colors">
                    {calc.title}
                  </h3>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400 group-hover:bg-teal-500 group-hover:text-slate-950 transition-all">
                  <Maximize2 className="size-4" />
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">{calc.summary}</p>

              <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-4">
                <code className="text-xs md:text-sm text-emerald-300 font-mono font-semibold block truncate">
                  {calc.formula}
                </code>
              </div>

              <div className="flex items-center justify-between text-xs text-teal-400 font-semibold pt-2">
                <span>Click to inspect full methodology</span>
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer Standard Note */}
      <div className="bg-gradient-to-r from-slate-900 via-navy-card to-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-8 text-teal-400 flex-shrink-0" />
          <p className="text-sm font-medium text-slate-300 leading-relaxed">
            All conversion factors in CarbonSense are directly verified from the <strong className="text-white">India Central Electricity Authority (CEA)</strong>, <strong className="text-white">GHG Protocol Corporate Standard</strong>, <strong className="text-white">DEFRA</strong>, and <strong className="text-white">IPCC Guidelines</strong>.
          </p>
        </div>
      </div>

      {/* ── EXPANDED FULL-SCREEN TERM MODAL (ZOOM FOCUS VIEW) ────────────────────────── */}
      {selectedTerm && (
        <Modal isOpen={!!selectedTerm} onClose={() => setSelectedTerm(null)} size="xl" title="">
          <div className="space-y-6 p-2">
            {/* Header Badge & Title */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="info">{selectedTerm.category}</Badge>
                  {selectedTerm.full && (
                    <span className="text-xs font-semibold text-teal-400 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
                      {selectedTerm.full}
                    </span>
                  )}
                </div>
                <h2 className="text-3xl font-extrabold text-white tracking-tight">{selectedTerm.term}</h2>
              </div>
            </div>

            {/* Definition Block */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-teal-400 uppercase tracking-widest flex items-center gap-2">
                <BookOpen className="size-4" /> Full Definition & Scope
              </h4>
              <p className="text-slate-100 text-lg leading-relaxed bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-inner">
                {selectedTerm.definition}
              </p>
            </div>

            {/* Practical Example */}
            {selectedTerm.example && (
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="size-4" /> Practical Business Example
                </h4>
                <div className="bg-gradient-to-r from-amber-500/10 to-slate-900 border border-amber-500/30 p-5 rounded-2xl">
                  <p className="text-base text-amber-200 leading-relaxed">{selectedTerm.example}</p>
                </div>
              </div>
            )}

            {/* Key Takeaway & Module Reference */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <p className="text-xs font-bold text-teal-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Lightbulb className="size-4 text-teal-400" /> Key Takeaway
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">{selectedTerm.keyTakeaway}</p>
              </div>
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <p className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-blue-400" /> Related CarbonSense Module
                </p>
                <p className="text-xs text-slate-300 font-semibold leading-relaxed">{selectedTerm.relatedModule}</p>
              </div>
            </div>

            {/* Footer Action */}
            <div className="pt-4 flex justify-end border-t border-slate-800">
              <Button variant="primary" onClick={() => setSelectedTerm(null)}>
                Close Focus View
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── EXPANDED FULL-SCREEN CALCULATION MODAL ────────────────────────── */}
      {selectedCalc && (
        <Modal isOpen={!!selectedCalc} onClose={() => setSelectedCalc(null)} size="xl" title="">
          <div className="space-y-6 p-2">
            <div className="border-b border-slate-800 pb-4">
              <Badge variant="success">Calculation Methodology</Badge>
              <h2 className="text-2xl font-extrabold text-white mt-2">{selectedCalc.title}</h2>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-teal-400 uppercase tracking-widest">Mathematical Formula</h4>
              <div className="bg-slate-950 border border-emerald-500/40 p-5 rounded-2xl shadow-xl">
                <code className="text-base md:text-lg text-emerald-300 font-mono font-bold block leading-relaxed">
                  {selectedCalc.formula}
                </code>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-teal-400 uppercase tracking-widest">Methodology Details & References</h4>
              <p className="text-base text-slate-200 leading-relaxed bg-slate-900 p-5 rounded-2xl border border-slate-800">
                {selectedCalc.details}
              </p>
            </div>

            <div className="pt-4 flex justify-end border-t border-slate-800">
              <Button variant="primary" onClick={() => setSelectedCalc(null)}>
                Close Focus View
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
