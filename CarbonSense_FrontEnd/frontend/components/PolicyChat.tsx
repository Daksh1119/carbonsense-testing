"use client";

/**
 * PolicyChat — Group 3B.4
 * Enriches the /policies/ask request with live org context:
 * sector, company size, and total emissions so the LLM answer
 * is tailored to this specific organisation rather than generic.
 */

import { useMemo, useState } from "react";
import Button from "@/components/Button";
import { askPolicyQuestion } from "@/lib/policy-compliance-api";
import { getCurrentUserContext } from "@/lib/recommendations-api";
import { supabase } from "@/lib/supabaseClient";

const SECTION_HEADERS = [
  "Applicability",
  "What to do this week",
  "What evidence to keep",
  "Risks if ignored",
];

function cleanLine(value: string): string {
  return value
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^##\s+/, "")
    .replace(/^\*\*(.*?)\*\*:?\s*/, "$1 ")
    .trim();
}

function parseStructuredAssistantMessage(content: string): Array<{ title: string; bullets: string[] }> {
  const lines = String(content || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const sections = SECTION_HEADERS.map((title) => ({ title, bullets: [] as string[] }));
  let activeIndex = -1;

  for (const rawLine of lines) {
    const line = rawLine.replace(/^##\s+/, "").replace(/\*\*/g, "").replace(/:$/, "").trim();
    const matchedIndex = SECTION_HEADERS.findIndex((header) => line.toLowerCase() === header.toLowerCase());

    if (matchedIndex >= 0) {
      activeIndex = matchedIndex;
      continue;
    }

    const cleaned = cleanLine(rawLine);
    if (!cleaned) continue;

    if (activeIndex >= 0) {
      sections[activeIndex].bullets.push(cleaned);
    }
  }

  const withContent = sections.filter((section) => section.bullets.length > 0);
  if (withContent.length > 0) return withContent;

  return [{ title: "Response", bullets: lines.map(cleanLine).filter(Boolean) }];
}

// ---------------------------------------------------------------------------
// Group 3B.4 — fetch org context once for enrichment
// ---------------------------------------------------------------------------

async function fetchOrgContext(organizationId: string) {
  try {
    const { data } = await supabase
      .from("organizations")
      .select("sector, company_size_category, industry, name")
      .eq("id", organizationId)
      .single();

    // Pull latest cycle emissions for context
    const { data: cycleData } = await supabase
      .from("assessment_cycles")
      .select("total_emissions_kg")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return {
      sector: data?.sector || data?.industry || "manufacturing",
      size: data?.company_size_category || "sme",
      totalEmissionsKg: cycleData?.total_emissions_kg ?? 0,
      orgName: data?.name,
    };
  } catch {
    return { sector: "manufacturing", size: "sme", totalEmissionsKg: 0, orgName: undefined };
  }
}

export default function PolicyChat({
  policyId,
  policyName,
  category,
}: {
  policyId?: string;
  policyName: string;
  category?: string | null;
}) {
  const { organizationId } = getCurrentUserContext();
  const [messages, setMessages] = useState<Array<{ role: "assistant" | "user"; content: string }>>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  const chips = useMemo(() => {
    const group = String(category || "").toLowerCase();
    if (group === "waste") return ["What documents do we need?", "Do we need a vendor tie-up?", "What are our EPR targets?"];
    if (group === "msme") return ["What subsidies can we get?", "How do we apply?", "What's the timeline?"];
    return ["Does this apply to us?", "What do we do first?", "What documents do we need?", "What are the fines?"];
  }, [category]);

  const sendQuestion = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setMessages((current) => [...current, { role: "user", content: text }]);
    setQuestion("");
    try {
      // Group 3B.4 — enrich with live org context before calling the LLM
      let orgContext = { sector: "manufacturing", size: "sme", totalEmissionsKg: 0 };
      if (organizationId) {
        orgContext = await fetchOrgContext(organizationId);
      }

      const response = await askPolicyQuestion({
        policyId,
        question: text,
        organizationId: organizationId || undefined,
        industry: orgContext.sector,
        organizationSize: orgContext.size,
        totalEmissionsKg: orgContext.totalEmissionsKg,
      });
      setMessages((current) => [...current, { role: "assistant", content: response.answer || "No response returned." }]);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "Could not reach advisor." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-navy-border bg-navy-muted/30 p-4">
      {/* Context enrichment notice */}
      {organizationId && (
        <p className="text-[11px] text-teal-500/70">
          ✦ Answers are tailored to your organisation&apos;s sector, size, and emissions footprint.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button key={chip} onClick={() => sendQuestion(chip)} className="rounded-full border border-navy-border bg-navy-card px-3 py-1 text-xs text-slate-200 hover:border-primary hover:text-primary">
            {chip}
          </button>
        ))}
      </div>
      <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-navy-border bg-background-dark p-3 text-sm">
        {messages.length === 0 ? (
          <p className="text-slate-400">Ask about {policyName}. Responses are advisory, not legal advice.</p>
        ) : messages.map((message, index) => (
          <div key={index} className={message.role === "user" ? "text-right" : "text-left"}>
            {message.role === "user" ? (
              <span className="inline-block rounded-lg bg-primary/20 px-3 py-2 text-white">
                {message.content}
              </span>
            ) : (
              <div className="rounded-lg bg-navy-muted px-3 py-3 text-slate-100">
                <div className="space-y-3 text-sm">
                  {parseStructuredAssistantMessage(message.content).map((section) => (
                    <div key={`${index}-${section.title}`}>
                      <p className="mb-1 font-semibold text-white">{section.title}</p>
                      <ul className="list-disc space-y-1 pl-5 text-slate-200">
                        {section.bullets.map((bullet, bulletIndex) => (
                          <li key={`${index}-${section.title}-${bulletIndex}`}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") sendQuestion(question); }}
          placeholder="Type your question..."
          className="flex-1 rounded-lg border border-navy-border bg-background-dark px-3 py-2 text-sm text-white outline-none focus:border-primary"
        />
        <Button onClick={() => sendQuestion(question)} size="sm" disabled={loading}>
          {loading ? "Sending..." : "Send"}
        </Button>
      </div>
      <p className="text-[11px] text-slate-400">Powered by Groq · Responses are advisory, not legal advice</p>
    </div>
  );
}
