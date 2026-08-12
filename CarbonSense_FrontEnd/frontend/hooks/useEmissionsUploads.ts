import { useCallback, useEffect, useState } from "react";
import { fetchEmissionsUploadsScoped, EmissionsUploadRecord } from "@/lib/emissions-api";
import { getCurrentUserContext } from "@/lib/recommendations-api";
import { supabase } from "@/lib/supabaseClient";

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

  const fetchUploads = useCallback(async (isSilent?: boolean | unknown) => {
    try {
      const isSilentUpdate = typeof isSilent === 'boolean' ? isSilent : false;
      if (!isSilentUpdate) {
        setIsLoading(true);
      }
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
    fetchUploads(false);

    const handleSilentRefresh = () => {
      fetchUploads(true);
    };

    const channel = supabase
      .channel("analytics-uploads-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "organization_uploads" }, handleSilentRefresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUploads]);

  return {
    uploads,
    isLoading,
    error,
    refetch: fetchUploads,
  };
};
