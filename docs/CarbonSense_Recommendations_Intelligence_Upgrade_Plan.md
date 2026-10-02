# CarbonSense Recommendations Intelligence Layer
## Production-Grade Upgrade Plan

**Status:** Diagnostic complete, based on direct code inspection of the live repository (`carbonsense-testing`), not assumptions.
**Scope constraint:** No UI theme changes. Only functional components, data flow, and information architecture on the Recommendations page.

---

## 0. Correcting the Starting Assumption (Read This First)

Before proposing changes, it's important to state clearly what the investigation actually found, because the diagnosis is more specific — and more encouraging — than "the LLM layer is a gimmick."

**What is already genuinely well-engineered in the backend, verified by reading the actual code:**

1. **Real evidence-catalog grounding exists.** `_build_evidence_catalog()` pulls the organization's actual profile, the top KPI snapshots computed from the organization's real uploaded emissions data, the latest TEME run, and curated methodology references — and assembles them into a structured evidence catalog before the LLM ever sees anything.

2. **A deterministic impact calculator already overrides the LLM's guessed numbers.** `impact_calculator.py` explicitly states its own purpose: *"This module replaces the LLM's guessed `estimated_impact_kg_co2e` with numbers derived from the organisation's own data and industry-standard reduction factors from the knowledge base."* Every formula it applies is tagged with its source (e.g., ENERGY STAR, GHG Protocol). This is exactly the "not just an LLM predicting numbers" architecture that inspires trust — it already exists.

3. **A 603-line curated knowledge base** (`knowledge_base.py`) with real, citable sources (GHG Protocol, IEA, ENERGY STAR, ASHRAE, IPCC AR6, DEFRA, SBTi, CDP, Verra VCS, Gold Standard) is used to enrich the evidence catalog per focus area.

4. **The LLM is explicitly instructed to cite evidence, not invent it.** The system prompt states: *"Every recommendation MUST cite ≥2 evidence_ids from the catalog. Do not invent data."* This is enforced at the prompt level, not merely hoped for.

5. **A second-pass LLM "critic" already exists in code** (`_validate_with_evaluator`) to check each recommendation against the organization's real KPI data for consistency, realistic cost/timeline claims, and citation accuracy — but it is **currently disabled by default** (`LLM_EVALUATOR_ENABLED=false`).

6. **Per-upload recommendation isolation is already correctly implemented.** `_build_cache_key()` confirms: when an `emissions_upload_id` is present, the cache key is built directly from it, guaranteeing exactly one recommendation session per uploaded file. Uploading a new month's data genuinely does produce a fresh, independent set of recommendations — this specific concern raised is already solved at the backend level.

**So why does it feel like AI slop anyway? Four specific, confirmed gaps — not a rebuild, a wiring problem:**

| # | Gap | Evidence |
|---|---|---|
| 1 | **The frontend discards all real evidence and shows fake generic citations instead.** | `app/(dashboard)/recommendations/page.tsx` contains a hardcoded `CATEGORY_EVIDENCE` lookup table mapping category names (Energy, Transport, Purchases, Waste, Offset, Governance) to a fixed, generic list of citations — completely disconnected from the actual `evidence` array the backend generates per-recommendation, per-organization. Every company sees the exact same citations for "Energy" recommendations, regardless of their real data. |
| 2 | **The trust/verification layer exists but is switched off.** | `LLM_EVALUATOR_ENABLED` defaults to `false`. The fact-checking critic pass that would catch hallucinated numbers or inconsistent claims never runs in production today. |
| 3 | **No temporal/trend reasoning across uploads.** | Each upload's recommendations are generated from that upload's snapshot in isolation. The LLM is never told "this is 18% higher than last month" or "this category has been rising for 3 consecutive periods" — so it cannot reason about accumulating trends even though isolated-per-upload generation is already correctly wired. |
| 4 | **No visible audit trail on the UI.** | The frontend shows a confidence percentage and a category tag, but nothing showing *which specific KPI number*, *which formula*, or *which real evidence record* produced that confidence score or impact estimate. The "why" is computed and stored but never surfaced. |

This reframes the project: **this is primarily a frontend wiring and backend-activation project, not a from-scratch LLM engineering project.** That changes both the effort estimate and the story you can tell in a viva: *"We built a properly grounded hybrid LLM system from the start — we identified that our own UI wasn't doing it justice, audited it, and fixed the gap."* That is a stronger, more mature engineering narrative than either "we have no grounding" or pretending nothing was wrong.

---

