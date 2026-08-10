# CarbonSense — Cross-Role Consistency Walkthrough
## Group 6.1 — End-to-End Manual Verification

**Path tested:** Onboarding → Upload → Recommendations (with assignment) → Viewer sees tasks → Policy adoption → Compliance score changes

---

## Role Map for This Walkthrough

| Role | User | Key Action |
|------|------|-----------|
| **Admin** | `admin@carbonsense.in` | Verify company approved, catalog entries present |
| **Manager** | `manager@acme-ind.in` | Upload data, use recommendations, assign tasks, adopt policies |
| **Viewer** | `viewer@acme-ind.in` | Check My Tasks, mark In Progress |

---

## Step 1 — Admin: Verify Company & Catalog

1. Login as Admin → **Platform Overview** dashboard.
2. Navigate to **Companies** → confirm `Acme Industries` has `status = approved` and `profile_status = complete`.
3. Navigate to **Rec. Catalog** (`/admin/recommendation-catalog`).
   - Confirm at least 3–5 entries exist for `Manufacturing` sector.
   - Edit one entry (e.g. change "LED lighting" description) → click **Save Changes**.
   - ✅ **Expected:** Toast "Catalog entry updated." — no deploy needed.
4. Navigate to **Policy Library** (`/admin/policy-library`).
   - Find a policy with a missing URL (red ✗ in Portal Link column).
   - Enter the verified official URL → **Save Changes**.
   - ✅ **Expected:** URL now shows green ✓.

---

## Step 2 — Manager: Onboarding Profile

1. Login as Manager for `Acme Industries`.
2. If `profile_status = not_started`, should be auto-redirected to `/onboarding/company-profile`.
3. Fill all required fields:
   - Sector: **Manufacturing**
   - Company Size: **SME (10–249 employees)**
   - State: **Maharashtra**
   - Electricity Usage: `45,000 kWh/month`
   - Vehicle Fleet: `12 vehicles`
   - Udyam Registration: toggle to enter number
4. Click **Save & Continue**.
5. ✅ **Expected:**
   - Redirected to `/dashboard`.
   - No more profile-incomplete banner.
   - A new `assessment_cycles` row with `source_type = company_profile` created in Supabase.
   - Dashboard Carbon Path chart now shows at least one data point.

---

## Step 3 — Manager: Upload Emissions Data

1. From Manager dashboard → **My Emissions** → **Upload CSV**.
2. Upload a sample CSV with columns: `date, category, kg_co2e` (e.g. 3 months of data).
3. Click **Calculate & Submit**.
4. ✅ **Expected:**
   - Progress toast: "Emissions processed — X tCO₂e (Y% from last cycle)."
   - New `assessment_cycles` row with `source_type = csv_upload` and `status = ready`.
   - Dashboard total updates to reflect new cycle.
   - Analytics → Carbon Path chart shows a new point for this period.
   - Analytics granularity selector: switch Weekly / Monthly / Yearly — chart updates each time.

---

## Step 4 — Manager: Recommendations & Task Assignment

1. Navigate to **Recommendations** page.
2. Confirm items are loaded from the catalog (not the LLM fallback path).
   - Each card should show `#1`, `#2`… rank + category badge from `recommendation_catalog`.
3. For item #1: click **Start** → status changes to "In Progress".
4. For item #2: click **Mark Implemented** → Action Score on Compliance page should increase.
5. For item #3 (proposed): find the **Assign to…** dropdown.
   - Select `viewer@acme-ind.in`.
   - ✅ **Expected:** Toast "Task assigned to [Viewer Name]." → `recommendation_items.assigned_to` set.
6. Download PDF Roadmap → verify it includes all current items.

---

## Step 5 — Viewer: My Tasks

1. Login as Viewer (`viewer@acme-ind.in`).
2. Navigate to **My Tasks** (`/viewer/my-tasks`).
3. ✅ **Expected:**
   - Item #3 from Step 4 appears in **Active Tasks** with status "Not Started".
   - Category icon displayed (e.g. ⚡ for Energy).
   - Difficulty badge shown.
4. Click **Start** on the task.
5. ✅ **Expected:**
   - Toast "Task marked as In Progress — your manager will see this update."
   - Card moves to "In Progress" state.
   - `recommendation_items.implementation_status = 'in_progress'` + `status_updated_by = viewer.id` in Supabase.
6. Viewer navigates to **Dashboard** → confirms their org's total emissions shown (read from `latest_cycle_per_org`).
7. Viewer clicks **Company Targets** → verifies target progress shown.

---

## Step 6 — Manager: Policy Adoption

