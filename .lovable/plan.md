

# Outreach Tracking, Campaign Comparison & Analytics Verification

## 1. Outreach Tracking on "Contacted" Stage

Track when influencers move to the "Contacted" stage and display outreach status on cards.

### Database Migration

Create an `outreach_log` table to record contact events:

```sql
CREATE TABLE public.outreach_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES pipeline_cards(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  platform TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'contacted',
  contacted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

ALTER TABLE public.outreach_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view outreach logs"
  ON public.outreach_log FOR SELECT
  USING (is_workspace_member(
    (SELECT workspace_id FROM campaigns WHERE id = campaign_id)
  ));

CREATE POLICY "Members can create outreach logs"
  ON public.outreach_log FOR INSERT
  WITH CHECK (is_workspace_member(
    (SELECT workspace_id FROM campaigns WHERE id = campaign_id)
  ));

CREATE POLICY "Members can update outreach logs"
  ON public.outreach_log FOR UPDATE
  USING (is_workspace_member(
    (SELECT workspace_id FROM campaigns WHERE id = campaign_id)
  ));

CREATE INDEX idx_outreach_log_campaign ON public.outreach_log(campaign_id);
CREATE INDEX idx_outreach_log_card ON public.outreach_log(card_id);
```

### New Hook: `src/hooks/useOutreachLog.ts`

- `useOutreachLog(campaignId)` -- fetches outreach entries for the campaign
- `logOutreach` mutation -- inserts a new outreach record
- Auto-triggered when a card moves to a stage named "Contacted" (case-insensitive match)

### Integration in `KanbanBoard.tsx`

- In `handleDrop` and `handleMoveCard`, after moving a card to a stage whose name matches "contacted" (case-insensitive), automatically call `logOutreach.mutate(...)` with the card's details
- Also log a `campaign_activity` entry for "influencer_contacted"

### Outreach Badge on `KanbanCard.tsx`

- Accept an optional `outreachStatus` prop
- When present, show a small "Contacted" badge with a mail icon on the card
- Pass outreach data from the board to cards by matching `card.id` against outreach log entries

### Outreach Details in `CardDetailDialog.tsx`

- Show an "Outreach" section listing contact events for this card (date, method, notes)
- Allow adding a note to the latest outreach entry

---

## 2. Campaign Comparison View

A new page to compare metrics across multiple campaigns side by side.

### New Route & Page

- Route: `/campaigns/compare`
- File: `src/pages/CampaignComparePage.tsx`
- Add route in `App.tsx` (before the `:id` route so it matches first)

### Page Design

- Multi-select dropdown at the top to pick 2-4 campaigns to compare
- Fetches campaigns, their stages, and cards in parallel
- Displays a comparison table with rows for:
  - Total influencers
  - Budget / spent / remaining
  - Influencers per stage (aligned by stage name across campaigns)
  - Conversion rate (first stage to last stage)
- Below the table, a grouped bar chart (Recharts) comparing influencer counts per stage across campaigns
- A "Compare" button on the `CampaignsPage.tsx` header links to this page

### Data Fetching

- Use `useCampaigns()` for the campaign list
- For each selected campaign, fetch stages and cards using existing hooks or direct queries
- All client-side -- no new database tables needed

---

## 3. Analytics Verification

- Navigate to a campaign detail page in the browser and visually verify charts render
- Check console for any Recharts errors
- This is a manual testing step performed after implementing features 1 and 2

---

## Files Summary

| File | Action |
|------|--------|
| `src/hooks/useOutreachLog.ts` | Create |
| `src/components/campaigns/KanbanBoard.tsx` | Modify (auto-log outreach on contacted) |
| `src/components/campaigns/KanbanCard.tsx` | Modify (outreach badge) |
| `src/components/campaigns/CardDetailDialog.tsx` | Modify (outreach section) |
| `src/pages/CampaignComparePage.tsx` | Create |
| `src/pages/CampaignsPage.tsx` | Modify (add Compare button) |
| `src/App.tsx` | Modify (add compare route) |
| Database migration | Create `outreach_log` table |

## Implementation Order

1. Database migration for `outreach_log`
2. Create `useOutreachLog` hook
3. Integrate auto-logging in KanbanBoard when cards reach "Contacted"
4. Add outreach badge to KanbanCard and outreach section to CardDetailDialog
5. Create CampaignComparePage with comparison table and charts
6. Add route and navigation link
7. Browser-test analytics charts on an existing campaign

