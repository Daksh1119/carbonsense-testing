# CarbonSense

CarbonSense is a carbon intelligence platform that combines enterprise emissions operations with AI-assisted analytics, recommendation generation, OCR-assisted receipt processing, and TEME (Tree-Emission Matching Engine) scenario planning.

This repository is the working mono-repo for the current implementation. It contains:

- A Next.js 14 web application with role-based dashboards (Platform Admin, Manager, Viewer), ingestion, analytics, recommendations, TEME, compliance, policy intelligence, and team workflows.
- A FastAPI service layer for ingestion, recommendation orchestration, OCR endpoints, policy AI chat, and TEME scenario planning.
- A packaged TEME engine with deterministic and ML-assisted components.
- OCR processing modules and automated PDF receipt extraction.
- Policy intelligence and compliance services (retrieval, scoring, deadlines, task verification, evidence upload).
- Dataset generation and model training scripts for TEME survival modeling.
- Supabase SQL migrations for auth schema, RBAC RLS policies, cascade organization management, and feature table persistence.

---

## Table of Contents

1. Project Scope and Objectives
2. Implemented Product Capabilities
3. Architecture and Runtime Topology
4. Repository Structure
5. Core Services and API Endpoints
6. Data Model and Persistence
7. Environment Variables
8. Local Development Setup
9. Testing and Quality Gates
10. Operations Runbook
11. Security and Access Control
12. Documentation Index
13. License

---

## 1) Project Scope and Objectives

CarbonSense is designed to support end-to-end carbon management workflows for organizations, with emphasis on:

- Operational emissions ingestion from structured data (CSVs, receipts, invoices).
- Reduction-first strategy, with offsets modeled as projected, delayed mitigation rather than immediate neutralization.
- AI-driven decarbonization recommendations using Groq (`llama-3.3-70b-versatile`) with catalog-based fallback.
- Automated compliance tracking, policy matching, and evidence verification.

---

## 2) Implemented Product Capabilities

### 2.1 Web Platform (Next.js 14 App Router)

The platform uses a strict RBAC model with three roles:

| Role | Who | Dashboard Route | Access |
|------|-----|----------------|--------|
| **Platform Admin** | CarbonSense internal team | `/admin/dashboard` | Cross-company oversight, company lifecycle management, manager approval/rejection, platform health |
| **Manager** | Client company carbon lead | `/dashboard` | Full CRUD on own organization's data: emissions, ingestion, analytics, compliance, policy, TEME, team, recommendations, and task delegation |
| **Viewer** | Client company employee | `/viewer/dashboard` | Read-only organizational insights, plus active execution of delegated tasks at `/viewer/my-tasks` |

> **Important:** Admin is *not* a company role. A client company only needs a Manager (and optionally Viewers).

**Manager Signup & Approval Flow:**
- Managers self-register at `/signup/manager` (email/password or Google OAuth) — no invitation required.
- After signup, they complete a company profile at `/onboarding/company-profile` (multi-section form: Company Basics, Energy, Transport, Operations, Context).
- All required fields are pre-populated on re-visit so data is never lost.
- The submitted profile is placed in a **pending approval** state at `/onboarding/pending-approval` (auto-polling every 10s).
- **Platform Admins** review, approve, or reject requests directly from `/admin/dashboard` cards or `/admin/access`.
- On approval, the manager is routed to `/dashboard` and the organization status changes to **Active**.

**Employee (Viewer) Signup & Team Delegation Flow:**
- Managers invite employees via email from `/team-management/add-member` or bulk-import via CSV.
- Employees receive an invitation link and register at `/signup/employee?token=...` (email/password or Google OAuth with OAuth token synchronization).
- Zero-recursion RLS JWT validation guarantees safe team member lookup without circular queries.
- Employees access `/viewer/my-tasks` to execute tasks delegated to them by their manager.

