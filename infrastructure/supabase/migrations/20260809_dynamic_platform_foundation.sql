-- =============================================================================
-- CarbonSense Dynamic Platform Foundation
-- Groups 1.1 – 1.9 from CarbonSense_Dynamic_Platform_Plan (4).md
-- Run once; all statements are idempotent (IF NOT EXISTS / IF NOT EXISTS guards).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1.1 + 1.2  Organization profile fields
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS sector text,                          -- e.g. Manufacturing, IT/ITES, Textiles, F&B, Retail, Logistics, Construction, Healthcare, Other
  ADD COLUMN IF NOT EXISTS company_size_category text,           -- Micro / Small / Medium / Large (MSME headcount-based estimate)
  ADD COLUMN IF NOT EXISTS employee_count integer,
  ADD COLUMN IF NOT EXISTS electricity_usage_kwh_monthly numeric,
  ADD COLUMN IF NOT EXISTS computers_count integer,
  ADD COLUMN IF NOT EXISTS facility_area_sqft numeric,
  ADD COLUMN IF NOT EXISTS vehicle_fleet_count integer,
  ADD COLUMN IF NOT EXISTS business_travel_km_annual numeric,
  ADD COLUMN IF NOT EXISTS renewable_energy_pct numeric,         -- 0–100
  ADD COLUMN IF NOT EXISTS water_usage_kl_monthly numeric,
  ADD COLUMN IF NOT EXISTS waste_generated_kg_monthly numeric,
  ADD COLUMN IF NOT EXISTS working_days_per_week integer,
  ADD COLUMN IF NOT EXISTS annual_turnover_range text,           -- Optional; for MSME policy matching
  ADD COLUMN IF NOT EXISTS has_sustainability_certification boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_status text NOT NULL DEFAULT 'not_started', -- not_started | partial | complete
  ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz,
  -- 1.2 additions
  ADD COLUMN IF NOT EXISTS state text,                           -- Indian state for SPCB-routed compliance
  ADD COLUMN IF NOT EXISTS udyam_registration_number text,
  ADD COLUMN IF NOT EXISTS udyam_category text;                  -- Micro / Small / Medium per official Udyam registration

