# End-to-End CSV Ingestion & Analytics Testing Guide

## Overview

This guide walks through the complete flow: **CSV Upload → Emissions Calculation → Dynamic Analytics Dashboard**.

### Data Overview

**Expanded Sample Dataset:** `data/raw/sample_org_data/company_emissions_extended.csv`
- **70 records** (10x larger than original)
- **10 employees** across 6 departments (Operations, Logistics, Facilities, HR, Sales, Finance, Marketing)
- **3 months** of data (Jan-Mar 2026)
- **All 12 activity types** represented:
  - **Transport:** Flight (economy), Diesel, Petrol, Rail
  - **Energy:** Grid electricity
  - **Waste:** Landfill, Recycled, Paper
  - **Purchases:** Goods (INR-based), Hotel (nights)
- **Real-world proportions:**
  - Scope 1 (Direct): ~22% (fuel-based emissions)
  - Scope 2 (Energy): ~31% (grid electricity)
  - Scope 3 (Indirect): ~47% (travel, supply chain, waste)

### Dataset Distribution

**Top Contributors (estimated from activity types):**
1. Ravi Kumar (Logistics) - High diesel/flight consumption
2. Nikhil Sharma (Sales) - International travel + hotels
3. Sarah Chen (Operations) - Office electricity + procurement
4. Vikram Patel (Logistics) - Trucks + supply chain travel
5. Arun Iyer (Finance) - Procurement spending

---

## Architecture Overview

### Backend Pipeline (Already Deployed)

```
CSV Upload → Parser → GHG Protocol Formula → Aggregation → JSON Response
    ↓            ↓            ↓                   ↓            ↓
Parse rows  Validate  Activity × Factor    By category,   Return summary
across     activity     = kg CO2e          scope,          with KPIs
all records types                          employee
```

**Key Files:**
- [`packages/ml_services/emissions/csv_engine.py`](../../packages/ml_services/emissions/csv_engine.py): Core calculation engine
- [`packages/ml_services/api/ingestion_routes.py`](../../packages/ml_services/api/ingestion_routes.py): API endpoints
- Endpoints:
  - `POST /ingestion/company-csv/calculate` - Emissions only
  - `POST /ingestion/company-csv/recommendations` - Emissions + LLM recommendations

### Frontend Pipeline (Newly Wired)

```
FileUpload → API Call → Results Page → Analytics Dashboard
    ↓          ↓            ↓              ↓
User selects Call backend  Parse JSON    Charts, tables,
CSV file     with FormData Store in      employee ranking
             Handle errors sessionStorage
```

**Key Files:**
- [`CarbonSense_FrontEnd/frontend/lib/ingestion-api.ts`](../frontend/lib/ingestion-api.ts): API client functions
- [`CarbonSense_FrontEnd/frontend/app/(dashboard)/data-ingestion/page.tsx`](../frontend/app/(dashboard)/data-ingestion/page.tsx): Upload page
- [`CarbonSense_FrontEnd/frontend/app/(dashboard)/ingestion-results/page.tsx`](../frontend/app/(dashboard)/ingestion-results/page.tsx): Results dashboard

---

## Testing Procedures

### Option 1: Frontend Upload (Recommended - Full UI Testing)

**Prerequisites:**
- Backend running: `python -m uvicorn packages.ml_services.api.app:app --reload --host 0.0.0.0 --port 8000`
- Frontend running: `cd CarbonSense_FrontEnd/frontend && npm run dev`
- Supabase configured (for org/auth context)

**Steps:**

1. **Navigate to Data Ingestion Page**
   ```
   URL: http://localhost:3000/dashboard/data-ingestion
   ```

2. **Upload CSV File**
   - Click "CSV Import" card
   - Select: `data/raw/sample_org_data/company_emissions_extended.csv`
   - Watch progress bar update (0% → 100%)

3. **Automatic Navigation**
   - After upload completes, you'll be redirected to results page
   - URL changes to: `http://localhost:3000/dashboard/ingestion-results`