**Manager-scoped modules (under `/(dashboard)` route group):**
- Executive Dashboard with **Organization Profile Overview Card** (displays submitted onboarding details: sector, state, size, target reduction, description)
- Emissions workflows & review
- Data Ingestion & CSV parsing
- Detailed Emissions Log with upload-wise drilldown
- Analytics and Simulation
- **Manager-Centric Personalised Recommendations (`/recommendations`):**
  - High-level executive overview with Rank, Category, Action Type (`Reduction`, `Offset`, `Policy`), Priority (`High`, `Critical`), and Difficulty badges.
  - Key Metrics Strip: Potential Carbon Savings (`kgCO₂e`), Estimated Cost (`₹` INR), Time to Impact, and Certainty Score.
  - Dedicated **Manager's Strategic Rationale & Operational Case** callout box explaining the business case and emissions hotspot.
  - **Action Plan: What the Manager & Team Should Do**: Structured 2-column numbered roadmap with check badges.
  - Direct status controls: **Start (In Progress)**, **Mark Implemented**, **Dismiss**.
  - **Employee Task Delegation**: Assign specific actions directly to team viewers via dropdown.
  - Expandable **Evidence & Verified Citations** drawer linking actions to GHG Protocol, BEE, ISO 14064, and ENERGY STAR frameworks.
- Tree Engine (TEME)
- Policy Intelligence (radar, drawer, structured policy chat)
- Compliance Command Center (score ring, trend graph, deadlines, task verification, OCR evidence upload)
- Full-Width Interactive Glossary & Methodology (search, category filters, click-to-expand focus view modals)
- Team and Team Management (invite members, track roles, delegation history)
- Settings & Company Profile Editor (editable: sector, size, state, business description, target reduction %)

**Employee (Viewer) modules (under `/viewer` route group):**
- Employee Dashboard (`/viewer/dashboard`) — company-wide carbon performance, reduction targets, and personal assigned tasks overview.
- **My Tasks Execution Center (`/viewer/my-tasks`):**
  - Shows only tasks specifically delegated to the logged-in employee by their manager.
  - Expandable **"View Action Plan & Steps"** drawer (opened by default for in-progress tasks).
  - **Interactive Step-by-Step Checklist**: Numbered action items with interactive checkboxes where employees can tick off steps as they complete them.
  - **Persistent Progress Tracking**: Visual progress bar (`X of Y steps completed (%)`) saved locally in browser storage.
  - **Manager's Objective Callout**: Highlights why the task was delegated and the operational target.
  - Status lifecycle controls: **Start Task** (In Progress), **Mark Done** (Implemented), and **Reopen**.
- Emissions overview (`/viewer/emissions`) and personal profile.

**Platform Admin modules (under `/admin` route group):**
- Platform Overview — pending manager requests shown as 1-click approve/reject cards on the dashboard
- Company Management (`/admin/companies`) — organization cards show `active` / `setup` status badges; cascade delete
- Manager Oversight (`/admin/managers`) — managers show `active` / `pending` / `rejected` status badges; inline quick-approve
- Access Control (`/admin/access`) — full pending approval review queue with organization details
- Platform Health (API latency, DB load, service status)

---

### 2.2 Ingestion and Emissions Engine

The ingestion flow computes emissions from a canonical company CSV schema:
$$\text{Emissions (kgCO}_2\text{e)} = \text{Activity Data} \times \text{Emission Factor}$$

It outputs:
- Category & Scope breakdown (Scope 1, Scope 2, Scope 3)
- Top emitting departments and employees
- KPI snapshots & upload history logs

---

### 2.3 AI Recommendation & Task Delegation Service

Recommendations are orchestrated using Groq (`llama-3.3-70b-versatile`) or OpenAI-compatible LLMs with deterministic calculation layers and fallback catalogs.

**Features:**
- **Manager-Targeted AI Prompts**: Prompts explicitly instruct the engine to generate executive summaries, detailed managerial rationales, and 3-5 concrete implementation steps.
- **Deterministic Impact Calculation**: Applies verified GHG Protocol reduction factors against organization activity data so impact figures are mathematically grounded.
- **Enriched API Payload**: `GET /recommendations/items` delivers complete structured metadata: `summary`, `rationale`, `implementation_steps`, `estimated_impact_kg_co2e`, `implementation_cost_usd`, `time_to_impact_months`, and `confidence_score`.
- **Bidirectional Table Sync**: Updates to recommendation status seamlessly synchronize across both `recommendations` and `recommendation_items` tables.
- **Domain-Curated Action Catalogs**: Automatic step generation for fleet electrification, RECs, LED retrofits, supplier scorecards, and high-integrity offsets.

---

### 2.4 OCR & Evidence Service

