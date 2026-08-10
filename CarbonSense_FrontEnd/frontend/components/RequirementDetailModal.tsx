"use client";

/**
 * RequirementDetailModal — Group 3C.4
 * Expanded from a read-only info panel to include:
 *  - Structured requirement metadata (badges, description, weight)
 *  - Requirement-scoped inline chat: asks the policy question with the
 *    requirement name pre-filled as context so the LLM answers are specific
 *    to this exact compliance task rather than the parent policy.
 */

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { askPolicyQuestion } from "@/lib/policy-compliance-api";
import { getCurrentUserContext } from "@/lib/recommendations-api";
import { MessageCircle, ChevronDown, ChevronUp } from "lucide-react";

// ---------------------------------------------------------------------------
// Inline scoped chat (requirement-level)
// ---------------------------------------------------------------------------

function RequirementChat({
  requirementName,
  policyId,
}: {
  requirementName: string;
  policyId?: string;
}) {
  const { organizationId } = getCurrentUserContext();
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const CHIPS = [
    `How do we meet "${requirementName}"?`,
    "What evidence proves this is done?",
    "What happens if we skip this?",
    "How long does this typically take?",
  ];

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const fullQuestion = `Regarding the compliance requirement "${requirementName}": ${text}`;
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    try {
      const response = await askPolicyQuestion({
        policyId,
        question: fullQuestion,
        organizationId: organizationId || undefined,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: response.answer || "No response." }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: err instanceof Error ? err.message : "Could not reach advisor." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-navy-border bg-navy-muted/20 p-3 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => send(chip)}
            disabled={loading}
            className="rounded-full border border-navy-border bg-navy-card px-2.5 py-1 text-[11px] text-slate-300 hover:border-teal-500 hover:text-teal-400 disabled:opacity-50 transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Message thread */}
      <div className="max-h-48 overflow-y-auto space-y-2 text-sm rounded-lg border border-navy-border/50 bg-background-dark p-3">
        {messages.length === 0 ? (
          <p className="text-slate-500 text-xs">Ask a question about this specific requirement.</p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={msg.role === "user" ? "text-right" : "text-left"}>
              {msg.role === "user" ? (
                <span className="inline-block rounded-lg bg-primary/20 px-3 py-1.5 text-white text-xs">{msg.content}</span>
              ) : (
                <div className="rounded-lg bg-slate-800 px-3 py-2 text-slate-200 text-xs leading-relaxed">
                  {msg.content}
                </div>
              )}
            </div>
          ))
        )}
        {loading && (
          <div className="text-left">
            <span className="inline-block rounded-lg bg-slate-800 px-3 py-1.5 text-slate-400 text-xs animate-pulse">
              Thinking…
            </span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
          placeholder={`Ask about "${requirementName}"…`}
          disabled={loading}
          className="flex-1 rounded-lg border border-navy-border bg-background-dark px-3 py-1.5 text-xs text-white outline-none focus:border-teal-500 disabled:opacity-50"
        />
        <Button size="sm" onClick={() => send(input)} disabled={loading || !input.trim()}>
          {loading ? "…" : "Ask"}
        </Button>
      </div>
      <p className="text-[10px] text-slate-500">Advisory only · Powered by Groq</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export default function RequirementDetailModal({
  isOpen,
  onClose,
  requirement,
  policyId,
}: {
  isOpen: boolean;
  onClose: () => void;
  requirement: Record<string, unknown> | null;
  policyId?: string;
}) {
  const [showChat, setShowChat] = useState(false);
  const reqName = String(requirement?.name || "Details");

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title={`Requirement: ${reqName}`}>
      {requirement ? (
        <div className="space-y-4 text-sm text-slate-300">
          {/* Metadata badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">{String(requirement.type || "data")}</Badge>
            <Badge variant="default">{String(requirement.level || "basic")}</Badge>
            <Badge variant={Boolean(requirement.is_mandatory) ? "danger" : "warning"}>
              {Boolean(requirement.is_mandatory) ? "Mandatory" : "Optional"}
            </Badge>
            {requirement.weight !== undefined && (
              <Badge variant="default">Weight: {String(requirement.weight)}</Badge>
            )}
          </div>

          {/* Description */}
          <p className="leading-relaxed">{String(requirement.description || "No description available.")}</p>

          {/* Verification method */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="rounded-lg bg-navy-muted/40 p-3">
              <p className="text-slate-500 mb-1">Verification Method</p>
              <p className="text-white font-medium">{String(requirement.verification_method || "Manual")}</p>
            </div>
            <div className="rounded-lg bg-navy-muted/40 p-3">
              <p className="text-slate-500 mb-1">Score Contribution</p>
              <p className="text-white font-medium">{String(requirement.weight || 0)} pts</p>
            </div>
          </div>

          {/* Group 3C.4 — requirement-scoped chat toggle */}
          <div className="pt-1">
            <button
              onClick={() => setShowChat((prev) => !prev)}
              className="flex items-center gap-2 text-xs text-teal-400 hover:text-teal-300 transition-colors font-medium"
            >
              <MessageCircle className="size-3.5" />
              {showChat ? "Hide" : "Ask AI about this requirement"}
              {showChat ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>

            {showChat && (
              <div className="mt-3">
                <RequirementChat
                  requirementName={reqName}
                  policyId={policyId}
                />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
