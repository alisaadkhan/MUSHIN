

# Phase 10: Remaining Implementation

After reviewing the codebase, many items from the plan are **already implemented**. Here is what remains to be done, organized by batch.

## Already Done (No Action Needed)

- `usePlanLimits` is already wired in `CampaignsPage`, `SendEmailDialog`, `CardDetailDialog`, and `AIInsightsPanel`
- Free-tier blur overlay on search results is already in `SearchPage.tsx`
- Batch fraud check per stage is already in `KanbanBoard.tsx`
- `BulkEmailDialog` already exists and is integrated
- Deep Velvet palette is applied globally

---

## Batch 10.0 -- Footer Placeholder Pages

### New Files (5 pages)
Create simple static marketing pages that reuse the dark theme layout:

- `src/pages/AboutPage.tsx` -- Company mission, team placeholder
- `src/pages/PrivacyPage.tsx` -- Privacy policy text
- `src/pages/TermsPage.tsx` -- Terms of service text
- `src/pages/CookiePolicyPage.tsx` -- Cookie policy text
- `src/pages/BlogPage.tsx` -- "Coming soon" placeholder

Each page will:
- Force dark mode like `LandingPage.tsx`
- Include the `MarketingFooter` component
- Use the animated mesh background
- Have a simple nav header with back-to-home link

### Modified Files
- **`src/App.tsx`** -- Add 5 new public routes: `/about`, `/privacy`, `/terms`, `/cookies`, `/blog`
- **`src/components/marketing/MarketingFooter.tsx`** -- Replace all `href="#"` with `<Link to="/about">`, `<Link to="/blog">`, `<Link to="/privacy">`, `<Link to="/terms">`, `<Link to="/cookies">`

---

## Batch 10.1 -- Follower Extraction and Analytics Colors

### 10.1.1 Follower Extraction in Edge Function
**Modified file:** `supabase/functions/search-influencers/index.ts`

Add an `extractFollowers(text: string): number | null` helper that parses follower counts from snippets using regex. Handles formats like:
- "12k followers" -> 12000
- "1.2M followers" -> 1200000  
- "500K+ subscribers" -> 500000
- "12,000 followers" -> 12000

Include `extracted_followers` in each result object returned to the frontend.

### 10.1.2 Follower Badges on Search Results
**Modified file:** `src/pages/SearchPage.tsx`

- Update the `SearchResult` interface to include `extracted_followers?: number`
- Display a `<Badge>` with the follower count (formatted as "12K", "1.2M") on each result card when available

### 10.1.3 Analytics Color Palette Alignment
**Modified file:** `src/pages/AnalyticsPage.tsx`

Update the hardcoded `COLORS` array from old violet/teal hues to Deep Velvet palette:
```
["#8C60F3", "#A78BFA", "#C4B5FD", "#8E8A9C", "#353148", "#E4E0EC"]
```

---

## Batch 10.2 -- CSV Export

### New File
- **`src/lib/exportCsv.ts`** -- Utility that converts an array of objects to a CSV string and triggers a browser download

### Modified File
- **`src/components/campaigns/KanbanBoard.tsx`** -- Add an "Export CSV" button in the filter toolbar that exports all pipeline cards (username, platform, stage name, agreed_rate, notes, fraud score) as a downloadable CSV file

---

## Batches 10.3-10.6 -- Deferred

These require external API credentials and significant schema additions:
- **10.3 AdTruth Fraud Detection** -- Needs AdTruth API key; existing Lovable AI fraud check is functional
- **10.4 Social Listening / UGC** -- Needs Instagram/TikTok API credentials + 2 new tables
- **10.5 Shopify Integration** -- Needs Shopify partner account + OAuth flow + 3 new tables
- **10.6 Creator Marketplace** -- Needs 2 new tables + public creator auth flow

These should be planned as individual focused batches.

---

## Files Summary

| Action | File | Batch |
|--------|------|-------|
| Create | `src/pages/AboutPage.tsx` | 10.0 |
| Create | `src/pages/PrivacyPage.tsx` | 10.0 |
| Create | `src/pages/TermsPage.tsx` | 10.0 |
| Create | `src/pages/CookiePolicyPage.tsx` | 10.0 |
| Create | `src/pages/BlogPage.tsx` | 10.0 |
| Create | `src/lib/exportCsv.ts` | 10.2 |
| Modify | `src/App.tsx` | 10.0 |
| Modify | `src/components/marketing/MarketingFooter.tsx` | 10.0 |
| Modify | `supabase/functions/search-influencers/index.ts` | 10.1 |
| Modify | `src/pages/SearchPage.tsx` | 10.1 |
| Modify | `src/pages/AnalyticsPage.tsx` | 10.1 |
| Modify | `src/components/campaigns/KanbanBoard.tsx` | 10.2 |

---

## Technical Notes

- No database migrations needed for Batches 10.0-10.2
- No new dependencies required
- The follower extraction regex: `/(\d[\d,.]*)\s*([kKmMbB](?:illion)?)?[\s+]*(followers|subs|subscribers)/i`
- CSV export uses `Blob` + `URL.createObjectURL` for browser-native download
- Footer pages are simple static components, not behind auth
- The edge function change (follower extraction) will auto-deploy

