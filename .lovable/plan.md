

# Phase 9: Landing Page, Feature Gating, and Production Readiness

This plan covers all remaining work to make InfluenceIQ market-ready. After reviewing the codebase, many features from the backlog are already implemented. This plan focuses on what is genuinely missing.

---

## What Is Already Done (No Work Needed)

- Authentication: sign up, sign in, Google OAuth, email verification with resend, password reset, profile error retry
- Onboarding: 3-step flow with consent timestamp, pre-fill from profile, redirect guard
- Search: soft ranking (3-tier), 100 results from Serper, URL filtering, platform domain validation
- AI features: summary generation, fraud check with structured scoring, campaign recommendations -- all via a single `ai-insights` edge function using Lovable AI
- Email templates: CRUD in Settings > Outreach with variable substitution
- Billing: Stripe checkout, customer portal, subscription checking, plan limits hook
- Integrations: Zapier/Slack/HubSpot/Sheets webhook config in Settings
- Analytics: cross-campaign dashboard with Recharts charts
- Campaign reports: print-friendly PDF layout
- Data management: GDPR export and account deletion
- Edge functions: search-influencers, ai-insights, send-outreach-email, sync-hubspot, delete-account, check-subscription, create-checkout, customer-portal

---

## Batch 1: Public Landing Page and Routing

### Routing Changes

- Create `src/pages/LandingPage.tsx` as the public marketing homepage at `/`
- Move the current authenticated dashboard from `/` to `/dashboard`
- In `App.tsx`: `/` renders LandingPage (no auth wrapper), `/dashboard` renders the existing `Index` component inside `ProtectedPage`
- Update `AppSidebar.tsx` nav items: change Dashboard path from `/` to `/dashboard`
- Update `Auth.tsx` redirect: change `navigate("/")` to `navigate("/dashboard")`
- Update `Onboarding.tsx` redirect: change `navigate("/")` to `navigate("/dashboard")`
- In `LandingPage.tsx`: if user is logged in (check via `useAuth`), show "Go to Dashboard" instead of "Start Free"

### Landing Page Sections

All sections use the existing dark "Data Cockpit" design system (aurora gradients, glass-morphism, framer-motion animations).

1. **Hero**: headline, subheadline, CTAs ("Start Free" links to `/auth`, "See How It Works" smooth scrolls), animated aurora background using existing `AuroraBackground` component
2. **Trust Signals**: logo cloud with placeholder brand SVGs, animated counters
3. **Problem/Solution**: two-column layout with animated cards
4. **How It Works**: 3 steps with icons (Search, Analyze, Contact)
5. **Feature Highlights**: 6-card grid with scroll-triggered animations via `framer-motion` `whileInView`
6. **Pricing Preview**: 3 cards using the existing `PLANS` constant from `src/lib/plans.ts`
7. **Security and Compliance**: icons with text (GDPR, Stripe, SOC2)
8. **Final CTA**: gradient background, "Get Started Free" button
9. **Footer**: product links, company, legal, social icons

### Files

| Action | File |
|--------|------|
| Create | `src/pages/LandingPage.tsx` |
| Modify | `src/App.tsx` (routing) |
| Modify | `src/components/layout/AppSidebar.tsx` (Dashboard path) |
| Modify | `src/pages/Auth.tsx` (redirect to `/dashboard`) |
| Modify | `src/pages/Onboarding.tsx` (redirect to `/dashboard`) |

---

## Batch 2: Free Tier Blur on Search Results

### Implementation

- In `SearchPage.tsx`, import `useWorkspaceCredits` (already imported) and check `workspaceCredits?.plan`
- After results render, if `plan === 'free'`, wrap each result card with a relative container that adds:
  - `filter: blur(4px)` and `pointer-events: none` on the card content
  - An absolute glass overlay with a lock icon and "Upgrade to Unlock" button linking to `/billing`
- Add a top banner: "You're on the Free plan. Upgrade to see full influencer profiles."
- Free users can still search (credits are consumed) but cannot read the detailed results

### Files

| Action | File |
|--------|------|
| Modify | `src/pages/SearchPage.tsx` |

---

## Batch 3: Feature Gating and Credit Deduction

### Frontend Gating

Wire the existing `usePlanLimits` hook into these components:

