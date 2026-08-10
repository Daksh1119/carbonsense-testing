# CarbonSense — Dynamic Cross-Role Connectivity & Intelligence Pipeline
## Complete Implementation Plan (Grouped Build Order)

This is a task specification for an AI coding agent (GitHub Copilot, Google Antigravity, etc.) working in the CarbonSense repository. It assumes the current state described in `carbonsense_full_documentation.md`. **No changes to `carbonsense_ui_design_system.md`** — every new screen/component must reuse existing tokens, colors, and component patterns (glass cards, `ScoreRing`, `CardSkeleton`, badge system, teal primary, role-badge colors, etc.). New UI is composed from existing patterns, not new visual language.

Tasks are organized into **build groups**, not standalone phases — a group is a set of tasks that should be built in the same work session because they share dependencies or are cheaper to do together. Groups are ordered by dependency; within a group, sub-items can generally be split across people or done back to back. Each task is tagged:

- **[CORE]** — build regardless of time pressure; the system is structurally broken or misleading without it
- **[HIGH VALUE, CHEAP]** — small effort, disproportionate payoff, fold in opportunistically
- **[DEFER OK]** — a real feature, but the system works and demos fine without it; build only once the core is solid

### Usability principle (applies to every group below)

A manager or viewer using this system is not expected to know what "Scope 3," "tCO₂e," or "grid emission factor" mean going in — most SME users will not have an emissions-accounting background. This is a cross-cutting requirement, not a separate task:

- Every place a technical term first appears on a page (tCO₂e, Scope 1/2/3, emission factor, baseline vs. actual, Action Score, TEME, cycle) gets a short inline explanation — a tooltip/info icon (reuse the existing badge/tooltip component from the design system), not a wall of text on the page itself.
- Every new form (Company Profile onboarding, Draft Assistance, etc.) uses plain-language field labels and helper text, not jargon — e.g. "Electricity usage (check your last bill)" rather than just "kWh/month."
- Numbers are never shown bare where a comparison would make them meaningful — "42.3 tCO₂e (down 6% from last period)" rather than just "42.3 tCO₂e."
- Any page introducing a new concept for the first time in a user's flow (the onboarding form, the first Recommendations view, the first Compliance view) gets a one-line page-level description of what it does and why it matters, in the same plain-language style as Task 3C.1's Compliance framing.
- This principle is reinforced structurally by the new Glossary & Methodology page (Group 2, Task 2.10) — technical terms link out to it rather than every page re-explaining itself at length.

---

## Answers to the Open Design Questions

Answering these up front because they determine how every group below is built.

### "The recommendations/TEME/policy/compliance only consider the first input — how do we handle new uploads?"

This is the most important structural fix in this plan. The root cause: today, `teme_runs`, `recommendation_sessions`, and `policy_compliance_results` are keyed only by `organization_id`, with the dashboard always reading "the latest row." There's no concept of "this analysis belongs to this specific data snapshot."

**Fix: introduce an `assessment_cycles` table.** Every time new data enters the system (CSV upload, manual entry batch, or company-profile form completion), a new cycle row is created. TEME, recommendations, and compliance runs are then tied to a `cycle_id`, not just `organization_id`. This gives you, for free:
- A history you can show as a trend ("emissions this cycle vs. last cycle")
- The ability to re-run recommendations/policy/compliance only for the current cycle, without losing old ones
- A natural place to compute "increased/decreased since last upload"

This is **not** an ML problem — it's a data-modeling problem. Full detail in Group 1.

### "Is NLP or model training required for compliance?"

**No new model training is required.** What you need is retrieval, not training:
- Compliance status determination (compliant/pending/non-compliant) should stay **rule-based** — deterministic matching against `policy_compliance_requirements`, exactly like today. Rule-based is more defensible to a panel/auditor than an ML classifier here — regulatory status should not be probabilistic.
- Where NLP genuinely helps: **semantic search over policy text** so the "explain this policy to me" and "help me draft this requirement response" features work well. Use an embeddings-based retrieval step (RAG) feeding into your existing Groq/OpenRouter LLM call — this reuses infrastructure you already have. No fine-tuning, no custom model training.
- If you want a nice-to-have improvement later: a small classifier to auto-tag uploaded evidence documents by requirement type. This is optional, not needed for MVP, and would use a few hundred labeled examples with a lightweight model (e.g., logistic regression over embeddings) — not a deep learning project.

### "The LLM only gives certain types of recommendations — how do we get broader coverage?"

Three changes, no new model needed:
1. **Category-forced selection** — instead of one open-ended prompt, force coverage per emission category (Transport, Energy, Waste, Purchases) that has non-trivial emissions for that org, so the system can't just default to the 2–3 most "obvious" ideas.
2. **A recommendation catalog table** (`recommendation_catalog`) — a curated, India-context library of interventions per sector (seed this manually, ~15–20 per major sector to start). Selection is a deterministic query against this catalog, not LLM generation — this also gives you a fallback source of recommendations independent of the LLM being available at all.
3. **Dedup + diversity check** — if any free-generation step is kept, embed each recommendation title/description and drop near-duplicates before showing them.

### "Recommendations have an Apply button that does nothing — should we track implementation?"

Yes. This is a straightforward status-tracking feature, detailed in Group 3. It also directly feeds your **Action Score** in Compliance, which today has no real signal for "did they act on anything."

### "Do we need an LLM at all, or is there a better option?"

