"use client";

import Modal from "@/components/ui/Modal";
import Button from "@/components/Button";

export default function ReadPolicyModal({
  isOpen,
  onClose,
  policy,
}: {
  isOpen: boolean;
  onClose: () => void;
  policy: { name: string; external_url?: string | null; document_summary?: Record<string, unknown> | null } | null;
}) {
  const summary = (policy?.document_summary || {}) as Record<string, unknown>;
  const officialUrl = String(policy?.external_url || summary.source_url || "").trim();
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title={`Policy Document: ${policy?.name || "Policy"}`}>
      {policy ? (
        <div className="space-y-4 text-sm text-slate-300">
          <p className="text-slate-400">{String(summary.gazette_reference || "Official source summary")}</p>
          <div>
            <h4 className="mb-2 font-semibold text-white">Key mandates</h4>
            <ul className="space-y-1">{(summary.key_mandates as string[] | undefined || []).map((item, index) => (<li key={index}>• {item}</li>))}</ul>
          </div>
          <div>
            <h4 className="mb-2 font-semibold text-white">Who it applies to</h4>
            <ul className="space-y-1">{(summary.applies_to as string[] | undefined || []).map((item, index) => (<li key={index}>• {item}</li>))}</ul>
          </div>
          <div>
            <h4 className="mb-2 font-semibold text-white">Penalties / key dates</h4>
            <ul className="space-y-1">{(summary.penalties as string[] | undefined || []).map((item, index) => (<li key={index}>• {item}</li>))}</ul>
            <ul className="mt-2 space-y-1">{(summary.key_dates as string[] | undefined || []).map((item, index) => (<li key={index}>• {item}</li>))}</ul>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => officialUrl && window.open(officialUrl, "_blank")}>
              {officialUrl ? "Open Official Document ↗" : "Official URL Unavailable"}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
