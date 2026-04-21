# MUSHIN Platform — Full System Audit & Redesign Architecture
**Date:** 2026-04-20  
**Scope:** Complete codebase audit, security review, architecture redesign plan

---

## 1. CODEBASE MAP

### Stack
| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Routing | React Router v6 |
| State | TanStack Query v5 |
| Animation | Framer Motion |
| Backend | Supabase (Auth, Postgres, Edge Functions, RLS) |
| Analytics | PostHog, Sentry, Vercel Analytics + Speed Insights |
| Payments | Paddle (partial implementation) |

### Frontend Routes
```
PUBLIC:     /  /login  /signup  /auth  /blog  /about  /privacy  /terms
            /cookies  /subscription  /eula  /dpa  /sla  /aup  /nda  /msa
PROTECTED:  /dashboard  /search  /lists  /lists/:id  /campaigns  /campaigns/*
            /saved-searches  /history  /onboarding  /settings  /billing
            /analytics  /influencer/:platform/:username
ADMIN:      /admin/login  → /admin  /admin/users  /admin/subscriptions
            /admin/credits  /admin/content  /admin/analytics  /admin/config
            /admin/audit-log  /admin/announcements  /admin/permissions  /admin/support
SUPPORT:    /support/login  /support/dashboard
```

### Component Architecture
```
App.tsx
├── AuthProvider (AuthContext)
├── ProtectedRoute (checks user session)
├── AdminRoute (checks user_roles table)
├── SupportRoute (checks support role)
├── AppLayout → AppSidebar + main content
└── AdminLayout → AdminSidebar + main content
```

---

## 2. SECURITY AUDIT

### CRITICAL Issues
| Severity | Issue | Location | Remediation |
|---|---|---|---|
| 🔴 CRITICAL | `.env` file committed to repository | Root | Move to .env.local, regenerate all keys |
| 🔴 CRITICAL | Supabase anon key exposed in client | `supabase/client.ts` | Expected for Supabase, but RLS must be airtight |
| 🟡 HIGH | Admin role check done client-side before server-side redirect | `AdminRoute.tsx` | Edge function must re-verify role on every privileged call |
| 🟡 HIGH | No rate limiting on auth attempts in UI | `sign-in-card-2.tsx` | Supabase handles this, but add Turnstile CAPTCHA (dependency exists) |
| 🟡 HIGH | Admin and user share same Supabase auth pool | `AdminLogin.tsx` | Acceptable if RLS is enforced server-side; add server-side role assertion |
| 🟠 MEDIUM | No CSRF protection on admin state-mutating calls | Edge functions | Add CSRF tokens or Origin validation |
| 🟠 MEDIUM | PostHog and Sentry not disclosed prominently in Privacy Policy | Privacy policy | Disclose explicitly with opt-out mechanism |
| 🟠 MEDIUM | No Content-Security-Policy headers | Vercel config | Add CSP via vercel.json headers |

### Positive Security Findings
- RLS policies present (`supabase-security-hardening.test.ts` exists)
- `user_roles` table used for admin gating (not just profile metadata)
- Supabase edge functions used for privileged admin operations (correct pattern)
- Soft-delete pattern partially implemented

---

## 3. PERFORMANCE AUDIT

### Critical GPU Compositor Issues Identified
| Component | Issue | Impact |
|---|---|---|
| `sign-in-card-2.tsx` | 4+ animated `backdrop-blur` layers + animated blobs | HIGH GPU |
| `AdminLogin.tsx` | Same pattern as above + animated border beams | HIGH GPU |
| `LandingHero.tsx` | Multiple blur elements + CSS conic animations | HIGH GPU |
| `AuroraBackground.tsx` | Layer compositing issues | MEDIUM GPU |

### Remediation (Done in this redesign)
- Auth pages: Remove backdrop-blur entirely, replace with static CSS gradients
- Landing: Simplify to canvas-only background, remove animated DOM blobs
- Admin: Pure CSS transitions only, no Framer Motion in table rows

---

## 4. DESIGN SYSTEM GAPS

### Current State
- **App interior:** Dark background + purple accent (inconsistent)
- **Auth pages:** Purple gradient blobs (heavy, slow)
- **Typography:** Roboto body + Syne display (generic)
- **Admin:** Same purple accent as app

### Target State (per spec)
- **Landing + Auth:** Black/dark background + purple accent ONLY
- **App interior:** Pure black & white — NO purple
- **Admin:** Black & white — monochrome authority aesthetic
- **Typography:** Outfit (UI) + JetBrains Mono (data/code)

---

## 5. ADMIN CONTROL PLANE AUDIT