**Not for most of this.** The plan below draws a hard line: **selection, ranking, matching, and status determination stay deterministic (rule-based/catalog-driven) everywhere** — policy matching, recommendation selection, compliance status. The LLM (Groq/OpenRouter, unchanged infrastructure) is used **only** for two things: open-ended conversation (Policy Chat, Compliance requirement chat) and optional phrasing of already-selected content. Every LLM call in this plan must degrade gracefully to templated/catalog text if the LLM is unavailable — never an error state, never a missing feature. This boundary is restated as a hard constraint at the end of this document.

---

## GROUP 1 — Foundation

**Do this first, as one continuous pass.** Everything downstream reads from this schema and this cycle engine — there is no meaningful way to build any other group before this one exists. The tasks below merge what was originally "Phase 1" (schema) and "Phase 3" (cycle engine) into a single build session, since the cycle engine's tables are a direct extension of the same migration.

### 1.1 — Organization profile fields [CORE]
Extend `organizations` table:
```sql
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sector text; -- e.g. Manufacturing, IT/ITES, Textiles, F&B, Retail, Logistics, Construction, Healthcare, Other
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS company_size_category text; -- Micro / Small / Medium / Large (MSME classification basis)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS employee_count integer;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS electricity_usage_kwh_monthly numeric;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS computers_count integer;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS facility_area_sqft numeric;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS vehicle_fleet_count integer;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS business_travel_km_annual numeric;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS renewable_energy_pct numeric; -- 0-100
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS water_usage_kl_monthly numeric;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS waste_generated_kg_monthly numeric;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS working_days_per_week integer;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS annual_turnover_range text; -- for MSME classification, optional but useful for policy matching
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS has_sustainability_certification boolean DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS profile_status text DEFAULT 'not_started'; -- not_started | skipped | partial | complete
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz;
```
**Note on "anything I missed":** the additions above (facility area, fleet, business travel, renewable %, water, waste, working days, turnover range, certifications) are the standard indirect-emissions proxies used in SME carbon estimation — each maps to a Scope 1/2/3 category. Facility area lets you estimate HVAC load; fleet count and travel km feed Scope 1/3 transport; renewable % adjusts the grid emission factor; water/waste feed a smaller but real Scope 3 component. Recommend keeping all of them but making everything except organization name and sector optional at the field level (the form-level skip logic is separate, see Group 2).

### 1.2 — Two extra fields, folded in now [HIGH VALUE, CHEAP]
Add these in the **same migration** as 1.1 — they cost almost nothing now versus a real second migration + backfill later:
```sql
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS state text; -- Indian state — compliance is heavily State Pollution Control Board-routed, not just central (CPCB)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS udyam_registration_number text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS udyam_category text; -- Micro / Small / Medium per official Udyam registration, distinct from the self-declared company_size_category above
```
India's official MSME classification (Udyam) is investment/turnover-based, not headcount-based — a low-headcount company can still be a "Medium" enterprise under Udyam. If Udyam category is provided later, policy matching (Group 3) should prefer it over the headcount-derived `company_size_category`; if absent, keep using the headcount-based estimate but label it "estimated, not your official Udyam classification" wherever size category is displayed.

