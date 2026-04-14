# CarbonSense — Policy & Compliance Page Enhancement Specification

**Version:** 2.0  
**Date:** April 2026  
**Status:** Implementation Ready  
**Scope:** Policy Intelligence Page + Compliance Page + Dashboard Sync

---

## Overview

This document specifies every enhancement required to make the Policy Intelligence and Compliance pages fully interactive, data-driven, and genuinely useful. All static/mock elements are to be replaced with live API-backed data. Every button must do something meaningful. The guiding principle remains: **verification over self-declaration, reduction over offsetting, actionable over decorative.**

The changes are organised by page section and button, with exact expected behaviour, API endpoints, component changes, and UX notes for each.

---

## Part 1 — Dashboard Sync

The executive dashboard already has a "Policy Snapshot" widget and quick-action cards. These currently show static counts. The following changes are required to make dashboard state reflect real compliance and policy data.

### 1.1 Policy Snapshot Widget

**File:** `app/(dashboard)/dashboard/page.tsx`  
**Hook:** `hooks/useDashboardData.ts`

**Current state:** Static counts like "3 active policies", "2 alerts".

**Required changes:**

- Call `GET /compliance/score` on dashboard load and surface:
  - Total compliance score (e.g. "62/100") with colour coding — green ≥80, amber 50–79, red <50
  - Data score, Action score, Reporting score as three small sub-indicators
- Call `GET /compliance/deadlines` and show count of requirements due in next 30 days
- Call `GET /policies?status=applicable` and show count of applicable policies
- If any requirement is `overdue`, show a red alert chip: "N overdue — act now" linking to `/compliance`

**Score ring component (reusable):**

Create `components/ScoreRing.tsx` — an SVG ring with animated fill, label, and sub-label. Props: `value`, `max`, `label`, `color`. Use this on both the dashboard widget and the Compliance page score section. Avoids duplicating SVG logic.

**Dashboard quick actions:**

The quick-action buttons ("View Policy", "Check Compliance") should deep-link:
- "View Policy" → `/policy-intelligence`
- "Check Compliance" → `/compliance`
- Add a new quick action: "Upload Evidence" → `/compliance?action=upload` (opens the evidence panel directly)

---

## Part 2 — Policy Intelligence Page

**File:** `app/(dashboard)/policy-intelligence/page.tsx`

### 2.1 Policy Radar Grid — Show 5+ Cards, No Limit

**Current state:** 3 hardcoded cards. Grid is static.

**Required changes:**

- Remove the hardcoded array. Fetch from `GET /policies?industry={orgIndustry}&category=all`
- Render **all** returned policies — do not cap at 3 or any fixed number
- Default sort: by `match_score` descending (highest relevance first)
- Grid: `grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))` — responsive, fills available width
- Each card must show:
  - Policy name + authority
  - Category badge (colour-coded: Energy=blue, Waste=green, ESG=purple, MSME=amber, Environmental=teal, Transport=coral)
  - Layer badge: `core` (teal), `secondary` (gray), `optional` (gray muted), `future` (purple muted)
  - Match score bar: a thin coloured bar (0–100%) showing how well this policy fits the org profile — labelled "Match: 94%"
  - Status pill: `Applicable` / `In Progress` / `Compliant` / `Future Readiness` / `Not Applicable`
  - A one-line "Why chosen" reason pulled from the policy record (see Section 2.2)

**Why-chosen logic:**

Every policy in the Supabase `policies` table should have a `match_reason` text field. This is a one-sentence explanation computed server-side when the org profile is matched to the policy. Example for PAT Scheme:

> "Your manufacturing profile and Scope 1 fuel emissions place you in BEE's Designated Consumer category."

This `match_reason` is shown on the card directly — no extra click needed. It makes the policy list feel like a personalised recommendation, not a generic catalogue.

**Filtering:**

Filter buttons (All / Energy / Waste / ESG / MSME / Environmental / Transport) call `GET /policies?category={cat}` and re-render the grid without full page reload. Filter state is tracked in component state, not URL (unless deep-linking is needed later).

**Search:**

Client-side filter on the already-loaded policy list. No new API call. Filter on `name`, `short_name`, `authority`, and `match_reason` fields.

---

### 2.2 "View Details" Button → Policy Detail Drawer

