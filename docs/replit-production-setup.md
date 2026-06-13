# Replit Production Setup

This repo is configured for Replit autoscale. The production service entrypoint is the API server, and Replit already runs it on `PORT=8080` with `NODE_ENV=production`.

## Deployment Shape

- Deployment target: Replit autoscale
- Service: API Server
- Health check: `/api/healthz`
- Production build: `pnpm --filter @workspace/api-server run build`
- Production run: `node --enable-source-maps artifacts/api-server/dist/index.mjs`

## Exact Environment Values

Set these in Replit Secrets or the deployment environment:

- `NODE_ENV=production`
- `PORT=8080`
- `SUPABASE_URL=https://<your-project-ref>.supabase.co`
- `SUPABASE_ANON_KEY=<your-supabase-anon-key>`
- `SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>`
- `SUPABASE_DB_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres`
- `PUBLIC_APP_URL=https://<your-deployment-domain>`
- `FRONTEND_URL=https://<your-deployment-domain>`
- `CORS_ORIGINS=https://<your-deployment-domain>`
- `ADMIN_USER_IDS=<comma-separated-supabase-user-ids>`

Frontend build-time envs:

- `VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>`
- `VITE_ADMIN_USER_IDS=<comma-separated-supabase-user-ids>`
- `VITE_ADMIN_EMAILS=<optional-comma-separated-admin-emails>`

If the frontend is hosted on a different domain, add that domain to `CORS_ORIGINS` and set `FRONTEND_URL` to that domain instead.

## Supabase Migration Order

Run the migrations in this order:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_align_existing_supabase_schema.sql`
3. `supabase/migrations/0003_add_profiles_and_supabase_auth.sql`
4. `supabase/migrations/0004_profiles_backfill_and_trigger.sql`

If you are using the Supabase CLI, the usual production command is:

```bash
npx supabase db push
```

That command applies the migrations in numeric order.

## Verification Steps

1. Confirm `public.profiles` exists and has RLS enabled.
2. Confirm the `on_auth_user_created` trigger exists on `auth.users`.
3. Confirm existing users were backfilled into `public.profiles`.
4. Sign up a fresh test user and verify a matching profile row appears.
5. Sign in as an admin and confirm admin-only routes still work.

## Notes

- `PUBLIC_APP_URL`, `FRONTEND_URL`, and `CORS_ORIGINS` should point to the deployed frontend origin.
- `ADMIN_USER_IDS` is the cleanest way to control elevated access in production.
- Keep `SUPABASE_SERVICE_ROLE_KEY` secret; only the server should have it.
