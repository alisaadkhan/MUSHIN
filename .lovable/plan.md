

# Phase 3: Campaign Management & Kanban Pipeline -- Full Implementation

## Overview

Implement all 7 features from the Phase 3 plan in sequence. Features 3.1-3.6 require no database changes. Feature 3.7 requires a new `campaign_activity` table.

---

## 3.1 -- Campaign Creation Enhancements

**File: `src/pages/CampaignsPage.tsx`**

- Add budget `Input` (type=number, optional) to the create campaign dialog
- Add start date and end date pickers using `Popover` + `Calendar` (shadcn pattern)
- Pass `budget`, `start_date`, `end_date` to `createCampaign.mutateAsync()` (the mutation already supports these fields)
- On campaign cards in the grid, show:
  - Date range (e.g. "Jan 15 - Feb 28") below the description
  - Budget amount next to the existing influencer count

---

## 3.2 -- Campaign Edit Dialog

**File: `src/pages/CampaignDetailPage.tsx`**

- Add a pencil/edit icon button next to the campaign title
- Opens a dialog pre-filled with campaign name, description, budget, start_date, end_date
- "Save" calls `updateCampaign.mutateAsync()` and invalidates the `campaign-detail` query
- Reuses the same date picker pattern from 3.1

---

## 3.3 -- Card Detail Enhancements

**File: `src/components/campaigns/CardDetailDialog.tsx`**

- Add a stats row at the top showing data from the card's `data` JSON:
  - Followers count, engagement rate, avg views (if available in the cached data)
  - Display as small badges/chips with labels
- Add a "Move to Stage" `Select` dropdown:
  - Requires passing `stages` and a `onMove` callback as new props
  - Lists all stages, current stage pre-selected
  - On change, calls `onMove(cardId, newStageId)`
- Show `created_at` and `updated_at` timestamps at the bottom as muted text

**File: `src/components/campaigns/KanbanBoard.tsx`**

- Pass `stages` and a `handleMoveCard` callback to `CardDetailDialog`
- Update `CardDetailDialog` props interface to include `stages` and `onMove`

---

## 3.4 -- Duplicate Detection

**File: `src/pages/ListDetailPage.tsx`**

- In `handleAddToCampaign`, before inserting, fetch existing `pipeline_cards` for the selected campaign
- Filter out items where `username + platform` already exists in the campaign's cards
- Show toast: "Added X, skipped Y duplicates" (or "All X already in pipeline" if all duplicates)

**File: `src/pages/CampaignDetailPage.tsx`**

- Apply same logic in `handleAddFromList`: compare incoming list items against existing cards before inserting

---

## 3.5 -- Pipeline Filtering & Search

**File: `src/components/campaigns/KanbanBoard.tsx`**

- Add a toolbar row above the stage columns with:
  - Search `Input` (filters cards by username/title across all stages)
  - Platform filter chips (toggle buttons for Instagram, TikTok, YouTube)
- Apply filters client-side to the `cardsByStage` callback
- Show "X of Y influencers" count when filters are active
- Filters are purely visual -- no database queries

---

## 3.6 -- Bulk Stage Move

**File: `src/components/campaigns/KanbanBoard.tsx`**

- Add a "Select Mode" toggle button in the toolbar (from 3.5)
- When active, show checkboxes on each `KanbanCard`
- Track selected card IDs in state
- Show a floating bulk action bar (similar to `ListDetailPage`) with:
  - "Move to Stage" `Select` dropdown -- batch calls `moveCard` for each selected card
  - "Remove Selected" button -- batch calls `removeCard`
  - Count indicator and "Clear" button

**File: `src/components/campaigns/KanbanCard.tsx`**

- Add optional `selectable`, `selected`, `onSelect` props
- When `selectable`, render a `Checkbox` on the card

---

## 3.7 -- Campaign Activity Timeline

### Database Migration

```sql
CREATE TABLE public.campaign_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view campaign activity"
  ON public.campaign_activity FOR SELECT
  USING (is_workspace_member(
    (SELECT workspace_id FROM campaigns WHERE id = campaign_id)
  ));

CREATE POLICY "Members can log campaign activity"
  ON public.campaign_activity FOR INSERT
  WITH CHECK (is_workspace_member(
    (SELECT workspace_id FROM campaigns WHERE id = campaign_id)
  ));

CREATE INDEX idx_campaign_activity_campaign
  ON public.campaign_activity(campaign_id, created_at DESC);
```

### New Files

| File | Purpose |
|------|---------|
| `src/hooks/useCampaignActivity.ts` | Hook with `useQuery` to fetch activity and `useMutation` to log new entries |
| `src/components/campaigns/CampaignTimeline.tsx` | Collapsible timeline UI showing activity entries with icons per action type |

### Activity Logging Integration

Log events from existing mutation callbacks:
- **KanbanBoard.tsx**: Log card moved, stage created/renamed/deleted, color changed
- **CampaignDetailPage.tsx**: Log status changed, influencers added from list
- **CardDetailDialog.tsx**: Log card notes/rate updated, card removed

Each log entry includes: `{ action: "card_moved", details: { username, from_stage, to_stage } }`

### Timeline UI

- Rendered as a collapsible section below the Kanban board on `CampaignDetailPage.tsx`
- Vertical timeline with colored dots per action type
- Shows action description, relative timestamp (e.g. "2 hours ago")
- "Show more" pagination (load 20 at a time)

---

## Files Summary

| File | Features | Action |
|------|----------|--------|
| `src/pages/CampaignsPage.tsx` | 3.1 | Modify |
| `src/pages/CampaignDetailPage.tsx` | 3.2, 3.4, 3.7 | Modify |
| `src/components/campaigns/CardDetailDialog.tsx` | 3.3 | Modify |
| `src/components/campaigns/KanbanBoard.tsx` | 3.3, 3.5, 3.6, 3.7 | Modify |
| `src/components/campaigns/KanbanCard.tsx` | 3.6 | Modify |
| `src/pages/ListDetailPage.tsx` | 3.4 | Modify |
| `src/hooks/useCampaignActivity.ts` | 3.7 | Create |
| `src/components/campaigns/CampaignTimeline.tsx` | 3.7 | Create |

## Implementation Order

1. **3.1** Campaign creation enhancements (budget + dates in create dialog and cards)
2. **3.2** Campaign edit dialog on detail page
3. **3.3** Card detail enhancements (stats, move-to-stage, timestamps)
4. **3.4** Duplicate detection in both add-to-campaign flows
5. **3.5** Pipeline filtering and search toolbar
6. **3.6** Bulk stage move with multi-select on Kanban
7. **3.7** Database migration, then activity logging hook/component/integration