**Current state:** Button exists but either does nothing or shows a static modal.

**Required behaviour:**

Clicking "View Details" on any policy card opens a right-side drawer. The drawer slides in without navigating away from the grid (grid remains visible behind overlay). The drawer closes on Escape or clicking outside.

**Drawer content — fetched from `GET /policies/{id}`:**

```
┌─────────────────────────────────────────────────┐
│ [Category Badge]  [Layer Badge]  [Status Pill]  ×│
│                                                   │
│ Policy Name                                       │
│ Authority · Effective: Jan 2022                   │
│                                                   │
│ ── Why this policy was chosen for you ──          │
│ [match_reason in a highlighted callout box]       │
│                                                   │
│ ── What this policy requires ──                   │
│ • Requirement 1                                   │
│ • Requirement 2                                   │
│                                                   │
│ ── Benefits of complying ──                       │
│ • Benefit 1 (financial, legal, or reputational)   │
│                                                   │
│ ── Your compliance status ──                      │
│ Progress bar: 2 of 4 requirements met             │
│ [requirement rows with status pills]              │
│                                                   │
│ ── Ask about this policy ──                       │
│ [Chat panel — see Section 2.5]                    │
│                                                   │
│ [Apply Now]  [Read Policy Document]  [View Fund.] │
└─────────────────────────────────────────────────┘
```

**Compliance status within drawer:**

Call `GET /compliance/results?policy_id={id}` to fetch this policy's compliance requirements and their current status for the org. Render each requirement as a row with:
- Requirement name
- Type badge: `data` / `action` / `reporting`
- Verification method badge: `OCR` / `Evidence Upload` / `Data Change`
- Status pill: `not_started` / `in_progress` / `completed` / `overdue` / `verified`

---

### 2.3 "Apply Now" Button

**Current state:** Button either does nothing or routes to a generic page.

**Required behaviour:**

"Apply Now" opens a **step-by-step action plan modal** for that specific policy. This is not just information — it is a guided workflow that writes progress back to `compliance_results`.

**Modal structure:**

```
Apply: PAT Scheme
─────────────────────────────────────────────
Step 1 of 5: Set up electricity sub-metering
  [Description of what to do]
  [Why this step matters]
  [Verification: Upload meter installation receipt]
  
  [Evidence Upload Zone]  ← OCR-piped
  
  [Mark Step Complete]  ← only enabled after evidence upload OR data detected
─────────────────────────────────────────────
  [← Previous]  [Next →]  [Save & Close]
```

**Step data source:**

Each policy in the `policies` table has a `steps` array (JSON) — ordered list of implementation steps. Each step has:
- `step_number`
- `title`
- `description`
- `why_it_matters`
- `verification_type`: `evidence_upload` | `data_change` | `reporting`
- `linked_requirement_id`: FK to `compliance_requirements` — completing this step updates that requirement's status

**"Mark Step Complete" logic:**

This button is **not a self-declaration button**. It is enabled only when:
- For `evidence_upload` steps: user has uploaded a file and OCR extraction has returned a result
- For `data_change` steps: the system detects the relevant metric has changed in `emissions_entries` since the last baseline snapshot
- For `reporting` steps: a report artifact has been submitted with a timestamp

On clicking "Mark Step Complete":
1. Call `POST /compliance/results/{requirement_id}/verify` with the evidence payload
2. Backend validates the verification condition
3. On success: update the requirement status to `completed` (or `verified` if OCR confirms)
4. Increment the compliance score via `POST /compliance/score`
5. Show a success toast: "Step 1 verified — your compliance score updated to 65/100"
6. Update the score on the dashboard widget immediately (invalidate `useDashboardData` cache)

**Save & Close:** Saves current step progress. User can return later and resume from where they left off. Progress is persisted in `compliance_results.notes` as a JSON blob `{ current_step: 2, started_at: "..." }`.

---

### 2.4 "Read Policy Document" Button

**Current state:** Button does nothing.

**Required behaviour:**

This button has two layers:

**Layer 1 — Instant summary panel (always available):**

Opens an inline expandable section within the drawer (or a small modal) showing a structured summary of the policy document:
- Official title and gazette notification reference
- Key mandates in plain language (3–5 bullet points)
- Who it applies to (with specific size/sector thresholds)
- Penalties for non-compliance
- Key dates and review cycles
- Link to the official source document

