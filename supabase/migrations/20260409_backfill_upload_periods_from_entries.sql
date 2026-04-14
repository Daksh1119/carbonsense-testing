-- Backfill upload period and totals using persisted emission entries.
-- Helps historical uploads appear correctly in month-filtered Detailed Log pages.

with upload_rollups as (
  select
    ee.upload_id,
    date_trunc('month', max(ee.entry_date))::date as period_start,
    (date_trunc('month', max(ee.entry_date)) + interval '1 month - 1 day')::date as period_end,
    count(*)::integer as record_count,
    coalesce(sum(ee.co2_kg), 0)::numeric as total_emissions_kg,
    round(coalesce(sum(ee.co2_kg), 0)::numeric / 1000.0, 4) as total_emissions_tco2e
  from public.emission_entries ee
  group by ee.upload_id
)
update public.organization_uploads ou
set
  period_start = ur.period_start,
  period_end = ur.period_end,
  record_count = ur.record_count,
  total_emissions_kg = ur.total_emissions_kg,
  total_emissions_tco2e = ur.total_emissions_tco2e,
  row_count = ur.record_count,
  upload_status = case when ou.upload_status is null then 'processed' else ou.upload_status end,
  parse_status = case when ou.parse_status is null then 'parsed' else ou.parse_status end
from upload_rollups ur
where ou.id = ur.upload_id
  and (
    ou.period_start is distinct from ur.period_start
    or ou.period_end is distinct from ur.period_end
    or ou.record_count is distinct from ur.record_count
    or ou.total_emissions_kg is distinct from ur.total_emissions_kg
    or ou.total_emissions_tco2e is distinct from ur.total_emissions_tco2e
    or ou.row_count is distinct from ur.record_count
    or ou.upload_status is null
    or ou.parse_status is null
  );