OCR endpoints support:
- Single receipt processing and PDF document evidence parsing
- Bulk zip receipt processing
- Automated text extraction, vendor detection, and line-item carbon mapping
- Automatic compliance result verification (`status: verified`) upon document upload
- Fault-tolerant database logging to `public.receipts_ocr_results`

---

### 2.5 TEME (Tree-Emission Matching Engine)

TEME supports:
- Offset plan generation with regional location normalization (India-focused mappings)
- Constraints for land availability and species preferences
- ML compatibility options for Monte Carlo survival modeling
- Deterministic fallback guarantees

---

### 2.6 Interactive Glossary & Methodology

Located at `/glossary`:
- Full-width 2-column responsive layout
- Real-time search bar & category filter pills (**Core Units**, **Emissions Scopes**, **Methodology**, **Engine & Scoring**)
- Click-to-expand **Full-Screen Focus View Modals** showing complete definitions, practical business examples, key takeaways, and mathematical formulas

---

## 3) Architecture and Runtime Topology

### 3.1 Frontend Runtime
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling & UI:** Tailwind CSS, Recharts, Lucide Icons, Zustand
- **API Communication:** Direct calls to FastAPI service and Next.js route handlers with auto-retry on stream errors

### 3.2 Backend Runtime
- **Framework:** FastAPI
- **Entry point:** `packages/ml_services/api/app.py`
- **Connection Resilience:** Supabase HTTP/2 client proxy (`safe_execute`) with automatic stream re-initialization
- **Mounted Routers:** `/teme`, `/ocr`, `/recommendations`, `/ingestion`, `/policies`, `/compliance`

### 3.3 Persistence Layer
- **Supabase PostgreSQL:** Stores organizations, user profiles, emissions uploads, compliance results, `receipts_ocr_results`, manager invites, and TEME runs.
- **Row-Level Security (RLS):** 23 tables protected with 3-role RBAC policies.

---

## 4) Repository Structure

```text
carbonsense/
├── CarbonSense_FrontEnd/
│   └── frontend/                      # Next.js 14 Web Application
├── packages/
│   └── ml_services/
│       ├── api/                       # FastAPI routers (compliance, ocr, recommendations, teme)
│       ├── emissions/                 # CSV emissions calculation engine
│       ├── ocr/                       # OCR processors and PDF extractors
│       ├── recommendations/           # Groq LLM & catalog recommendation service
│       ├── policy_compliance/         # Policy intelligence & compliance service
│       ├── teme/                      # TEME engine (core, ML, simulation)
│       └── common/                    # Resilient Supabase proxy client & AuthZ
├── infrastructure/
│   └── supabase/
│       └── migrations/                # SQL migrations for RBAC, RLS, and tables
├── scripts/                           # Training, verification, and smoke test scripts
├── tests/unit/                        # Python unit test suite
├── requirements.txt                   # Backend Python dependencies
├── README.md                          # Repository documentation
└── .gitignore                         # Environment & build artifact rules
```

---

## 5) Core Services and API Endpoints

### 5.1 FastAPI App (`packages/ml_services/api/app.py`)
- `GET /health` — Service status check

### 5.2 Recommendation & Delegation Endpoints
- `POST /recommendations/generate` — Generate AI recommendations via Groq/LLM
- `GET /recommendations/sessions/{session_id}` — Fetch session recommendations
- `GET /recommendations/items?organization_id=...` — List recommendations with rich manager fields (`summary`, `rationale`, `implementation_steps`, `estimated_impact_kg_co2e`, `implementation_cost_usd`, `time_to_impact_months`, `confidence_score`, `assigned_to`)
- `PATCH /recommendations/items/{id}/status` — Transition recommendation implementation status (`proposed` → `in_progress` → `implemented` | `rejected`)
- `POST /recommendations/items/{id}/rate` — Capture user rating feedback (`helpful`, `not_helpful`, `not_relevant`)
- `POST /api/recommendations/delegate` — (Next.js Route) Delegate action to a specific employee viewer; syncs `assigned_to` across `recommendations` and `recommendation_items`
- `GET /api/recommendations/delegate?organizationId=...` — (Next.js Route) List all delegated actions and assigned team members

### 5.3 Employee / Viewer Task Endpoints (Next.js Route Handlers)
- `GET /api/viewer/tasks` — Fetch tasks assigned to the authenticated employee with detailed step-by-step action roadmaps, manager rationales, targets, and progress
- `PATCH /api/viewer/tasks` — Update status of an assigned employee task (`proposed` → `in_progress` → `implemented`)

