# infrastructure/supabase/migrations — ARCHIVED

## Status: **ORPHANED — Do not use**

This directory contains early-draft migrations that were superseded by
`supabase/migrations/` (the project root), which is the **authoritative**
migration timeline applied by `supabase db push`.

### Why this exists
These files were written during the initial feature branches before the
`supabase/` root directory was established as the canonical location.
They were never consolidated into the main timeline.

### What to do
- **Do NOT run these files manually.** Their content is either covered by
  the root migrations or has been superseded.
- **Do NOT add new migrations here.**
- All new migrations go in: `supabase/migrations/` (project root)

### Authoritative migration order (supabase/migrations/)
| File | Purpose |
|------|---------|
| `001_auth_schema.sql` | Base auth, user_profiles, organizations |
| `002_role_redesign_rls.sql` | Full RLS for all tables, role model |
| `20260318_recommendation_tables.sql` | Recommendation engine tables |
| `20260322_emissions_uploads.sql` | Emissions upload tables |
| `20260322_recommendation_audit_fields.sql` | Audit fields |
| `20260322_seed_tree_species.sql` | Tree species seed data |
| `20260409_backfill_upload_periods_from_entries.sql` | Backfill job |
| `20260409_emissions_upload_lookup_indexes.sql` | Lookup indexes |
| `20260410_cleanup_empty_upload_shells.sql` | Cleanup |
| `20260410_upload_delete_safety_policy.sql` | Delete safety |
| `20260414100000_policy_compliance_foundation.sql` | Policy compliance tables |
| `20260414100100_seed_policy_compliance_data.sql` | Policy compliance seed |
| `20260414_seed_policy_compliance_data.sql` | Policy compliance seed (v2) |
| `20260728_organizations_settings_fields.sql` | Org settings fields |
| `20260802_fix_teme_runs_insert_rls.sql` | **Security fix: teme_runs cross-tenant RLS** |
