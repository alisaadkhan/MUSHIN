
# Batches 2-5: Free Tier Blur, Feature Gating, Bulk Actions, Email Tracking & CSV Export

Now that Batch 1 (Landing Page and Routing) is complete, this plan covers the remaining four batches to finalize production readiness.

---

## Batch 2: Free Tier Blur on Search Results

Modify `src/pages/SearchPage.tsx` to add a paywall overlay for free-plan users.

**Changes:**
- After results render, check `workspaceCredits?.plan`
- If `plan === 'free'`, wrap each result card's content area with a blur layer (`filter: blur(4px)`, `pointer-events: none`) and overlay a glass panel with a Lock icon and "Upgrade to Unlock" button linking to `/billing`
- Add a dismissible top banner: "You're on the Free plan. Upgrade to see full influencer profiles."
- Free users can still trigger searches (consuming credits) but cannot read detailed card content

---

## Batch 3: Feature Gating and Credit Deduction

### Frontend Gating

Wire `usePlanLimits` into four components:

1. **`CampaignsPage.tsx`** -- Import `usePlanLimits`; disable "New Campaign" button and show upgrade toast when `canCreateCampaign()` is false
2. **`SendEmailDialog.tsx`** -- Check `canSendEmail()` before `handleSend`; show upgrade toast if exhausted
3. **`CardDetailDialog.tsx`** -- Check `canUseAI()` before AI Summary and Fraud Check buttons; disable and show tooltip
4. **`AIInsightsPanel.tsx`** -- Check `canUseAI()` before generating recommendations; show upgrade toast

### Backend Credit Deduction

**`send-outreach-email` edge function:**
- Create a service-role Supabase client
- Before sending, query `workspaces` for the user's `email_sends_remaining`
- If 0, return HTTP 402 with clear message
- After successful Resend send, atomically decrement `email_sends_remaining` by 1

**`ai-insights` edge function:**
- Create a service-role Supabase client
- Before calling AI gateway, query `workspaces` for `ai_credits_remaining`
- If 0, return HTTP 402
- After successful AI response, decrement `ai_credits_remaining` by 1

---

## Batch 4: Bulk Email and Batch Fraud Check

### Bulk Email Dialog

Create `src/components/campaigns/BulkEmailDialog.tsx`:
- Template selector using `useEmailTemplates`
- Email address input per card (or skip cards without email)
- Sends emails sequentially via `send-outreach-email` with per-card variable substitution
- Progress counter and summary toast ("Sent 5/8 emails")

### KanbanBoard Integration

Modify `src/components/campaigns/KanbanBoard.tsx`:
- In the bulk action bar (when `selectMode` is active), add a "Send Email" button that opens `BulkEmailDialog`
- In each stage's dropdown menu, add a "Fraud Check Stage" option
- Clicking it runs `runFraudCheck` from `useAIInsights` for each card in the stage sequentially
- Updates card data via `updateCard` with results stored under `data.ai_fraud_check`
- Shows progress toast and final summary

---

## Batch 5: Email Tracking and CSV Export

### Database Migration

Add two columns to `outreach_log`:

```sql
ALTER TABLE public.outreach_log ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE public.outreach_log ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
```

### Email Webhook Edge Function

Create `supabase/functions/email-webhook/index.ts`:
- Public endpoint (`verify_jwt = false`) receiving Resend webhook POST events
- Parses event type (`email.opened`, `email.clicked`)
- Matches the `email_id` or `to` address against `outreach_log` records
- Updates `opened_at` or `clicked_at` timestamps using service-role client
- Returns 200 OK

Register in `supabase/config.toml`:
```toml
[functions.email-webhook]
verify_jwt = false
```

### CardDetailDialog Enhancement

Modify outreach history section in `CardDetailDialog.tsx`:
- Display open/click status badges (green "Opened" badge if `opened_at` exists, blue "Clicked" badge if `clicked_at` exists) next to each outreach entry

### Campaign Comparison CSV Export

Modify `src/pages/CampaignComparePage.tsx`:
- Add an "Export CSV" button
- Generates CSV from the comparison table data (campaign names, total cards, per-stage counts)
- Triggers download via `Blob` + `URL.createObjectURL`

---

## Files Summary

| Action | File |
|--------|------|
| Modify | `src/pages/SearchPage.tsx` (blur overlay) |
| Modify | `src/pages/CampaignsPage.tsx` (campaign limit gate) |
| Modify | `src/components/campaigns/SendEmailDialog.tsx` (email credit gate) |
| Modify | `src/components/campaigns/CardDetailDialog.tsx` (AI gates + open/click badges) |
| Modify | `src/components/campaigns/AIInsightsPanel.tsx` (AI credit gate) |
| Modify | `supabase/functions/send-outreach-email/index.ts` (credit deduction) |
| Modify | `supabase/functions/ai-insights/index.ts` (credit deduction) |
| Create | `src/components/campaigns/BulkEmailDialog.tsx` |
| Modify | `src/components/campaigns/KanbanBoard.tsx` (bulk email + batch fraud) |
| Create | `supabase/functions/email-webhook/index.ts` |
| Modify | `supabase/config.toml` (register email-webhook) |
| Modify | `src/pages/CampaignComparePage.tsx` (CSV export) |
| Migration | Add `opened_at`, `clicked_at` to `outreach_log` |

## Implementation Order

1. Batch 2 -- Search page blur (small, self-contained)
2. Batch 3 -- Feature gating frontend + edge function credit deduction
3. Batch 4 -- Bulk email dialog + batch fraud in Kanban
4. Batch 5 -- Database migration, email-webhook function, open/click badges, CSV export