## 1. Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  DATA LAYER (mostly already correct)                             │
│  Uploaded CSV → csv_engine.py → real KPI snapshots per upload    │
│  + NEW: trend deltas computed against the organization's         │
│    previous upload(s)                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  EVIDENCE LAYER (already correct, extend with trend evidence)    │
│  _build_evidence_catalog() + knowledge_base.py enrichment        │
│  + NEW: trend_evidence entries ("Scope 2 rose 18% vs prior       │
│    period, source: this org's own upload history")               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  GENERATION LAYER (already correct)                               │
│  LLM proposes recommendations, MUST cite ≥2 real evidence_ids    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  GROUNDING OVERRIDE LAYER (already correct, exists but underused) │
│  impact_calculator.py replaces LLM's guessed numbers with real,  │
│  source-cited, formula-derived numbers from actual KPI data      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  VERIFICATION LAYER (exists, currently OFF — turn on + validate) │
│  _validate_with_evaluator(): second-pass LLM critic checks       │
│  consistency, realistic claims, real (not hallucinated) citations│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER (THE ACTUAL GAP — rebuild this)               │
│  Show the REAL evidence array, the REAL calculation trail, the   │
│  REAL trend context, and a REAL verification badge — no more     │
│  hardcoded CATEGORY_EVIDENCE stub                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Backend Changes

### 2.1 Enable and Validate the Existing Evaluator (Highest value, lowest effort)

**Action:**
```
LLM_EVALUATOR_ENABLED=true
```
in `.env`.

**Then verify it actually behaves correctly** — run a real generation and confirm:
- The evaluator is actually being called (add a log line if one doesn't exist)
- It correctly flags at least one deliberately-broken test case (e.g., manually inject a fabricated evidence_id into a test recommendation and confirm the evaluator rejects or flags it)
- Its pass/fail/correction outcome per recommendation is captured and stored, not discarded after the check

**New field to persist per recommendation:** `verification_status` (`verified` | `flagged` | `not_checked`), plus `verification_notes` if the evaluator provides a reason. This becomes the backbone of the new "Verified" badge in Section 3.

### 2.2 Add Trend/Temporal Evidence (Directly addresses "accumulating monthly data" concern)

**New function**, e.g. `_build_trend_evidence(org_id, current_upload_id, current_kpi_snapshots)`:
1. Query the organization's previous 1-3 emissions uploads (already stored, per-upload KPI snapshots exist)
2. For each matching KPI category present in both current and previous snapshots, compute percentage change
3. For categories with a meaningful change (e.g., >10% absolute), inject a new evidence item:
   ```json
   {
     "evidence_id": "trend::category_electricity",
     "source_type": "org_history",
     "source_table": "emissions_uploads",
     "citation": "Organization's own upload history: Sept vs Aug 2026",
     "excerpt": "Electricity emissions: 12,400 kg CO2e -> 14,650 kg CO2e (+18.1%)",
     "tags": ["trend", "category_electricity"]
   }
   ```
4. Feed this into the existing `_build_evidence_catalog()` pipeline — no changes needed downstream, it already accepts a list of evidence dicts.
5. Update the system prompt's rules slightly: *"If trend evidence shows a category has worsened over multiple periods, prioritize addressing it and reference the trend explicitly in the rationale."*

This is a genuinely small, surgical addition — it reuses 100% of the existing evidence → prompt → citation pipeline, just adds one new evidence source type.

### 2.3 Wire the Deterministic Calculator's Output Into Every Recommendation, Not Just Some

**Audit needed:** confirm `apply_deterministic_impacts()` is actually called on every single recommendation before it's returned to the frontend, for both the LLM path and the heuristic fallback path. If any code path returns an LLM-guessed number without this override, that's the exact "not grounded" gap materializing silently.

**New field to persist and expose:** `calculation_method` (`"deterministic"` | `"llm_estimated"`) per recommendation, sourced directly from `impact_calculator.py`'s existing output structure (it already returns this field internally — confirm it's persisted to the database and not dropped before storage).

---

## 3. Frontend Changes (No Theme Changes — New/Modified Components Only)

### 3.1 Remove `CATEGORY_EVIDENCE` Entirely

Delete the hardcoded static lookup table. Replace every reference to it with the recommendation's own real `evidence` array, which the backend already returns per-recommendation with `evidence_id`, `citation`, `excerpt`, and `source_type`.

### 3.2 New Component: `EvidencePanel`

Replaces the current generic evidence toggle. For each recommendation, render:
- **Real citations**, pulled from `recommendation.evidence[]` — not the category stub
- **Source type badge** per citation (e.g., "Your Data" for KPI-sourced evidence, "TEME" for tree-engine evidence, "Framework" for knowledge-base citations like GHG Protocol/IEA) — this single visual distinction is what makes recommendations feel grounded rather than generic, because a viewer can immediately see which parts come from *their own numbers* versus *external methodology*.
- **A "View calculation" expandable row** showing the `impact_model.formula` and `kpi_refs` already stored per recommendation (e.g., "impact = scope_2_kg × 0.22 — based on your Scope 2 total of 45,000 kg CO2e"). This data already exists in the stored recommendation object; it is currently not rendered anywhere.

### 3.3 New Component: `VerificationBadge`

Small badge next to the existing confidence percentage:
- **"✓ Verified"** (green) when `verification_status == "verified"` — tooltip explains: *"Cross-checked by a second independent AI pass against your organization's actual data for consistency and citation accuracy."*
- **"⚠ Not independently verified"** (muted) when the evaluator is disabled or the check didn't run — honest, not hidden.
- **"Calculated from your data"** vs **"AI-estimated"** tag, driven by the new `calculation_method` field from Section 2.3 — this is the single highest-trust-value UI addition possible, because it tells the user in plain language whether a number came from real math on their real KPIs or from the LLM's own estimate.

### 3.4 New Component: `TrendContextCard`

When trend evidence exists (Section 2.2) for a recommendation's focus area, show a small inline card: *"Why this matters now: Your Electricity emissions rose 18% since last month's upload."* This directly answers the "recommendations must account for accumulating data" requirement, and it's driven by real computed deltas, not a vague LLM claim.

### 3.5 New Component: `RecommendationHistoryStrip` (Optional but valuable)

A slim horizontal strip at the top of the Recommendations page: small dots or a mini-timeline representing each of the organization's past upload-linked recommendation sessions, clickable to view that period's recommendations. This makes the "recommendations are isolated per upload and evolve over time" architecture — which already exists on the backend — visible and understandable to the user, instead of only being reachable by re-uploading.

### 3.6 Existing Rating System — Surface It More Prominently

The backend already has `recommendation_items.user_rating` (`helpful` / `not_helpful` / `not_relevant`) and a working `/items/{id}/rate` endpoint. Confirm this is actually wired into the UI with visible thumbs-up/down controls per recommendation (if not already), and — important for the "production-grade" story — add a small aggregate indicator, e.g. *"87% of your team found this helpful,"* once enough ratings accumulate. This closes the loop: real user feedback becomes visible social proof of quality, not just a database table nobody sees.

---

## 4. Database Schema Additions Needed

```sql
ALTER TABLE recommendation_items
  ADD COLUMN IF NOT EXISTS verification_status TEXT
    CHECK (verification_status IN ('verified', 'flagged', 'not_checked'))
    DEFAULT 'not_checked',
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS calculation_method TEXT
    CHECK (calculation_method IN ('deterministic', 'llm_estimated'));
```

(Confirm exact table/column naming against the live schema before applying — this is a proposed shape based on the fields already flowing through `service.py`, not a guess at an unrelated table.)

---

## 5. Priority-Ordered Implementation Sequence

| Priority | Task | Effort | Why this order |
|---|---|---|---|
| 1 | Remove `CATEGORY_EVIDENCE`, wire `EvidencePanel` to real `evidence[]` array | Low | Single highest-impact fix — directly kills the "generic AI slop" feeling, uses data that already exists |
| 2 | Enable `LLM_EVALUATOR_ENABLED=true`, verify it works, persist `verification_status` | Low | Small config + verification pass; activates trust infrastructure that's already built |
| 3 | Add `VerificationBadge` and `calculation_method` tag to UI | Low-Medium | Makes the newly-activated grounding visible |
| 4 | Audit that `impact_calculator.py` runs on every recommendation, not some | Medium | Closes any silent gap between "designed to be grounded" and "actually always grounded" |
| 5 | Build trend evidence (`_build_trend_evidence`) + `TrendContextCard` | Medium | Directly answers the accumulating-monthly-data requirement |
| 6 | `RecommendationHistoryStrip` + surfaced rating aggregate | Medium | Polish that makes existing good architecture visible and demo-able |

**Deliberately not doing right now:** rebuilding the LLM prompt/evidence pipeline from scratch, switching LLM providers, or adding a vector database / full RAG pipeline. The existing evidence-catalog approach is already a legitimate, working grounding mechanism for this data scale — the fix is activation and honest presentation, not re-architecture.

---

## 6. How to Present This Work

For a viva or demo: *"We audited our own recommendation system critically rather than assuming it worked. We found the backend already implements real evidence grounding, a deterministic calculation layer that overrides LLM guesses with formula-derived numbers from the organization's actual data, and an optional AI fact-checking pass — but our own frontend was hiding all of that behind a generic placeholder. We fixed the presentation layer to surface the real grounding that already existed, activated the verification pass, and added trend-awareness across monthly uploads."* This is a stronger, more credible story than claiming the system was flawless, and more impressive than admitting it was ungrounded — because the truth, once investigated, was that most of the hard engineering was already done correctly.