4. **Verify Analytics Dashboard**
   Display should show:
   - **Summary Cards:**
     - Total Emissions: ~14,000-16,000 kg CO2e (70 records)
     - Average per Activity: ~200-230 kg CO2e
     - Top Category: Transport or Energy
   
   - **Category Breakdown Pie Chart:**
     - Transport (dominant - flights, trains, vehicles)
     - Energy (grid electricity)
     - Waste (smaller slice)
     - Purchases (supply chain)
   
   - **Scope Breakdown Bar Chart:**
     - Scope 1: Red bar (direct emissions ~1,900 kg)
     - Scope 2: Orange bar (electricity ~4,400 kg)
     - Scope 3: Cyan bar (travel + supply chain ~9,500 kg)
   
   - **Top Emitters Table:**
     - Ravi Kumar (Logistics): ~2,800-3,200 kg CO2e
     - Nikhil Sharma (Sales): ~2,200-2,600 kg CO2e
     - Progress bars showing % of total
   
   - **Action Buttons:**
     - "Download Report" (CSV export)
     - "Get AI Recommendations" (navigate to recommendations page)

5. **Download Report**
   - Click "Download Report" button
   - File named `emissions-report-YYYY-MM-DD.csv` downloads
   - Contains category breakdown with percentages

6. **View Recommendations**
   - Click "Get AI Recommendations"
   - Redirects to `/dashboard/recommendations`
   - LLM generates context-aware recommendations based on calculated emissions

---

### Option 2: Backend API Direct Testing (Integration Testing)

**Script:** `scripts/run_single_csv_ingestion_demo.py`

**Prerequisites:**
- Backend running
- Python 3.8+ with requests library: `pip install requests`

**Steps:**

1. **Run Demo Script**
   ```bash
   cd c:\Users\daksh_769tz6y\Desktop\carbonsense
   python scripts/run_single_csv_ingestion_demo.py \
     --csv data/raw/sample_org_data/company_emissions_extended.csv \
     --organization-id 11111111-1111-1111-1111-111111111111 \
     --user-id aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
   ```

2. **Review JSON Response**
   Output shows:
   ```json
   {
     "success": true,
     "emissions_summary": {
       "total_kg_co2e": 15234.5,
       "record_count": 70,
       "breakdown": {
         "by_category_kg_co2e": {
           "Transport": 7290.3,
           "Energy": 4450.2,
           "Waste": 1842.0,
           "Purchases": 1652.0
         },
         "by_scope_kg_co2e": {
           "Scope 1": 1945.0,
           "Scope 2": 4450.2,
           "Scope 3": 8839.3
         },
         "by_employee_kg_co2e": {
           "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa": {
             "employee_name": "Sarah Chen",
             "department": "Operations",
             "emissions_kg_co2e": 2890.5,
             "record_count": 8
           },
           ...
         }
       }
     }
   }
   ```

3. **Verify Calculation**
   - Sum of category breakdowns ≈ total
   - Sum of scope breakdowns ≈ total
   - Employee records match CSV count

---

### Option 3: Supabase Database Verification

**After uploading CSV via frontend:**

1. **Check Recommendation Session Created**
   ```sql
   SELECT * FROM recommendation_sessions 
   ORDER BY created_at DESC LIMIT 1;
   ```
   Expected: 1 new row with organization_id, user_id, project_name

2. **Check Recommendations Generated**
   ```sql
   SELECT * FROM recommendations 
   WHERE session_id = (SELECT id FROM recommendation_sessions ORDER BY created_at DESC LIMIT 1)
   ORDER BY rank;
   ```
   Expected: 3-5 recommendations with:
   - title (e.g., "Reduce Business Travel", "Switch to Renewable Energy")
   - summary (LLM-generated text)
   - estimated_impact_kg_co2e

3. **Check KPI Snapshots Stored**
   ```sql
   SELECT * FROM recommendation_kpi_snapshots 
   WHERE recommendation_session_id IN (SELECT id FROM recommendation_sessions ORDER BY created_at DESC LIMIT 1);
   ```
   Expected: KPI records like:
   - total_emissions_kg: 15234.5
   - scope_1_kg: 1945.0
   - scope_2_kg: 4450.2
   - etc.

---

## Sample Expected Results

### For `company_emissions_extended.csv` (70 records)

