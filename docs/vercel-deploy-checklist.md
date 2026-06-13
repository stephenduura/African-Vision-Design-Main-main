# Vercel Deploy Checklist

Use this as the final production launch form for the app.

## 1) Vercel Project Settings

### Project Root

- First confirm the deployment is using the latest `main` commit hash
- Root Directory: leave this at the repository root
- Do not point the project at `artifacts/api-server` or `artifacts/papi-foundation`
- The expected build log should show the workspace root build, then both the API server and frontend builds
- If the log starts with `> @workspace/api-server@... build`, the Root Directory is still wrong
- That log means Vercel is resolving `artifacts/papi-foundation/dist/public` relative to `artifacts/api-server`, which cannot work
- If the workspace build completes and Vercel still says `No entrypoint found in output directory`, the project is past the root-dir issue and is now failing at packaging time
- In that case, recheck the Vercel project model: this repo is a monorepo, and the current single-project hybrid setup is not packaging cleanly on Vercel
- The practical fix is to split into separate Vercel projects or move to a Build Output API setup that explicitly describes the frontend and serverless functions

### Build

- Framework preset: `Other`
- Install command: `pnpm install --no-frozen-lockfile`
- Build command: `pnpm run build`
- Output directory: `artifacts/papi-foundation/dist/public`

### Production Environment Variables

Set these in Vercel for `Production`:

```bash
NODE_ENV=production
SUPABASE_URL=https://kzfibfvfejutygenjfhs.supabase.co
SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
SUPABASE_DB_URL=postgresql://postgres:<password>@db.kzfibfvfejutygenjfhs.supabase.co:5432/postgres
PUBLIC_APP_URL=https://<your-live-vercel-domain>
FRONTEND_URL=https://<your-live-vercel-domain>
CORS_ORIGINS=https://<your-live-vercel-domain>
ADMIN_USER_IDS=<comma-separated-supabase-user-ids>
STRIPE_SECRET_KEY=<your-stripe-secret-or-restricted-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>
```

### Frontend Environment Variables

```bash
VITE_SUPABASE_URL=https://kzfibfvfejutygenjfhs.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_ADMIN_USER_IDS=<comma-separated-supabase-user-ids>
VITE_ADMIN_EMAILS=<optional-comma-separated-admin-emails>
```

### Optional

```bash
SUPABASE_FUNCTIONS_URL=https://kzfibfvfejutygenjfhs.functions.supabase.co
STRIPE_SECRET_KEY_ALT=<optional-rotated-stripe-key>
STRIPE_SYNC_ON_STARTUP=false
```

## 2) Supabase Dashboard

### Auth

- Site URL: `https://<your-vercel-domain>`
  - replace with your live `*.vercel.app` or custom domain after the first deploy
- Redirect URLs:
  - `https://<your-live-vercel-domain>`
  - `https://<your-live-vercel-domain>/sign-in`
  - `https://<your-live-vercel-domain>/sign-up`
  - add preview URLs if you plan to test them

### Database

- Confirm the following migrations are applied in order:
  1. `supabase/migrations/0001_initial_schema.sql`
  2. `supabase/migrations/0002_align_existing_supabase_schema.sql`
  3. `supabase/migrations/0003_add_profiles_and_supabase_auth.sql`
  4. `supabase/migrations/0004_profiles_backfill_and_trigger.sql`
- Confirm `public.profiles` exists
- Confirm the `on_auth_user_created` trigger exists on `auth.users`
- Confirm existing auth users are backfilled into `public.profiles`

## 3) Stripe Dashboard

- Set webhook endpoint to:

```text
https://<your-live-vercel-domain>/api/stripe/webhook
```

- Subscribe the webhook to the events your app uses
- Confirm the webhook signing secret is copied into `STRIPE_WEBHOOK_SECRET`

## 4) Final Deploy Order

1. Apply Supabase migrations.
2. Set Vercel environment variables.
3. Set Supabase Auth URLs.
4. Set the Stripe webhook endpoint.
5. Deploy the Vercel project.
6. Open the site and verify the homepage loads.
7. Sign up a test user and confirm a profile row is created.
8. Sign in and confirm auth persists on refresh.
9. Test an admin-only action.
10. Test a Stripe checkout flow if payments are enabled.

## 5) Smoke Tests

- `/` loads
- `/about` loads
- `/api/healthz` returns `{ "status": "ok" }`
- Sign-up works
- Sign-in works
- Profile sync works
- Admin routes reject non-admins
- Donation checkout works

## 6) Quick Copy Values

Replace these placeholders once and reuse them everywhere:

- `https://<your-live-vercel-domain>` -> your live Vercel URL
- `<your-supabase-anon-key>` -> Supabase anon key
- `<your-supabase-service-role-key>` -> Supabase service role key
- `<your-stripe-secret-or-restricted-key>` -> Stripe secret or restricted key
- `<your-stripe-webhook-secret>` -> Stripe webhook signing secret
- `<comma-separated-supabase-user-ids>` -> admin user IDs

Vercel project dashboard link you provided:

- `https://vercel.com/stephen-bariduura-paago-s-projects/african-vision-design-main`
