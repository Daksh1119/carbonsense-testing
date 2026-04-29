# CarbonSense

CarbonSense is a carbon intelligence platform that combines enterprise emissions operations with AI-assisted analytics, recommendation generation, OCR-assisted receipt processing, and TEME (Tree-Emission Matching Engine) scenario planning.

This repository is the working mono-repo for the current implementation. It contains:

- A Next.js web application with role-based dashboards (Platform Admin, Manager, Viewer), ingestion, analytics, recommendations, TEME, compliance, and team workflows.
- A FastAPI service layer for ingestion, recommendation orchestration, OCR endpoints, and TEME endpoints.
- A packaged TEME engine with deterministic and ML-assisted components.
- OCR processing modules and scripts for local smoke testing.
- Policy intelligence and compliance services (retrieval, scoring, deadlines, verification, evidence).
- Dataset generation and model training scripts for TEME survival modeling.
- Supabase migrations for auth schema, RBAC RLS policies, and feature table persistence.

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
13. Current Maturity and Roadmap
14. License

## 1) Project Scope and Objectives

CarbonSense is designed to support end-to-end carbon management workflows for organizations, with emphasis on:

- Operational emissions ingestion from structured data.
  Guiding principle:

- Reduction-first strategy, with offsets modeled as projected, delayed mitigation rather than immediate neutralization.

## 2) Implemented Product Capabilities

### 2.1 Web Platform (Next.js)

The platform uses a strict RBAC model with three roles:

| Role | Who | Dashboard Route | Access |
|------|-----|----------------|--------|
| **Platform Admin** | CarbonSense internal team | `/admin/dashboard` | Cross-company oversight, manager/company management, platform health |
| **Manager** | Client company carbon lead | `/dashboard` | Full CRUD on own organization's data: emissions, ingestion, analytics, compliance, policy, TEME, team, settings |
| **Viewer** | Client company employee | `/viewer/dashboard` | Read-only access to own organization's dashboards and insights |

> **Important:** Admin is _not_ a company role. A client company only needs a Manager (and optionally Viewers).

Manager-scoped modules (under `/(dashboard)` route group):

- Executive Dashboard
- Emissions workflows and review
- Data Ingestion
- Detailed Emissions Log with upload-wise drilldown
- Analytics and Simulation
- Recommendations
- Tree Engine (TEME)
- Policy Intelligence
- Compliance
- Team and Team Management
- Settings

Platform Admin modules (under `/admin` route group):

- Platform Overview (company list, usage metrics)
- Pending Approvals (manager signups, company registrations)
- Platform Health (API latency, DB load, service status)

The frontend integrates:

- Upload-level analytics and filtering
- Session-aware recommendation context
- Supabase-backed persistence APIs through Next.js route handlers
- TEME scenario visualization including Monte Carlo-compatible curves when provided
- Policy intelligence workflows (policy radar, drawer, structured policy chat, apply/funding/document modals)
- Compliance command workflows (score ring + trend graph, deadlines, task verification, evidence upload)

### 2.2 Ingestion and Emissions Engine

The ingestion flow computes emissions from a canonical company CSV schema and returns:

- Totals
- Breakdown by category
- Breakdown by scope
- Top employees
- KPI snapshots

- Emissions (kgCO2e) = Activity Data x Emission Factor

### 2.3 Recommendation Service

Recommendations are generated from consolidated context (emissions, KPI snapshots, optional TEME context) and persisted to Supabase.

Service characteristics:

- OpenAI-compatible provider abstraction via environment configuration
- Heuristic fallback when LLM path is unavailable
- Structured recommendation payloads with implementation steps and evidence
- Feedback capture per recommendation

### 2.4 OCR Service

OCR endpoints support:

- Single receipt processing
- Bulk zip receipt processing
- Organization-level analytics over OCR outputs

Includes:

- File type and size controls
- Optional strict authorization enforcement
- Food-assist integration hooks in OCR pipeline modules

### 2.5 TEME (Tree-Emission Matching Engine)

