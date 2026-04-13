# Recommendations LLM E2E Setup

## What was integrated
- Backend route: `POST /recommendations/generate`
- Backend route: `GET /recommendations/sessions/{session_id}?user_id=<uuid>`
- Backend route: `POST /recommendations/sessions/{session_id}/recommendations/{recommendation_id}/feedback`
- Frontend hook `useRecommendations` now calls backend and persists recommendations.

## Required environment variables

### Backend (`.env`)
- `SUPABASE_URL=<your-supabase-url>`
- `SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>`
- `LLM_API_KEY=<openai-or-openrouter-key>`
- `LLM_PROVIDER=openrouter`
- `LLM_API_BASE_URL=https://openrouter.ai/api/v1`
- `LLM_MODEL=meta-llama/llama-3.1-8b-instruct:free`
- `OCR_STRICT_AUTHZ=true`

Notes:
- You can switch to OpenAI by setting:
  - `LLM_PROVIDER=openai`
  - `LLM_API_BASE_URL=https://api.openai.com/v1`
  - `LLM_MODEL=gpt-4o-mini`

Recommended for higher quality and stronger grounding:
- Use a stronger primary model and at least 2 fallbacks:
   - `LLM_MODEL=openai/gpt-5-mini`
   - `LLM_MODEL_FALLBACKS=anthropic/claude-sonnet-4.5,google/gemini-2.5-pro`
- Enforce provider parameter compatibility and response healing:
   - `LLM_OPENROUTER_ENABLE_RESPONSE_HEALING=true`
- Prefer stricter privacy routing when required:
   - `LLM_OPENROUTER_DATA_COLLECTION=deny`
   - `LLM_OPENROUTER_ZDR=true`

Quality behavior now implemented in backend:
- Recommendation count is dynamic (not fixed to 4), based on emissions and evidence richness.
- Every recommendation must include at least 2 evidence items.
- Evidence must map to known context evidence IDs (KPI snapshots, TEME run, org profile, methodology refs).
- Ranking favors evidence quality, confidence, relevance to KPI focus areas, and feasibility.
- Offset actions are capped to at most one item.

### Frontend (`CarbonSense_FrontEnd/frontend/.env.local`)
- `NEXT_PUBLIC_API_URL=http://localhost:8000`
- `NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>`
- `NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID=11111111-1111-1111-1111-111111111111`
- `NEXT_PUBLIC_DEFAULT_USER_ID=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`

## Seed CSV files (exact schema)
- `data/raw/sample_org_data/organizations.csv`
- `data/raw/sample_org_data/organization_members.csv`
- `data/raw/sample_org_data/org_member_permissions.csv`

Import these into Supabase tables with the same names.

Important:
- `organization_members.user_id` and `org_member_permissions.user_id` are FKs to `auth.users(id)`.
- Replace sample UUIDs with real authenticated user UUIDs from your Supabase project before import.

## E2E test flow
1. Run backend:
   - `python -m uvicorn packages.ml_services.api.app:app --reload --host 0.0.0.0 --port 8000`
2. Run frontend from `CarbonSense_FrontEnd/frontend`:
   - `npm run dev`
3. Ensure at least one TEME run exists for the selected user in `teme_runs`.
4. Open `/recommendations` in dashboard.
5. Verify:
   - New row in `recommendation_sessions`
   - New rows in `recommendations`
   - New rows in `recommendation_evidence`

If no LLM key is configured, backend uses heuristic fallback and stores warning in `recommendation_sessions.error_message`.
