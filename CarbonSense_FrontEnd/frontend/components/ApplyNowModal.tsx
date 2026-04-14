"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import { verifyComplianceResult } from "@/lib/policy-compliance-api";

export default function ApplyNowModal({
  isOpen,
  onClose,
  policy,
  resultIdByRequirementId,
  onVerified,
}: {
  isOpen: boolean;
  onClose: () => void;
  policy: { id: string; name: string; steps?: Array<Record<string, unknown>> | null } | null;
  resultIdByRequirementId: Record<string, string>;
  onVerified?: () => void;
}) {
  const steps = policy?.steps || [];
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep] || null;
  const [saving, setSaving] = useState(false);
  const stepNumber = Number(step?.step_number || currentStep + 1);

  const linkedRequirementId = String(step?.linked_requirement_id || "");
  const resultId = linkedRequirementId ? resultIdByRequirementId[linkedRequirementId] : undefined;

  const canVerify = Boolean(resultId);

  const saveProgress = () => {
    const key = `carbonsense-apply-${policy?.id || "policy"}`;
    localStorage.setItem(key, JSON.stringify({ current_step: currentStep, started_at: new Date().toISOString() }));
    onClose();
  };

  const markComplete = async () => {
    if (!resultId) return;
    setSaving(true);
    try {
      await verifyComplianceResult(resultId, {
        status: "completed",
        verified: true,
        verification_source: "manual",
        notes: JSON.stringify({ current_step: currentStep + 1, completed_at: new Date().toISOString() }),
      });
      onVerified?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title={`Apply: ${policy?.name || "Policy"}`}>
      {policy ? (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Badge variant="info">Step {stepNumber} of {Math.max(steps.length, 1)}</Badge>
            <span>{String(step?.verification_type || "manual")}</span>
          </div>
          <div className="rounded-lg border border-navy-border bg-navy-muted/30 p-4">
            <h4 className="text-base font-semibold text-white">{String(step?.title || "Set up compliance step")}</h4>
            <p className="mt-2 text-sm text-slate-300">{String(step?.description || "Complete the action and keep evidence.")}</p>
            <p className="mt-2 text-xs text-slate-400">Why it matters: {String(step?.why_it_matters || "This step unlocks compliance progress.")}</p>
          </div>

          <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 text-sm text-slate-300">
            Evidence Upload Zone
            <p className="mt-1 text-xs text-slate-400">Upload proof from the step flow, then use Mark Step Complete.</p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" disabled={currentStep === 0} onClick={() => setCurrentStep((value) => Math.max(0, value - 1))}>Previous</Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={saveProgress}>Save & Close</Button>
              <Button variant="outline" disabled={currentStep >= steps.length - 1} onClick={() => setCurrentStep((value) => Math.min(steps.length - 1, value + 1))}>Next</Button>
              <Button onClick={markComplete} disabled={!canVerify || saving}>{saving ? "Saving..." : "Mark Step Complete"}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
