# MUSHIN Redesign Package
**Generated:** 2026-04-20

This package contains all files produced in the system-level redesign audit.
Apply them in order following the priority sequence below.

---

## Priority 0 — Security (Do First)

**CRITICAL: Rotate all environment variables.**
The `.env` file was committed to the repository. Rotate immediately:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- Supabase service role key
- PostHog API key
- Sentry DSN
- Paddle credentials

Add `.env` and `.env.local` to `.gitignore` if not already present.

---

## Priority 1 — Database Migrations

Run migrations **in order** against your Supabase project:

```bash
# Via Supabase CLI
supabase db push

# Or manually in SQL editor — run these in order:
supabase/migrations/001_credit_ledger.sql   # Credit ledger (event-sourced)
supabase/migrations/002_audit_logs.sql      # Immutable audit log
supabase/migrations/003_rbac.sql            # RBAC hardening
```

**IMPORTANT after running 001:** The seed block at the bottom of `001_credit_ledger.sql`
migrates existing balances from `workspaces.search_credits_remaining` etc. into the ledger.
Adjust column names if your schema differs.

After migration, update all credit reads/writes:
- Replace direct `workspaces.search_credits_remaining` reads with `workspace_credit_balances` view
- Replace direct credit mutations with calls to `debit_credits()` or `allocate_credits()` functions

---

## Priority 2 — Design System

Replace `src/index.css` with `src/index.css` from this package.

**Font change:** Roboto → Outfit, Syne removed, JetBrains Mono added.
Update `index.html` Google Fonts preconnect accordingly:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

---

## Priority 3 — Auth Pages

Replace these files:
```
src/pages/Auth.tsx       → src/pages/Auth.tsx (this package)
src/pages/AdminLogin.tsx → src/pages/AdminLogin.tsx (this package)
```

**What changed:**
- Removed `backdrop-blur` from all auth elements (GPU fix)
- Removed animated blobs/beams (GPU compositor layer fix)
- Removed 3D card tilt effect (complexity/performance)
- Single static radial gradient background (CSS only, no render cost)
- Auth and Signup now coexist in one component (state toggle)
- AdminLogin now checks both `super_admin` AND `admin` roles (was super_admin only)
- Added `.theme-auth` class on auth pages to scope purple accent
- Google sign-in button remains prominent

---

## Priority 4 — Admin Control Plane

Replace these files:
```
src/components/admin/AdminSidebar.tsx      → (this package)
src/pages/admin/AdminDashboard.tsx         → (this package)
src/pages/admin/AdminUsers.tsx             → (this package)
src/pages/admin/AdminCredits.tsx           → (this package)
src/pages/admin/AdminAuditLog.tsx          → (this package)
```

**New edge functions required** (implement in `supabase/functions/`):
- `admin-force-password-reset` — calls `supabase.auth.admin.generateLink({ type: 'recovery', ... })`
- `admin-revoke-sessions` — calls `supabase.auth.admin.signOut(userId, 'others')`

AdminCredits now reads from `workspace_credit_balances` view (from migration 001).
AdminAuditLog reads from `audit_logs` table (from migration 002).

---

## Priority 5 — Legal / Privacy

Open `src/pages/PrivacyAddendum.ts` and merge the content into your `PrivacyPage.tsx`:

1. Add the analytics disclosure section (PostHog, Sentry, Vercel, Cloudflare, Supabase, Paddle)
2. Add the sub-processor table to your DPA page
3. Link "Cookie Preferences" in your app footer

---

## File Manifest

| File | Description |
|---|---|
| `MUSHIN_SYSTEM_AUDIT.md` | Complete audit findings & architecture plan |
| `supabase/migrations/001_credit_ledger.sql` | Event-sourced credit ledger + migration |
| `supabase/migrations/002_audit_logs.sql` | Immutable audit log + triggers |
| `supabase/migrations/003_rbac.sql` | RBAC hardening, suspensions, session revocation |
| `src/index.css` | New B&W design system, Outfit + JetBrains Mono |
| `src/pages/Auth.tsx` | Clean auth page — no blur, fast loading |
| `src/pages/AdminLogin.tsx` | Clean admin login — no blur, red accent |
| `src/components/admin/AdminSidebar.tsx` | B&W monochrome sidebar |
| `src/pages/admin/AdminDashboard.tsx` | Rebuilt dashboard with live stats + audit feed |
| `src/pages/admin/AdminUsers.tsx` | Full user control: suspend/role/reset/revoke |
| `src/pages/admin/AdminCredits.tsx` | Ledger view + adjust dialog + history drawer |
| `src/pages/admin/AdminAuditLog.tsx` | Immutable log viewer with filters + export |
| `src/pages/PrivacyAddendum.ts` | Privacy policy third-party disclosure additions |

---

## Design System Summary

| Context | Background | Primary | Typography |
|---|---|---|---|
| App interior | `#080808` | **White** | Outfit |
| Admin panel | `#020202` | **White** | Outfit + JetBrains Mono |
| Landing page | `#000` | **Purple** (existing, simplified) | Outfit |
| Auth pages | `#000` + static gradient | **Purple** | Outfit |

**Purple is restricted to:** landing page and auth/login pages only.
Admin and app interior are strictly monochrome black/white.

---

## Component Class Reference (new CSS)

```css
.app-card             /* Base card */
.app-card-interactive /* Hoverable card */
.admin-row            /* Table row */
.stat-num             /* Monospace stat number */
.badge-neutral        /* Base badge */
.badge-active         /* Green badge */
.badge-warning        /* Amber badge */
.badge-danger         /* Red badge */
.input-sharp          /* App input */
.btn-primary          /* White/black button */
.btn-secondary        /* Ghost button */
.btn-danger           /* Red ghost button */
.auth-input           /* Auth page input */
.auth-btn             /* Purple CTA */
.auth-btn-google      /* Google button */
.section-header       /* Page header row */
.section-title        /* H1 style */
.section-subtitle     /* Subtitle style */
.mono                 /* JetBrains Mono */
.stat-num             /* Tabular numbers */
```
