
# Comprehensive UI Redesign -- All Pages

This is a large UI overhaul covering 11 pages. Due to the scope, it will be split into **3 implementation batches** to keep changes manageable. Each batch can be approved and tested before moving to the next.

## Batch 1: Dashboard, Analytics, Auth Pages

### 1. Dashboard (`/dashboard` -- `src/pages/Index.tsx`)

**Current state:** Shows search-oriented stats (searches, lists, saved searches), credit usage, quick start cards, and recent searches.

**Changes:**
- Replace welcome subtitle with personalized "Welcome back, {name}. Here's your overview."
- Replace 4 stat cards with: **Active Creators** (sum of pipeline cards across active campaigns), **Impressions** (placeholder/4.2M), **Avg. ROI** (placeholder/847%), **Revenue** (sum of campaign budgets). Add trend indicators.
- Replace credits + quick start section with a **two-column layout**:
  - **Left: Recent Activity** -- show campaign activity events (from `campaign_activity` table) with icons and timestamps
  - **Right: 30-Day ROI Trend** -- a Recharts line chart (placeholder data for now since no real ROI tracking exists)
- Replace "Recent Searches" section with an **Active Campaigns table** showing campaign name, creator count, budget, and status
- Keep the "New Search" button in the header

### 2. Analytics (`/analytics` -- `src/pages/AnalyticsPage.tsx`)

**Current state:** Shows total budget, influencers, emails, campaigns cards + campaign conversion bar chart + credit pie chart + monthly credit area chart.

**Changes:**
- Update header to include subheading "Deep insights into your influencer marketing performance"
- Replace 4 stat cards with 2 wider cards: **Total Creators** (pipeline card count) and **Total Reach** (placeholder/48.2M)
- Add **Platform Breakdown** horizontal bar chart -- aggregate pipeline cards by platform
- Add **Engagement Over Time** line chart (monthly, placeholder data)
- Add **Top Performing Niches** list -- aggregate from evaluation data's niche categories
- Keep existing Campaign Conversion and Credit Usage charts in a secondary section

### 3. Auth Pages (`/auth` -- `src/pages/Auth.tsx`)

**Current state:** Centered glass card with email/password, Google login, verification notice. Already quite close to spec.

**Changes:**
- Add "Sign in to your InfluenceIQ account" as subheading under "Welcome back"
- Add "or continue with" divider text between primary button and Google button
- Minor copy tweaks to match spec (placeholder text adjustments)
- Sign-up form: already has Name missing -- add first/last name fields (or keep single "Full name")

---

## Batch 2: Search, Saved Searches, History, Lists

### 4. Search (`/search` -- `src/pages/SearchPage.tsx`)

**Changes:**
- Restructure to **two-column layout**: left sidebar with filter checkboxes (platform, niche, engagement range), right area for search bar + results
- Add platform checkboxes (Instagram, TikTok, YouTube, Twitter, Twitch) instead of dropdown
- Add niche checkboxes (Fashion, Tech, Beauty, Fitness, Food, Travel, Gaming, Music)
- Add engagement rate range slider
- Change results from card grid to **table format** with columns: Platform, Name (with avatar), Followers, Engagement, Actions
- Keep existing evaluate button and add-to-list functionality

### 5. Saved Searches (`/saved-searches` -- `src/pages/SavedSearchesPage.tsx`)

**Changes:**
- Update subheading to "Quickly re-run your favorite searches"
- Add description text showing filter details (e.g., "Instagram . 100K+ followers . 4%+ engagement . Fashion")
- Keep Run and Delete buttons, polish card layout

### 6. History (`/history` -- `src/pages/HistoryPage.tsx`)

**Changes:**
- Update header to "History" with "Your recent activity timeline"
- Expand beyond search-only history to show a broader activity timeline (view profiles, list additions, campaign events)
- Add timeline-style icons per activity type
- Add right-aligned timestamp column
- Note: This would ideally need a unified `activity_log` table. For now, combine `search_history` + `campaign_activity` data.

### 7. Lists (`/lists` -- `src/pages/ListsPage.tsx`)

**Changes:**
- Switch from card grid to **table layout** with columns: Name, Creators (count), Created (date), Updated (date), Actions
- Keep existing create/delete functionality
- Add formatted dates instead of relative timestamps

---

## Batch 3: Campaigns, Settings, Billing, Influencer Profile

### 8. Campaigns (`/campaigns` -- `src/pages/CampaignsPage.tsx`)

**Changes:**
- Convert from card grid to **Kanban board layout** with columns: Draft, Active, Completed
- Show column headers with counts (e.g., "Draft (2)")
- Campaign cards show: name, creator count, budget
- Keep existing create campaign dialog and compare button
- Note: The existing `CampaignDetailPage` already has a Kanban board for pipeline stages within a campaign. This change puts a Kanban at the campaigns overview level, grouping by campaign status.

### 9. Settings (`/settings` -- `src/pages/Settings.tsx`)

**Changes:**
- Restructure tabs: Profile, Workspace (new), Integrations, Security
- **Profile tab:** Add avatar display with initials fallback, split name into first/last fields
- **Workspace tab (new):** Show workspace name, slug, member list with roles, invite button
- **Security tab:** Add 2FA toggle (UI only), active sessions list (placeholder)
- Keep existing Outreach tab content, move under Workspace or as sub-tab

### 10. Billing (`/billing` -- `src/pages/BillingPage.tsx`)

**Changes:**
- Mostly already matches spec. Minor polish:
  - Add invoice list section (placeholder if no Stripe invoice data)
  - Add payment method display section

### 11. Influencer Profile (`/influencer/:platform/:username`)

**Changes:**
- Add large circular avatar placeholder with platform icon
- Add stat badges row: Followers, Posts, Following, Engagement Rate
- Add niche label and location/join date
- Restructure demographics into **three-column layout**: Age ranges, Gender split, Top locations
- Add **Content Performance** grid cards (Reels, Stories, Posts, Lives with metrics)
- Add **Engagement Rate Over Time** line chart
- Add action buttons: "Refresh Data", "Add to List", "Add to Campaign"

---

## Technical Notes

- No database migrations required -- all changes are UI-only using existing data
- Placeholder/mock values used where real data isn't tracked yet (impressions, ROI, reach)
- Recharts already installed for chart components
- All pages continue using existing hooks (`useCampaigns`, `useSearchHistory`, etc.)
- Framer Motion animations preserved throughout

## Implementation Order

Recommend starting with **Batch 1** (Dashboard, Analytics, Auth) as these are the most impactful and self-contained.
