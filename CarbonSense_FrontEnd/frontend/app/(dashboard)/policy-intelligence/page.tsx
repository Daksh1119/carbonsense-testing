"use client";

import { useRouter } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import {
  AlertTriangle,
  FileText,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  ExternalLink,
  Shield,
} from "lucide-react";

const policyAlerts = [
  {
    title: "EU CSRD Compliance Report",
    deadline: "15 days remaining",
    urgency: "critical",
    description:
      "Corporate Sustainability Reporting Directive requires detailed emissions disclosure.",
    actions: [
      "Complete Scope 3 audit",
      "Prepare sustainability report",
      "Submit to regulatory body",
    ],
    status: "pending",
  },
  {
    title: "Quarterly Emissions Report",
    deadline: "45 days remaining",
    urgency: "warning",
    description:
      "National quarterly reporting mandate for manufacturing sector.",
    actions: [
      "Compile Q1 emissions data",
      "Internal review",
      "File report online",
    ],
    status: "in-progress",
  },
  {
    title: "Carbon Tax Assessment",
    deadline: "78 days remaining",
    urgency: "info",
    description:
      "Annual carbon tax calculation and payment for emissions above threshold.",
    actions: [
      "Calculate taxable emissions",
      "Review exemptions",
      "Submit payment",
    ],
    status: "pending",
  },
];

const fundingOpportunities = [
  {
    title: "DOE Clean Energy Grant",
    amount: "₹6.2M – ₹8.6M",
    eligibility: "Manufacturing sector with emissions > 500 tCO₂",
    deadline: "Application deadline: June 30, 2026",
    description:
      "Funding for renewable energy transition and carbon capture technologies.",
    ccus: true,
  },
  {
    title: "Private Offset Fund",
    amount: "Post-KYC Evaluation",
    eligibility: "Verified carbon reduction projects",
    deadline: "Rolling applications",
    description:
      "Private sector funding for tree planting and offset initiatives.",
    ccus: false,
  },
  {
    title: "Budget 2026 CCUS Incentive",
    amount: "₹10M – ₹25M",
    eligibility: "CCUS implementation projects",
    deadline: "Application deadline: September 15, 2026",
    description:
      "Government incentive for Carbon Capture, Utilization, and Storage projects.",
    ccus: true,
  },
];

const completedActions = [
  {
    title: "ISO 14064 Certification",
    completedDate: "Feb 15, 2026",
    verifier: "SGS India Pvt Ltd",
  },
  {
    title: "Annual Sustainability Report 2025",
    completedDate: "Jan 10, 2026",
    verifier: "Internal Audit Team",
  },
];

export default function PolicyIntelligencePage() {
  const router = useRouter();
  
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb />
      
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Policy Intelligence
          </h1>
          <p className="text-slate-400">
            AI-powered policy analysis and compliance tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BackButton href="/dashboard" label="Back" variant="outline" showIcon={false} />
          <Button variant="outline" icon={<Download className="size-4" />}>
            Export Compliance Report
          </Button>
        </div>
      </div>

      {/* CCUS Eligibility Banner */}
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
              Your organization qualifies for Carbon Capture, Utilization &
              Storage funding under India Budget 2026. Estimated funding range:{" "}
              <span className="font-bold text-primary">₹10M – ₹25M</span>
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

      {/* Policy Alerts Grid */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="size-5 text-rose-400" />
          Active Compliance Requirements
        </h2>
        <div className="grid grid-cols-1 gap-4">
          {policyAlerts.map((alert, index) => (
            <DashboardCard
              key={index}
              title={alert.title}
              subtitle={alert.description}
              className="hover:border-primary/30 transition-colors"
              headerAction={
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      alert.urgency === "critical"
                        ? "danger"
                        : alert.urgency === "warning"
                        ? "warning"
                        : "info"
                    }
                  >
                    {alert.urgency === "critical"
                      ? "CRITICAL"
                      : alert.urgency === "warning"
                      ? "WARNING"
                      : "INFO"}
                  </Badge>
                  <div className="flex items-center gap-1 text-slate-400">
                    <Clock className="size-4" />
                    <span className="text-xs font-medium">
                      {alert.deadline}
                    </span>
                  </div>
                </div>
              }
            >
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">
                    Required Actions:
                  </h4>
                  <div className="space-y-2">
                    {alert.actions.map((action, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 text-sm"
                      >
                        <div
                          className={`size-5 rounded border-2 flex items-center justify-center ${
                            alert.status === "in-progress" && idx === 0
                              ? "border-primary bg-primary/10"
                              : "border-navy-border bg-navy-muted"
                          }`}
                        >
                          {alert.status === "in-progress" && idx === 0 && (
                            <div className="size-2 bg-primary rounded-full"></div>
                          )}
                        </div>
                        <span className="text-slate-300">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm">
                    Mark as Complete
                  </Button>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </div>
            </DashboardCard>
          ))}
        </div>
      </div>

      {/* Funding Opportunities */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <DollarSign className="size-5 text-primary" />
          Funding Opportunities
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {fundingOpportunities.map((fund, index) => (
            <DashboardCard
              key={index}
              title={fund.title}
              subtitle={fund.description}
              className={
                fund.ccus ? "border-primary/30 bg-primary/5" : undefined
              }
              headerAction={
                fund.ccus && (
                  <Badge variant="info">CCUS Eligible</Badge>
                )
              }
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">
                      Funding Amount
                    </p>
                    <p className="text-lg font-bold text-primary">
                      {fund.amount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Deadline</p>
                    <p className="text-sm font-medium text-white">
                      {fund.deadline.replace("Application deadline: ", "")}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Eligibility</p>
                  <p className="text-sm text-slate-300">{fund.eligibility}</p>
                </div>
                <Button
                  variant={fund.ccus ? "primary" : "outline"}
                  size="sm"
                  className="w-full"
                >
                  Apply Now
                </Button>
              </div>
            </DashboardCard>
          ))}
        </div>
      </div>

      {/* Completed Actions */}
      <DashboardCard
        title="Completed Actions"
        subtitle="Audit trail of completed compliance activities"
        icon={<CheckCircle2 className="size-5 text-emerald-400" />}
      >
        <div className="space-y-3">
          {completedActions.map((action, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-emerald-400" />
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    {action.title}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Verified by: {action.verifier}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Completed</p>
                <p className="text-sm font-medium text-emerald-400">
                  {action.completedDate}
                </p>
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}
