

# InfluenceIQ — Phase 1: Search & Discovery MVP (Revised)

## Overview
Build the core product loop: users sign up, search for influencers using live Google data, enrich profiles with real social media metrics, and save results. Dark, premium "Data Cockpit" design from day one. This revision adds reliability, observability, and onboarding polish to the original plan.

---

## 1. Design System & Layout Shell
- Dark theme with deep charcoal background (`#0a0a0a`), aurora gradient accents (violet `#7c3aed` / teal `#2dd4bf`)
- Glass-morphism cards with `backdrop-blur-xl`, `bg-white/5`, gradient borders
- Inter + JetBrains Mono typography pairing
- Responsive sidebar navigation layout
- Light/dark mode toggle (dark default, persisted to localStorage)
- Micro-interactions: button shine on hover, card scale on hover, staggered fade-in entrances

## 2. Authentication & Onboarding
- Email/password + Google OAuth via Supabase Auth
- Auto-created user profile via database trigger on signup
- Workspace creation on first login with a `settings JSONB` column for future configuration
- Credits system: free tier with 50 searches + 10 enrichments/month
- Row-level security on all tables (tested with EXPLAIN ANALYZE during development)
- **Guided onboarding flow:**
  - Quick-start checklist UI (create account → run first search → verify a profile → save to list)
  - Pre-filled sample search ("fashion blogger" in "Karachi") offered on first visit to demonstrate value instantly
  - Activation milestone tracking (checklist persisted per user)

## 3. Live Influencer Search (Core Feature)
- Search form with:
  - Niche/keyword input
  - Platform selector (Instagram, TikTok, YouTube)
  - Location dropdown focused on Pakistan cities (Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, Peshawar, Multan)
  - Follower range filter
- Edge function `search-influencers`:
  - Calls Serper.dev with simple Google Dork: `site:instagram.com "{niche}" {city}`
  - **Post-processing pipeline:** filters out non-profile URLs (excludes `/p/`, `/reel/`, `/explore/`, `/stories/`, `/tags/`)
  - **Location relevance filtering:** checks snippet/title text for city name match, ranks matched results higher
  - **Structured logging:** logs query, result count, cache hit/miss, Serper response time, errors
  - **User-friendly error handling:** clear messages for Serper failures (rate limit, timeout, server error) with retry suggestion
- Results displayed in a polished data table with "Limited Data" badges and "Verify" button
- **Pagination:** "Load more" button using Serper's page/offset parameter; display current result count and note 100-result cap
- **Search filters stored** in `search_history` alongside the query for future analytics
- Credits deducted per search (transactional — see credit safety below)

## 4. Profile Enrichment
- "Verify" button on each search result
- Edge function `enrich-profile`:
  - **Idempotency key** (hash of platform + username + date) prevents duplicate charges for the same profile
  - Creates enrichment job in `enrichment_jobs` table, deducts credits **within a single database transaction** (rollback if either fails)
  - Returns job ID for status polling
- **Background job processor** (`process-enrichment-jobs`):
  - Picks pending jobs, calls appropriate Apify actor (Instagram / TikTok / YouTube)
  - **Fallback chain:** Apify actor → basic public page fetch with proxy rotation → HTML meta-tag parsing as last resort
  - **Exponential backoff:** retries up to 3 times (delays: 2s, 8s, 32s) before marking as failed
  - **Dead-letter queue:** permanently failed jobs marked with `status: 'dead_letter'` and `failure_reason`; visible in admin view for manual review
  - **Structured logging:** logs enrichment duration, actor used, fallback level reached, cache hit/miss, errors
- Enriched data: followers, full name, bio, avatar, verified status, posts count, engagement rate, email (if available)
- **Location extraction:** after enrichment, parse city from bio text and store in cache for improved geo-accuracy
- Cache: 1-hour TTL for successes, 15-min TTL for rate-limit errors
- Loading states, progress indicators, and success/error toast feedback

## 5. Trust & Fraud Scoring
- Engagement rate calculated from enriched data (likes + comments / followers)
- Suspicion flags: unusually low engagement (<0.5%), unusually high (>15%), follower-to-post ratio anomalies
- Trust tier badges: High / Medium / Low / Suspicious — color-coded
- Filterable in search results table

## 6. Contact Email Extraction
- Extract emails from Google search snippets and enriched influencer bios
- Display with source badge ("From Bio" / "From Search")
- Basic validation (regex format check)

## 7. Save & Organize
- Save influencers to custom named lists
- Add text notes to individual influencers
- CSV export of any list
- Saved search filter presets (reusable)

## 8. Dashboard
- Overview stats cards: total searches this month, enrichments used, credits remaining
- Credit usage progress bar with color coding (green → yellow → red)
- **Credit alert:** visual warning banner when balance drops below 20%; basic email notification (via Edge Function) when threshold crossed
- Recent search history (clickable to re-run)
- Quick-access to saved lists

## 9. Database Schema (Phase 1)

All tables with RLS enabled. Key indexes noted.

- `profiles` — extends auth.users (id, full_name, avatar_url, onboarding_completed, created_at)
- `workspaces` — (id, name, owner_id, settings JSONB, created_at)
- `workspace_members` — (workspace_id, user_id, role) — index on workspace_id, user_id
- `user_roles` — (user_id, role)
- `influencers_cache` — (platform, username, data JSONB, enriched_at, city_extracted, ttl_expires_at) — **index on (platform, username)**
- `enrichment_jobs` — (id, workspace_id, platform, username, status, idempotency_key, failure_reason, attempts, created_at, updated_at) — **index on (status, created_at)**, unique index on idempotency_key
- `search_history` — (id, workspace_id, query, platform, location, filters JSONB, result_count, created_at) — index on workspace_id
- `saved_searches` — (id, workspace_id, name, filters JSONB)
- `influencer_lists` & `list_items` — standard parent/child with foreign key indexes
- `credits_usage` — (id, workspace_id, action_type, amount, reference_id, created_at) — index on workspace_id

## 10. Edge Functions
- `search-influencers` — Serper.dev integration with post-processing, pagination, structured logging
- `enrich-profile` — Apify dispatch with idempotency, transactional credit deduction, fallback chain
- `check-credits` — validates credit balance, returns remaining count and alert threshold status
- All functions: JWT validation, CORS headers, structured error responses, key metrics logging

## 11. Observability & Monitoring
- All edge functions emit structured JSON logs (timestamp, function name, workspace_id, duration_ms, status, error details)
- Key metrics tracked: cache hit rate, enrichment success rate, average enrichment duration, API error counts
- Supabase dashboard logs used for monitoring in Phase 1 (dedicated monitoring dashboard deferred to Phase 2)

---

## What's Next (Future Phases)
- **Phase 2:** Stripe billing, tiered plans, admin panel with dead-letter queue management, monitoring dashboard
- **Phase 3:** Campaign management & Kanban pipeline
- **Phase 4:** Outreach automation (email sending)
- **Phase 5:** AI layer (summaries, fraud detection, recommendations)
- **Phase 6:** Integrations (Zapier, Sheets, HubSpot, Slack)
- **Phase 7:** Advanced analytics, PDF reports, compliance

