"use client";

import { useState } from "react";
import { Database, ChevronDown, ArrowRight, Upload, Zap, AlertCircle } from "lucide-react";
import { useLatestUploadEmissions, UploadEmissionSummary } from "@/hooks/useLatestUploadEmissions";

interface EmissionDataSourceBannerProps {
  /** Called when user picks a data source and wants to run TEME immediately */
  onQuickAnalyze: (emissionKg: number, sourceLabel: string, mode: "single" | "combined") => void;
}

function formatKg(kg: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(kg);
}

export default function EmissionDataSourceBanner({ onQuickAnalyze }: EmissionDataSourceBannerProps) {
  const { summaries, latestSummary, combinedEmissionKg, isLoading, hasUploads } =
    useLatestUploadEmissions();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [useAllUploads, setUseAllUploads] = useState(false);

  const selectedSummary: UploadEmissionSummary | null = summaries[selectedIndex] ?? null;
  const activeEmissionKg = useAllUploads ? combinedEmissionKg : (selectedSummary?.emissionKg ?? 0);
  const activeLabel = useAllUploads
    ? `${summaries.length} uploads combined`
    : (selectedSummary?.label ?? "");

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-48 rounded bg-slate-700" />
            <div className="h-2 w-32 rounded bg-slate-800" />
          </div>
          <div className="h-8 w-36 rounded-lg bg-slate-700" />
        </div>
      </div>
    );
  }

  if (!hasUploads) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
            <AlertCircle className="size-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-200">No emission data uploaded yet</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload a CSV from Data Ingestion to auto-fill TEME analysis
            </p>
          </div>
          <a
            href="/data-ingestion"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition-colors"
          >
            <Upload className="size-3.5" />
            Upload Data
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-gradient-to-r from-emerald-950/60 via-slate-900/80 to-slate-900/60 p-4 shadow-lg shadow-emerald-900/10">
      <div className="flex flex-wrap items-center gap-4">
        {/* Icon + label */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/20">
            <Database className="size-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                Your Emission Data
              </span>
              {selectedSummary?.isRecent && !useAllUploads && (
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-xs text-emerald-300">
                  Fresh
                </span>
              )}
              {useAllUploads && (
                <span className="rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-xs text-cyan-300">
                  Combined
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-white mt-0.5">
              {formatKg(activeEmissionKg)} kg CO₂e
            </p>
            <p className="text-xs text-slate-400 truncate max-w-xs">
              {useAllUploads
                ? `Across ${summaries.length} upload${summaries.length > 1 ? "s" : ""} · ${formatKg(combinedEmissionKg)} kg total`
                : `${selectedSummary?.periodLabel} · ${selectedSummary?.freshnessLabel}`}
            </p>
          </div>
        </div>

        {/* Source selector (if multiple uploads) */}
        {summaries.length > 1 && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowDropdown((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
            >
              <span className="max-w-[140px] truncate">
                {useAllUploads ? "All uploads" : selectedSummary?.label}
              </span>
              <ChevronDown className="size-3 shrink-0" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px] rounded-xl border border-slate-700 bg-slate-900 shadow-xl overflow-hidden">
                {summaries.map((s, idx) => (
                  <button
                    key={s.upload.id}
                    type="button"
                    onClick={() => {
                      setSelectedIndex(idx);
                      setUseAllUploads(false);
                      setShowDropdown(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left hover:bg-slate-800 transition-colors ${
                      !useAllUploads && selectedIndex === idx
                        ? "bg-emerald-900/30 border-l-2 border-emerald-400"
                        : ""
                    }`}
                  >
                    <p className="text-xs font-medium text-white truncate">{s.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatKg(s.emissionKg)} kg · {s.periodLabel}
                    </p>
                  </button>
                ))}
                <div className="border-t border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setUseAllUploads(true);
                      setShowDropdown(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left hover:bg-slate-800 transition-colors ${
                      useAllUploads ? "bg-cyan-900/30 border-l-2 border-cyan-400" : ""
                    }`}
                  >
                    <p className="text-xs font-medium text-cyan-300 flex items-center gap-1">
                      <Zap className="size-3" /> Combine all uploads
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatKg(combinedEmissionKg)} kg total · {summaries.length} files
                    </p>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick analyze CTA */}
        <button
          type="button"
          onClick={() =>
            onQuickAnalyze(
              activeEmissionKg,
              activeLabel,
              useAllUploads ? "combined" : "single"
            )
          }
          className="flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-emerald-900/40 active:scale-95"
        >
          <Zap className="size-4" />
          Quick TEME Analysis
          <ArrowRight className="size-3.5" />
        </button>
      </div>

      {/* File name subtext */}
      {!useAllUploads && selectedSummary && (
        <p className="mt-2 ml-12 text-xs text-slate-500 truncate">
          Source: {selectedSummary.label}
          {selectedSummary.upload.record_count
            ? ` · ${selectedSummary.upload.record_count} records`
            : ""}
        </p>
      )}
    </div>
  );
}
