# CarbonSense — Policy Intelligence & Compliance
## Full Implementation Plan

*India-Focused · SME-First · LLM-Assisted · Data-Verified*
*Version 1.0 · April 2026 · Confidential*

---

## Table of Contents

1. [Project Overview & Objectives](#1-project-overview--objectives)
2. [Current State Assessment](#2-current-state-assessment)
3. [Indian Policy Ecosystem — Complete Catalogue](#3-indian-policy-ecosystem--complete-catalogue)
4. [Compliance Framework — Six Categories](#4-compliance-framework--six-categories)
5. [Compliance Score Model](#5-compliance-score-model)
6. [Supabase Database Schema](#6-supabase-database-schema)
7. [Policy Intelligence Page — Redesign Plan](#7-policy-intelligence-page--redesign-plan)
8. [Compliance Page — Redesign Plan](#8-compliance-page--redesign-plan)
9. [LLM Integration — Groq vs OpenRouter](#9-llm-integration--groq-vs-openrouter)
10. [Backend API Endpoints](#10-backend-api-endpoints)
11. [Implementation Sequence](#11-implementation-sequence)
12. [Missing Policies — Additions](#12-missing-policies--additions-to-current-list)
13. [Final System Flow Summary](#13-final-system-flow-summary)

---

## 1. Project Overview & Objectives

CarbonSense is a carbon intelligence platform for SMEs and enterprises, combining emissions operations, AI-assisted analytics, OCR receipt processing, and the TEME (Tree-Emission Matching Engine). The Policy Intelligence and Compliance modules are currently implemented as static mock screens. This document provides a complete plan to transform them into a fully data-driven, LLM-assisted, India-specific compliance management system.

### Core Design Principle

The power of the system is NOT in the number of policies listed. It is in how well those policies are translated into measurable, verifiable checks. Every compliance requirement must be provable through data change, evidence upload, or OCR extraction — never by a user simply clicking "mark complete".

### Primary Target

| | |
|---|---|
| **Primary audience** | Small and Medium Enterprises (SMEs) across India |
| **Secondary audience** | Larger enterprises and listed companies |
| **Geographic focus** | India — regulatory and policy framework |
| **Guiding philosophy** | Reduction-first. Offsets as projected mitigation, not immediate neutralisation. |
| **Compliance model** | Data + Actions + Verification (not self-declaration) |

---

## 2. Current State Assessment

### What Is Already Built

- Next.js frontend with persistent sidebar, dark theme, teal/emerald design system
- FastAPI backend with ingestion, OCR, recommendations, and TEME endpoints
- Supabase persistence for emissions uploads, recommendation sessions, and TEME runs
- Policy Intelligence page: static UI with CCUS hero, compliance cards, funding grid, completed actions
- Compliance page: static KPI cards, task list with progress bars, deadline buckets
- Emissions ingestion engine (CSV + manual) with Scope 1/2/3 calculations
- OCR receipt processing pipeline — single and bulk
- Recommendation generation with LLM + heuristic fallback

### Key Gaps to Address

| Area | Current State | Target State |
|---|---|---|
| Policy data | Hardcoded arrays in page.tsx | Seeded Supabase table, API-driven |
| Compliance data | Static mock objects | Per-org results in Supabase |
| Score calculation | Not implemented | Weighted formula (40/40/20) |
| Verification | User self-declaration | Data change + evidence upload + OCR |
| LLM on policy page | Not present | Groq-powered policy explainer chat |
| LLM on compliance | Not present | Score improvement suggestions |
| Evidence upload | Not wired | OCR pipeline → compliance_results |
| Score history | Not present | Time-series snapshots in Supabase |

---

## 3. Indian Policy Ecosystem — Complete Catalogue

India's environmental policy landscape spans seven layers. The table below lists every policy relevant to CarbonSense, with implementation priority for the current build.

| Policy / Scheme | Authority | Layer | Priority | Applicability |
|---|---|---|---|---|
| Carbon Credit Trading Scheme (CCTS) | MoEFCC / BEE | Carbon market | Core | Large industry, future SME |
| National Action Plan on Climate Change (NAPCC) | PMO / MoEFCC | Climate | Background | All |
| PAT Scheme (Perform, Achieve, Trade) | Bureau of Energy Efficiency | Energy efficiency | Core | Manufacturing SMEs |
| Energy Conservation Act 2001 (amended 2022) | BEE | Energy | Core | All |
| UJALA / LED Programme | EESL | Energy | Optional | All |
| Solar Subsidy — Rooftop (MNRE) | Ministry of New & Renewable Energy | Renewable | Core | All SMEs |
| Renewable Purchase Obligation (RPO) | MNRE / SERCs | Renewable | Secondary | Large consumers |
| Renewable Energy Certificates (REC) | CERC | Renewable | Advanced | Large enterprises |
| BRSR (Business Responsibility & Sustainability) | SEBI | ESG reporting | Core | Listed cos; indirect SMEs |
| ESG Framework (GRI / GHG Protocol) | International | ESG | Core | All |
| Environmental Protection Act (EPA) 1986 | MoEFCC | Environmental | Core | All |
| Air (Prevention & Control of Pollution) Act | CPCB / SPCBs | Environmental | Core | Manufacturing |
| Water (Prevention & Control of Pollution) Act | CPCB | Environmental | Secondary | Manufacturing |
| Hazardous Waste Management Rules 2016 | MoEFCC | Waste | Core | Factories |
| Solid Waste Management Rules 2016 | MoEFCC | Waste | Core | All |
| Plastic Waste Management Rules 2022 | MoEFCC | Waste | Core | Restaurant, retail |
| E-Waste Management Rules 2022 | MoEFCC | Waste | Optional | IT sector |
| FAME Scheme (EV Policy) | Ministry of Heavy Industries | Transport | Core | Logistics SMEs |
| Bharat Stage Emission Norms (BS-VI) | MoRTH | Transport | Secondary | Fleet operators |
| ZED Certification (Zero Defect Zero Effect) | Quality Council of India | MSME | Core | Manufacturing SMEs |
| MSME Sustainable Finance Schemes | SIDBI / Ministry of MSME | MSME | Core | All SMEs |
| Credit Linked Capital Subsidy Scheme (CLCSS) | Ministry of MSME | MSME | Core | Manufacturing SMEs |
| National Green Hydrogen Mission | MNRE | Energy | Future | Manufacturing, large SMEs |
| Extended Producer Responsibility (EPR) | MoEFCC | Waste | Core | Packaged goods, electronics |
| MSME Green Rating Scheme | BIS / MoMSME | MSME | Core | All SMEs |
| ISO 14001 Alignment | ISO (via BIS in India) | Environmental | Secondary | Export-oriented SMEs |
| GHG Protocol Alignment | WRI / WBCSD | Reporting | Core | All (engine already uses this) |
| Carbon Border Adjustment Mechanism (CBAM) | European Union | Trade | Future | EU-exporting SMEs |
| BRSR Core (mandatory top 150 listed cos) | SEBI | ESG | Secondary | Listed companies |

---

## 4. Compliance Framework — Six Categories

In the CarbonSense system, compliance is modelled as three dimensions: **Data + Actions + Verification**. These are grouped across six regulatory categories, each broken into three implementation levels.

### A — Emission & Energy Compliance

- Energy Consumption Tracking — measure electricity usage (kWh)
- Fuel Consumption Tracking — diesel, petrol, LPG in litres
- Emission Calculation — Scope 1, 2, 3 per GHG Protocol (engine already does this)
- Energy Efficiency Improvement — reduce energy intensity per unit output (PAT Scheme)

### B — Waste Management Compliance

- Waste Quantity Tracking — kg/month by waste stream
- Waste Segregation — wet / dry / hazardous separation documented
- Proper Disposal — authorised vendor invoices uploaded
- Plastic Waste Compliance — single-use reduction metrics
- Hazardous Waste Handling — safe storage certificates and disposal records

### C — Environmental Regulatory Compliance

- Pollution Control Board (PCB) Registration — certificate upload
- Air Emission Standards — compliance with CPCB limits
- Water Pollution Compliance — wastewater treatment records (manufacturing)
- Environmental Clearance — where applicable by industry scale

### D — ESG & Reporting Compliance

- Emission Reporting — annual or periodic submission
- ESG Data Collection — energy, waste, emissions in structured format
- BRSR Reporting — required for listed companies; preparedness for SMEs
- GHG Protocol alignment — already implemented in emission engine

### E — Carbon & Market Compliance

- Carbon Intensity Tracking — CO2 per unit of output
- Carbon Credit Compliance (CCTS) — meet intensity targets or procure credits
- TEME integration — tree-based offset planning with projected, not verified, language

### F — Operational & Action Compliance *(CarbonSense Innovation)*

- Policy Action Tracking — steps completed per applied recommendation
- Evidence Submission — proof of action (invoices, certificates, photos)
- Verification — data-change or document-based, never self-declaration

### Three Implementation Levels

| Level | Target | Requirements |
|---|---|---|
| Level 1 — Basic | ALL SMEs | Energy tracked · Fuel tracked · Emissions calculated · Waste tracked · Waste segregated · ESG data basic |
| Level 2 — Industry-specific | Sector-dependent | Manufacturing: fuel, hazardous waste, pollution norms · Restaurant: food waste, LPG, plastic · Logistics: fuel usage, vehicle emissions |
| Level 3 — Action-based | Policy adopters | Policy applied · Steps progressed · Completion verified · Evidence uploaded |

---

## 5. Compliance Score Model

The compliance score is a weighted composite of three dimensions:

```
total_score = data_score + action_score + reporting_score
```

| Dimension | Weight | Formula | Max |
|---|---|---|---|
| Data compliance | 40% | completed data requirements / total data requirements × 40 | 40 |
| Action compliance | 40% | completed + verified action requirements / total × 40 | 40 |
| Reporting compliance | 20% | submitted reports / expected reports × 20 | 20 |
| **TOTAL** | **100%** | Sum of above three dimensions | **100** |

### Verification Rules — What Counts as Complete

A requirement only increments the score if the following conditions are met. User self-declaration is **never** accepted.

| Requirement type | Verification condition |
|---|---|
| Data type | The relevant metric (electricity kWh, fuel litres, waste kg) exists in org emissions data AND shows a measurable change from the previous period baseline |
| Action type | Evidence document has been uploaded AND optionally extracted via OCR to confirm the relevant metric or certificate number |
| Reporting type | A reporting artifact has been submitted with a recorded timestamp and linked to the correct period |

---

## 6. Supabase Database Schema

Five new tables are required. All existing emissions and recommendation tables remain unchanged.

### `policies` — Master Policy Catalogue

| Column | Type | Description |
|---|---|---|
| id | uuid PK | Primary key |
| name | text | Full policy name e.g. 'PAT Scheme' |
| short_name | text | Abbreviation e.g. 'PAT' |
| category | text | energy / renewable / waste / environmental / esg / carbon_market / transport / msme |
| layer | text | core / secondary / optional / future |
| description | text | Plain-language summary for display |
| authority | text | Governing body e.g. 'Bureau of Energy Efficiency' |
| applicability | text[] | sme / large_enterprise / manufacturing / restaurant / logistics / retail |
| requirements | text[] | What the policy mandates |
| benefits | text[] | Financial, legal, reputational benefits |
| is_active | boolean | Whether policy is current |
| effective_date | date | When policy came into force |
| review_date | date | Next review or expiry date |
| external_url | text | Link to official government source |
| created_at | timestamptz | Record creation timestamp |

### `compliance_requirements` — Individual Checks

| Column | Type | Description |
|---|---|---|
| id | uuid PK | Primary key |
| policy_id | uuid FK | References policies.id |
| name | text | e.g. 'Electricity consumption tracked' |
| type | text | data / action / reporting |
| level | text | basic / industry_specific / action_based |
| industry | text[] | Applicable industries |
| verification_method | text | data_change / evidence_upload / ocr_extract / manual |
| description | text | What the user must do |
| is_mandatory | boolean | Mandatory vs recommended |
| weight | numeric | Contribution to score calculation |

### `compliance_results` — Per-Org Status

| Column | Type | Description |
|---|---|---|
| id | uuid PK | Primary key |
| organization_id | uuid | Organisation reference |
| requirement_id | uuid FK | References compliance_requirements.id |
| status | text | not_started / in_progress / completed / overdue / verified |
| verified | boolean | True only after data or evidence confirmed |
| verification_source | text | data / evidence / ocr / llm |
| evidence_url | text | URL of uploaded proof document |
| data_snapshot | jsonb | Captured metric value at time of verification |
| score_contribution | numeric | Points this result contributes to total score |
| due_date | date | Deadline for this requirement |
| completed_at | timestamptz | When verified status was set |
| notes | text | Free-text notes or LLM extraction summary |
| updated_at | timestamptz | Last update timestamp |

### `compliance_score_history` — Time-Series Scores

| Column | Type | Description |
|---|---|---|
| id | uuid PK | Primary key |
| organization_id | uuid | Organisation reference |
| snapshot_date | date | Date of this score snapshot |
| data_score | numeric | Data dimension score (max 40) |
| action_score | numeric | Action dimension score (max 40) |
| reporting_score | numeric | Reporting dimension score (max 20) |
| total_score | numeric | Total score out of 100 |
| breakdown | jsonb | Per-category breakdown for chart rendering |

### `policy_interactions` — LLM Conversation Log

| Column | Type | Description |
|---|---|---|
| id | uuid PK | Primary key |
| organization_id | uuid | Organisation reference |
| policy_id | uuid FK | References policies.id (nullable for general questions) |
| user_question | text | What the user asked |
| llm_response | text | Response from Groq LLM |
| model_used | text | Model identifier e.g. 'llama-3.1-8b-instant' |
| created_at | timestamptz | Timestamp of interaction |

---

## 7. Policy Intelligence Page — Redesign Plan

The Policy Intelligence page transitions from a single static CCUS banner with hardcoded cards to a fully data-driven policy management experience. The dark UI, teal/emerald accents, and card layout are preserved.

### Section 1 — Policy Radar Grid

- Replaces the static CCUS hero banner
- Grid of policy cards filtered by the org's industry profile (stored in org settings)
- Each card shows: policy name, authority, category badge, applicability tags, status pill
- Status pill values: Applicable · Not Applicable · Future Readiness · In Progress · Compliant
- Filter controls: by category (Energy / Waste / ESG / Carbon / MSME / Transport)
- Search by policy name for quick access
- Clicking any card opens a detail drawer (Section 2)

### Section 2 — Policy Detail Drawer

- Slides in from the right, preserving grid context
- Shows: full policy description, authority, effective date, official source link
- Requirements list — what this policy mandates for the org
- Benefits list — financial, legal, and reputational benefits of compliance
- Current compliance status for this policy (progress bar across requirements)
- LLM Chat Panel — user asks questions, Groq responds in context
- Example questions surfaced as suggestions: 'Does this apply to us?', 'What should we do first?', 'What documents do we need?'
- All interactions logged to `policy_interactions` table

### Section 3 — Funding & Incentives Grid

- Retained from current design but made data-driven
- Sourced from `policies` table where benefits contains financial keywords
- Cards show: scheme name, amount/benefit, eligibility, deadline, apply CTA
- Key schemes: CLCSS, ZED certification subsidy, MNRE solar subsidy, MSME sustainable finance
- New addition: FAME EV subsidy for logistics SMEs

### Section 4 — Policy Action Tracker

- Bridge between Policy and Compliance pages
- For each applicable policy, shows `compliance_requirements` mapped to it
- Each requirement row shows: name, type badge, verification method, current status
- Quick action button routes to Compliance page with that requirement pre-highlighted
- Provides policy-centric view vs Compliance page's task-centric view

### Section 5 — Completed Policy Actions (Audit Trail)

- Retained from current design, made data-driven from `compliance_results`
- Filters to `verified = true` with `evidence_url` present
- Shows: requirement name, policy, completion date, verification source badge
- Exportable as PDF audit trail

---

## 8. Compliance Page — Redesign Plan

The Compliance page transitions from static KPI cards and mock task lists to a live compliance management dashboard backed by real Supabase data. The emerald/amber/rose status colour system and progress-centric design are preserved and extended.

### Section 1 — Score Dashboard

- Three animated score rings: Data (max 40) · Action (max 40) · Reporting (max 20)
- Total score prominently displayed with colour coding: ≥80 green · 50–79 amber · <50 red
- Sparkline chart below rings showing score trend from `compliance_score_history`
- Score breakdown tooltip showing per-category contribution
- LLM-generated one-line improvement tip (Groq call on page load, cached for 24h)

### Section 2 — Compliance by Level (Three Tabs)

- Tab 1 — Basic (all SMEs): energy, fuel, emission, waste, segregation, ESG data
- Tab 2 — Industry-specific: manufacturing / restaurant / logistics requirements
- Tab 3 — Action-based: requirements linked to applied policies and recommendations
- Each tab shows requirements as rows with: name, type badge, verification method, status pill
- Status colours: not_started grey · in_progress amber · completed green · overdue red · verified teal

### Section 3 — Active Tasks

- Pulled from `compliance_results` where status is `not_started` or `in_progress`
- Each task card shows: requirement name, parent policy, type badge, verification method, days to due date
- Context-aware action button:
  - Data type → 'View your emissions data' (links to Detailed Log filtered to relevant metric)
  - Action type → 'Upload evidence' (opens evidence upload panel)
  - Reporting type → 'Submit report' (opens reporting flow)
- Priority sorting: overdue first, then by days remaining ascending

### Section 4 — Evidence Upload Panel

- Triggered from 'Upload evidence' on any action-type requirement
- Accepts: PDF, JPG, PNG (invoices, certificates, utility bills, vendor receipts)
- Routes through existing OCR pipeline
- OCR extracts: relevant metric value, date, vendor/authority name, certificate number
- Extraction result shown to user for confirmation before saving
- On confirm: updates `compliance_results` with `verified=true`, `evidence_url`, `data_snapshot`, `verification_source='ocr'`
- LLM (Groq) reviews OCR output and flags if extracted data does not match requirement

### Section 5 — Completed & Verified (Audit Trail)

- Data-driven from `compliance_results` where `verified=true`
- Shows: requirement name, policy, verification source badge, completion date
- Evidence link opens uploaded document
- Exportable as signed audit trail PDF

### Section 6 — Upcoming Deadlines (Next 90 Days)

- Data-driven from `due_date` on `compliance_results`
- Grouped by month bucket (same as current design but real data)
- Status badges: on track / at risk / overdue
- Days remaining chip colour-coded: >30 green · 10–30 amber · <10 red

---

## 9. LLM Integration — Groq vs OpenRouter

### Recommendation: Use Groq

Groq is the correct choice for the Policy and Compliance LLM features. Here is the full comparison against OpenRouter:

| Factor | Groq | OpenRouter (free tier) |
|---|---|---|
| Speed | Fastest available (LPU hardware, ~500 tok/s) | Slower, routes through community models |
| Free tier | Generous — 14,400 req/day on llama-3.1-8b-instant | Free models vary, inconsistent availability |
| API compatibility | OpenAI-compatible (fits your existing abstraction) | OpenAI-compatible |
| Model quality | llama-3.1-8b-instant — excellent for explanation tasks | Model varies, less predictable quality |
| Latency UX | Chat panel feels responsive (<1s typical) | Higher latency breaks chat feel |
| Cost at scale | Very competitive paid tier | Aggregator markup |
| **Verdict** | **USE THIS for policy & compliance chat** | Keep as fallback for recommendation generation |

### Environment Configuration

Set these in your backend `.env` to activate Groq:

```env
LLM_PROVIDER=groq
LLM_API_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.1-8b-instant
LLM_API_KEY=your_groq_api_key_here
```

Your existing provider abstraction already supports OpenAI-compatible endpoints. No code changes are needed to the recommendation service — just update the env vars.

### LLM Roles — What It Does and Does NOT Do

**On the Policy Intelligence page:**
- Policy explainer — given the policy details + org profile, explains in plain language
- Applicability advisor — answers 'does this apply to our business?'
- Action suggester — 'what should we do first to comply with PAT Scheme?'
- Document interpreter — explains compliance certificates or regulatory notices

**On the Compliance page:**
- Score improvement — 'your data score is low because electricity tracking is missing, here is how to fix it'
- OCR verification assist — reads extracted text and confirms if it satisfies the requirement
- Gap analysis — identifies which requirements are closest to completion
- Plain-language compliance report generation

**What LLM must NEVER do:**
- Set `verified = true` directly — only the rule engine does this after data or evidence confirmation
- Override the score calculation — scores come from the database, not from LLM output
- Make legal determinations — it explains, suggests, and extracts; it does not certify compliance

### System Prompt Template for Policy Chat

Pass this context to Groq on every policy question:

```
You are a carbon compliance advisor for Indian SMEs.
Organisation industry: {industry}
Organisation size: {size}
Current emissions: {total_emissions} kgCO2e
Policy context: {policy_name} — {policy_description}
Policy requirements: {requirements_list}
Answer in plain language. Be specific and actionable.
Do not make legal determinations. Recommend consulting a CA or legal advisor for binding advice.
```

---

## 10. Backend API Endpoints

Add these FastAPI endpoints to the existing router group structure.

| Method | Endpoint | Description |
|---|---|---|
| GET | /compliance/requirements | List requirements filtered by org industry and level |
| GET | /compliance/results | Get org's compliance results with status and scores |
| POST | /compliance/results/{id}/verify | Trigger verification — checks data or saves evidence |
| POST | /compliance/score | Recalculate and persist score snapshot for org |
| GET | /compliance/score/history | Return time-series score data for trend chart |
| GET | /policies | List all active policies with optional category and industry filters |
| GET | /policies/{id} | Full policy detail including requirements and benefits |
| POST | /policies/ask | LLM chat — takes policy_id, org context, user question; returns Groq response |
| GET | /compliance/deadlines | Upcoming deadlines for org in next 90 days |
| POST | /compliance/evidence | Upload evidence document, run OCR, return extraction for confirmation |

Mount these under a new `/compliance` and `/policies` router group in `packages/ml_services/api/app.py`, consistent with the existing `/teme`, `/ocr`, `/recommendations`, and `/ingestion` groups.

---

## 11. Implementation Sequence

Follow this order strictly. Building UI on unstable data models creates expensive rework. Each phase has clear deliverables before the next phase starts.

### Phase 1 — Data Foundation

- Write and run Supabase migration for all five new tables
- Seed `policies` table with the full 29-policy catalogue from Section 3
- Seed `compliance_requirements` with all requirements mapped to policies
- Verify foreign key relationships and RLS policies
- **Deliverable:** populated database ready for API layer

### Phase 2 — Backend API Layer

- Create `/compliance` and `/policies` FastAPI router modules
- Implement all 10 endpoints from Section 10
- Add Groq client to existing LLM provider abstraction
- Wire `/policies/ask` to Groq with org-context system prompt
- Wire `/compliance/evidence` through existing OCR pipeline
- Add score calculation logic (40/40/20 formula)
- **Deliverable:** all endpoints tested via FastAPI /docs

### Phase 3 — Compliance Page

- Replace static KPI cards with live score rings from `/compliance/score`
- Replace static task list with `/compliance/results` data
- Implement three-tab level view (Basic / Industry / Action)
- Build evidence upload panel wired to `/compliance/evidence`
- Add score history sparkline from `/compliance/score/history`
- Add LLM improvement tip on page load (cached)
- **Deliverable:** fully data-driven compliance page

### Phase 4 — Policy Intelligence Page

- Replace static cards with policy grid from `/policies`
- Add industry and category filter controls
- Build policy detail drawer with full information
- Integrate LLM chat panel using `/policies/ask`
- Wire Funding section to policies with financial benefits
- Build Policy Action Tracker section
- **Deliverable:** fully data-driven policy page with LLM chat

### Phase 5 — Automation & Polish

- Add score snapshot trigger — record to `compliance_score_history` on each verification
- Add due date notification system — surface overdue items in dashboard
- Wire policy compliance status into executive dashboard policy snapshot widget
- Add export to PDF for audit trail (policy interactions + compliance results)
- Performance testing on Groq chat latency
- **Deliverable:** production-ready compliance management system

---

## 12. Missing Policies — Additions to Current List

The following policies were missing from the original framework document and should be added to the `policies` table. These are significant for SME completeness.

### National Green Hydrogen Mission

| | |
|---|---|
| **Authority / Source** | MNRE — 2023 |
| **Why it matters** | Core for large manufacturing SMEs. Green hydrogen as alternative fuel. Relevant for energy-intensive industries looking to decarbonise process heat. |
| **Applies to** | Manufacturing, large SMEs |

### Extended Producer Responsibility (EPR)

| | |
|---|---|
| **Authority / Source** | MoEFCC — Plastic Waste Rules 2022 |
| **Why it matters** | Mandatory for ANY SME that manufactures packaged goods, electronics, or uses plastic packaging. Requires take-back programmes and reporting to CPCB. |
| **Applies to** | All packaged goods manufacturers, electronics |

### MSME Green Rating Scheme

| | |
|---|---|
| **Authority / Source** | BIS / Ministry of MSME |
| **Why it matters** | Government sustainability rating that provides access to green financing, preferential procurement, and export credentials. Highly relevant for export-oriented SMEs. |
| **Applies to** | All SMEs |

### ISO 14001 Environmental Management

| | |
|---|---|
| **Authority / Source** | ISO (via BIS in India) |
| **Why it matters** | Not a law but practically mandatory for export-oriented SMEs and often a procurement prerequisite. Shows systematic environmental management. |
| **Applies to** | Export-oriented SMEs |

### GHG Protocol Alignment (formalised)

| | |
|---|---|
| **Authority / Source** | WRI / WBCSD |
| **Why it matters** | Your engine already uses this. Surface it explicitly as a compliance item to add credibility and align with BRSR reporting requirements. |
| **Applies to** | All (engine already implements this) |

### CBAM — Carbon Border Adjustment Mechanism

| | |
|---|---|
| **Authority / Source** | European Union (external) |
| **Why it matters** | Future-readiness item for any SME exporting to Europe. EU will charge carbon tariffs from 2026 on products from countries without carbon pricing. |
| **Applies to** | EU-exporting SMEs |

### BRSR Core (top 150 listed companies)

| | |
|---|---|
| **Authority / Source** | SEBI — mandatory from FY2024-25 |
| **Why it matters** | More stringent than standard BRSR. Mandatory assurance of ESG data. Important if any CarbonSense clients are listed companies. |
| **Applies to** | Listed companies |

### Pollution Control Board Consent to Operate

| | |
|---|---|
| **Authority / Source** | State PCBs |
| **Why it matters** | Consent to Establish (CTE) and Consent to Operate (CTO) are legally required for any manufacturing unit. Renewal tracking is a compliance management opportunity. |
| **Applies to** | All manufacturing SMEs |

---

## 13. Final System Flow Summary

The end-to-end compliance system flow across all components:

| Stage | Description |
|---|---|
| **Data Input** | CSV ingestion / manual entry / OCR receipts / evidence uploads feed into the emission calculation engine |
| **Emission Calculation** | GHG Protocol engine computes Scope 1, 2, 3 totals, category breakdown, and KPI snapshots |
| **Policy Matching** | Org industry profile and emission footprint are matched against the `policies` table to identify applicable policies |
| **Compliance Checks** | Three check types run: Data (metrics present and changed), Action (steps completed), Reporting (submissions made) |
| **Verification Engine** | Rule engine validates each check — data change vs baseline, OCR extraction confirmation, report submission timestamp |
| **LLM Assist (Groq)** | Explains requirements, suggests improvements, extracts metrics from OCR output — never sets verified status directly |
| **Score Calculation** | data_score (40) + action_score (40) + reporting_score (20) = total out of 100, persisted to score history |
| **Recommendations + TEME** | Score gaps feed into the recommendation engine. TEME provides offset planning for residual emissions after reduction actions |

---

*Built with scientific rigor. No greenwashing. Reduction-first, always.*

*CarbonSense — Policy & Compliance Implementation Plan v1.0 · April 2026*