This summary is stored in the `policies` table as `document_summary` (JSON with the fields above). It is seeded during the migration and can be updated without code changes.

**Layer 2 — Official document link:**

A button "Open Official Document ↗" opens the `external_url` from the policy record in a new tab. For policies without a direct PDF link (e.g., state-level PCB rules), this links to the authority's homepage with a note: "Document is available on the authority's portal. Search for [policy short name]."

**Why not just a link:**

Users should not have to read a 40-page gazette notification to understand what they need to do. The summary panel translates regulatory language into actionable plain English. The official link is the verification source for users who need the original text.

---

### 2.5 Policy Chat Panel (New — not yet implemented)

**Current state:** Not present anywhere.

**Required:** A chat panel embedded in the Policy Detail Drawer. This is the Groq LLM integration specified in the implementation plan.

**Placement:** Bottom section of the drawer, below the compliance status rows. Collapsible — collapsed by default with a "Ask about this policy ↓" toggle.

**UI structure:**

```
── Ask about this policy ──────────────────────────
[Suggested questions as chips:]
  [Does this apply to us?]  [What do we do first?]
  [What documents do we need?]  [What are the fines?]

[Chat history area — scrollable, max 300px height]
  AI: Based on your manufacturing profile and current 
      emissions of 48 tCO2e, the PAT Scheme applies 
      to you as a Designated Consumer...

[Your message input]                    [Send ↗]
────────────────────────────────────────────────────
Powered by Groq · Responses are advisory, not legal advice
```

**API call:**

`POST /policies/ask`

Request body:
```json
{
  "policy_id": "uuid",
  "question": "Does this apply to us?",
  "org_context": {
    "industry": "manufacturing",
    "size": "small",
    "total_emissions": 48200,
    "scope1": 31000,
    "scope2": 17200
  }
}
```

Response: `{ "answer": "...", "model": "llama-3.1-8b-instant", "interaction_id": "uuid" }`

**System prompt (backend — `service.py`):**

```
You are a carbon compliance advisor for Indian SMEs.
Organisation industry: {industry}
Organisation size: {size}
Current emissions: {total_emissions} kgCO2e (Scope 1: {scope1}, Scope 2: {scope2})
Policy context: {policy_name} — {policy_description}
Policy requirements: {requirements_list}
Answer in plain language. Be specific and actionable.
Do not make legal determinations. Recommend consulting a CA or legal advisor for binding advice.
Keep answers under 150 words unless asked for detail.
```

**Suggested questions** are hardcoded per policy category (not LLM-generated) so they appear instantly without an API call:
- Energy policies: "Does this apply to us?", "What should we do first?", "What are the fines for non-compliance?", "How does this affect our electricity bill?"
- Waste policies: "What documents do we need?", "Do we need a vendor tie-up?", "What are our EPR targets?"
- MSME policies: "What subsidies can we get?", "How do we apply?", "What's the timeline?"

**All interactions** are logged to `policy_interactions` table: `organization_id`, `policy_id`, `user_question`, `llm_response`, `model_used`, `created_at`.

---

### 2.6 "View Funding" Button

**Current state:** Button either does nothing or links generically.

**Required behaviour:**

"View Funding" opens a focused **Funding Detail Modal** for that specific policy's financial benefits. This is distinct from the general Funding grid — it is policy-specific.

**Modal content:**

```
Funding & Incentives: PAT Scheme
──────────────────────────────────────────────────
Scheme Name:     PAT Cycle IV — Energy Saving Certificates (ESCerts)
Benefit Type:    Revenue from tradeable certificates + penalty avoidance
Estimated Value: ₹5–25 lakh depending on energy savings achieved
Eligibility:     Manufacturing SMEs with annual energy use >500 TOE
Application:     BEE portal registration → baseline submission → quarterly reporting
Deadline:        PAT Cycle IV closes: March 2027

── Are you eligible? ──────────────────────────────
[Eligibility Checker — 3 quick questions:]
  Q1: What is your annual electricity consumption? [___] kWh
  Q2: Do you use diesel/furnace oil in production? [Yes / No]
  Q3: What is your primary product? [text input]

[Check Eligibility →]

Result: "Based on your inputs, you likely qualify as a Designated Consumer. 
         Register on the BEE portal to confirm your SEC target."

── How to apply ───────────────────────────────────
Step 1: Register on beeindia.gov.in as Designated Consumer
Step 2: Submit energy baseline data (your CarbonSense logs qualify)
Step 3: Receive Specific Energy Consumption (SEC) target from BEE
Step 4: Track quarterly and report

[Open BEE Portal ↗]  [Add to My Action Plan]
──────────────────────────────────────────────────
```

