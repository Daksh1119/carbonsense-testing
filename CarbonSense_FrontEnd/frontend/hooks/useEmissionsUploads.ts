import { useCallback, useEffect, useState } from "react";
import { fetchEmissionsUploadsScoped, EmissionsUploadRecord } from "@/lib/emissions-api";
import { getCurrentUserContext } from "@/lib/recommendations-api";

interface UseEmissionsUploadsReturn {
  uploads: EmissionsUploadRecord[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useEmissionsUploads = (): UseEmissionsUploadsReturn => {
  const [uploads, setUploads] = useState<EmissionsUploadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUploads = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { organizationId, userId } = getCurrentUserContext();
      if (!organizationId && !userId) {
        throw new Error("Missing organization/user context.");
      }

      const data = await fetchEmissionsUploadsScoped({ organizationId, userId });
      const normalized = (data || []).filter((upload) => Number(upload.record_count || 0) > 0);
      setUploads(normalized);
    } catch (err) {
      setUploads([]);
      setError(err instanceof Error ? err.message : "Failed to load uploads.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUploads();

    const refreshIntervalMs = 60_000;
    const intervalId = window.setInterval(() => {
      fetchUploads();
    }, refreshIntervalMs);

    const refreshOnFocus = () => {
      fetchUploads();
    };

    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchUploads();
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [fetchUploads]);

  return {
    uploads,
    isLoading,
    error,
    refetch: fetchUploads,
  };
};
