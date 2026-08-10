-- ============================================================
-- CarbonSense Recommendation Catalog Seed Data — Group 6.3
-- ~20 entries per major sector covering all 4 categories
-- Run in Supabase SQL Editor (idempotent via ON CONFLICT DO NOTHING)
-- ============================================================

INSERT INTO recommendation_catalog
  (sector, category, title, description, typical_impact_range, typical_cost_range_inr, difficulty, source_note, is_active)
VALUES

-- ── MANUFACTURING ─────────────────────────────────────────────────────────────

('Manufacturing', 'Energy', 'Switch to LED lighting across facility',
 'Replace all fluorescent and incandescent lights with LED equivalents. LEDs use 60–80% less electricity and last 10× longer.',
 '2–8 tCO₂e/year', '₹50,000–₹2,00,000', 'Easy',
 'BEE MSME Energy Guide, 2023', true),

('Manufacturing', 'Energy', 'Install variable frequency drives (VFDs) on motors',
 'Adding VFDs to pumps and compressors can reduce motor energy use by 20–40% by matching motor speed to actual load.',
 '5–20 tCO₂e/year', '₹1,00,000–₹5,00,000', 'Medium',
 'Bureau of Energy Efficiency (BEE) PAT Scheme', true),

('Manufacturing', 'Energy', 'Commission an energy audit',
 'A BEE-certified energy auditor will identify your top saving opportunities ranked by payback period. Most audits pay back within 6 months.',
 '10–30 tCO₂e/year (potential)', '₹30,000–₹80,000', 'Easy',
 'BEE Designated Consumer Guidelines', true),

('Manufacturing', 'Energy', 'Install rooftop solar with net metering',
 'A 50kW rooftop system can offset 35–50% of grid electricity for a mid-sized factory and qualifies for MNRE capital subsidies.',
 '40–70 tCO₂e/year', '₹25,00,000–₹50,00,000', 'Hard',
 'MNRE Solar Rooftop Phase II', true),

('Manufacturing', 'Transport', 'Consolidate raw material deliveries',
 'Coordinate with 2–3 suppliers to batch deliveries on the same truck or route. Reduces empty-run kilometres by 30–40%.',
 '3–10 tCO₂e/year', '₹0–₹20,000', 'Easy',
 'GHG Protocol Scope 3 guidance', true),

('Manufacturing', 'Transport', 'Convert delivery fleet to CNG or EV',
 'Replacing diesel LCVs with CNG or electric equivalents cuts per-km Scope 1 emissions by 25% (CNG) or 80% (EV with renewable charging).',
 '8–25 tCO₂e/year', '₹5,00,000–₹20,00,000', 'Hard',
 'MoRTH EV Policy, FAME II', true),

('Manufacturing', 'Waste', 'Implement dry scrap segregation at source',
 'Separating metal, plastic, and cardboard waste at the machine enables higher recycling rates and reduces landfill disposal costs.',
 '1–4 tCO₂e/year', '₹10,000–₹40,000', 'Easy',
 'CPCB Solid Waste Management Rules 2016', true),

('Manufacturing', 'Waste', 'Implement coolant recycling system',
 'Used coolant filtration and recovery units can reduce hazardous waste disposal by 60–70% and cut coolant purchase costs.',
 '2–6 tCO₂e/year', '₹80,000–₹3,00,000', 'Medium',
 'MSME Green Champion Handbook, CII', true),

('Manufacturing', 'Purchases', 'Source packaging materials from recycled suppliers',
 'Switching from virgin plastic or cardboard packaging to recycled-content equivalents reduces Scope 3 upstream emissions by 30–50% for that category.',
 '2–8 tCO₂e/year', '₹0–₹50,000', 'Easy',
 'GHG Protocol Scope 3 Category 1', true),

('Manufacturing', 'Purchases', 'Apply green procurement criteria for capital equipment',
 'When replacing machinery, include energy star rating or BEE star label as a mandatory bid criterion, not just an optional factor.',
 '5–15 tCO₂e/year', '₹0', 'Easy',
 'BEE Star Labelling Programme', true),

-- ── IT/ITES ──────────────────────────────────────────────────────────────────

('IT/ITES', 'Energy', 'Enable power management on all workstations',
 'Enable sleep/hibernate after 10 minutes for monitors and PCs. Across 100 devices this saves ≈ 3–6 tCO₂e/year with zero cost.',
 '2–8 tCO₂e/year', '₹0', 'Easy',
 'ENERGY STAR Computers Spec 9.0', true),

('IT/ITES', 'Energy', 'Migrate to cloud or virtualise on-premise servers',
 'Moving from dedicated on-prem servers to a shared cloud environment typically reduces IT infrastructure energy use by 40–70%.',
 '5–20 tCO₂e/year', '₹0–₹5,00,000', 'Medium',
 'GHG Protocol ICT Sector Guidance', true),

