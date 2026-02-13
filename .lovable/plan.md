
# Phase 3: Campaign Management & Kanban Pipeline Enhancements

## Current State

The campaign system has a solid foundation:
- Campaign CRUD (create, list, delete) with status management (draft/active/completed/archived)
- Kanban board with draggable cards and reorderable stages
- Pipeline card detail dialog (notes, agreed rate, remove)
- Dashboard stats (total influencers, per-stage breakdown, budget/agreed with progress bar)
- Stage customization (rename, delete, color picker)
- Add influencers from lists (bulk and individual)
- Budget tracking with color-coded progress

## Phase 3 Features

### 3.1 — Campaign Creation Enhancements

**File: `src/pages/CampaignsPage.tsx`**

Upgrade the create campaign dialog with full-featured fields:
- Add `budget` input (number, optional)
- Add `start_date` and `end_date` date pickers (using existing Calendar/Popover components)
- Show date range on campaign cards in the grid
- Display budget on campaign cards with a mini progress indicator

### 3.2 — Campaign Edit Dialog

**File: `src/pages/CampaignDetailPage.tsx`**

Add an "Edit Campaign" button next to the campaign title that opens a dialog to edit:
- Campaign name
- Description
- Budget
- Start date / End date
- Uses existing `updateCampaign` mutation from `useCampaigns` hook

### 3.3 — Card Detail Enhancements

**File: `src/components/campaigns/CardDetailDialog.tsx`**

Enrich the card detail dialog:
- Display influencer stats from the cached `data` JSON (followers, engagement rate, avg views) in a mini stats row
- Add a "Move to Stage" dropdown so users can reassign the card to a different stage without dragging
- Show creation date and last updated timestamp

### 3.4 — Duplicate Detection

**Files: `src/pages/CampaignDetailPage.tsx`, `src/pages/ListDetailPage.tsx`**

When adding influencers to a campaign (from a list or bulk action):
- Check existing `pipeline_cards` for matching `username + platform + campaign_id`
- Skip duplicates and show a toast: "Added X, skipped Y duplicates"
- No database changes needed — filter client-side before inserting

### 3.5 — Pipeline Filtering & Search

**File: `src/components/campaigns/KanbanBoard.tsx`**

Add a toolbar above the Kanban board:
- Search input to filter cards by username/title across all stages
- Platform filter chips (Instagram, TikTok, YouTube) to show/hide cards by platform
- Filters are client-side only, applied to the already-fetched cards data
- Show "X of Y cards" count when filters are active

### 3.6 — Bulk Stage Move

**File: `src/components/campaigns/KanbanBoard.tsx`**

Add multi-select capability to the Kanban board:
- Checkbox on each card (visible on hover or via a "Select Mode" toggle)
- Floating bulk action bar (similar to ListDetailPage) with:
  - "Move to Stage" dropdown
  - "Remove Selected" button
- Uses existing `moveCard` and `removeCard` mutations in a loop

### 3.7 — Campaign Activity Timeline

**New file: `src/components/campaigns/CampaignTimeline.tsx`**
**Database: Add `campaign_activity` table**

Log key events for audit/history:
- Card added, card moved between stages, card removed
- Stage created, renamed, deleted
- Campaign status changed

Display as a vertical timeline on the campaign detail page (collapsible section below the Kanban board).

**Database migration:**
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
  USING (is_workspace_member((SELECT workspace_id FROM campaigns WHERE id = campaign_id)));

CREATE POLICY "Members can log campaign activity"
  ON public.campaign_activity FOR INSERT
  WITH CHECK (is_workspace_member((SELECT workspace_id FROM campaigns WHERE id = campaign_id)));

CREATE INDEX idx_campaign_activity_campaign ON public.campaign_activity(campaign_id, created_at DESC);
```

---

## Implementation Order

| Priority | Feature | Complexity | New Files | DB Changes |
|----------|---------|------------|-----------|------------|
| 1 | 3.1 Campaign creation enhancements | Low | None | None |
| 2 | 3.2 Campaign edit dialog | Low | None | None |
| 3 | 3.3 Card detail enhancements | Medium | None | None |
| 4 | 3.4 Duplicate detection | Low | None | None |
| 5 | 3.5 Pipeline filtering & search | Medium | None | None |
| 6 | 3.6 Bulk stage move | Medium | None | None |
| 7 | 3.7 Campaign activity timeline | High | 1 component + 1 hook | 1 table |

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/campaigns/CampaignTimeline.tsx` | Activity timeline UI component |
| `src/hooks/useCampaignActivity.ts` | Hook for querying/logging campaign activity |

### Files to Modify

| File | Features |
|------|----------|
| `src/pages/CampaignsPage.tsx` | 3.1 — Budget + date fields in create dialog, richer campaign cards |
| `src/pages/CampaignDetailPage.tsx` | 3.2 — Edit dialog; 3.4 — Duplicate detection; 3.7 — Timeline section |
| `src/pages/ListDetailPage.tsx` | 3.4 — Duplicate detection in "Add to Campaign" |
| `src/components/campaigns/CardDetailDialog.tsx` | 3.3 — Stats display, move-to-stage dropdown, timestamps |
| `src/components/campaigns/KanbanBoard.tsx` | 3.5 — Filter toolbar; 3.6 — Multi-select & bulk actions |
| `src/hooks/usePipelineCards.ts` | 3.6 — Bulk move mutation |

### Dependencies

- Features 3.1–3.6 require no database changes and can be implemented immediately
- Feature 3.7 requires a migration first, then code implementation
- Features 3.5 and 3.6 both modify KanbanBoard.tsx — implement 3.5 first since 3.6 builds on the toolbar area