TEME supports:

- Offset plan generation
- Regional location normalization for India-focused mappings
- Constraints for land and species preferences
- Optional ML compatibility options for Monte Carlo behavior
- Deterministic fallback guarantees for robust runtime behavior

The UI terminology has been aligned to projected planning language (for example, planned trees and trees to plant), avoiding misleading interpretation as physically verified planted counts.

## 3) Architecture and Runtime Topology

CarbonSense currently runs as a dual-tier application stack in local development and can be deployed as service-separated components in production-oriented environments.

### 3.1 Frontend Runtime

- Framework: Next.js 14 (App Router)
- Language: TypeScript
- UI stack: Tailwind CSS, Recharts, Lucide, Zustand
- Runtime APIs:
  - Direct calls to FastAPI service (for ingestion, OCR, recommendations, TEME when configured)
  - Internal Next.js API route handlers for emissions upload and entry persistence

### 3.2 Backend Runtime

- Framework: FastAPI
- Entry app: packages/ml_services/api/app.py
- CORS enabled for common local frontend ports
- Router groups mounted:
  - /teme
  - /ocr
  - /recommendations
  - /ingestion
  - /policies
  - /compliance

### 3.3 Persistence Layer

- Supabase is used for:
  - Organization uploads and emission entries
  - Recommendation sessions, recommendations, evidence, feedback
  - TEME run persistence paths used by frontend and recommendation context

## 4) Repository Structure

High-level structure:

```text
carbonsense/
|- CarbonSense_FrontEnd/
|  |- frontend/                      # Next.js application
|
|- packages/
|  |- ml_services/
|     |- api/                        # FastAPI routers
|     |- emissions/                  # CSV emission engine
|     |- ocr/                        # OCR processors and helpers
|     |- recommendations/            # Recommendation orchestration service
|     |- teme/                       # TEME package (core/ml/simulation/tests)
|     |- common/                     # Supabase client + authz utilities
|     |- main.py                     # Lightweight ML app bootstrap
|
|- infrastructure/
|  |- supabase/
|     |- migrations/                 # SQL migrations for feature tables
|
|- data/
|  |- datasets/                      # Canonical training datasets
|  |- raw/sample_org_data/           # Sample CSV data for demos
|
|- scripts/                          # Training, ingestion, OCR, verification scripts
|- tests/unit/                       # Python unit tests
|- docs/                             # API, architecture, and user guides
|- pdf/                              # Extended implementation and plan docs (markdown format)
```

## 5) Core Services and API Endpoints

### 5.1 FastAPI App

Main app:

- packages/ml_services/api/app.py

Health endpoint:

- GET /health

### 5.2 Ingestion Endpoints

- POST /ingestion/company-csv/calculate
  - Input: multipart file
  - Output: emissions totals and breakdown

- POST /ingestion/company-csv/recommendations
  - Input: multipart file + organization_id + user_id (+ optional project metadata)
  - Output: CSV summary + recommendation result

### 5.3 Recommendation Endpoints

- POST /recommendations/generate
- GET /recommendations/sessions/{session_id}?user_id=...
- POST /recommendations/sessions/{session_id}/recommendations/{recommendation_id}/feedback

### 5.4 OCR Endpoints

- GET /ocr/health
- GET /ocr/capabilities
- POST /ocr/receipt
- POST /ocr/receipts/bulk
- GET /ocr/analytics/organization

### 5.5 TEME Endpoint

- POST /teme/run

Supports location alias normalization and compatibility inputs such as:

- ml.enabled
- ml_config.enable_monte_carlo
- ml_config.monte_carlo_trials

### 5.6 Policy Intelligence Endpoints

- GET /policies
- GET /policies/{policy_id}
- POST /policies/ask

### 5.7 Compliance Endpoints

- GET /compliance/results
- GET /compliance/deadlines
- GET /compliance/score
- GET /compliance/score/history
- GET /compliance/requirements/{requirement_id}
- GET /compliance/results/{result_id}/steps
- GET /compliance/results/{result_id}/evidence-history
- POST /compliance/results/{result_id}/verify
- POST /compliance/evidence

