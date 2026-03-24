import { useEffect, useState } from "react";
import { fetchEmissionsUploads, EmissionsUploadRecord } from "@/lib/emissions-api";
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

  const fetchUploads = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { organizationId } = getCurrentUserContext();
      if (!organizationId) {
        throw new Error("Missing organization context.");
      }

      const data = await fetchEmissionsUploads(organizationId);
      setUploads(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch uploads");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  return {
    uploads,
    isLoading,
    error,
    refetch: fetchUploads,
  };
};
