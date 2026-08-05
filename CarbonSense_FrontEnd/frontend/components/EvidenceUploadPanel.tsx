"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/Button";
import { uploadComplianceEvidence } from "@/lib/policy-compliance-api";

export default function EvidenceUploadPanel({
  isOpen,
  onClose,
  requirementId,
}: {
  isOpen: boolean;
  onClose: () => void;
  requirementId: string | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!file || !requirementId) return;
    setLoading(true);
    const formData = new FormData();
    formData.set("requirement_id", requirementId);
    formData.set("file", file);
    await uploadComplianceEvidence(formData);
    setLoading(false);
    onClose();
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