| Component | Gate |
|-----------|------|
| `CampaignsPage.tsx` | Disable "New Campaign" button when `canCreateCampaign()` returns false; show upgrade toast |
| `SendEmailDialog.tsx` | Check `canSendEmail()` before sending; show upgrade prompt if exhausted |
| `CardDetailDialog.tsx` | Check `canUseAI()` before AI Summary and Fraud Check buttons |
| `AIInsightsPanel.tsx` | Check `canUseAI()` before generating recommendations |

Each gate shows a toast with message and link to `/billing`.

### Backend Credit Deduction

**send-outreach-email**: Before sending, query `workspaces.email_sends_remaining` via service role. If 0, return 402. After successful send, decrement by 1.

**ai-insights**: Before calling AI gateway, query `workspaces.ai_credits_remaining` via service role. If 0, return 402. After successful response, decrement by 1.

### Files

| Action | File |
|--------|------|
| Modify | `src/pages/CampaignsPage.tsx` |
| Modify | `src/components/campaigns/SendEmailDialog.tsx` |
| Modify | `src/components/campaigns/CardDetailDialog.tsx` |
| Modify | `src/components/campaigns/AIInsightsPanel.tsx` |
| Modify | `supabase/functions/send-outreach-email/index.ts` |
| Modify | `supabase/functions/ai-insights/index.ts` |

---

## Batch 4: Bulk Email and Batch Fraud Check

### Bulk Email

- Create `src/components/campaigns/BulkEmailDialog.tsx`
- In `KanbanBoard.tsx`, when `selectMode` is active and cards are selected, add a "Send Email" button in the bulk action bar (next to existing Move and Remove buttons)
- `BulkEmailDialog` shows a template selector (using `useEmailTemplates`), sends emails sequentially to all selected cards via `send-outreach-email`, substitutes variables per card, shows progress counter and summary toast

### Batch Fraud Check

- In `KanbanBoard.tsx`, add a "Fraud Check" option in each stage's dropdown menu (alongside Rename, Change Color, Delete)
- Clicking it runs `runFraudCheck` from `useAIInsights` for each card in that stage sequentially
- Stores results in each card's `data` JSONB field under `ai_fraud_check` key via `updateCard`
- Shows progress toast ("Checking 3/10...") and final summary

### Files

| Action | File |
|--------|------|
| Create | `src/components/campaigns/BulkEmailDialog.tsx` |
| Modify | `src/components/campaigns/KanbanBoard.tsx` |

---

## Batch 5: Email Tracking and CSV Export

### Email Open/Click Tracking

- Database migration: add `opened_at TIMESTAMPTZ` and `clicked_at TIMESTAMPTZ` columns to `outreach_log`
- Create `supabase/functions/email-webhook/index.ts`: public endpoint (no JWT) that receives Resend webhook events, validates them, and updates the corresponding `outreach_log` record
- Register in `supabase/config.toml` with `verify_jwt = false`
- In `CardDetailDialog.tsx` outreach history section, show open/click status badges next to each outreach entry

### Campaign Comparison CSV Export

- In `CampaignComparePage.tsx`, add an "Export CSV" button
- Generates a CSV from the comparison table data (campaign names, stats, stage counts) and triggers browser download via `Blob` and `URL.createObjectURL`

### Files

| Action | File |
|--------|------|
| Migration | Add columns to `outreach_log` |
| Create | `supabase/functions/email-webhook/index.ts` |
| Modify | `supabase/config.toml` |
| Modify | `src/components/campaigns/CardDetailDialog.tsx` |
| Modify | `src/pages/CampaignComparePage.tsx` |

---

## Implementation Order

1. Batch 1 -- Landing page and routing (largest visual impact, marketing-critical)
2. Batch 2 -- Free tier blur (drives conversions)
3. Batch 3 -- Feature gating and credit deduction (billing integrity)
4. Batch 4 -- Bulk email and batch fraud (power-user features)
5. Batch 5 -- Email tracking and CSV export (polish)

---

## Technical Notes

- No new dependencies needed; framer-motion and recharts are already installed
- All landing page animations use CSS `transform` and `opacity` via framer-motion `whileInView` for GPU acceleration
- The landing page imports no authenticated components or hooks (except optionally `useAuth` to detect logged-in state for CTA text)
- Credit deduction in edge functions uses the service role client for atomic writes
- The email-webhook function is public (Resend calls it directly) and validates webhook signatures

