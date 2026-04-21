#!/usr/bin/env bash
# ============================================================
# MUSHIN — Backend Deployment Runbook
# Run commands from the project root.
# Requires: Supabase CLI v1.150+, Docker (for local dev)
# ============================================================

set -euo pipefail

# ─────────────────────────────────────────────────────────────
# PREREQUISITES
# ─────────────────────────────────────────────────────────────

# Install Supabase CLI (if not already installed)
brew install supabase/tap/supabase          # macOS
# npm install -g supabase                   # or via npm (cross-platform)

# Verify version
supabase --version
# Expected: 1.150.0 or higher

# ─────────────────────────────────────────────────────────────
# STEP A — INITIALISE (first time only)
# ─────────────────────────────────────────────────────────────

# Login to Supabase
supabase login

# Link your project (get SUPABASE_PROJECT_REF from dashboard URL)
# e.g. if your dashboard URL is https://supabase.com/dashboard/project/abcdefghijkl
# then the ref is abcdefghijkl
supabase link --project-ref <YOUR_SUPABASE_PROJECT_REF>

# Confirm the link
supabase status

# ─────────────────────────────────────────────────────────────
# STEP B — SET API SECRETS
# These are stored server-side; never committed to git.
# ─────────────────────────────────────────────────────────────

# Set Serper API key (get from https://serper.dev)
supabase secrets set SERPER_API_KEY="your_serper_api_key_here"

# Set Apify API token (get from https://console.apify.com/account/integrations)
supabase secrets set APIFY_API_TOKEN="your_apify_api_token_here"

# Verify secrets are stored (values will be redacted)
supabase secrets list

# ─────────────────────────────────────────────────────────────
# STEP C — INITIALISE THE EDGE FUNCTION (first time only)
# This scaffolds the function directory if it doesn't exist.
# Skip if you've already created supabase/functions/discover-creators/
# ─────────────────────────────────────────────────────────────

supabase functions new discover-creators

# Then replace supabase/functions/discover-creators/index.ts
# with the file provided in this package.

# ─────────────────────────────────────────────────────────────
# STEP D — RUN SQL MIGRATIONS
# ─────────────────────────────────────────────────────────────

# Option 1: Push via CLI (recommended for CI/CD)
supabase db push

# Option 2: Run manually in SQL editor
# Copy the contents of supabase/migrations/001_osint_cache.sql
# and execute in the Supabase Dashboard → SQL Editor.

# Verify the tables exist
supabase db diff --schema public   # should show creators_cache, search_queries_log

# ─────────────────────────────────────────────────────────────
# STEP E — DEPLOY THE EDGE FUNCTION
# ─────────────────────────────────────────────────────────────

# Deploy discover-creators
supabase functions deploy discover-creators --no-verify-jwt

# The --no-verify-jwt flag allows the frontend to call the function
# with just the anon key without requiring a user session.
# Remove it if you want to require authentication (recommended for production).

# Verify deployment
supabase functions list
# You should see: discover-creators | ACTIVE

# ─────────────────────────────────────────────────────────────
# STEP F — SMOKE TEST THE DEPLOYED FUNCTION
# ─────────────────────────────────────────────────────────────

# Get your project URL and anon key from the dashboard or:
SUPABASE_URL=$(supabase status --output json | jq -r '.API.URL')
SUPABASE_ANON_KEY=$(supabase status --output json | jq -r '.API.\"anon key\"')

# Fire a test request (basic search — should return cache or trigger live discovery)
curl -X POST \
  "${SUPABASE_URL}/functions/v1/discover-creators" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "platforms":    ["instagram"],
    "cities":       ["Karachi"],
    "niches":       ["Fashion & Style"],
    "minFollowers": 10000
  }' | jq '{
    source,
    count,
    timing,
    first_creator: .creators[0].display_name
  }'

# Expected response (cache miss first time, then cache hit):
# {
#   "source": "live",
#   "count": 8,
#   "timing": { "total_ms": 45000, "serper_ms": 800, "apify_ms": 38000 },
#   "first_creator": "..."
# }

# ─────────────────────────────────────────────────────────────
# STEP G — LOCAL DEVELOPMENT
# ─────────────────────────────────────────────────────────────

# Start local Supabase stack (requires Docker)
supabase start