### 5.4 Authentication & Team Invite Endpoints (Next.js Route Handlers)
- `POST /api/auth/check-invite` — Validate employee invitation token, company association, and expiration
- `POST /api/auth/oauth-sync` — Link Google OAuth sign-in accounts to organization profiles via pending invitation tokens

### 5.5 Compliance Endpoints
- `GET /compliance/requirements` — List compliance rules
- `GET /compliance/results` — Fetch organization compliance results
- `POST /compliance/results/{id}/verify` — Mark requirement complete/verified
- `POST /compliance/evidence` — Upload PDF/image evidence with automated OCR

### 5.6 OCR & Ingestion Endpoints
- `POST /ingestion/company-csv/calculate` — Parse CSV and compute emissions
- `POST /ocr/receipt` — Process single receipt image/PDF
- `POST /ocr/receipts/bulk` — Process ZIP archive of receipts

### 5.7 Admin API Endpoints (Next.js Route Handlers)
- `DELETE /api/admin/companies?id=...` — Cascade delete organization and all associated data
- `DELETE /api/admin/managers?id=...` — Demote or remove manager profile
- `POST /api/admin/managers/invite` — Invite manager for existing or new company

---

## 6) Data Model and Persistence

### Key SQL Migrations (`infrastructure/supabase/migrations/`):
- `001_auth_schema.sql` — Base user profiles and consent tables
- `002_role_redesign_rls.sql` — RBAC RLS policies for 23 tables
- `20260809_manager_invites.sql` — Manager invites schema with optional company linking
- `20260809_delete_organization_cascade.sql` — `delete_organization_cascade` PL/pgSQL function
- `20260809_create_receipts_ocr_results.sql` — `receipts_ocr_results` table definition
- `20260816_manager_approval_flow.sql` — Manager self-signup approval fields on `user_profiles` and company profile fields on `organizations`
- `20260816_recommendation_quality.sql` — Added user rating and feedback audit columns to `recommendation_items`
- `20260916_task_delegation_viewer_access.sql` — Adds `assigned_to` column to `recommendation_items` and `recommendations`; establishes non-recursive JWT-based RLS policies for manager profile access and viewer-scoped task execution permissions.

---

## 7) Environment Variables

### 7.1 Backend (`.env`)
```ini
# Supabase Database
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# LLM Provider (Groq Integration)
LLM_PROVIDER=groq
LLM_API_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.3-70b-versatile
LLM_API_KEY=your-groq-api-key

# AuthZ Strict Mode
OCR_STRICT_AUTHZ=false
```

### 7.2 Frontend (`CarbonSense_FrontEnd/frontend/.env.local`)
```ini
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

---

## 8) Local Development Setup

### 8.1 Prerequisites
- Python 3.9+
- Node.js 18+
- npm

### 8.2 Backend Setup
```bash
# Create and activate virtual environment
python -m venv .venv
# On Windows PowerShell:
.\.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install Python dependencies from root requirements.txt
pip install -r requirements.txt

# Start FastAPI server
python -m uvicorn packages.ml_services.api.app:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation: `http://localhost:8000/docs`

### 8.3 Frontend Setup
```bash
cd CarbonSense_FrontEnd/frontend
npm install
npm run dev
```
Web Application: `http://localhost:3000`

---

## 9) Testing & Verification

### Python Unit Tests
```bash
python -m pytest -q
```

### Frontend Type & Build Check
```bash
cd CarbonSense_FrontEnd/frontend
npx tsc --noEmit
npm run build
```

---

## 10) Security & RBAC Isolation

- **Platform Admin (`admin`):** Access to `/admin/*`. Oversight of companies, manager approvals, and platform health. Cannot modify operational data of individual client organizations.
- **Manager (`manager`):** Access to `/(dashboard)/*`. Full management of own organization's carbon program, data ingestion, recommendations, and team members.
- **Viewer (`viewer`):** Access to `/viewer/*`. Read-only employee access gated by manager approval.
- **Database RLS:** Row-Level Security policies on all 23 Supabase tables enforce role isolation at the database level.

---

## 11) License

Licensed under the **MIT License**.

<div align="center">

**Built with scientific rigor. No greenwashing. Reduction-first, always.**

</div>
