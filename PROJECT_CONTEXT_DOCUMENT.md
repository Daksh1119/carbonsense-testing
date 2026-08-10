# CarbonSense Testing Repository - Complete Project Context Document

**Repository:** Daksh1119/carbonsense-testing  
**Visibility:** Private  
**Created:** 12 February 2026  
**Last Updated:** 39 days ago  
**Repository ID:** 1155997462

---

## 📋 Executive Summary

**CarbonSense** is an enterprise-grade, AI-powered carbon intelligence platform designed to help organizations track emissions, manage carbon reduction strategies, ensure regulatory compliance, and receive intelligent recommendations for sustainability improvements.

The repository serves as a **monorepo** containing:
- Next.js 14 frontend application
- FastAPI backend services
- Machine learning and analytics engines
- Database migrations and infrastructure code
- Testing and documentation

**Mission:** Build scientific, reduction-first carbon management with no greenwashing—combining enterprise emissions operations with AI-assisted analytics, OCR-assisted processing, and TEME (Tree-Emission Matching Engine) for comprehensive carbon offset planning.

---

## 🏗️ Architecture Overview

### Technology Stack

| Layer | Technology | Usage |
|-------|-----------|-------|
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS | Web dashboard and user interface |
| **Backend** | FastAPI, Python 3.9+ | API services and business logic |
| **State Management** | Zustand | Client-side state |
| **UI Components** | Recharts, Lucide, React Hot Toast | Visualizations and notifications |
| **Database** | Supabase (PostgreSQL-based) | Persistence and real-time features |
| **ML/Analytics** | scikit-learn, pandas, numpy | Survival modeling and analysis |
| **OCR** | Python OCR modules | Receipt digitization |

### Language Composition
- **TypeScript:** 53.5%
- **Python:** 39.3%
- **PLpgSQL:** 4%
- **Jupyter Notebook:** 2.9%
- **PowerShell:** 0.2%
- **CSS:** 0.1%