# Serve functions locally with hot-reload
# You must pass the secrets as env vars for local runs:
SERPER_API_KEY="your_key" \
APIFY_API_TOKEN="your_token" \
supabase functions serve discover-creators \
  --env-file .env.local \
  --no-verify-jwt

# Test locally
curl -X POST \
  "http://localhost:54321/functions/v1/discover-creators" \
  -H "Authorization: Bearer $(supabase status --output json | jq -r '.API.\"anon key\"')" \
  -H "Content-Type: application/json" \
  -d '{"platforms":["tiktok"],"cities":["Lahore"],"minFollowers":50000}' \
  | jq .

# ─────────────────────────────────────────────────────────────
# STEP H — ENVIRONMENT VARIABLES (Frontend .env)
# ─────────────────────────────────────────────────────────────

# Add these to your .env.local (Vite project):
cat >> .env.local << 'EOF'

# Supabase
VITE_SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<YOUR_ANON_KEY>

# Feature flag: set to "mock" to use mock data, "live" for edge function
VITE_DATA_SOURCE=live
EOF

# ─────────────────────────────────────────────────────────────
# STEP I — OPTIONAL: SCHEDULE CACHE VACUUM
# Run nightly via Supabase scheduled functions or pg_cron.
# ─────────────────────────────────────────────────────────────

# Enable pg_cron in your Supabase project dashboard first
# (Extensions → pg_cron → Enable)

# Then run this SQL to schedule nightly vacuum at 3:00 AM PKT (UTC+5 = 22:00 UTC):
psql "$(supabase db remote connection-string)" << 'SQL'
SELECT cron.schedule(
  'vacuum-stale-creators',          -- job name
  '0 22 * * *',                     -- cron expression: 22:00 UTC = 3:00 AM PKT
  $$ SELECT vacuum_stale_creators(7) $$   -- delete records older than 7 days
);
SQL

# Verify the cron job
psql "$(supabase db remote connection-string)" \
  -c "SELECT jobname, schedule, command, active FROM cron.job;"

# ─────────────────────────────────────────────────────────────
# STEP J — MONITORING & LOGS
# ─────────────────────────────────────────────────────────────

# Stream live function logs
supabase functions logs discover-creators --scroll

# Or tail from dashboard:
# Dashboard → Edge Functions → discover-creators → Logs

# Query cache analytics from SQL editor:
psql "$(supabase db remote connection-string)" << 'SQL'
SELECT
  hour,
  total_queries,
  cache_hits,
  hit_rate_pct,
  total_serper_calls,
  total_apify_runs,
  avg_duration_ms,
  avg_cache_hit_ms,
  avg_live_ms
FROM cache_analytics
ORDER BY hour DESC
LIMIT 48;
SQL

# Check current cache size
psql "$(supabase db remote connection-string)" << 'SQL'
SELECT
  platform,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE NOT is_stale) AS fresh,
  COUNT(*) FILTER (WHERE is_stale)     AS stale,
  ROUND(AVG(mushin_score))             AS avg_score,
  ROUND(AVG(fake_follower_pct), 1)     AS avg_fake_pct,
  COUNT(*) FILTER (WHERE enrichment_email IS NOT NULL) AS with_email,
  COUNT(*) FILTER (WHERE enrichment_whatsapp IS NOT NULL) AS with_whatsapp
FROM creators_cache
GROUP BY platform
ORDER BY platform;
SQL

# ─────────────────────────────────────────────────────────────
# STEP K — ROLLBACK PROCEDURE
# ─────────────────────────────────────────────────────────────

# If you need to roll back the migration (drops all cache data):
psql "$(supabase db remote connection-string)" << 'SQL'
-- WARNING: This is destructive. Backup first.
DROP TABLE IF EXISTS search_queries_log CASCADE;
DROP TABLE IF EXISTS creators_cache CASCADE;
DROP FUNCTION IF EXISTS get_fresh_creators CASCADE;
DROP FUNCTION IF EXISTS upsert_creator CASCADE;
DROP FUNCTION IF EXISTS vacuum_stale_creators CASCADE;
DROP VIEW IF EXISTS cache_analytics CASCADE;
SQL

# Undeploy the function
supabase functions delete discover-creators

# Remove secrets
supabase secrets unset SERPER_API_KEY
supabase secrets unset APIFY_API_TOKEN
