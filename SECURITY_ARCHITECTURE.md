# MUSHIN — Secure Architecture (Backend-First)

This document is the security baseline for MUSHIN’s Supabase + Edge Functions architecture.

## Architecture overview

- **Frontend (Vite/React)**:
  - Uses **Supabase publishable/anon** keys only.
  - Never holds provider secrets (Paddle, email, AI, OSINT).
  - Calls **Edge Functions** for sensitive actions (billing, AI, admin, enrichment).

- **Backend (Supabase Edge Functions)**:
  - Validates **JWT** and resolves user/workspace server-side.
  - Enforces **rate limits** and **credit/budget caps** before expensive operations.
  - Performs all third‑party API calls using secrets from Supabase **secrets manager**.

- **Database (Postgres + RLS)**:
  - **Deny by default**: RLS enabled on tenant data and sensitive operational tables.
  - Explicit policies only for required access paths.
  - Sensitive operational tables are separated from profiles (subscriptions, rate limits, security telemetry, billing).

## Critical controls implemented

### 1) RLS hardening (deny-by-default + forced RLS)

- Sensitive tables are forced under RLS (even for owners) via:
  - `supabase/migrations/20260421120000_force_rls_sensitive_tables.sql`
- Examples of sensitive tables:
  - `paddle_subscriptions`, `paddle_webhooks_log`
  - `api_rate_limits`
  - `security_alerts`, `security_events`, `system_audit_logs`
  - `credit_transactions`, `workspace_secrets`

**Mitigation**: prevents accidental broad grants or “owner bypass” from exposing billing or security telemetry.

### 2) Backend rate limiting (per-user + per-IP)

- **Database-backed global limiter** (service role only) using RPC:
  - `public.check_api_rate_limit(user_id, ip, endpoint, is_admin, is_super_admin)`
  - Stored state: `public.api_rate_limits` (RLS service-only)
- Edge Functions use server-side identifiers:
  - **per-user**: authenticated `userId`
  - **per-IP**: `x-forwarded-for` (first hop)
- Proper 429 responses with `Retry-After`.

**Mitigation**: stops credential stuffing, scraping, and “many accounts from one IP” abuse.

### 3) Secure API architecture (no client-side secrets)

- Payments:
  - `create-checkout` accepts only **server allowlisted** price IDs (env-based).
  - Webhooks verify provider signatures server-side (Paddle webhook secret).
- AI:
  - AI keys stay server-side; credits are deducted server-side.
  - Prompt builders wrap user input in delimiters to reduce prompt injection impact.

**Mitigation**: blocks price tampering, key theft, and client-controlled billing state.

### 4) Budget protection & cost controls

- Kill switch for expensive endpoints:
  - `KILL_SWITCH_EXPENSIVE_ENDPOINTS=true` disables costly operations with 503.
- Fail-closed behaviour in production when budget checks are unavailable:
  - `supabase/functions/_shared/budget-guard.ts`

**Mitigation**: prevents runaway spend when billing state is degraded or attack traffic spikes.

### 5) Logging, anomaly detection, and audit trails

- Admin/security events stored in dedicated tables with strict access:
  - `system_audit_logs`, `security_alerts`
- Alerts can be dispatched via:
  - `alert-dispatcher` (internal gateway secret/service role).

**Mitigation**: supports incident response, forensics, and abuse monitoring.

## Code-level examples

### Example: Payment endpoint never trusts client pricing

`create-checkout` allowlists Paddle price IDs from env and rejects unknown IDs.

### Example: Ledger-only credit enforcement for AI

`ai-insights` gates and debits credits using the ledger RPC:
- `get_user_credit_balance(...)`
- `consume_user_credits(...)`
- refunds via `grant_user_credits(...)` on provider failure

## Known high-impact vulnerabilities to watch for

- **Service role key in frontend** (Critical): would bypass RLS entirely. Keep service role only in edge functions.
- **Client-controlled pricing** (High): must be server allowlisted (already enforced).
- **Missing RLS/force RLS on operational tables** (High): would expose billing/security telemetry (now forced).
- **Fail-open rate limiting** (High): fixed to fail-closed in production in `_shared/global_rate_limit.ts`.

## Operational checklist (production)

- Set Supabase secrets (never VITE_):
  - `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `HUGGINGFACE_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `INTERNAL_GATEWAY_SECRET`
- Keep `ALLOWED_PREVIEW_ORIGINS` updated for admin/support tooling.
- Configure alert webhooks:
  - `ALERT_WEBHOOK_URL`, `ALERT_EMAIL_WEBHOOK_URL`
- Enable kill switch if abnormal spend:
  - `KILL_SWITCH_EXPENSIVE_ENDPOINTS=true`

