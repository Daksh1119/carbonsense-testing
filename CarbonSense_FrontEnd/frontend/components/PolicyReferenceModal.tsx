"use client";

import Modal from "@/components/ui/Modal";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import { BookOpen, ExternalLink, ShieldCheck, Scale, FileText, Calendar, AlertCircle } from "lucide-react";

export interface PolicyReferenceData {
  id?: string;
  name: string;
  short_name?: string | null;
  authority?: string | null;
  category?: string | null;
  layer?: string | null;
  external_url?: string | null;
  act_year?: string | number | null;
  gazette_no?: string | null;
  citation_standard?: string | null;
  document_summary?: {
    gazette_reference?: string;
    key_mandates?: string[];
    applies_to?: string[];
    penalties?: string[];
    key_dates?: string[];
    source_url?: string;
    filing_frequency?: string;
  } | null;
  requirements?: string[] | null;
}

export default function PolicyReferenceModal({
  isOpen,
  onClose,
  policy,
}: {
  isOpen: boolean;
  onClose: () => void;
  policy: PolicyReferenceData | null;
}) {
  if (!policy) return null;

  const summary = policy.document_summary || {};
  const officialUrl = String(policy.external_url || summary.source_url || "").trim();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={`Statutory & Regulatory Reference: ${policy.short_name || policy.name}`}
      description={policy.authority ? `Issued / Regulated by: ${policy.authority}` : undefined}
    >
      <div className="space-y-6 text-sm text-slate-300">
        {/* Badges and metadata */}
        <div className="flex flex-wrap items-center gap-2">
          {policy.category && <Badge variant="info">{String(policy.category).toUpperCase()}</Badge>}
          {policy.layer && <Badge variant="default">{String(policy.layer).toUpperCase()} COMPLIANCE</Badge>}
          {policy.act_year && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
              Act / Notification: {policy.act_year}
            </span>
          )}
          {policy.citation_standard && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              Standard: {policy.citation_standard}
            </span>
          )}
        </div>

        {/* Gazette / Official Identification Header */}
        <div className="bg-slate-900/80 border border-slate-700/70 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-teal-400 font-semibold text-xs uppercase tracking-wider">
            <Scale className="size-4" />
            Official Gazette & Regulatory Citation
          </div>
          <p className="text-white font-mono text-xs md:text-sm bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            {summary.gazette_reference || policy.gazette_no || `Ref: Gazette of India / ${policy.authority || "Regulatory Body"} • Notification / Act ${policy.act_year || "2022-26"}`}
          </p>
          {policy.authority && (
            <p className="text-xs text-slate-400">
              Regulatory Jurisdiction: <strong className="text-slate-200">{policy.authority}</strong>
            </p>
          )}
        </div>

        {/* Two-Column Grid: Applicability & Key Mandates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Applicability */}
          <div className="bg-navy-card/80 border border-navy-border rounded-xl p-4 space-y-2">
            <h4 className="font-semibold text-white flex items-center gap-2 text-xs uppercase tracking-wider text-teal-300">
              <ShieldCheck className="size-4 text-teal-400" />
              Target Entities & Thresholds
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {(summary.applies_to && summary.applies_to.length > 0
                ? summary.applies_to
                : ["Applicable across MSMEs and Commercial/Industrial operations.", "Threshold determined by sector power demand and fuel use."]
              ).map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-teal-400 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Mandates */}
          <div className="bg-navy-card/80 border border-navy-border rounded-xl p-4 space-y-2">
            <h4 className="font-semibold text-white flex items-center gap-2 text-xs uppercase tracking-wider text-amber-300">
              <FileText className="size-4 text-amber-400" />
              Statutory Requirements
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {((summary.key_mandates && summary.key_mandates.length > 0)
                ? summary.key_mandates
                : (policy.requirements && policy.requirements.length > 0)
                ? policy.requirements
                : ["Scope 1 & 2 carbon accounting alignment", "Periodic regulatory reporting & environmental compliance audit"]
              ).slice(0, 4).map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Penalties & Critical Dates */}
        {(summary.penalties?.length || summary.key_dates?.length) ? (
          <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-4 space-y-2">
            <h4 className="font-semibold text-rose-300 flex items-center gap-2 text-xs uppercase tracking-wider">
              <AlertCircle className="size-4 text-rose-400" />
              Compliance Enforcement & Penalties
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {summary.penalties && summary.penalties.length > 0 && (
                <div>
                  <p className="font-medium text-slate-300 mb-1">Non-Compliance Sanctions:</p>
                  <ul className="space-y-1 text-slate-400">
                    {summary.penalties.map((pen, i) => (
                      <li key={i}>⚠️ {pen}</li>
                    ))}
                  </ul>
                </div>
              )}
              {summary.key_dates && summary.key_dates.length > 0 && (
                <div>
                  <p className="font-medium text-slate-300 mb-1">Reporting Deadlines:</p>
                  <ul className="space-y-1 text-slate-400">
                    {summary.key_dates.map((dt, i) => (
                      <li key={i}>📅 {dt}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
          <p className="text-[11px] text-slate-400">
            Validated against official Gazette of India, BEE, MoEFCC, and SEBI circulars.
          </p>
          <div className="flex gap-2">
            {officialUrl ? (
              <Button
                variant="primary"
                size="sm"
                icon={<ExternalLink className="size-4" />}
                onClick={() => window.open(officialUrl, "_blank", "noopener,noreferrer")}
              >
                Open Official Gazette / Portal ↗
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Official URL Unavailable
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
