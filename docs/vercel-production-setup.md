# Vercel Production Setup

This repo can be deployed on Vercel, but it needs the frontend build and the API function routing configured correctly.

For a copy-paste launch form, use [docs/vercel-deploy-checklist.md](/c:/Users/user/Downloads/African-Vision-Design-Main-main/African-Vision-Design-Main-main/docs/vercel-deploy-checklist.md).

## What Vercel Will Host

- Frontend: static Vite build from `artifacts/papi-foundation/dist/public`
- API: serverless functions from the `api/` folder

The Express app is still the shared backend entrypoint, but on Vercel it runs through the `api/` handlers instead of `app.listen()`.

## Vercel Config

The repo's [`vercel.json`](../vercel.json) is set up to:

- install the full workspace
- run the full workspace build
- publish the Vite output directory
- keep `/api/*` routed to the serverless API
- send SPA routes back to `index.html`

Important: in the Vercel dashboard, keep the Project Root at the repository root.
If the project is pointed at `artifacts/api-server` or `artifacts/papi-foundation`,
Vercel will build the wrong package and can fail with a missing-entrypoint error.

## Required Environment Variables

Set these in Vercel Project Settings:

Backend and shared runtime:

- `SUPABASE_URL=https://kzfibfvfejutygenjfhs.supabase.co`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` or `DATABASE_URL`
- `SUPABASE_FUNCTIONS_URL` if you use Supabase Edge Functions
- `STRIPE_SECRET_KEY` or `STRIPE_RESTRICTED_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY_ALT` if you rotate keys and need a fallback
- `PUBLIC_APP_URL`
- `FRONTEND_URL`
- `CORS_ORIGINS`
- `ADMIN_USER_IDS`

Frontend:

- `VITE_SUPABASE_URL=https://kzfibfvfejutygenjfhs.supabase.co`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ADMIN_USER_IDS`
- `VITE_ADMIN_EMAILS`

If your Vercel production URL is `https://example.vercel.app`, use that exact origin for:

- `PUBLIC_APP_URL`
- `FRONTEND_URL`
- `CORS_ORIGINS`

Set the Stripe webhook endpoint in the Stripe dashboard to:

- `https://example.vercel.app/api/stripe/webhook`

If you use preview deployments for testing, add each preview domain to the Supabase redirect allowlist and, if needed, to `CORS_ORIGINS`.

## One-Time Production Steps

1. Run the Supabase migrations in order:
   - `0001_initial_schema.sql`
   - `0002_align_existing_supabase_schema.sql`
   - `0003_add_profiles_and_supabase_auth.sql`
   - `0004_profiles_backfill_and_trigger.sql`
2. Confirm `public.profiles` is populated.
3. Confirm your admin user IDs are present in `ADMIN_USER_IDS`.
4. In the Supabase dashboard, set the production Site URL to your Vercel domain.
5. Add your Vercel production domain to the allowed redirect URLs.
6. Deploy to Vercel.
7. Sign in with a test account and confirm the profile sync works.
8. Send a test Stripe checkout through `/api/stripe/webhook` and confirm donations record correctly.

## Important Difference From Replit

Vercel will not run the startup-only code in `artifacts/api-server/src/index.ts`.

That means:

- Stripe schema bootstrap should already be done before deploy
- any startup seeding should be handled separately
- the live API should rely on the deployed database state, not startup side effects
- the Stripe webhook route on Vercel is `/api/stripe/webhook`

## Supabase Auth Dashboard Settings

Set these in your Supabase project:

- Site URL: your Vercel production domain
- Redirect URLs: include your Vercel production domain and any preview URLs you want to test
- Email confirmation redirects: allow the same production domain if you use email sign-up confirmation

## Verification Checklist

- Open the site root and confirm the SPA loads.
- Visit a client-side route like `/about` and confirm it resolves.
- Hit `/api/healthz` and confirm the API responds.
- Sign up a user and confirm a `profiles` row is created.
- Test an admin-only action.