### Runtime Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER BROWSER                          │
├─────────────────────────────────────────────────────────┤
│  Next.js Frontend (http://localhost:3000)               │
│  - Dashboard & Navigation                               │
│  - Form Handling                                        │
│  - State Management (Zustand)                           │
│  - API route handlers                                   │
└─────────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌────────────────────────────────────────┐
    │  FastAPI Backend                        │
    │  (http://localhost:8000)                │
    │                                         │
    │  Router Groups:                        │
    │  - /ingestion (CSV emissions)           │
    │  - /recommendations (AI suggestions)    │
    │  - /ocr (Receipt processing)            │
    │  - /teme (Tree matching engine)         │
    │  - /policies (Policy intelligence)      │
    │  - /compliance (Regulatory tracking)    │
    └────────────────────────────────────────┘
         │
         ▼
    ┌────────────────────────────────────────┐
    │  Supabase (PostgreSQL)                  │
    │  - Organizations & Users                │
    │  - Emissions Data & Uploads             │
    │  - Recommendations & Feedback           │
    │  - TEME Projects                        │
    │  - Policy & Compliance Records          │
    │  - RLS (Row-Level Security)             │
    └────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
carbonsense-testing/
│
├── CarbonSense_FrontEnd/
│   └── frontend/                     # Next.js application
│       ├── app/
│       │   ├── (dashboard)/         # Protected dashboard routes
│       │   │   ├── dashboard/       # Executive overview
│       │   │   ├── emissions/       # Multi-step entry workflow
│       │   │   ├── analytics/       # Analytics dashboard
│       │   │   ├── recommendations/ # AI recommendations
│       │   │   ├── tree-engine/     # TEME interface
│       │   │   ├── policy-intelligence/ # Policy tracking
│       │   │   ├── compliance/      # Compliance workflows
│       │   │   ├── team-management/ # Team collaboration
│       │   │   ├── data-ingestion/  # Bulk CSV/receipt upload
│       │   │   ├── detailed-log/    # Emissions history
│       │   │   └── settings/        # Configuration
│       │   ├── test/                # Testing pages
│       │   ├── phase4-demo/         # Auth demo
│       │   └── layout.tsx           # Root layout
│       ├── components/
│       │   ├── ui/                  # Reusable UI components
│       │   └── navigation/          # Navigation components
│       ├── store/                   # Zustand state stores
│       ├── hooks/                   # Custom React hooks
│       ├── lib/                     # Utility functions
│       ├── types/                   # TypeScript definitions
│       └── services/                # API service layer
│
├── packages/
│   └── ml_services/
│       ├── api/                     # FastAPI application
│       │   └── app.py              # Entry point with routers
│       ├── emissions/               # CSV ingestion engine
│       │   └── calculator.py       # Emissions calculation logic
│       ├── ocr/                     # OCR processors
│       │   ├── receipt_processor.py
│       │   └── helpers.py
│       ├── recommendations/         # Recommendation service
│       │   ├── orchestrator.py     # Service orchestration
│       │   └── llm_integration.py  # LLM provider abstraction
│       ├── teme/                    # Tree-Emission Matching Engine
│       │   ├── core/               # Core TEME logic
│       │   ├── ml/                 # ML-assisted components
│       │   ├── simulation/         # Monte Carlo simulation
│       │   └── tests/              # TEME tests
│       ├── common/                  # Shared utilities
│       │   ├── authz.py            # Authorization helpers
│       │   └── supabase_client.py  # DB client
│       └── main.py                 # Bootstrap script
│
├── infrastructure/
│   └── supabase/
│       └── migrations/              # SQL migrations
│           ├── 20260318_recommendation_tables.sql
│           ├── 20260322_emissions_uploads.sql
│           ├── 20260414100000_policy_compliance_foundation.sql
│           ├── 20260414100100_seed_policy_compliance_data.sql
│           └── 20260414110000_policy_compliance_enhancements.sql
│
├── data/
│   ├── datasets/                    # Training datasets
│   └── raw/sample_org_data/         # Sample CSV data
│
├── scripts/
│   ├── run_single_csv_ingestion_demo.py
│   ├── test_ocr_real_receipt.py
│   ├── generate_teme_survival_dataset.py
│   ├── train_teme_survival_model.py
│   ├── train_teme_survival_production.py
│   └── verify_rls.py
│
├── tests/
│   └── unit/                        # Python unit tests
│
├── docs/
│   ├── architecture/                # Architecture docs
│   ├── api/                         # API documentation
│   └── user-guides/                 # User guides
│
├── pdf/
│   ├── Technical_Implementation_Guide.md
│   ├── Updated_Complete_Project_Plan_With_TEME_Policy.md
│   └── CarbonSense_Policy_Compliance_Plan.md
│
├── baseline_survival_model_(v1).py  # Model training
├── baseline_survival_model_(v2).py  # Improved model
├── real_anchor_raw.csv              # Sample data
├── ids.txt                          # Configuration
├── ocr_smoke_test.ps1               # PowerShell test script
├── README.md                        # Main documentation
└── .gitignore, .gitattributes      # Git configuration
```

---

## 🎯 Core Features & Capabilities

### 1. **Executive Dashboard**
- Real-time emissions overview with KPIs
- Trend visualization (2024-2026 carbon path)
- Strategy comparison (reduction vs tree planting)
- Quick action cards for main features
- Visual target tracking and progress

### 2. **Emissions Tracking & Management**
- **Multi-step form workflow:**
  - Category selection (Transport, Energy, Waste, Food)
  - Activity data entry with fuel/energy type
  - CO₂ calculation in real-time
  - Review and submit
- **Ingestion Engine:**
  - CSV parsing with canonical schema
  - Emissions calculation: kgCO2e = Activity × Emission Factor
  - Breakdown by category and scope (Scope 1, 2, 3)
  - Top employee analytics
  - KPI snapshots

### 3. **AI-Powered Recommendations**
- LLM-based suggestion engine (OpenAI-compatible)
- Heuristic fallback when LLM unavailable
- Structured recommendations with:
  - Implementation steps
  - Evidence requirements
  - Impact assessments
  - Cost-benefit analysis
- Feedback capture and session tracking
- Persistence to Supabase

### 4. **OCR Receipt Processing**
- Single receipt processing
- Bulk zip file handling
- Organization-level analytics
- File type/size validation
- Food-assist integration hooks
- Optional strict authorization enforcement

### 5. **TEME (Tree-Emission Matching Engine)**
- **Offset Plan Generation:**
  - Scientific tree species selection for CO₂ absorption
  - Time-debt analysis for offset planning
  - Geographic suitability matching (India-focused)
  - Growth rate and maintenance modeling
  - Regional location normalization
- **Constraints & Preferences:**
  - Land availability
  - Species preferences
  - Climate suitability
- **ML Compatibility:**
  - Monte Carlo simulation support
  - Survival rate modeling
  - Deterministic fallback for robustness
- **UI Alignment:**
  - "Planned trees" vs "trees to plant" terminology
  - Scenario visualization with projection curves
  - TEME project persistence

### 6. **Policy Intelligence & Compliance**
- **Policy Tracking:**
  - Policy radar visualization
  - Regulatory requirement monitoring
  - Deadline management and alerts
  - Policy-specific documentation links
  - Structured policy chat with AI advisor
- **Compliance Management:**
  - Scoring system with trend visualization
  - Deadline tracking and reminders
  - Task verification workflows
  - Evidence management and uploads
  - Audit trail and reporting
  - Compliance task overview with KPIs

### 7. **Team & Access Management**
- **Role-Based Access Control (RBAC):**
  - Admin - full system access
  - Manager - team and data management (with consent flow)
  - Analyst - view and export data
  - Data Entry Specialist - emissions entry only
  - Viewer - read-only access
- **Team Collaboration:**
  - Member invitation (individual)
  - Bulk CSV import for teams
  - Granular permission management
  - Activity tracking and audit logs
  - Consent modal for manager approval
- **Authentication:**
  - Role-specific login pages
  - Email and OAuth (Google) support
  - Session-aware context
  - Server-side auth guards

### 8. **Analytics & Insights**
- Emissions breakdown by category (pie chart)
- Scope analysis (Scope 1, 2, 3 bar chart)
- Monthly trend analysis
- Comparative analytics by department/time
- Export capabilities
- Statistical insights and forecasting

### 9. **Data Ingestion & Upload**
- CSV bulk upload
- Receipt upload (OCR-enabled)
- Bank statement analysis (future)
- Validation and error handling
- Upload history with drilldown
- Analytics per upload session

### 10. **Settings & Configuration**
- Organization settings
- User profile management
- SME (Small & Medium Enterprise) settings
- Notification preferences
- Integration configurations
- Security and API settings
- Data management and export

---

## 🔌 API Endpoints & Services

### FastAPI Router Groups

#### 1. **Ingestion Endpoints** (`/ingestion`)
```
POST /ingestion/company-csv/calculate
  - Input: multipart CSV file
  - Output: emissions totals, breakdown by category/scope, top employees, KPIs

POST /ingestion/company-csv/recommendations
  - Input: multipart CSV + organization_id + user_id + optional project metadata
  - Output: CSV summary + recommendation result
```

#### 2. **Recommendation Endpoints** (`/recommendations`)
```
POST /recommendations/generate
  - Input: emissions context + TEME context
  - Output: structured recommendations

GET /recommendations/sessions/{session_id}
  - Query: user_id
  - Output: session recommendations with metadata

POST /recommendations/sessions/{session_id}/recommendations/{recommendation_id}/feedback
  - Input: feedback data
  - Output: confirmation
```

#### 3. **OCR Endpoints** (`/ocr`)
```
GET /ocr/health
  - Output: health status

GET /ocr/capabilities
  - Output: supported file types, size limits

POST /ocr/receipt
  - Input: single receipt file
  - Output: extracted data

POST /ocr/receipts/bulk
  - Input: zip file with receipts
  - Output: bulk extraction results

GET /ocr/analytics/organization
  - Query: organization_id
  - Output: OCR metrics and insights
```

#### 4. **TEME Endpoints** (`/teme`)
```
POST /teme/run
  - Input: {
      location: string,
      land_area: number,
      preferences: {...},
      ml: {enabled: boolean},
      ml_config: {
        enable_monte_carlo: boolean,
        monte_carlo_trials: number
      }
    }
  - Output: offset plan with projections
```

#### 5. **Policy Intelligence Endpoints** (`/policies`)
```
GET /policies
  - Output: list of policies

GET /policies/{policy_id}
  - Output: policy details with documentation links

POST /policies/ask
  - Input: policy query text
  - Output: structured answer + recommendations
```

#### 6. **Compliance Endpoints** (`/compliance`)
```
GET /compliance/results
  - Output: compliance scores

GET /compliance/deadlines
  - Output: upcoming deadlines

GET /compliance/score
  - Output: current score

GET /compliance/score/history
  - Output: score trends

GET /compliance/requirements/{requirement_id}
  - Output: requirement details

GET /compliance/results/{result_id}/steps
  - Output: completion steps

GET /compliance/results/{result_id}/evidence-history
  - Output: evidence audit trail

POST /compliance/results/{result_id}/verify
  - Input: verification data
  - Output: status update

POST /compliance/evidence
  - Input: evidence file + metadata
  - Output: storage confirmation
```

#### 7. **Health Check**
```
GET /health
  - Output: service status
```

---

## 💾 Data Model & Persistence

### Supabase Database Architecture

#### Core Tables
- **organizations** - Company/organization records
- **users** - User accounts with roles
- **org_memberships** - User-organization relationships
- **permissions** - Fine-grained access control

#### Emissions Data
- **uploads** - CSV/ingestion sessions
- **emission_entries** - Individual emission records
- **emissions_totals** - Aggregated emission summaries by upload

#### Recommendations
- **recommendation_sessions** - Session metadata
- **recommendations** - Individual recommendation records
- **recommendation_feedback** - User feedback on recommendations
- **recommendation_evidence** - Supporting documentation

#### TEME
- **teme_projects** - Tree offset projects
- **teme_runs** - Simulation run results
- **tree_species** - Species database with survival rates

#### Policy & Compliance
- **policies** - Policy database with regulatory info
- **compliance_requirements** - Specific compliance tasks
- **compliance_results** - Compliance status tracking
- **compliance_evidence** - Evidence submissions
- **compliance_deadlines** - Regulatory deadlines

#### Security
- **Row-Level Security (RLS)** enforced
- Organization-level data isolation
- User role-based access restrictions

### Migrations (in infrastructure/supabase/migrations/)
1. `20260318_recommendation_tables.sql` - Core recommendation schema
2. `20260322_emissions_uploads.sql` - Emissions data tables
3. `20260322_recommendation_audit_fields.sql` - Audit trail fields
4. `20260322_seed_tree_species.sql` - Tree species lookup
5. `20260414100000_policy_compliance_foundation.sql` - Policy tables
6. `20260414100100_seed_policy_compliance_data.sql` - Policy seed data
7. `20260414110000_policy_compliance_enhancements.sql` - Compliance enhancements

---

## 🔐 Environment Configuration

### Backend Configuration (.env)

**Supabase Access (Required)**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**LLM Integration (Required for Recommendations)**
```
LLM_API_KEY=your_api_key
LLM_PROVIDER=openrouter|groq  # default: openrouter
LLM_API_BASE_URL=https://api.provider.com/v1
LLM_MODEL=model_name  # default: openrouter/auto
LLM_SITE_URL=https://your-site.com  # optional metadata
LLM_APP_NAME=CarbonSense  # optional metadata
```

**Authorization**
```
OCR_STRICT_AUTHZ=true|false  # Enforce org membership for OCR
```

### Frontend Configuration (CarbonSense_FrontEnd/frontend/.env.local)

**Required**
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID=org_id
NEXT_PUBLIC_DEFAULT_USER_ID=user_id
```

**Optional**
```
NEXT_PUBLIC_USE_TEME_MOCK=true|false  # TEME mode (local vs backend)
SUPABASE_URL=  # For server route handlers
SUPABASE_SERVICE_ROLE_KEY=  # For server route handlers
```

---

## 🚀 Local Development Setup

### Prerequisites
- Python 3.9+
- Node.js 18+
- npm
- Supabase project with migrations applied

### Backend Setup

```bash
# Navigate to root
cd carbonsense-testing

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # macOS/Linux

# Install dependencies
pip install fastapi uvicorn python-multipart requests python-dotenv supabase pandas numpy scikit-learn

# Configure backend environment
cp .env.example .env
# Edit .env with your Supabase and LLM keys

# Start FastAPI server
python -m uvicorn packages.ml_services.api.app:app --host 0.0.0.0 --port 8000 --reload

# API docs available at: http://localhost:8000/docs
```

### Frontend Setup

```bash
# Navigate to frontend
cd CarbonSense_FrontEnd/frontend

# Install dependencies
npm install

# Configure frontend environment
cp .env.example .env.local
# Edit .env.local with your Supabase and API URLs

# Start development server
npm run dev

# Open in browser: http://localhost:3000

# Production build
npm run build
npm run lint
```

### End-to-End Local Testing

1. Start backend (port 8000)
2. Start frontend (port 3000)
3. Upload CSV in Data Ingestion
4. Verify analytics update in Detailed Log
5. Generate recommendations in Recommendations page
6. Run TEME scenario and verify chart rendering
7. Test Policy Intelligence list and policy chat
8. Test Compliance score, deadlines, and evidence upload

---

## 🧪 Testing & Quality Assurance

### Python Unit Tests
```bash
python -m pytest -q
```

Tests located in: `tests/unit/`

### Frontend Validation
```bash
# Build check
npm --prefix CarbonSense_FrontEnd/frontend run build

# Linting
npm --prefix CarbonSense_FrontEnd/frontend run lint
```

### Useful Testing Scripts
- `scripts/run_single_csv_ingestion_demo.py` - CSV ingestion workflow
- `scripts/test_ocr_real_receipt.py` - OCR functionality
- `scripts/generate_teme_survival_dataset.py` - TEME dataset generation
- `scripts/train_teme_survival_model.py` - Model training
- `scripts/train_teme_survival_production.py` - Production training
- `scripts/verify_rls.py` - RLS verification

---

## ⚠️ Common Issues & Troubleshooting

### Backend Issues
| Issue | Solution |
|-------|----------|
| Missing Supabase keys | Check .env file has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY |
| Missing LLM_API_KEY | Recommendations will fall back to heuristic mode |
| CORS errors | Verify NEXT_PUBLIC_API_URL matches backend port |

### Frontend Issues
| Issue | Solution |
|-------|----------|
| API calls failing | Verify NEXT_PUBLIC_API_URL points to running backend |
| Empty policy/compliance views | Check migrations were applied to Supabase |
| TEME not working | Set NEXT_PUBLIC_USE_TEME_MOCK=true for local mode or verify backend running |

### OCR Issues
| Issue | Solution |
|-------|----------|
| OCR strict auth failing | Ensure user org membership seeded in Supabase |
| File upload errors | Check file type/size against configured limits |

### Policy/Compliance Issues
| Issue | Solution |
|-------|----------|
| Missing policies | Run policy compliance migrations |
| Policy chat errors | Verify LLM_PROVIDER and LLM_MODEL configuration |

---

## 🔒 Security & Access Control

### Authorization Framework

**Implementation:** `packages/ml_services/common/authz.py`

**Features:**
- Organization membership verification
- Permission flag validation
- Role-based endpoint protection
- Optional strict authorization for OCR

**Production Recommendations:**
1. Enable `OCR_STRICT_AUTHZ=true`
2. Properly seed org_memberships and permissions tables
3. Implement session validation on all privileged endpoints
4. Use server-side auth guards consistently
5. No default-user fallbacks in production
6. Keep .env files local and gitignored

### RLS (Row-Level Security)
- Supabase RLS policies enforce organization isolation
- Users can only see/modify their organization's data
- Service role key required for backend operations

---

## 📚 Documentation Index

### Architecture & Design
- `docs/architecture/csv_ingestion_implementation.md` - Ingestion engine design
- `pdf/Technical_Implementation_Guide.md` - System architecture
- `pdf/Updated_Complete_Project_Plan_With_TEME_Policy.md` - Comprehensive plan

### API Documentation
- `docs/api/single_csv_company_emissions_schema.md` - CSV schema specs
- `docs/api/teme_survival_dataset_schema.md` - TEME dataset format
- FastAPI auto-docs: http://localhost:8000/docs

### User Guides
- `docs/user-guides/csv_ingestion_analytics_testing.md` - Ingestion walkthrough
- `docs/user-guides/recommendations_llm_e2e.md` - Recommendations setup
- `CarbonSense_FrontEnd/frontend/README.md` - Frontend overview

### Planning Documents
- `CarbonSense_Policy_Compliance_Plan.md` - Policy compliance roadmap
- `CarbonSense_PolicyCompliance_Enhancement_Spec.md` - Enhancement specs

---

## 🎓 Key Technologies Explained

### Next.js 14 App Router
- File-based routing with nested layouts
- Server Components by default for performance
- Built-in code splitting and optimization
- API routes for backend integration

### Zustand State Management
- Lightweight alternative to Redux
- Simple hook-based API
- Persistent state support
- TypeScript-first design

### Tailwind CSS
- Utility-first CSS framework
- Custom design system via configuration
- Dark theme with glass-morphism effects
- Responsive mobile-first design

### FastAPI
- Modern async Python web framework
- Auto-generated OpenAPI documentation
- Built-in data validation with Pydantic
- High performance with Uvicorn

### Supabase
- PostgreSQL database with RLS
- Real-time subscriptions
- Built-in authentication
- Full-text search capabilities

---

## 📊 Project Maturity & Roadmap

### ✅ Implemented & Active
- Frontend operational dashboards and workflows
- CSV emissions ingestion calculation
- Recommendation generation and persistence
- OCR service routes and processors
- TEME endpoint and dashboard integration
- Supabase migration baseline
- Policy intelligence backend and UI
- Compliance scoring, deadlines, task tracking
- Evidence management with OCR integration
- Team management and RBAC

### 🚀 Roadmap & Expansions
- Deeper policy intelligence automation
- Expanded forecasting and optimization
- Production hardening for multi-tenant deployment
- Enhanced observability and monitoring
- Mobile application (React Native)
- Blockchain audit trail
- Advanced AI/ML model integration
- Broader integration ecosystem

---

## 📊 Repository Statistics

| Metric | Value |
|--------|-------|
| **Total Size** | ~9.4 MB |
| **Default Branch** | main |
| **Visibility** | Private |
| **Open Issues** | 2 |
| **License** | MIT |
| **Languages** | TypeScript, Python, PLpgSQL, Jupyter, PowerShell |
| **Latest Push** | 28 April 2026 |
| **Forks** | 0 |

---

## 🎯 Use Cases & User Flows

### 1. **Company Administrator**
1. Setup organization in Settings
2. Invite team members (individual or bulk CSV)
3. Configure permissions and roles
4. Monitor team emissions on Executive Dashboard
5. Generate reports and compliance documentation

### 2. **Emissions Data Entry Specialist**
1. Login with limited permissions
2. Enter emissions via multi-step form
3. Upload receipts for OCR processing
4. View personal contribution to total emissions
5. Submit for review/approval

### 3. **Carbon Manager**
1. Review all team submissions
2. Analyze emissions by department/category
3. Generate AI recommendations
4. Plan offset strategy with TEME
5. Track policy compliance and deadlines
6. Export reports for stakeholders

### 4. **Sustainability Officer**
1. Monitor policy compliance status
2. Track regulatory deadlines
3. Manage evidence submissions
4. Generate compliance reports
5. Access policy intelligence for guidance
6. Plan long-term sustainability strategy

### 5. **Executive/Viewer**
1. View Executive Dashboard
2. Check emissions KPIs and trends
3. Review compliance status
4. Explore offset scenarios (TEME)
5. Access high-level reports
6. No editing capabilities

---

## 🤝 Contributing Guidelines

### Code Organization
- Backend services in `packages/ml_services/`
- Frontend in `CarbonSense_FrontEnd/frontend/`
- Database migrations in `infrastructure/supabase/`
- Tests in `tests/unit/`
- Documentation in `docs/` and `pdf/`

### Development Workflow
1. Create feature branch from main
2. Make changes following project conventions
3. Run tests and linting
4. Create PR with clear description
5. Request review from maintainers

### Commit Message Format
```
feat: add new feature
fix: resolve bug
docs: update documentation
test: add or update tests
refactor: reorganize code
```

---

## 📞 Support & Contact

For issues, questions, or suggestions:
1. Check existing documentation in `docs/` and `pdf/`
2. Review troubleshooting section above
3. Check open GitHub issues
4. Contact repository maintainer: Daksh1119

---

## 📄 License

This repository is licensed under the **MIT License**.

**Built with scientific rigor. No greenwashing. Reduction-first, always.**

---

**Last Updated:** Generated on 2026-06-06  
**Document Version:** 1.0  
**Repository Version:** As of commit 19bffc9eb60886e919c79571ed436b9f15f0116a

---

## 🚀 Dynamic Platform Upgrade — August 2026

> **Document Version 2.0** — Updated to reflect the complete Groups 1–6 implementation from `CarbonSense_Dynamic_Platform_Plan (4).md`.

### New Database Tables & Columns

| Table | What Changed | Purpose |
|-------|-------------|---------|
| `organizations` | +`sector`, `company_size_category`, `employee_count`, `electricity_usage_kwh_monthly`, `computers_count`, `facility_area_sqft`, `vehicle_fleet_count`, `business_travel_km_annual`, `renewable_energy_pct`, `water_usage_kl_monthly`, `waste_generated_kg_monthly`, `working_days_per_week`, `annual_turnover_range`, `has_sustainability_certification`, `profile_status`, `profile_completed_at`, `state`, `udyam_registration_number`, `udyam_category` | Onboarding profile and baseline estimation |
| `assessment_cycles` | New table | One row per data event (upload / manual entry / profile completion). Single source of truth for all time-series analysis. |
| `recommendation_catalog` | New table | Curated intervention library per sector+category. Seeded with ~35 entries across 7 sectors (Manufacturing, IT/ITES, Textiles, Logistics, F&B, Retail, Healthcare). Also: `+is_active` for admin soft-delete. |
| `organization_policy_adoption` | New table | Tracks per-org, per-policy adoption status (not_started / in_progress / adopted / not_applicable). Feeds Compliance Action Score. |
| `recommendation_items` | New child table of `recommendation_sessions`. `+assigned_to uuid` (Group 5.2) | Per-recommendation lifecycle tracking. |
| `recommendation_sessions` | `+implementation_status`, `+status_updated_at`, `+status_updated_by`, `+source_input_type`, `+actual_impact_tco2e` | Session-level metadata |
| `policies` | `+is_active`, `+applicability text[]`, `+external_url`, `+effective_date`, `+review_date` | Admin-editable portal links and deadlines |
| `teme_runs`, `recommendation_sessions`, `policy_compliance_results` | `+cycle_id` FK | Ties all analysis runs to a specific assessment cycle |

**Postgres View:** `latest_cycle_per_org` — returns the most recent `status = 'ready'` cycle per organization. All "show latest data" queries should join through this view, not scatter `ORDER BY created_at DESC LIMIT 1` queries across the codebase.

### New API Endpoints

| Route | Method | Description |
|-------|--------|-------------|
| `POST /api/assessment-cycles/{cycle_id}/analyze` | POST | Runs TEME → recommendations → compliance for a cycle. Called automatically after upload. |
| `GET /api/assessment-cycles/{orgId}/trend` | GET | Returns time-series of cycle emissions at `weekly\|monthly\|yearly` granularity. |
| `GET /recommendations/items` | GET | Returns `recommendation_items` for the org's current cycle. |
| `PATCH /recommendations/items/{item_id}/status` | PATCH | Updates item `implementation_status`. Writes `status_updated_at`, `status_updated_by`. |

### Cycle-Based Data Flow

```
User uploads CSV / fills manual form / completes company profile
           │
           ▼
  ingestion_routes.py creates assessment_cycles row (source_type)
           │
           ▼
  POST /api/assessment-cycles/{cycle_id}/analyze
    ├── TEME forecast    → teme_runs (cycle_id)
    ├── Recommendations  → recommendation_sessions + recommendation_items (cycle_id)
    └── Compliance       → policy_compliance_results (cycle_id)
           │
           ▼
  latest_cycle_per_org view → all dashboard/analytics queries read from here
```

**Dashboard and Analytics always agree on the same total** because both read through `latest_cycle_per_org`, not independent queries.

### Role-Based Changes

| Role | New Capabilities |
|------|----------------|
| **Admin** | `/admin/recommendation-catalog` — CRUD on catalog entries without deploy. `/admin/policy-library` — edit portal URLs, deadlines, applicability tags per policy without deploy. Both pages are nav-linked in the admin sidebar. |
| **Manager** | Onboarding form at `/onboarding/company-profile` (required on first login). Partial-profile banner in dashboard layout. Per-recommendation status controls (Start / Implemented / Dismiss). **Assign To** dropdown per recommendation item to delegate to a viewer. Policy adoption status control per policy card (saves to `organization_policy_adoption`). PolicyChat enriched with live org sector/size/emissions context. Analytics granularity selector (Weekly/Monthly/Yearly). |
| **Viewer** | `/viewer/my-tasks` page — assigned recommendation items with "Start" button. `My Tasks` nav item in viewer sidebar. Email editable from Settings → Profile. |

### Policy Intelligence (3B)

- **Match score** is deterministic (0–100) computed by `_match_score_for_policy` in `packages/ml_services/policy_compliance/service.py`:
  - Sector/industry exact match: 35 pts
  - Company size / Udyam category: 25 pts
  - Emissions volume × category relevance: 20 pts
  - Mandatory/voluntary layer: 10 pts
  - Requirement breadth: 10 pts
  - State-specific bonus: +5 pts
- **PolicyDrawer** now shows: step-by-step plan (`policy.steps[]`), deadline chip, verified official gov URL (with caution note), and collapsible step list.
- **PolicyChat** sends `industry`, `organizationSize`, and `totalEmissionsKg` to the backend before every LLM call for org-specific answers.

### Compliance (3C)

- **Action Score** now has real signal: `organization_policy_adoption.status = 'adopted'` count + `recommendation_items.implementation_status = 'implemented'` count both feed it.
- **RequirementDetailModal** has an expandable AI chat scoped to the specific requirement — every question is prefixed `"Regarding the compliance requirement '...':"` before hitting the backend.

### Task Assignment (5.2)

- `recommendation_items.assigned_to` (nullable uuid FK → `user_profiles.id`).
- RLS scopes viewer writes to `assigned_to = auth.uid()` only — they cannot write anything else.
- Manager "Assign To" dropdown appears per recommendation card when the org has viewer members.
- Viewer `/viewer/my-tasks` page surfaces all items where `assigned_to = current_user_id`, active vs done separated.

### Catalog Seed Content (6.3)

`supabase/migrations/20260809_catalog_seed.sql` seeds ~35 entries covering:
- Manufacturing (10 entries: LED, VFDs, solar, steam recovery, scrap, coolant recycling)
- IT/ITES (7 entries: power mgmt, cloud migration, HVAC, carpooling, hybrid-remote, e-waste, EPEAT)
- Textiles (4 entries: condensate, solar thermal, ZLD, GOTS fibre)
- Logistics (5 entries: route optimisation, BS VI, TPMS, warehouse solar, packaging)
- F&B (4 entries: variable-speed refrigeration, food waste composting, biomass, local supply chain)
- Retail (4 entries: LED track lighting, recycled packaging, consolidated last-mile, EPR take-back)
- Healthcare (3 entries: presence sensors, BMWM segregation, HVAC recommissioning)

All entries include: typical impact range (tCO₂e/year), typical cost (INR), difficulty (Easy/Medium/Hard), and source note (BEE, CPCB, MoRTH, MNRE, GHG Protocol).

### LLM Scope Boundary (enforced throughout)

The LLM is used **only** for:
1. Open-ended conversation (PolicyChat, RequirementDetailModal chat)
2. Optional phrasing of already-selected catalog content (recommendation description rewrite)

The LLM **never**:
- Determines which policies to show (deterministic weighted score)
- Selects or ranks recommendations (catalog query + scoring function)
- Determines compliance status (rule-based matching)
- Generates government portal URLs (manually verified by admin)

Every LLM call has a non-LLM fallback: if the LLM is unavailable, catalog entries render with their stock description and the chat shows a graceful error — the recommendation set and policy match results are unaffected.

---

**Last Updated:** 2026-08-09  
**Document Version:** 2.0  
**Groups Implemented:** 1, 2, 3A, 3B, 3C, 4, 5, 6