1. Login back as Manager → **Policy Intelligence** (`/policies`).
2. Confirm policies are listed with match scores (deterministic, not LLM).
   - At least 2–3 policies should show 60%+ match for a Manufacturing org.
3. Click a high-match policy → **PolicyDrawer** opens.
4. ✅ **Expected in drawer:**
   - Deadline chip shown (amber if future, red if past).
   - Official gov URL shown with "Open to verify" link and caution note.
   - Step-by-step plan OR requirement bullets shown.
   - PolicyChat responds with org context (mentions Manufacturing / SME).
5. Click **Apply Now** → Adoption status dropdown changes to **In Progress**.
6. ✅ **Expected:** Toast "Adoption status updated." + `organization_policy_adoption` row upserted.
7. Repeat for a second policy → set to **Adopted**.

---

## Step 7 — Manager: Compliance Score Validation

1. Navigate to **Compliance** page.
2. Check the three score cards:
   - **Data Score** (0–100): should reflect how many months of data uploaded.
   - **Action Score** (0–100): should have increased after Step 4 (item implemented) + Step 6 (policy adopted).
   - **Reporting Score** (0–100): based on data completeness.
3. Click on a requirement → **RequirementDetailModal** opens.
4. ✅ **Expected:**
   - Requirement metadata grid shown (category, scope, status).
   - AI Chat for this requirement loaded — ask "What documents do I need for this?"
   - Response is scoped to this specific requirement.

---

## Step 8 — Entry Edit Recompute (1.10)

1. Login as Manager → **My Emissions** → open an existing emission entry from the current month.
2. Edit the `kg_co2e` value (e.g. 1000 → 1200).
3. Click **Save** (frontend calls `PUT /ingestion/entries/{id}`).
4. ✅ **Expected:**
   - Response includes `recomputed_cycle_id` (non-null) if the entry date is within a ready cycle.
   - The cycle's `total_emissions_tco2e` updates in the DB.
   - Dashboard total changes accordingly.
   - Recommendations remain valid (re-analyzed in background).
5. Delete a different entry → `DELETE /ingestion/entries/{id}` → same recompute behavior.

---

## Step 9 — Glossary & Cross-Role Nav

1. As Manager: click **Glossary** in sidebar.
   - ✅ Confirm 15+ terms loaded with definitions.
2. As Viewer: click **Glossary** in sidebar.
   - ✅ Same glossary accessible.
3. As Admin: confirm **Rec. Catalog** and **Policy Library** both appear in sidebar.
4. As Viewer: confirm **My Tasks** appears in sidebar.

---

## Pass/Fail Checklist

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 1 | Onboarding profile creates company_profile cycle | ☐ | |
| 2 | CSV upload creates csv_upload cycle with correct total | ☐ | |
| 3 | Dashboard + Analytics read same total (latest_cycle_per_org) | ☐ | |
| 4 | Analytics granularity selector updates chart | ☐ | |
| 5 | Recommendations sourced from catalog (not LLM) | ☐ | |
| 6 | Status controls (Start / Implement / Dismiss) persist to DB | ☐ | |
| 7 | Assign To dropdown writes assigned_to to recommendation_items | ☐ | |
| 8 | Viewer sees assigned task in /viewer/my-tasks | ☐ | |
| 9 | Viewer "Start" button updates status_updated_by = viewer.id | ☐ | |
| 10 | Policy match scores are deterministic (same org → same scores) | ☐ | |
| 11 | PolicyDrawer shows deadline chip + gov URL + steps | ☐ | |
| 12 | PolicyChat reply mentions org sector/size | ☐ | |
| 13 | Policy adoption upserts organization_policy_adoption | ☐ | |
| 14 | Action Score increases after item implemented + policy adopted | ☐ | |
| 15 | RequirementDetailModal chat scoped to specific requirement | ☐ | |
| 16 | Entry edit triggers cycle recompute (recomputed_cycle_id returned) | ☐ | |
| 17 | Admin catalog CRUD works without deploy | ☐ | |
| 18 | Admin policy URL edit works without deploy | ☐ | |
| 19 | Glossary accessible for both Manager and Viewer | ☐ | |
| 20 | TypeScript build: zero errors | ✅ | Verified 2026-08-09 |

---

## Known Scope Boundaries (Do Not Test)

- **LLM for policy matching** — not implemented by design. Policy matching is deterministic weighted scoring.
- **LLM for recommendation selection** — not implemented by design. Catalog query only.
- **Admin modifying a viewer's task status** — only the viewer whose `assigned_to = uid` can Start; the manager can re-assign.
- **Gov portal URL auto-population** — never done by LLM. Must be manually entered by admin.

---

*Walkthrough created: 2026-08-09 | Group 6.1 — CarbonSense Dynamic Platform Plan*
