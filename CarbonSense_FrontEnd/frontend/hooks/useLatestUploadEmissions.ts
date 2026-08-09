"use client";

import { useMemo } from "react";
import { useEmissionsUploads } from "@/hooks/useEmissionsUploads";
import { EmissionsUploadRecord } from "@/lib/emissions-api";

export interface UploadEmissionSummary {
  upload: EmissionsUploadRecord;
  emissionKg: number;
  label: string;
  periodLabel: string;
  freshnessLabel: string;
  isRecent: boolean;
}

export interface UseLatestUploadEmissionsReturn {
  summaries: UploadEmissionSummary[];
  latestSummary: UploadEmissionSummary | null;
  combinedEmissionKg: number;
  isLoading: boolean;
  hasUploads: boolean;
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return "Period unknown";
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  if (start && end) {
    const s = fmt(start);
    const e = fmt(end);
    return s === e ? s : `${s} - ${e}`;
  }
  return fmt(start || end!);
}

function formatFreshness(createdAt: string): { label: string; isRecent: boolean } {
  const diffDays = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return { label: "uploaded today", isRecent: true };
  if (diffDays === 1) return { label: "uploaded yesterday", isRecent: true };
  if (diffDays <= 30) return { label: `${diffDays}d ago`, isRecent: true };
  if (diffDays <= 365) return { label: `${Math.floor(diffDays / 30)}mo ago`, isRecent: false };
  return { label: `${Math.floor(diffDays / 365)}y ago`, isRecent: false };
}

export function useLatestUploadEmissions(): UseLatestUploadEmissionsReturn {
  const { uploads, isLoading } = useEmissionsUploads();

  const summaries = useMemo((): UploadEmissionSummary[] => {
    return uploads
      .filter((u) => Number(u.total_emissions_kg || 0) > 0)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((upload): UploadEmissionSummary => {
        const emissionKg = Number(upload.total_emissions_kg || 0);
        const { label: freshnessLabel, isRecent } = formatFreshness(upload.created_at);
        return {
          upload,
          emissionKg,
          label: upload.original_file_name || upload.source_type || "Uploaded data",
          periodLabel: formatPeriod(upload.period_start, upload.period_end),
          freshnessLabel,
          isRecent,
        };
      });
  }, [uploads]);

  return {
    summaries,
    latestSummary: summaries[0] ?? null,
    combinedEmissionKg: summaries.reduce((sum, s) => sum + s.emissionKg, 0),
    isLoading,
    hasUploads: summaries.length > 0,
  };
}