**"Add to My Action Plan"** button: Creates a new entry in `compliance_results` with status `not_started` and the linked `requirement_id` for this policy's funding-related step. This brings it into the active tasks on the Compliance page.

**Data source:** `policies.funding` JSON field (per policy, seeded in migration):
```json
{
  "scheme_name": "PAT Cycle IV — ESCerts",
  "benefit_type": "revenue + penalty avoidance",
  "amount": "₹5–25 lakh",
  "eligibility": "Manufacturing SMEs >500 TOE annual energy",
  "deadline": "March 2027",
  "application_url": "https://beeindia.gov.in",
  "how_to_apply": ["Step 1...", "Step 2...", "Step 3..."],
  "eligibility_questions": [
    { "id": "q1", "text": "Annual electricity (kWh)", "type": "number" },
    { "id": "q2", "text": "Use diesel/furnace oil?", "type": "boolean" }
  ]
}
```

---

### 2.7 Funding & Incentives Grid (Section 3 of Policy Page)

**Current state:** 3 static funding cards, hardcoded.

**Required changes:**

- Fetch from `GET /policies?has_funding=true&industry={orgIndustry}`
- Show **all** policies that have financial benefits — no 3-card cap
- Each card: scheme name, estimated value, eligibility summary, deadline chip, "View Funding →" button
- Highlight the top 3 by estimated value with a "Best Match" badge
- Sort by: estimated value descending, then by match score

---

### 2.8 Policy Action Tracker (Section 4 of Policy Page)

**Current state:** Not implemented.

**Required:** A table section below the funding grid showing all applicable policies and their compliance requirement status.

**Columns:** Policy Name | Requirement | Type | Verification Method | Status | Action

Each row's action button:
- If `not_started`: "Start →" (opens Apply Now modal at Step 1)
- If `in_progress`: "Continue →" (opens Apply Now modal at current step)
- If `completed`: "Upload Evidence" (opens evidence upload panel)
- If `verified`: "View Proof ✓" (shows the uploaded evidence document)

This is the bridge that connects the policy browsing experience to the compliance workflow. A user can go from "I'm interested in PAT Scheme" to "Step 3 of 5 complete" without ever visiting the Compliance page.

---

## Part 3 — Compliance Page

**File:** `app/(dashboard)/compliance/page.tsx`

### 3.1 "View Details" Button on Compliance Tasks

**Current state:** Button does nothing or shows a static tooltip.

**Required behaviour:**

"View Details" on any compliance task row opens a **Requirement Detail Modal** with full information about what needs to be done, why it matters, and how verification works.

**Modal content:**

```
Requirement: Electricity Consumption Tracked
Policy: Energy Conservation Act 2001 (amended 2022)
Type: Data  |  Level: Basic  |  Mandatory: Yes
──────────────────────────────────────────────────
What you need to do:
  Record your monthly electricity consumption in kWh 
  from utility bills. This must show a measurable change 
  from your previous period baseline to count as verified.

Why this matters:
  BEE mandates all commercial/industrial consumers to 
  track monthly kWh. This is also the Scope 2 foundation 
  of your GHG Protocol emissions calculation.

How verification works:
  Method: OCR Extraction
  Upload your electricity bill. Our OCR pipeline extracts 
  the kWh figure, date, and account number automatically.
  Verification is confirmed when extracted kWh differs from 
  last period's baseline by ≥5%.

  ⚠ Self-declaration is not accepted. Data must be 
  extracted from the document.

Your current status: In Progress
  Last uploaded: March 2026 bill (2,140 kWh)
  Baseline (Feb 2026): 2,280 kWh
  Change: −6.1% ✓ (threshold met)

Compliance contribution:
  This requirement contributes 8 points to your Data Score 
  (currently 18/40). Verifying this takes you to 26/40.

Due date: 15 May 2026 (31 days remaining)
──────────────────────────────────────────────────
[Upload New Bill]  [View Past Uploads]  [Close]
```

