

# Phase 6: Stripe Billing Integration

## Overview

Add tiered subscription plans with usage-based credits via Stripe. Users can upgrade from a free plan to paid tiers (Pro, Business) that unlock higher credit limits, more campaigns, and premium features. Credits reset monthly based on the active plan.

---

## 6.1 Plan Tiers

| Feature | Free | Pro ($29/mo) | Business ($79/mo) |
|---|---|---|---|
| Search credits / month | 50 | 500 | 2,000 |
| Enrichment credits / month | 10 | 100 | 500 |
| Campaigns | 3 | Unlimited | Unlimited |
| Email sends / month | 20 | 500 | 2,000 |
| AI insights | 5 / month | 100 / month | Unlimited |
| Team members | 1 | 3 | 10 |
| Priority support | -- | -- | Yes |

---

## 6.2 Stripe Setup

### Enable Stripe Integration

Use Lovable's built-in Stripe integration tool to connect the user's Stripe account and create the products/prices.

### Products and Prices to Create

- **InfluenceIQ Pro** -- $29/month recurring
- **InfluenceIQ Business** -- $79/month recurring

---

## 6.3 Database Changes

### New Table: `subscriptions`

```sql
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free',  -- 'free', 'pro', 'business'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'past_due', 'trialing'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

RLS: Workspace members can SELECT; workspace owners can UPDATE.

### Modify `workspaces` Table

Add columns to support plan-based credit limits:

```sql
ALTER TABLE public.workspaces
  ADD COLUMN plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN email_sends_remaining INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN ai_credits_remaining INTEGER NOT NULL DEFAULT 5;
```

---

## 6.4 Edge Functions

### `stripe-webhook` (new)

Handles Stripe webhook events:
- `checkout.session.completed` -- Activate subscription, set plan on workspace, reset credits to plan limits
- `customer.subscription.updated` -- Plan changes (upgrade/downgrade), update credit limits
- `customer.subscription.deleted` -- Revert to free plan, reset credits to free limits
- `invoice.payment_failed` -- Mark subscription as `past_due`

### `create-checkout` (new)

Creates a Stripe Checkout session for a given price ID. Returns the checkout URL. Validates workspace ownership.

### `create-portal` (new)

Creates a Stripe Customer Portal session so users can manage their subscription, update payment method, or cancel. Returns the portal URL.

### `reset-credits` (handled by webhook)

When a new billing period starts (`invoice.paid`), reset all credits to the plan's limits.

---

## 6.5 New Hook: `useSubscription`

```typescript
// src/hooks/useSubscription.ts
- Fetches subscription data from `subscriptions` table
- `checkout(priceId)` -- calls create-checkout edge function, redirects to Stripe
- `openPortal()` -- calls create-portal edge function, redirects to Stripe portal
- Plan comparison helpers (isPro, isBusiness, canAccessFeature)
```

---

## 6.6 Billing Page UI

### New Page: `src/pages/BillingPage.tsx`

- Route: `/billing`
- Shows current plan with a badge
- Pricing cards for Free / Pro / Business with feature comparison
- "Upgrade" buttons that trigger Stripe Checkout
- "Manage Subscription" button for existing subscribers (opens Stripe Portal)
- Current credit usage breakdown (search, enrichment, email, AI)
- Next billing date and renewal info

### Sidebar Update

Add "Billing" nav item with a `CreditCard` icon between Settings and the credits section. Update the credits widget to show plan name and link to billing page.

---

## 6.7 Feature Gating

### `src/hooks/usePlanLimits.ts` (new)

Returns plan-based limits and checks:
- `canCreateCampaign()` -- Free plan: max 3
- `canSendEmail()` -- checks email_sends_remaining
- `canUseAI()` -- checks ai_credits_remaining
- `getLimit(feature)` -- returns the max for the current plan

### Integration Points

- **CampaignsPage**: Show upgrade prompt when campaign limit is reached
- **SendEmailDialog**: Check email credits before sending; show upgrade prompt if exhausted
- **AI Insights**: Check AI credits before calling; show upgrade prompt if exhausted
- **SearchPage**: Already gated by search_credits_remaining; update limits per plan
- **Settings page**: Show plan badge

---

## 6.8 Credit Deduction Updates

### Modify existing edge functions

- `send-outreach-email`: Deduct from `email_sends_remaining`, log to `credits_usage`
- `ai-insights`: Deduct from `ai_credits_remaining`, log to `credits_usage`
- `search-influencers`: Already deducts search credits; update max per plan

---

## Files Summary

| File | Action |
|---|---|
| `supabase/functions/create-checkout/index.ts` | Create |
| `supabase/functions/create-portal/index.ts` | Create |
| `supabase/functions/stripe-webhook/index.ts` | Create |
| `src/hooks/useSubscription.ts` | Create |
| `src/hooks/usePlanLimits.ts` | Create |
| `src/pages/BillingPage.tsx` | Create |
| `src/App.tsx` | Modify (add /billing route) |
| `src/components/layout/AppSidebar.tsx` | Modify (add Billing nav + plan badge) |
| `src/pages/Index.tsx` | Modify (show plan in credit widget) |
| `src/hooks/useWorkspaceCredits.ts` | Modify (include new credit types) |
| `supabase/functions/send-outreach-email/index.ts` | Modify (deduct email credits) |
| `supabase/functions/ai-insights/index.ts` | Modify (deduct AI credits) |
| `src/components/campaigns/SendEmailDialog.tsx` | Modify (credit gate) |
| `src/hooks/useAIInsights.ts` | Modify (credit gate) |
| `src/pages/CampaignsPage.tsx` | Modify (campaign limit gate) |
| Database migration | Create `subscriptions`, alter `workspaces` |

## Implementation Order

1. Enable Stripe integration (collect secret key)
2. Create Stripe products and prices
3. Database migration (subscriptions table + workspace columns)
4. Create `create-checkout` edge function
5. Create `create-portal` edge function
6. Create `stripe-webhook` edge function (with credit reset logic)
7. Create `useSubscription` and `usePlanLimits` hooks
8. Build BillingPage with pricing cards
9. Add Billing to sidebar navigation
10. Integrate feature gating across existing components
11. Update edge functions for credit deduction
12. End-to-end testing

## Technical Considerations

- **Stripe Checkout**: Using Stripe-hosted checkout (not embedded) for PCI compliance simplicity. Users are redirected to Stripe and back.
- **Webhook idempotency**: The webhook handler checks `stripe_subscription_id` before processing to avoid duplicate activations.
- **Plan downgrades**: When downgrading, credits are NOT reduced mid-cycle. New limits apply at next reset.
- **Free plan**: No Stripe subscription needed. The default state. Stripe customer is only created on first checkout.
- **Credit reset**: Handled by `invoice.paid` webhook event, which fires at the start of each billing cycle. For free users, the existing `credits_reset_at` mechanism continues.
- **Security**: Webhook endpoint validates Stripe signature. Checkout/portal endpoints validate workspace ownership via JWT.