### Exists (Partial Implementation)
- ✅ `AdminDashboard` — KPI cards (users, active subs, workspaces)
- ✅ `AdminUsers` — List, suspend/unsuspend, role promote
- ✅ `AdminCredits` — View workspace credits, adjust via edge functions
- ✅ `AdminAuditLog` — Page exists (content unknown/stub)
- ✅ `AdminSubscriptions` — Exists
- ✅ Edge functions: `admin-list-users`, `admin-suspend-user`, `admin-adjust-credits`, `admin-promote-user`

### Missing / Incomplete
- ❌ Credit ledger (event-sourced) — current system stores balance directly in `workspaces` table
- ❌ Force password reset
- ❌ Session/API key revocation
- ❌ Rate limiting dashboard
- ❌ Abuse detection alerts
- ❌ Backup/recovery UI
- ❌ Immutable audit log (currently mutable if using regular table)

---

## 6. BILLING AUDIT

### Current State
- Paddle integration guide exists (`PADDLE_INTEGRATION_GUIDE.md`)
- `useSubscription` hook queries `subscriptions` table
- `PaymentsPanel` component exists
- Webhook handling: unknown (likely edge function)

### Required
- Paddle webhook verification (HMAC signature check)
- Ledger-based credit allocation on subscription events
- Billing history per user
- Cancellation/renewal handling

---

## 7. NEW DATABASE SCHEMA

### 7.1 Credit Ledger (Event-Sourced)
See: `supabase/migrations/001_credit_ledger.sql`

Replace direct balance columns in `workspaces` with event ledger.
Balance is always computed as `SUM(delta) WHERE workspace_id = ?`.

### 7.2 Immutable Audit Log
See: `supabase/migrations/002_audit_logs.sql`

Row-level append-only enforced via RLS policy + Postgres trigger.
No UPDATE or DELETE allowed via RLS even for super_admin.

### 7.3 RBAC Refinement
See: `supabase/migrations/003_rbac.sql`

Roles: `super_admin > admin > support > viewer > user`
Single `user_roles` table, no duplication in profiles.

---

## 8. REDESIGN FILE MANIFEST

| File | Status | Change |
|---|---|---|
| `src/index.css` | ✏️ REDESIGN | New design system: Outfit + JetBrains Mono, B&W app |
| `src/pages/Auth.tsx` | ✏️ REBUILD | Clean, fast, no blur — purple accent only |
| `src/pages/AdminLogin.tsx` | ✏️ REBUILD | Unified with Auth, admin indicator only |
| `src/pages/admin/AdminDashboard.tsx` | ✏️ REBUILD | B&W, credit ledger view, live stats |
| `src/pages/admin/AdminUsers.tsx` | ✏️ REBUILD | B&W table, full actions panel |
| `src/pages/admin/AdminCredits.tsx` | ✏️ REBUILD | Ledger view, transaction history |
| `src/components/admin/AdminSidebar.tsx` | ✏️ REBUILD | B&W monochrome sidebar |
| `supabase/migrations/001_credit_ledger.sql` | 🆕 NEW | Event-sourced credit ledger |
| `supabase/migrations/002_audit_logs.sql` | 🆕 NEW | Immutable append-only audit log |
| `supabase/migrations/003_rbac.sql` | 🆕 NEW | RBAC hardening |

---

## 9. THIRD-PARTY DISCLOSURE REQUIREMENTS

The following services are in use and MUST be disclosed in the Privacy Policy:

| Service | Purpose | Opt-out Required |
|---|---|---|
| **Supabase** | Database, Auth, Storage | No (data processor, include in DPA) |
| **PostHog** | Product analytics, pageview tracking | Yes (EU users) |
| **Sentry** | Error monitoring + crash reporting | Recommended |
| **Vercel Analytics** | Web performance monitoring | Recommended |
| **Vercel Speed Insights** | Core Web Vitals | Recommended |
| **Paddle** | Payment processing | No (payment processor, include in DPA) |
| **Cloudflare Turnstile** | CAPTCHA / bot protection | No |

---

## 10. LEGAL DOCUMENT STATUS

All 10 required legal documents exist as pages. Verify content accuracy:
- [ ] ToS: Confirm Paddle (not Stripe) referenced
- [ ] Privacy Policy: Add PostHog + Sentry + Vercel disclosure
- [ ] DPA: Add Supabase + Paddle as sub-processors
- [ ] AUP: Ensure scraping prohibition is explicit

---

## IMPLEMENTATION PRIORITY

1. **P0 — Security:** Rotate all leaked env vars, enforce RLS
2. **P1 — Database:** Deploy credit ledger + audit log migrations
3. **P2 — Auth UI:** Deploy new clean login (performance critical)
4. **P3 — Design System:** Deploy new CSS (B&W app interior)
5. **P4 — Admin:** Deploy rebuilt admin dashboard + user controls
6. **P5 — Legal:** Update Privacy Policy with third-party disclosures