('IT/ITES', 'Energy', 'Upgrade air conditioning to 5-star inverter units',
 'AC typically accounts for 40–50% of office electricity. Inverter units with 5-star BEE rating use 30–40% less than standard units.',
 '3–12 tCO₂e/year', '₹1,50,000–₹6,00,000', 'Medium',
 'BEE Star Labelling — Room Air Conditioners', true),

('IT/ITES', 'Transport', 'Launch an employee carpooling or shuttle programme',
 'Organising shared transport for employees commuting from similar routes can reduce Scope 3 employee commuting emissions by 20–40%.',
 '5–20 tCO₂e/year', '₹50,000–₹2,00,000', 'Medium',
 'GHG Protocol Scope 3 Category 7', true),

('IT/ITES', 'Transport', 'Adopt a hybrid-remote work policy',
 'Allowing 2 days/week remote reduces commuting Scope 3 emissions by 30–40% per employee. Formalise it as an emissions-reduction policy.',
 '10–40 tCO₂e/year', '₹0', 'Easy',
 'GHG Protocol Scope 3 Category 7', true),

('IT/ITES', 'Waste', 'Join a certified e-waste recycler for device disposal',
 'Partner with a MoEFCC-authorised e-waste dismantler/recycler. Prevents hazardous landfill emissions and fulfils E-Waste Management Rules 2022.',
 '1–3 tCO₂e/year', '₹5,000–₹20,000', 'Easy',
 'E-Waste Management Rules 2022, MoEFCC', true),

('IT/ITES', 'Purchases', 'Require sustainability certifications in IT hardware procurement',
 'Include ENERGY STAR, EPEAT Silver or higher, or BEE 4-star minimum as mandatory requirements in hardware tenders.',
 '3–10 tCO₂e/year', '₹0', 'Easy',
 'EPEAT, BEE Star Labelling', true),

-- ── TEXTILES ──────────────────────────────────────────────────────────────────

('Textiles', 'Energy', 'Recover and reuse steam condensate',
 'Installing condensate return lines on dyeing and finishing machines recovers 80–90% of steam energy otherwise lost, cutting boiler fuel use.',
 '10–30 tCO₂e/year', '₹2,00,000–₹8,00,000', 'Medium',
 'BEE Energy Conservation in Textile Sector', true),

('Textiles', 'Energy', 'Install solar thermal water heating for process heat',
 'Solar thermal collectors can offset 20–40% of LPG/diesel used for low-temperature process heating in pre-treatment and dyeing.',
 '5–15 tCO₂e/year', '₹3,00,000–₹12,00,000', 'Hard',
 'MNRE Solar Thermal Programme', true),

('Textiles', 'Waste', 'Implement zero-liquid-discharge (ZLD) effluent treatment',
 'ZLD systems recover treated water for process reuse, eliminating wastewater discharge and the associated chemical emissions from untreated effluent.',
 '3–8 tCO₂e/year', '₹10,00,000–₹50,00,000', 'Hard',
 'CPCB ZLD Guidelines for Textile Industry', true),

('Textiles', 'Purchases', 'Switch to GOTS-certified or recycled fibre inputs',
 'Global Organic Textile Standard (GOTS) certified cotton or recycled polyester has 30–60% lower upstream emissions per kg vs virgin conventional inputs.',
 '5–20 tCO₂e/year', '₹0–₹1,00,000', 'Medium',
 'GOTS Standard v7.0', true),

-- ── LOGISTICS ────────────────────────────────────────────────────────────────

('Logistics', 'Transport', 'Optimise route planning with GPS/TMS software',
 'Transport management systems typically reduce vehicle-km by 10–20% through better route consolidation and load-fill optimisation.',
 '15–50 tCO₂e/year', '₹50,000–₹3,00,000', 'Medium',
 'MoRTH Logistics Efficiency Policy 2022', true),

('Logistics', 'Transport', 'Transition HCV fleet to BS VI vehicles',
 'BS VI heavy commercial vehicles emit 77% less NOx and particulate matter vs BS IV, and average 5–8% better fuel efficiency.',
 '20–60 tCO₂e/year', '₹40,00,000+ per vehicle', 'Hard',
 'MoRTH BS VI Notification, April 2020', true),

('Logistics', 'Transport', 'Adopt tyre pressure monitoring on fleet',
 'Under-inflated tyres increase fuel consumption by 2–3%. Automated TPMS systems pay back within 6 months for a 20-vehicle fleet.',
 '2–8 tCO₂e/year', '₹50,000–₹2,00,000', 'Easy',
 'ARAI Fleet Efficiency Handbook', true),

('Logistics', 'Energy', 'Install solar panels at warehouses',
 'Warehouse rooftops are often large and unshaded — a 100kW system can offset 70–90% of warehouse electricity (lighting, charging, HVAC).',
 '60–100 tCO₂e/year', '₹50,00,000–₹1,00,00,000', 'Hard',
 'MNRE Solar Rooftop Phase II', true),

