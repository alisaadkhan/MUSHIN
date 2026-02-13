

# Campaign Dashboard Stats, Stage Drag-and-Drop Reorder, and E2E Testing

## 1. Campaign Dashboard Stats

Add a stats summary section between the campaign header and the Kanban board on the Campaign Detail page.

**Stats to display (in a row of cards):**
- Total Influencers -- count of all pipeline cards
- Per-Stage Breakdown -- small bar or list showing count per stage with stage color dots
- Budget -- campaign budget value (from `campaign.budget`)
- Total Agreed Rates -- sum of all `agreed_rate` values across cards
- Budget Remaining -- budget minus total agreed rates (with color coding: green if positive, red if negative)

**Implementation:**
- Create a new component `src/components/campaigns/CampaignStats.tsx`
- It receives `stages`, `cards`, and `campaign` as props
- Uses the existing `Card` UI component to render 3-4 stat cards in a responsive grid
- Computed client-side from already-fetched data (no new queries needed)

## 2. Stage Drag-and-Drop Reorder

Allow users to drag stage columns left/right to reorder them.

**Implementation:**
- Add a `reorderStages` mutation to `usePipelineStages` in `src/hooks/usePipelineCards.ts` that batch-updates positions for all stages
- In `KanbanBoard.tsx`, add a second drag context for stages (separate from card dragging):
  - Track `dragStageId` state (distinct from `dragCardId`)
  - Make stage column headers draggable via a grip icon
  - On drop between stages, reorder the array and call `reorderStages`
  - Use `dataTransfer.setData("type", "stage")` vs `"card"` to distinguish drag types
- Optimistically reorder the stages array in the UI before the mutation completes

## 3. E2E Testing Plan

After implementation, manually test using browser tools:
1. **Credits exhausted banner** -- navigate to Search, verify banner/disabled state
2. **Campaign status dropdown** -- go to a campaign detail page, change status, verify it persists
3. **Stage customization** -- add a new stage, rename it, delete an empty stage, try deleting a stage with cards (should be blocked)
4. **Stage reorder** -- drag a stage column to a new position, verify order persists after refresh
5. **Dashboard stats** -- verify counts match actual cards, budget math is correct

---

## Technical Details

### Files to Create
| File | Purpose |
|------|---------|
| `src/components/campaigns/CampaignStats.tsx` | Stats cards component (total influencers, per-stage counts, budget vs agreed rates) |

### Files to Modify
| File | Changes |
|------|---------|
| `src/hooks/usePipelineCards.ts` | Add `reorderStages` mutation that batch-updates position for all stages |
| `src/components/campaigns/KanbanBoard.tsx` | Add stage drag-and-drop (dragStageId state, grip handle on headers, drop zone logic to distinguish stage vs card drags) |
| `src/pages/CampaignDetailPage.tsx` | Import and render `CampaignStats` between header and KanbanBoard, passing stages/cards/campaign data |

### No Database Changes Required
All data needed for stats and reorder is already available in existing tables. The `pipeline_stages.position` column already supports reordering.

