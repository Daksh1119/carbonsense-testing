-- Seed policy catalogue and baseline compliance requirements.

with policy_seed (
    name,
    short_name,
    category,
    layer,
    description,
    authority,
    applicability,
    requirements,
    benefits,
    is_active,
    effective_date,
    review_date,
    external_url
) as (
    values
    ('Carbon Credit Trading Scheme (CCTS)', 'CCTS', 'carbon_market', 'core', 'India''s carbon credit mechanism for emissions-intensity compliance and trading.', 'MoEFCC / BEE', array['large_enterprise','manufacturing'], array['Track carbon intensity','Meet assigned targets or procure credits'], array['Market-driven decarbonization','Potential credit monetization'], true, null, null, null),
    ('National Action Plan on Climate Change (NAPCC)', 'NAPCC', 'climate', 'background', 'National climate mission umbrella guiding sectoral transition pathways.', 'PMO / MoEFCC', array['sme','large_enterprise'], array['Align climate strategy with national missions'], array['Strategic alignment','Access to mission-linked schemes'], true, null, null, null),
    ('PAT Scheme (Perform, Achieve, Trade)', 'PAT', 'energy', 'core', 'Energy efficiency target framework for designated sectors.', 'Bureau of Energy Efficiency', array['manufacturing'], array['Measure energy intensity','Implement reduction actions','Submit performance reports'], array['Lower energy cost','Compliance readiness'], true, null, null, null),
    ('Energy Conservation Act (2001, amended 2022)', 'ECA', 'energy', 'core', 'Legal backbone for energy conservation and efficiency obligations.', 'BEE', array['sme','large_enterprise'], array['Track and reduce energy usage'], array['Reduced utility spend','Regulatory compliance'], true, null, null, null),
    ('UJALA / LED Programme', 'UJALA', 'energy', 'optional', 'Efficiency program promoting LED adoption and lower electricity demand.', 'EESL', array['sme','large_enterprise'], array['Adopt high-efficiency lighting'], array['Fast payback electricity savings'], true, null, null, null),
    ('Solar Subsidy — Rooftop', 'MNRE Rooftop', 'renewable', 'core', 'Rooftop solar support for distributed clean power adoption.', 'MNRE', array['sme','large_enterprise'], array['Assess rooftop feasibility','Apply and commission'], array['Capex support','Lower electricity bills'], true, null, null, null),
    ('Renewable Purchase Obligation (RPO)', 'RPO', 'renewable', 'secondary', 'Obligation to source a share of electricity from renewables.', 'MNRE / SERCs', array['large_enterprise'], array['Track renewable share and compliance'], array['Avoid penalties','Transition support'], true, null, null, null),
    ('Renewable Energy Certificates (REC)', 'REC', 'renewable', 'advanced', 'Tradable certificates for renewable energy compliance support.', 'CERC', array['large_enterprise'], array['Track REC requirements and transactions'], array['Flexible compliance route'], true, null, null, null),
    ('BRSR (Business Responsibility and Sustainability Reporting)', 'BRSR', 'esg', 'core', 'SEBI sustainability reporting framework for listed entities.', 'SEBI', array['listed_company','large_enterprise'], array['Collect ESG metrics','Publish sustainability disclosures'], array['Investor confidence','Regulatory readiness'], true, null, null, null),
    ('ESG Framework (GRI / GHG Protocol)', 'ESG Framework', 'esg', 'core', 'Global ESG and emissions reporting alignment framework.', 'GRI / WRI / WBCSD', array['sme','large_enterprise'], array['Maintain traceable ESG and emissions records'], array['Framework interoperability','Audit readiness'], true, null, null, null),
    ('Environmental Protection Act (EPA) 1986', 'EPA 1986', 'environmental', 'core', 'Principal environmental law governing pollution controls in India.', 'MoEFCC', array['sme','large_enterprise'], array['Maintain environmental safeguards and records'], array['Legal compliance','Risk reduction'], true, null, null, null),
    ('Air (Prevention and Control of Pollution) Act', 'Air Act', 'environmental', 'core', 'Air emissions control standards and consent obligations.', 'CPCB / SPCBs', array['manufacturing'], array['Track emissions and meet prescribed norms'], array['Permit continuity','Reduced enforcement risk'], true, null, null, null),
    ('Water (Prevention and Control of Pollution) Act', 'Water Act', 'environmental', 'secondary', 'Wastewater and discharge compliance framework.', 'CPCB / SPCBs', array['manufacturing'], array['Track treatment and discharge records'], array['Operational continuity'], true, null, null, null),
    ('Hazardous Waste Management Rules 2016', 'Hazardous Waste Rules', 'waste', 'core', 'Handling, storage and disposal controls for hazardous waste.', 'MoEFCC', array['manufacturing'], array['Segregate and dispose through authorized channels'], array['Safety and legal compliance'], true, null, null, null),
    ('Solid Waste Management Rules 2016', 'SWM Rules', 'waste', 'core', 'Municipal and enterprise-level waste segregation and handling rules.', 'MoEFCC', array['sme','large_enterprise'], array['Track quantities and segregation'], array['Cleaner operations'], true, null, null, null),
    ('Plastic Waste Management Rules 2022', 'PWM Rules', 'waste', 'core', 'Plastic usage and disposal obligations including EPR pathways.', 'MoEFCC', array['restaurant','retail','manufacturing'], array['Track and reduce single-use plastic'], array['Lower waste risk','Brand value'], true, null, null, null),
    ('E-Waste Management Rules 2022', 'E-Waste Rules', 'waste', 'optional', 'Rules for responsible e-waste handling and channelization.', 'MoEFCC', array['it_sector','electronics'], array['Dispose via authorized recycler'], array['Lower compliance risk'], true, null, null, null),
    ('FAME Scheme (EV Policy)', 'FAME', 'transport', 'core', 'Incentive framework for EV adoption in transport and fleets.', 'Ministry of Heavy Industries', array['logistics','transport'], array['Evaluate EV transition and claim incentives'], array['Fuel savings','Subsidy support'], true, null, null, null),
    ('Bharat Stage Emission Norms (BS-VI)', 'BS-VI', 'transport', 'secondary', 'Vehicle emissions standards for combustion fleets.', 'MoRTH', array['logistics','transport'], array['Maintain compliant fleet profile'], array['Lower penalties'], true, null, null, null),
    ('ZED Certification', 'ZED', 'msme', 'core', 'Zero Defect Zero Effect certification for MSME sustainability performance.', 'Quality Council of India', array['manufacturing','sme'], array['Document sustainability process controls'], array['Procurement and reputation benefits'], true, null, null, null),
    ('MSME Sustainable Finance Schemes', 'MSME Sustainable Finance', 'msme', 'core', 'Financing support for sustainability and efficiency upgrades.', 'SIDBI / Ministry of MSME', array['sme'], array['Track eligible projects and documentation'], array['Access to concessional capital'], true, null, null, null),
    ('Credit Linked Capital Subsidy Scheme (CLCSS)', 'CLCSS', 'msme', 'core', 'Capital subsidy support for technology upgradation in MSMEs.', 'Ministry of MSME', array['manufacturing','sme'], array['Demonstrate qualifying upgrade plan'], array['Capital subsidy'], true, null, null, null),
    ('National Green Hydrogen Mission', 'Green Hydrogen Mission', 'energy', 'future', 'Strategic mission promoting green hydrogen ecosystem development.', 'MNRE', array['manufacturing','large_enterprise'], array['Evaluate use-cases and readiness roadmap'], array['Future competitiveness'], true, null, null, null),
    ('Extended Producer Responsibility (EPR)', 'EPR', 'waste', 'core', 'Producer responsibility for post-consumer waste take-back and processing.', 'MoEFCC', array['manufacturing','retail','electronics'], array['Register and track EPR obligations'], array['Compliance continuity'], true, null, null, null),
    ('MSME Green Rating Scheme', 'MSME Green Rating', 'msme', 'core', 'Green rating to improve market access and financing prospects.', 'BIS / Ministry of MSME', array['sme'], array['Maintain evidence-backed sustainability metrics'], array['Market differentiation'], true, null, null, null),
    ('ISO 14001 Alignment', 'ISO 14001', 'environmental', 'secondary', 'Environmental management system alignment for process control.', 'ISO / BIS', array['export_oriented_sme','manufacturing'], array['Implement EMS and maintain records'], array['Export and procurement eligibility'], true, null, null, null),
    ('GHG Protocol Alignment', 'GHG Protocol', 'reporting', 'core', 'Corporate GHG accounting methodology alignment.', 'WRI / WBCSD', array['sme','large_enterprise'], array['Classify Scope 1/2/3 consistently'], array['Credible emissions accounting'], true, null, null, null),
    ('Carbon Border Adjustment Mechanism (CBAM)', 'CBAM', 'trade', 'future', 'EU carbon border mechanism affecting carbon-intensive imports.', 'European Union', array['eu_exporting_sme','manufacturing'], array['Maintain product-level carbon evidence'], array['Trade risk mitigation'], true, null, null, null),
    ('BRSR Core', 'BRSR Core', 'esg', 'secondary', 'Assurance-oriented sustainability reporting for top listed entities.', 'SEBI', array['listed_company'], array['Prepare assured ESG disclosures'], array['Regulatory preparedness'], true, null, null, null),
    ('Pollution Control Board Consent to Operate', 'PCB CTO', 'environmental', 'core', 'State board consent lifecycle tracking for industrial operations.', 'State Pollution Control Boards', array['manufacturing'], array['Maintain valid CTE/CTO and renewals'], array['Operational legality'], true, null, null, null)
)
insert into public.policies (
    name,
    short_name,
    category,
    layer,
    description,
    authority,
    applicability,
    requirements,
    benefits,
    is_active,
    effective_date,
    review_date,
    external_url
)
select
    p.name,
    p.short_name,
    p.category,
    p.layer,
    p.description,
    p.authority,
    p.applicability,
    p.requirements,
    p.benefits,
    p.is_active,
    p.effective_date::date,
    p.review_date::date,
    p.external_url
