# MUSHIN — Supabase Deployment Runbook (2026)

This is the **authoritative** CLI runbook for deploying MUSHIN’s database + Edge Functions with `npx supabase`.

## Prereqs

- Node.js + npm installed
- Supabase CLI available via `npx supabase`
- You are logged in and the project is linked

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase status
```

## 1) Set required secrets (Edge Functions)

These are stored server-side in Supabase (never commit them).

```bash
# Core OSINT pipeline
npx supabase secrets set SERPER_API_KEY="YOUR_SERPER_KEY"
npx supabase secrets set APIFY_API_TOKEN="YOUR_APIFY_TOKEN"

# Optional but used by enrichment/search modules (set if you use those features)
npx supabase secrets set YOUTUBE_API_KEY="YOUR_YOUTUBE_DATA_API_KEY"
npx supabase secrets set HUGGINGFACE_API_KEY="YOUR_HUGGINGFACE_KEY"

# Optional caching/rate limiting (set if enabled)
npx supabase secrets set UPSTASH_REDIS_REST_URL="YOUR_UPSTASH_URL"
npx supabase secrets set UPSTASH_REDIS_REST_TOKEN="YOUR_UPSTASH_TOKEN"

# Billing (set if using Paddle)
npx supabase secrets set PADDLE_API_KEY="YOUR_PADDLE_API_KEY"
npx supabase secrets set PADDLE_WEBHOOK_SECRET="YOUR_PADDLE_WEBHOOK_SECRET"
```

Verify:

```bash
npx supabase secrets list
```

## 2) Apply all database migrations

```bash
npx supabase db push
npx supabase migration list
```

## 3) Deploy Edge Functions

Deploy the **core** functions first (search + credits enforcement).

```bash
# Search Intelligence Engine (live Serper + Apify, credit-gated)
npx supabase functions deploy discover-creators

# Legacy search endpoints (still used by other screens / internal modules)
npx supabase functions deploy search-influencers
npx supabase functions deploy search-natural
npx supabase functions deploy enrich-influencer
```

Deploy admin/support + billing functions (if present in your repo):

```bash
npx supabase functions deploy create-checkout
npx supabase functions deploy paddle-webhook

npx supabase functions deploy admin-create-user
npx supabase functions deploy admin-force-password-reset
```

Verify:

```bash
npx supabase functions list
npx supabase functions logs discover-creators --scroll
```

## 4) Frontend environment variables

In your frontend hosting provider (or `.env.local` for dev), set:

```bash
VITE_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
```

Local dev:

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## 5) Verification checklist (post-deploy)

- **Credits**
  - Open `/credits` and confirm balances load.
  - Run `/search` once and verify a **ledger debit** is created in `credit_transactions`.
  - Set credits to 0 and confirm the **global lock overlay** disables the app and forces upgrade.
- **Search**
  - `/search` returns results via `discover-creators`.
  - Live banner appears while searching.
  - Cards show **MUSHIN Score** and enrichment badges (Email / WA / Links).
- **Edge function logs**
  - No repeated 401/403s from `discover-creators`
  - No missing secret errors (SERPER/APIFY)
- **RLS**
  - Authenticated users can only read their own credit balances/transactions.

## 6) Local Supabase (optional)

```bash
npx supabase start
npx supabase db reset
npx supabase functions serve --env-file .env.local
```

## 7) Common fixes

- **Migrations failing**: run `npx supabase db reset` locally; ensure all migration filenames are timestamped.
- **Credits not changing**: ensure the deployed function is the updated one (ledger-based debit) and you redeployed it.
- **discover-creators returns 500 missing secrets**: set `SERPER_API_KEY` and `APIFY_API_TOKEN` via `npx supabase secrets set ...`, then redeploy the function.

