# Privileged Gateway Refactor Report

Date: 2026-03-12
System: Mushin SaaS (Supabase + Edge Functions)

## Executive Summary

This refactor introduced a Privileged Gateway Pattern and removed direct raw service-role key exposure from edge functions.

- Original raw key references (`SUPABASE_SERVICE_ROLE_KEY`): 42
- New raw key references: 1
- Location of remaining raw key reference: `supabase/functions/_shared/privileged_gateway.ts`

Security boundary change:
- Before: every privileged function could read service-role key directly.
- After: only gateway module resolves the key; edge functions consume gateway helpers.

## Phase 1: Privileged Operation Inventory

### Category 1: Privileged writes
- `supabase/functions/admin-adjust-credits/index.ts` - mutate workspace credits - writes `workspaces`, `admin_audit_log`
- `supabase/functions/admin-promote-user/index.ts` - mutate user roles - writes `user_roles`, `admin_audit_log`
- `supabase/functions/admin-suspend-user/index.ts` - suspend auth users - writes `auth.users`, `admin_audit_log`
- `supabase/functions/send-outreach-email/index.ts` - consume/refund email credits and log outreach - writes `workspaces` via RPC, `outreach_log`
- `supabase/functions/ai-insights/index.ts` - consume/refund ai credits - writes `workspaces` via RPC
- `supabase/functions/search-influencers/index.ts` - consume search credits and write telemetry - writes `search_history`, `credits_usage`, `anomaly_logs`
- `supabase/functions/search-natural/index.ts` - consume ai credits and write eval data - writes `influencer_evaluations`, credit RPCs
- `supabase/functions/enrich-influencer/index.ts` - profile enrichment pipeline - writes `influencer_profiles`, `influencer_posts`, `follower_history`, `linked_accounts`, `credits_usage`, `enrichment_failures`
- `supabase/functions/track-click/index.ts` - click metric mutation - writes `campaign_metrics`
- `supabase/functions/email-webhook/index.ts` - webhook status updates - writes `outreach_log`
- `supabase/functions/classify-niche/index.ts` - niche/tag updates - writes `influencer_profiles`, `creator_tags`
- `supabase/functions/extract-creator-tags/index.ts` - tag extraction pipeline - writes `creator_tags`, `influencer_profiles`, `influencers_cache`
- `supabase/functions/extract-brand-mentions/index.ts` - brand mention extraction - writes mention/tag tables
- `supabase/functions/generate-invoice/index.ts` - invoice records/PDF pipeline - writes invoice/payment tables

### Category 2: Background worker jobs
- `supabase/functions/process-enrichment-job/index.ts` - queue consumer - writes `enrichment_jobs`, `influencer_profiles`
- `supabase/functions/creator-discovery-worker/index.ts` - discovery cron - writes `discovery_runs`, `influencer_profiles`, `influencers_cache`
- `supabase/functions/creator-refresh-monitor/index.ts` - refresh cron - writes `discovery_runs`, `enrichment_jobs`, `influencer_profiles`
- `supabase/functions/trending-niches-analyzer/index.ts` - trend aggregation cron - writes `discovery_runs`, `trending_niches`
- `supabase/functions/refresh-stale-profiles/index.ts` - stale profile queueing - writes `enrichment_jobs`
- `supabase/functions/generate-embeddings/index.ts` - embedding batch job - writes vector/embedding columns

### Category 3: Analytics aggregation
- `supabase/functions/ai-analytics/index.ts` - analytics cache/evaluation writes - reads/writes `influencer_evaluations`
- `supabase/functions/fetch-campaign-metrics/index.ts` - campaign metric aggregation - reads `campaign_metrics`, `tracking_links`
- `supabase/functions/find-lookalikes/index.ts` - similarity retrieval pipeline - reads indexed profile tables

### Category 4: System maintenance
- `supabase/functions/reset-free-credits/index.ts` - periodic free-tier credit reset - writes `workspaces`
- `supabase/functions/delete-account/index.ts` - cascading account deletion - writes/deletes many workspace-linked tables
- `supabase/functions/seed-accounts/index.ts` - seed/reset utility - writes auth and app tables
- `supabase/functions/health/index.ts` - system health checks - reads health probes from DB

