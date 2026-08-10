"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/Button";

import { showSuccessToast } from "@/lib/toast";

export default function UpdateProgressModal({
  isOpen,
  onClose,
  steps,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  steps: Array<Record<string, unknown>>;
  onSuccess?: () => void;
}) {
  const [completed, setCompleted] = useState<number[]>([]);

  const handleSave = async () => {
    showSuccessToast("Progress checklist updated!");
    if (onSuccess) {
      await onSuccess();
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title="Update Progress">
      <div className="space-y-3 text-sm text-slate-300">
        {steps.map((step, index) => (
          <button key={index} onClick={() => setCompleted((current) => current.includes(index) ? current : [...current, index])} className={`w-full rounded-lg border p-3 text-left transition-colors ${completed.includes(index) ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200" : "border-navy-border bg-navy-muted/30"}`}>
            <div className="font-semibold text-white">Step {Number(step.step_number || index + 1)}: {String(step.title || "Checklist item")} {completed.includes(index) && "✓"}</div>
            <div className="text-slate-400">{String(step.description || step.why_it_matters || "No details")}</div>
          </button>
        ))}
        <Button onClick={handleSave}>Save & Close</Button>
      </div>
    </Modal>
  );
}
