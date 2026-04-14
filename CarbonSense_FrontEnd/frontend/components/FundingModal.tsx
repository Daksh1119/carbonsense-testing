"use client";

import Modal from "@/components/ui/Modal";
import Button from "@/components/Button";
import Badge from "@/components/Badge";

export default function FundingModal({
  isOpen,
  onClose,
  policy,
}: {
  isOpen: boolean;
  onClose: () => void;
  policy: { name: string; funding?: Record<string, unknown> | null; id: string } | null;
}) {
  const funding = (policy?.funding || {}) as Record<string, unknown>;
  const scheme = String(funding.scheme_name || policy?.name || "Funding");
  const applicationUrl = String(funding.application_url || "").trim();
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title={`Funding & Incentives: ${scheme}`}>
      {policy ? (
        <div className="space-y-4 text-sm text-slate-300">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div><span className="text-slate-400">Benefit Type:</span><div>{String(funding.benefit_type || "Compliance and incentive readiness")}</div></div>
            <div><span className="text-slate-400">Estimated Value:</span><div className="text-primary">{String(funding.amount || "TBD")}</div></div>
            <div><span className="text-slate-400">Eligibility:</span><div>{String(funding.eligibility || "Organization-specific")}</div></div>
            <div><span className="text-slate-400">Deadline:</span><div>{String(funding.deadline || "Rolling")}</div></div>
          </div>
          <div className="rounded-lg border border-navy-border bg-navy-muted/30 p-4">
            <h4 className="mb-2 font-semibold text-white">How to apply</h4>
            <ul className="space-y-1">
              {(funding.how_to_apply as string[] | undefined || ["Review applicability", "Prepare evidence", "Track progress"]).map((item, index) => (<li key={index}>• {item}</li>))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => applicationUrl && window.open(applicationUrl, "_blank")}>
              {applicationUrl ? "Open Portal ↗" : "Portal URL Unavailable"}
            </Button>
            <Button>Add to My Action Plan</Button>
          </div>
          <Badge variant="info">Financial benefit and action plan</Badge>
        </div>
      ) : null}
    </Modal>
  );
}