from policy_seed p
where not exists (
    select 1 from public.policies x where lower(x.name) = lower(p.name)
);

with requirement_seed (
    policy_name,
    name,
    type,
    level,
    industry,
    verification_method,
    description,
    is_mandatory,
    weight,
    estimated_rupee_impact,
    estimated_co2_kg_impact
) as (
    values
    ('Energy Conservation Act (2001, amended 2022)', 'Electricity consumption tracked monthly', 'data', 'basic', array['sme','large_enterprise'], 'data_change', 'Track and persist monthly electricity consumption (kWh) with month-over-month baseline comparison.', true, 3, 25000, 1200),
    ('Energy Conservation Act (2001, amended 2022)', 'Fuel consumption tracked monthly', 'data', 'basic', array['sme','large_enterprise'], 'data_change', 'Track diesel/petrol/LPG consumption in standardized units with trend baseline.', true, 3, 15000, 900),
    ('GHG Protocol Alignment', 'Scope 1/2/3 classification completed', 'data', 'basic', array['sme','large_enterprise'], 'data_change', 'Ensure emissions entries are correctly mapped to Scope 1, 2, and 3 pathways.', true, 3, 5000, 0),
    ('Solid Waste Management Rules 2016', 'Waste quantity tracked by stream', 'data', 'basic', array['sme','large_enterprise'], 'data_change', 'Capture total waste in kg by stream every period.', true, 2, 8000, 350),
    ('Solid Waste Management Rules 2016', 'Waste segregation evidence maintained', 'action', 'basic', array['sme','large_enterprise'], 'evidence_upload', 'Upload segregation evidence (records/photos/vendor slips).', true, 2, 5000, 180),
    ('Hazardous Waste Management Rules 2016', 'Hazardous waste disposal through authorized vendor', 'action', 'industry_specific', array['manufacturing'], 'evidence_upload', 'Upload disposal invoices/certificates and verify vendor authorization details.', true, 3, 12000, 250),
    ('Air (Prevention and Control of Pollution) Act', 'Air emissions monitoring record maintained', 'reporting', 'industry_specific', array['manufacturing'], 'evidence_upload', 'Maintain and submit air-emissions monitoring records as required.', true, 2, 6000, 0),
    ('Water (Prevention and Control of Pollution) Act', 'Wastewater treatment record maintained', 'reporting', 'industry_specific', array['manufacturing'], 'evidence_upload', 'Maintain and submit wastewater treatment and discharge records.', false, 1, 4000, 0),
    ('Plastic Waste Management Rules 2022', 'Single-use plastic reduction tracked', 'data', 'industry_specific', array['restaurant','retail'], 'data_change', 'Track monthly plastic consumption and reduction progress.', true, 2, 7000, 120),
    ('FAME Scheme (EV Policy)', 'Fleet EV adoption plan documented', 'action', 'industry_specific', array['logistics','transport'], 'evidence_upload', 'Document EV transition roadmap and eligible vehicles.', false, 2, 30000, 2000),
    ('BRSR (Business Responsibility and Sustainability Reporting)', 'ESG dataset assembled for disclosure', 'reporting', 'basic', array['listed_company','large_enterprise','sme'], 'manual', 'Prepare ESG disclosure dataset for annual reporting cycle.', true, 2, 10000, 0),
    ('BRSR Core', 'Assured ESG reporting package submitted', 'reporting', 'industry_specific', array['listed_company'], 'evidence_upload', 'Submit assured BRSR Core package with verifier evidence.', true, 2, 12000, 0),
    ('PAT Scheme (Perform, Achieve, Trade)', 'Energy intensity improvement action completed', 'action', 'action_based', array['manufacturing'], 'data_change', 'Complete and verify at least one energy-intensity reduction action.', false, 3, 45000, 3000),
    ('Solar Subsidy — Rooftop', 'Rooftop solar subsidy application prepared', 'action', 'action_based', array['sme','large_enterprise'], 'evidence_upload', 'Upload subsidy application package and supporting documents.', false, 2, 80000, 4500),
    ('Credit Linked Capital Subsidy Scheme (CLCSS)', 'CLCSS documentation completed', 'action', 'action_based', array['manufacturing','sme'], 'evidence_upload', 'Prepare and upload required documents for CLCSS filing.', false, 2, 60000, 2200),
    ('MSME Green Rating Scheme', 'Green rating application submitted', 'reporting', 'action_based', array['sme'], 'evidence_upload', 'Submit rating application and capture submission timestamp.', false, 2, 20000, 0),
    ('Extended Producer Responsibility (EPR)', 'EPR registration and compliance record maintained', 'reporting', 'industry_specific', array['manufacturing','retail','electronics'], 'evidence_upload', 'Track EPR registration and periodic compliance filings.', true, 2, 15000, 0),
    ('Pollution Control Board Consent to Operate', 'CTO/CTE validity tracked', 'reporting', 'industry_specific', array['manufacturing'], 'evidence_upload', 'Maintain valid consent certificates and renewal schedule.', true, 3, 10000, 0)
)
insert into public.compliance_requirements (
    policy_id,
    name,
    type,
    level,
    industry,
    verification_method,
    description,
    is_mandatory,
    weight,
    estimated_rupee_impact,
    estimated_co2_kg_impact
)
select
    p.id,
    r.name,
    r.type,
    r.level,
    r.industry,
    r.verification_method,
    r.description,
    r.is_mandatory,
    r.weight,
    r.estimated_rupee_impact,
    r.estimated_co2_kg_impact
from requirement_seed r
join public.policies p
    on lower(p.name) = lower(r.policy_name)
where not exists (
    select 1
    from public.compliance_requirements x
    where x.policy_id = p.id
      and lower(x.name) = lower(r.name)
);

-- Build default RAG chunks from policy rows (initial pass).
insert into public.policy_chunks (policy_id, chunk_text, chunk_order, source)
select
    p.id,
    trim(
        concat_ws(
            E'\n',
            p.name,
            'Authority: ' || coalesce(p.authority, ''),
            'Category: ' || p.category,
            'Layer: ' || p.layer,
            'Description: ' || p.description,
            'Requirements: ' || array_to_string(p.requirements, '; '),
            'Benefits: ' || array_to_string(p.benefits, '; ')
        )
    ) as chunk_text,
    0,
    'policy_seed'
from public.policies p
where not exists (
    select 1 from public.policy_chunks c where c.policy_id = p.id and c.chunk_order = 0
);
