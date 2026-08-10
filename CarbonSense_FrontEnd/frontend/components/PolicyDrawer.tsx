"use client";

/**
 * PolicyDrawer — Group 3B.2 upgrade
 * Adds:
 *  - Step-by-step compliance plan (from policy.steps[])
 *  - Policy deadline clearly labeled
 *  - Verified official government/authority link with "⚠️ Verify before submitting" note
 *  - Retained: chat, adoption status badge, benefits, requirements, funding action buttons
 */

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import PolicyChat from "@/components/PolicyChat";
import { fetchPolicyById, type PolicyRecord } from "@/lib/policy-compliance-api";
import {
  ExternalLink,
  CheckCircle2,
  Clock,
  ListChecks,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Step-by-step plan renderer ─────────────────────────────────────────────

type PolicyStep = {
  step_number?: number;
  title?: string;
  description?: string;
  why_it_matters?: string;
  verification_type?: string;
};

function StepPlan({ steps }: { steps: PolicyStep[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? steps : steps.slice(0, 3);

  if (!steps.length) return null;

  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold text-white flex items-center gap-2">
        <ListChecks className="size-4 text-teal-400" />
        Step-by-step compliance plan
      </h4>
      <ol className="space-y-3">
        {visible.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-600/20 border border-teal-500/30 text-teal-400 text-xs font-bold flex items-center justify-center mt-0.5">
              {step.step_number ?? i + 1}
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">{step.title ?? `Step ${i + 1}`}</p>
              {step.description && (
                <p className="text-xs text-slate-400 leading-relaxed">{step.description}</p>
              )}
              {step.why_it_matters && (
                <p className="text-xs text-slate-500 italic">Why: {step.why_it_matters}</p>
              )}
              {step.verification_type && (
                <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  Verified by: {step.verification_type}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
      {steps.length > 3 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-3 flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
        >
          {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          {expanded ? "Show fewer steps" : `Show ${steps.length - 3} more steps`}
        </button>
      )}
    </div>
  );
}

// ─── Deadline chip ────────────────────────────────────────────────────────────

function DeadlineChip({ policy }: { policy: PolicyRecord }) {
  const policyAny = policy as unknown as Record<string, unknown>;
  const deadline = (policyAny.review_date as string | undefined)
    || (policyAny.effective_date as string | undefined);

  if (!deadline) return null;

  const parsed = new Date(deadline);
  const isValid = !isNaN(parsed.getTime());
  const isPast = isValid && parsed < new Date();
  const label = isValid
    ? parsed.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : deadline;

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
      isPast
        ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
        : "border-amber-500/30 bg-amber-500/10 text-amber-300"
    }`}>
      <Clock className="size-3.5 flex-shrink-0" />
      <span>
        <span className="font-semibold">Policy deadline / review date: </span>{label}
        {isPast && " — this deadline has passed"}
      </span>
    </div>
  );
}

// ─── Verified gov link ────────────────────────────────────────────────────────

function GovLink({ url }: { url?: string }) {
  if (!url) return null;
  return (
    <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <ExternalLink className="size-3.5 text-teal-400" />
        <span className="text-xs font-semibold text-teal-400">Official Source</span>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-xs text-slate-300 underline hover:text-teal-400 break-all"
      >
        {url}
      </a>
      <div className="flex items-center gap-1.5 text-[10px] text-amber-400/80">
        <AlertTriangle className="size-3" />
        Always verify this link directly on the government portal before submitting any compliance documents.
      </div>
    </div>
  );
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

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
  const policyExt = policy as unknown as Record<string, unknown> | null;
  const steps = Array.isArray(policyExt?.steps)
    ? (policyExt!.steps as PolicyStep[])
    : [];
  const documentSummary = (policy?.document_summary || {}) as Record<string, unknown>;
  const summaryBullets = useMemo(() => {
    const candidates = (documentSummary.key_mandates as string[] | undefined) || requirements;
    return candidates.slice(0, 5);
  }, [documentSummary, requirements]);

  const govUrl = policy?.external_url as string | undefined;

  return (
    <Modal isOpen={open} onClose={onClose} size="xl" title={policy?.name || "Policy Details"} description={policy?.authority || undefined}>
      {loading ? <p className="text-sm text-slate-400">Loading policy details...</p> : null}
      {error ? <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p> : null}
      {policy ? (
        <div className="space-y-5">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">{String(policy.category || "General").toUpperCase()}</Badge>
            <Badge variant="default">{String(policy.layer || "core").toUpperCase()}</Badge>
            <Badge variant="success">{policy.status || "Applicable"}</Badge>
            <Badge variant="info">Match {Math.round(policy.match_score || 0)}%</Badge>
          </div>

          {/* Match reason */}
          <div className="rounded-lg border border-navy-border bg-navy-muted/30 p-4 text-sm text-slate-200">
            {policy.match_reason || "Matched against your organization profile."}
          </div>

          {/* Group 3B.2 — Deadline */}
          <DeadlineChip policy={policy} />

          {/* Group 3B.2 — Official gov link */}
          <GovLink url={govUrl} />

          {/* Group 3B.2 — Step-by-step plan */}
          {steps.length > 0 ? (
            <StepPlan steps={steps} />
          ) : (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-white flex items-center gap-2">
                <CheckCircle2 className="size-4 text-teal-400" />
                What this policy requires
              </h4>
              <ul className="space-y-2 text-sm text-slate-300">
                {summaryBullets.map((item, index) => <li key={index}>• {item}</li>)}
              </ul>
            </div>
          )}

          {/* Benefits */}
          {benefits.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-white">Benefits of complying</h4>
              <ul className="space-y-2 text-sm text-slate-300">
                {benefits.slice(0, 5).map((item, index) => <li key={index}>• {item}</li>)}
              </ul>
            </div>
          )}

          {/* Compliance status */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">Your compliance status</h4>
              <span className="text-xs text-slate-400">
                {policy.compliance_progress?.completed || 0} of {policy.compliance_progress?.total || requirements.length} requirements met
              </span>
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

          {/* Chat */}
          <div>
            <h4 className="mb-2 text-sm font-semibold text-white">Ask about this policy</h4>
            <PolicyChat policyId={policy.id} policyName={policy.name} category={policy.category} />
          </div>

          {/* Actions */}
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