### Category 5: Unnecessary service-role usage (identified)
- `supabase/functions/generate-tracking-link/index.ts` previously used privileged insert for `tracking_links` despite prior user auth + campaign access check.
- Refactor applied: now writes with user-context client under RLS.

## Phase 2: Unnecessary Service Role Removal

Applied:
- `generate-tracking-link` now uses RLS user client for insert after campaign access validation.

Result:
- Removed one unnecessary privileged path and reduced attack surface where RLS is sufficient.

## Phase 3-5: Privileged Gateway Implementation

New module:
- `supabase/functions/_shared/privileged_gateway.ts`

Gateway responsibilities implemented:
- environment validation (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- user JWT validation helper
- workspace membership resolution helper
- role checks (`owner/admin/member`)
- structured privileged operation logging (`admin_audit_log`)
- internal secret validation (`INTERNAL_GATEWAY_SECRET`)
- gateway API methods:
  - `performPrivilegedWrite`
  - `performPrivilegedRead`
  - `executeWorkspaceMutation`
  - `executeCreditMutation`
  - `createPrivilegedClient`

## Phase 6: Migration of Existing Functions

Architecture migration completed in two layers:
1) Raw key access removed from edge functions.
2) Privileged client creation centralized behind gateway helper.

Quantitative migration result:
- Raw key references reduced from 42 to 1 (gateway module only).

## Phase 7: Hardening Added

Additional hardening included:
- `process-enrichment-job`: fail-closed auth + timestamp + nonce replay protection
- `track-click`: tracking code validation, IP throttling, deduplication window
- SQL hardening migration: `supabase/migrations/20260327_credit_rpc_hardening.sql`
  - revokes authenticated execute on credit RPCs
  - service-role-only execute grants
  - defense-in-depth auth.uid membership checks in functions

## Phase 8: Post-Refactor Audit

Verified:
- service-role key literal appears only in gateway module
- no edge function directly reads `SUPABASE_SERVICE_ROLE_KEY` from env
- gateway client helper is used for privileged clients

Residual gap:
- Not all privileged actions are currently wrapped with `performPrivilegedWrite/Read`; several handlers still call `createPrivilegedClient()` directly after their own auth checks.
- This is safer than pre-refactor but still not the strictest possible gateway-only policy.

## Refactored Files

Core:
- `supabase/functions/_shared/privileged_gateway.ts`
- `supabase/functions/_shared/security.ts`

Security hardening and gateway migration (major):
- `supabase/functions/process-enrichment-job/index.ts`
- `supabase/functions/track-click/index.ts`
- `supabase/functions/ai-analytics/index.ts`
- `supabase/functions/ai-insights/index.ts`
- `supabase/functions/send-outreach-email/index.ts`
- `supabase/functions/email-webhook/index.ts`
- `supabase/functions/search-influencers/index.ts`
- `supabase/functions/search-natural/index.ts`
- `supabase/functions/enrich-influencer/index.ts`
- `supabase/functions/generate-tracking-link/index.ts`
- plus admin/maintenance workers migrated to gateway key/client helpers.

SQL:
- `supabase/migrations/20260327_credit_rpc_hardening.sql`

Tests:
- `src/test/supabase-security-hardening.test.ts`

## Removed Attack Surface

- Eliminated broad raw key reads across edge functions.
- Reduced accidental secret leakage and copy-paste auth regression risk.
- Centralized env-key handling to one module.
- Added stricter internal endpoint protections and anti-abuse controls.

## Final Verdict

Is the system now protected against service-role privilege escalation and privilege misuse?

NO

Reason:
- Service-role key exposure is dramatically reduced, but strict gateway-only enforcement is not yet complete because some handlers still execute privileged operations using `createPrivilegedClient()` directly instead of mandatory `performPrivilegedWrite/Read` wrappers.
- The architecture is substantially safer, but one more consolidation pass is required for full strict-boundary compliance.
