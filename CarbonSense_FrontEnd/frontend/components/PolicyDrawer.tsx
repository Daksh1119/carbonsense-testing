"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import PolicyChat from "@/components/PolicyChat";
import { fetchPolicyById, type PolicyRecord } from "@/lib/policy-compliance-api";

export default function PolicyDrawer({
  policyId,
  open,
  onClose,
  onApplyNow,
  onReadDocument,
  onViewFunding,
}: {
  policyId: string | null;
  open: boolean;
  onClose: () => void;
  onApplyNow: (policy: PolicyRecord) => void;
  onReadDocument: (policy: PolicyRecord) => void;
  onViewFunding: (policy: PolicyRecord) => void;
}) {
  const [policy, setPolicy] = useState<PolicyRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !policyId) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchPolicyById(policyId)
      .then((data) => { if (mounted) setPolicy(data); })
      .catch((err) => { if (mounted) setError(err instanceof Error ? err.message : "Failed to load policy"); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [open, policyId]);

  const requirements = policy?.requirements || [];
  const benefits = policy?.benefits || [];
  const documentSummary = (policy?.document_summary || {}) as Record<string, unknown>;

  const summaryBullets = useMemo(() => {
    const candidates = (documentSummary.key_mandates as string[] | undefined) || requirements;
    return candidates.slice(0, 5);
  }, [documentSummary, requirements]);

  return (
    <Modal isOpen={open} onClose={onClose} size="xl" title={policy?.name || "Policy Details"} description={policy?.authority || undefined}>
      {loading ? <p className="text-sm text-slate-400">Loading policy details...</p> : null}
      {error ? <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p> : null}
      {policy ? (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">{String(policy.category || "General").toUpperCase()}</Badge>
            <Badge variant="default">{String(policy.layer || "core").toUpperCase()}</Badge>
            <Badge variant="success">{policy.status || "Applicable"}</Badge>
            <Badge variant="info">Match {Math.round(policy.match_score || 0)}%</Badge>
          </div>

          <div className="rounded-lg border border-navy-border bg-navy-muted/30 p-4 text-sm text-slate-200">
            {policy.match_reason || "Matched against your organization profile."}
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-white">What this policy requires</h4>
            <ul className="space-y-2 text-sm text-slate-300">
              {summaryBullets.map((item, index) => (<li key={index}>• {item}</li>))}
            </ul>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-white">Benefits of complying</h4>
            <ul className="space-y-2 text-sm text-slate-300">
              {benefits.slice(0, 5).map((item, index) => (<li key={index}>• {item}</li>))}
            </ul>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">Your compliance status</h4>
              <span className="text-xs text-slate-400">{policy.compliance_progress?.completed || 0} of {policy.compliance_progress?.total || requirements.length} requirements met</span>
            </div>
            <div className="space-y-2">
              {requirements.map((requirement, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border border-navy-border bg-background-dark px-3 py-2 text-sm">
                  <span className="text-slate-200">{requirement}</span>
                  <Badge variant="default">Requirement</Badge>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-white">Ask about this policy</h4>
            <PolicyChat policyId={policy.id} policyName={policy.name} category={policy.category} />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => onApplyNow(policy)}>Apply Now</Button>
            <Button variant="outline" onClick={() => onReadDocument(policy)}>Read Policy Document</Button>
            <Button variant="ghost" onClick={() => onViewFunding(policy)}>View Funding</Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