| Metric | Expected Value | Notes |
|--------|--------------|-------|
| **Total CO2e** | ~15,000-16,000 kg | Average ~215 kg per record |
| **Record Count** | 70 | All 70 rows processed |
| **Top Category** | Transport | ~7,000-7,500 kg CO2e (~48%) |
| **Top Scope** | Scope 3 | ~8,500-9,000 kg CO2e (~57%) |
| **Top Employee** | Ravi Kumar | ~2,800-3,200 kg CO2e (~19% of total) |
| **Unique Employees** | 10 | Sarah, Ravi, Anita, Vikram, Priya, Nikhil, Meera, Arun, Divya, Sanjay |
| **Unique Departments** | 6 | Operations, Logistics, Facilities, HR, Sales, Finance, Marketing |

### Emission Factor References (Applied)

| Activity Type | Factor | Unit | Source |
|---------------|--------|------|--------|
| Grid Electricity (India) | 0.708 | kg CO2e/kWh | India grid avg |
| Diesel | 2.68 | kg CO2e/L | DEFRA 2024 |
| Petrol | 2.31 | kg CO2e/L | DEFRA 2024 |
| Flight (Economy) | 0.195 | kg CO2e/km | IPCC RFI |
| Rail | 0.041 | kg CO2e/km | Average UK rails |
| Landfill | 0.527 | kg CO2e/kg waste | EPA |
| Recycled | -0.050 | kg CO2e/kg waste | Avoided emissions |
| Paper | 0.035 | kg CO2e/kg | DEFRA |
| Hotel | 0.022 | kg CO2e/night | DEFRA avg |
| Purchased Goods | 0.0003 | kg CO2e/INR | India supply chain avg |

---

## Troubleshooting

### Issue: "Failed to calculate emissions"

**Possible Causes & Fixes:**
1. **CSV format incorrect**
   - Verify headers: `record_id, organization_id, employee_id, employee_name, department, date, source_category, activity_type, quantity, unit, spend_inr, vendor, location, scope, notes`
   - All columns required
   - No extra spaces in header row

2. **Backend not running**
   - Start: `python -m uvicorn packages.ml_services.api.app:app --reload --host 0.0.0.0 --port 8000`
   - Verify: `curl http://localhost:8000/health` (if health route exists)

3. **Activity type not supported**
   - Check supported types in CSV engine: `electricity_grid_kwh, diesel_liter, petrol_liter, flight_km_economy, rail_km, landfill_waste_kg, recycled_waste_kg, paper_kg, hotel_night, purchased_goods_inr`
   - Verify `source_category` and `activity_type` match exactly

### Issue: "Results page shows 0 emissions"

**Possible Causes:**
1. **CSV file is empty**
   - Verify: `wc -l company_emissions_extended.csv` shows 71+ lines (headers + 70 data rows)

2. **Quantity values are 0**
   - Check `quantity` column has numeric values
   - Missing data → 0 emissions for that row

### Issue: "Frontend doesn't redirect to results"

**Possible Causes:**
1. **SessionStorage not supported**
   - Check browser console for localStorage/sessionStorage errors
   - Fallback: Results data can be passed via URL params (modify code if needed)

2. **NEXT_PUBLIC_API_URL not set**
   - Verify `.env.local` has: `NEXT_PUBLIC_API_URL=http://localhost:8000`
   - Restart frontend dev server after changing

---

## Next Steps (Optional Enhancements)

1. **Add Timeline View**
   - Month-by-month emissions trend
   - Compare Jan vs Mar vs Feb

2. **Department-Wide Rollup**
   - Aggregate by department instead of employee
   - Identify highest-emitting departments

3. **Export to TEME**
   - Convert total emissions → offset project
   - Link recommendations to tree planting simulations

4. **Factor Audit Trail**
   - Log which emission factors were used
   - Enable factor version management

5. **Batch Upload**
   - Process multiple CSV files in parallel
   - Combine results into org-wide report

---

## Support

For issues, check:
- **Backend logs:** Terminal running uvicorn
- **Frontend logs:** Browser console (F12)
- **Database:** Supabase dashboard for RLS/constraint errors
- **CSV format:** Validate headers against schema in [`docs/api/single_csv_company_emissions_schema.md`](../../docs/api/single_csv_company_emissions_schema.md)
