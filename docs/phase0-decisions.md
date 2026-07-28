# CarbonSense — Phase 0: Decision Lock

Generated: 2026-07-28  
Scope: Manager Dashboard, Viewer Dashboard, Team Management, Settings

---

## Screen Classification Table

| Screen / Surface | Classification | One-line Reason |
|---|---|---|
| Manager Dashboard (`/(dashboard)/dashboard`) | FIX | Layout guard blocks managers; data hook already live-wired — fix the guard, not the data |
| Viewer Dashboard (`/viewer/dashboard`) | FIX | All KPI cards show `—`; fetches needed for emissions + compliance score |
| Team Management list (`/(dashboard)/team-management`) | FIX | Uses `mockTeamMembers` hardcoded array; RLS-safe Supabase query is available |
| Add Member (`/team-management/add-member`) | FIX | Form submits toast only; must insert to `employee_signup_requests` |
| Bulk Import (`/team-management/bulk-import`) | FIX | Simulates progress with `setTimeout`; needs real CSV parse + batch insert + per-row error surfacing |
| Edit Permissions (`/team-management/edit-permissions/[id]`) | FIX | Hardcoded member data; must fetch by id from `user_profiles` and persist role update |
| Settings — Profile tab | FIX | Hardcoded `defaultValue="Sarah"`; must read/write `user_profiles` |
| Settings — Organization tab | FIX | Hardcoded `defaultValue="Acme Manufacturing Ltd."`; must read/write `organizations` |
| Settings — SME Settings tab | DEFER | No schema columns for this data; label as Coming Soon, disable interaction |
| Settings — Notifications tab | DEFER | No notification preferences schema; label as Coming Soon, disable interaction |
| Settings — Security tab | DEFER | Password change and 2FA out of scope this phase; label as Coming Soon |
| Settings — Integrations tab | DEFER | No integration config schema; label as Coming Soon |
| Settings — Data Management tab | DEFER | No data lifecycle schema; label as Coming Soon |
| `/phase3-demo`, `/phase4-demo`, `/phase5-demo` | HIDE | Demo scaffolding routes not suitable for evaluation build; delete from router |
| `/test` | HIDE | Internal test route; delete from router |

---

## Task 0.3 — Settings Tab Classification (Explicit Output)

Per plan requirements, the explicit classification is:

- `Profile` → **FIX**
- `Organization` → **FIX**
- `SME Settings` → **DEFER** — disabled tab, "Coming Soon" label, pointer-events-none
- `Notifications` → **DEFER** — disabled tab, "Coming Soon" label
- `Security` → **DEFER** — disabled tab, "Coming Soon" label
- `Integrations` → **DEFER** — disabled tab, "Coming Soon" label
- `Data Management` → **DEFER** — disabled tab, "Coming Soon" label

---

## API Contracts

### Existing endpoints/queries (REUSE — do not re-implement)

| Endpoint / Query | Method | Expected Shape | Status |
|---|---|---|---|
| `fetchEmissionsUploadsScoped({ organizationId })` | Supabase/GET | `EmissionsUploadRecord[]` | EXISTS — `lib/emissions-api.ts` |
| `fetchComplianceScore()` | GET `/compliance/score` | `{ score: ComplianceScoreRecord }` | EXISTS — `lib/policy-compliance-api.ts` |
| `fetchComplianceDeadlines(days)` | GET `/compliance/deadlines` | `{ deadlines: ComplianceDeadlineRecord[] }` | EXISTS — `lib/policy-compliance-api.ts` |
| `fetchTopActions(topN)` | GET `/compliance/top-actions` | `{ actions: TopActionRecord[] }` | EXISTS — `lib/policy-compliance-api.ts` |
| `useDashboardData()` | Hook (aggregates above) | `DashboardData` | EXISTS — `hooks/useDashboardData.ts` |
| `supabase.from('user_profiles').select('*').eq('organization_id', orgId)` | Supabase Direct | `UserProfile[]` | EXISTS — RLS-safe for manager role per `002_role_redesign_rls.sql` |
| `supabase.from('employee_signup_requests').insert(...)` | Supabase Direct | Insert row | EXISTS — approval backend in place |
| `supabase.from('user_profiles').update({ role }).eq('id', memberId)` | Supabase Direct | Update row | EXISTS — manager can update viewer profiles in org |
| `supabase.from('user_profiles').select('*').eq('id', userId).single()` | Supabase Direct | `UserProfile` | EXISTS — RLS allows own-profile read |
| `supabase.from('user_profiles').update({...}).eq('id', userId)` | Supabase Direct | Update own profile | EXISTS — RLS policy `user_profiles_update_own` |
| `supabase.from('organizations').select('*').eq('id', orgId).single()` | Supabase Direct | Organization row | EXISTS — RLS allows manager to read own org |
| `supabase.from('organizations').update({...}).eq('id', orgId)` | Supabase Direct | Update org | EXISTS — RLS allows manager to update own org |

### New queries needed

| Query | Used For | Status |
|---|---|---|
| `supabase.from('user_profiles').select('*').eq('organization_id', orgId)` (with count aggregation) | Manager team status widget (headcount, active, pending) | NEW — query exists in RLS but no frontend hook yet → create `hooks/useTeamMembers.ts` |

---

## Exit Criteria

✅ All screens classified (no unclassified items)  
✅ API contracts enumerated with existing/new status  
✅ Settings tabs explicitly classified per Task 0.3  
✅ No code changes made in Phase 0  
