

# Implementation Plan: Credits Exhausted State, Stage Customization, Campaign Status Management, and E2E Testing

## 1. Credits Exhausted State (SearchPage)

**File: `src/pages/SearchPage.tsx`**

- Import `useWorkspaceCredits` hook to get `search_credits_remaining` and `credits_reset_at`
- When `search_credits_remaining === 0`:
  - Show an alert banner above the search form: "You've used all your search credits. Credits reset on [formatted date]."
  - Disable the search button (add `creditsExhausted` to the `disabled` condition)
- Update the existing credits badge in the header to show a warning style (red/destructive) when credits are 0
- Use `date-fns` `format()` to display `credits_reset_at` in a human-readable format

## 2. Campaign Status Management

**File: `src/pages/CampaignDetailPage.tsx`**

- Import `useCampaigns` hook to access the `updateCampaign` mutation
- Replace the static status `Badge` next to the campaign title with a `Select` dropdown
- Options: Draft, Active, Completed, Archived
- On change, call `updateCampaign.mutateAsync({ id, status })` and invalidate the campaign detail query
- Style each option with its corresponding color from `statusColors`

## 3. Stage Customization (Kanban Board)

**File: `src/hooks/usePipelineCards.ts`**

- Add three new mutations:
  - `addStage` -- insert a new stage with position = stages.length
  - `updateStage` -- update name/color of a stage by ID
  - `deleteStage` -- delete a stage by ID (only if it has no cards)

**File: `src/components/campaigns/KanbanBoard.tsx`**

- Add an "Add Stage" button at the end of the stages row (a `+` column)
- On each stage header, add a dropdown menu (three-dot icon) with:
  - "Rename" -- inline edit the stage name
  - "Delete" -- remove the stage (with confirmation; blocked if stage has cards)
- Use inline editing: clicking "Rename" turns the stage name into an input field; Enter/blur saves

## 4. E2E Testing (Manual via Browser Tools)

After implementation, test:
1. Go to Lists, select influencers via checkboxes, bulk remove, export CSV
2. Create a Campaign, add influencers from a list, drag cards between Kanban stages
3. Change campaign status via the dropdown
4. Add/rename/delete pipeline stages
5. Exhaust credits scenario (verify disabled state and banner)

---

## Technical Details

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/SearchPage.tsx` | Add `useWorkspaceCredits`, credits exhausted banner, disable search button |
| `src/pages/CampaignDetailPage.tsx` | Add status dropdown using `Select` + `updateCampaign` mutation |
| `src/hooks/usePipelineCards.ts` | Add `addStage`, `updateStage`, `deleteStage` mutations |
| `src/components/campaigns/KanbanBoard.tsx` | Add stage customization UI (add/rename/delete stages) |

### No New Files Required

All changes extend existing files. No database migrations needed since the existing `pipeline_stages` table already supports full CRUD and has appropriate RLS policies.

### Dependencies

- `date-fns` (already installed) for formatting `credits_reset_at`
- Existing UI components: `Select`, `DropdownMenu`, `AlertDialog`, `Input`

