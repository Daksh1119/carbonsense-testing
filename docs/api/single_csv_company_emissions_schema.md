# Single CSV Company Emissions Schema

This is the single canonical CSV format for organization-level emissions ingestion and recommendation generation.

## Why one CSV works
A single file can include employee-level activity data across major sources seen in dashboard views:
- Transport
- Energy
- Waste
- Purchases

The backend computes emissions per row and aggregates totals by category/scope/employee, then passes the summarized context to the recommendation LLM.

## Required columns
- `record_id`: unique row id
- `organization_id`: organization UUID
- `employee_id`: employee UUID
- `employee_name`: display name
- `department`: employee department
- `date`: activity date (`YYYY-MM-DD`)
- `activity_type`: controlled activity token (see list below)
- `quantity`: numeric activity value
- `unit`: unit string matching activity type

## Optional columns
- `source_category`: label for your internal source category
- `spend_inr`: monetary value for spend-based records
- `vendor`: vendor name
- `location`: city/site/location
- `scope`: optional override (`Scope 1`, `Scope 2`, `Scope 3`)
- `notes`: free-text details

## Supported activity_type values
- `electricity_grid_kwh`
- `diesel_liter`
- `petrol_liter`
- `cng_kg`
- `flight_km_economy`
- `rail_km`
- `bus_km`
- `landfill_waste_kg`
- `recycled_waste_kg`
- `paper_kg`
- `hotel_night`
- `purchased_goods_inr`

## Formula used
Primary formula (GHG Protocol Corporate Standard):
- `Emissions (kgCO2e) = Activity Data x Emission Factor`

## Factor references
This implementation uses a versioned default factor catalog in code:
- `packages/ml_services/emissions/csv_engine.py`

Factor provenance is documented in code comments and `factor_source` output fields as indicative references to:
- GHG Protocol accounting method
- DEFRA conversion factor approach
- EPA/IPCC combustion factor approach
- India grid-intensity baseline approach for electricity

Important:
- Emission factors vary by year, geography, supplier mix, and methodology boundary.
- For production-grade reporting, replace defaults with your audited factor set per reporting year.

## API flow
1. Calculate only:
   - `POST /ingestion/company-csv/calculate` (multipart upload `file`)
2. Calculate + recommendations:
   - `POST /ingestion/company-csv/recommendations` with:
     - `file` (CSV)
     - `organization_id`
     - `user_id`
     - optional `project_name`, `location`, `time_horizon_years`

The second endpoint:
- computes total emissions and breakdowns,
- converts results into KPI snapshots,
- calls recommendations generation,
- stores recommendation session and recommendation rows in Supabase.

## Output summary fields
- `totals.total_kg_co2e`
- `breakdown.by_category_kg_co2e`
- `breakdown.by_scope_kg_co2e`
- `breakdown.top_employees_kg_co2e`
- `kpi_snapshots` (for recommendation context)

## Sample file
- `data/raw/sample_org_data/company_emissions_single.csv`
