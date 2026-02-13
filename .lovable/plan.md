# Phase 5: AI Layer (Summaries, Fraud Detection, Recommendations)

## Overview

Add AI-powered intelligence across the platform using Lovable AI (Google Gemini) to help users evaluate influencers faster, detect suspicious profiles, and get smart campaign recommendations.

---

## 5.1 AI Infrastructure

### Edge Function: `supabase/functions/ai-insights/index.ts`

A single edge function with branching logic based on `type` parameter:

- **`summarize`** — Generate a concise influencer profile summary from their data
- **`fraud-check`** — Analyze an influencer's metrics for red flags (fake followers, engagement anomalies)
- **`recommend`** — Suggest next actions for a campaign based on pipeline state and goals

**Model**: `google/gemini-3-flash-preview` (fast, cost-efficient for all three use cases)

**Auth**: Validates JWT via `getClaims()`, no additional secrets needed (`LOVABLE_API_KEY` is pre-provisioned).

---

## 5.2 Influencer Profile Summary

### What it does
Generates a 2-3 sentence summary of an influencer based on their cached data (followers, engagement rate, avg views, platform, niche, location).

### Integration Points

- **CardDetailDialog**: Add an "AI Summary" section that auto-generates on open (with a refresh button)
- **Search results**: Optional "Summarize" button on each result card

### UX
- Shows a skeleton loader while generating
- Caches the summary in component state (not DB) to avoid unnecessary calls
- Non-streaming (short response, invoke pattern)

---

## 5.3 Fraud Detection

### What it does
Analyzes influencer metrics and flags suspicious patterns:
- Follower/engagement ratio anomalies
- Sudden follower spikes (if historical data available)
- Low avg views relative to follower count
- Generic/bot-like content patterns

Returns a **risk score** (low/medium/high) and **specific flags** with explanations.

### Integration Points

- **CardDetailDialog**: "Fraud Check" button → shows risk badge + flag list
- **KanbanCard**: Small risk indicator dot (green/yellow/red) after analysis
- **Batch analysis**: Option to run fraud check on all cards in a stage

### Data Model

Store results in `pipeline_cards.data` JSONB (no new table needed):
```json
{
  "ai_fraud_check": {
    "risk": "medium",
    "flags": ["Engagement rate (8.5%) unusually high for 500K followers"],
    "checked_at": "2026-02-13T..."
  }
}
```

### Edge Function Logic
Uses tool calling to extract structured output:
```
tools: [{
  type: "function",
  function: {
    name: "fraud_analysis",
    parameters: {
      properties: {
        risk: { type: "string", enum: ["low", "medium", "high"] },
        flags: { type: "array", items: { type: "string" } },
        summary: { type: "string" }
      }
    }
  }
}]
```

---

## 5.4 Campaign Recommendations

### What it does
Analyzes the current campaign state (budget, stage distribution, outreach history, timeline) and suggests:
- Which influencers to prioritize contacting
- Budget allocation suggestions
- Timeline warnings (e.g., "Campaign ends in 5 days, 3 influencers still in Negotiating")
- Stage progression nudges

### Integration Points

- **CampaignDetailPage**: New "AI Insights" collapsible section below stats
- Shows 3-5 actionable recommendations as cards
- Refresh button to re-generate

### Edge Function Logic
Receives full campaign context (stages, card counts, budget, dates, outreach stats) and returns structured recommendations via tool calling.

---

## 5.5 New Hook: `src/hooks/useAIInsights.ts`

Manages all AI calls with:
- `generateSummary(influencerData)` → string
- `runFraudCheck(influencerData)` → `{ risk, flags, summary }`
- `getCampaignRecommendations(campaignContext)` → `Recommendation[]`
- Loading/error states per call type
- Rate limit error handling (429/402 → user-friendly toast)

---

## Files Summary

| File | Action |
|------|--------|
| `supabase/functions/ai-insights/index.ts` | Create |
| `src/hooks/useAIInsights.ts` | Create |
| `src/components/campaigns/AIInsightsPanel.tsx` | Create (campaign recommendations) |
| `src/components/campaigns/FraudCheckBadge.tsx` | Create (risk indicator) |
| `src/components/campaigns/CardDetailDialog.tsx` | Modify (add AI summary + fraud check) |
| `src/components/campaigns/KanbanCard.tsx` | Modify (add fraud risk dot) |
| `src/pages/CampaignDetailPage.tsx` | Modify (add AI Insights section) |

## Implementation Order

1. Create `ai-insights` edge function with all three modes
2. Create `useAIInsights` hook
3. Build AI summary in CardDetailDialog
4. Build fraud detection UI (badge + card detail integration)
5. Build campaign recommendations panel
6. Add fraud risk indicator to KanbanCard
7. End-to-end testing

## Technical Considerations

- **Cost control**: Gemini Flash is cheap but calls add up. Summaries/fraud checks are cached in component state or card JSONB to avoid re-running.
- **Rate limits**: All 429/402 errors are caught and surfaced as toasts. The hook includes a simple debounce.
- **Structured output**: Fraud check and recommendations use tool calling for reliable JSON extraction — no fragile JSON parsing.
- **No streaming needed**: All three use cases return short responses; `supabase.functions.invoke()` is sufficient.
- **Privacy**: Only aggregated metrics are sent to the AI — no personal data or email addresses.