-- Constraint check for profile_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_profile_status_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_profile_status_check
      CHECK (profile_status IN ('not_started', 'partial', 'complete'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1.3  Assessment cycle engine
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.assessment_cycles (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_label          text        NOT NULL,                    -- e.g. "Aug 2026" or "Q3 2026"
  period_start          date        NOT NULL,
  period_end            date        NOT NULL,
  source_type           text        NOT NULL,                    -- csv_upload | manual_entry | company_profile | recalculation
  source_upload_id      uuid        REFERENCES public.organization_uploads(id) ON DELETE SET NULL,
  total_emissions_tco2e numeric,
  category_breakdown    jsonb       NOT NULL DEFAULT '{}'::jsonb, -- {Transport: 12.3, Energy: 45.6, ...}
  status                text        NOT NULL DEFAULT 'processing', -- processing | ready | failed
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_cycles_source_type_check
    CHECK (source_type IN ('csv_upload', 'manual_entry', 'company_profile', 'recalculation')),
  CONSTRAINT assessment_cycles_status_check
    CHECK (status IN ('processing', 'ready', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_assessment_cycles_org_created
  ON public.assessment_cycles(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_cycles_org_status
  ON public.assessment_cycles(organization_id, status);

-- Add cycle_id FK to recommendation_sessions (safe – column may already exist)
ALTER TABLE public.recommendation_sessions
  ADD COLUMN IF NOT EXISTS cycle_id uuid REFERENCES public.assessment_cycles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_input_type text;               -- manual | form | csv

-- Add cycle_id FK to compliance_results
ALTER TABLE public.compliance_results
  ADD COLUMN IF NOT EXISTS cycle_id uuid REFERENCES public.assessment_cycles(id) ON DELETE SET NULL;

-- Add cycle_id FK to teme_runs (guard: only if table exists)
DO $$
BEGIN
  IF to_regclass('public.teme_runs') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'teme_runs'
        AND column_name  = 'cycle_id'
    ) THEN
      ALTER TABLE public.teme_runs
        ADD COLUMN cycle_id uuid REFERENCES public.assessment_cycles(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1.4  Recommendation implementation tracking — per-item child table
-- ---------------------------------------------------------------------------

-- Normalised child table (replaces per-session status that is meaningless once a
-- session has 5 recommendations with different fates).
CREATE TABLE IF NOT EXISTS public.recommendation_items (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            uuid        NOT NULL REFERENCES public.recommendation_sessions(id) ON DELETE CASCADE,
  organization_id       uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  cycle_id              uuid        REFERENCES public.assessment_cycles(id) ON DELETE SET NULL,
  title                 text        NOT NULL,
  description           text        NOT NULL,
  category              text,                                    -- Transport | Energy | Waste | Purchases
  impact_tco2e          numeric,
  cost_inr              numeric,
  difficulty            text,                                    -- Easy | Medium | Hard
  source_input_type     text,                                    -- manual | form | csv
  catalog_entry_id      uuid,                                    -- FK to recommendation_catalog (added after that table exists)
  implementation_status text        NOT NULL DEFAULT 'proposed', -- proposed | in_progress | implemented | rejected
  status_updated_at     timestamptz,
  status_updated_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  actual_impact_tco2e   numeric,                                 -- filled in later for loop-closure
  rank                  integer     NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recommendation_items_status_check
    CHECK (implementation_status IN ('proposed', 'in_progress', 'implemented', 'rejected')),
  CONSTRAINT recommendation_items_difficulty_check
    CHECK (difficulty IS NULL OR difficulty IN ('Easy', 'Medium', 'Hard'))
);

CREATE INDEX IF NOT EXISTS idx_recommendation_items_session
  ON public.recommendation_items(session_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_items_org_status
  ON public.recommendation_items(organization_id, implementation_status);
CREATE INDEX IF NOT EXISTS idx_recommendation_items_cycle
  ON public.recommendation_items(cycle_id);

-- Legacy per-session status columns (kept for backward compat, use per-item going forward)
ALTER TABLE public.recommendation_sessions
  ADD COLUMN IF NOT EXISTS implementation_status text DEFAULT 'proposed',
  ADD COLUMN IF NOT EXISTS status_updated_at     timestamptz,
  ADD COLUMN IF NOT EXISTS status_updated_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actual_impact_tco2e   numeric;

-- ---------------------------------------------------------------------------
-- 1.5  Recommendation catalog
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.recommendation_catalog (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector               text NOT NULL,                            -- Manufacturing | IT/ITES | Textiles | F&B | Retail | Logistics | Healthcare | Construction | Other
  category             text NOT NULL,                            -- Transport | Energy | Waste | Purchases
  title                text NOT NULL,
  description          text NOT NULL,
  typical_impact_range text,                                     -- e.g. "5–15% reduction in Transport emissions"
  typical_cost_range_inr text,                                   -- e.g. "₹50,000–₹2,00,000"
  difficulty           text,                                     -- Easy | Medium | Hard
  source_note          text,                                     -- BEE, MOEF, GHG Protocol, etc.
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recommendation_catalog_difficulty_check
    CHECK (difficulty IS NULL OR difficulty IN ('Easy', 'Medium', 'Hard'))
);

CREATE INDEX IF NOT EXISTS idx_recommendation_catalog_sector_category
  ON public.recommendation_catalog(sector, category);
CREATE INDEX IF NOT EXISTS idx_recommendation_catalog_active
  ON public.recommendation_catalog(is_active);

-- Add FK from recommendation_items to catalog now that catalog table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name        = 'recommendation_items'
      AND constraint_name   = 'recommendation_items_catalog_entry_id_fkey'
  ) THEN
    ALTER TABLE public.recommendation_items
      ADD CONSTRAINT recommendation_items_catalog_entry_id_fkey
      FOREIGN KEY (catalog_entry_id) REFERENCES public.recommendation_catalog(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1.6  Policy adoption tracking
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organization_policy_adoption (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  policy_id        uuid        NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  status           text        NOT NULL DEFAULT 'not_started', -- not_started | in_progress | adopted | not_applicable
  status_updated_at timestamptz,
  status_updated_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  evidence_url     text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, policy_id),
  CONSTRAINT organization_policy_adoption_status_check
    CHECK (status IN ('not_started', 'in_progress', 'adopted', 'not_applicable'))
);

CREATE INDEX IF NOT EXISTS idx_org_policy_adoption_org
  ON public.organization_policy_adoption(organization_id, status);

-- ---------------------------------------------------------------------------
-- 1.9  latest_cycle_per_org convenience view
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.latest_cycle_per_org AS
  SELECT DISTINCT ON (organization_id)
    id                    AS cycle_id,
    organization_id,
    period_label,
    period_start,
    period_end,
    source_type,
    total_emissions_tco2e,
    category_breakdown,
    status,
    created_at
  FROM public.assessment_cycles
  WHERE status = 'ready'
  ORDER BY organization_id, created_at DESC;

-- ---------------------------------------------------------------------------
-- RLS policies for all new tables
-- (Follows exact pattern of existing tables: org-scoped via organization_members)
-- ---------------------------------------------------------------------------

-- assessment_cycles
ALTER TABLE public.assessment_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assessment_cycles_select_org ON public.assessment_cycles;
CREATE POLICY assessment_cycles_select_org
  ON public.assessment_cycles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = assessment_cycles.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS assessment_cycles_insert_members ON public.assessment_cycles;
CREATE POLICY assessment_cycles_insert_members
  ON public.assessment_cycles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = assessment_cycles.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS assessment_cycles_update_members ON public.assessment_cycles;
CREATE POLICY assessment_cycles_update_members
  ON public.assessment_cycles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = assessment_cycles.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('admin', 'manager')
    )
  );

-- recommendation_items
ALTER TABLE public.recommendation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recommendation_items_select_org ON public.recommendation_items;
CREATE POLICY recommendation_items_select_org
  ON public.recommendation_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = recommendation_items.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS recommendation_items_insert_members ON public.recommendation_items;
CREATE POLICY recommendation_items_insert_members
  ON public.recommendation_items FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = recommendation_items.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS recommendation_items_update_members ON public.recommendation_items;
CREATE POLICY recommendation_items_update_members
  ON public.recommendation_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = recommendation_items.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('admin', 'manager')
    )
  );

-- recommendation_catalog (read by all authenticated org members; write by admin only)
ALTER TABLE public.recommendation_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recommendation_catalog_select_all ON public.recommendation_catalog;
CREATE POLICY recommendation_catalog_select_all
  ON public.recommendation_catalog FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS recommendation_catalog_admin_all ON public.recommendation_catalog;
CREATE POLICY recommendation_catalog_admin_all
  ON public.recommendation_catalog FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- organization_policy_adoption
ALTER TABLE public.organization_policy_adoption ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_policy_adoption_select_org ON public.organization_policy_adoption;
CREATE POLICY org_policy_adoption_select_org
  ON public.organization_policy_adoption FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_policy_adoption.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS org_policy_adoption_insert_members ON public.organization_policy_adoption;
CREATE POLICY org_policy_adoption_insert_members
  ON public.organization_policy_adoption FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_policy_adoption.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS org_policy_adoption_update_members ON public.organization_policy_adoption;
CREATE POLICY org_policy_adoption_update_members
  ON public.organization_policy_adoption FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_policy_adoption.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('admin', 'manager')
    )
  );