('Logistics', 'Waste', 'Reduce packaging material per shipment',
 'Re-engineer packaging to minimise void fill and single-use plastic wrap. Industry average reduction is 20–30% by weight with equivalent protection.',
 '2–6 tCO₂e/year', '₹20,000–₹80,000', 'Easy',
 'Plastic Waste Management Rules 2022, MoEFCC', true),

-- ── F&B ──────────────────────────────────────────────────────────────────────

('F&B', 'Energy', 'Install variable-speed refrigeration compressors',
 'Variable-speed compressors adjust to actual thermal load instead of cycling on/off, saving 20–35% refrigeration energy in cold storage.',
 '5–15 tCO₂e/year', '₹2,00,000–₹8,00,000', 'Medium',
 'BEE Cold Chain Guidelines', true),

('F&B', 'Waste', 'Implement food waste composting or biogas recovery',
 'Diverting organic waste from landfill to on-site composting or biogas reduces methane emissions from decomposition. Biogas can also offset LPG.',
 '3–10 tCO₂e/year', '₹50,000–₹5,00,000', 'Medium',
 'CPCB Solid Waste Management Rules 2016, FSSAI Sustainability Code', true),

('F&B', 'Energy', 'Switch to biomass or solar thermal for process heating',
 'Replacing LPG or furnace oil boilers with biomass briquette or solar thermal for cooking/sterilisation processes reduces Scope 1 emissions by 40–70%.',
 '10–30 tCO₂e/year', '₹3,00,000–₹15,00,000', 'Hard',
 'BEE Energy Conservation in Food Processing', true),

('F&B', 'Purchases', 'Localise supply chain for high-weight ingredients',
 'Sourcing high-volume ingredients from suppliers within 200km vs 1,000km reduces Scope 3 transport emissions for that category by 70–80%.',
 '3–12 tCO₂e/year', '₹0–₹50,000', 'Easy',
 'GHG Protocol Scope 3 Category 4', true),

-- ── RETAIL ───────────────────────────────────────────────────────────────────

('Retail', 'Energy', 'Replace halogen spotlights with LED track lighting',
 'Retail stores typically run spotlights 12–14 hours/day. LED replacements use 70% less power and provide equivalent lux levels for product display.',
 '3–10 tCO₂e/year', '₹40,000–₹1,50,000', 'Easy',
 'BEE Star Labelling — Lighting', true),

('Retail', 'Purchases', 'Transition private-label packaging to 30%+ recycled content',
 'Switching own-brand packaging to 30% PCR (post-consumer recycled) content reduces packaging Scope 3 upstream emissions by 25–35%.',
 '2–8 tCO₂e/year', '₹0–₹50,000', 'Medium',
 'Plastic Waste Management Rules 2022', true),

('Retail', 'Transport', 'Consolidate last-mile delivery with local carriers',
 'Working with a shared logistics provider to consolidate last-mile deliveries across multiple retailers in the same area reduces per-order km by 30–50%.',
 '5–20 tCO₂e/year', '₹1,00,000–₹3,00,000', 'Medium',
 'GHG Protocol Scope 3 Category 9', true),

('Retail', 'Waste', 'Partner with an EPR-registered brand for packaging take-back',
 'Extended Producer Responsibility (EPR) rules require retailers handling plastic packaging to ensure collection/recycling. Register with a PRO to fulfil this.',
 '1–5 tCO₂e/year', '₹10,000–₹50,000', 'Easy',
 'Plastic Waste Management Amendment Rules 2022, CPCB', true),

-- ── HEALTHCARE ───────────────────────────────────────────────────────────────

('Healthcare', 'Energy', 'Install presence-sensor lighting in non-critical areas',
 'Corridors, waiting rooms, and storage areas are often over-lit 24/7. Presence sensors cut lighting energy in these zones by 40–60%.',
 '2–6 tCO₂e/year', '₹50,000–₹2,00,000', 'Easy',
 'BEE PAT Scheme — Hospitals', true),

('Healthcare', 'Waste', 'Segregate biomedical waste at source per BMWM Rules',
 'Correct colour-coded bin segregation at the point of generation reduces bio-medical waste treatment emissions by 20–30% and avoids CPCB non-compliance.',
 '1–4 tCO₂e/year', '₹20,000–₹80,000', 'Easy',
 'Biomedical Waste Management Rules 2016, MoEFCC', true),

('Healthcare', 'Energy', 'Conduct HVAC recommissioning for hospital zones',
 'Recommissioning HVAC systems to match actual occupancy profiles (vs original design load) typically saves 15–25% HVAC energy in hospitals.',
 '5–20 tCO₂e/year', '₹1,00,000–₹5,00,000', 'Medium',
 'BEE Energy Conservation in Hospitals', true)

ON CONFLICT DO NOTHING;
