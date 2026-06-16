# Stage 4 Staging Runbook

This project must not be connected to production services during Stage 4.

## Required staging environment

Use a separate Supabase project for staging and set only staging credentials:

- `APP_ENV=staging`
- `NEXT_PUBLIC_APP_ENV=staging`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` only for server-side test setup or controlled admin jobs
- `AGENT_PROVIDER=openai` only when real OpenAI evaluation is intended
- `OPENAI_API_KEY` server-side only
- `OPENAI_MODEL`
- `PILOT_ADMIN_TOKEN` server-side only for service routes

Keep these disabled in Stage 4:

- `WHATSAPP_PROVIDER=mock`
- `WHATSAPP_SENDING_ENABLED=false`
- `GOLDENFLOW_CRM_INTEGRATION_ENABLED=false`
- `pilot_enabled=false`
- `whatsapp_receiving_enabled=false`
- `whatsapp_sending_enabled=false`
- `crm_sync_enabled=false`
- `automation_level=draft_only`

## Migration order

Apply migrations to a staging Supabase project only:

1. `supabase/schema.sql`
2. `supabase/002_phase2_agent_intelligence.sql`
3. `supabase/003_phase3_whatsapp_pilot.sql`
4. `supabase/004_phase4_staging_auth.sql`

Do not run `db reset` against a remote project. If a migration fails on staging, stop, document the failed migration, and add a new corrective migration.

## Local verification commands

Run these before deploying to staging:

```bash
npm run typecheck
npm run lint
npm run agent:evaluate
npm run pilot:evaluate
npm run stage4:audit
npm run build
```

Run real OpenAI evaluation only with server-side credentials and network access:

```bash
npm run agent:evaluate:openai
```

If `OPENAI_API_KEY` is missing, the command reports `blocked_missing_credentials`.

## Staging checks still requiring credentials

These checks are blocked until Supabase staging credentials are supplied:

- Supabase Auth registration, login, logout, session persistence, and session refresh
- Applying migrations to remote staging
- Schema verification against remote staging
- RLS tests with User A/User B and Business A/Business B
- Browser E2E against staging

These checks are blocked until `OPENAI_API_KEY` and network access are supplied:

- Real OpenAI Responses API call
- Real OpenAI evaluation threshold
- Chat Simulator against real OpenAI provider

## Safety notes

Do not expose `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or `PILOT_ADMIN_TOKEN` in client components or `NEXT_PUBLIC_*` variables.

The current app supports a development-only demo fallback when Supabase is not configured. In staging, missing Supabase credentials are treated as blocked, not as a successful auth setup.
