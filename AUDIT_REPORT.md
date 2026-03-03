# InfluenceIQ Pro — Full System Audit Report

> Generated after a three-phase deep-dive audit: architecture analysis, security review, and functional UI testing.

---

## Table of Contents

1. [System Architecture Summary](#1-system-architecture-summary)
2. [Security Vulnerabilities (17 Issues)](#2-security-vulnerabilities)
3. [Broken / Non-Functional UI Features](#3-broken--non-functional-ui-features)
4. [Hardcoded Placeholder Data](#4-hardcoded-placeholder-data)
5. [Missing Database Tables](#5-missing-database-tables)
6. [Confirmed Working Features](#6-confirmed-working-features)
7. [Fix Priority Matrix](#7-fix-priority-matrix)

---

## 1. System Architecture Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite, React Router v6, TanStack React Query v5 |
| UI Components | shadcn/ui (Radix UI), Tailwind CSS, Framer Motion |
| Backend | Supabase: Postgres + Auth + 33 Edge Functions (Deno/TypeScript) |
| Billing | Stripe via `create-checkout`, `customer-portal`, `check-subscription` edge functions |
| Email | Resend API via `send-outreach-email` edge function |
| AI | Google Gemini via `ai-insights` edge function (summarize / fraud-check / recommend / evaluate) |
| Search | Serper API (Google Search wrapper) in `search-influencers` |
| Enrichment | YouTube Data API v3 + Apify (Instagram / TikTok) in `enrich-influencer` |
| Rate Limiting | Upstash Redis (`_shared/rate_limit.ts`) |
| CRM | HubSpot via `sync-hubspot`, secrets stored in `workspace_secrets` table |
| Plans | Free ($0), Pro ($29/mo), Business ($79/mo) with credit-based metering |

### Auth / Multi-tenancy Flow

```
User signs in → Supabase Auth → AuthContext loads profile + workspace membership
→ workspace_id injected into every query via RLS policies
→ per-workspace credits tracked in workspaces.credits column
```

---

## 2. Security Vulnerabilities

### 🔴 CRITICAL

#### SEC-01 — Stored XSS in Public Profile Generator
- **File:** `supabase/functions/generate-public-profile/index.ts`
- **Issue:** Database values (username, bio, platform handles) are interpolated directly into an HTML string without any escaping. A malicious influencer record containing `<script>` tags executes arbitrary JavaScript in the viewer's browser.
- **Fix:** Use a proper HTML templating library with auto-escaping (e.g., `sanitize-html`, `DOMPurify` on server-side rendering), or encode all injected values with `encodeURIComponent` / HTML entity encoding before insertion.

#### SEC-02 — Open Redirect via Track-Click
- **File:** `supabase/functions/track-click/index.ts`
- **Issue:** The function reads a `url` field from the `tracking_links` table and issues a 302 redirect to it without validating the URL scheme. Any `javascript:` or `data:` URI stored in the DB causes reflected XSS / phishing redirects.
- **Fix:** Validate that the destination URL starts with `https://` or `http://` before redirecting. Reject or sanitize anything else.

#### SEC-03 — No Webhook Signature Verification on Email Events
- **File:** `supabase/functions/email-webhook/index.ts`
- **Issue:** Resend sends webhook events with an `svix-signature` header for verification. The handler processes all incoming POST requests without verifying this signature, allowing any external party to forge delivery/bounce/complaint events and manipulate outreach logs.
- **Fix:** Implement Svix webhook signature verification using the Resend webhook secret. Reject requests with missing or invalid signatures with HTTP 401.

---

### 🔴 HIGH

#### SEC-04 — Race Condition on Credit Check / Deduct in Outreach Email
- **File:** `supabase/functions/send-outreach-email/index.ts`
- **Issue:** Credits are checked and then deducted in two separate, non-atomic operations. Under concurrent requests a user can drain more credits than they have.
- **Fix:** Use a single atomic Postgres function / RPC that does `SELECT FOR UPDATE` or a `UPDATE workspaces SET credits = credits - 1 WHERE credits > 0 RETURNING credits` and returns an error if no rows are updated.

#### SEC-05 — Credits Deducted on Cache Hits in Search
- **File:** `supabase/functions/search-influencers/index.ts`
- **Issue:** The edge function deducts a credit and then checks whether a cached result exists. Cache hits cost credits they should not.
- **Fix:** Check the cache first; deduct a credit only when a fresh API call to Serper is made.

#### SEC-06 — Rate Limit Bypass via Spoofed IP Header
- **File:** `supabase/functions/search-influencers/index.ts` + `_shared/rate_limit.ts`
- **Issue:** The rate limiter keys by `x-forwarded-for` header, which any caller can forge. A user can send `X-Forwarded-For: 1.2.3.4` on every request to cycle through unlimited keys.
- **Fix:** Use the authenticated user's `user_id` (from the verified JWT) as the primary rate-limit key rather than a client-supplied header.

#### SEC-07 — Any Workspace Member Can Destroy the Entire Workspace
- **File:** `supabase/functions/delete-account/index.ts`
- **Issue:** The function deletes both the user's personal data *and* the entire workspace without checking whether the caller is the workspace owner. A `member` role user can wipe a workspace they don't own.
- **Fix:** Add a role check: `SELECT role FROM workspace_members WHERE user_id = caller AND workspace_id = X` and abort if the role is not `owner`.

#### SEC-08 — Stripe Subscription Not Cancelled on Account Deletion
- **File:** `supabase/functions/delete-account/index.ts`
- **Issue:** The function deletes the user record but never calls `stripe.subscriptions.cancel()`. The workspace continues to be billed after deletion.
- **Fix:** Before deleting, look up the Stripe subscription ID from the `subscriptions` table and call `stripe.subscriptions.cancel(id)`.

#### SEC-09 — Negative Credits Possible via Admin Adjustment
- **File:** `supabase/functions/admin-adjust-credits/index.ts`
- **Issue:** There is no floor validation. An admin (or attacker with admin access) can set credits to a negative number (e.g., `-99999`), causing integer underflow issues and bypassing credit checks that compare `credits > 0`.
- **Fix:** Add a `MAX(0, newValue)` floor in the RPC or enforce a `CHECK (credits >= 0)` constraint on the `workspaces` table.

---

### 🟡 MEDIUM

#### SEC-10 — Rate Limiter Fails Open When Redis Is Unavailable
- **File:** `supabase/functions/_shared/rate_limit.ts`
- **Issue:** When Upstash Redis throws a connection error, the `try/catch` silently returns `true` (allowed), meaning all rate limits are bypassed whenever Redis is down.
- **Fix:** On Redis errors, return `false` (deny) or at minimum log a critical alert and fall back to a strict per-process counter in memory.

#### SEC-11 — Email Header Injection via `from_name`
- **File:** `supabase/functions/send-outreach-email/index.ts`
- **Issue:** The `from_name` field from workspace settings is interpolated into the Resend `from` header without stripping newlines (`\r\n`). A crafted name can inject arbitrary mail headers (BCC, CC, additional body).
- **Fix:** Strip `\r`, `\n`, and other control characters from `from_name` before use, or validate it against a strict alphanumeric/space pattern.

#### SEC-12 — Fabricated Proxy Emails Synced to HubSpot
- **File:** `supabase/functions/sync-hubspot/index.ts`
- **Issue:** When an influencer has no email, the function generates a fake address (`username@instagram.com`, `username@tiktok.com`, etc.) and creates a real HubSpot contact with it. These domains are not owned by the influencers, violating CAN-SPAM / GDPR and contaminating CRM data.
- **Fix:** Skip the HubSpot sync for influencers with no real email, or create the contact without an email field.

#### SEC-13 — Audit Log Written with Wrong Column
- **File:** `supabase/functions/search-influencers/index.ts`
- **Issue:** The audit log insert uses column `user_id` but the `admin_audit_log` schema defines `admin_user_id`. Every search audit log write silently fails, leaving no audit trail.
- **Fix:** Change `user_id` to `admin_user_id` in the insert statement to match the schema.

#### SEC-14 — `@ts-nocheck` Disables Type Safety on HTML Generator
- **File:** `supabase/functions/generate-public-profile/index.ts`
- **Issue:** The file-level `// @ts-nocheck` directive disables TypeScript's entire type system for the most sensitive function (HTML generation). This masks the XSS vulnerability (SEC-01) from static analysis tools.
- **Fix:** Remove `@ts-nocheck`, fix the resulting type errors, and add ESLint rules banning the directive in edge functions.

---

### 🟢 LOW

#### SEC-15 — 60-Second Stale Window After Admin Role Revocation
- **File:** `src/hooks/useAdminPermissions.ts`
- **Issue:** The hook caches the admin role check result for 60 seconds (`staleTime: 60_000`, `gcTime: 60_000`). A revoked admin retains UI-level admin access for up to a minute. (Edge functions re-verify server-side, so this is UI-only risk.)
- **Fix:** Reduce `staleTime` to 10–15 seconds or invalidate the query on relevant auth events.

#### SEC-16 — Dead DB Query on Every Search Request
- **File:** `supabase/functions/search-influencers/index.ts`
- **Issue:** A Supabase query executes on every search but its result is never used (the variable is declared but ignored). This wastes DB resources and query budget on every search.
- **Fix:** Remove the dead query entirely.

#### SEC-17 — Members Can Export Entire Workspace Data
- **File:** `supabase/functions/export-user-data/index.ts`
- **Issue:** The export function returns all data associated with the `workspace_id` from the JWT rather than filtering to only the requesting user's own records. Any workspace member can download the full data export including other members' activity.
- **Fix:** Add a `user_id = caller_id` filter to each query, or document and expose a separate admin-only workspace export endpoint.

---

## 3. Broken / Non-Functional UI Features

### 🔴 FUNC-01 — Payment History Always Empty
- **File:** `src/pages/BillingPage.tsx` line 50
- **Root Cause:** Queries `supabase.from("payments")` — this table **does not exist** in any migration. The `PaymentsPanel` component always renders "No payment records found."
- **Impact:** Users cannot view their payment history.
- **Fix Options:**
  - **Option A (Recommended):** Create a `payments` table in a new migration that is populated by the Stripe webhook handler after successful charges.
  - **Option B:** Query the `subscriptions` table and display subscription billing data instead.

### 🔴 FUNC-02 — Invoice Download Generates Wrong Data
- **File:** `supabase/functions/generate-invoice/index.ts`
- **Root Cause:** The client sends a `payment_id` to identify which invoice to generate, but the edge function uses that value as a `workspace_id` to look up the `subscriptions` table. The generated PDF contains subscription plan data, not a per-payment invoice.
- **Additionally:** A commented-out line (`// await supabase.from('payments').update(...)`) confirms this was never completed.
- **Impact:** Every invoice PDF shows the same subscription data regardless of which payment was selected.
- **Fix:** Accept `workspace_id` and `payment_id` as separate parameters. Look up the specific payment record by `payment_id`, then generate an invoice from that record's amount, date, and description.

### 🔴 FUNC-03 — 2FA Toggle Does Nothing
- **File:** `src/pages/Settings.tsx` line 45 (`twoFAEnabled` state) + line 398 (`<Switch>`)
- **Root Cause:** The Two-Factor Authentication toggle is pure local React state. It never calls any Supabase Auth MFA enrollment API (`supabase.auth.mfa.enroll()`, `supabase.auth.mfa.challengeAndVerify()`). Toggling the switch and refreshing the page resets it to off.
- **Impact:** Users believe they have enabled 2FA but have not. This is a security-trust violation.
- **Fix:** Implement the full Supabase MFA TOTP flow:
  1. On enable: call `supabase.auth.mfa.enroll({ factorType: 'totp' })`, display the QR code, collect and verify the TOTP code.
  2. On disable: call `supabase.auth.mfa.unenroll({ factorId })`.
  3. On sign-in: add an MFA challenge step when a factor is enrolled.

### 🔴 FUNC-04 — Active Sessions List Shows Fake Data
- **File:** `src/pages/Settings.tsx` (the `sessions` array, hardcoded ~line 175)
- **Root Cause:** The sessions array is hardcoded with `"Chrome · macOS"` (current) and `"Safari · iPhone"` (mobile) — static strings that never reflect the user's real sessions.
- **Impact:** The "Revoke" button for non-current sessions also does nothing functional.
- **Fix:** Call `supabase.auth.getUser()` and Supabase's admin API to list active sessions, or use `supabase.auth.signOut({ scope: 'others' })` to revoke all other sessions.

### 🔴 FUNC-05 — Saved Search Re-run Loses City Filter
- **Files:** `src/pages/SavedSearchesPage.tsx` (writes `location`) vs. `src/pages/SearchPage.tsx` (reads `city`)
- **Root Cause:** `handleRerun` sets `params.set("location", filters.location)` but `SearchPage` reads `searchParams.get("city")`. The URL parameter name is mismatched.
- **Impact:** Every time a user re-runs a saved search, the city/location filter is silently discarded. The search executes without the location constraint, returning wider results.
- **Fix:** Change `params.set("location", ...)` to `params.set("city", ...)` in `SavedSearchesPage.tsx`.

### 🔴 FUNC-06 — Campaign Compare CSV Export "Spent" Always $0
- **File:** `src/pages/CampaignComparePage.tsx` line 62 + line 169
- **Root Cause:** Both the CSV export and the on-screen "Spent" bar use `c.agreed_rate`. While `agreed_rate` exists in the DB schema and the `pipeline_cards` TypeScript local types, the `usePipelineCards` query **does not select `agreed_rate`** in its SELECT statement, so the value is always `undefined` → `0`.
- **Impact:** All "Spent" figures in Campaign Compare show $0 regardless of agreed rates set on cards.
- **Fix:** Add `agreed_rate` to the SELECT in `usePipelineCards.ts` (and `KanbanBoard.tsx` where pipeline cards are also fetched).

### 🔴 FUNC-07 — Admin Dashboard "Recent Activity" Always Empty
- **File:** `src/pages/admin/AdminDashboard.tsx`
- **Root Cause:** The "Recent Activity" card renders a hardcoded empty state `"No recent admin actions."` — it never queries the `admin_audit_log` table that exists and is populated by admin actions.
- **Impact:** Admins have no visibility into recent platform actions from their dashboard.
- **Fix:** Add a query: `supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(10)` and render results in the card.

### 🔴 FUNC-08 — Admin Dashboard System Status Hardcoded
- **File:** `src/pages/admin/AdminDashboard.tsx`
- **Root Cause:** "Platform Health 99.9%" and all service badges ("Operational", "Active", etc.) are hardcoded strings. No health checks or uptime monitoring queries are made.
- **Impact:** The status panel is purely decorative — it will show "Operational" even during outages.
- **Fix:** Either integrate a real health check endpoint (Supabase status API, Stripe status, etc.) or clearly label this section as a placeholder in the UI.

### 🟡 FUNC-09 — CompliancePanel Storage Upload Is Mocked / Never Executes
- **File:** `src/components/payments/CompliancePanel.tsx` lines 38–46
- **Root Cause:** The Supabase Storage upload is commented out with `// Mocking storage upload for boilerplate scope`. The function inserts into `tax_documents` (a table that does not exist in migrations, queried via `supabase as any`) with only a local file path — no actual file is ever stored.
- **Impact:** W-9 tax document uploads silently "succeed" (toast shows) but no file is stored anywhere and the DB insert fails because the table does not exist.
- **Fix:** Create the `tax_documents` migration, create the `compliance` storage bucket, and uncomment + complete the upload logic.

### 🟡 FUNC-10 — HubSpot Integration Status Always Shows "Not Configured"
- **File:** `src/components/settings/IntegrationsTab.tsx`
- **Root Cause:** The component calls `supabase.rpc("get_hubspot_configured", { _workspace_id: ... })` — this RPC is not defined in any migration. The call fails silently, leaving `hubspotConfigured` always `false`. It also reads from `workspace_secrets` via `supabase as any`, a table that does not exist in migrations.
- **Impact:** Even if a HubSpot key was previously saved (via another path), the Integrations tab always shows it as unconfigured.
- **Fix:** Create the `workspace_secrets` table migration and the `get_hubspot_configured` RPC, or rewrite the check to query `workspaces.settings` JSONB where HubSpot config may already be stored.

### 🟡 FUNC-11 — Free-Tier Admin-Granted Credits Blocked at Client Level
- **File:** `src/hooks/usePlanLimits.ts`
- **Root Cause:** `canSendEmail()` and `canUseAI()` check `plan === 'free'` and return `false` unconditionally, before checking the credit balance. Even if an admin manually grants credits to a free-tier user, they cannot use email or AI features.
- **Impact:** Admin credit grants for free users are functionally useless. The UI blocks the action regardless of credit balance.
- **Fix:** Change the logic to `credits > 0` check first; only hard-block if both `plan === 'free'` AND `credits === 0`.

### 🟡 FUNC-12 — Analytics Charts Show Static Placeholder Data
- **File:** `src/pages/AnalyticsPage.tsx`
- **Root Cause:**
  - `engagementData` — a hardcoded monthly array with static engagement rate numbers; never computed from real data.
  - `topNiches` — hardcoded array with fixed ROI percentages (Fashion 847%, Beauty 623%, etc.).
  - `tracking_links` and `campaign_metrics` tables are queried via `supabase as any` but these tables do not exist in migrations, so those queries silently return empty arrays.
- **Impact:** The Engagement Rate chart and Top Niches ROI panel are entirely fictional. Click tracking and campaign metrics are never shown.
- **Fix:**
  - Compute engagement rate from `influencers_cache` or `pipeline_cards` data that is already queried on the page.
  - Compute niche ROI from campaigns + pipeline_cards `agreed_rate` grouped by niche.
  - Create `tracking_links` and `campaign_metrics` migrations or remove those queries.

---

## 4. Hardcoded Placeholder Data

The following are clearly labelled because they are presentation-level issues rather than broken logic, but they affect product trust:

| Location | What Is Hardcoded | Should Be |
|---|---|---|
| `src/pages/Index.tsx` | "4.2M" Impressions, "847%" Avg. ROI, entire 5-item activity feed | Computed from `pipeline_cards`, `campaigns`, and `campaign_activity` tables |
| `src/pages/AnalyticsPage.tsx` | `engagementData` monthly chart, `topNiches` ROI list | Derived from real influencer and campaign data |
| `src/pages/admin/AdminDashboard.tsx` | "99.9%" Platform Health, all "Operational" status badges | Real health check endpoints |
| `src/pages/BillingPage.tsx` | `invoices` array (4 fake entries at top of file) | Real data from `payments` table or Stripe API |
| `src/pages/Settings.tsx` | `sessions` array ("Chrome · macOS", "Safari · iPhone") | `supabase.auth` session list |

---

## 5. Missing Database Tables

The following tables are referenced in frontend code or edge functions but have **no corresponding `CREATE TABLE` statement in any migration file**:

| Table | Referenced In | Impact |
|---|---|---|
| `payments` | `BillingPage.tsx`, `generate-invoice` (commented) | Payment history always empty; invoice generator broken |
| `tracking_links` | `AnalyticsPage.tsx`, `track-click` edge function | Click tracking silently fails |
| `campaign_metrics` | `AnalyticsPage.tsx` | Campaign performance metrics never populated |
| `workspace_secrets` | `IntegrationsTab.tsx`, `sync-hubspot` | HubSpot API key storage broken |
| `tax_documents` | `CompliancePanel.tsx` | W-9 upload silently fails |

> **Note:** `agreed_rate` column on `pipeline_cards` **does exist** in the migration (`20260226_admin_rbac.sql` line 226). The issue with Campaign Compare is that the Supabase query in `usePipelineCards` does not SELECT it — a query fix is needed, not a migration.

---

## 6. Confirmed Working Features

The following features were verified by reading all relevant code paths end-to-end:

| Feature | Components / Hooks | Status |
|---|---|---|
| Sign in / Sign up / Google OAuth | `Auth.tsx`, `AuthContext.tsx` | ✅ Working |
| Email verification gate | `AuthContext.tsx` | ✅ Working |
| Password reset + update | `Auth.tsx`, `UpdatePassword.tsx`, `AuthContext.updatePassword` | ✅ Working |
| Onboarding flow | `Onboarding.tsx` → `update_workspace_settings` RPC | ✅ Working |
| Influencer search | `SearchPage.tsx` → `search-influencers` edge fn | ✅ Working |
| Search filters (platform, niche, follower range) | `SearchPage.tsx` URL params | ✅ Working |
| Save / delete saved searches | `useSavedSearches.ts` | ✅ Working |
| Search history timeline | `HistoryPage.tsx` | ✅ Working |
| Add to list from search | `SearchPage.tsx` → `useInfluencerLists` | ✅ Working |
| Add to campaign from search | `SearchPage.tsx` → `useCampaigns` | ✅ Working |
| Influencer profile enrichment | `InfluencerProfilePage.tsx` → `enrich-influencer` edge fn | ✅ Working |
| AI influencer evaluation | `useInfluencerEvaluation.ts` → `ai-insights (evaluate)` | ✅ Working |
| Follower history chart | `InfluencerProfilePage.tsx` | ✅ Working |
| Campaign CRUD | `CampaignsPage.tsx` → `useCampaigns` | ✅ Working |
| Kanban board (drag, move, bulk ops) | `KanbanBoard.tsx` → `usePipelineCards` | ✅ Working |
| Agreed rate edit on cards | `CardDetailDialog.tsx` → `usePipelineCards.updateCard` | ✅ Working |
| Send individual outreach email | `SendEmailDialog.tsx` → `send-outreach-email` edge fn | ✅ Working |
| Bulk email per stage | `KanbanBoard.tsx` → `send-outreach-email` edge fn | ✅ Working |
| Fraud check per stage | `KanbanBoard.tsx` → `ai-insights (fraud-check)` | ✅ Working |
| Campaign report PDF view | `CampaignReport.tsx` | ✅ Working |
| AI campaign insights | `AIInsightsPanel.tsx` → `ai-insights (summarize/recommend)` | ✅ Working |
| Lists CRUD | `ListsPage.tsx` → `useInfluencerLists` | ✅ Working |
| List item notes (updateNotes) | `ListDetailPage.tsx` → `useInfluencerLists.updateNotes` | ✅ Working |
| Lists → Campaign pipeline add | `ListDetailPage.tsx` | ✅ Working |
| Subscription checkout | `BillingPage.tsx` → `create-checkout` edge fn | ✅ Working |
| Customer portal (manage plan) | `BillingPage.tsx` → `customer-portal` edge fn | ✅ Working |
| Subscription status display | `useSubscription.ts` → `check-subscription` edge fn | ✅ Working |
| Workspace credit display | `useWorkspaceCredits.ts` → `workspaces.credits` | ✅ Working |
| Profile save (name, avatar) | `Settings.tsx` → `profiles` table | ✅ Working |
| Password change | `Settings.tsx` → `AuthContext.updatePassword` | ✅ Working |
| Outreach email defaults save | `Settings.tsx` → `update_workspace_settings` RPC | ✅ Working |
| Email template manager | `useEmailTemplates.ts` | ✅ Working |
| Admin user list | `AdminUsers.tsx` → `admin-list-users` edge fn | ✅ Working |
| Admin suspend / unsuspend | `AdminUsers.tsx` → `admin-suspend-user` edge fn | ✅ Working |
| Admin credit adjust | `AdminUsers.tsx` → `admin-adjust-credits` edge fn | ✅ Working |
| Admin promote user | `AdminUsers.tsx` → `admin-promote-user` edge fn | ✅ Working |
| Admin KPI cards | `AdminDashboard.tsx` → direct Supabase queries | ✅ Working |
| Data export (JSON) | `DataManagement.tsx` → local JS export | ✅ Working |
| Delete account | `DataManagement.tsx` → `delete-account` edge fn | ✅ Working (has SEC-07/08 issues) |
| Zapier / Slack / Google Sheets webhook save | `IntegrationsTab.tsx` → `workspaces.settings` JSONB | ✅ Working |
| Plan limit enforcement (search credits) | `usePlanLimits.ts` | ✅ Working |
| Error boundary | `AppErrorBoundary.tsx` | ✅ Working |

---

## 7. Fix Priority Matrix

### Immediate (Blocking user trust / data integrity)

| ID | Issue | Effort |
|----|-------|--------|
| FUNC-03 | 2FA toggle does nothing — security-trust violation | Medium |
| FUNC-01 | Payment history always empty (`payments` table missing) | Medium |
| FUNC-02 | Invoice download generates wrong data | Small |
| FUNC-05 | Saved search re-run loses city filter (`location` vs `city` param) | **Tiny — 1 line fix** |
| SEC-01 | Stored XSS in public profile generator | Small |
| SEC-02 | Open redirect in track-click | **Tiny** |
| SEC-03 | No webhook signature verification | Small |

### High Priority (Data correctness / credit fairness)

| ID | Issue | Effort |
|----|-------|--------|
| FUNC-06 | Campaign Compare "Spent" always $0 (add `agreed_rate` to SELECT) | **Tiny — 1 line fix** |
| FUNC-07 | Admin dashboard Recent Activity always empty | Small |
| FUNC-12 | Analytics charts show static fake data | Medium |
| SEC-04 | Race condition on credit deduction | Medium |
| SEC-05 | Credits deducted on cache hits | Small |
| SEC-07 | Non-owner members can delete workspace | Small |
| SEC-08 | Stripe subscription not cancelled on delete | Small |
| SEC-09 | Negative credits possible | **Tiny** |

### Medium Priority (Feature completion / UX trust)

| ID | Issue | Effort |
|----|-------|--------|
| FUNC-04 | Sessions list shows fake data | Medium |
| FUNC-08 | Admin system status hardcoded | Medium |
| FUNC-09 | Compliance tax document upload mocked | Large |
| FUNC-10 | HubSpot integration never shows as configured | Medium |
| FUNC-11 | Free-tier admin-granted credits blocked at client | **Tiny** |
| SEC-06 | Rate limit bypass via spoofed IP | Small |
| SEC-10 | Rate limiter fails open on Redis down | Small |
| SEC-11 | Email header injection | Small |
| SEC-12 | Fabricated proxy emails in HubSpot | Small |
| SEC-13 | Audit log wrong column name | **Tiny** |

### Low Priority / Polish

| ID | Issue | Effort |
|----|-------|--------|
| Dashboard hardcoded impressions/ROI/activity | Connect to real DB queries | Medium |
| BillingPage hardcoded invoice rows | Remove or connect to `payments` table | Small |
| Settings hardcoded sessions | Implement real session list | Medium |
| SEC-14 | Remove `@ts-nocheck` from edge functions | Small |
| SEC-15 | Reduce stale window for admin permissions | **Tiny** |
| SEC-16 | Remove dead DB query in search | **Tiny** |
| SEC-17 | Export returns all workspace data to members | Small |

---

## Quick Wins (Fix in < 30 minutes each)

These are one-line or near-trivial fixes with high impact:

```typescript
// FUNC-05 — SavedSearchesPage.tsx: change "location" → "city"
params.set("city", filters.location);   // was: params.set("location", filters.location)

// FUNC-06 — usePipelineCards.ts: add agreed_rate to SELECT
.select("id, username, platform, stage_id, email, notes, agreed_rate, ...")

// SEC-02 — track-click/index.ts: validate URL scheme
if (!url.startsWith("https://") && !url.startsWith("http://")) {
  return new Response("Invalid redirect", { status: 400 });
}

// SEC-09 — admin-adjust-credits or workspaces table
newCredits = Math.max(0, newCredits);

// SEC-13 — search-influencers audit log
admin_user_id: userId,   // was: user_id: userId

// SEC-15 — useAdminPermissions.ts
staleTime: 10_000,   // was: 60_000
gcTime: 10_000,      // was: 60_000

// FUNC-11 — usePlanLimits.ts
canSendEmail: () => credits > 0,   // remove the plan === 'free' hard-block
```

---

*Report covers: 8 migration files, 33 edge functions, 25 pages, 15 hooks, and 40+ components.*