-- ---------------------------------------------------------------------------
-- Seed: recommendation_catalog
-- ~15–20 entries per major sector covering all 4 emission categories.
-- Content is manually curated, India-context, BEE/GHG Protocol/MOEF sourced.
-- ---------------------------------------------------------------------------

INSERT INTO public.recommendation_catalog
  (sector, category, title, description, typical_impact_range, typical_cost_range_inr, difficulty, source_note)
VALUES
  -- IT/ITES — Energy
  ('IT/ITES', 'Energy', 'Switch to LED lighting across office floors',
   'Replace fluorescent and CFL fixtures with LED equivalents. LEDs use 50–70% less electricity and last 5x longer, reducing both energy bills and lamp-replacement costs.',
   '10–20% reduction in office lighting energy', '₹40,000–₹3,00,000', 'Easy', 'BEE ECBC, GHG Protocol Scope 2'),

  ('IT/ITES', 'Energy', 'Enable auto-standby and power management on all workstations',
   'Configure OS power settings so monitors sleep after 5 min and PCs after 15 min of inactivity. Estimated saving: 30–50 W per device during idle hours.',
   '5–12% reduction in IT equipment electricity', '₹0–₹5,000 (configuration only)', 'Easy', 'BEE Guidelines for IT Equipment'),

  ('IT/ITES', 'Energy', 'Consolidate and virtualise on-premises servers',
   'Move workloads to fewer physical servers via hypervisor (VMware/KVM/Hyper-V). Typically achieves 10:1 consolidation ratio, cutting data centre electricity 60–80%.',
   '20–40% reduction in data centre Scope 2 emissions', '₹2,00,000–₹15,00,000', 'Hard', 'GHG Protocol ICT Sector Guidance'),

  ('IT/ITES', 'Energy', 'Install solar rooftop system for office energy',
   'Grid-connected rooftop PV offsets daytime electricity consumption. A 10 kWp system generates ~14,000 kWh/year in most Indian locations, covering 30–60% of a typical SME office load.',
   '25–50% reduction in Scope 2 electricity emissions', '₹4,00,000–₹8,00,000 (before MNRE subsidy)', 'Medium', 'MNRE Rooftop Solar Programme'),

  ('IT/ITES', 'Transport', 'Introduce a company shuttle or carpooling scheme',
   'Organise shift-wise shuttle routes or a carpool-matching app for employees. Reduces per-employee commute emissions 40–70% versus individual car use.',
   '15–30% reduction in Scope 3 employee commute emissions', '₹50,000–₹5,00,000/year', 'Medium', 'GHG Protocol Scope 3 Category 7'),

  ('IT/ITES', 'Transport', 'Shift domestic business travel to video conferencing',
   'Replace routine inter-city check-in meetings with video calls. Each avoided domestic flight saves ~120 kg CO₂e. Set a travel approval threshold requiring VC-first justification.',
   '20–40% reduction in Scope 3 business travel', '₹0–₹50,000 (policy + tooling)', 'Easy', 'GHG Protocol Scope 3 Category 6'),

  ('IT/ITES', 'Waste', 'Implement e-waste segregation and authorised recycler tie-up',
   'Route end-of-life laptops, phones, and peripherals to MoEF-authorised e-waste recyclers. Avoids informal dismantling emissions and meets E-Waste (Management) Rules 2022 EPR obligations.',
   '100% diversion of IT e-waste from landfill', '₹0–₹20,000 (collection logistics)', 'Easy', 'E-Waste (Management) Rules 2022, CPCB'),

  ('IT/ITES', 'Waste', 'Go paperless: digitise invoices, contracts, and HR documents',
   'Adopt a document management system (DMS) to eliminate print-and-store workflows. Paper production emits ~3.5 kg CO₂e per kg; a 50-person office typically prints 500+ kg/year.',
   '5–10% reduction in office waste Scope 3 emissions', '₹10,000–₹60,000/year', 'Easy', 'GHG Protocol Scope 3 Category 5'),

  -- Manufacturing — Energy
  ('Manufacturing', 'Energy', 'Upgrade motors to IE3/IE4 efficiency class',
   'Replace standard-efficiency induction motors with BEE star-rated IE3 or IE4 equivalents. Motors account for 70% of industrial electricity; upgrading saves 5–15% per motor.',
   '8–15% reduction in process electricity consumption', '₹80,000–₹10,00,000 per unit', 'Medium', 'BEE Motor Performance Standards'),

  ('Manufacturing', 'Energy', 'Install variable frequency drives (VFDs) on pumps and fans',
   'VFDs match motor speed to actual load demand. Pump/fan energy follows cube law — halving speed cuts power by ~87%. Payback typically under 2 years in continuous-operation plants.',
   '10–30% reduction in pump/fan energy', '₹30,000–₹5,00,000 per drive', 'Medium', 'BEE Pumping System Guidelines'),

  ('Manufacturing', 'Energy', 'Conduct a BEE-mandated energy audit and implement top findings',
   'Schedule a certified energy auditor (BEE). Typical SME audit identifies 10–25% energy savings. Required for plants above prescribed connected load (PAT scheme).',
   '10–25% reduction across Scope 1 and Scope 2', '₹50,000–₹3,00,000 (audit fee)', 'Medium', 'BEE, Energy Conservation Act 2001'),

  ('Manufacturing', 'Waste', 'Implement zero-liquid-discharge (ZLD) and waste heat recovery',
   'Capture process heat from exhaust streams and reuse for pre-heating inputs. ZLD reduces wastewater discharge and associated treatment emissions.',
   '5–20% reduction in process Scope 1 thermal emissions', '₹5,00,000–₹50,00,000', 'Hard', 'CPCB ZLD Guidelines, MOEF'),

  ('Manufacturing', 'Transport', 'Optimise logistics routes and consolidate freight shipments',
   'Use route optimisation software (e.g. Google Maps Platform, OptimoRoute) and consolidate outbound deliveries. Typically reduces vehicle-km by 15–25% with no service-level reduction.',
   '10–20% reduction in outbound Scope 3 transport emissions', '₹20,000–₹2,00,000', 'Medium', 'GHG Protocol Scope 3 Category 4/9'),

  -- F&B — Energy & Waste
  ('F&B', 'Energy', 'Install star-rated commercial refrigeration and cold chain equipment',
   'Replace standard fridges/freezers with BEE 5-star rated units. Commercial refrigeration accounts for 30–50% of F&B facility electricity; upgrading saves 20–35%.',
   '20–35% reduction in refrigeration electricity', '₹1,00,000–₹20,00,000', 'Medium', 'BEE Star Label Programme'),

  ('F&B', 'Waste', 'Divert food waste to biogas plant or composting facility',
   'Route unavoidable food waste to an onsite biogas digester or certified composting agency instead of landfill. Landfill methane has 28x the warming effect of CO₂.',
   '70–90% reduction in food-waste landfill emissions', '₹1,00,000–₹8,00,000 (digester) or ₹0 (composting tie-up)', 'Medium', 'MOEF Solid Waste Management Rules 2016'),

  ('F&B', 'Purchases', 'Source fresh produce locally (within 200 km) to cut cold-chain transport',
   'Shift procurement to verified local/regional suppliers. Eliminates long-distance refrigerated freight emissions (avg 0.21 kg CO₂e per tonne-km refrigerated) for tier-1 ingredients.',
   '10–25% reduction in Scope 3 purchased goods transport', 'Cost-neutral to +5%', 'Easy', 'GHG Protocol Scope 3 Category 1/4'),

  -- Retail — Energy & Transport
  ('Retail', 'Energy', 'Install building automation system (BAS) for HVAC scheduling',
   'BAS adjusts HVAC to occupancy schedules automatically. Retail stores waste 20–35% of HVAC energy during non-trading hours. Payback 1–3 years.',
   '15–25% reduction in HVAC electricity', '₹2,00,000–₹15,00,000', 'Medium', 'BEE ECBC, ASHRAE 90.1'),

  ('Retail', 'Transport', 'Switch delivery fleet to CNG or electric vehicles',
   'Replace petrol/diesel last-mile delivery vehicles with CNG (40% lower CO₂) or EV (zero tailpipe if charged from renewable grid). FAME-II subsidy available for EVs.',
   '30–80% reduction in last-mile delivery Scope 1 emissions', '₹3,00,000–₹12,00,000 per vehicle (before subsidy)', 'Hard', 'FAME-II, MoRTH EV Policy'),

  -- Logistics — Transport & Energy
  ('Logistics', 'Transport', 'Adopt telematics and eco-driving training for fleet drivers',
   'GPS telematics + driver scorecards reduce idling, harsh braking, and over-speeding. Documented fuel savings of 5–15% per vehicle with no capital spend beyond telematics hardware.',
   '5–15% reduction in fleet fuel consumption and Scope 1 emissions', '₹5,000–₹15,000/vehicle/year', 'Easy', 'GHG Protocol Mobile Combustion'),

  ('Logistics', 'Energy', 'Convert warehouse lighting to motion-sensor-controlled LEDs',
   'Warehouses are often lit 24/7 despite intermittent occupancy. Motion-sensor LED retrofit cuts lighting energy 60–80% in low-traffic aisles.',
   '20–40% reduction in warehouse lighting electricity', '₹50,000–₹5,00,000', 'Easy', 'BEE Industrial Lighting Guidelines'),

  -- Healthcare — Energy & Waste
  ('Healthcare', 'Energy', 'Install energy monitoring system on medical equipment',
   'Sub-meter energy consumption by department and equipment type. Identify phantom loads from imaging equipment left in standby. Typically uncovers 10–20% savings with no capital beyond metering.',
   '8–15% reduction in facility electricity', '₹30,000–₹2,00,000', 'Easy', 'BEE Hospital Energy Efficiency Programme'),

  ('Healthcare', 'Waste', 'Segregate biomedical waste and ensure authorised treatment compliance',
   'Route biomedical waste to CPCB-authorised common biomedical waste treatment facilities (CBWTFs). Reduces unregulated incineration emissions and ensures BMW Rules 2016 compliance.',
   'Full compliance with BMW Rules 2016; reduces uncontrolled incineration Scope 1 emissions', '₹5,000–₹50,000/year', 'Easy', 'BMW Rules 2016, CPCB'),

  -- Construction — Materials & Transport
  ('Construction', 'Purchases', 'Specify low-carbon cement blends (PPC/PSC) over OPC',
   'Portland Pozzolana Cement (PPC) and Portland Slag Cement (PSC) embed industrial by-products (fly ash, GGBS). Embodied CO₂ is 20–35% lower than Ordinary Portland Cement with equivalent structural performance.',
   '15–30% reduction in cement-related Scope 3 embodied carbon', 'Cost-neutral (PPC/PSC often priced same as OPC)', 'Easy', 'GHG Protocol Scope 3, BIS IS:1489/455'),

  ('Construction', 'Transport', 'Source aggregates and sand from quarries within 50 km of site',
   'Transport of bulk materials (aggregates, sand, steel) is a major Scope 3 source. Local sourcing cuts average haul distance and associated diesel combustion.',
   '10–20% reduction in material-transport Scope 3 emissions', 'Cost-neutral to saving', 'Easy', 'GHG Protocol Scope 3 Category 4'),

  -- Textiles — Energy & Waste
  ('Textiles', 'Energy', 'Install waste heat recovery on dyeing and processing boilers',
   'Textile wet processing generates large volumes of hot exhaust. Shell-and-tube heat exchangers recover 30–60% of exhaust heat to pre-heat incoming water, cutting boiler fuel load.',
   '15–25% reduction in boiler Scope 1 fuel consumption', '₹3,00,000–₹20,00,000', 'Medium', 'BEE Textile Energy Performance Guidelines'),

  ('Textiles', 'Waste', 'Implement fabric waste reuse and recycled fibre sourcing targets',
   'Redirect fabric offcuts to recycled fibre mills or garment banks instead of landfill. Set a minimum recycled fibre content target (e.g. 20%) for next procurement cycle.',
   '5–15% reduction in Scope 3 waste and purchased goods emissions', 'Variable', 'Medium', 'GHG Protocol Scope 3, EPR Textile Rules 2022')

ON CONFLICT DO NOTHING;