### 1.3 — Assessment cycle engine tables [CORE]
```sql
CREATE TABLE IF NOT EXISTS assessment_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  period_label text NOT NULL, -- e.g. "Jul 2026" or "Q3 2026"
  period_start date NOT NULL,
  period_end date NOT NULL,
  source_type text NOT NULL, -- 'csv_upload' | 'manual_entry' | 'company_profile' | 'recalculation'
  source_upload_id uuid REFERENCES organization_uploads(id),
  total_emissions_tco2e numeric,
  status text DEFAULT 'processing', -- processing | ready | failed
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON assessment_cycles (organization_id, created_at DESC);
```
Add `cycle_id uuid REFERENCES assessment_cycles(id)` to: `teme_runs`, `recommendation_sessions`, `policy_compliance_results`.
Keep `organization_id` on all of these too (don't drop it) — some queries still want "latest across org" without a cycle join.

### 1.4 — Recommendation implementation tracking + normalization [CORE]
```sql
ALTER TABLE recommendation_sessions ADD COLUMN IF NOT EXISTS implementation_status text DEFAULT 'proposed'; -- proposed | in_progress | implemented | rejected
ALTER TABLE recommendation_sessions ADD COLUMN IF NOT EXISTS status_updated_at timestamptz;
ALTER TABLE recommendation_sessions ADD COLUMN IF NOT EXISTS status_updated_by uuid REFERENCES user_profiles(id);
ALTER TABLE recommendation_sessions ADD COLUMN IF NOT EXISTS source_input_type text; -- 'manual' | 'form' | 'csv'
ALTER TABLE recommendation_sessions ADD COLUMN IF NOT EXISTS actual_impact_tco2e numeric; -- filled in later if you want to close the loop
```
If recommendations are currently stored as one row per session containing a JSON array of recommendation objects, move `implementation_status` etc. to be **per-recommendation**, not per-session — i.e., normalize into a `recommendation_items` child table (`id`, `session_id`, `title`, `description`, `impact_tco2e`, `cost_inr`, `difficulty`, `category`, `implementation_status`, `status_updated_at`, `status_updated_by`, `source_input_type`, `actual_impact_tco2e`, ...). Per-session status tracking is meaningless once a session has 5 different recommendations with different fates. Do this schema work now even though the UI for it lands in Group 3 — cheaper to get right once.

### 1.5 — Recommendation catalog [CORE — schema now, content before Group 3]
```sql
CREATE TABLE IF NOT EXISTS recommendation_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector text NOT NULL,
  category text NOT NULL, -- Transport | Energy | Waste | Purchases
  title text NOT NULL,
  description text NOT NULL,
  typical_impact_range text,
  typical_cost_range_inr text,
  difficulty text, -- Easy | Medium | Hard
  source_note text -- where this practice comes from, for credibility
);
```
Seed manually with ~15–20 entries per major sector (Manufacturing, IT/ITES, Textiles, F&B, Retail, Logistics minimum) before Group 3 starts. This is content work, not code — assign it explicitly as a task, don't let it block engineering.

### 1.6 — Policy adoption tracking [CORE — schema now, wiring in Group 3]
```sql
CREATE TABLE IF NOT EXISTS organization_policy_adoption (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  policy_id uuid NOT NULL, -- FK to whatever table backs policy_intelligence results
  status text DEFAULT 'not_started', -- not_started | in_progress | adopted | not_applicable
  status_updated_at timestamptz,
  status_updated_by uuid REFERENCES user_profiles(id),
  evidence_url text,
  UNIQUE(organization_id, policy_id)
);
```

### 1.7 — Invite-gated viewer signup enforcement [CORE — security, not just UX]
Audit the current signup flow (`/signup` or equivalent). Confirm: there is **no path** for a user to self-register as `viewer` without an existing `employee_signup_requests` row created by a manager. If a public signup form currently lets someone pick role = viewer freely, this is a real security gap, not just a UX one.
- Add a `signup_token` (or reuse invite email + org match) requirement: viewer signup only proceeds if an `employee_signup_requests` row exists matching the email + organization.
- RLS check: `employee_signup_requests` INSERT should already be restricted to `manager`/`admin` — confirm this policy exists; if not, add it.

### 1.8 — Recompute orchestration [CORE]
- Backend hook: whenever `organization_uploads` gets a new row (CSV import completes) or a manual-entry batch is saved, create a corresponding `assessment_cycles` row (`source_type = 'csv_upload'` or `'manual_entry'`), linked via `source_upload_id` where applicable. Compute `total_emissions_tco2e` for the cycle from the emission entries tied to that upload/batch.
- New backend endpoint: `POST /api/assessment-cycles/{cycle_id}/analyze`
  - Runs TEME forecast → writes `teme_runs` row with `cycle_id`
  - Runs recommendation generation → writes `recommendation_sessions` + `recommendation_items` with `cycle_id`
  - Runs compliance scoring → writes `policy_compliance_results` with `cycle_id`
  - This can run synchronously for now (call each in sequence) — do not over-engineer with a job queue unless upload volume actually requires it. A "processing" status on the cycle row, flipped to "ready" on completion, is enough for your current scale.
- Trigger this endpoint automatically right after a cycle is created (fire-and-forget from the upload handler, or synchronously if you'd rather show a "processing" state to the manager).
- Add a "Recalculate with latest data" button (Dashboard or Analytics page) that calls this endpoint against the latest cycle without requiring a new upload — useful if a manager edits their company profile.

### 1.9 — "Latest cycle" convenience view [CORE]
Add a Postgres view or a simple backend query: `latest_cycle_per_org` — the most recent `status = 'ready'` cycle per organization. Every existing "show the latest data" query (dashboard, recommendations page, etc.) should read through this instead of ad-hoc `ORDER BY created_at DESC LIMIT 1` scattered across the codebase. Centralizing this now prevents the same "only reflects first input" bug from recurring somewhere else later.

### 1.10 — Finalized-cycle data integrity [CORE — build alongside the cycle engine, not after]
Detailed Log already supports deleting emission entries. If an entry inside a period whose `assessment_cycles` row is already `status = 'ready'` gets edited or deleted, the cycle's stored `total_emissions_tco2e` and everything derived from it (TEME, recommendations, compliance) goes stale silently.
- Add a check on emission-entry edit/delete: if the entry's date falls within a cycle that is `status = 'ready'`, automatically trigger 1.8's recompute endpoint for that cycle afterward (preferred over blocking the edit — blocking a log edit is worse UX than silently re-analyzing).
- Whichever option is chosen, it must be consistent — don't leave any path where an edit inside a finalized cycle's period silently leaves stale totals in place.

**Group 1 exit criteria:** migration(s) applied; every new table has RLS policies (org-scoped, same pattern as existing tables); a manual test upload creates a cycle and successfully runs `analyze`; editing an entry inside a ready cycle triggers a recompute; a viewer cannot self-register; no frontend changes yet.

---

## GROUP 2 — Onboarding + Cross-Role Connectivity

**Build these two areas together** — both depend only on Group 1's schema, not on each other, so split them between people if you have help, or do them back to back solo. One internal dependency: task 2.9 (viewer footprint) needs Group 1's `latest_cycle_per_org` view, so do it after that specific piece, not before.

### 2.1 — Onboarding trigger [CORE]
- On manager login, `AuthProvider` (or a new lightweight check in the dashboard layout) checks `organizations.profile_status`.
- If `not_started`: redirect to `/onboarding/company-profile` before the dashboard renders.
- If `skipped` or `partial`: dashboard renders normally, but shows a persistent (dismissible-per-session, not permanently) banner: *"Complete your company profile for a more accurate carbon footprint"* linking to `/settings` (Organization tab) or a dedicated `/onboarding/company-profile?edit=true` route.
- If `complete`: no interruption.
- **"Skip for now" is disabled (greyed out, not hidden) until Organization Name, Sector, and Company Size Category are all filled in** — see 2.2/2.3 for why these three specifically can't be skipped. Once those three are valid, Skip becomes active and applies only to the remaining optional fields.

### 2.2 — Form fields [CORE]
Use the fields added in 1.1 and 1.2. Group into sections matching how a manager would naturally fill it out:
1. **Company Basics** — Name **(required)**, Sector **(required, dropdown)**, Company Size Category **(required, dropdown — Micro/Small/Medium/Large)**, Employee Count, **State** (strongly recommended, not hard-required)
2. **Facilities & Energy** — Facility Area, Electricity Usage (monthly kWh — helper tooltip: "check your last electricity bill"), Renewable Energy %, Computers/Devices Count
3. **Transport** — Vehicle Fleet Count, Estimated Annual Business Travel (km)
4. **Operations** — Water Usage, Waste Generated (monthly), Working Days/Week
5. **Optional Context** — Annual Turnover Range, Existing Sustainability Certifications, **Udyam Registration Number/Category**

**Organization Name, Sector, and Company Size Category are the only required fields** — every other field remains optional at submit time. This is a deliberate change from treating Name+Sector alone as required: emissions tracking, dashboards, and cross-role visibility (admin's Companies table, Policy/Compliance matching) are all keyed off these three, so proceeding without them would mean showing an org with no meaningful identity or classification anywhere in the system. Mark these three visually as required (asterisk + validation, reuse existing form-validation pattern) distinctly from the rest of the form, which stays clearly optional.

### 2.3 — Skip and edit-later logic [CORE]
- Organization Name, Sector, and Company Size Category must all be valid before the "Skip for now" button becomes clickable (2.1). There is no path to `profile_status = 'skipped'` (or any status) without these three set — they are the one part of this form that is never optional.
- Once the three mandatory fields are filled, "Skip for now" becomes active and applies only to the remaining optional fields → sets `profile_status = 'partial'` immediately (not `'skipped'` — since the org now always has a real name/sector/size, "skipped" as a distinct status is really just the zero-optional-fields case of "partial." Consider collapsing `skipped` into `partial` with `0` optional fields filled, or keep both statuses if useful for admin reporting — either is fine as long as the mandatory three are always present by the time any status other than `not_started` exists).
- Submitting more optional fields later → still `profile_status = 'partial'` until every field is filled, then `'complete'`.
- The same form is reachable later from Settings → Organization tab (extend the existing live tab, don't build a second form) — Organization Name, Sector, and Size stay editable there too, but always with the same required-field validation.

### 2.3a — Admin reflects the mandatory fields [CORE]
Because Organization Name, Sector, and Size are now guaranteed to exist for every org that's gotten past onboarding, the admin Companies table (2.6) should treat these as always-available columns, not conditional/placeholder ones — no "N/A" states should be needed for these three specifically once an org has passed the mandatory-field gate. Confirm the admin table displays Sector and Size Category as real columns (not just `profile_status`), since these are now core identity fields the admin should be able to see and filter/sort by directly.

### 2.4 — Baseline carbon footprint calculation [CORE]
**No model training here — this is deterministic, like your existing emissions factor library.**
- New backend function (e.g. `packages/ml_services/emissions/baseline_estimator.py`):
  - Electricity usage × grid emission factor (India CEA grid average, adjust down by `renewable_energy_pct`) → Energy category
  - Computers count × standard device power draw × working days/hours → Energy category (or a distinct "IT Equipment" subcategory)
  - Vehicle fleet count + business travel km × transport emission factor → Transport category
  - Facility area → optional HVAC estimate multiplier (sector-dependent) → Energy category
  - Waste generated × landfill/recycling emission factor → Waste category
- Output: a baseline `assessment_cycles` row with `source_type = 'company_profile'`, populated `total_emissions_tco2e`, and a category breakdown.
- This baseline powers the dashboard until the first real upload exists; once a CSV/manual upload cycle exists, prefer actual uploaded data, but keep the profile baseline visible as a labeled comparison point.
- **Because Sector is now mandatory (2.2), a baseline can always be computed at minimum from sector-average defaults**, even if every optional field was skipped — there's no longer a state where a manager has passed onboarding but the system has literally nothing to estimate from. Clearly label a fields-empty baseline as "rough estimate based on your industry average" rather than the more specific "estimated" tag used for partially-filled forms, so the two confidence levels don't look identical to the user.

### 2.5 — Admin dashboard live data [CORE]
- Confirm every admin KPI/table (Companies, Managers, Pending Approvals) queries live Supabase data. The "static" feeling is most likely: (a) no auto-refresh, so the admin has to manually reload, and (b) no visible signal when a manager onboards, uploads data, or a viewer is added.
- **Fix — Supabase Realtime subscriptions:** subscribe the admin dashboard to `postgres_changes` events on `organizations`, `user_profiles`, `employee_signup_requests`, and `assessment_cycles`. On any INSERT/UPDATE, refetch the relevant panel without a full page reload.
- Add a small "last updated" timestamp + live indicator dot (reuse existing badge component).

### 2.6 — Admin visibility into manager/viewer activity [CORE]
Companies table (`/admin/companies`): add columns/expandable detail showing `profile_status`, latest `assessment_cycles.period_label`, and viewer count — this is the "detect and reflect manager and viewer pages" requirement made concrete: admin should see, per company, whether the manager has onboarded, uploaded data, and how many viewers are active. See also 2.3a — Sector and Size Category should be shown as their own real columns here, not folded into a generic "details" expander, since they're now guaranteed to exist for every org.

### 2.7 — Viewer signup restriction verification [CORE]
- Confirmed structurally by 1.7 — this is the verification pass: write a test (manual or automated) that attempts to sign up a `viewer` account with no matching `employee_signup_requests` row and confirms it is rejected at both the API layer and RLS layer.
- Confirm the admin approval step for viewer requests shows which manager added them; display this clearly in `/admin/access`.

### 2.8 — Deadline alerting [HIGH VALUE, CHEAP — build once Group 3's Policy/Compliance data exists]
Notifications is a disabled "Coming Soon" tab, so a tracked policy/compliance deadline can currently pass with no signal to the manager.
- Add a lightweight in-app alert, independent of the full Notifications tab: reuse the existing "Policy Alerts" KPI card pattern on the Dashboard, extend its query to count any policy or compliance deadline within a configurable threshold (default 30 days).
- Add the same alert count as a badge on the Policy Intelligence and Compliance sidebar nav items (reuse existing badge/notification-dot component).
- **Does not require building the deferred Notifications tab** — read-only count-and-highlight, not a new notification/email system.
- Note: this task's data doesn't exist until Group 3 (Policy/Compliance) is built — the *code* can be written now, but treat it as blocked on Group 3's data.

### 2.9 — Viewer sees carbon footprint [CORE — depends on Group 1's 1.9]
- `/viewer/dashboard` already pulls `fetchEmissionsUploadsScoped` and shows Total Emissions — confirm this reads from `latest_cycle_per_org` (1.9), not a stale first-upload query.
- If only a company-profile baseline exists (no upload yet), viewer dashboard shows the baseline-estimated footprint with the same "Estimated" labeling as the manager side — not a zero state.

### 2.10 — Glossary & Methodology page (Manager + Viewer) [HIGH VALUE, CHEAP]
**Problem:** the system uses a lot of technical vocabulary (tCO₂e, Scope 1/2/3, emission factors, TEME, baseline vs. actual, Action Score, cycles) with no single place a confused manager or viewer can go to understand what any of it means or how it's calculated. This directly serves the usability principle above and is worth building early — the sooner it exists, the sooner other pages can link to it instead of re-explaining themselves.
- New route, same content shared across roles: `/manager/glossary` and `/viewer/glossary` (or a single `/glossary` route reused inside both role layouts, whichever fits the existing routing pattern better — check how other shared-content pages, if any, are structured before deciding).
- Add a sidebar nav entry — "Glossary" or "Understanding Your Data" — for both Manager and Viewer roles, positioned near the bottom of the nav (reference material, not a primary workflow page) using the existing sidebar item pattern.
- **Structure the page in two clearly separated sections, reusing existing card/typography patterns:**
  1. **Terms** — plain-language definitions, one card or row per term, no jargon-explaining-jargon: tCO₂e, Scope 1/Scope 2/Scope 3, emission factor, baseline (estimated) vs. actual (tracked) emissions, assessment cycle, Action Score, TEME (forecasting engine), implementation status, policy adoption status, Udyam classification (if 1.2/9.3 features are visible to the user). Each definition should be answerable in 1–2 sentences a non-specialist can act on, not a textbook definition.
  2. **How we calculate this** — a plain-language walkthrough of the actual formulas in use, matching what's really implemented so it never drifts from reality: the baseline footprint calculation (2.4 — electricity × grid factor adjusted by renewable %, computers × device draw, fleet + travel × transport factor, facility area × HVAC multiplier, waste × landfill factor), how TEME forecasts (reuse the existing explanation from wherever TEME already documents itself, don't reinvent it), how recommendations are selected and scored (3A.2 — catalog + scoring function, not free LLM generation), and how policies are matched (3B.1 — sector + size + emissions weighting). Written for a business owner, not an engineer — show the *idea* of each formula ("your electricity usage is multiplied by a standard grid emissions factor, then reduced based on how much of your power comes from renewables"), not raw code or SQL.
- Every technical term elsewhere in the product (tooltips added per the usability principle, page-level descriptions, etc.) should deep-link to the relevant anchor on this page rather than duplicating the explanation.
- Content for this page should be written once Groups 1–4 are functionally complete, since it needs to accurately describe formulas that actually exist — building it too early risks describing something that gets changed before ship.
- **Acceptance:** a manager or viewer with no emissions-accounting background can open this page and correctly explain, in their own words, what tCO₂e means and roughly how their dashboard number was calculated. Every major technical term used elsewhere in the Manager/Viewer UI has a corresponding entry here.

### 2.11 — Email visibility and editability [CORE]
**Two distinct problems to fix, per clarification — both apply:**

**(a) Manager/viewer can view and edit their own email.**
- Extend the Settings → Profile tab (Manager and Viewer both) to include the account email address as a live, editable field.
- Route email changes through Supabase Auth's email-change flow (confirmation email to the new address before it takes effect) — don't just update a plain `user_profiles.email` column without also updating the actual auth identity, or the two will drift out of sync and the user won't be able to log in with their "new" email.
- Until confirmation completes, show the pending new email clearly ("Pending confirmation: newemail@...") rather than silently switching the displayed value, so the user isn't confused about which email is actually active.
- Same component reused across both role layouts, consistent with the "no separate forms per role" pattern used elsewhere in this plan.

**(b) Admin's Companies/Team tables show correct, live emails.**
- Audit `/admin/companies` and any manager/viewer listing views: confirm the email shown for each manager and viewer is read live from the auth/user table, not a stale copy taken at signup/invite time that never gets updated if the person changes their email via (a).
- If emails are currently duplicated into a separate column (e.g., captured once from `employee_signup_requests.email` at invite time and never touched again), that's the likely source of a "wrong email" bug once (a) ships — either make the admin view join against the live user record instead of a stored copy, or add an update hook so the stored copy stays in sync. Prefer reading live over duplicating-and-syncing if the existing schema allows it without a larger refactor.
- Extend 2.5's Supabase Realtime subscription list to include the relevant auth/profile table so email changes reflect on the admin dashboard without a manual reload, consistent with how other live updates in Group 2 already work.
- **Acceptance:** a manager or viewer can change their email from their own Settings/Profile page and see a clear pending/confirmed state. Once confirmed, the new email is what shows up in the admin's Companies table and any team member listing — not the original signup-time email.

**Group 2 exit criteria:** new manager account is routed to onboarding, not the dashboard, on first login. Organization Name, Sector, and Company Size Category cannot be skipped or left blank — Skip only becomes active once these three are valid, and only ever applies to the remaining optional fields. Admin's Companies table shows Sector and Size Category as real columns for every onboarded org. A new manager signup, completed profile, or new upload is visible on the admin dashboard within a few seconds, no reload. A viewer account cannot be created except through a manager's add-member/bulk-import flow, verified at API and DB level. Viewer dashboard's emissions figure always matches the manager dashboard's for the same org and cycle. Both Manager and Viewer have a working Glossary & Methodology page reachable from the sidebar. Manager and viewer emails are both editable in their own profile view and correctly displayed in every admin/team table that references them.

---

## GROUP 3 — Recommendations, Policy, and Compliance Overhauls

**Do not split effort across all three at once**, even though they're technically independent and all depend only on Group 1's cycle engine. Build order below reflects visibility and cost.

### 3A. Recommendations overhaul — build this first [CORE, highest visibility]
Fixes the most obviously broken thing (a dead "Apply" button) and has the most visible payoff (diversity fix).

**3A.1 — Multi-input-type support [CORE]**
- Confirm/ensure `POST /api/recommendations` accepts and records `source_input_type: 'manual' | 'form' | 'csv'` (from 1.4), sourced from whichever `assessment_cycles.source_type` triggered it.
- Verification pass: run one cycle each of manual entry, CSV upload, and profile-only baseline; confirm recommendations, TEME, policy, and compliance all populate correctly for each — not just CSV, which is likely the currently-favored path.

**3A.2 — Category-forced selection + catalog grounding [CORE]**
- **Step 1 — deterministic selection, no LLM:** for every non-trivial emission category present in the cycle's data, query `recommendation_catalog` (seeded in 1.5) filtered by sector + category, rank by a fixed scoring function (impact range × feasibility/difficulty × relevance to the org's category share of total emissions), select top N per category. This alone guarantees full category coverage — the query forces it, not a prompt.
- **Step 2 — LLM phrasing pass, optional and swappable:** feed selected catalog entries + org context to the LLM only to rewrite the generic catalog description into an org-specific sentence. If the LLM is unavailable, render the catalog entry's stock description directly — the recommendation set doesn't change, only the wording does. Same fallback pattern your existing rule-based engine already uses, applied per-item instead of per-feature.
- Post-process (only relevant if any free-generation step is kept): embed titles+descriptions, drop near-duplicates (cosine similarity > ~0.9) before persisting.
- This directly answers "it's not checking for all possible solutions": a maintained catalog plus a deterministic query *is* the exhaustiveness guarantee.

**3A.3 — Implementation tracking [CORE]**
- Replace the no-op "Apply" button with a status control per `recommendation_items` row: Mark In Progress / Mark Implemented / Dismiss.
- `PATCH /api/recommendations/{item_id}/status` updates `implementation_status`, `status_updated_at`, `status_updated_by`.
- Implemented items visibly "bank" toward reduction progress (feeds Group 4) and feed Action Score (feeds 3C).
- Add a filterable "recommendations you've acted on" history view, reusing the Team Management table/list pattern.

**3A acceptance criteria:** recommendations generate sensibly for manual-entry, CSV-upload, and profile-only cycles. A single generation call covers every emission category with meaningful emissions, not just the top one or two. Marking a recommendation "Implemented" persists, is reflected in Compliance's Action Score, and appears in trackable history.

### 3B. Policy Intelligence overhaul — build second [CORE, but mostly content work]

**3B.1 — Sector- and emissions-based matching [CORE]**
- **No LLM involved.** Deterministic weighted-scoring function: `match_score = f(sector_match, size_applicability, category_emissions_weight)` — e.g., an org with high Transport-category emissions gets transport-related policies weighted higher via a simple multiplier.
- Tag policy source data by MSME vs. large enterprise (prefer `udyam_category` from 1.2 if present, else `company_size_category`) — India's thresholds (PAT scheme, EPR obligations, CPCB consent requirements) genuinely differ by size.
- Keep this fully deterministic and testable with fixed inputs/outputs — "why did we show this policy" should always be answerable without re-running an LLM call.
- If state data (1.2) exists, weight/filter by state-specific policies too (State Pollution Control Board rules, not just central).

**3B.2 — Full plan, deadlines, and real links [CORE — content-heavy, budget real time]**
- Extend the per-policy detail (existing "Read Policy Modal") to show: step-by-step compliance plan, deadline, and a verified outbound link to the real government/authority portal (cpcb.nic.in, moef.gov.in, PAT scheme portal, state pollution control board sites, as applicable).
- This is a content/data-accuracy task, not a code task — manually verify each policy's real portal URL. **Never surface an LLM-generated link as an official government link without human verification** — LLMs hallucinate URLs.

**3B.3 — Adoption tracking [CORE]**
- Wire `organization_policy_adoption` (1.6) into the Policy Intelligence page: status control (Not Started/In Progress/Adopted/Not Applicable) per policy card, optional evidence URL.
- Adoption status feeds Compliance's Action Score (3C) — closes a loop that currently doesn't exist.

**3B.4 — Policy chat improvements [the one legitimate LLM use case here]**
- Extend existing `PolicyChat.tsx` backend context with org data (sector, size, current emissions by category) for personalized answers. Reuses existing Groq/OpenRouter call, richer prompt context, no new infrastructure.
- **Scope boundary:** the LLM only answers open-ended questions and phrases explanations. It never decides which policies to show or sets `match_score` — that comes from 3B.1's deterministic scoring, passed in as fixed context. The LLM explains a decision already made, it doesn't make the decision.

**3B acceptance criteria:** policies shown are filtered/ranked by sector, size category, and emissions profile — verify two test orgs of different sectors see different top-ranked policies. Every policy card has a working link to a verified real government source. Adoption status persists per org per policy and is visible on the policy card and (via aggregation) the compliance page.

### 3C. Compliance overhaul — build the cheap half now, the expensive half only if time allows

**3C.1 — Redefine and communicate purpose [HIGH VALUE, CHEAP]**
Add a clear page-level description (reuse existing typography/card patterns) stating what Compliance actually does: *tracks your organization's adherence to applicable Indian carbon/environmental regulations, and helps you understand and prepare for what's required.* This alone addresses the "feels bland" feedback — right now the page shows scores with no framing.

**3C.2 — Real regulation tracking, Action Score wiring [HIGH VALUE, CHEAP]**
- Extend `policy_compliance_requirements` to link to the same sector/size applicability tagging from 3B.1, so a requirement only shows for orgs it applies to.
- Tie Action Score computation to: (a) recommendation `implementation_status = 'implemented'` count (3A.3), and (b) `organization_policy_adoption.status = 'adopted'` count (3B.3). Currently there's no real signal feeding this sub-score — this connects it to actions that actually happened.

**3C.3 — Drafting assistant [DEFER OK — the single most expensive item in this plan for its payoff, cut first if squeezed]**
- "Draft Assistance" panel on a requirement detail (extend `RequirementDetailModal`). Manager clicks "Help me draft this" → backend retrieves relevant material, LLM phrases it into a coherent, clearly-labeled draft for review/editing, not a final submission.
- **Retrieval step is the real "understanding" work, no LLM:** embed the requirement text and the org's compliance evidence/notes using `sentence-transformers` (free, off-the-shelf, no training), rank by cosine similarity, select top-N deterministically. This decides *what* goes into the draft. The LLM only decides *how to phrase it* — swap it out entirely and the draft is still built from correct source material, just less fluidly worded.
- Store requirement embeddings once at seed time, compute org-evidence embeddings on the fly — no training pipeline.

**3C.4 — "Understand this requirement" explainer [cheaper than 3C.3, worth keeping even if 3C.3 is cut]**
Reuse the Policy Chat pattern (3B.4) for a requirement-scoped chat. Same backend pattern, same scope boundary — the LLM explains and converses, it never decides compliance status (that's 3C.2's deterministic matching). Extend the existing chat endpoint with a `context_type: 'policy' | 'compliance_requirement'` parameter rather than building a separate chat system.

**Direct answer to "do we need to train any models / is NLP required":** No training required. Two lightweight additions cover everything: (1) an embeddings-based retrieval step for grounding drafts and chat answers (off-the-shelf, no training), and (2) your existing LLM for generation. Compliance *status* stays rule-based — auditable, explainable, more trustworthy to a panel/regulator than a trained classifier would be.

**3C acceptance criteria (minimum, without 3C.3):** Compliance page has clear, visible framing. Action Score visibly changes when a manager implements a recommendation or adopts a policy — verify end to end. (If 3C.3 is built: Draft Assistance produces a reviewable draft grounded in the requirement text, not generic boilerplate — verify with two different requirements.)

---

## GROUP 4 — Trend & Progress Tracking

**Build this right after whichever of Group 3 you finish first** — it's cheap once Group 1's cycle engine exists, and it's high-visibility for a demo. Don't leave it stranded at the end just because it's listed later.

### 4.1 — Cycle-over-cycle comparison [CORE]
New backend endpoint: `GET /api/organizations/{id}/trend?granularity=weekly|monthly|yearly` — aggregates `assessment_cycles.total_emissions_tco2e` by the requested granularity, returns a time series plus period-over-period % change. Reuse existing Recharts area/line chart patterns (Dashboard carbon path chart, Analytics page) — no new charting library needed.

### 4.2 — Post-upload progress signal [CORE]
Immediately after a new cycle finishes processing (1.8), compare `total_emissions_tco2e` against the previous ready cycle for the same org. Surface as a toast/banner right after upload completes: *"Emissions this period: 42.3 tCO₂e — down 6% from last period"* (or up, with appropriate coloring — reuse the existing positive/negative change indicator pattern from the dashboard's Total Emissions KPI card).

### 4.3 — Dashboard and Analytics integration [CORE]
- Extend the Dashboard's Carbon Path Chart to mark cycle boundaries (small markers where a new cycle started).
- Analytics page's existing period selector (1M/3M/6M/12M/All) should be backed by real cycle granularity from 4.1 rather than raw emission-entry timestamps, so Dashboard and Analytics never disagree on the same number.

**Group 4 exit criteria:** trend view works at weekly, monthly, and yearly granularity. Every completed cycle shows a visible increase/decrease signal compared to the prior cycle. Dashboard and Analytics report the same total emissions number for the same org and period.

---

## GROUP 5 — Remaining Refinements

Build only once Groups 1–4 are solid. Two related items are already folded into Group 1 (state field, Udyam fields) and Group 2 (deadline alerting) — don't redo them here.

### 5.1 — Admin content management for catalog and policy data [DEFER OK]
The only way to add or fix `recommendation_catalog` or policy link data today is a direct database edit — no deploy-free path.
- New admin-only pages: `/admin/recommendation-catalog` and `/admin/policy-library`, reusing the existing admin table + modal-edit pattern.
- CRUD on `recommendation_catalog`: add/edit/deactivate entries per sector+category.
- CRUD on the policy dataset: edit portal links, deadlines, applicability tags directly.
- **Acceptance:** an admin can add a new catalog entry or correct a policy's outbound link and see it reflected on a manager's page without a deploy.
- Keep editing these tables directly in Supabase until you actually have time for this — nothing else depends on it.

### 5.2 — Manager-to-viewer task assignment [DEFER OK]
Viewer dashboard visibility was justified by "managers assign tasks to viewers," but nothing lets a manager assign a specific action to a specific employee — only visibility exists, not delegation.
- Extend `recommendation_items` with `assigned_to uuid REFERENCES user_profiles(id)` (nullable, optional).
- Manager-side: "Assign to" control on each recommendation item (dropdown of the org's viewers, reusing `useTeamMembers` data).
- Viewer-side: new `/viewer/my-tasks` page — scoped to `assigned_to = current_user.id`, showing the assigned recommendation, its status, and a way to mark it "In Progress" — recommend allowing this one write action, otherwise assignment is purely decorative.
- If viewer status updates are allowed, this is a deliberate, narrow exception to the "viewer = zero write" rule elsewhere in the docs — scope it tightly (only `implementation_status` on items assigned to them) with an explicit RLS policy, don't loosen viewer write access generally.
- **Acceptance:** a manager can assign a recommendation to a specific viewer; that viewer sees it under "My Tasks" and can update its status; the manager sees the updated status reflected back.
- The most build-effort-for-value item remaining — genuinely nice to have, nothing else depends on it.

**Group 5 exit criteria:** admin can manage catalog/policy content without a deploy (if built); task assignment exists end-to-end between manager and viewer (if built).

---

## GROUP 6 — QA (continuous, not just at the end)

Verify each group's exit criteria as it lands — bugs found early are far cheaper than bugs found after three more groups are built on top. Reserve for the literal last step only:

### 6.1 — Cross-role consistency test
Manually walk through: manager completes onboarding form → uploads a CSV → generates recommendations → marks one implemented → adopts a policy. Confirm: viewer sees the updated footprint, admin sees the updated company status, compliance Action Score reflects the implemented recommendation and adopted policy, and a second CSV upload produces a new cycle with a visible trend change — without touching or losing the first cycle's data.

### 6.2 — Regression check on existing features
Everything documented as already working (RLS isolation, team management, existing dashboard KPIs) must still work after these changes — this plan adds tables and cycle-scoping, it should not require rewriting existing RLS policies for tables that already work correctly.

### 6.3 — Content completeness check
Confirm the recommendation catalog (1.5) and verified policy links (3B.2) are populated for every sector you expect to onboard real companies in before this ships — content dependencies, not code, easy to underestimate.

### 6.4 — Group 5 verification (if built)
Admin can add/edit a catalog entry and a policy link without a deploy. A manager can assign and a viewer can complete an assigned task.

### 6.5 — Documentation update
Update `carbonsense_full_documentation.md` to reflect the new tables, endpoints, and cycle-based data flow, so it doesn't go stale the way the "static admin" gap suggests the current docs may already be slightly ahead of reality.

---

## If you have to cut hard: the minimum coherent build

**Group 1 (all of it) → Group 2 (all of it) → Group 3A only (Recommendations, skip 3B and 3C) → Group 4 → continuous Group 6 QA.**

This gets you a real cross-role-connected system, a working onboarding flow with baseline footprint, a genuinely fixed recommendation engine with implementation tracking, and visible trend tracking — all structurally sound and demo-ready. Policy overhaul, Compliance's expensive half, and Group 5 are real, valuable, and entirely safe to add in a second pass once this core is working and you have more time.

---

## Global Constraints

1. No changes to the UI design system — every new screen/component reuses existing tokens, colors, and component patterns from `carbonsense_ui_design_system.md`.
2. No new model training pipelines — every AI feature in this plan uses your existing LLM (Groq/OpenRouter) calls plus, where noted, off-the-shelf embeddings for retrieval. Nothing here requires collecting a training set or running a training job.
3. Every new table gets RLS policies scoped to `organization_id`, following the exact pattern of existing tables — no new table ships without this.
4. Never surface an LLM-generated URL as an official government link without human verification (3B.2).
5. Compliance status determination stays rule-based/deterministic — LLM and embeddings are used for explanation and drafting assistance only, never for determining compliant/non-compliant status itself.
6. **LLM scope boundary (applies across Groups 3 and beyond):** the LLM is used only for open-ended conversation (Policy Chat, Compliance requirement chat) and optional phrasing/rewriting of already-selected content (recommendation descriptions, draft assistance text). It never selects, ranks, scores, or decides — policy matching, recommendation selection, and compliance status are all deterministic rule/catalog-driven logic that would still produce correct, complete output with the LLM turned off entirely. Every LLM call in this plan must have a non-LLM fallback path that degrades gracefully to templated/catalog text, not an error state.
7. **Usability:** no page introduces a technical term without a plain-language explanation available inline (tooltip) or via a link to the Glossary & Methodology page (2.10). Assume the person reading Manager or Viewer pages has no emissions-accounting background — write and design accordingly everywhere, not just on the glossary page itself.
