"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardCard from "@/components/DashboardCard";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import PolicyDrawer from "@/components/PolicyDrawer";
import ApplyNowModal from "@/components/ApplyNowModal";
import FundingModal from "@/components/FundingModal";
import ReadPolicyModal from "@/components/ReadPolicyModal";
import PolicyReferenceModal from "@/components/PolicyReferenceModal";
import { Breadcrumb, BackButton } from "@/components/navigation";
import {
  fetchBenchmark,
  fetchComplianceResults,
  fetchImpactSummary,
  fetchPolicies,
  fetchTopActions,
  fetchPolicyAdoptions,
  upsertPolicyAdoption,
  type PolicyRecord,
  type TopActionRecord,
  type PolicyAdoptionRecord,
  type PolicyAdoptionStatus,
} from "@/lib/policy-compliance-api";
import { getCurrentUserContext } from "@/lib/recommendations-api";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  ExternalLink,
  Shield,
  PlayCircle,
  XCircle,
  Info,
  BookOpen,
  Scale,
} from "lucide-react";

function formatDate(value?: string | null): string {
  if (!value) return "TBD";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "TBD";
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function urgencyFromLayer(layer?: string | null): "critical" | "warning" | "info" {
  const l = (layer || "").toLowerCase();
  if (l === "mandatory") return "critical";
  if (l === "voluntary") return "warning";
  return "info";
}

function actionToFunding(action: TopActionRecord) {
  const min = Math.max(0, action.rupee_impact_estimate * 0.6);
  const max = Math.max(min, action.rupee_impact_estimate * 1.15);
  return {
    title: action.name,
    amount: `₹${Math.round(min).toLocaleString("en-IN")} – ₹${Math.round(max).toLocaleString("en-IN")}`,
    eligibility: `${action.type.toUpperCase()} requirement (${action.level.toUpperCase()})`,
    deadline: "Action window: next compliance cycle",
    description: action.description || "High-impact compliance action",
    ccus: action.type === "action",
  };
}

export default function PolicyIntelligencePage() {
  const { organizationId, userId } = getCurrentUserContext();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [topActions, setTopActions] = useState<TopActionRecord[]>([]);
  const [complianceResults, setComplianceResults] = useState<Array<{ id: string; requirement_id: string }>>([]);
  const [impact, setImpact] = useState<{ unlocked: number; pipeline: number; unlockedCo2: number }>({
    unlocked: 0,
    pipeline: 0,
    unlockedCo2: 0,
  });
  const [benchmark, setBenchmark] = useState<{ percentile: number; delta: number }>({
    percentile: 50,
    delta: 0,
  });
  const [completedActions, setCompletedActions] = useState<Array<{ title: string; completedDate: string; verifier: string }>>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [fundingOpen, setFundingOpen] = useState(false);
  const [readOpen, setReadOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [showAllPolicies, setShowAllPolicies] = useState(false);
  const [showAllFunding, setShowAllFunding] = useState(false);
  // Group 3B.3 — adoption tracking
  const [adoptions, setAdoptions] = useState<Record<string, PolicyAdoptionStatus>>({});
  const [adoptionUpdating, setAdoptionUpdating] = useState<Set<string>>(new Set());

  const resultIdByRequirementId = useMemo(() => {
    return complianceResults.reduce<Record<string, string>>((map, result) => {
      map[result.requirement_id] = result.id;
      return map;
    }, {});
  }, [complianceResults]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [policyRows, actionRows, impactSummary, benchmarkSummary, results] = await Promise.all([
          fetchPolicies({ activeOnly: true, organizationId, industry: "manufacturing", size: "sme", totalEmissionsKg: 0 }),
          fetchTopActions(3),
          fetchImpactSummary(),
          fetchBenchmark("sme"),
          fetchComplianceResults(),
        ]);

        if (!isMounted) return;
        setPolicies(policyRows);
        setTopActions(actionRows);
        setComplianceResults(results.map((row) => ({ id: row.id, requirement_id: row.requirement_id })));
        setImpact({
          unlocked: impactSummary.unlocked_rupees_estimate || 0,
          pipeline: impactSummary.pipeline_rupees_estimate || 0,
          unlockedCo2: impactSummary.unlocked_co2_kg_estimate || 0,
        });
        setBenchmark({
          percentile: benchmarkSummary.estimated_percentile || 50,
          delta: benchmarkSummary.delta_vs_baseline || 0,
        });

        const completed = results
          .filter((r) => r.status === "completed" || r.status === "verified")
          .slice(0, 5)
          .map((r) => ({
            title: r.requirement?.name || "Compliance task",
            completedDate: formatDate(r.completed_at),
            verifier: r.verified ? "Verified" : "Completed",
          }));
        setCompletedActions(completed);

        // Group 3B.3 — load policy adoptions
        if (organizationId) {
          try {
            const adoptionRows: PolicyAdoptionRecord[] = await fetchPolicyAdoptions(organizationId);
            const map: Record<string, PolicyAdoptionStatus> = {};
            adoptionRows.forEach((r) => { map[r.policy_id] = r.status; });
            setAdoptions(map);
          } catch { /* non-fatal */ }
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load policy intelligence data");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [organizationId]);

  // Adoption update handler
  async function handleAdoptionUpdate(policyId: string, newStatus: PolicyAdoptionStatus) {
    if (!organizationId || !userId) return;
    setAdoptionUpdating((prev) => new Set(prev).add(policyId));
    try {
      await upsertPolicyAdoption(organizationId, policyId, newStatus, userId);
      setAdoptions((prev) => ({ ...prev, [policyId]: newStatus }));
    } catch { /* non-fatal */ }
    finally {
      setAdoptionUpdating((prev) => { const s = new Set(prev); s.delete(policyId); return s; });
    }
  }

  const policyAlerts = useMemo(() => {
    const terms = search.trim().toLowerCase();
    return [...policies]
      .filter((policy) => {
        const category = categoryFilter === "All" ? true : String(policy.category || "").toLowerCase() === categoryFilter.toLowerCase();
        if (!category) return false;
        if (!terms) return true;
        const haystack = [policy.name, policy.short_name, policy.authority, policy.match_reason].join(" ").toLowerCase();
        return haystack.includes(terms);
      })
      .sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
  }, [policies, search, categoryFilter]);

  const fundingOpportunities = useMemo(() => {
    return [...policies]
      .filter((policy) => policy.funding)
      .sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
  }, [policies]);

  const policyLimit = 8;
  const fundingLimit = 8;

  const visiblePolicyAlerts = useMemo(() => {
    return showAllPolicies ? policyAlerts : policyAlerts.slice(0, policyLimit);
  }, [policyAlerts, showAllPolicies]);

  const visibleFunding = useMemo(() => {
    return showAllFunding ? fundingOpportunities : fundingOpportunities.slice(0, fundingLimit);
  }, [fundingOpportunities, showAllFunding]);

  const openPolicy = (policy: PolicyRecord) => {
    setSelectedPolicy(policy);
    setDrawerOpen(true);
  };

  const openApply = (policy: PolicyRecord) => {
    setSelectedPolicy(policy);
    setApplyOpen(true);
  };

  const openFunding = (policy: PolicyRecord) => {
    setSelectedPolicy(policy);
    setFundingOpen(true);
  };

  const openRead = (policy: PolicyRecord) => {
    setSelectedPolicy(policy);
    setReadOpen(true);
  };

  const openReference = (policy: PolicyRecord) => {
    setSelectedPolicy(policy);
    setReferenceOpen(true);
  };
  
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb />
      
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Policy Intelligence & Regulatory References
          </h1>
          <p className="text-slate-400">
            Official Gazette citations, policy mandates, statutory thresholds, and compliance tracking
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="outline"
            icon={<Scale className="size-4 text-teal-400" />}
            onClick={() => {
              if (policies.length > 0) {
                openReference(policies[0]);
              }
            }}
          >
            Policy Citations
          </Button>
          <BackButton href="/dashboard" label="Back" variant="outline" showIcon={false} />
          <Button variant="outline" icon={<Download className="size-4" />}>
            Export Compliance Report
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Live policy intelligence data is unavailable right now. Existing UI remains usable while services recover.
        </div>
      ) : null}

      {/* Score / summary banner */}
      <div className="bg-gradient-to-r from-primary/20 to-emerald-500/20 border-2 border-primary/30 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary rounded-lg">
            <Shield className="size-6 text-background-dark" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-bold text-white">CCUS Eligible</h3>
              <Badge variant="success">Budget 2026</Badge>
            </div>
            <p className="text-slate-300 text-sm mb-3">
              Estimated unlocked impact: {" "}
              <span className="font-bold text-primary">₹{Math.round(impact.unlocked).toLocaleString("en-IN")}</span>
              {" "}| pipeline: {" "}
              <span className="font-bold text-primary">₹{Math.round(impact.pipeline).toLocaleString("en-IN")}</span>
              {" "}| benchmark percentile: {" "}
              <span className="font-bold text-primary">P{benchmark.percentile}</span>
            </p>
            <div className="flex items-center gap-3">
              <Button variant="primary" size="sm">
                View Funding Details
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<ExternalLink className="size-4" />}
              >
                Read Policy Document
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-navy-border bg-navy-muted/20 p-4">
        {['All', 'energy', 'waste', 'esg', 'msme', 'environmental', 'transport'].map((category) => (
          <button key={category} onClick={() => setCategoryFilter(category)} className={`rounded-full px-4 py-2 text-sm ${categoryFilter === category ? 'bg-primary text-background-dark' : 'bg-navy-muted text-slate-300'}`}>
            {category === 'All' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1)}
          </button>
        ))}
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search policies, authority, or reason..." className="ml-auto min-w-[260px] rounded-lg border border-navy-border bg-background-dark px-3 py-2 text-sm text-white outline-none" />
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-bold text-white"><AlertTriangle className="size-5 text-rose-400" />Policy Radar</h2>
          {policyAlerts.length > policyLimit ? (
            <Button size="sm" variant="outline" onClick={() => setShowAllPolicies((value) => !value)}>
              {showAllPolicies ? `Show Top ${policyLimit}` : `Show All (${policyAlerts.length})`}
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visiblePolicyAlerts.map((policy) => {
            const adoptionStatus: PolicyAdoptionStatus = adoptions[policy.id] ?? 'not_started';
            const isAdopting = adoptionUpdating.has(policy.id);
            const ADOPTION_OPTIONS: { value: PolicyAdoptionStatus; label: string; color: string }[] = [
              { value: 'not_started',    label: 'Not Started',     color: 'text-slate-400' },
              { value: 'in_progress',    label: 'In Progress',     color: 'text-amber-400' },
              { value: 'adopted',        label: 'Adopted ✓',       color: 'text-emerald-400' },
              { value: 'not_applicable', label: 'Not Applicable',  color: 'text-slate-500' },
            ];
            return (
              <DashboardCard key={policy.id} title={policy.short_name || policy.name} subtitle={policy.description || policy.match_reason || 'Policy detail'} className="hover:border-primary/30 transition-colors" headerAction={<div className="flex flex-wrap items-center gap-2"><Badge variant="info">Match {Math.round(policy.match_score || 0)}%</Badge><Badge variant="default">{String(policy.category || 'General').toUpperCase()}</Badge><Badge variant={String(policy.layer || 'core') === 'core' ? 'success' : 'warning'}>{String(policy.layer || 'core').toUpperCase()}</Badge></div>}>
                <div className="space-y-4">
                  <div className="rounded-lg bg-navy-muted/40 p-3 text-sm text-slate-300">{policy.match_reason || 'Matched to your organization profile.'}</div>
                  <div className="h-2 rounded-full bg-navy-border">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(8, Math.min(100, policy.match_score || 0))}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400"><span>Status: {policy.status || 'Applicable'}</span><span>{policy.compliance_progress?.completed || 0} / {policy.compliance_progress?.total || policy.requirements?.length || 0} complete</span></div>

                  {/* Group 3B.3 — adoption status control */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      Your adoption status
                      <span className="relative group">
                        <Info className="size-3 text-slate-600 hover:text-teal-400 cursor-help" />
                        <span className="absolute left-4 top-0 z-50 hidden group-hover:block w-52 bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-300 shadow-xl">
                          Marking a policy as &ldquo;Adopted&rdquo; raises your Compliance Action Score.
                        </span>
                      </span>
                    </span>
                    <select
                      value={adoptionStatus}
                      disabled={isAdopting}
                      onChange={(e) => handleAdoptionUpdate(policy.id, e.target.value as PolicyAdoptionStatus)}
                      className={`text-xs px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:border-teal-500 transition-colors disabled:opacity-50 ${
                        adoptionStatus === 'adopted' ? 'text-emerald-400' :
                        adoptionStatus === 'in_progress' ? 'text-amber-400' :
                        adoptionStatus === 'not_applicable' ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      {ADOPTION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => openPolicy(policy)}>View Details</Button>
                    <Button size="sm" variant="outline" onClick={() => openReference(policy)}>Statutory Ref</Button>
                    <Button size="sm" variant="outline" onClick={() => openApply(policy)}>Apply Now</Button>
                    <Button size="sm" variant="ghost" onClick={() => openRead(policy)}>Read Policy</Button>
                    <Button size="sm" variant="outline" onClick={() => openFunding(policy)}>View Funding</Button>
                  </div>
                </div>
              </DashboardCard>
            );
          })}
          {!isLoading && policyAlerts.length === 0 ? <p className="text-sm text-slate-400">No policies returned for the current filter.</p> : null}
        </div>
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-bold text-white"><DollarSign className="size-5 text-primary" />Funding Opportunities</h2>
          {fundingOpportunities.length > fundingLimit ? (
            <Button size="sm" variant="outline" onClick={() => setShowAllFunding((value) => !value)}>
              {showAllFunding ? `Show Top ${fundingLimit}` : `Show All (${fundingOpportunities.length})`}
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {visibleFunding.map((policy, index) => {
            const funding = policy.funding as Record<string, unknown> | undefined;
            return (
              <DashboardCard key={policy.id} title={String(funding?.scheme_name || policy.name)} subtitle={String(funding?.eligibility || 'Financial and incentive readiness')} className={index < 3 ? 'border-primary/30 bg-primary/5' : undefined} headerAction={index < 3 ? <Badge variant="info">Best Match</Badge> : undefined}>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-4"><div><p className="mb-1 text-xs text-slate-400">Funding Amount</p><p className="text-lg font-bold text-primary">{String(funding?.amount || 'TBD')}</p></div><div><p className="mb-1 text-xs text-slate-400">Deadline</p><p className="text-sm font-medium text-white">{String(funding?.deadline || 'Rolling')}</p></div></div>
                  <div><p className="mb-1 text-xs text-slate-400">Eligibility</p><p className="text-slate-300">{String(funding?.eligibility || 'Organization-specific')}</p></div>
                  <Button variant="primary" size="sm" className="w-full" onClick={() => openFunding(policy)}>View Funding →</Button>
                </div>
              </DashboardCard>
            );
          })}
        </div>
      </div>

      <DashboardCard title="Policy Action Tracker" subtitle="Bridge policy browsing to compliance workflow" icon={<CheckCircle2 className="size-5 text-emerald-400" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-400"><tr><th className="py-2">Policy Name</th><th>Requirement</th><th>Type</th><th>Verification Method</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {policyAlerts.flatMap((policy) => (policy.requirements || []).slice(0, 1).map((requirement, index) => (
                <tr key={`${policy.id}-${index}`} className="border-t border-navy-border/60">
                  <td className="py-3 text-white">{policy.short_name || policy.name}</td>
                  <td>{requirement}</td>
                  <td><Badge variant="default">Requirement</Badge></td>
                  <td><Badge variant="info">Evidence</Badge></td>
                  <td>{policy.status || 'Applicable'}</td>
                  <td><Button size="sm" variant="outline" onClick={() => openApply(policy)}>{(policy.compliance_progress?.completed || 0) > 0 ? 'Continue →' : 'Start →'}</Button></td>
                </tr>
              )))
              }
            </tbody>
          </table>
        </div>
      </DashboardCard>

      <PolicyDrawer policyId={selectedPolicy?.id || null} open={drawerOpen} onClose={() => setDrawerOpen(false)} onApplyNow={openApply} onReadDocument={openRead} onViewFunding={openFunding} />
      <ApplyNowModal isOpen={applyOpen} onClose={() => setApplyOpen(false)} policy={selectedPolicy ? { id: selectedPolicy.id, name: selectedPolicy.name, steps: selectedPolicy.steps } : null} resultIdByRequirementId={resultIdByRequirementId} />
      <FundingModal isOpen={fundingOpen} onClose={() => setFundingOpen(false)} policy={selectedPolicy ? { id: selectedPolicy.id, name: selectedPolicy.name, funding: selectedPolicy.funding } : null} />
      <ReadPolicyModal isOpen={readOpen} onClose={() => setReadOpen(false)} policy={selectedPolicy ? { name: selectedPolicy.name, external_url: selectedPolicy.external_url, document_summary: selectedPolicy.document_summary } : null} />
      <PolicyReferenceModal isOpen={referenceOpen} onClose={() => setReferenceOpen(false)} policy={selectedPolicy} />
    </div>
  );
}
