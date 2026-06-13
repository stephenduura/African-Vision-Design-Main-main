# Production Checklist

Use this when deploying the app after removing Clerk and moving auth to Supabase.

For a Vercel deployment, start with [docs/vercel-production-setup.md](/c:/Users/user/Downloads/African-Vision-Design-Main-main/African-Vision-Design-Main-main/docs/vercel-production-setup.md).

## Required environment variables

Backend/runtime:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` or `DATABASE_URL`
- `SUPABASE_FUNCTIONS_URL` if you use hosted functions
- `PUBLIC_APP_URL`
- `FRONTEND_URL`
- `CORS_ORIGINS`
- `ADMIN_USER_IDS` for an explicit admin allowlist

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ADMIN_USER_IDS` if you want role badges in the UI
- `VITE_ADMIN_EMAILS` if you want email-based admin highlighting

Static Hostinger deploy:

- Build the frontend with `BASE_PATH=./` so asset URLs stay relative.
- Set only the frontend variables in the static build environment.
- Do not upload `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, or Stripe secret values into the static Hostinger files.
- Host the API/backend separately if you need sign-in, profile sync, donations, or community mutations.

Stripe and other existing variables should stay in place if the app still uses payments:

- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_SYNC_ON_STARTUP`

## Supabase setup

1. Run the migrations in `supabase/migrations` against your production database.
2. Confirm `profiles` exists and RLS is enabled.
3. Confirm the `on_auth_user_created` trigger is present on `auth.users`.
4. Confirm existing auth users were backfilled into `public.profiles`.
5. Create at least one admin profile or set `ADMIN_USER_IDS`.

## Deployment order

1. Apply the database migrations.
2. Set the production env vars in your hosting platform.
3. Build and deploy the API server.
4. Build and deploy the frontend.
5. Sign in with a test user and verify `profiles` syncs.
6. Test an admin-only action to confirm auth and role checks still work.

## Smoke tests

- Sign up a new user and verify a `profiles` row is created.
- Sign in an existing user and verify the app loads without Clerk.
- Confirm the dashboard, community feed, and admin routes still work.
- Verify the API rejects unauthenticated requests as expected.
