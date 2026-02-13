

# Phase 7 & 8: Integrations + Advanced Analytics

## Phase 7: Integrations (Zapier, Google Sheets, HubSpot, Slack)

### 7.1 Integration Settings Tab

Add an **"Integrations"** tab to the existing Settings page (`src/pages/Settings.tsx`) where users configure webhook URLs and connection details for each integration.

Each integration stores its config in the `workspaces.settings` JSONB column (already exists), under keys like `zapier_webhook_url`, `google_sheets_webhook_url`, `hubspot_webhook_url`, `slack_webhook_url`.

### 7.2 Zapier Integration

- **Approach**: User pastes a Zapier Webhook URL in Settings > Integrations
- **Triggers**: Fire `no-cors` POST requests to the webhook on key events:
  - New influencer added to a campaign pipeline
  - Campaign status changed
  - Outreach email sent
- **Implementation**:
  - Create a utility `src/lib/integrations.ts` with a `fireWebhook(url, payload)` helper
  - Call it from existing mutation hooks (`usePipelineCards`, `useCampaigns`, `SendEmailDialog`) after successful operations
  - Payload includes event type, timestamp, and relevant data

### 7.3 Google Sheets Export

- **Approach**: User pastes a Google Sheets webhook URL (via Apps Script or Zapier) in Settings
- **Triggers**:
  - "Export to Sheets" button on List detail page and Campaign detail page
  - Sends influencer data (username, platform, followers, engagement, etc.) as JSON to the webhook
- **Implementation**:
  - Add an "Export to Sheets" button on `ListDetailPage` and `CampaignDetailPage`
  - Uses the same `fireWebhook` utility

### 7.4 HubSpot Sync

- **Approach**: User pastes a HubSpot webhook URL or private app token
- **Edge Function**: `sync-hubspot` -- pushes confirmed influencers as HubSpot contacts
- **Trigger**: "Sync to HubSpot" button on campaign pipeline cards in the "Confirmed" or "Completed" stages
- **Data mapped**: Name, email (if available), platform handle, agreed rate, campaign name

### 7.5 Slack Notifications

- **Approach**: User pastes a Slack Incoming Webhook URL in Settings
- **Triggers**: Fire Slack messages on:
  - Campaign status changed to "active" or "completed"
  - Influencer moved to "Confirmed" stage
  - Weekly digest (optional, future)
- **Implementation**:
  - Slack webhooks accept simple JSON `{ "text": "..." }` via POST
  - Reuse the `fireWebhook` utility with formatted message text

---

## Phase 8: Advanced Analytics, PDF Reports, Compliance

### 8.1 Advanced Campaign Analytics

Extend the existing `CampaignAnalytics` component with:

- **ROI Calculator**: (Total revenue or estimated value) vs budget spent. User inputs "estimated value per confirmed influencer" in campaign edit dialog; the system computes ROI automatically.
- **Outreach response rate**: Emails sent vs influencers who moved past "Contacted" stage
- **Time-in-stage metrics**: Average days an influencer spends in each pipeline stage (computed from `pipeline_cards.updated_at` and `campaign_activity`)
- **Cost-per-influencer**: Budget / confirmed influencers

### 8.2 Analytics Dashboard Page

New page: `src/pages/AnalyticsPage.tsx` (route: `/analytics`)

- Cross-campaign overview: total spend, total influencers, overall conversion rate
- Monthly trends: searches performed, emails sent, credits consumed (from `credits_usage` table)
- Top-performing campaigns by conversion rate
- Credit usage breakdown chart (search, enrichment, email, AI)

### 8.3 PDF Report Generation

- **Approach**: Client-side PDF generation using the browser's `window.print()` with a print-optimized layout, or a lightweight library like `html2canvas` + `jspdf`
- **New component**: `src/components/campaigns/CampaignReport.tsx` -- a print-friendly layout of:
  - Campaign summary (name, dates, budget, status)
  - Pipeline funnel chart
  - Stage distribution
  - Conversion rates
  - Influencer roster with key metrics
  - Outreach log summary
- **Trigger**: "Download Report" button on `CampaignDetailPage`
- **No new dependencies needed** if using `window.print()` approach; otherwise add `jspdf` + `html2canvas`

### 8.4 Compliance & Data Management

- **Data export (GDPR)**: "Export My Data" button in Settings that downloads a JSON file of the user's profile, workspace data, campaigns, and outreach logs
- **Data deletion**: "Delete Account" button in Settings that:
  - Deletes all user data (profile, workspace, campaigns, pipeline data, outreach logs)
  - Signs the user out
  - Edge function `delete-account` handles cascading deletion server-side with service role
- **Consent logging**: Add a `consent_given_at` timestamp to `profiles` table (set during onboarding)
- **Email opt-out tracking**: Add `unsubscribed` boolean to `outreach_log` so bounced or opt-out emails can be flagged

---

## Database Changes

```sql
-- Phase 8: Compliance additions
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMPTZ;
ALTER TABLE public.outreach_log ADD COLUMN IF NOT EXISTS unsubscribed BOOLEAN DEFAULT false;
```

## New Files

| File | Purpose |
|---|---|
| `src/lib/integrations.ts` | `fireWebhook` utility + integration helpers |
| `src/components/settings/IntegrationsTab.tsx` | Integrations config UI (Zapier, Sheets, HubSpot, Slack) |
| `src/pages/AnalyticsPage.tsx` | Cross-campaign analytics dashboard |
| `src/components/campaigns/CampaignReport.tsx` | Print-friendly PDF report layout |
| `src/components/settings/DataManagement.tsx` | GDPR export + account deletion UI |
| `supabase/functions/sync-hubspot/index.ts` | Push influencer data to HubSpot |
| `supabase/functions/delete-account/index.ts` | Cascade-delete user data |

## Modified Files

| File | Changes |
|---|---|
| `src/pages/Settings.tsx` | Add Integrations + Data Management tabs |
| `src/pages/CampaignDetailPage.tsx` | Add "Download Report" and "Export to Sheets" buttons |
| `src/pages/ListDetailPage.tsx` | Add "Export to Sheets" button |
| `src/hooks/usePipelineCards.ts` | Fire webhook on card add/move |
| `src/hooks/useCampaigns.ts` | Fire webhook on status change |
| `src/components/campaigns/SendEmailDialog.tsx` | Fire webhook after email sent |
| `src/components/campaigns/CampaignAnalytics.tsx` | Add ROI, response rate, time-in-stage charts |
| `src/components/layout/AppSidebar.tsx` | Add Analytics nav item |
| `src/App.tsx` | Add `/analytics` route |
| `supabase/config.toml` | Add new edge functions config |

## Implementation Order

1. Create `src/lib/integrations.ts` with `fireWebhook` utility
2. Add Integrations tab to Settings (Zapier, Sheets, HubSpot, Slack webhook URLs)
3. Wire webhook calls into existing hooks and components
4. Create `sync-hubspot` edge function
5. Build Analytics page with cross-campaign charts
6. Extend `CampaignAnalytics` with ROI, response rate, time-in-stage
7. Build `CampaignReport` component and "Download Report" button
8. Database migration for compliance columns
9. Build Data Management UI (export + delete account)
10. Create `delete-account` edge function
11. Update onboarding to record consent timestamp