## 6) Data Model and Persistence

### 6.1 Supabase Migrations in Repository

Auth and RBAC migrations (run in Supabase SQL Editor):

- supabase/migrations/001_auth_schema.sql — user_profiles, employee_signup_requests, manager_consents tables with RLS
- supabase/migrations/002_role_redesign_rls.sql — Comprehensive RLS policies for all tables aligned with the 3-role model (Platform Admin / Manager / Viewer)

Feature table migrations:

- infrastructure/supabase/migrations/20260318_recommendation_tables.sql
- infrastructure/supabase/migrations/20260322_emissions_uploads.sql
- infrastructure/supabase/migrations/20260322_recommendation_audit_fields.sql
- infrastructure/supabase/migrations/20260322_seed_tree_species.sql
- infrastructure/supabase/migrations/20260414100000_policy_compliance_foundation.sql
- infrastructure/supabase/migrations/20260414100100_seed_policy_compliance_data.sql
- infrastructure/supabase/migrations/20260414110000_policy_compliance_enhancements.sql

### 6.2 Emissions Persistence Paths

Frontend route handlers under Next.js app API:

- app/api/emissions/uploads/route.ts
- app/api/emissions/uploads/[uploadId]/route.ts
- app/api/emissions/entries/[entryId]/route.ts

These routes handle:

- Upload metadata persistence
- Emission entry creation/update/delete
- Upload-level totals updates

## 7) Environment Variables

Use separate configuration for backend and frontend.

### 7.1 Backend (.env)

Required for Supabase access:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Required for LLM recommendations:

- LLM_API_KEY

Common recommendation defaults:

