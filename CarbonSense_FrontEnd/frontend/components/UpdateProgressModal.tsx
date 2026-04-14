"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/Button";

export default function UpdateProgressModal({
  isOpen,
  onClose,
  steps,
}: {
  isOpen: boolean;
  onClose: () => void;
  steps: Array<Record<string, unknown>>;
}) {
  const [completed, setCompleted] = useState<number[]>([]);
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title="Update Progress">
      <div className="space-y-3 text-sm text-slate-300">
        {steps.map((step, index) => (
          <button key={index} onClick={() => setCompleted((current) => current.includes(index) ? current : [...current, index])} className="w-full rounded-lg border border-navy-border bg-navy-muted/30 p-3 text-left">
            <div className="font-semibold text-white">Step {Number(step.step_number || index + 1)}: {String(step.title || "Checklist item")}</div>
            <div className="text-slate-400">{String(step.description || step.why_it_matters || "No details")}</div>
          </button>
        ))}
        <Button onClick={onClose}>Save & Close</Button>
      </div>
    </Modal>
  );
}
