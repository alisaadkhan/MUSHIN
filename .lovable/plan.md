

# Add to Campaign from Lists, Budget Progress Bar, and Stage Color Picker

## 1. "Add to Campaign" Button on List Detail Page

**File: `src/pages/ListDetailPage.tsx`**

- Add an "Add to Campaign" button in the floating bulk action bar (appears when influencers are selected)
- Clicking it opens a dialog with:
  - A `Select` dropdown to pick a campaign (fetched via `useCampaigns` hook)
  - A preview showing how many selected influencers will be added
  - A confirmation button that batch-inserts the selected items as pipeline cards into the campaign's first stage
- Uses `usePipelineStages` to find the first stage and `usePipelineCards.addCard` to insert each selected influencer
- After adding, shows a toast with the count and a link to the campaign

## 2. Budget Progress Bar in Campaign Stats

**File: `src/components/campaigns/CampaignStats.tsx`**

- Add a `Progress` bar component to the "Budget / Agreed" stat card
- Calculate percentage: `(totalAgreed / budget) * 100`, capped at 100
- Color the progress bar indicator:
  - Default primary color when under 80%
  - Warning amber when 80-100%
  - Red/destructive when over 100% (over budget)
- Show percentage text below the progress bar
- Only render the progress bar when budget > 0

## 3. Stage Color Picker in Kanban Board

**File: `src/components/campaigns/KanbanBoard.tsx`**

- Add a "Change Color" option in the stage dropdown menu (alongside Rename and Delete)
- Clicking it opens a popover with a grid of preset color swatches (8-10 colors)
- Preset colors: indigo, amber, blue, green, purple, pink, red, cyan, orange, gray
- Selecting a color calls `updateStage.mutateAsync({ id: stageId, color: selectedColor })`
- The stage's color dot updates immediately

---

## Technical Details

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/ListDetailPage.tsx` | Add "Add to Campaign" button in bulk bar, campaign selection dialog, batch insert logic |
| `src/components/campaigns/CampaignStats.tsx` | Add Progress bar to budget card with color-coded percentage |
| `src/components/campaigns/KanbanBoard.tsx` | Add color picker popover in stage dropdown menu |

### No New Files or Database Changes Required

All features use existing tables, hooks, and UI components (`Progress`, `Popover`, `Select`, `Dialog`). The `updateStage` mutation already supports color updates.