**Data sources:**
- Requirement details: `GET /compliance/requirements/{id}`
- Current result: `GET /compliance/results?requirement_id={id}`
- Score contribution: from `compliance_requirements.weight`
- Past uploads: `GET /compliance/results/{id}/evidence-history`

---

### 3.2 "Update Progress" Button

**Current state:** Button exists but is non-functional (likely updates a local state variable and doesn't persist).

**Required behaviour:**

"Update Progress" opens a **guided step tracker modal** specific to that compliance requirement's linked policy steps. It is not a free-text note field. It is a structured checklist of verifiable sub-steps.

**What it shows:**

```
Update Progress: Electricity Consumption Tracked
Policy: Energy Conservation Act 2001
──────────────────────────────────────────────────
Implementation Checklist:

✓ Step 1: Identify your DISCOM utility account number
  Verified via: account number on last uploaded bill
  Completed: 12 March 2026

◎ Step 2: Upload monthly electricity bill via OCR
  Current: March 2026 bill uploaded, kWh extracted
  Status: In Progress — awaiting April bill

○ Step 3: Establish baseline (3-month rolling average)
  Status: Not started
  What to do: After 3 consecutive months of uploads, 
  baseline is auto-calculated. You need 1 more month.

○ Step 4: Confirm kWh change from baseline ≥5%
  Status: Blocked — waiting on Step 3

──────────────────────────────────────────────────
Overall: 1 of 4 steps complete  [▓▓░░░░░░░░] 25%

Has something changed that isn't reflected here?
[I've completed a step — upload evidence ↗]

[Save & Close]
```

**Key design decisions:**

1. Steps are **derived from the policy's `steps` array** in the database, not free-form. Users cannot invent their own steps or check boxes arbitrarily.
2. Step completion is **auto-detected where possible**: e.g., "Upload monthly bill" is auto-marked when an OCR upload for that requirement succeeds.
3. Steps that require human confirmation (e.g., "Contact BEE auditor") show an "Upload Evidence" sub-action — the user must upload proof (email confirmation, appointment letter, invoice).
4. The progress percentage shown here feeds directly into the progress bar on the compliance task card.
5. Completed steps show: who completed it, when, and what evidence was submitted.

**Backend call on open:** `GET /compliance/results/{id}/steps` — returns the step checklist with current status per step.

**On evidence upload within this modal:** Routes through `POST /compliance/evidence`, same pipeline as the main evidence upload panel.

---

### 3.3 "Mark Complete" Button (Verification-Gated)

**Current state:** Clicking "Mark Complete" likely sets a local state boolean. No backend write. No verification.

**Required behaviour:**

"Mark Complete" is not a self-declaration action. The button's behaviour depends on the requirement type:

**For `data` type requirements:**

- Button label: "Verify via Data"
- On click: Call `POST /compliance/results/{id}/verify` with `{ verification_type: "data_change" }`
- Backend checks: does relevant metric exist in `emissions_entries`? Has it changed from baseline by ≥ threshold?
- If yes: status → `verified`, `verified = true`, score updated
- If no: show inline message explaining what data is missing and link to the relevant log/upload page
- Button is never just a checkbox

**For `action` type requirements:**

- Button label: "Mark Complete — Upload Proof Required"
- On click: Opens the evidence upload panel (same as "Upload Evidence" in Section 3.4)
- Completion is granted only after: file uploaded + OCR extraction confirmed
- After OCR returns: show extracted fields to user for review before saving
- User clicks "Confirm & Submit" → status → `completed`, score updated

**For `reporting` type requirements:**

- Button label: "Submit Report"
- On click: Opens reporting flow — a form to confirm report submission with: report period, submission method, reference number (from the regulator's portal)
- After submission: status → `completed`, timestamp recorded
- Verified status requires an acknowledgement document upload (regulator's receipt)

**Visual state of the button:**

- Default: outlined button "Mark Complete"
- Hover: tooltip explaining what evidence is required
- Disabled state: greyed out with tooltip "Upload evidence first to enable completion"
- Completed (unverified): amber "Pending Verification" chip
- Verified: teal "Verified ✓" chip — button replaced, no re-clicking possible

**Score update on completion:**

Every successful `verify` call triggers:
1. `POST /compliance/score` — recalculates and persists new score snapshot
2. Toast notification: "Requirement verified — score updated to 67/100 (+5 points)"
3. `compliance_score_history` gets a new row (snapshot_date = today)
4. Dashboard widget score ring updates on next load (cache invalidated)

---

### 3.4 Evidence Upload Panel

**Current state:** Not wired to backend OCR pipeline.

**Required:** A slide-in panel (not a modal — it should coexist with the task list) triggered by any "Upload Evidence" action on action-type requirements.

**Panel flow:**

```
Upload Evidence: Hazardous Waste Disposal Certificate
──────────────────────────────────────────────────
Accepted: PDF, JPG, PNG — invoices, certificates, utility bills

[Drop file here or click to browse]
  Max 10MB · PDF preferred for OCR accuracy

── After upload: OCR extracts automatically ──────
  Extracting: certificate number, date, vendor name, 
  waste category, quantity disposed

── Review extracted data ─────────────────────────
  Certificate No:  HW-2026-MH-04821  ✓
  Date:            14 March 2026  ✓
  Vendor:          GreenCycle Pvt Ltd (authorised)  ✓
  Waste qty:       120 kg (hazardous)  ✓
  
  [✗ Something looks wrong — re-upload]

── AI check ───────────────────────────────────────
  Groq review: "Extracted data confirms an authorised 
  hazardous waste disposal event. Vendor GreenCycle is 
  on CPCB's approved list. This satisfies the requirement."

[Confirm & Submit]  [Cancel]
```

**Backend flow:**

1. `POST /compliance/evidence` with multipart file + `requirement_id`
2. Backend routes through existing OCR pipeline (`/ocr/extract`)
3. OCR returns structured extraction
4. Groq reviews extraction against requirement definition: "Does this document satisfy [requirement name]?"
5. Groq returns: `{ satisfies: true/false, reason: "...", flagged_fields: [] }`
6. Frontend shows extraction + Groq review to user
7. On "Confirm & Submit": `POST /compliance/results/{id}/verify` with `{ verification_type: "ocr", evidence_url: "...", data_snapshot: {...}, llm_check: {...} }`

**What LLM must NOT do:** Set `verified = true`. That is done by the backend rule engine after the confirm action. LLM is advisory review only.

---

### 3.5 Score Dashboard (Three Rings — animated)

**Current state:** Static KPI number cards.

**Required:**

Replace KPI cards with three animated SVG score rings:

- **Data Ring** — max 40 — blue
- **Action Ring** — max 40 — teal
- **Reporting Ring** — max 20 — purple
- **Total Score** — large number in centre, colour-coded: ≥80 green, 50–79 amber, <50 red

Below the rings: a sparkline chart showing score trend from `GET /compliance/score/history`. X-axis: last 6 snapshot dates. Y-axis: total score 0–100. Single line, no fill.

**Component:** `components/ScoreRing.tsx` (shared with dashboard — see Section 1.1)

**On page load:** Call `GET /compliance/score` to get current scores. If no snapshot exists, call `POST /compliance/score` to generate initial snapshot.

---

### 3.6 Three-Tab Compliance Level View

**Tab 1 — Basic (All SMEs):**
Requirements: electricity tracking, fuel tracking, emission calculation, waste quantity, waste segregation, ESG data basics.

**Tab 2 — Industry-Specific:**
For manufacturing org profile: fuel consumption by type, hazardous waste handling, PCB consent to operate, air emission standards, wastewater records.

**Tab 3 — Action-Based:**
Requirements linked to applied policies and recommendation sessions. Only appears once the user has started applying at least one policy (i.e., at least one `compliance_result` with `level = action_based`).

**Each tab renders** requirements as rows with: name, type badge, verification method, status pill, progress bar, and action buttons ("View Details", "Update Progress", "Mark Complete").

---

## Part 4 — Database Changes Required

### 4.1 New fields on `policies` table

```sql
ALTER TABLE policies ADD COLUMN match_reason text;
ALTER TABLE policies ADD COLUMN document_summary jsonb;
ALTER TABLE policies ADD COLUMN steps jsonb;
ALTER TABLE policies ADD COLUMN funding jsonb;
ALTER TABLE policies ADD COLUMN match_score integer DEFAULT 0;
```

`match_score` is computed per-org at query time (not stored globally) — see Section 4.3.

### 4.2 New field on `compliance_results` table

```sql
ALTER TABLE compliance_results ADD COLUMN step_progress jsonb;
```

Stores `{ current_step: 2, steps_completed: [1], started_at: "..." }` for tracking Apply Now wizard progress.

### 4.3 Policy matching logic (service.py)

When `GET /policies` is called with an org context, the service layer computes a `match_score` for each policy based on:

- **Industry match** (0 or 30 points): org industry in `policy.applicability`
- **Emission footprint** (0–40 points): org's Scope 1/2 emissions overlap with policy's target emission categories
- **Size match** (0 or 20 points): org size in `policy.applicability`
- **Current gap** (0 or 10 points): policy addresses a category where org has no completed compliance requirements

`match_reason` is generated by the same logic as a short string template, not by LLM (for speed and consistency):

```python
reasons = []
if industry_match: reasons.append(f"your {org.industry} profile")
if scope1_relevant: reasons.append(f"Scope 1 fuel emissions ({scope1} kgCO2e)")
if size_match: reasons.append(f"SME eligibility")
match_reason = f"Chosen because: {', '.join(reasons)} align with {policy.authority}'s target audience."
```

---

## Part 5 — API Changes Required

### 5.1 New/modified endpoints

| Method | Endpoint | Change |
|--------|----------|--------|
| GET | `/policies` | Add `match_score` and `match_reason` to response per org context |
| GET | `/policies/{id}` | Add `steps`, `funding`, `document_summary` fields to response |
| POST | `/policies/ask` | New — Groq chat (already in plan, not yet built) |
| GET | `/compliance/requirements/{id}` | New — single requirement detail |
| GET | `/compliance/results/{id}/steps` | New — step checklist for a requirement |
| GET | `/compliance/results/{id}/evidence-history` | New — past uploads for a requirement |
| POST | `/compliance/evidence` | Wire to OCR pipeline + Groq review step |
| POST | `/compliance/score` | Ensure it writes to `compliance_score_history` |
| GET | `/compliance/score/history` | New — time-series for sparkline |

### 5.2 Response shape additions

`GET /policies` — each policy object should include:
```json
{
  "id": "uuid",
  "name": "PAT Scheme",
  "match_score": 94,
  "match_reason": "Chosen because your manufacturing profile and Scope 1 fuel emissions align with BEE's Designated Consumer category.",
  "status": "in_progress",
  "compliance_progress": { "completed": 1, "total": 4 },
  "funding": { "amount": "₹5–25 lakh", "deadline": "March 2027" }
}
```

---

## Part 6 — Frontend Component Changes

### New components to create

| Component | Purpose |
|-----------|---------|
| `components/ScoreRing.tsx` | Animated SVG ring — used on dashboard + compliance page |
| `components/PolicyDrawer.tsx` | Right-side drawer for policy details + chat |
| `components/PolicyChat.tsx` | Chat panel embedded in drawer |
| `components/ApplyNowModal.tsx` | Step-by-step policy application wizard |
| `components/FundingModal.tsx` | Funding detail + eligibility checker |
| `components/ReadPolicyModal.tsx` | Policy document summary + official link |
| `components/RequirementDetailModal.tsx` | Compliance requirement detail |
| `components/UpdateProgressModal.tsx` | Step tracker for compliance requirements |
| `components/EvidenceUploadPanel.tsx` | OCR evidence upload + Groq review |
| `components/ScoreSparkline.tsx` | Score trend chart (compliance page) |

### Existing pages to modify

| File | Change |
|------|--------|
| `policy-intelligence/page.tsx` | Wire all 5+ policy cards, remove hardcoded array, add all button handlers |
| `compliance/page.tsx` | Replace static KPI cards with ScoreRing, add tab view, wire all buttons |
| `dashboard/page.tsx` | Add policy snapshot widget with live score ring |
| `policy-compliance-api.ts` | Add new endpoint callers for chat, steps, evidence history, score history |

---

## Part 7 — Seeding Requirements

The migration `20260414100000_policy_compliance_foundation.sql` needs to be extended with the new fields and seed data.

### Policies to seed (29 total from spec + 8 from Section 12)

Each policy record must include the new fields: `match_reason` template, `document_summary`, `steps` array, `funding` object.

Priority order for seeding (highest to lowest match score for manufacturing SME profile):

1. PAT Scheme (match: 94)
2. Solar Rooftop Subsidy / PM Surya Ghar (match: 91)
3. ZED Certification (match: 88)
4. CLCSS (match: 85)
5. EPR — Plastic Waste (match: 82)
6. Energy Conservation Act 2001 (match: 80)
7. Hazardous Waste Management Rules (match: 78)
8. PCB Consent to Operate (match: 76)
9. GHG Protocol Alignment (match: 75 — engine already implements)
10. ESG / BRSR Preparedness (match: 70)
11. National Green Hydrogen Mission (match: 60 — future readiness)
12. CBAM (match: 55 — future readiness for EU exporters)

---

## Part 8 — UX & Interaction Rules

### What every button must do

| Button | Location | Action |
|--------|----------|--------|
| View Details | Policy card | Open PolicyDrawer with full policy info + chat |
| Apply Now | Policy card / drawer | Open ApplyNowModal with step wizard |
| Read Policy Document | Policy drawer | Open ReadPolicyModal with summary + official link |
| View Funding | Policy card / drawer | Open FundingModal with eligibility checker |
| Mark Complete | Compliance task row | Verification-gated — opens appropriate flow by requirement type |
| View Details | Compliance task row | Open RequirementDetailModal |
| Update Progress | Compliance task row | Open UpdateProgressModal with step checklist |
| Upload Evidence | Any task / step | Open EvidenceUploadPanel with OCR pipeline |
| Add to Action Plan | Funding modal | Create compliance_result entry, show in compliance page |
| Ask AI | Policy drawer chat | Call /policies/ask, stream response |

### Buttons that must never be self-declaration

These buttons must require verified data or evidence before they succeed:
- "Mark Complete" on data-type requirements
- "Mark Complete" on action-type requirements
- "Confirm & Submit" in evidence upload panel

These buttons may accept user input without external verification:
- "Mark Step Complete" on reporting-type steps (user confirms they submitted to regulator — can be audited later)
- "Save & Close" in Apply Now wizard (saves progress, does not claim completion)

### Toast notifications

Every score change must surface a toast notification with:
- Old score → new score
- Which requirement was verified
- Points gained

Example: "Electricity tracking verified (+8 pts) — compliance score: 62 → 70"

### Error states

All API calls must handle failure gracefully:
- Drawer: show error state within drawer, allow retry
- Chat: show "Could not reach advisor — try again" with retry button
- Evidence upload: show OCR failure message with option to upload a cleaner scan
- Mark Complete: if verification fails, explain exactly what data is missing and link to fix it

---

## Summary of Changes

| Area | Change Type | Priority |
|------|-------------|----------|
| Dashboard score widget | New component (ScoreRing) + live API | High |
| Policy grid — show all policies | Remove cap, dynamic fetch | High |
| Policy card — match score + why chosen | New field + UI element | High |
| View Details → full drawer | New component (PolicyDrawer) | High |
| Apply Now → step wizard | New component (ApplyNowModal) | High |
| Chat panel in drawer | New component (PolicyChat) + Groq API | High |
| Read Policy Document | New component (ReadPolicyModal) | Medium |
| View Funding → funding modal | New component (FundingModal) | Medium |
| Policy Action Tracker section | New section on policy page | Medium |
| Compliance View Details | New component (RequirementDetailModal) | High |
| Compliance Update Progress | New component (UpdateProgressModal) + steps API | High |
| Mark Complete — verification gated | Rework button logic, backend verify call | High |
| Score rings (three animated) | New component (ScoreRing) | High |
| Score sparkline | New component (ScoreSparkline) + history API | Medium |
| Evidence upload → OCR pipeline | Wire EvidenceUploadPanel to /compliance/evidence | High |
| Groq review on evidence | Add LLM review step after OCR in service.py | Medium |
| Database — new policy fields | Migration for match_reason, steps, funding, document_summary | High |
| Re-seed policies with new fields | Extended seed data for all 29+ policies | High |

---

*CarbonSense Policy & Compliance Enhancement Specification v2.0 · April 2026 · Internal*
