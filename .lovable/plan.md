# Bulk Actions, View Profile, and Phase 3 Campaign Management Plan

## Part 1: Bulk Actions on List Detail Page

### Selection System

- Add a `selectedIds` state (`Set<string>`) to `ListDetailPage.tsx`
- Add a checkbox (using the existing `Checkbox` component) to each influencer card
- Add a "Select All" checkbox in the header area
- When items are selected, show a floating action bar at the bottom with:
  - "X selected" count
  - "Remove Selected" button (with confirmation dialog)
  - "Export CSV" button
  - "Clear Selection" link

### Bulk Remove

- Extend `useListItems` hook with a `removeItems` mutation that deletes multiple IDs in one call
- Show confirmation dialog: "Remove X influencers from this list?"

### Export CSV

- Generate CSV client-side from the selected items (or all items if none selected)
- Columns: Username, Platform, Notes, Profile Link, Date Added
- Trigger browser download using `Blob` + `URL.createObjectURL`

---

## Part 2: View Profile Redirect

The "View" button on the list detail page already opens the external profile link (`itemData?.link`) in a new tab. This is the correct behavior since these are external social media profiles (Instagram, TikTok, YouTube).

No changes needed here -- the existing `<a href={itemData.link} target="_blank">` already redirects to the influencer's actual profile page.

If by "View Profile" you meant an internal profile page within the app, that would require building a new `/profile/:platform/:username` page. The current implementation correctly links to the external social media profile.

---

## Part 3: Phase 3 -- Campaign Management and Kanban Pipeline

### 3A. Database Schema (New Tables)

`**campaigns` table:**


| Column       | Type        | Notes                              |
| ------------ | ----------- | ---------------------------------- |
| id           | uuid (PK)   | auto-generated                     |
| workspace_id | uuid (FK)   | links to workspaces                |
| name         | text        | campaign name                      |
| description  | text        | optional                           |
| status       | enum        | draft, active, completed, archived |
| start_date   | date        | optional                           |
| end_date     | date        | optional                           |
| budget       | numeric     | optional                           |
| created_at   | timestamptz | default now()                      |
| updated_at   | timestamptz | default now()                      |


`**pipeline_stages` table:**


| Column      | Type        | Notes                                                                    |
| ----------- | ----------- | ------------------------------------------------------------------------ |
| id          | uuid (PK)   | auto-generated                                                           |
| campaign_id | uuid (FK)   | links to campaigns                                                       |
| name        | text        | e.g. "Shortlisted", "Contacted", "Negotiating", "Confirmed", "Completed" |
| position    | integer     | ordering                                                                 |
| color       | text        | hex color for the column                                                 |
| created_at  | timestamptz | default now()                                                            |


`**pipeline_cards` table:**


| Column      | Type        | Notes                    |
| ----------- | ----------- | ------------------------ |
| id          | uuid (PK)   | auto-generated           |
| stage_id    | uuid (FK)   | links to pipeline_stages |
| campaign_id | uuid (FK)   | links to campaigns       |
| username    | text        | influencer username      |
| platform    | text        | instagram/tiktok/youtube |
| data        | jsonb       | cached influencer data   |
| notes       | text        | campaign-specific notes  |
| agreed_rate | numeric     | optional negotiated rate |
| position    | integer     | ordering within stage    |
| created_at  | timestamptz | default now()            |
| updated_at  | timestamptz | default now()            |


All tables get RLS policies scoped to workspace membership via `is_workspace_member()`.

### 3B. New Pages and Routes

- `/campaigns` -- Campaigns list page (grid of campaign cards with status badges)
- `/campaigns/:id` -- Campaign detail with Kanban board
- `/campaigns/new` -- Create campaign form

### 3C. Kanban Board Implementation

- Use drag-and-drop to move influencer cards between pipeline stages
- Default stages on campaign creation: Shortlisted, Contacted, Negotiating, Confirmed, Completed
- Each card shows: username, platform badge, notes preview, agreed rate
- Click card to open detail drawer/dialog for editing notes and rate
- Add influencers to a campaign from a list (bulk add from list detail page)

### 3D. Features

- **Campaign Dashboard**: Overview stats (total influencers, by stage, total budget vs. agreed rates)
- **Add from Lists**: Button on campaign page to import influencers from existing lists
- **Stage Customization**: Add/rename/reorder/delete pipeline stages per campaign
- **Card Actions**: Move to stage, edit notes/rate, remove from campaign, view external profile

### 3E. Sidebar Navigation Update

Add "Campaigns" nav item between "Lists" and "Saved Searches" in the sidebar.

### 3F. Implementation Order

1. Create database tables and RLS policies (campaigns, pipeline_stages, pipeline_cards)
2. Create hooks: `useCampaigns()`, `usePipelineStages()`, `usePipelineCards()`
3. Build Campaigns list page
4. Build Campaign detail page with Kanban board (drag-and-drop)
5. Build "Add from List" flow
6. Add sidebar nav item
7. End-to-end testing

---

## Technical Details

### Files to Create

- `src/pages/CampaignsPage.tsx` -- campaigns list
- `src/pages/CampaignDetailPage.tsx` -- Kanban board view
- `src/hooks/useCampaigns.ts` -- CRUD for campaigns
- `src/hooks/usePipelineCards.ts` -- CRUD for pipeline stages and cards
- `src/components/campaigns/KanbanBoard.tsx` -- drag-and-drop board component
- `src/components/campaigns/KanbanCard.tsx` -- individual card component
- `src/components/campaigns/CardDetailDialog.tsx` -- edit card details

### Files to Modify

- `src/pages/ListDetailPage.tsx` -- add bulk selection, CSV export, "Add to Campaign" button
- `src/hooks/useInfluencerLists.ts` -- add `removeItems` bulk mutation
- `src/components/layout/AppSidebar.tsx` -- add Campaigns nav item
- `src/App.tsx` -- add campaign routes

### Database Migration

- One migration to create `campaigns`, `pipeline_stages`, `pipeline_cards` tables with RLS
- One migration for a trigger to auto-create default stages when a campaign is created
- **⚠️ Cross‑Cutting Concerns**

  | **Concern**                                                                                                             | **Recommendation**                                                                                         |
  | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
  | **Data consistency** – When influencer data is updated in `influencers_cache`, should it propagate to `pipeline_cards`? | Not automatically; the cached snapshot at time of addition is fine. Consider an optional “refresh” button. |
  | **Performance** – Kanban board with many cards could be slow.                                                           | Implement pagination or virtualized columns; limit cards per stage initially.                              |
  | **Mobile responsiveness** – Kanban on small screens is tricky.                                                          | Provide a list view alternative or collapsible columns.                                                    |
  | **Error handling** – API calls for moving cards should be optimistic with rollback on failure.                          | Use a library like React Query to manage mutations and optimistic updates.                                 |
