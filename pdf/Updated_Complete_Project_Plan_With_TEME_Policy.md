# CarbonSense AI Platform - Updated Complete Implementation Plan
## With Tree-Emission Matching Engine (TEME) & Policy/CCUS NLP Module

---

## EXECUTIVE SUMMARY

**Original Platform:** Multi-agentic AI carbon tracking with OCR, food recognition, NLP transaction categorization, time-series forecasting, XAI, behavioral RL, and blockchain.

**New Additions:**
1. **Tree-Emission Matching Engine (TEME)** - Scientific, survival-weighted tree planting recommendations with time-debt modeling
2. **Policy & CCUS NLP Module** - Automated policy document analysis (Budget 2026, CCUS guidelines) with personalized compliance advice

**Integration Approach:** These modules plug into existing Carbon Calculation Engine and NLP Service - NOT separate systems. All data flows through the same multi-agentic architecture.

**Timeline:** 48 weeks (2 semesters) with TEME introduced in Weeks 5-16, Policy NLP in Weeks 9-20, full integration in Semester 2.

---

## TABLE OF CONTENTS

1. [What's New: Detailed Feature Analysis](#1-whats-new-detailed-feature-analysis)
2. [Updated System Architecture](#2-updated-system-architecture)
3. [Database Schema Extensions](#3-database-schema-extensions)
4. [API Specifications](#4-api-specifications)
5. [Complete Feature List](#5-complete-feature-list)
6. [Week-by-Week Implementation Plan](#6-week-by-week-implementation-plan)
7. [Detailed Team Member Responsibilities](#7-detailed-team-member-responsibilities)
8. [Technical Implementation Guides](#8-technical-implementation-guides)
9. [Datasets & Resources](#9-datasets--resources)
10. [Demo & Presentation Strategy](#10-demo--presentation-strategy)

---

## 1. WHAT'S NEW: DETAILED FEATURE ANALYSIS

### 1.1 Tree-Emission Matching Engine (TEME)

**Purpose:** Provide scientifically honest tree planting recommendations that account for:
- Time delays (trees don't offset immediately)
- Survival probability (not all trees survive)
- Regional appropriateness (climate, soil, water availability)
- Risk factors (drought, fire, disease)

**Key Innovation:** Unlike typical "plant a tree, offset instantly" solutions, TEME models offsets as **time-debt** - showing users the multi-year absorption curve with survival-weighted expectations.

**Core Capabilities:**
1. **Species Recommendation Algorithm**
   - Input: User location, emission amount, soil type, water availability, budget
   - Output: Top 3 tree species with pros/cons, expected absorption timeline

2. **Survival Weighting Model**
   - Base survival rate by species (from forestry literature)
   - Regional risk adjustments (drought, fire, pests)
   - Outputs: Survival-weighted offset (SWO) = expected absorption × survival probability

3. **Time-Debt Visualization**
   - Year-by-year cumulative offset projection
   - Shows when emission is "repaid" by tree growth
   - Compares planting vs immediate reduction strategies

4. **Planting Verification System**
   - Photo upload with GPS tagging
   - Verification workflow (pending → verified → failed)
   - Integration with blockchain for immutable records

**Scientific Foundation:**
- Based on peer-reviewed silviculture research
- Uses FAO species data, local forestry guidelines
- Conservative estimates (under-promise, over-deliver)
- Transparent about uncertainties

**UX Integration:**
- Recommendation cards show: "Reduce now (100% immediate) vs Plant trees (20-year payback, 75% survival)"
- Dashboard displays time-debt curves
- XAI explains why specific species recommended (SHAP/LIME on decision factors)

---

### 1.2 Policy & CCUS NLP Module

**Purpose:** Transform policy documents into actionable, personalized guidance for users and organizations.

**Key Innovation:** Automated extraction of obligations, incentives, penalties from regulatory texts with sector-specific mapping.

**Core Capabilities:**

1. **Document Ingestion Pipeline**
   - PDF/HTML parsing of policy documents
   - OCR for scanned documents
   - Source tracking (Budget 2026, Ministry notifications, State regulations)

2. **Clause Extraction & Classification**
   - NER for: penalties, deadlines, responsible authorities, funding amounts
   - Classification: penalty | incentive | reporting | tech-mandate | funding
   - Sector tagging: cement, steel, power, transport, agriculture, etc.

3. **Personalized Policy Mapping**
   - User/org profile → Relevant policy clauses
   - Urgency scoring: immediate (< 30 days) | short-term (3-6 months) | long-term
   - Action recommendations: "File quarterly report by March 31" + template

4. **CCUS Priority Flagging**
   - Budget 2026 CCUS allocation (₹20,000 crore) extraction
   - Flag users in priority sectors (cement, steel, fertilizer)
   - Generate CCUS funding application checklist

5. **Compliance Documentation Generator**
   - Auto-generate compliance memos (PDF)
   - Include: applicable clauses, evidence of compliance, next steps
   - Audit-ready format (ISO 14064, GHG Protocol aligned)

**Budget 2026 Integration:**
- Seed database with Budget 2026 policy text
- Extract CCUS commitments, carbon market mechanisms, green financing
- Map to user sectors → personalized recommendations

**UX Integration:**
- Policy Advice Cards in dashboard: "⚠️ Action Required: Quarterly reporting due in 15 days"
- Compliance tab with checklist: ✓ Filed annual return, ⏳ Pending Q3 report
- Policy Explorer: Search/browse applicable regulations by sector

---

### 1.3 How New Features Integrate (Architecture)

**TEME Integration Points:**
```
Carbon Calculation Engine
    ↓
Emission Event Created
    ↓
Recommendation Engine
    ├─→ Behavioral Reduction (Transport Agent, Energy Agent, Food Agent)
    ├─→ TEME Planting Recommendation (new)
    │   ├─→ Species Selection Algorithm
    │   ├─→ Survival Probability Model
    │   └─→ Time-Debt Calculator
    └─→ Carbon Credit Purchase (Blockchain Service)
```

**Policy NLP Integration Points:**
```
NLP Service
    ├─→ Transaction Categorization (existing)
    ├─→ Receipt/Document Parsing (existing)
    └─→ Policy Document Analysis (new)
        ├─→ Clause Extraction
        ├─→ Sector Mapping
        └─→ Policy Advice Generator
            ↓
Agent Orchestrator
    ↓
Metadata added to all emissions → Policy-aware recommendations
```

**Data Flow Example:**
1. User (cement manufacturer) logs 500 kg CO₂ emission
2. Carbon Calculation Engine records emission
3. Recommendation Engine queries:
   - Transport Agent: "Optimize logistics" (immediate, 5% reduction)
   - Energy Agent: "Switch to LED lighting" (immediate, 10% reduction)
   - TEME: "Plant 25 Neem trees in Karnataka" (20-year payback, 70% survival)
   - Policy NLP: "You're in CCUS priority sector → Apply for ₹50L funding"
4. Dashboard shows all options with cost-benefit, time-debt, compliance impact
5. User chooses energy efficiency → Policy NLP generates documentation
6. Blockchain records action for audit trail

---

## 2. UPDATED SYSTEM ARCHITECTURE

### 2.1 High-Level Architecture (Updated Diagram)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                            │
│  Web App | Mobile App | Admin Dashboard | API Gateway           │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│              MICROSERVICES LAYER (Updated)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Carbon  │  │   TEME   │  │  Policy  │  │Analytics │       │
│  │  Calc    │  │ Service  │  │NLP Service│  │ Service  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│              AI/ML AGENT LAYER (Updated)                         │
│  Transport | Energy | Food | Waste | Procurement (existing)     │
│  TEME Agent (new) | Policy Agent (new) | Behavioral | XAI       │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYER (Extended)                         │
│  PostgreSQL + tree_species, tree_plantings, policy_clauses       │
│  MongoDB (documents) | Redis (cache) | TimescaleDB | Vector DB  │
│  Blockchain Ledger (carbon credits + tree verification)          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Service Dependencies

**TEME Service Dependencies:**
- Carbon Calculation Engine (reads emission events)
- Geolocation Service (climate zone, soil type lookup)
- Recommendation Engine (provides alternative strategies)
- Blockchain Service (verification of plantings)

**Policy NLP Service Dependencies:**
- Document Storage (S3/MinIO for policy PDFs)
- NLP Models (BERT for clause extraction)
- User/Org Service (sector mapping)
- Notification Service (deadline alerts)

---

## 3. DATABASE SCHEMA EXTENSIONS

### 3.1 New Tables (PostgreSQL)

#### A. Tree Species Table

```sql
CREATE TABLE tree_species (
    species_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scientific_name VARCHAR(255) NOT NULL UNIQUE,
    common_name VARCHAR(255),
    local_names JSONB, -- {"hindi": "नीम", "kannada": "ಬೇವು"}
    
    -- Carbon absorption characteristics
    absorption_year_1_kg DECIMAL(8,3), -- Year 1 uptake
    absorption_year_5_kg DECIMAL(8,3), -- Year 5 (typically peak)
    absorption_year_10_kg DECIMAL(8,3),
    absorption_year_20_kg DECIMAL(8,3),
    maturity_years INT, -- Years to reach steady-state absorption
    lifetime_years INT, -- Expected lifespan
    total_lifetime_absorption_kg DECIMAL(10,3), -- Total over lifetime
    
    -- Environmental suitability
    climate_zones TEXT[], -- ['tropical', 'subtropical', 'arid']
    temperature_min_c DECIMAL(5,2),
    temperature_max_c DECIMAL(5,2),
    rainfall_min_mm INT,
    rainfall_max_mm INT,
    soil_types TEXT[], -- ['loamy', 'clayey', 'sandy']
    water_need VARCHAR(20), -- 'low' | 'medium' | 'high'
    drought_tolerance VARCHAR(20), -- 'low' | 'medium' | 'high'
    salinity_tolerance VARCHAR(20),
    
    -- Regional data
    native_to TEXT[], -- ['india', 'south_asia']
    grows_well_in_states TEXT[], -- ['karnataka', 'maharashtra', 'tamil_nadu']
    invasive_in_regions TEXT[],
    
    -- Survival and risk
    baseline_survival_rate DECIMAL(3,2), -- 0.65 = 65%
    disease_resistance VARCHAR(20), -- 'low' | 'medium' | 'high'
    pest_resistance VARCHAR(20),
    fire_risk VARCHAR(20),
    
    -- Practical considerations
    growth_rate VARCHAR(20), -- 'slow' | 'medium' | 'fast'
    maintenance_level VARCHAR(20), -- 'low' | 'medium' | 'high'
    cost_per_sapling DECIMAL(8,2), -- In INR
    planting_season TEXT[], -- ['monsoon', 'winter']
    
    -- Additional benefits
    provides_fruit BOOLEAN DEFAULT FALSE,
    provides_timber BOOLEAN DEFAULT FALSE,
    provides_shade BOOLEAN DEFAULT FALSE,
    supports_wildlife BOOLEAN DEFAULT FALSE,
    nitrogen_fixing BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    data_source TEXT, -- 'FAO', 'Indian Council of Forestry Research'
    scientific_paper_ref TEXT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_verified BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_tree_species_climate ON tree_species USING GIN(climate_zones);
CREATE INDEX idx_tree_species_states ON tree_species USING GIN(grows_well_in_states);
CREATE INDEX idx_tree_species_survival ON tree_species(baseline_survival_rate);
```

**Sample Data (Neem Tree):**
```sql
INSERT INTO tree_species (
    scientific_name, common_name, local_names,
    absorption_year_1_kg, absorption_year_5_kg, absorption_year_10_kg, absorption_year_20_kg,
    maturity_years, lifetime_years, total_lifetime_absorption_kg,
    climate_zones, temperature_min_c, temperature_max_c, rainfall_min_mm, rainfall_max_mm,
    soil_types, water_need, drought_tolerance,
    native_to, grows_well_in_states,
    baseline_survival_rate, disease_resistance, pest_resistance,
    growth_rate, maintenance_level, cost_per_sapling, planting_season,
    provides_shade, supports_wildlife, nitrogen_fixing,
    data_source
) VALUES (
    'Azadirachta indica', 'Neem', '{"hindi": "नीम", "kannada": "ಬೇವು", "tamil": "வேம்பு"}',
    8.5, 35.0, 50.0, 60.0,
    10, 200, 8000,
    ARRAY['tropical', 'subtropical'], 15.0, 44.0, 400, 1200,
    ARRAY['loamy', 'clayey', 'sandy'], 'medium', 'high',
    ARRAY['india', 'south_asia'], ARRAY['karnataka', 'maharashtra', 'tamil_nadu', 'andhra_pradesh', 'telangana'],
    0.75, 'high', 'high',
    'medium', 'low', 50.00, ARRAY['monsoon'],
    TRUE, TRUE, TRUE,
    'Indian Council of Forestry Research'
);
```

---

#### B. Tree Plantings Table

```sql
CREATE TABLE tree_plantings (
    planting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(org_id) ON DELETE SET NULL,
    
    -- Planting details
    species_id UUID REFERENCES tree_species(species_id) NOT NULL,
    planted_count INT NOT NULL CHECK (planted_count > 0),
    planting_date DATE NOT NULL,
    
    -- Location
    geo_location GEOGRAPHY(POINT),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(50) DEFAULT 'India',
    
    -- Carbon offset calculations
    expected_total_absorption_kg DECIMAL(10,3), -- Sum over lifetime
    survival_weighted_offset_kg DECIMAL(10,3), -- Adjusted for survival rate
    time_debt_profile JSONB, -- {"2026": 85, "2027": 170, "2028": 255, ...}
    risk_adjusted_offset_kg DECIMAL(10,3), -- After climate risk adjustment
    
    -- Survival tracking
    baseline_survival_rate DECIMAL(3,2), -- From tree_species
    regional_risk_factor DECIMAL(3,2), -- 0.9 = 10% additional risk
    final_survival_probability DECIMAL(3,2), -- baseline × regional_risk
    
    -- Risk factors
    drought_risk_score INT, -- 0-10
    fire_risk_score INT,
    disease_risk_score INT,
    overall_risk_assessment VARCHAR(20), -- 'low' | 'medium' | 'high'
    
    -- Verification
    verification_status VARCHAR(20) DEFAULT 'pending', -- pending | verified | failed | monitoring
    verification_docs JSONB, -- [{"type": "photo", "url": "...", "date": "..."}, ...]
    verification_date TIMESTAMP,
    verified_by UUID REFERENCES users(user_id),
    
    -- Monitoring (optional - for advanced tracking)
    survival_check_dates JSONB, -- [{"date": "2026-06-15", "alive": 22, "dead": 3}, ...]
    actual_survival_rate DECIMAL(3,2),
    
    -- Blockchain integration
    blockchain_tx_hash VARCHAR(255),
    nft_token_id VARCHAR(255), -- If tokenized as NFT
    
    -- Cost tracking
    total_cost DECIMAL(10,2),
    cost_per_tree DECIMAL(8,2),
    funded_by VARCHAR(50), -- 'self' | 'corporate' | 'government' | 'platform'
    
    -- Metadata
    notes TEXT,
    planting_partner VARCHAR(255), -- NGO or agency that helped
    maintenance_plan TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_tree_plantings_user ON tree_plantings(user_id);
CREATE INDEX idx_tree_plantings_org ON tree_plantings(organization_id);
CREATE INDEX idx_tree_plantings_species ON tree_plantings(species_id);
CREATE INDEX idx_tree_plantings_date ON tree_plantings(planting_date);
CREATE INDEX idx_tree_plantings_location ON tree_plantings USING GIST(geo_location);
CREATE INDEX idx_tree_plantings_status ON tree_plantings(verification_status);

-- Trigger for updated_at
CREATE TRIGGER update_tree_plantings_timestamp
BEFORE UPDATE ON tree_plantings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

#### C. Policy Clauses Table

```sql
CREATE TABLE policy_clauses (
    clause_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source document
    source_document VARCHAR(500) NOT NULL, -- 'Union Budget 2026', 'CCUS Guidelines 2025'
    document_type VARCHAR(50), -- 'budget' | 'regulation' | 'guideline' | 'notification'
    document_date DATE,
    document_url TEXT,
    issuing_authority VARCHAR(255), -- 'Ministry of Environment', 'Central Govt'
    jurisdiction VARCHAR(100), -- 'National' | 'Maharashtra' | 'Pune Municipal'
    
    -- Extracted clause
    clause_text TEXT NOT NULL,
    clause_number VARCHAR(50), -- 'Section 4.3.2'
    page_number INT,
    
    -- Classification
    clause_type VARCHAR(50) NOT NULL, -- penalty | incentive | reporting | tech-mandate | funding | guideline
    severity_score INT CHECK (severity_score BETWEEN 0 AND 10), -- 10 = most critical
    urgency VARCHAR(20), -- 'immediate' | 'short-term' | 'long-term'
    
    -- Affected parties
    affected_sectors TEXT[], -- ['cement', 'steel', 'power', 'transport']
    affected_organization_sizes TEXT[], -- ['large', 'sme', 'individual']
    geographic_scope TEXT[], -- ['all-india', 'maharashtra', 'mumbai']
    
    -- Extracted entities (NER results)
    extracted_entities JSONB, 
    /* Example:
    {
        "penalties": ["₹10 lakh fine", "license suspension"],
        "deadlines": ["31st March 2026"],
        "authorities": ["State Pollution Control Board"],
        "funding_amounts": ["₹20,000 crore"],
        "target_sectors": ["cement", "steel"],
        "emission_thresholds": ["500 tonnes CO2/year"]
    }
    */
    
    -- Actionable requirements
    requires_reporting BOOLEAN DEFAULT FALSE,
    reporting_frequency VARCHAR(50), -- 'quarterly' | 'annual'
    requires_technology BOOLEAN DEFAULT FALSE,
    technology_types TEXT[], -- ['CCUS', 'renewable_energy', 'energy_efficiency']
    
    -- Financial implications
    has_penalty BOOLEAN DEFAULT FALSE,
    penalty_amount_min DECIMAL(15,2),
    penalty_amount_max DECIMAL(15,2),
    has_incentive BOOLEAN DEFAULT FALSE,
    incentive_amount DECIMAL(15,2),
    incentive_type VARCHAR(50), -- 'grant' | 'tax_credit' | 'subsidy'
    
    -- Compliance tracking
    compliance_deadline DATE,
    is_mandatory BOOLEAN DEFAULT TRUE,
    
    -- CCUS specific (for Budget 2026)
    is_ccus_related BOOLEAN DEFAULT FALSE,
    ccus_priority_level INT, -- 1 (highest) to 5 (lowest)
    
    -- Metadata
    extraction_confidence DECIMAL(3,2), -- 0.95 = 95% confidence
    extracted_by VARCHAR(50), -- 'manual' | 'nlp_model_v1'
    extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by UUID REFERENCES users(user_id),
    review_status VARCHAR(20) DEFAULT 'pending', -- pending | approved | rejected
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_policy_clauses_type ON policy_clauses(clause_type);
CREATE INDEX idx_policy_clauses_sectors ON policy_clauses USING GIN(affected_sectors);
CREATE INDEX idx_policy_clauses_urgency ON policy_clauses(urgency);
CREATE INDEX idx_policy_clauses_ccus ON policy_clauses(is_ccus_related) WHERE is_ccus_related = TRUE;
CREATE INDEX idx_policy_clauses_deadline ON policy_clauses(compliance_deadline) WHERE compliance_deadline IS NOT NULL;
```

**Sample Data (Budget 2026 CCUS Clause):**
```sql
INSERT INTO policy_clauses (
    source_document, document_type, document_date, issuing_authority, jurisdiction,
    clause_text, clause_type, severity_score, urgency,
    affected_sectors, extracted_entities,
    is_ccus_related, ccus_priority_level,
    has_incentive, incentive_amount, incentive_type
) VALUES (
    'Union Budget 2026',
    'budget',
    '2026-02-01',
    'Ministry of Finance',
    'all-india',
    'Allocation of ₹20,000 crore for Carbon Capture, Utilization and Storage (CCUS) technologies in priority sectors including cement, steel, and fertilizer manufacturing.',
    'funding',
    9,
    'short-term',
    ARRAY['cement', 'steel', 'fertilizer'],
    '{
        "funding_amounts": ["₹20,000 crore"],
        "target_sectors": ["cement", "steel", "fertilizer"],
        "technologies": ["CCUS"]
    }',
    TRUE,
    1,
    TRUE,
    200000000000.00,
    'grant'
);
```

---

#### D. Policy Advice Table

```sql
CREATE TABLE policy_advice (
    advice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Target
    user_id UUID REFERENCES users(user_id),
    organization_id UUID REFERENCES organizations(org_id),
    
    -- Source clause
    clause_id UUID REFERENCES policy_clauses(clause_id) NOT NULL,
    
    -- Generated advice
    advice_title VARCHAR(255) NOT NULL,
    advice_text TEXT NOT NULL,
    actionable_steps JSONB, 
    /* Example:
    [
        {"step": 1, "action": "Conduct energy audit", "deadline": "2026-03-31", "priority": "high"},
        {"step": 2, "action": "Submit CCUS funding application", "deadline": "2026-06-30", "priority": "medium"}
    ]
    */
    
    -- Categorization
    urgency VARCHAR(20) NOT NULL, -- immediate | short-term | long-term
    priority_score INT CHECK (priority_score BETWEEN 0 AND 10),
    estimated_impact VARCHAR(20), -- 'high' | 'medium' | 'low'
    
    -- Supporting documents
    document_templates JSONB, -- Links to compliance templates
    reference_links TEXT[],
    
    -- Compliance status
    status VARCHAR(20) DEFAULT 'pending', -- pending | in-progress | completed | dismissed
    completion_date DATE,
    notes TEXT,
    
    -- Notifications
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_date TIMESTAMP,
    reminder_schedule JSONB, -- [{"date": "2026-03-01", "sent": true}, ...]
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_policy_advice_user ON policy_advice(user_id);
CREATE INDEX idx_policy_advice_org ON policy_advice(organization_id);
CREATE INDEX idx_policy_advice_clause ON policy_advice(clause_id);
CREATE INDEX idx_policy_advice_urgency ON policy_advice(urgency);
CREATE INDEX idx_policy_advice_status ON policy_advice(status);
```

---

#### E. TEME Recommendations Table (Optional - for tracking)

```sql
CREATE TABLE teme_recommendations (
    recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Context
    user_id UUID REFERENCES users(user_id),
    emission_record_id UUID REFERENCES carbon_transactions(transaction_id),
    
    -- Input parameters
    emission_amount_kg DECIMAL(10,3),
    user_location GEOGRAPHY(POINT),
    climate_zone VARCHAR(50),
    soil_type VARCHAR(50),
    water_availability VARCHAR(20),
    budget_constraint DECIMAL(10,2),
    
    -- Recommendations
    recommended_species JSONB,
    /* Example:
    [
        {
            "species_id": "uuid",
            "species_name": "Neem",
            "count": 25,
            "expected_offset_kg": 1250,
            "survival_weighted_offset_kg": 937,
            "time_to_full_offset_years": 15,
            "total_cost": 1250,
            "risk_assessment": "low",
            "pros": ["Drought resistant", "Low maintenance", "Multiple benefits"],
            "cons": ["Slower initial growth"]
        },
        ...
    ]
    */
    
    -- Alternative strategies
    reduction_alternatives JSONB,
    /* Example:
    [
        {"strategy": "Switch to LED lighting", "immediate_reduction_kg": 150, "cost": 5000, "roi_months": 6},
        {"strategy": "Optimize transport routes", "immediate_reduction_kg": 80, "cost": 0, "roi_months": 0}
    ]
    */
    
    -- User decision
    chosen_strategy VARCHAR(50), -- 'planting' | 'reduction' | 'mixed' | 'none'
    chosen_species_id UUID REFERENCES tree_species(species_id),
    
    -- Metadata
    algorithm_version VARCHAR(20),
    confidence_score DECIMAL(3,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_teme_recommendations_user ON teme_recommendations(user_id);
CREATE INDEX idx_teme_recommendations_emission ON teme_recommendations(emission_record_id);
```

---

### 3.2 Modified Existing Tables

#### Carbon Transactions Table (Add Policy Context)

```sql
-- Add columns to existing carbon_transactions table
ALTER TABLE carbon_transactions ADD COLUMN policy_clause_ids UUID[];
ALTER TABLE carbon_transactions ADD COLUMN policy_advice_ids UUID[];
ALTER TABLE carbon_transactions ADD COLUMN teme_recommendation_id UUID REFERENCES teme_recommendations(recommendation_id);

-- Index for policy lookups
CREATE INDEX idx_carbon_transactions_policy ON carbon_transactions USING GIN(policy_clause_ids);
```

#### Users Table (Add CCUS Sector Flag)

```sql
-- Add columns to users/organizations table
ALTER TABLE users ADD COLUMN primary_sector VARCHAR(100);
ALTER TABLE users ADD COLUMN is_ccus_priority_sector BOOLEAN DEFAULT FALSE;

-- For organizations
ALTER TABLE organizations ADD COLUMN sectors TEXT[];
ALTER TABLE organizations ADD COLUMN is_ccus_eligible BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN annual_emissions_tonnes DECIMAL(12,3);
```

---

## 4. API SPECIFICATIONS

### 4.1 TEME Service APIs

#### A. Get Species Recommendations

**Endpoint:** `POST /api/v1/teme/recommend`

**Request:**
```json
{
  "user_id": "uuid",
  "emission_amount_kg": 500,
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "city": "Bangalore",
    "state": "Karnataka"
  },
  "soil_type": "loamy",
  "water_availability": "medium",
  "budget": 10000,
  "planting_season": "monsoon"
}
```

**Response:**
```json
{
  "success": true,
  "recommendations": [
    {
      "rank": 1,
      "species": {
        "id": "uuid",
        "scientific_name": "Azadirachta indica",
        "common_name": "Neem",
        "local_name": "ಬೇವು"
      },
      "planting_recommendation": {
        "count": 25,
        "cost_per_tree": 50,
        "total_cost": 1250,
        "planting_season": ["monsoon"],
        "maintenance_level": "low"
      },
      "offset_projection": {
        "expected_total_offset_kg": 1250,
        "survival_weighted_offset_kg": 937,
        "final_survival_probability": 0.75,
        "time_to_full_offset_years": 15,
        "yearly_breakdown": {
          "2026": 85,
          "2027": 170,
          "2028": 255,
          "2030": 425,
          "2035": 850,
          "2041": 1250
        }
      },
      "risk_assessment": {
        "overall_risk": "low",
        "drought_risk": 2,
        "fire_risk": 1,
        "disease_risk": 1,
        "regional_risk_factor": 0.95
      },
      "suitability_score": 0.92,
      "pros": [
        "Excellent drought tolerance",
        "Low maintenance requirements",
        "Provides shade and medicinal benefits",
        "High survival rate in Karnataka"
      ],
      "cons": [
        "Moderate initial growth rate",
        "Takes 5-7 years to reach peak absorption"
      ],
      "additional_benefits": [
        "Supports local wildlife",
        "Nitrogen fixing improves soil",
        "Can provide neem oil as income"
      ]
    },
    {
      "rank": 2,
      "species": { "..." },
      "..."
    },
    {
      "rank": 3,
      "species": { "..." },
      "..."
    }
  ],
  "alternative_strategies": [
    {
      "type": "immediate_reduction",
      "action": "Switch to LED lighting",
      "immediate_offset_kg": 150,
      "cost": 5000,
      "roi_months": 6,
      "implementation_time": "1 week"
    },
    {
      "type": "immediate_reduction",
      "action": "Optimize delivery routes",
      "immediate_offset_kg": 80,
      "cost": 0,
      "roi_months": 0,
      "implementation_time": "immediate"
    }
  ],
  "comparison": {
    "planting_trees": {
      "offset_kg": 937,
      "cost": 1250,
      "time_years": 15,
      "cost_per_kg": 1.33
    },
    "immediate_reduction": {
      "offset_kg": 230,
      "cost": 5000,
      "time_years": 0,
      "cost_per_kg": 21.74
    },
    "recommendation": "Consider immediate reductions first (100% certain), then supplement with tree planting for long-term impact."
  }
}
```

---

#### B. Create Planting Record

**Endpoint:** `POST /api/v1/teme/plantings`

**Request:**
```json
{
  "user_id": "uuid",
  "species_id": "uuid",
  "planted_count": 25,
  "planting_date": "2026-06-15",
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "address": "Bannerghatta Forest, Bangalore",
    "city": "Bangalore",
    "state": "Karnataka"
  },
  "total_cost": 1250,
  "notes": "Planted with local NGO 'Green Bangalore'",
  "planting_partner": "Green Bangalore NGO"
}
```

**Response:**
```json
{
  "success": true,
  "planting_id": "uuid",
  "verification_status": "pending",
  "next_steps": [
    "Upload planting photos within 7 days",
    "Include GPS-tagged images showing saplings",
    "NGO verification certificate (if available)",
    "Schedule first survival check in 3 months"
  ],
  "upload_url": "/api/v1/teme/plantings/uuid/upload"
}
```

---

#### C. Upload Verification

**Endpoint:** `POST /api/v1/teme/plantings/:id/verify`

**Request:** Multipart form data
- `photo1`: File (image with GPS EXIF data)
- `photo2`: File
- `photo3`: File
- `notes`: Text

**Response:**
```json
{
  "success": true,
  "verification_status": "verified",
  "verified_at": "2026-06-22T10:30:00Z",
  "photos_accepted": 3,
  "blockchain_tx_hash": "0x...",
  "nft_token_id": "carbon-tree-001",
  "message": "Planting verified! Your offset will be tracked over 20 years."
}
```

---

#### D. Get Time-Debt Projection

**Endpoint:** `GET /api/v1/teme/plantings/:id/projection`

**Response:**
```json
{
  "planting_id": "uuid",
  "species": "Neem",
  "planted_count": 25,
  "planting_date": "2026-06-15",
  "current_age_years": 0,
  "survival_status": "monitoring",
  "cumulative_offset_to_date_kg": 0,
  "projected_timeline": [
    {
      "year": 2026,
      "age": 0,
      "annual_absorption_kg": 85,
      "cumulative_offset_kg": 85,
      "survival_probability": 0.75,
      "survival_weighted_cumulative_kg": 64
    },
    {
      "year": 2027,
      "age": 1,
      "annual_absorption_kg": 95,
      "cumulative_offset_kg": 180,
      "survival_probability": 0.74,
      "survival_weighted_cumulative_kg": 133
    },
    "..."
  ],
  "visualization_data": {
    "x_axis": [2026, 2027, 2028, "..."],
    "y_expected": [85, 180, 280, "..."],
    "y_survival_weighted": [64, 133, 210, "..."],
    "y_actual": [null, null, null, "..."]
  }
}
```

---

### 4.2 Policy NLP Service APIs

#### A. Ingest Policy Document

**Endpoint:** `POST /api/v1/policy/ingest`

**Request:**
```json
{
  "document_name": "Union Budget 2026",
  "document_type": "budget",
  "document_date": "2026-02-01",
  "issuing_authority": "Ministry of Finance",
  "jurisdiction": "all-india",
  "document_url": "https://...",
  "pdf_file": "base64_encoded_or_s3_url"
}
```

**Response:**
```json
{
  "success": true,
  "document_id": "uuid",
  "processing_status": "queued",
  "estimated_time_minutes": 10,
  "status_url": "/api/v1/policy/documents/uuid/status"
}
```

---

#### B. Get Extracted Clauses

**Endpoint:** `GET /api/v1/policy/clauses?sector=cement&type=funding&ccus=true`

**Response:**
```json
{
  "success": true,
  "count": 5,
  "clauses": [
    {
      "clause_id": "uuid",
      "source_document": "Union Budget 2026",
      "clause_text": "Allocation of ₹20,000 crore for CCUS...",
      "clause_type": "funding",
      "severity_score": 9,
      "affected_sectors": ["cement", "steel", "fertilizer"],
      "has_incentive": true,
      "incentive_amount": 200000000000,
      "is_ccus_related": true,
      "compliance_deadline": null,
      "extracted_entities": {
        "funding_amounts": ["₹20,000 crore"],
        "target_sectors": ["cement", "steel", "fertilizer"]
      }
    },
    "..."
  ]
}
```

---

#### C. Get Personalized Policy Advice

**Endpoint:** `GET /api/v1/policy/advice?user_id=uuid`

**Response:**
```json
{
  "success": true,
  "user_profile": {
    "user_id": "uuid",
    "organization": "ABC Cement Ltd",
    "sector": "cement",
    "is_ccus_eligible": true,
    "annual_emissions_tonnes": 15000
  },
  "advice": [
    {
      "advice_id": "uuid",
      "urgency": "short-term",
      "priority_score": 9,
      "advice_title": "Apply for CCUS Funding from Budget 2026",
      "advice_text": "Your cement manufacturing facility is eligible for Carbon Capture, Utilization and Storage (CCUS) funding under Budget 2026. The government has allocated ₹20,000 crore for priority sectors including cement.",
      "actionable_steps": [
        {
          "step": 1,
          "action": "Conduct baseline emissions audit",
          "deadline": "2026-03-31",
          "priority": "high",
          "estimated_time": "2 weeks",
          "cost_estimate": 50000
        },
        {
          "step": 2,
          "action": "Prepare CCUS technical feasibility report",
          "deadline": "2026-05-31",
          "priority": "high",
          "estimated_time": "6 weeks",
          "cost_estimate": 200000
        },
        {
          "step": 3,
          "action": "Submit funding application to Ministry",
          "deadline": "2026-06-30",
          "priority": "critical",
          "estimated_time": "2 weeks",
          "cost_estimate": 0
        }
      ],
      "document_templates": [
        {
          "name": "CCUS Funding Application Template",
          "url": "/api/v1/policy/templates/ccus-funding"
        },
        {
          "name": "Baseline Emissions Report Format",
          "url": "/api/v1/policy/templates/baseline-emissions"
        }
      ],
      "estimated_impact": "high",
      "potential_funding": "₹50-100 lakh",
      "source_clause_id": "uuid"
    },
    {
      "advice_id": "uuid",
      "urgency": "immediate",
      "priority_score": 8,
      "advice_title": "Quarterly Emissions Reporting Due",
      "advice_text": "Your organization is required to file quarterly emissions report by 31st March 2026.",
      "..."
    }
  ],
  "compliance_summary": {
    "pending_actions": 3,
    "immediate_deadlines": 1,
    "funding_opportunities": 2,
    "potential_penalties": 0
  }
}
```

---

#### D. Generate Compliance Document

**Endpoint:** `POST /api/v1/policy/generate-compliance-doc`

**Request:**
```json
{
  "user_id": "uuid",
  "organization_id": "uuid",
  "document_type": "ccus_funding_application",
  "clause_ids": ["uuid1", "uuid2"],
  "include_sections": [
    "executive_summary",
    "current_emissions",
    "proposed_ccus_technology",
    "financial_projections",
    "compliance_evidence"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "document_id": "uuid",
  "document_url": "/api/v1/policy/documents/uuid/download",
  "format": "pdf",
  "pages": 25,
  "sections_included": [
    "Executive Summary",
    "Current Emissions Profile",
    "Proposed CCUS Technology",
    "Financial Projections",
    "Compliance Evidence"
  ],
  "generated_at": "2026-02-15T14:30:00Z"
}
```

---

### 4.3 Integration APIs (Connecting Services)

#### Recommendation Engine with TEME

**Internal API:** `POST /internal/recommendations/generate`

**Request:**
```json
{
  "emission_event_id": "uuid",
  "emission_amount_kg": 500,
  "category": "transport",
  "include_teme": true,
  "include_policy_context": true
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "type": "immediate_reduction",
      "agent": "transport",
      "action": "Switch to electric vehicle",
      "..."
    },
    {
      "type": "tree_planting",
      "agent": "teme",
      "teme_recommendation_id": "uuid",
      "..."
    },
    {
      "type": "policy_action",
      "agent": "policy",
      "advice_id": "uuid",
      "..."
    }
  ],
  "policy_context": {
    "applicable_clauses": ["uuid1", "uuid2"],
    "compliance_implications": "..."
  }
}
```

---

## 5. COMPLETE FEATURE LIST

### 5.1 Existing Features (Retained)

**✅ Core Platform Features:**
1. User authentication (individual + organization)
2. Carbon transaction tracking (manual entry)
3. Receipt OCR (Tesseract + EasyOCR)
4. Food image recognition (EfficientNet-B4)
5. Bank transaction categorization (FinBERT)
6. Waste classification (YOLO v8)
7. Time-series forecasting (Prophet + TFT)
8. Explainable AI (SHAP + LIME)
9. Recommendation engine
10. Behavioral RL nudging (DQN)
11. Gamification (badges, leaderboards, challenges)
12. Blockchain carbon credits
13. Multi-user organizations
14. Analytics dashboard
15. Mobile app (React Native)

---

### 5.2 New TEME Features

**🌳 Tree-Emission Matching Engine:**

1. **Species Recommendation System**
   - Input parameters: location, climate, soil, water, budget
   - Machine learning model for species selection
   - Ranking algorithm (suitability × absorption × survival)
   - Top-3 recommendations with pros/cons

2. **Survival Probability Model**
   - Baseline survival rates by species
   - Regional risk adjustments (drought, fire, disease)
   - Climate stress scoring
   - Historical data validation

3. **Time-Debt Calculator**
   - Year-by-year absorption projection
   - Cumulative offset timeline
   - Payback period calculation
   - Visual curve generation

4. **Planting Workflow**
   - Create planting record
   - Photo upload with GPS tagging
   - Verification workflow (manual + automated)
   - Blockchain immutability

5. **Monitoring & Tracking**
   - Survival check reminders
   - Actual vs expected comparison
   - Update survival rates based on real data
   - Long-term impact tracking

6. **TEME Dashboard**
   - User's planting history
   - Total offset (expected vs weighted)
   - Time-debt visualization
   - Comparison: planting vs reduction

7. **Integration with Recommendations**
   - TEME as recommendation option
   - Side-by-side comparison with behavioral changes
   - Cost-benefit analysis
   - XAI for planting recommendations

---

### 5.3 New Policy NLP Features

**📜 Policy & CCUS Intelligence:**

1. **Document Ingestion Pipeline**
   - PDF/HTML upload
   - OCR for scanned documents
   - Document metadata extraction
   - Version tracking

2. **Clause Extraction Engine**
   - NER for entities (penalties, deadlines, amounts)
   - Sentence segmentation
   - Clause classification (ML model)
   - Confidence scoring

3. **Sector Mapping**
   - Keyword-based sector tagging
   - User/org profile matching
   - Relevance scoring
   - Multi-sector clause handling

4. **Policy Advice Generator**
   - Clause → Actionable steps transformation
   - Urgency prioritization
   - Deadline tracking
   - Template generation

5. **Budget 2026 Integration**
   - Seeded CCUS clauses
   - Priority sector flagging
   - Funding opportunity alerts
   - CCUS application workflow

6. **Compliance Dashboard**
   - Pending actions list
   - Deadline calendar
   - Completion tracking
   - Audit trail

7. **Document Generator**
   - Compliance memo PDF
   - CCUS funding application
   - Quarterly report template
   - GHG Protocol format

8. **Notification System**
   - Deadline reminders (email, push, in-app)
   - New policy alerts
   - Urgency-based prioritization
   - Customizable frequency

---

## 6. WEEK-BY-WEEK IMPLEMENTATION PLAN

### SEMESTER 1 (Weeks 1-24)

---

#### **MONTH 1: Project Setup & Infrastructure (Weeks 1-4)**

**Week 1-2: Environment Setup & Team Organization**
*(Same as original plan - no changes)*

**Deliverables:** Git repository, architecture docs, development environments

---

**Week 3: Backend Foundation + TEME Database Design**

**Core Tasks:**
- Set up Express.js server
- Configure PostgreSQL + MongoDB + Redis
- Basic logging and error handling

**NEW: TEME Database Setup**
- Create `tree_species` table schema
- Create `tree_plantings` table schema
- Set up PostGIS extension for geography type
- Design indices for spatial queries

**Team Responsibilities:**
- **Member 2 (Backend - Lead):**
  - Express server setup (4 hours)
  - Database connections (3 hours)
  - tree_species table creation (2 hours)
  - tree_plantings table creation (2 hours)
  - PostGIS setup (2 hours)
  
- **Member 3 (ML/Data - Support):**
  - Research tree species data sources (3 hours)
  - Prepare sample species JSON (20 species) (4 hours)
  - Create seeding script (2 hours)

**Deliverable:** Backend server + TEME database schema ready

---

**Week 4: Authentication System**
*(Same as original plan)*

**Deliverable:** Complete auth system with JWT

---

#### **MONTH 2: Data Ingestion & Carbon Calculation (Weeks 5-8)**

**Week 5: Manual Carbon Entry + Tree Species Seeding**

**Core Tasks:**
- Carbon transaction forms (transport, energy, food, waste)
- Carbon calculation engine basic

**NEW: Tree Species Database**
- Seed 20+ tree species with full data
- Add Indian regional species (Neem, Peepal, Banyan, etc.)
- Validate absorption curves from literature

**Team Responsibilities:**
- **Member 1 (Frontend - 50%):**
  - Carbon entry forms UI (10 hours)
  - Category selection dropdowns (3 hours)
  
- **Member 2 (Backend - 30%):**
  - Carbon transactions API (6 hours)
  - Calculation engine basic (4 hours)
  
- **Member 3 (ML/Data - 20%):**
  - **Tree species data collection (5 hours)**
  - **Seed database with 20+ species (3 hours)**
  - **Validate absorption data (2 hours)**

**Deliverable:** Manual entry working + 20 tree species in database

---

**Week 6: Dashboard & Visualization**
*(Same as original plan)*

**Deliverable:** Interactive dashboard

---

**Week 7: Receipt OCR - Part 1**
*(Same as original plan)*

**Deliverable:** OCR service basic working

---

**Week 8: Receipt OCR - Part 2 + TEME Concept**

**Core Tasks:**
- Receipt NER and carbon mapping
- Integration with dashboard

**NEW: TEME Time-Debt Concept**
- Design time-debt data structure
- Create absorption curve calculator (Python function)
- Design UI mockups for time-debt visualization

**Team Responsibilities:**
- **Member 3 (ML/Data - Lead):**
  - NER model training (8 hours)
  - Carbon mapping logic (5 hours)
  - **Time-debt calculator function (4 hours)**
  - **Absorption curve generation (3 hours)**
  
- **Member 1 (Frontend - Support):**
  - OCR results UI (5 hours)
  - **Time-debt visualization mockups (3 hours)**

**Deliverable:** Receipt OCR complete + Time-debt calculator prototype

---

#### **MONTH 3: Computer Vision & NLP (Weeks 9-12)**

**Week 9: Food Image Recognition + Policy Doc Ingestion Start**

**Core Tasks:**
- Food-101 model training
- EfficientNet fine-tuning

**NEW: Policy Document Ingestion Pipeline**
- PDF upload endpoint
- OCR for scanned PDFs (PyMuPDF + Tesseract)
- Text extraction and chunking
- Store in MongoDB

**Team Responsibilities:**
- **Member 3 (ML/Data - Lead):**
  - Food model training (10 hours)
  - **Policy PDF parsing setup (5 hours)**
  - **Text extraction pipeline (5 hours)**
  
- **Member 2 (Backend - Support):**
  - Food recognition API (3 hours)
  - **Policy upload API (4 hours)**
  - **MongoDB document storage (2 hours)**

**Deliverable:** Food recognition basic + Policy ingestion pipeline

---

**Week 10: Food Carbon Calculation + Policy NER Start**

**Core Tasks:**
- Food carbon database
- Portion estimation

**NEW: Policy Clause Extraction (NER)**
- BERT fine-tuning for clause extraction
- Entity recognition (penalties, deadlines, amounts)
- Create `policy_clauses` table

**Team Responsibilities:**
- **Member 3 (ML/Data - Lead):**
  - Food carbon database (4 hours)
  - **Policy NER model setup (8 hours)**
  - **Train on Budget 2026 sample (5 hours)**
  - **Test extraction accuracy (3 hours)**
  
- **Member 2 (Backend - Support):**
  - **policy_clauses table creation (2 hours)**
  - **Clause storage API (3 hours)**

**Deliverable:** Food recognition complete + Policy NER prototype (20 clauses extracted from Budget 2026)

---

**Week 11: Transaction Categorization NLP**
*(Same as original plan)*

**Deliverable:** FinBERT categorization working

---

**Week 12: Bank Integration + Policy Clause Classification**

**Core Tasks:**
- CSV upload OR bank API integration
- Transaction batch processing

**NEW: Policy Clause Classification**
- Classify clauses (penalty | incentive | reporting | funding)
- Sector tagging logic
- CCUS priority flagging

**Team Responsibilities:**
- **Member 2 (Backend - Lead):**
  - CSV parser (5 hours)
  - Batch processing (5 hours)
  
- **Member 3 (ML/Data - Support):**
  - Transaction NLP integration (3 hours)
  - **Clause classification model (7 hours)**
  - **Sector mapping algorithm (5 hours)**

**Deliverable:** Bank integration + 50 policy clauses classified with sector tags

---

#### **MONTH 4: Time-Series Forecasting & Analytics (Weeks 13-16)**

**Week 13: Prophet Model + TEME Simulator Start**

**Core Tasks:**
- Prophet installation and setup
- Time-series feature engineering
- Model training

**NEW: TEME Recommendation Simulator**
- Species selection algorithm (rule-based initially)
- Survival probability calculator
- Time-debt projection generator

**Team Responsibilities:**
- **Member 3 (ML/Data - Lead):**
  - Prophet model setup (6 hours)
  - Training pipeline (4 hours)
  - **TEME species selection algorithm (8 hours)**
  - **Survival probability model (6 hours)**

**Deliverable:** Prophet forecasting + TEME simulator basic

---

**Week 14: Advanced Forecasting + TEME API**

**Core Tasks:**
- TFT model (optional)
- Ensemble approach
- API endpoints

**NEW: TEME API Endpoints**
- POST /api/v1/teme/recommend
- GET /api/v1/teme/species
- Recommendation response formatter

**Team Responsibilities:**
- **Member 3 (ML/Data - 60%):**
  - TFT model (optional) (8 hours)
  - **TEME recommendation logic refinement (6 hours)**
  
- **Member 2 (Backend - 40%):**
  - Forecasting API (4 hours)
  - **TEME API endpoints (8 hours)**
  - **Request validation (2 hours)**

**Deliverable:** Forecasting API + TEME recommendation API

---

**Week 15: Anomaly Detection + Scenario Analysis with TEME**

**Core Tasks:**
- Anomaly detection algorithm
- Scenario analysis framework

**NEW: TEME in Scenario Analysis**
- Add "Plant trees" option to what-if simulator
- Compare: reduction vs planting vs mixed strategy
- Cost-benefit calculator

**Team Responsibilities:**
- **Member 3 (ML/Data - Lead):**
  - Anomaly detection (5 hours)
  - Scenario framework (4 hours)
  - **TEME scenario integration (6 hours)**
  - **Time-debt visualization data (5 hours)**

**Deliverable:** Anomaly detection + Scenario analysis with TEME comparison

---

**Week 16: Advanced Analytics Dashboard + Policy Advice UI**

**Core Tasks:**
- Forecast visualization
- Anomaly markers
- Scenario comparison charts

**NEW: Policy Advice Cards UI**
- Policy advice card component
- Urgency indicators
- Action checklist UI
- Deadline calendar

**Team Responsibilities:**
- **Member 1 (Frontend - Lead):**
  - Forecast charts (6 hours)
  - Scenario comparison UI (5 hours)
  - **Policy advice card component (5 hours)**
  - **Urgency badges (2 hours)**
  - **Action checklist UI (4 hours)**
  
- **Member 2 (Backend - Support):**
  - Analytics aggregation API (3 hours)
  - **Policy advice API (4 hours)**

**Deliverable:** Advanced analytics dashboard + Policy advice UI

---

#### **MONTH 5: Explainable AI & Recommendations (Weeks 17-20)**

**Week 17: SHAP Implementation**
*(Same as original plan)*

**Deliverable:** SHAP explanations for all models

---

**Week 18: LIME + Attention Viz**
*(Same as original plan)*

**Deliverable:** LIME + Attention working

---

**Week 19: Recommendation Engine + TEME Integration**

**Core Tasks:**
- Collaborative filtering
- Content-based filtering
- Action recommendations

**NEW: TEME as Recommendation Option**
- Add TEME to recommendation types
- Integrate survival-weighted offsets
- Side-by-side comparison (reduction vs planting)
- XAI for TEME recommendations (why this species?)

**Team Responsibilities:**
- **Member 3 (ML/Data - Lead):**
  - Recommendation algorithms (8 hours)
  - **TEME integration in recommender (6 hours)**
  - **XAI for TEME (SHAP on species features) (6 hours)**
  
- **Member 2 (Backend - Support):**
  - Recommendation API (5 hours)
  - Caching logic (3 hours)

**Deliverable:** Recommendation engine with TEME integrated

---

**Week 20: A/B Testing + Policy Advice Generator**

**Core Tasks:**
- A/B testing framework
- Experiment tracking

**NEW: Policy Advice Action Generator**
- Clause → Actionable steps mapping
- Template generation logic
- Deadline extraction and reminder scheduling

**Team Responsibilities:**
- **Member 2 (Backend - Lead):**
  - A/B framework (6 hours)
  - **Policy advice generator service (8 hours)**
  - **Template formatter (4 hours)**
  
- **Member 3 (ML/Data - Support):**
  - **Action mapping rules (5 hours)**

**Deliverable:** A/B testing + Policy advice generator

---

#### **MONTH 6: Testing, Security & Deployment (Weeks 21-24)**

**Week 21: Comprehensive Testing + TEME Simulation**

**Core Tasks:**
- Unit tests (>80% coverage)
- Integration tests
- E2E tests

**NEW: TEME Simulation Test**
- Test species recommendations with mock data
- Validate time-debt calculations
- Test survival probability adjustments

**Team Responsibilities:**
- **All Members:**
  - Unit tests for their modules (8 hours each)
  - **TEME simulation testing (Member 3, 5 hours)**
  - **Policy extraction validation (Member 3, 3 hours)**

**Deliverable:** >80% test coverage + TEME simulation verified

---

**Week 22: Security Hardening**
*(Same as original plan)*

**Deliverable:** Zero critical vulnerabilities

---

**Week 23: Production Deployment + Pilot Prep**

**Core Tasks:**
- Cloud infrastructure setup
- Kubernetes deployment
- CI/CD pipeline

**NEW: Pilot Preparation**
- Prepare demo scripts for TEME
- Create sample planting scenarios
- Prepare Budget 2026 policy extracts for demo

**Team Responsibilities:**
- **Member 2 (Lead):**
  - K8s deployment (12 hours)
  - CI/CD setup (6 hours)
  
- **Member 1 & 3:**
  - **Demo scripts (3 hours each)**
  - **Sample data preparation (2 hours each)**

**Deliverable:** Production deployment + Demo ready

---

**Week 24: Documentation + Semester 1 Demo**

**Core Tasks:**
- User documentation
- Technical documentation
- API docs
- Project report

**NEW: TEME & Policy Documentation**
- Document TEME algorithms
- Document policy extraction pipeline
- Create Budget 2026 case study

**Team Responsibilities:**
- **All Members:**
  - Documentation (10 hours each)
  - **TEME section (Member 3, 4 hours)**
  - **Policy NLP section (Member 3, 4 hours)**
  - Demo preparation (5 hours each)

**Deliverable:** Complete Semester 1 documentation + successful demo

---

### SEMESTER 2 (Weeks 25-48)

#### **MONTH 7: Behavioral AI & Gamification (Weeks 25-28)**

**Week 25-26: Reinforcement Learning + Policy-Aware Nudging**

**Core Tasks:**
- DQN implementation
- User behavior tracking
- Reward function design

**NEW: Policy-Aware Nudging**
- Integrate policy deadlines into nudge timing
- Urgency-based notification prioritization
- "Action required in 15 days" alerts

**Team Responsibilities:**
- **Member 3 (ML/Data - Lead):**
  - RL environment (10 hours)
  - DQN training (8 hours)
  - **Policy context integration (4 hours)**
  
- **Member 2 (Backend - Support):**
  - Nudge service (6 hours)
  - **Policy deadline scheduler (4 hours)**

**Deliverable:** RL nudging + Policy-aware notifications

---

**Week 27-28: Gamification System**
*(Same as original plan - add tree planting achievements)*

**NEW: Tree Planting Achievements**
- "First Planter" badge
- "Forest Guardian" (100+ trees)
- "Time-Debt Hero" (offset 1 tonne via planting)

**Deliverable:** Full gamification + tree planting badges

---

#### **MONTH 8: Blockchain Integration (Weeks 29-32)**

**Week 29-30: Blockchain Setup + TEME Verification**

**Core Tasks:**
- Hyperledger Fabric / Ethereum setup
- Smart contracts for carbon credits

**NEW: Tree Planting Verification on Blockchain**
- Smart contract for tree planting records
- NFT minting for verified plantings
- Survival-weighted token values

**Team Responsibilities:**
- **Member 2 (Lead):**
  - Blockchain network (10 hours)
  - Carbon credit contracts (8 hours)
  - **Tree planting contracts (6 hours)**
  
- **Member 3 (Support):**
  - **Verification logic (4 hours)**

**Deliverable:** Blockchain + Tree verification immutable

---

**Week 31-32: Carbon Credit Marketplace + Tree Offset Trading**

**Core Tasks:**
- Marketplace UI
- Buy/sell functionality
- Transaction history

**NEW: Tree-Based Carbon Credit Trading**
- List tree planting offsets for sale
- Survival-weighted credit value
- Time-based unlocking (credits vest as trees grow)

**Team Responsibilities:**
- **Member 1 (Frontend - Lead):**
  - Marketplace UI (10 hours)
  - **Tree offset listing UI (4 hours)**
  
- **Member 2 (Backend - Lead):**
  - Trading logic (8 hours)
  - **Time-based vesting (4 hours)**

**Deliverable:** Marketplace + Tree-based credit trading

---

#### **MONTH 9: Enterprise Features (Weeks 33-36)**

**Week 33-34: Multi-User Organizations + CCUS Flagging**

**Core Tasks:**
- Organization schema
- Department tracking
- RBAC
- Scope 1, 2, 3 calculations

**NEW: CCUS Priority Sector Flagging**
- Auto-detect CCUS eligible organizations
- Display "CCUS Eligible" badge
- Link to Budget 2026 funding opportunities

**Team Responsibilities:**
- **Member 2 (Backend - Lead):**
  - Org schema (8 hours)
  - Scope calculations (10 hours)
  - **CCUS flagging logic (3 hours)**
  
- **Member 1 (Frontend - Support):**
  - Org dashboard (8 hours)
  - **CCUS badge UI (2 hours)**

**Deliverable:** Enterprise features + CCUS identification

---

**Week 35-36: Supply Chain Mapping + Policy Compliance Dashboard**

**Core Tasks:**
- Vendor management
- Supply chain graph visualization
- Neo4j setup

**NEW: Compliance Dashboard**
- Pending policy actions list
- Deadline calendar
- Completion tracking
- Audit trail view

**Team Responsibilities:**
- **Member 2 (Backend - Lead):**
  - Neo4j setup (6 hours)
  - Graph queries (6 hours)
  - **Compliance API (4 hours)**
  
- **Member 1 (Frontend - Lead):**
  - Supply chain viz (8 hours)
  - **Compliance dashboard (8 hours)**

**Deliverable:** Supply chain + Compliance dashboard

---

#### **MONTH 10: Mobile App & Advanced ML (Weeks 37-40)**

**Week 37-38: React Native App + TEME Mobile**

**Core Tasks:**
- React Native setup
- Core features (login, dashboard, quick log)
- Offline support

**NEW: Mobile TEME Features**
- Camera-based planting photo upload
- GPS tagging automatic
- Planting verification flow

**Team Responsibilities:**
- **Member 1 (Lead):**
  - RN setup (6 hours)
  - Core screens (12 hours)
  - **TEME planting UI (6 hours)**
  - **Photo capture + GPS (4 hours)**

**Deliverable:** Mobile app + Mobile TEME

---

**Week 39-40: Advanced ML Models**

**Core Tasks:**
- Multi-modal transformers
- Federated learning
- Continual learning

**NEW: TEME ML Improvements**
- Survival prediction model (ML instead of rules)
- Historical data integration (actual survival rates)
- Transfer learning across regions

**Team Responsibilities:**
- **Member 3 (Lead):**
  - Multi-modal model (10 hours)
  - **TEME survival ML model (8 hours)**
  - **Historical data pipeline (6 hours)**

**Deliverable:** Advanced ML + TEME survival predictor

---

#### **MONTH 11: Scaling & Optimization (Weeks 41-44)**

**Week 41-42: Performance Optimization**
*(Same as original plan)*

**Deliverable:** <200ms API, <2s page load

---

**Week 43-44: K8s Auto-Scaling**
*(Same as original plan)*

**Deliverable:** Auto-scaling + Multi-region

---

#### **MONTH 12: Final Testing, Pilot & Launch (Weeks 45-48)**

**Week 45: Regression Testing + TEME Pilot**

**Core Tasks:**
- Full regression testing
- UAT with beta users
- Bug fixes

**NEW: TEME Pilot with Local SME**
- Partner with 1 SME (restaurant, small manufacturer)
- Recommend planting strategy
- Track for 3 months (simulate)
- Document results for demo

**Team Responsibilities:**
- **All Members:**
  - Regression testing (8 hours each)
  - **TEME pilot execution (Member 3, 8 hours)**
  - **Data collection (Member 2, 4 hours)**

**Deliverable:** All tests passing + TEME pilot data

---

**Week 46: Documentation + Policy Memo Generation**

**Core Tasks:**
- Final documentation
- Compliance certifications
- Legal compliance

**NEW: Policy Memo Auto-Generation**
- Auto-generate compliance memos (PDF)
- Include Budget 2026 references
- Create sample for demo

**Team Responsibilities:**
- **All Members:**
  - Documentation (8 hours each)
  - **Policy memo generator (Member 3 + 2, 6 hours)**

**Deliverable:** Complete docs + Auto-generated policy memos

---

**Week 47: Marketing & Launch + Budget 2026 Presentation**

**Core Tasks:**
- Landing page
- Social media campaign
- Press release
- Product Hunt

**NEW: Budget 2026 Tie-In Campaign**
- "CarbonSense AI: Powered by Budget 2026 CCUS Insights"
- Policy intelligence as key differentiator
- Case study: CCUS funding application made easy

**Team Responsibilities:**
- **All Members:**
  - Marketing materials (6 hours each)
  - **Budget 2026 presentation prep (4 hours each)**

**Deliverable:** Public launch + Budget 2026 campaign

---

**Week 48: Final Presentation + Viva**

**Core Demo Flow:**
1. **Problem Statement** (2 min)
   - Carbon tracking gaps in existing solutions
   - Tree planting gimmicks vs scientific approach
   - Policy compliance complexity

2. **Our Solution** (3 min)
   - Multi-agentic platform overview
   - TEME: Scientific tree-emission matching
   - Policy NLP: Budget 2026 automation

3. **Live Demo** (10 min)
   - Create emission event
   - Get recommendations:
     - Behavioral (immediate)
     - TEME (20-year time-debt)
     - Policy advice (CCUS funding)
   - Show time-debt visualization
   - Show policy compliance checklist
   - Generate policy memo PDF

4. **Technical Deep Dive** (5 min)
   - Multi-agentic architecture
   - TEME algorithms (survival weighting, time-debt)
   - Policy NLP pipeline (extraction, classification)
   - XAI for transparency

5. **Results & Impact** (3 min)
   - TEME pilot results
   - Policy extraction accuracy (>85%)
   - User engagement metrics
   - Projected real-world impact (10K users = 750K tonnes)

6. **Budget 2026 Connection** (2 min)
   - Show extracted CCUS clause
   - Demonstrate CCUS funding application flow
   - Explain policy-aware recommendations

7. **Q&A** (5 min)

**Key Slides:**
- Architecture diagram (with TEME & Policy modules highlighted)
- TEME time-debt curve (reduction vs planting comparison)
- Policy extraction results (Budget 2026 clauses)
- Live platform demo screenshots
- Pilot SME case study
- Limitations & scientific integrity statement

**Deliverable:** Successful final presentation + A+ grade 🎓

---

## 7. DETAILED TEAM MEMBER RESPONSIBILITIES

### 7.1 Member 1: Frontend & UI/UX Lead

**Core Skills Required:**
- React 18+ with TypeScript
- Material-UI / Tailwind CSS
- D3.js / Recharts for data visualization
- Redux Toolkit
- React Native (Semester 2)

**Overall Time Distribution:**
- Frontend components: 40%
- Data visualization: 25%
- NEW: TEME UI: 15%
- NEW: Policy UI: 10%
- Mobile app: 10%

---

**Detailed Tasks by Category:**

#### A. Core Platform UI (Weeks 1-24, 60 hours)

1. **Authentication Pages (Week 2, 6 hours)**
   - Login page with form validation
   - Registration page with email verification
   - Password reset flow
   - OAuth social login buttons

2. **Dashboard Layout (Week 5-6, 12 hours)**
   - Responsive sidebar navigation
   - Header with user profile dropdown
   - Main content area with grid layout
   - Mobile-responsive breakpoints

3. **Carbon Entry Forms (Week 5, 10 hours)**
   - Transport form: mode, distance, vehicle type
   - Energy form: electricity, gas, appliances
   - Food form: meal selection, ingredients
   - Waste form: waste type, quantity
   - Form validation and error handling

4. **Data Visualization (Week 6, 16, 10 hours)**
   - Pie chart: Category breakdown
   - Line chart: Time-series trends
   - Bar chart: Monthly comparison
   - Heatmap: Day-of-week patterns
   - Interactive tooltips and legends

5. **Receipt Upload UI (Week 7-8, 8 hours)**
   - Drag-and-drop file upload
   - Image preview
   - OCR results display
   - Manual correction interface
   - Save to transactions button

6. **Food Recognition UI (Week 9-10, 8 hours)**
   - Camera capture or gallery upload
   - Image preview
   - Top-5 predictions display
   - Portion size input
   - Carbon calculation display
   - Alternative suggestions

7. **Analytics Dashboard (Week 16, 12 hours)**
   - Forecast chart with confidence intervals
   - Anomaly markers
   - Scenario comparison side-by-side
   - Goal tracking progress bars
   - Export charts as images

---

#### B. TEME User Interface (Weeks 8, 13-16, 19, 30 hours)

1. **Time-Debt Visualization (Week 8, 8 hours)**
   - **Task:** Create reusable chart component for time-debt curves
   - **Design:** Line chart showing cumulative offset over 20 years
   - **Features:**
     - X-axis: Years (2026-2046)
     - Y-axis: Cumulative CO₂ offset (kg)
     - Two lines: Expected offset vs Survival-weighted offset
     - Shaded area showing uncertainty
     - Payback point marker (when emission fully offset)
   - **Technology:** Recharts or D3.js
   - **Files to create:**
     - `src/components/teme/TimeDebtChart.tsx`
     - `src/utils/timeDebtCalculator.ts`
   - **Implementation steps:**
     1. Create TimeDebtChart component (3 hours)
     2. Format data from API response (2 hours)
     3. Add interactive tooltips (2 hours)
     4. Responsive design (1 hour)

2. **TEME Recommendation Cards (Week 14-16, 10 hours)**
   - **Task:** Design and implement species recommendation cards
   - **Layout:** Card-based UI showing top 3 species
   - **Each card shows:**
     - Species photo (from database or placeholder)
     - Common + scientific name
     - Key metrics: Survival %, Expected offset, Time to offset
     - Pros/cons bullets
     - "Select" button
   - **Features:**
     - Comparison mode: Select 2-3 to compare side-by-side
     - Sorting: By survival rate, offset amount, cost
     - Filtering: By water need, maintenance level
   - **Files to create:**
     - `src/components/teme/SpeciesRecommendationCard.tsx`
     - `src/components/teme/SpeciesComparison.tsx`
     - `src/pages/TEMERecommendations.tsx`
   - **Implementation steps:**
     1. Card component with all data fields (4 hours)
     2. Comparison view (3 hours)
     3. Sorting/filtering logic (2 hours)
     4. Responsive grid layout (1 hour)

3. **Planting Workflow UI (Week 19, 6 hours)**
   - **Task:** Create multi-step planting registration flow
   - **Steps:**
     1. Select species (from recommendation or browse)
     2. Enter planting details (count, date, location)
     3. Add cost and partner info
     4. Review and submit
   - **Features:**
     - Step indicator (progress bar)
     - Form validation at each step
     - GPS location picker (map integration)
     - Cost calculator
   - **Files to create:**
     - `src/components/teme/PlantingWizard.tsx`
     - `src/components/teme/LocationPicker.tsx`
   - **Implementation steps:**
     1. Wizard component with step management (2 hours)
     2. Form fields for each step (2 hours)
     3. Location picker with map (2 hours)

4. **Verification Upload UI (Week 19, 4 hours)**
   - **Task:** Photo upload with GPS and verification
   - **Features:**
     - Multiple photo upload (3-5 photos)
     - GPS extraction from EXIF data
     - Photo preview gallery
     - Date verification (must be within 7 days of planting)
     - Submit for verification button
   - **Files to create:**
     - `src/components/teme/VerificationUpload.tsx`
     - `src/utils/exifExtractor.ts`
   - **Implementation steps:**
     1. File upload component (1 hour)
     2. EXIF GPS extraction (2 hours)
     3. Validation and submission (1 hour)

5. **TEME Dashboard Tab (Week 16, 2 hours)**
   - **Task:** Add "My Plantings" tab to dashboard
   - **Shows:**
     - Total trees planted
     - Total offset (expected vs weighted)
     - Planting history timeline
     - Verification status indicators
     - Next monitoring reminder
   - **Files to create:**
     - `src/components/teme/TEMEDashboardTab.tsx`

---

#### C. Policy NLP User Interface (Weeks 16, 20, 35-36, 25 hours)

1. **Policy Advice Cards (Week 16, 8 hours)**
   - **Task:** Create notification-style cards for policy advice
   - **Design:** Material-UI Alert component extended
   - **Features:**
     - Urgency color coding (red=immediate, orange=short-term, blue=long-term)
     - Collapsible details section
     - Action checklist with checkboxes
     - Deadline countdown timer
     - "Dismiss" and "Mark as complete" buttons
   - **Files to create:**
     - `src/components/policy/PolicyAdviceCard.tsx`
     - `src/components/policy/ActionChecklist.tsx`
   - **Implementation steps:**
     1. Card component with urgency styling (3 hours)
     2. Collapsible action checklist (3 hours)
     3. Deadline timer (1 hour)
     4. State management (1 hour)

2. **Compliance Dashboard (Week 35-36, 12 hours)**
   - **Task:** Full compliance tracking interface
   - **Layout:**
     - Left sidebar: Filter by urgency, sector, status
     - Main area: List of policy advice items
     - Right panel: Selected item details
   - **Features:**
     - Deadline calendar view
     - Kanban board (pending / in-progress / completed)
     - Progress tracking (% completion)
     - Audit trail timeline
     - Export compliance report button
   - **Files to create:**
     - `src/pages/ComplianceDashboard.tsx`
     - `src/components/policy/ComplianceKanban.tsx`
     - `src/components/policy/DeadlineCalendar.tsx`
     - `src/components/policy/AuditTrail.tsx`
   - **Implementation steps:**
     1. Dashboard layout (3 hours)
     2. Kanban board (4 hours)
     3. Calendar view (3 hours)
     4. Audit trail (2 hours)

3. **Policy Document Viewer (Week 20, 3 hours)**
   - **Task:** PDF viewer for policy documents
   - **Features:**
     - Embedded PDF viewer (react-pdf)
     - Highlight extracted clauses
     - Jump to clause location
   - **Files to create:**
     - `src/components/policy/PolicyDocViewer.tsx`

4. **CCUS Badge & Info Modal (Week 34, 2 hours)**
   - **Task:** Visual indicator for CCUS eligible organizations
   - **Features:**
     - "CCUS Eligible" badge on org dashboard
     - Info modal explaining Budget 2026 funding
     - Link to application workflow
   - **Files to create:**
     - `src/components/policy/CCUSBadge.tsx`
     - `src/components/policy/CCUSInfoModal.tsx`

---

#### D. Mobile App (Weeks 37-38, Semester 2, 20 hours)

1. **React Native Setup (Week 37, 4 hours)**
   - Initialize React Native project
   - Set up navigation
   - Configure environment variables

2. **Core Screens (Week 37-38, 10 hours)**
   - Login/Register screens
   - Dashboard (adapted from web)
   - Quick log screen
   - Notifications

3. **TEME Mobile Features (Week 38, 6 hours)**
   - Camera-based photo capture
   - GPS tagging automatic
   - Planting verification flow
   - Offline support for photo queuing

---

### 7.2 Member 2: Backend & Infrastructure Lead

**Core Skills Required:**
- Node.js / Express.js
- PostgreSQL + PostGIS
- MongoDB
- Redis
- Docker + Kubernetes
- AWS/GCP

**Overall Time Distribution:**
- Backend APIs: 35%
- Database design: 20%
- NEW: TEME Service: 15%
- NEW: Policy Service: 15%
- DevOps: 15%

---

**Detailed Tasks by Category:**

#### A. Core Backend Development (Weeks 1-24, 80 hours)

1. **Server Setup (Week 3, 8 hours)**
   - Express.js server initialization
   - Middleware configuration (CORS, body-parser, helmet)
   - Error handling middleware
   - Logging setup (Winston)
   - Environment variables (.env)

2. **Authentication System (Week 4, 12 hours)**
   - User registration endpoint
   - Login with JWT generation
   - Password hashing (bcrypt)
   - Email verification
   - Password reset flow
   - Refresh token mechanism
   - Session management (Redis)

3. **Carbon Transactions API (Week 5, 8 hours)**
   - POST /api/v1/carbon/transactions
   - GET /api/v1/carbon/transactions (pagination, filtering)
   - GET /api/v1/carbon/transactions/:id
   - PUT /api/v1/carbon/transactions/:id
   - DELETE /api/v1/carbon/transactions/:id
   - Input validation (Joi)

4. **Carbon Calculation Engine (Week 5, 6 hours)**
   - Calculation service: `services/carbonCalculator.js`
   - Category-specific calculators (transport, energy, food, waste)
   - Emission factor lookup from database
   - Unit conversions
   - Confidence scoring

5. **Analytics Aggregation APIs (Week 6, 8 hours)**
   - GET /api/v1/carbon/summary?period=weekly
   - GET /api/v1/carbon/category-breakdown
   - GET /api/v1/carbon/trends?range=30
   - GET /api/v1/analytics/compare?type=city
   - Efficient SQL queries with indexes
   - Caching with Redis (TTL: 1 hour)

6. **File Upload Service (Week 7, 6 hours)**
   - S3/MinIO configuration
   - POST /api/v1/files/upload
   - Image validation (type, size)
   - Generate signed URLs
   - Cleanup old files (cron job)

7. **Forecasting API (Week 14, 6 hours)**
   - POST /api/v1/predictions/forecast
   - GET /api/v1/predictions/anomalies
   - POST /api/v1/predictions/scenario
   - Call Python ML service (internal API)
   - Cache predictions (Redis)

8. **Recommendation API (Week 19, 8 hours)**
   - GET /api/v1/recommendations/actions
   - GET /api/v1/recommendations/products/:productId/alternatives
   - GET /api/v1/recommendations/personalized
   - Combine multiple agent outputs
   - Ranking algorithm

9. **Organization Management (Week 33-34, 12 hours)**
   - Organization CRUD
   - Department management
   - User-organization mapping
   - Role-based access control (RBAC)
   - Scope 1, 2, 3 calculations

10. **API Documentation (Week 24, 6 hours)**
    - Swagger/OpenAPI setup
    - Annotate all endpoints
    - Generate interactive docs
    - Postman collection export

---

#### B. TEME Backend Service (Weeks 3, 5, 14, 19, 29-30, 40 hours)

1. **Database Schema Implementation (Week 3, 6 hours)**
   - **Task:** Create tree_species and tree_plantings tables
   - **Files to create:**
     - `migrations/001_create_tree_species.sql`
     - `migrations/002_create_tree_plantings.sql`
     - `seeds/tree_species_seed.sql`
   - **Steps:**
     1. Write SQL migration files (2 hours)
     2. Test migrations up/down (1 hour)
     3. Create seed data script (2 hours)
     4. Run and verify (1 hour)

2. **Tree Species Seeding (Week 5, 4 hours)**
   - **Task:** Populate tree_species table with 20+ species
   - **Data to seed:**
     - Neem, Peepal, Banyan, Mango, Teak, Bamboo, Eucalyptus, etc.
     - Full data: absorption curves, survival rates, climate zones
   - **Files:**
     - `seeds/tree_species_data.json`
     - `scripts/seedTreeSpecies.js`
   - **Steps:**
     1. Format JSON data (1 hour)
     2. Write seeding script (2 hours)
     3. Verify data integrity (1 hour)

3. **TEME API Endpoints (Week 14, 12 hours)**
   - **Task:** Implement core TEME APIs
   - **Endpoints to create:**
     - POST /api/v1/teme/recommend
     - GET /api/v1/teme/species (list all)
     - GET /api/v1/teme/species/:id
     - POST /api/v1/teme/plantings
     - GET /api/v1/teme/plantings (user's history)
     - GET /api/v1/teme/plantings/:id
   - **Files to create:**
     - `routes/teme.routes.js`
     - `controllers/teme.controller.js`
     - `services/temeRecommendation.service.js`
     - `services/plantingRecord.service.js`
   - **Implementation steps:**
     1. Route definitions (2 hours)
     2. Controller handlers (3 hours)
     3. Recommendation service logic (4 hours)
     4. Planting CRUD (2 hours)
     5. Testing (1 hour)

4. **Recommendation Service Logic (Week 14, 8 hours)**
   - **Task:** Implement species recommendation algorithm
   - **Algorithm:**
     1. Get user location → determine climate zone
     2. Query species where climate_zones contains user's zone
     3. Filter by water availability, soil type
     4. Calculate suitability score:
        - Climate match: 30%
        - Survival rate: 25%
        - Absorption potential: 25%
        - Cost efficiency: 10%
        - Additional benefits: 10%
     5. Rank and return top 3
   - **Files:**
     - `services/speciesSelector.js`
     - `utils/climateZoneLookup.js`
     - `utils/suitabilityScorer.js`
   - **Steps:**
     1. Climate zone mapping (2 hours)
     2. Filtering logic (2 hours)
     3. Scoring algorithm (3 hours)
     4. Testing with mock data (1 hour)

5. **Time-Debt Calculation Service (Week 14, 6 hours)**
   - **Task:** Calculate year-by-year offset projection
   - **Algorithm:**
     1. Get absorption curve for species (from tree_species table)
     2. Calculate expected absorption per year for N trees
     3. Apply survival probability at each year
     4. Generate cumulative curve
   - **Files:**
     - `services/timeDebtCalculator.js`
   - **Implementation:**
     ```javascript
     function calculateTimeDebt(speciesId, count, plantingDate) {
       const species = getSpeciesById(speciesId);
       const timeline = [];
       let cumulative = 0;
       
       for (let year = 0; year <= species.lifetime_years; year++) {
         const annualAbsorption = getAbsorptionAtAge(species, year) * count;
         const survivalProb = calculateSurvivalProbability(species, year);
         const weightedAbsorption = annualAbsorption * survivalProb;
         
         cumulative += weightedAbsorption;
         
         timeline.push({
           year: plantingDate.getFullYear() + year,
           age: year,
           annual_absorption_kg: annualAbsorption,
           cumulative_offset_kg: cumulative,
           survival_probability: survivalProb,
           survival_weighted_cumulative_kg: cumulative
         });
       }
       
       return timeline;
     }
     ```

6. **Verification Upload Endpoint (Week 19, 4 hours)**
   - **Task:** Handle photo uploads for planting verification
   - POST /api/v1/teme/plantings/:id/verify
   - **Steps:**
     1. Multer setup for file upload (1 hour)
     2. EXIF GPS extraction (1 hour)
     3. Store verification_docs JSON (1 hour)
     4. Update verification_status (1 hour)

7. **Blockchain Integration for Plantings (Week 29-30, 6 hours)**
   - **Task:** Write planting records to blockchain
   - **Steps:**
     1. Create smart contract call (2 hours)
     2. Generate NFT for verified planting (2 hours)
     3. Store blockchain_tx_hash (1 hour)
     4. Verification workflow (1 hour)

---

#### C. Policy NLP Backend Service (Weeks 9-10, 12, 20, 34, 35-36, 45 hours)

1. **Policy Document Upload API (Week 9, 6 hours)**
   - **Task:** Create endpoint for policy document ingestion
   - POST /api/v1/policy/ingest
   - **Features:**
     - PDF upload to S3
     - Queue for processing (Bull + Redis)
     - Metadata storage (MongoDB)
   - **Files:**
     - `routes/policy.routes.js`
     - `controllers/policy.controller.js`
     - `services/policyIngestion.service.js`
     - `queues/policyProcessing.queue.js`

2. **MongoDB Document Storage (Week 9, 3 hours)**
   - **Task:** Store policy documents in MongoDB
   - **Schema:**
     ```javascript
     {
       document_id: UUID,
       document_name: String,
       document_type: String,
       uploaded_at: Date,
       processed: Boolean,
       extracted_text: String,
       processing_status: String,
       error_message: String
     }
     ```

3. **Policy Clauses Table & API (Week 10, 6 hours)**
   - **Task:** Create policy_clauses table and CRUD APIs
   - **Endpoints:**
     - POST /api/v1/policy/clauses (internal, called by ML service)
     - GET /api/v1/policy/clauses?sector=cement&type=funding
     - GET /api/v1/policy/clauses/:id
   - **Files:**
     - `migrations/003_create_policy_clauses.sql`
     - `routes/policyClauses.routes.js`
     - `controllers/policyClauses.controller.js`

4. **Sector Mapping Logic (Week 12, 8 hours)**
   - **Task:** Map extracted clauses to user/org sectors
   - **Algorithm:**
     1. Get user's sector from profile
     2. Query clauses where affected_sectors contains user's sector
     3. Filter by urgency and date
     4. Rank by severity_score
   - **Files:**
     - `services/sectorMapper.service.js`
   - **Steps:**
     1. Keyword-based sector tagging (3 hours)
     2. Fuzzy matching for industry names (2 hours)
     3. CCUS priority flagging (2 hours)
     4. Testing (1 hour)

5. **Policy Advice Generator Service (Week 20, 12 hours)**
   - **Task:** Transform clauses into actionable advice
   - **Logic:**
     - Input: Clause + User profile
     - Output: Advice with actionable steps
   - **Mapping rules:**
     ```javascript
     if (clause.type === 'funding' && clause.is_ccus_related) {
       return {
         advice_title: "Apply for CCUS Funding",
         actionable_steps: [
           { step: 1, action: "Conduct baseline audit", deadline: "+3 months" },
           { step: 2, action: "Prepare feasibility report", deadline: "+5 months" },
           { step: 3, action: "Submit application", deadline: "+6 months" }
         ]
       };
     }
     ```
   - **Files:**
     - `services/adviceGenerator.service.js`
     - `templates/adviceTemplates.json`

6. **Policy Advice API (Week 20, 4 hours)**
   - **Task:** Expose policy advice to frontend
   - GET /api/v1/policy/advice?user_id=uuid
   - **Logic:**
     1. Get relevant clauses for user
     2. Generate advice for each
     3. Sort by urgency + priority
     4. Return with actionable steps

7. **CCUS Flagging Logic (Week 34, 4 hours)**
   - **Task:** Auto-detect CCUS eligible organizations
   - **Criteria:**
     - Sector in ['cement', 'steel', 'fertilizer', 'power']
     - Annual emissions > 500 tonnes
   - **Implementation:**
     - Add is_ccus_eligible field to organizations table
     - Cron job to update flags based on emissions data
   - **Files:**
     - `services/ccusFlagging.service.js`
     - `jobs/updateCCUSFlags.job.js`

8. **Compliance Dashboard API (Week 35-36, 6 hours)**
   - **Task:** APIs for compliance tracking
   - **Endpoints:**
     - GET /api/v1/policy/compliance/summary
     - PUT /api/v1/policy/advice/:id/status
     - GET /api/v1/policy/compliance/audit-trail
   - **Features:**
     - Aggregate pending/completed actions
     - Update completion status
     - Generate audit trail

9. **PDF Compliance Memo Generator (Week 46, 6 hours)**
   - **Task:** Auto-generate compliance memo PDFs
   - POST /api/v1/policy/generate-compliance-doc
   - **Technology:** PDFKit or Puppeteer
   - **Template sections:**
     - Executive summary
     - Applicable clauses
     - Evidence of compliance
     - Next steps
     - Signatures
   - **Files:**
     - `services/pdfGenerator.service.js`
     - `templates/complianceMemo.html`

---

#### D. DevOps & Infrastructure (Weeks 22-23, 43-44, 30 hours)

1. **Docker Configuration (Week 22, 6 hours)**
   - Dockerfile for backend services
   - Docker Compose for local development
   - Multi-stage builds for optimization

2. **Kubernetes Setup (Week 23, 12 hours)**
   - K8s cluster configuration
   - Deployment manifests
   - Service definitions
   - ConfigMaps and Secrets
   - Ingress configuration
   - Persistent volumes

3. **CI/CD Pipeline (Week 23, 6 hours)**
   - GitHub Actions workflows
   - Build → Test → Deploy
   - Staging and production environments
   - Automated rollback

4. **Auto-Scaling (Week 43-44, 6 hours)**
   - Horizontal Pod Autoscaler
   - Resource limits optimization
   - Load testing with K6

---

### 7.3 Member 3: AI/ML & Data Science Lead

**Core Skills Required:**
- Python (PyTorch, TensorFlow, scikit-learn)
- Computer Vision (OpenCV, PIL)
- NLP (Transformers, BERT, spaCy)
- Time-series (Prophet, statsmodels)
- Reinforcement Learning (Stable-baselines3)

**Overall Time Distribution:**
- ML model training: 30%
- NEW: TEME ML models: 20%
- NEW: Policy NLP: 20%
- XAI implementation: 15%
- Data engineering: 15%

---

**Detailed Tasks by Category:**

#### A. Core ML Models (Weeks 7-11, 60 hours)

1. **Receipt OCR Pipeline (Week 7-8, 16 hours)**
   - Image preprocessing (Week 7, 4 hours)
   - Tesseract + EasyOCR integration (Week 7, 4 hours)
   - NER model training for receipt entities (Week 8, 8 hours)

2. **Food Recognition Model (Week 9-10, 16 hours)**
   - Food-101 dataset download (Week 9, 2 hours)
   - EfficientNet-B4 fine-tuning (Week 9, 8 hours)
   - Indian food dataset fine-tuning (Week 10, 6 hours)

3. **Transaction Categorization (Week 11, 8 hours)**
   - FinBERT fine-tuning on transaction data
   - Category classification
   - Carbon estimation logic

4. **Waste Classification (Optional, 6 hours)**
   - YOLO v8 training on TACO dataset
   - Object detection pipeline

5. **Time-Series Forecasting (Week 13-14, 14 hours)**
   - Prophet model setup (Week 13, 6 hours)
   - TFT implementation (Week 14, 8 hours)
   - Ensemble approach

---

#### B. TEME ML Models (Weeks 8, 13-14, 39-40, 35 hours)

1. **Time-Debt Calculator Implementation (Week 8, 6 hours)**
   - **Task:** Create Python function for absorption curve generation
   - **Algorithm:**
     ```python
     def calculate_absorption_curve(species_data, count, years=20):
         """
         Calculate year-by-year CO2 absorption with survival weighting
         
         Args:
             species_data: dict with absorption_year_X_kg, baseline_survival_rate
             count: number of trees planted
             years: projection horizon
             
         Returns:
             list of dicts with year, absorption, cumulative, survival_weighted
         """
         curve = []
         cumulative = 0
         
         for year in range(years + 1):
             # Interpolate absorption at this age
             annual_absorption = interpolate_absorption(species_data, year)
             total_annual = annual_absorption * count
             
             # Calculate survival probability (decays over time)
             survival_prob = calculate_survival_at_age(
                 species_data['baseline_survival_rate'],
                 year,
                 species_data.get('risk_factors', {})
             )
             
             weighted_absorption = total_annual * survival_prob
             cumulative += weighted_absorption
             
             curve.append({
                 'year': year,
                 'annual_absorption_kg': total_annual,
                 'cumulative_offset_kg': cumulative,
                 'survival_probability': survival_prob,
                 'survival_weighted_kg': cumulative
             })
         
         return curve
     ```
   - **Files to create:**
     - `ml_services/teme/time_debt_calculator.py`
     - `ml_services/teme/survival_model.py`
   - **Steps:**
     1. Implement absorption interpolation (2 hours)
     2. Implement survival probability decay (2 hours)
     3. Test with sample species (1 hour)
     4. Validate against literature (1 hour)

2. **Species Recommendation Algorithm (Week 13-14, 10 hours)**
   - **Task:** Create ML-based species selection
   - **Approach:** Start with rule-based, evolve to ML
   - **Initial Rules:**
     ```python
     def select_species(user_location, emission_kg, constraints):
         # 1. Get climate zone from lat/lon
         climate_zone = get_climate_zone(user_location)
         
         # 2. Query candidate species
         candidates = db.query(
             "SELECT * FROM tree_species WHERE %s = ANY(climate_zones)",
             (climate_zone,)
         )
         
         # 3. Filter by constraints
         if constraints.get('water_availability') == 'low':
             candidates = [s for s in candidates if s['water_need'] in ['low', 'medium']]
         
         # 4. Calculate suitability score for each
         scored = []
         for species in candidates:
             score = calculate_suitability(species, user_location, emission_kg, constraints)
             scored.append((species, score))
         
         # 5. Sort by score and return top 3
         scored.sort(key=lambda x: x[1], reverse=True)
         return scored[:3]
     
     def calculate_suitability(species, location, emission_kg, constraints):
         score = 0
         
         # Climate match (30%)
         if species['climate_zones'] contains location's zone:
             score += 30
         
         # Survival rate (25%)
         score += species['baseline_survival_rate'] * 25
         
         # Absorption potential (25%)
         trees_needed = emission_kg / species['total_lifetime_absorption_kg']
         if trees_needed <= constraints.get('max_trees', 100):
             score += 25
         else:
             score += 25 * (constraints['max_trees'] / trees_needed)
         
         # Cost efficiency (10%)
         total_cost = species['cost_per_sapling'] * trees_needed
         if total_cost <= constraints.get('budget', 10000):
             score += 10
         
         # Additional benefits (10%)
         benefits = sum([
             species.get('provides_fruit', False),
             species.get('provides_shade', False),
             species.get('nitrogen_fixing', False)
         ])
         score += (benefits / 3) * 10
         
         return score
     ```
   - **Files:**
     - `ml_services/teme/species_selector.py`
     - `ml_services/teme/suitability_scorer.py`
   - **Implementation steps:**
     1. Climate zone lookup (2 hours)
     2. Filtering logic (2 hours)
     3. Scoring algorithm (4 hours)
     4. Testing and tuning (2 hours)

3. **Survival Probability Model (Week 13, 6 hours)**
   - **Task:** Model survival probability with risk adjustments
   - **Factors:**
     - Baseline survival rate (from tree_species)
     - Regional risk factor (climate, drought, fire)
     - Age-based decay (survival decreases slightly over time)
   - **Algorithm:**
     ```python
     def calculate_survival_probability(baseline_rate, age, region_risk_factors):
         """
         Args:
             baseline_rate: float (0.0-1.0) from species data
             age: int (years since planting)
             region_risk_factors: dict {
                 'drought_risk': 0-10,
                 'fire_risk': 0-10,
                 'disease_risk': 0-10
             }
         
         Returns:
             float (0.0-1.0) survival probability at this age
         """
         # Start with baseline
         survival = baseline_rate
         
         # Age-based decay (1% per year up to 20 years)
         age_decay = min(age * 0.01, 0.20)
         survival *= (1 - age_decay)
         
         # Regional risk adjustment
         total_risk = (
             region_risk_factors.get('drought_risk', 0) +
             region_risk_factors.get('fire_risk', 0) +
             region_risk_factors.get('disease_risk', 0)
         ) / 30  # Normalize to 0-1
         
         risk_factor = 1 - (total_risk * 0.3)  # Max 30% reduction
         survival *= risk_factor
         
         return max(survival, 0.1)  # Minimum 10% survival
     ```
   - **Files:**
     - `ml_services/teme/survival_model.py`
     - `ml_services/teme/risk_assessment.py`
   - **Steps:**
     1. Implement decay function (2 hours)
     2. Regional risk lookup (2 hours)
     3. Testing with real species (1 hour)
     4. Validate against forestry literature (1 hour)

4. **TEME FastAPI Service (Week 14, 6 hours)**
   - **Task:** Create ML service endpoints
   - **Endpoints:**
     - POST /ml/teme/recommend
     - POST /ml/teme/calculate-time-debt
   - **Files:**
     - `ml_services/teme/api.py`
     - `ml_services/teme/models.py` (Pydantic schemas)
   - **Implementation:**
     ```python
     from fastapi import FastAPI
     from pydantic import BaseModel
     from typing import List
     
     app = FastAPI()
     
     class RecommendationRequest(BaseModel):
         user_location: dict
         emission_kg: float
         soil_type: str
         water_availability: str
         budget: float
     
     class SpeciesRecommendation(BaseModel):
         species_id: str
         species_name: str
         count: int
         expected_offset_kg: float
         survival_weighted_offset_kg: float
         time_debt_curve: List[dict]
         suitability_score: float
         pros: List[str]
         cons: List[str]
     
     @app.post("/ml/teme/recommend", response_model=List[SpeciesRecommendation])
     def get_recommendations(request: RecommendationRequest):
         # Call species_selector
         recommendations = select_species(
             request.user_location,
             request.emission_kg,
             {
                 'soil_type': request.soil_type,
                 'water_availability': request.water_availability,
                 'budget': request.budget
             }
         )
         
         # For each species, calculate time-debt
         results = []
         for species, score in recommendations:
             count = calculate_trees_needed(species, request.emission_kg)
             time_debt = calculate_absorption_curve(species, count)
             
             results.append(SpeciesRecommendation(
                 species_id=species['id'],
                 species_name=species['common_name'],
                 count=count,
                 expected_offset_kg=time_debt[-1]['cumulative_offset_kg'],
                 survival_weighted_offset_kg=time_debt[-1]['survival_weighted_kg'],
                 time_debt_curve=time_debt,
                 suitability_score=score,
                 pros=generate_pros(species),
                 cons=generate_cons(species)
             ))
         
         return results
     ```

5. **Advanced Survival ML Model (Week 39-40, 7 hours)**
   - **Task:** Replace rule-based survival with ML predictor
   - **Approach:** Train on historical planting data
   - **Features:**
     - Species characteristics
     - Location (lat/lon, climate zone)
     - Planting season
     - Soil quality
     - Rainfall in region
     - Age of tree
   - **Target:** Actual survival (binary: alive/dead at year X)
   - **Model:** Gradient Boosting (XGBoost) or Random Forest
   - **Dataset:** Historical forestry data (FAO, local research)
   - **Files:**
     - `ml_services/teme/survival_predictor.py`
     - `ml_services/teme/train_survival_model.py`
   - **Steps:**
     1. Collect historical survival data (2 hours)
     2. Feature engineering (2 hours)
     3. Train XGBoost model (2 hours)
     4. Integration with TEME service (1 hour)

---

#### C. Policy NLP Models (Weeks 10, 12, 20, 40 hours)

1. **Policy NER Model Fine-Tuning (Week 10, 12 hours)**
   - **Task:** Train BERT for clause entity extraction
   - **Entities to extract:**
     - PENALTY (₹10 lakh fine, license suspension)
     - DEADLINE (31st March 2026, quarterly reporting)
     - AUTHORITY (Ministry of Environment, State Board)
     - FUNDING (₹20,000 crore, grants)
     - SECTOR (cement, steel, power)
     - THRESHOLD (500 tonnes CO2/year)
   - **Dataset:** Budget 2026 + manually annotated policy documents
   - **Approach:**
     ```python
     from transformers import AutoTokenizer, AutoModelForTokenClassification, Trainer
     
     # Load pre-trained BERT
     model = AutoModelForTokenClassification.from_pretrained(
         "bert-base-uncased",
         num_labels=len(label_list)  # O, B-PENALTY, I-PENALTY, B-DEADLINE, etc.
     )
     
     # Prepare dataset
     train_dataset = PolicyNERDataset(train_texts, train_labels)
     
     # Train
     trainer = Trainer(
         model=model,
         train_dataset=train_dataset,
         ...
     )
     trainer.train()
     
     # Save
     model.save_pretrained('./models/policy-ner')
     ```
   - **Files:**
     - `ml_services/policy/ner_training.py`
     - `ml_services/policy/dataset.py`
     - `ml_services/policy/config.yaml`
   - **Steps:**
     1. Annotate 100 policy sentences (4 hours)
     2. Prepare dataset (2 hours)
     3. Fine-tune BERT (4 hours)
     4. Evaluate and iterate (2 hours)

2. **Clause Classification Model (Week 12, 10 hours)**
   - **Task:** Classify clause type
   - **Classes:** penalty | incentive | reporting | tech-mandate | funding | guideline
   - **Approach:** BERT sequence classification
   - **Dataset:** Labeled clauses from Budget 2026 + manual annotation
   - **Implementation:**
     ```python
     from transformers import AutoModelForSequenceClassification
     
     model = AutoModelForSequenceClassification.from_pretrained(
         "bert-base-uncased",
         num_labels=6  # 6 clause types
     )
     
     # Train on labeled clauses
     trainer = Trainer(
         model=model,
         train_dataset=clause_dataset,
         ...
     )
     trainer.train()
     
     # Inference
     def classify_clause(text):
         inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
         outputs = model(**inputs)
         prediction = outputs.logits.argmax(-1).item()
         return class_names[prediction]
     ```
   - **Files:**
     - `ml_services/policy/clause_classifier.py`
     - `ml_services/policy/train_classifier.py`
   - **Steps:**
     1. Annotate 200 clauses by type (3 hours)
     2. Train classifier (4 hours)
     3. Hyperparameter tuning (2 hours)
     4. Evaluation (1 hour)

3. **Sector Tagging (Week 12, 8 hours)**
   - **Task:** Tag clauses with affected sectors
   - **Approach:** Multi-label classification + keyword matching
   - **Sectors:** cement, steel, power, transport, agriculture, etc.
   - **Hybrid approach:**
     - Keyword matching for explicit mentions ("cement industry")
     - ML classifier for implicit sector references
   - **Implementation:**
     ```python
     # Keyword-based
     SECTOR_KEYWORDS = {
         'cement': ['cement', 'clinker', 'concrete'],
         'steel': ['steel', 'iron', 'blast furnace'],
         'power': ['power plant', 'electricity generation', 'thermal power'],
         ...
     }
     
     def tag_sectors_keywords(text):
         sectors = []
         for sector, keywords in SECTOR_KEYWORDS.items():
             if any(kw in text.lower() for kw in keywords):
                 sectors.append(sector)
         return sectors
     
     # ML-based (multi-label BERT)
     def tag_sectors_ml(text):
         inputs = tokenizer(text, return_tensors="pt", truncation=True)
         outputs = model(**inputs)
         # Sigmoid for multi-label
         probs = torch.sigmoid(outputs.logits)
         predicted = (probs > 0.5).int().tolist()[0]
         return [sector_names[i] for i, p in enumerate(predicted) if p == 1]
     
     # Combined
     def tag_sectors(text):
         kw_sectors = tag_sectors_keywords(text)
         ml_sectors = tag_sectors_ml(text)
         return list(set(kw_sectors + ml_sectors))
     ```
   - **Files:**
     - `ml_services/policy/sector_tagger.py`
     - `ml_services/policy/sector_keywords.json`
   - **Steps:**
     1. Build keyword dictionary (2 hours)
     2. Train multi-label classifier (4 hours)
     3. Hybrid integration (2 hours)

4. **CCUS Priority Flagging (Week 12, 4 hours)**
   - **Task:** Flag clauses related to CCUS from Budget 2026
   - **Approach:** Simple keyword + pattern matching
   - **Keywords:** CCUS, carbon capture, carbon utilization, carbon storage
   - **Implementation:**
     ```python
     CCUS_KEYWORDS = [
         'ccus', 'carbon capture', 'carbon utilization', 'carbon storage',
         'ccs technology', 'sequestration'
     ]
     
     def is_ccus_related(text):
         text_lower = text.lower()
         return any(keyword in text_lower for keyword in CCUS_KEYWORDS)
     
     def get_ccus_priority(clause):
         if not is_ccus_related(clause['clause_text']):
             return None
         
         # Priority based on funding amount mentioned
         if 'crore' in clause['clause_text']:
             return 1  # Highest priority
         elif clause['clause_type'] == 'funding':
             return 2
         elif clause['clause_type'] == 'incentive':
             return 3
         else:
             return 4
     ```

5. **Policy FastAPI Service (Week 20, 6 hours)**
   - **Task:** Create ML endpoints for policy processing
   - **Endpoints:**
     - POST /ml/policy/extract-entities
     - POST /ml/policy/classify-clause
     - POST /ml/policy/tag-sectors
   - **Files:**
     - `ml_services/policy/api.py`
   - **Implementation:**
     ```python
     from fastapi import FastAPI
     from pydantic import BaseModel
     
     app = FastAPI()
     
     class ClauseInput(BaseModel):
         text: str
     
     class ClauseAnalysis(BaseModel):
         entities: dict
         clause_type: str
         affected_sectors: list
         is_ccus_related: bool
         confidence: float
     
     @app.post("/ml/policy/analyze-clause", response_model=ClauseAnalysis)
     def analyze_clause(input: ClauseInput):
         # NER
         entities = ner_model(input.text)
         
         # Classification
         clause_type = classifier(input.text)
         
         # Sector tagging
         sectors = sector_tagger(input.text)
         
         # CCUS flagging
         is_ccus = is_ccus_related(input.text)
         
         return ClauseAnalysis(
             entities=entities,
             clause_type=clause_type,
             affected_sectors=sectors,
             is_ccus_related=is_ccus,
             confidence=0.9  # From model output
         )
     ```

---

#### D. Explainable AI (Weeks 17-18, 15 hours)

1. **SHAP Integration (Week 17, 8 hours)**
   - For food recognition, transaction categorization, TEME species selection
   - Generate SHAP values
   - Create visualizations (summary plot, force plot)

2. **LIME Integration (Week 18, 4 hours)**
   - For text-based models (NLP)
   - Local explanations

3. **XAI for TEME (Week 19, 3 hours)**
   - **Task:** Explain why a species was recommended
   - **Approach:** SHAP on suitability score features
   - **Features to explain:**
     - climate_match_score
     - survival_rate
     - absorption_potential
     - cost_efficiency
     - additional_benefits
   - **Visualization:** Waterfall chart showing contribution

---

#### E. Data Collection & Engineering (Ongoing, 30 hours)

1. **Tree Species Data Collection (Week 5, 8 hours)**
   - Research 20+ tree species
   - Collect absorption curves from literature
   - Validate survival rates
   - Format as JSON

2. **Policy Document Collection (Week 9, 4 hours)**
   - Download Budget 2026 PDF
   - Extract text
   - Annotate sample clauses

3. **Dataset Seeding (Week 5, 10, 4 hours)**
   - Seed tree_species table
   - Seed policy_clauses with Budget 2026
   - Verify data integrity

4. **Annotation Tasks (Week 10, 12, 8 hours)**
   - Annotate receipts for NER training
   - Annotate policy clauses for classification
   - Quality check annotations

---

## 8. TECHNICAL IMPLEMENTATION GUIDES

### 8.1 TEME Species Recommendation - Complete Flow

**Step-by-Step Implementation:**

1. **User initiates recommendation:**
   - Frontend: User fills form on `/teme/recommendations` page
   - Inputs: emission_amount_kg, location (auto-detected or manual), budget
   - Click "Get Recommendations"

2. **Frontend sends API request:**
   ```javascript
   // src/services/temeService.ts
   export const getSpeciesRecommendations = async (params) => {
     const response = await api.post('/api/v1/teme/recommend', {
       user_id: getCurrentUser().id,
       emission_amount_kg: params.emissionKg,
       location: {
         latitude: params.latitude,
         longitude: params.longitude,
         city: params.city,
         state: params.state
       },
       soil_type: params.soilType,
       water_availability: params.waterAvailability,
       budget: params.budget,
       planting_season: params.plantingSeason
     });
     return response.data;
   };
   ```

3. **Backend receives request:**
   ```javascript
   // backend/controllers/teme.controller.js
   exports.getRecommendations = async (req, res) => {
     try {
       const { user_id, emission_amount_kg, location, soil_type, water_availability, budget } = req.body;
       
       // Call Python ML service
       const mlResponse = await axios.post('http://ml-service:8000/ml/teme/recommend', {
         user_location: location,
         emission_kg: emission_amount_kg,
         soil_type,
         water_availability,
         budget
       });
       
       // Store recommendation record
       const recommendationId = await storeRecommendation(user_id, mlResponse.data);
       
       // Return to frontend
       res.json({
         success: true,
         recommendation_id: recommendationId,
         recommendations: mlResponse.data.recommendations,
         alternative_strategies: mlResponse.data.alternative_strategies,
         comparison: mlResponse.data.comparison
       });
     } catch (error) {
       res.status(500).json({ success: false, error: error.message });
     }
   };
   ```

4. **ML service processes:**
   ```python
   # ml_services/teme/api.py
   @app.post("/ml/teme/recommend")
   def get_recommendations(request: RecommendationRequest):
       # 1. Get climate zone
       climate_zone = get_climate_zone(request.user_location['latitude'], request.user_location['longitude'])
       
       # 2. Query candidate species from database
       candidates = query_species(climate_zone, request.water_availability, request.soil_type)
       
       # 3. Score and rank
       scored_species = []
       for species in candidates:
           score = calculate_suitability(species, request)
           scored_species.append((species, score))
       
       scored_species.sort(key=lambda x: x[1], reverse=True)
       top_3 = scored_species[:3]
       
       # 4. Calculate time-debt for each
       recommendations = []
       for species, score in top_3:
           count = calculate_trees_needed(species, request.emission_kg)
           time_debt = calculate_absorption_curve(species, count)
           
           recommendations.append({
               'species': species,
               'count': count,
               'suitability_score': score,
               'time_debt_curve': time_debt,
               'pros': generate_pros(species),
               'cons': generate_cons(species)
           })
       
       # 5. Calculate alternative strategies
       alternatives = calculate_reduction_alternatives(request.emission_kg)
       
       # 6. Comparison
       comparison = compare_strategies(recommendations[0], alternatives)
       
       return {
           'recommendations': recommendations,
           'alternative_strategies': alternatives,
           'comparison': comparison
       }
   ```

5. **Frontend displays results:**
   ```typescript
   // src/components/teme/SpeciesRecommendations.tsx
   const SpeciesRecommendations = ({ data }) => {
     return (
       <div>
         <h2>Top 3 Species Recommendations</h2>
         {data.recommendations.map((rec, idx) => (
           <SpeciesCard
             key={idx}
             rank={idx + 1}
             species={rec.species}
             count={rec.count}
             offset={rec.time_debt_curve[rec.time_debt_curve.length - 1]}
             timeDebtCurve={rec.time_debt_curve}
             pros={rec.pros}
             cons={rec.cons}
             onSelect={() => handleSelectSpecies(rec)}
           />
         ))}
         
         <h2>Alternative Strategies</h2>
         <ComparisonTable
           plantingOption={data.recommendations[0]}
           reductionOptions={data.alternative_strategies}
         />
       </div>
     );
   };
   ```

---

### 8.2 Policy NLP - Complete Flow

**Step-by-Step Implementation:**

1. **Admin uploads policy document:**
   - Admin dashboard: `/admin/policy/upload`
   - Upload PDF (Budget 2026)
   - Fill metadata: document name, type, date, authority

2. **Backend receives and queues:**
   ```javascript
   // backend/controllers/policy.controller.js
   exports.ingestDocument = async (req, res) => {
     const { document_name, document_type, document_date, issuing_authority, jurisdiction } = req.body;
     const pdfFile = req.file;
     
     // Upload to S3
     const s3Url = await uploadToS3(pdfFile);
     
     // Store metadata in MongoDB
     const doc = await PolicyDocument.create({
       document_name,
       document_type,
       document_date,
       issuing_authority,
       jurisdiction,
       pdf_url: s3Url,
       processing_status: 'queued'
     });
     
     // Add to processing queue
     await policyProcessingQueue.add({
       document_id: doc._id,
       pdf_url: s3Url
     });
     
     res.json({
       success: true,
       document_id: doc._id,
       estimated_time_minutes: 10
     });
   };
   ```

3. **Background worker processes document:**
   ```javascript
   // backend/queues/policyProcessing.worker.js
   policyProcessingQueue.process(async (job) => {
     const { document_id, pdf_url } = job.data;
     
     try {
       // 1. Download PDF from S3
       const pdfBuffer = await downloadFromS3(pdf_url);
       
       // 2. Extract text (PyMuPDF or Tesseract if scanned)
       const text = await extractText(pdfBuffer);
       
       // 3. Send to ML service for analysis
       const mlResponse = await axios.post('http://ml-service:8000/ml/policy/process-document', {
         document_id,
         text
       });
       
       // 4. Store extracted clauses in PostgreSQL
       for (const clause of mlResponse.data.clauses) {
         await storeClause(document_id, clause);
       }
       
       // 5. Update document status
       await PolicyDocument.findByIdAndUpdate(document_id, {
         processing_status: 'completed',
         extracted_text: text
       });
       
       // 6. Generate policy advice for affected users
       await generatePolicyAdvice(mlResponse.data.clauses);
       
     } catch (error) {
       await PolicyDocument.findByIdAndUpdate(document_id, {
         processing_status: 'failed',
         error_message: error.message
       });
       throw error;
     }
   });
   ```

4. **ML service analyzes document:**
   ```python
   # ml_services/policy/api.py
   @app.post("/ml/policy/process-document")
   def process_document(request: DocumentInput):
       document_id = request.document_id
       text = request.text
       
       # 1. Sentence segmentation
       sentences = segment_sentences(text)
       
       # 2. For each sentence, run NER, classification, sector tagging
       clauses = []
       for sentence in sentences:
           # Check if it's a clause (contains key policy indicators)
           if not is_policy_clause(sentence):
               continue
           
           # Extract entities
           entities = ner_model(sentence)
           
           # Classify clause type
           clause_type = clause_classifier(sentence)
           
           # Tag sectors
           sectors = sector_tagger(sentence)
           
           # Check if CCUS related
           is_ccus = is_ccus_related(sentence)
           
           clauses.append({
               'clause_text': sentence,
               'clause_type': clause_type,
               'affected_sectors': sectors,
               'extracted_entities': entities,
               'is_ccus_related': is_ccus,
               'confidence': 0.9
           })
       
       return {'clauses': clauses}
   ```

5. **Generate policy advice:**
   ```javascript
   // backend/services/adviceGenerator.service.js
   async function generatePolicyAdvice(clauses) {
     for (const clause of clauses) {
       // Get affected users/orgs
       const affectedOrgs = await getOrganizationsBySector(clause.affected_sectors);
       
       for (const org of affectedOrgs) {
         // Generate advice
         const advice = transformClauseToAdvice(clause, org);
         
         // Store in database
         await PolicyAdvice.create({
           organization_id: org.id,
           clause_id: clause.id,
           advice_title: advice.title,
           advice_text: advice.text,
           actionable_steps: advice.steps,
           urgency: advice.urgency,
           priority_score: advice.priority
         });
         
         // Send notification if urgent
         if (advice.urgency === 'immediate') {
           await sendNotification(org.id, advice);
         }
       }
     }
   }
   ```

6. **User sees policy advice:**
   - Frontend: User dashboard shows policy advice cards
   - Click card → Expand details → See actionable steps
   - Mark steps as complete → Update status
   - Download compliance memo button

---

## 9. DATASETS & RESOURCES

### 9.1 TEME Datasets

**Tree Species Data Sources:**

1. **FAO Species Database**
   - URL: http://www.fao.org/forestry/species/en/
   - Data: Scientific names, characteristics, growth rates

2. **Indian Council of Forestry Research (ICFR)**
   - URL: https://www.icfre.gov.in/
   - Data: Indian native species, regional suitability

3. **Research Papers:**
   - "Carbon sequestration potential of tree species in India" (multiple papers)
   - Search: Google Scholar, ResearchGate
   - Keywords: "tree carbon sequestration India", "silviculture carbon uptake"

4. **World Agroforestry Database**
   - URL: http://www.worldagroforestry.org/
   - Data: Agroforestry species, benefits

**Survival Rate Data:**
- Local forestry department reports
- Research papers on reforestation projects
- Historical planting data (if available from NGOs)

**Initial Seed Data (20 Species):**
1. Neem (Azadirachta indica)
2. Peepal (Ficus religiosa)
3. Banyan (Ficus benghalensis)
4. Mango (Mangifera indica)
5. Teak (Tectona grandis)
6. Bamboo (Bambusa species)
7. Eucalyptus (Eucalyptus species)
8. Acacia (Acacia species)
9. Sal (Shorea robusta)
10. Jackfruit (Artocarpus heterophyllus)
11. Tamarind (Tamarindus indica)
12. Amla (Phyllanthus emblica)
13. Gulmohar (Delonix regia)
14. Siris (Albizia lebbeck)
15. Jamun (Syzygium cumini)
16. Arjuna (Terminalia arjuna)
17. Ashoka (Saraca asoca)
18. Pongamia (Millettia pinnata)
19. Custard Apple (Annona squamosa)
20. Mahogany (Swietenia mahagoni)

---

### 9.2 Policy NLP Datasets

**Primary Source: Union Budget 2026**
- URL: https://www.indiabudget.gov.in/
- Download: Budget 2026 PDF (when released)
- Focus sections:
  - Environment and Climate Change
  - CCUS allocation (₹20,000 crore mention)
  - Carbon market mechanisms
  - Green financing initiatives

**Additional Policy Documents:**
1. **Ministry of Environment, Forest and Climate Change (MoEFCC) Notifications**
   - URL: https://moef.gov.in/
   - Regulations, guidelines, amendments

2. **State Pollution Control Board Circulars**
   - State-specific regulations
   - Compliance requirements

3. **CCUS Guidelines**
   - Search for official CCUS implementation guidelines
   - International references: IEA CCUS reports

**Manual Annotation:**
- Annotate 100-200 policy sentences for training
- Use tools: Label Studio, Prodigy, or custom annotation UI
- Annotation schema:
  - Entities: PENALTY, DEADLINE, AUTHORITY, FUNDING, SECTOR, THRESHOLD
  - Clause types: penalty, incentive, reporting, tech-mandate, funding, guideline

---

### 9.3 Existing Datasets (From Original Plan)

*(Retained from original dataset guide - no changes)*

- SROIE (receipt OCR)
- Food-101 (food recognition)
- Indian food datasets
- TACO (waste classification)
- IPCC emission factors
- Our World in Data CO2 time-series

---

## 10. DEMO & PRESENTATION STRATEGY

### 10.1 Viva Presentation Flow (30 minutes)

**Slide 1: Title Slide (0:30)**
- CarbonSense AI: Multi-Agentic Carbon Intelligence Platform
- Team members + Guide name
- Institution

**Slide 2: Problem Statement (2:00)**
- Carbon tracking gaps in existing solutions:
  - Fragmented (transport only, energy only)
  - Tree planting gimmicks ("plant a tree, offset instantly")
  - Policy compliance complexity (manually reading 1000+ page documents)
- Show statistics:
  - Food = 26% of global emissions (but missing in most apps)
  - 63 million SMEs in India need carbon tracking
  - Budget 2026 CCUS ₹20,000 crore opportunity

**Slide 3: Our Solution - Architecture Overview (2:00)**
- Multi-agentic platform diagram
- Highlight new modules:
  - TEME (Tree-Emission Matching Engine)
  - Policy NLP Module
- Show how they integrate with existing agents

**Slide 4: TEME - Scientific Tree Planting (3:00)**
- Traditional approach: "Plant 10 trees = Instant 100kg offset" ❌
- Our approach: Time-debt + Survival-weighted ✅
- Show formula:
  - Survival-Weighted Offset = Expected Absorption × Survival Probability
  - Time-Debt Curve: Year-by-year projection
- Visual: Time-debt graph (reduction vs planting comparison)

**Slide 5: Policy NLP - Automated Compliance (3:00)**
- Challenge: Budget 2026 is 500+ pages, how to extract relevant info?
- Our solution: NLP pipeline
  - Ingest → Extract → Classify → Personalize
- Show Budget 2026 CCUS clause extraction example
- Show personalized advice card for cement manufacturer

**Slide 6: Live Demo - Part 1 (User Journey) (5:00)**
- Login as user (SME owner - cement manufacturer)
- Dashboard shows:
  - Current emissions: 15,000 tonnes/year
  - CCUS Eligible badge ✓
- Create emission event: "Purchased 10 tonnes coal"
- Platform calculates: 26 tonnes CO2

**Slide 7: Live Demo - Part 2 (Recommendations) (5:00)**
- System generates recommendations:
  1. **Behavioral (Immediate):**
     - Switch to energy-efficient kilns → 5% reduction → 1.3 tonnes saved
  2. **TEME (Long-term):**
     - Plant 130 Neem trees → 20-year payback → 70% survival → Show time-debt curve
  3. **Policy Advice:**
     - "You're eligible for CCUS funding (Budget 2026)"
     - Show 8-step application checklist
- User selects "View Policy Advice"

**Slide 8: Live Demo - Part 3 (Compliance Dashboard) (3:00)**
- Navigate to Compliance Dashboard
- Show:
  - 3 pending actions
  - Deadline calendar (Q3 report due in 15 days)
  - Click "Generate Compliance Memo"
  - Download PDF (auto-generated, includes Budget 2026 reference)

**Slide 9: Live Demo - Part 4 (TEME Planting) (2:00)**
- User decides to plant trees
- Click "Plan Tree Planting"
- Select species: Neem (recommended #1)
- Enter details: 25 trees, Bangalore location
- Show expected offset projection graph
- "Upload Photos to Verify" (mock flow)

**Slide 10: Technical Deep Dive (4:00)**
- Multi-agentic architecture
- TEME algorithms:
  - Species selection scoring
  - Survival probability model
  - Time-debt calculator (code snippet)
- Policy NLP pipeline:
  - BERT NER for entity extraction
  - Clause classification
  - Sector mapping
- XAI for transparency:
  - SHAP for TEME recommendations
  - Show why Neem was recommended

**Slide 11: Results & Metrics (2:00)**
- **Technical Metrics:**
  - Receipt OCR: 92% accuracy ✓
  - Food recognition: 87% Top-1 ✓
  - Time-series MAPE: 8.5% (< 10% target) ✓
  - Policy NER: 91% F1-score ✓
- **User Metrics:**
  - Beta test: 50 users, 15% avg carbon reduction
  - TEME pilot: 1 SME, 100 trees planned
- **Impact Projection:**
  - 10K users = 750K tonnes CO2 saved/year

**Slide 12: Budget 2026 Connection (2:00)**
- Show Budget 2026 PDF excerpt (CCUS clause)
- Our platform extracted this automatically
- Mapped to cement/steel/fertilizer users
- Generated personalized application workflows
- **Policy-Aware Intelligence** = Our key differentiator

**Slide 13: Scientific Integrity & Limitations (1:30)**
- We're honest about uncertainties:
  - Trees don't offset instantly (time-debt model)
  - Survival is probabilistic (70-80%, not 100%)
  - Reduction-first is always better (we show this)
- Limitations:
  - TEME requires long-term monitoring (20 years)
  - Policy extraction accuracy dependent on document quality
  - Initial species data from literature (need real monitoring data)

**Slide 14: Publications & Research Contributions (1:00)**
- 3 papers in progress:
  1. "Multi-Agentic AI for SME Carbon Management" (Systems)
  2. "Time-Debt Modeling for Tree-Based Offsets" (Environmental Science)
  3. "Automated Policy Compliance via NLP" (NLP/AI)
- Novel contributions:
  - First SME-focused multi-agentic platform
  - Scientific tree-emission matching (vs gimmicks)
  - Policy-aware recommendations (Budget 2026 integration)

**Slide 15: Commercialization & Impact (1:00)**
- Business model: Freemium B2C + B2B SME subscriptions
- Revenue projection: ₹20 crore ARR by Year 3
- Social impact: 750K tonnes CO2 saved at 10K users
- Partnerships: In talks with 2 SMEs for pilots

**Slide 16: Thank You & Q&A (5:00)**
- Team photo
- Contact details
- Repository link
- Q&A

---

### 10.2 Key Talking Points for Q&A

**Q: Why TEME instead of just buying carbon credits?**
A: Buying credits is instant but often opaque. TEME provides:
1. Transparency: You see exactly what's planted, where, and when
2. Scientific honesty: We show time-debt, not instant offsets
3. Co-benefits: Trees provide shade, biodiversity, income (fruit/timber)
4. Long-term commitment: Forces users to think beyond "offset and forget"

**Q: How accurate is the survival probability model?**
A: Currently rule-based with conservative estimates (70-80%) from forestry literature. In Semester 2, we're training ML model on historical data. We always under-promise (show lower survival) to avoid greenwashing.

**Q: What if a policy document is in Hindi or regional language?**
A: Our NLP pipeline supports OCR → Translation → Extraction. We use Google Translate API for non-English docs. Accuracy drops to ~80% but still useful. Future work: Train on multilingual datasets.

**Q: How do you prevent fake planting verification?**
A: 4-layer verification:
1. GPS tagging (EXIF data from photos)
2. Timestamp verification (within 7 days of planting date)
3. Blockchain immutability (can't edit after verification)
4. Random audits (10% of plantings get physical verification)
5. Community reporting (other users can flag suspicious plantings)

**Q: Is this feasible for a college project? Seems too ambitious.**
A: Yes, because:
1. We're not building everything from scratch (use existing models: BERT, EfficientNet)
2. We focus on integration, not invention
3. TEME starts rule-based, evolves to ML (progressive complexity)
4. Policy NLP seeds with Budget 2026 (100 clauses), not 10,000 documents
5. MVP in Semester 1, advanced features in Semester 2

**Q: Why target SMEs instead of individuals or large enterprises?**
A: SMEs are the sweet spot:
- Too complex for simple B2C apps ✓
- Too expensive for enterprise solutions ✓
- Fastest growing market (14-17% CAGR) ✓
- Underserved (research gap) ✓
- Perfect scope for 12-month project ✓

---

### 10.3 Demo Preparation Checklist

**1 Week Before:**
- [ ] Prepare demo user accounts (pre-loaded with data)
- [ ] Seed database with realistic emissions (3 months of data)
- [ ] Create sample planting record with photos
- [ ] Ingest Budget 2026 (50 clauses extracted)
- [ ] Test all demo flows 3× times

**3 Days Before:**
- [ ] Record backup demo video (in case of tech issues)
- [ ] Print handouts: 1-page project summary + key screenshots
- [ ] Prepare USB with presentation + demo video
- [ ] Test projector compatibility

**Demo Day:**
- [ ] Arrive 30 min early
- [ ] Test internet connection
- [ ] Open all tabs beforehand (dashboard, recommendations, compliance)
- [ ] Have backup laptop ready
- [ ] Confidence + smile 😊

---

## 11. FINAL CHECKLIST FOR PROJECT COMPLETION

### 11.1 Semester 1 Deliverables (Week 24)

**Technical Deliverables:**
- [ ] Working web platform (deployed on cloud)
- [ ] All core features functional:
  - [ ] Authentication
  - [ ] Carbon tracking (manual + OCR)
  - [ ] Food recognition
  - [ ] Time-series forecasting
  - [ ] Recommendations
  - [ ] XAI dashboard
- [ ] NEW: TEME basic working:
  - [ ] 20 species in database
  - [ ] Recommendation API functional
  - [ ] Time-debt calculator working
  - [ ] UI mockups complete
- [ ] NEW: Policy NLP basic:
  - [ ] 50 clauses extracted from Budget 2026
  - [ ] Policy advice cards in UI
  - [ ] Classification model trained
- [ ] >80% code coverage
- [ ] Zero critical security vulnerabilities

**Documentation Deliverables:**
- [ ] User manual (20 pages)
- [ ] Technical documentation (40 pages)
- [ ] API documentation (Swagger)
- [ ] Database schema documentation
- [ ] Architecture diagrams
- [ ] **NEW: TEME algorithm documentation (5 pages)**
- [ ] **NEW: Policy NLP pipeline documentation (5 pages)**
- [ ] Project report (60-80 pages)
- [ ] Demo video (5 minutes)

**Presentation Deliverables:**
- [ ] Presentation slides (16 slides)
- [ ] Live demo script
- [ ] Handouts (1-page summary)
- [ ] Backup demo video

---

### 11.2 Semester 2 Deliverables (Week 48)

**Technical Deliverables:**
- [ ] Mobile app (Android + iOS)
- [ ] Blockchain integration (carbon credits + tree verification)
- [ ] Enterprise features (multi-user orgs, Scope 1/2/3)
- [ ] Supply chain mapping
- [ ] Advanced ML models
- [ ] **NEW: TEME advanced:**
  - [ ] ML-based survival predictor
  - [ ] Historical data integration
  - [ ] Monitoring workflow
  - [ ] Blockchain verification complete
- [ ] **NEW: Policy NLP advanced:**
  - [ ] 200+ clauses from multiple documents
  - [ ] Compliance dashboard complete
  - [ ] PDF memo generator
  - [ ] Deadline notifications
- [ ] K8s auto-scaling
- [ ] Multi-region deployment
- [ ] Performance optimized (<200ms API)

**Research Deliverables:**
- [ ] 3 papers submitted to conferences
- [ ] Dataset contributions (tree species, policy clauses)
- [ ] Open-source release (selected components)

**Business Deliverables:**
- [ ] 5-10 SME beta customers
- [ ] Business plan (50 pages)
- [ ] Revenue projections
- [ ] Funding pitch deck

---

## 12. CRITICAL SUCCESS FACTORS

**What Will Make This Project Exceptional:**

1. **Scientific Rigor:**
   - TEME uses peer-reviewed forestry data
   - Conservative estimates (under-promise, over-deliver)
   - Clear about limitations

2. **Real-World Validation:**
   - Pilot with 1-2 SMEs
   - Collect actual user feedback
   - Measure real carbon reductions

3. **Policy Relevance:**
   - Budget 2026 integration = timely + relevant
   - CCUS funding opportunity = immediate value
   - Compliance automation = real business need

4. **Technical Excellence:**
   - Multi-modal AI (CV + NLP + Time-series + RL)
   - Proper software architecture (not spaghetti code)
   - Production-grade security & scalability

5. **Presentation:**
   - Live demo that works
   - Clear narrative (problem → solution → impact)
   - Evidence-based claims (no hand-waving)

---

## CONCLUSION

This updated plan integrates **Tree-Emission Matching Engine (TEME)** and **Policy & CCUS NLP Module** seamlessly into your existing CarbonSense AI platform without removing any original features.

**Key Additions:**
- **TEME:** 40 hours Member 3, 20 hours Member 2, 30 hours Member 1 = 90 hours total
- **Policy NLP:** 40 hours Member 3, 45 hours Member 2, 25 hours Member 1 = 110 hours total
- **Total new work:** 200 hours across 2 semesters (4 hours/week per member average)

**This is achievable because:**
- We start rule-based, evolve to ML (progressive complexity)
- We seed with limited data (20 species, 50 clauses initially)
- We leverage existing infrastructure (same APIs, same DB, same agents)
- We focus on integration, not building from scratch

**The result:**
A technically robust, scientifically honest, policy-relevant, production-ready platform that will:
1. Impress examiners (novel research + real-world impact)
2. Enable publications (3+ papers)
3. Generate business opportunities (SME partnerships)
4. Create measurable carbon reductions (750K tonnes at scale)

**You're not just building a college project. You're building a solution that matters.** 🌍🚀

**Next immediate steps:**
1. Review this plan with your team (2 hours)
2. Seed tree_species table this week (Member 3, 8 hours)
3. Download Budget 2026 and extract 10 sample clauses (Member 3, 4 hours)
4. Update database schema (Member 2, 6 hours)
5. Create TEME mockups (Member 1, 4 hours)

**Total this week: 24 hours (8 hours per member)** — Start building! 💪

Good luck! You've got this! 🎯
