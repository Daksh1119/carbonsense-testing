"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/Button";
import { uploadComplianceEvidence } from "@/lib/policy-compliance-api";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

export default function EvidenceUploadPanel({
  isOpen,
  onClose,
  requirementId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  requirementId: string | null;
  onSuccess?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!file || !requirementId) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("requirement_id", requirementId);
      formData.set("file", file);
      await uploadComplianceEvidence(formData);
      showSuccessToast("Evidence uploaded and processed! Compliance status updated.");
      setFile(null);
      if (onSuccess) {
        await onSuccess();
      }
    } catch (err) {
      showErrorToast("Upload failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title="Upload Evidence">
      <div className="space-y-4">
        <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setFile(event.target.files?.[0] || null)} className="block w-full text-sm text-slate-300" />
        <p className="text-xs text-slate-400">PDF, JPG, PNG — document will be stored securely after upload.</p>
        <div className="flex gap-3">
          <Button onClick={submit} disabled={!file || loading}>{loading ? "Uploading..." : "Confirm & Submit"}</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}
