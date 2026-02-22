

# Influencer Evaluation Engine -- Phase 1

## Summary

Build an AI-powered evaluation engine that scores and ranks influencers based on engagement quality, audience authenticity, and growth patterns. Since no external demographics API is available, the system will use AI (Lovable AI / Gemini) to estimate demographics and generate comprehensive evaluation reports from publicly available profile data.

## What Gets Built

### 1. Influencer Profile Page (New Route: `/influencer/:platform/:username`)

A dedicated page for viewing a full influencer evaluation. Clicking any influencer card (in search results, lists, or campaign pipelines) will navigate here. The page will display:

- **Header**: Username, platform, follower count, profile link
- **Evaluation Score**: A composite 0--100 score combining engagement, authenticity, and growth signals
- **Engagement Intelligence Panel**: Engagement rate with industry benchmark comparison (color-coded: green if above 3%, yellow 1--3%, red below 1%)
- **Authenticity Score Panel**: AI-generated credibility rating with flags for suspicious patterns
- **Growth Analytics Panel**: Historical follower data visualization (if available from enrichment cache)
- **AI Demographics Estimate**: Estimated audience age range, gender split, and geographic breakdown inferred by AI from bio, content niche, and platform
- **Niche Classification**: Auto-assigned categories based on AI analysis of bio and content
- **Brand Safety Summary**: AI scan result for content risk factors

### 2. Enhanced `ai-insights` Edge Function (New Type: `evaluate`)

Add an `evaluate` type to the existing `ai-insights` function that takes all available influencer data and returns a structured evaluation via tool calling:

```text
Input: username, platform, followers, engagement_rate, avg_views, bio, snippet, enriched data
Output (via tool call):
  - overall_score: 0-100
  - engagement_rating: { rate, benchmark_comparison, verdict }
  - authenticity: { score: 0-100, risk_level, flags[], summary }
  - growth_assessment: { pattern, risk_flags[] }
  - estimated_demographics: { age_range, gender_split, top_countries[] }
  - niche_categories: string[]
  - brand_safety: { rating: "safe" | "caution" | "risk", flags[] }
  - recommendations: string[]
```

### 3. Evaluation Cache (Database Table: `influencer_evaluations`)

Store AI evaluation results to avoid re-running expensive AI calls:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| platform | text | Social platform |
| username | text | Influencer handle |
| evaluation | jsonb | Full AI evaluation result |
| overall_score | integer | Composite score for sorting/filtering |
| evaluated_at | timestamptz | When evaluation was generated |
| workspace_id | uuid | Workspace that ran it |

Unique constraint on `(platform, username, workspace_id)`. RLS scoped to workspace members.

### 4. Search Results Enhancement

- Add an "Evaluate" button on each search result card (gated by AI credits)
- Show the cached `overall_score` badge if an evaluation already exists
- Add sort-by-score option to search results

### 5. Evaluation Hook (`useInfluencerEvaluation`)

Client-side hook that:
1. Checks cache for existing evaluation
2. If not cached, calls the `evaluate` endpoint
3. Stores result in `influencer_evaluations`
4. Returns evaluation data + loading state

### 6. Score Badge Component (`EvaluationScoreBadge`)

A reusable component showing the 0--100 score as a color-coded circular badge:
- 80--100: Green (Excellent)
- 60--79: Blue (Good)
- 40--59: Yellow (Average)
- 0--39: Red (Poor)

Used on search cards, list items, and pipeline cards.

## Technical Details

### Files to Create

| File | Purpose |
|------|---------|
| `src/pages/InfluencerProfilePage.tsx` | Full evaluation profile page |
| `src/hooks/useInfluencerEvaluation.ts` | Hook for fetching/caching evaluations |
| `src/components/influencer/EvaluationScoreBadge.tsx` | Score badge component |
| `src/components/influencer/EngagementPanel.tsx` | Engagement analysis display |
| `src/components/influencer/AuthenticityPanel.tsx` | Authenticity score display |
| `src/components/influencer/DemographicsPanel.tsx` | Estimated demographics charts |
| `src/components/influencer/BrandSafetyPanel.tsx` | Brand safety rating display |
| `src/components/influencer/NicheTagsDisplay.tsx` | Niche category tags |

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/ai-insights/index.ts` | Add `evaluate` type with comprehensive tool-call schema |
| `src/hooks/useAIInsights.ts` | Add `evaluateInfluencer` method |
| `src/pages/SearchPage.tsx` | Add Evaluate button and score badge on result cards |
| `src/components/campaigns/KanbanCard.tsx` | Show score badge if available |
| `src/components/campaigns/CardDetailDialog.tsx` | Add "Full Evaluation" button linking to profile page |
| `src/App.tsx` | Add route for `/influencer/:platform/:username` |

### Database Migration

1. Create `influencer_evaluations` table with RLS policies
2. Unique constraint on `(platform, username, workspace_id)`
3. Index on `overall_score` for sort queries

### AI Prompt Design

The `evaluate` prompt will instruct the model to:
- Calculate engagement rate benchmarks per platform (Instagram ~1-3%, TikTok ~3-6%, YouTube ~2-5%)
- Estimate authenticity from follower-to-engagement ratios and available signals
- Infer likely audience demographics from content niche, language, and geography clues
- Classify into niche categories
- Scan snippet/bio content for brand safety concerns
- Produce a weighted composite score (40% engagement, 30% authenticity, 20% content quality, 10% growth)