- LLM_PROVIDER (default: openrouter)
- LLM_API_BASE_URL (default: https://openrouter.ai/api/v1)
- LLM_MODEL (default: openrouter/auto)
- LLM_SITE_URL (optional header metadata)
- LLM_APP_NAME (optional header metadata)

Common policy-chat deployment values used in this repo:

- LLM_PROVIDER=groq
- LLM_API_BASE_URL=https://api.groq.com/openai/v1
- LLM_MODEL=llama-3.1-8b-instant

AuthZ enforcement flag:

- OCR_STRICT_AUTHZ (true/false)

### 7.2 Frontend (CarbonSense_FrontEnd/frontend/.env.local)

- NEXT_PUBLIC_API_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID
- NEXT_PUBLIC_DEFAULT_USER_ID
- NEXT_PUBLIC_USE_TEME_MOCK (optional for TEME mode switching)
- SUPABASE_URL (for server route handlers if needed)
- SUPABASE_SERVICE_ROLE_KEY (for server route handlers)

Important:

- Keep .env and .env.local files local only.
- .gitignore excludes root .env\* and frontend .env.local.
- Use example env files for sharing safe configuration templates.

## 8) Local Development Setup

### 8.1 Prerequisites

- Python 3.9+
- Node.js 18+
- npm
- Supabase project with required tables/migrations

### 8.2 Backend Setup

From repository root:

```bash
# activate your environment
python -m venv .venv
.venv/Scripts/activate

# install core runtime dependencies (example minimal set)
pip install fastapi uvicorn python-multipart requests python-dotenv supabase pandas numpy scikit-learn

# run ML service API
python -m uvicorn packages.ml_services.api.app:app --host 0.0.0.0 --port 8000 --reload
```

Backend docs:

- http://localhost:8000/docs

### 8.3 Frontend Setup

```bash
cd CarbonSense_FrontEnd/frontend
npm install
npm run dev
```

Frontend app:

- http://localhost:3000

Production build checks:

```bash
npm run build
npm run lint
```

## 9) Testing and Quality Gates

### 9.1 Python Tests

From repository root:

```bash
python -m pytest -q
```

Unit tests are present under:

- tests/unit

### 9.2 Frontend Validation

From repository root:

```bash
npm --prefix CarbonSense_FrontEnd/frontend run build
```

Recommended additional check:

```bash
npm --prefix CarbonSense_FrontEnd/frontend run lint
```

### 9.3 Useful Scripts

- scripts/run_single_csv_ingestion_demo.py
- scripts/test_ocr_real_receipt.py
- scripts/generate_teme_survival_dataset.py
- scripts/train_teme_survival_model.py
- scripts/train_teme_survival_production.py
- scripts/verify_rls.py

## 10) Operations Runbook

### 10.1 End-to-End Local Smoke Path

1. Start backend on port 8000.
2. Start frontend on port 3000.
3. Upload a CSV in Data Ingestion page.
4. Verify analytics and detailed log update by upload selection.
5. Open Recommendations page and verify session/recommendation rows in Supabase.
6. Run TEME scenario and confirm project persistence and chart rendering.
7. Open Policy Intelligence and verify policy list, policy document links, and policy advisor chat.
8. Open Compliance and verify score trend graph, deadlines, and evidence upload flow.

### 10.2 Common Failure Modes

- Missing Supabase keys in backend or frontend server routes.
- Missing NEXT_PUBLIC_API_URL for frontend-to-backend calls.
- Missing LLM_API_KEY, causing fallback recommendation path.
- OCR strict auth enabled without seeded org membership/permissions.
- Missing policy/compliance migrations in Supabase (empty policy/compliance views).
- Missing or invalid policy-chat LLM config (policy advisor errors or empty responses).

## 11) Security and Access Control

### 11.1 RBAC Role Model

CarbonSense uses three strictly isolated roles:

- **Platform Admin (`admin`)**: CarbonSense internal staff. Full read access across all organizations. Can manage companies, approve managers, and configure platform-level settings. Does _not_ operate on any single company's data.
- **Manager (`manager`)**: Client company's carbon program lead. Full CRUD on their own organization's data (emissions, uploads, compliance, recommendations, team). Gated by a mandatory consent modal on first login.
- **Viewer (`viewer`)**: Client company employees. Read-only access to their organization's dashboards. Gated by an approval workflow (manager must approve before access is granted).

### 11.2 Frontend Route Guards

- `ProtectedRoute` component wraps each route group with `requiredRole` enforcement
- `/(dashboard)/*` routes require `manager` role
- `/admin/*` routes require `admin` role
- `/viewer/*` routes require `viewer` role with approval gate
- `AuthProvider` syncs Supabase session → Zustand store on every page load

### 11.3 Database-Level RLS

Row-Level Security policies are defined in `supabase/migrations/002_role_redesign_rls.sql` using two helper functions:

- `is_platform_admin()` — returns true if the authenticated user has role `admin`
- `user_org_id()` — returns the authenticated user's `organization_id`

All 23 tables have RLS enabled with policies following this pattern:
- Admin: SELECT on everything, INSERT/UPDATE on reference data
- Manager: Full CRUD on own organization's operational data
- Viewer: SELECT only on own organization's data
- Service Role: Bypasses RLS (used by API routes for cross-cutting operations)

### 11.4 Backend Authorization

Authorization helpers are implemented in:

- packages/ml_services/common/authz.py

Behavior:

- Membership and permission checks are enforced when OCR_STRICT_AUTHZ=true.
- Permission keys are validated against organization membership and enabled permission flags.

For production deployment, enforce strict mode and ensure org membership/permission tables are correctly seeded.

## 12) Documentation Index

Architecture and API references:

- docs/architecture/csv_ingestion_implementation.md
- docs/api/single_csv_company_emissions_schema.md
- docs/api/teme_survival_dataset_schema.md

User guides:

- docs/user-guides/csv_ingestion_analytics_testing.md
- docs/user-guides/recommendations_llm_e2e.md

Extended technical planning docs:

- pdf/Technical_Implementation_Guide.md
- pdf/Updated_Complete_Project_Plan_With_TEME_Policy.md

## 13) Current Maturity and Roadmap

Implemented and actively used in this repository:

- Frontend operational dashboards and workflows
- Ingestion calculation engine
- Recommendation generation and persistence
- OCR service routes and processors
- TEME endpoint and dashboard integration
- Supabase migration baseline for recommendation/emissions flows
- Policy intelligence backend and frontend integration
- Compliance scoring, deadlines, task tracking, and OCR-backed evidence flow

Roadmap and expansion themes (tracked in docs):

- Deeper policy intelligence automation
- Expanded forecasting and optimization layers
- Broader production hardening for multi-tenant deployment and observability

## 14) License

This repository is licensed under the MIT License.

1. **"Multi-Agentic AI for SME Carbon Management"** - Systems architecture
2. **"Time-Debt Modeling for Tree-Based Carbon Offsets"** - TEME engine (Environmental Science)
3. **"Automated Policy Compliance via NLP"** - Policy module (NLP/AI)

---

<div align="center">

**Built with scientific rigor. No greenwashing. Reduction-first, always.**

</div>

## User Authentication & Role-Based Access

### Role Model

| Role | Who | Login | Dashboard | Capabilities |
|------|-----|-------|-----------|-------------|
| **Platform Admin** | CarbonSense team | `/login/admin` | `/admin/dashboard` | Cross-company oversight, platform health, manager/company management |
| **Manager** | Client company lead | `/login/manager` | `/dashboard` | Full emissions ops, data ingestion, analytics, compliance, policy, TEME, team mgmt |
| **Viewer** | Client company staff | `/login/viewer` | `/viewer/dashboard` | Read-only dashboards, personal insights |

> A client company does **not** need an Admin. Admin is exclusively the CarbonSense internal team. The company only needs a **Manager** and optionally **Viewers**.

### Authentication Flow

- **Login portals:** Three role-specific login pages with email/password, Google OAuth, and OTP support
- **Signup:** `/signup/employee` for employee self-registration (requires manager approval)
- **Consent gate:** Managers must accept terms via a consent modal on first login; consent status persisted in `manager_consents`
- **Approval gate:** Viewers require manager approval before accessing any dashboard content
- **Session sync:** `AuthProvider` reads role from JWT `user_metadata` (fast path — no DB round-trip) and enriches from `user_profiles` in the background

### Security

- All API routes use `requireAuthContext` server-side guard
- Bearer token fallback for SPA fetches
- No default-user fallbacks; all privileged actions require a valid session
- Environment files and secrets are fully gitignored
- Database-level RLS enforces role isolation on all 23 tables

---

## Key Features

- **3-Tier RBAC**: Platform Admin (internal ops), Manager (company carbon lead), Viewer (read-only employee) with strict route and database-level isolation.
- **Consent & Approval Gates**: Manager consent modal with digital signature; viewer approval workflow requiring manager action.
- **Emissions Data Ingestion**: Upload CSVs, receipts, and bank statements; parse and compute emissions by category/scope.
- **Analytics Dashboard**: Visualize emissions trends, breakdowns, and KPIs with interactive charts.
- **Recommendations Engine**: AI-assisted suggestions for emissions reduction, with evidence and impact modeling.
- **OCR Receipt Processing**: Upload and digitize receipts for emissions accounting.
- **TEME (Tree-Emission Matching Engine)**: Scenario planning, offset modeling, and ecological impact visualization.
- **Policy Intelligence & Compliance**: Policy radar, compliance scoring, deadlines, and evidence workflows.
- **Team Management**: Managers approve/reject employee signups, manage roles, and set permissions.
- **Viewer Portal**: Read-only dashboard for approved employees with scoped navigation.
- **Platform Admin Dashboard**: Company registry, manager oversight, pending approvals, and platform health metrics.
- **Supabase Integration**: Auth, RLS (23 tables), and persistence for all user and workflow data.
- **API-first Architecture**: All business logic exposed via Next.js route handlers and FastAPI endpoints.
- **Extensive Documentation**: Architecture, API, and user guides in `/docs`.

---
