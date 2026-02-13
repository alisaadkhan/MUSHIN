

# Phase 2: Core Product Features

## Overview

Build the complete influencer discovery platform with real search via Serper API, list management, saved searches, search history, credits system, and a live dashboard.

---

## Phase 2A: Influencer Search with Serper API

### 2A.1 - Store Serper API Key

- Use the secrets tool to request the user's Serper API key (from serper.dev dashboard)
- Store as `SERPER_API_KEY` in backend secrets

### 2A.2 - Create `search-influencers` Edge Function

A backend function at `supabase/functions/search-influencers/index.ts` that:

1. Accepts POST with `{ query, platform, location }` and the user's auth token
2. Validates the user is authenticated and has a workspace
3. Checks `search_credits_remaining > 0` on the workspace
4. Constructs a Serper API call to `https://google.serper.dev/search` with a crafted query like:
   - `"fashion blogger" site:instagram.com Karachi` (for Instagram)
   - `"fitness coach" site:tiktok.com Lahore` (for TikTok)
   - `"tech reviewer" site:youtube.com` (for YouTube)
5. Parses organic results into a normalized influencer format: `{ title, link, snippet, username (extracted from URL), platform, displayUrl }`
6. Caches results in `influencers_cache` table (keyed by platform + username)
7. Logs the search in `search_history` table
8. Deducts 1 from `search_credits_remaining` on the workspace
9. Logs credit usage in `credits_usage` table
10. Returns the parsed results array and remaining credits

### 2A.3 - Update SearchPage UI

- Wire the "Search Influencers" button to call the edge function via `supabase.functions.invoke`
- Show loading skeleton cards during search
- Display results as cards showing: profile name, username, snippet/bio, platform badge, link
- Show remaining credits after search
- Handle errors (no credits, API failure) with toast notifications
- "Add to List" button on each result card (for Phase 2B)

### 2A.4 - Add Follower Count Filter (Advanced Filters)

- Add optional min/max follower range filters to the search form
- Pass as additional query modifiers to Serper (e.g., appending "10k followers")

---

## Phase 2B: List Management

### 2B.1 - Create Lists Page (`/lists`)

- Fetch all `influencer_lists` for the user's workspace
- Display as a grid of cards showing list name, item count, creation date
- "Create List" button opens a dialog to name a new list
- Each card links to the list detail view
- Delete list with confirmation dialog

### 2B.2 - Create List Detail Page (`/lists/:id`)

- Fetch `list_items` joined with list metadata
- Display items as a table/grid: username, platform, notes, date added
- Remove item button with confirmation
- Edit notes inline
- Empty state with CTA to search for influencers

### 2B.3 - "Add to List" Flow

- On search results, each card gets an "Add to List" dropdown
- Dropdown shows existing lists + "Create New List" option
- On selection, inserts into `list_items` with the influencer's cached data
- Prevents duplicates (same username + platform in same list)
- Success toast with link to the list

---

## Phase 2C: Saved Searches

### 2C.1 - Create Saved Searches Page (`/saved-searches`)

- Fetch all `saved_searches` for the workspace
- Display as a list: name, platform, filters summary, date created
- Click to re-run the search (navigates to `/search` with pre-filled filters)
- Delete saved search with confirmation

### 2C.2 - Save Search from Results

- After a successful search, show a "Save This Search" button
- Opens dialog to name the saved search
- Stores query, platform, location, and any filters as JSONB in `saved_searches`

---

## Phase 2D: Search History

### 2D.1 - Create History Page (`/history`)

- Fetch `search_history` for the workspace, ordered by most recent
- Display as a table: query, platform, location, result count, date
- Click to re-run the search
- Empty state when no history exists

---

## Phase 2E: Credits System Integration

### 2E.1 - Live Credits in Sidebar

- Fetch `workspaces.search_credits_remaining` and `enrichment_credits_remaining` from the workspace
- Display real values in the sidebar credits widget (replacing hardcoded "50 / 50")
- Auto-refresh after each search

### 2E.2 - Credits Exhausted State

- When credits reach 0, disable the search button
- Show a banner/toast: "You've used all your search credits. Credits reset on [date]."
- Display `credits_reset_at` date from workspace

---

## Phase 2F: Dashboard with Real Data

### 2F.1 - Live Stats

- "Searches This Month": COUNT from `search_history` where `created_at` is current month
- "Profiles Enriched": COUNT from `enrichment_jobs` with status "completed"
- "Lists Created": COUNT from `influencer_lists`
- Replace "Avg. Engagement" with "Saved Searches": COUNT from `saved_searches`

### 2F.2 - Live Credits Card

- Pull real `search_credits_remaining` and `enrichment_credits_remaining` from workspace
- Show actual progress bars

### 2F.3 - Recent Searches

- Fetch last 5 entries from `search_history`
- Display query, platform, result count, and time ago
- Click to re-run

---

## New Routes to Add

| Route | Page | Description |
|---|---|---|
| `/lists` | ListsPage | All influencer lists |
| `/lists/:id` | ListDetailPage | Single list with items |
| `/saved-searches` | SavedSearchesPage | Saved search filters |
| `/history` | HistoryPage | Search history log |

All routes wrapped in `ProtectedRoute` and `AppLayout`.

---

## Technical Details

### Edge Function: `search-influencers`

```text
POST /search-influencers
Auth: Bearer token (required)
Body: { query: string, platform: string, location: string }

Flow:
  1. Verify JWT, get user_id
  2. Get workspace_id via get_user_workspace_id()
  3. Check search_credits_remaining > 0
  4. Build Serper query string based on platform
  5. POST to https://google.serper.dev/search
     Headers: { X-API-KEY: SERPER_API_KEY }
     Body: { q: constructed_query, num: 20 }
  6. Parse organic[] results
  7. Upsert to influencers_cache
  8. Insert into search_history
  9. Decrement search_credits_remaining
  10. Insert into credits_usage
  11. Return { results, credits_remaining }
```

### Custom React Hooks to Create

- `useWorkspaceCredits()` - fetches and caches workspace credit info
- `useSearchHistory()` - fetches search history for workspace
- `useInfluencerLists()` - CRUD operations for lists
- `useSavedSearches()` - CRUD for saved searches

### Implementation Order

1. Store Serper API key as secret
2. Build `search-influencers` edge function
3. Wire SearchPage to edge function with results UI
4. Build Lists pages (list + detail)
5. Add "Add to List" flow on search results
6. Build Saved Searches page + save flow
7. Build History page
8. Wire live credits to sidebar
9. Update Dashboard with real data
10. End-to-end testing

