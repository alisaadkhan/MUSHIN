# Mushin — System Architecture

> **Single source of truth** for the platform's architecture, data flows, and design decisions.
> Any developer reading this document should be able to understand how the system works
> without needing to read the entire codebase.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Diagram](#3-architecture-diagram)
4. [Module Structure](#4-module-structure)
5. [Data Flow](#5-data-flow)
6. [Search Architecture](#6-search-architecture)
7. [AI & Intelligence Layer](#7-ai--intelligence-layer)
8. [Scalability Strategy](#8-scalability-strategy)
9. [Deployment & Infrastructure](#9-deployment--infrastructure)
10. [Future Architecture Evolution](#10-future-architecture-evolution)

---

## 1. System Overview

**Mushin** is Pakistan's first AI-powered influencer intelligence platform. It helps marketing teams discover, evaluate, and activate Pakistani creators on Instagram, TikTok, and YouTube — with a focus on fraud detection, audience authenticity, and data accuracy specific to Pakistan's creator landscape.

### Core Capabilities

| Capability | Description |
|---|---|
| **Creator Discovery** | Keyword + platform + filter search across 10k+ indexed Pakistani creators |
| **IQ Score** | Composite authenticity and engagement score unique to each creator |
| **Bot Detection** | Multi-signal fraud analysis (follower velocity, engagement ratio, comment patterns) |
| **Profile Enrichment** | On-demand deep data fetch via YouTube Data API v3 + web scraping |
| **Lookalike Search** | Embedding-based semantic similarity to find creators like a given target |
| **Campaign Management** | Kanban-style outreach pipeline with email sending and tracking links |
| **AI Insights** | LLM-generated creator intelligence narratives and niche classification |
| **Multi-Workspace** | Team-based access with role permissions and credit quotas |
| **Admin Panel** | User management, credit adjustment, audit logs, and platform monitoring |

### Subscription Tiers

| Plan | Search Credits | Enrichment Credits | Campaigns | Price |
|---|---|---|---|---|
| Free | 3/reset | 2/reset | 1 | $0 |
| Pro | 500/mo | 100/mo | Unlimited | $29/mo |
| Business | 2,000/mo | 500/mo | Unlimited | $79/mo |

Credits are workspace-scoped. The `consume_search_credit` and `consume_enrichment_credit`
PostgreSQL functions enforce zero-credit guards atomically, preventing race conditions.

---

## 2. Technology Stack

### Frontend

| Technology | Role |
|---|---|
| React 18 + TypeScript | Component framework |
| Vite | Build tool and dev server |
| Tailwind CSS | Utility-first styling |
| shadcn/ui | Component primitives (Radix UI + Tailwind) |
| Framer Motion | Animation and scroll-driven effects |
| React Router v6 | Client-side routing |
| Roboto (Google Fonts) | System-wide typeface — all weights 300–900 |

### Backend (Edge Functions)

| Technology | Role |
|---|---|
| Deno (TypeScript) | Edge function runtime on Supabase |
| Supabase Edge Functions | Serverless function hosting (global CDN) |
| `@supabase/supabase-js` | Database and auth client |
| `@upstash/redis` | Rate limiting and search result caching |

### Database

| Technology | Role |
|---|---|
| PostgreSQL 16 (Supabase) | Primary relational store |
| `pgvector` | 1536-dim embedding vectors + HNSW ANN index |
| `pg_trgm` | Fuzzy string matching for creator name search |
| `pg_cron` | Scheduled background jobs (credit resets, stale profile refreshes) |
| Row Level Security | Per-user data isolation enforced at DB layer |

### External Services

| Service | Role | Free Tier |
|---|---|---|
| Upstash Redis | Rate limiting + search cache | 10k req/day |
| YouTube Data API v3 | Official YouTube channel enrichment | 10k units/day |
| Stripe | Subscription billing and payment processing | N/A |
| OpenAI API | Embeddings (text-embedding-ada-002, 1536-dim) + AI insights | Per usage |
| Groq API | LLM fallback (Llama 3.3 70B) for AI insights | 14,400 req/day free |

### Shared Edge Function Modules (`supabase/functions/_shared/`)

| Module | Responsibility |
|---|---|
| `rate_limit.ts` | IP-based token bucket rate limiter via Upstash Redis; CORS headers |
| `niche.ts` | Keyword-based niche inference from bio/username/hashtags |
| `geo.ts` | City extraction from bio text (Pakistani cities) |
| `followers.ts` | Follower count normalisation and tier bucketing |
| `engagement.ts` | Platform-specific engagement rate benchmarks |
| `bot_signals.ts` | Multi-signal bot score computation and analysis |
| `platform.ts` | Username extraction, platform validation, URL parsing |
| `verify_hmac.ts` | HMAC-SHA256 webhook signature verification (Stripe) |

---

## 3. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER / BROWSER                                    │
│              React + TypeScript (Vite) — Vercel CDN                        │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │  HTTPS / WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SUPABASE PLATFORM                                      │
│                                                                             │
│  ┌────────────────────────────┐    ┌─────────────────────────────────────┐  │
│  │   Supabase Auth            │    │   Edge Functions (Deno)             │  │
│  │   - JWT issuance           │    │                                     │  │
│  │   - Magic links            │    │   search-influencers                │  │
│  │   - OAuth providers        │    │   enrich-influencer                 │  │
│  │   - Session management     │    │   detect-bot-entendre               │  │
│  └────────────────────────────┘    │   ai-insights                       │  │
│                                    │   find-lookalikes                   │  │
│  ┌────────────────────────────┐    │   generate-embeddings               │  │
│  │   Supabase Realtime        │    │   classify-niche                    │  │
│  │   - Live Kanban updates    │    │   create-checkout                   │  │
│  │   - Notification push      │    │   generate-invoice                  │  │
│  └────────────────────────────┘    │   send-outreach-email               │  │
│                                    │   generate-tracking-link            │  │
│  ┌────────────────────────────┐    │   admin-* (6 functions)             │  │
│  │   PostgreSQL 16            │    │   + 15 more…                        │  │
│  │   + pgvector               │◄───┤                                     │  │
│  │   + pg_trgm                │    │   _shared/ modules:                 │  │
│  │   + pg_cron                │    │   rate_limit · niche · geo          │  │
│  │   + RLS policies           │    │   followers · engagement            │  │
│  └────────────────────────────┘    │   bot_signals · platform            │  │
│                                    └──────────────┬──────────────────────┘  │
└───────────────────────────────────────────────────┼─────────────────────────┘
                                                    │
                    ┌───────────────────────────────┼────────────────────┐
                    │                               │                    │
                    ▼                               ▼                    ▼
         ┌────────────────┐             ┌──────────────────┐   ┌────────────────┐
         │  Upstash Redis │             │  YouTube Data    │   │  Stripe API    │
         │  - Rate limits │             │  API v3          │   │  - Checkouts   │
         │  - Search cache│             │  - Enrichment    │   │  - Webhooks    │
         └────────────────┘             └──────────────────┘   └────────────────┘
                                                    │
                    ┌───────────────────────────────┤
                    │                               │
                    ▼                               ▼
         ┌────────────────┐             ┌──────────────────┐
         │  OpenAI API    │             │  Groq API        │
         │  - Embeddings  │             │  - LLM insights  │
         │  (ada-002)     │             │  (Llama 3.3 70B) │
         └────────────────┘             └──────────────────┘
```

---

## 4. Module Structure

### Frontend Module Hierarchy (`src/modules/`)

The frontend is organised into a three-level hierarchy: System → Core Modules → Submodules → Hooks/Components.

```
src/modules/
├── index.ts                    ← System barrel (imports all modules)
│
├── search/
│   ├── index.ts                ← Search module barrel
│   ├── keyword-engine/         ← Saved searches, search history, query building
│   ├── platform-scanner/       ← Per-platform type contracts and scan result types
│   └── ranking/                ← IQ score sorting, result ordering utilities
│
├── profiles/
│   ├── index.ts                ← Profiles module barrel
│   ├── fetcher/                ← useInfluencerProfile hook (data access layer)
│   ├── display/                ← InfluencerProfilePage component export
│   └── normalization/          ← Username @ prefix handling (bothVariants, normalizeUsername)
│
├── enrichment/
│   ├── index.ts                ← Enrichment module barrel
│   ├── bot-analysis/           ← useInfluencerEvaluation — ON-DEMAND ONLY
│   ├── audience-analysis/      ← useAIInsights — ON-DEMAND ONLY
│   └── engagement-analysis/    ← Engagement metric derivation (no public exports yet)
│
├── campaigns/
│   └── index.ts                ← useCampaigns, useCampaignActivity, usePipelineCards
│
└── auth/
    └── index.ts                ← AuthContext, useAdminPermissions
```

> **Critical rule:** All exports from `enrichment/` are on-demand only. They must never be
> called from `useEffect` on page mount. They are user-initiated via the Enrich button.

### Key Design Decision — Username Normalisation

`influencers_cache` stores usernames **with** the `@` prefix (e.g. `@hira_baig`).
`influencer_profiles` stores usernames **without** `@` (e.g. `hira_baig`).
URL routing strips `@` from the path param.

The `profiles/normalization` submodule exposes `bothVariants(username)` which returns
`[username, "@username"]` — used in all cache lookups with `.in("username", bothVariants(u))`
to resolve both formats correctly.

### Backend Module Hierarchy (`supabase/functions/`)

```
supabase/functions/
├── _shared/                    ← Shared utilities imported by all edge functions
│   ├── rate_limit.ts           ← IP rate limiting + CORS
│   ├── bot_signals.ts          ← Bot score computation (analyzeFullBotSignals)
│   ├── niche.ts                ← Niche inference
│   ├── geo.ts                  ← City extraction
│   ├── followers.ts            ← Follower tier classification
│   ├── engagement.ts           ← Engagement benchmarks
│   ├── platform.ts             ← Platform utilities
│   └── verify_hmac.ts          ← Stripe webhook signature verification
│
├── search-influencers/         ← Core search: query → Supabase FTS + pg_trgm
├── search-natural/             ← Natural language search via embedding similarity
├── enrich-influencer/          ← Deep profile enrichment (YouTube API + scraping)
├── detect-bot-entendre/        ← Bot signal analysis + user feedback loop
├── classify-niche/             ← LLM-assisted niche classification
├── ai-insights/                ← Narrative AI insights for a creator profile
├── generate-embeddings/        ← Batch embedding generation (cron-triggered)
├── find-lookalikes/            ← ANN similarity search via match_influencers RPC
├── extract-brand-mentions/     ← Brand mention extraction from post data
├── fetch-campaign-metrics/     ← Campaign performance aggregation
│
├── create-checkout/            ← Stripe checkout session creation
├── customer-portal/            ← Stripe customer portal redirect
├── check-subscription/         ← Plan status + feature access check
├── generate-invoice/           ← PDF invoice generation via pdf-lib
├── generate-tracking-link/     ← Campaign click-tracking link generation
├── track-click/                ← Click event recording for tracking links
│
├── send-outreach-email/        ← Templated email sending via SMTP
├── email-webhook/              ← Inbound email event processing
├── export-user-data/           ← GDPR data export (JSON download)
├── delete-account/             ← GDPR account deletion
├── generate-public-profile/    ← Public shareable creator profile generation
│
├── admin-list-users/           ← Admin: paginated user list
├── admin-promote-user/         ← Admin: role promotion/demotion
├── admin-suspend-user/         ← Admin: account suspension
├── admin-adjust-credits/       ← Admin: manual credit adjustment
├── admin-audit-log/            ← Admin: audit event log query
│
├── refresh-stale-profiles/     ← Cron: queue profiles with enrichment_status=pending
├── reset-free-credits/         ← Cron: monthly free-tier credit reset
├── process-enrichment-job/     ← Background enrichment job processor
├── sync-hubspot/               ← CRM sync for enterprise leads
├── seed-accounts/              ← Dev: seed initial creator accounts
└── health/                     ← Health check endpoint
```

### Database Schema (Core Tables)

```
workspaces                      ← Multi-tenant root entity
  ├── users (auth.users)        ← Authentication via Supabase Auth
  ├── workspace_members         ← User ↔ workspace membership + roles
  ├── user_roles                ← admin | super_admin role assignments
  │
  ├── influencers_cache         ← Search index (fast lookup, tsvector, pg_trgm, embedding)
  ├── influencer_profiles       ← Enriched profile data (enrichment_status, bot_signals)
  ├── creator_lookalikes        ← Pre-computed ANN lookalikes (top-20 per creator)
  │
  ├── campaigns                 ← Campaign records
  ├── pipeline_cards            ← Kanban pipeline entries per campaign
  ├── campaign_influencers      ← Campaign ↔ creator associations
  ├── tracking_links            ← Click-tracking URLs
  ├── outreach_log              ← Email outreach history
  ├── email_templates           ← Reusable outreach templates
  │
  ├── saved_searches            ← User saved search queries
  ├── search_history            ← Per-user search audit trail
  ├── influencer_lists          ← Curated creator lists
  ├── influencer_list_members   ← List ↔ creator membership
  │
  ├── subscriptions             ← Stripe subscription records
  ├── payments                  ← Payment history
  │
  ├── bot_detection_feedback    ← Human feedback on bot scores (for model improvement)
  ├── admin_audit_log           ← Admin action audit trail
  ├── support_tickets           ← User support tickets
  ├── support_ticket_replies    ← Threaded ticket replies
  └── notifications             ← In-app notification queue
```

---

## 5. Data Flow

### 5.1 Creator Discovery / Initial Ingestion

```
User submits search query (e.g. "fashion Karachi", platform: "instagram")
      │
      ▼
[search-influencers edge function]
  1. Sanitise query — strip non-alphanumeric chars, enforce 2–200 char limit
  2. Validate platform against strict allowlist (prevents injection)
  3. IP rate-limit check → Upstash Redis token bucket
  4. Authenticate user JWT → verify workspace membership
  5. Consume search credit atomically (consume_search_credit RPC)
  6. Check Upstash Redis cache → return hit if found (5-min TTL)
  7. Query influencers_cache:
       - Full-text search on tsvector column (GIN index)
       - pg_trgm fuzzy match on display_name / username
       - Filter: platform, followers range, engagement rate, city, niche
       - Order: iq_score DESC
  8. Write results to Redis cache
  9. Upsert stub records into influencer_profiles (enrichment_status = 'pending')
 10. Save to search_history
 11. Return results to client
```

### 5.2 Profile Enrichment (On-Demand)

```
User clicks "Enrich" button on profile page
      │
      ▼
[useInfluencerProfile hook] → calls enrich-influencer edge function
      │
      ▼
[enrich-influencer edge function]
  1. Authenticate user + validate enrichment credit
  2. Check enriched_at timestamp → if < 7 days: return cached data
  3. Consume enrichment credit atomically
  4. Branch by platform:
     │
     ├── YouTube → YouTube Data API v3
     │     - Fetch channel by handle → resolve channel ID
     │     - Fetch channel snippet + statistics
     │     - Fetch last 30 videos → compute avg views, engagement
     │     - Extract linked handles from bio
     │
     ├── Instagram → Public profile page scrape
     │     - HTTP GET with randomised User-Agent
     │     - Parse follower count, bio, post count from JSON-LD / meta
     │     - Apply domain cooldown on 429
     │
     └── TikTok → Public profile page scrape
           - Same pattern as Instagram
  5. Extract city from bio text (_shared/geo.ts)
  6. Compute quick bot pre-score (_shared/bot_signals.ts)
  7. Upsert into influencer_profiles with enrichment_status = 'success'
  8. Trigger generate-embeddings on next batch run
  9. Return enriched profile data
```

### 5.3 Embedding Generation (Batch — Cron-Triggered)

```
pg_cron fires → calls generate-embeddings edge function
      │
      ▼
[generate-embeddings edge function]
  1. Authenticate with service role key (internal only)
  2. Fetch up to 50 influencer_profiles WHERE embedding IS NULL
     AND enrichment_status = 'success'
  3. For each profile: concatenate username + display_name + bio + niche + city
  4. POST to OpenAI text-embedding-ada-002 API → float[1536] vector
  5. Write vector to influencer_profiles.embedding column
  6. HNSW index (pgvector) auto-updates on write
  7. Return batch count
```

### 5.4 Lookalike Search

```
User clicks "Find Similar Creators" on a profile
      │
      ▼
[find-lookalikes edge function]
  1. Authenticate user
  2. Fetch target profile embedding from influencer_profiles
  3. Call match_influencers PostgreSQL RPC:
       SELECT ... FROM influencers_cache
       WHERE 1 - (embedding <=> query_embedding) > 0.7
       ORDER BY similarity DESC
       LIMIT 6
  4. Filter out target itself (similarity = 1.0)
  5. Return top 5 lookalike profiles
```

### 5.5 User Search Query Processing

```
User types in search box → debounce 300ms
      │
      ▼
SearchPage.tsx → useCallback → fetch("/functions/v1/search-influencers")
      │
      ▼
Response renders as CreatorCard grid
      │
      ▼
User clicks creator card
      │
      ▼
navigate("/influencer/:platform/:username")  ← username WITHOUT @ prefix
      │
      ▼
InfluencerProfilePage.tsx mounts
      │
      ▼
useInfluencerProfile hook:
  1. Query influencer_profiles WHERE username = :username
  2. If not found: query influencers_cache WHERE username IN [:username, :@username]
  3. If still not found: return empty state (profile not yet enriched)
  4. Load cached bot_signals from DB only if already computed
     (NO auto-call to detect-bot-entendre on mount)
  5. Render profile — Enrich button available for on-demand enrichment
```

### 5.6 Bot Analysis (On-Demand Only)

```
User clicks "Analyse" or "Enrich" → triggers handleEnrichAndEvaluate()
      │
      ▼
[detect-bot-entendre edge function]
  Input: follower_count, following_count, post_count, avg_likes,
         avg_comments, bio, username, engagement_rate, account_age_days
      │
      ▼
  analyzeFullBotSignals() (_shared/bot_signals.ts):
  - Follower/following ratio check
  - Engagement rate vs platform benchmark
  - Comment authenticity signals
  - Bio keyword analysis (generic bios = signal)
  - Follower velocity anomalies
  - Username pattern heuristics
      │
      ▼
  Returns: { bot_score: float, confidence, signals_triggered[], verdict }
      │
      ▼
  Written to influencer_profiles.bot_signals (JSONB)
  User can submit feedback → bot_detection_feedback table → process_bot_feedback RPC
```

---

## 6. Search Architecture

### Query Pipeline

```
Raw user input
      │
      ▼
[Sanitisation]
  - Strip non-alphanumeric (except Urdu Unicode block U+0600–U+06FF, hyphens, dots)
  - Enforce 2–200 character bounds
  - Lowercase and trim
      │
      ▼
[Platform Validation]
  - Strict allowlist: instagram | tiktok | youtube
  - Reject all other values (SQL injection prevention)
      │
      ▼
[Redis Cache Check]
  - Key: hash(query + platform + filters)
  - TTL: 5 minutes
  - Cache hit: return immediately, skip DB
      │
      ▼
[PostgreSQL Query — influencers_cache]

  Primary match:
    search_vector @@ plainto_tsquery('english', :query)

  Fuzzy fallback (for misspelled names):
    display_name % :query          -- pg_trgm similarity
    OR username  % :query

  Attribute filters:
    platform         = :platform
    followers        BETWEEN :min AND :max
    engagement_rate  >= :min_er
    city             = ANY(:cities)
    niche            = ANY(:niches)

  Sort:
    1. Text search rank (ts_rank)
    2. IQ score DESC
    3. Follower count DESC
      │
      ▼
[Result Enrichment]
  - Merge with stub data from influencer_profiles if available
  - Append enrichment_status flag to each result
      │
      ▼
[Cache Write] → Redis (5-min TTL)
      │
      ▼
[Return to client]
```

### Indexes Supporting Search

```sql
-- Full-text search
CREATE INDEX idx_search_vector      ON influencers_cache USING GIN(search_vector);

-- Fuzzy name matching
CREATE INDEX idx_username_trgm      ON influencers_cache USING GIN(username gin_trgm_ops);
CREATE INDEX idx_displayname_trgm   ON influencers_cache USING GIN(display_name gin_trgm_ops);

-- Platform-partitioned follower range scans
CREATE INDEX idx_ig_followers       ON influencers_cache(followers) WHERE platform = 'instagram';
CREATE INDEX idx_tt_followers       ON influencers_cache(followers) WHERE platform = 'tiktok';
CREATE INDEX idx_yt_followers       ON influencers_cache(followers) WHERE platform = 'youtube';

-- Composite niche + city filter
CREATE INDEX idx_niche_city         ON influencers_cache(niche, city);

-- Vector ANN (HNSW — cosine distance)
CREATE INDEX idx_embedding_hnsw     ON influencers_cache
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 128);
```

### Natural Language Search

`search-natural` is a separate edge function that accepts free-text queries:

1. Embeds the query text via OpenAI `text-embedding-ada-002`
2. Calls the `match_influencers` PostgreSQL RPC
3. Returns semantically similar creators even without keyword overlap

This powers campaign brief matching: paste a campaign description, get the creators whose profiles best match the brief semantically.

### IQ Score Composition

The IQ score is a composite metric computed during enrichment:

```
IQ Score = (
  engagement_score  × 0.40   +   -- vs platform benchmark
  authenticity_score × 0.30  +   -- inverse of bot_score
  reach_score        × 0.20  +   -- follower count tier
  content_score      × 0.10      -- post frequency, quality signals
) × 100
```

Stored on `influencers_cache.iq_score` and used as the primary sort key for search results.

---

## 7. AI & Intelligence Layer

### Embedding Model

- **Model:** OpenAI `text-embedding-ada-002`
- **Dimensions:** 1536 (stored as `vector(1536)` in pgvector)
- **Input:** `username + display_name + bio + primary_niche + city` (concatenated, truncated to 8192 tokens)
- **Index:** HNSW with cosine distance operator `<=>` — sub-10ms ANN queries at 10k+ creators
- **Batch size:** 50 profiles per `generate-embeddings` invocation (memory safety)

### Lookalike Discovery

```sql
-- match_influencers PostgreSQL RPC
SELECT id, username, platform,
  1 - (embedding <=> query_embedding) AS similarity
FROM influencers_cache
WHERE (filter_platform IS NULL OR platform = filter_platform)
  AND embedding IS NOT NULL
  AND 1 - (embedding <=> query_embedding) > match_threshold
ORDER BY similarity DESC
LIMIT match_count;
```

The cosine similarity threshold of `0.7` for lookalike search ensures only meaningfully
similar profiles are returned (identical platform, similar niche + content style).

### Bot Detection System

The bot scoring algorithm, implemented in `_shared/bot_signals.ts`, evaluates:

| Signal | Weight | Description |
|---|---|---|
| Follower/following ratio | High | Very high following relative to followers → suspicious |
| Engagement rate delta | High | Rate far below platform benchmark → bought followers |
| Comment pattern | Medium | Generic comments ("nice pic!", emoji-only) → signal |
| Bio analysis | Medium | Generic or template bio → signal |
| Follower velocity | High | Sudden spikes in follower count → purchase signal |
| Username pattern | Low | Random character strings → bot-farm username |

Output: `{ bot_score: 0.0–1.0, confidence: low|medium|high, signals_triggered: string[] }`

**Human feedback loop:** Users can mark a prediction as `authentic | bot | unsure`.
The `bot_detection_feedback` table and `process_bot_feedback` RPC feed corrections back,
allowing continuous model refinement without retraining.

### AI Insights (LLM)

The `ai-insights` edge function generates natural-language creator intelligence:

1. Assembles a structured prompt from enriched profile data
2. Calls Groq API (Llama 3.3 70B) or OpenAI GPT-4o as fallback
3. Returns a 3–5 paragraph narrative covering: content style, audience fit, brand compatibility, risk signals
4. Output is cached in `influencer_profiles.ai_summary` — regenerated on user request only

### Niche Classification

`classify-niche` uses a two-tier approach:

1. **Rule-based (fast):** `_shared/niche.ts` keyword matching against bio, hashtags, and username — covers ~85% of cases
2. **LLM fallback (slow):** For ambiguous profiles, send bio text to the LLM with a structured classification prompt — returns one of 20 predefined niche categories

---

## 8. Scalability Strategy

### Current Scale Targets

| Metric | Current | Architecture handles |
|---|---|---|
| Indexed creators | ~10k | Up to 100k without service changes |
| Daily searches | <1k | Up to 10k/day on free Upstash tier |
| Concurrent users | <100 | Up to 400 (Supabase connection pool) |
| DB size | <500MB | 500MB (Supabase free limit) |

### Phase-Based Scaling Plan

#### Phase 1 — $0 Budget (Current)

```
PostgreSQL FTS + pg_trgm     → Search (works to ~50k creators)
pgvector HNSW                → Lookalike ANN (works to ~30k creators)
Upstash Redis free           → Rate limiting + query cache
YouTube Data API v3 free     → Enrichment
Supabase free tier           → All backend services
```

#### Phase 2 — $25/month (Supabase Pro)

*Trigger: DB exceeds 400MB or edge invocations exceed 400k/mo*

```
Supabase Pro                 → 8GB DB, 2M edge invocations, no pause
PostgreSQL FTS               → Still adequate to 100k creators
Upstash Redis paid           → Increase cache capacity
```

#### Phase 3 — ~$55/month

*Trigger: Search latency exceeds 200ms avg or 500k+ creators*

```
Meilisearch on Fly.io        → Replace PostgreSQL FTS for search
PostgreSQL                   → Source of truth + enrichment data only
Qdrant on Fly.io             → Replace pgvector for ANN at scale
```

#### Phase 4 — $500+/month

*Trigger: >10k DAU, >1M indexed creators, team growth*

```
AWS RDS PostgreSQL           → Self-hosted, Multi-AZ, read replicas
Typesense cluster            → 3-node HA search
Qdrant cluster               → Distributed vector search
Python Celery workers        → Horizontal enrichment scaling
ECS Fargate                  → Container-based worker orchestration
ClickHouse                   → Analytics queries (trending creators, search volume)
```

### Database Scaling Triggers

| Threshold | Action |
|---|---|
| DB size > 400MB | Upgrade to Supabase Pro |
| Concurrent connections > 350 | Add PgBouncer in transaction mode |
| Search query p95 > 200ms | Deploy Meilisearch |
| pgvector recall degrading | Migrate to Qdrant with pre-filtered ANN |
| Supabase bill > $1,200/mo | Self-host on AWS RDS |

---

## 9. Deployment & Infrastructure

### Service Map

```
┌─────────────────┬──────────────────────┬───────────────────────────────┐
│ Service          │ Host                 │ Notes                         │
├─────────────────┼──────────────────────┼───────────────────────────────┤
│ Frontend         │ Vercel               │ Auto-deploys from main branch │
│ Edge Functions   │ Supabase             │ 35 Deno functions             │
│ PostgreSQL       │ Supabase             │ pgvector, pg_trgm, pg_cron    │
│ Rate Limiting    │ Upstash (Redis)      │ Free tier — 10k req/day       │
│ Search Cache     │ Upstash (Redis)      │ Shared with rate limiter      │
│ Auth             │ Supabase Auth        │ JWT + magic link + OAuth      │
│ Realtime         │ Supabase Realtime    │ Kanban board live updates     │
│ YouTube Enrich   │ Google Cloud         │ YouTube Data API v3           │
│ LLM / AI         │ Groq API             │ Llama 3.3 70B (free tier)     │
│ Embeddings       │ OpenAI API           │ text-embedding-ada-002        │
│ Payments         │ Stripe               │ Checkout + webhooks           │
└─────────────────┴──────────────────────┴───────────────────────────────┘
```

### Environment Variables

All services are configured via environment variables. The frontend uses `VITE_` prefixed
variables (safe to expose to browser). Edge functions use server-side secrets:

```
# Frontend (Vercel — public)
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY

# Edge Functions (Supabase — secret)
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
GROQ_API_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
YOUTUBE_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
SMTP_HOST / SMTP_USER / SMTP_PASS
```

### Scheduled Jobs (pg_cron)

| Job | Schedule | Function |
|---|---|---|
| Reset free search credits | 1st of month, midnight | `reset-free-credits` |
| Refresh stale profiles | Nightly 2 AM PKT | `refresh-stale-profiles` |
| Batch embedding generation | Nightly 3 AM PKT | `generate-embeddings` |

### Security Architecture

| Layer | Mechanism |
|---|---|
| Auth | Supabase JWT — all edge functions validate `Authorization: Bearer <token>` |
| Data isolation | Row Level Security on all user-data tables (`auth.uid()` checks) |
| Admin access | `user_roles` table — `admin` and `super_admin` roles checked in RLS policies |
| Rate limiting | IP-based token bucket per endpoint category (search / enrichment / admin) |
| Input validation | Query sanitisation in every edge function — allowlists, regex stripping, length caps |
| Webhook security | HMAC-SHA256 Stripe signature verification in `_shared/verify_hmac.ts` |
| Credit integrity | Atomic PostgreSQL functions (`consume_search_credit`) — no race conditions |

---

## 10. Future Architecture Evolution

### Near-Term (3–6 months)

**Meilisearch integration:** When PostgreSQL FTS latency becomes a user-facing issue,
deploy Meilisearch on Fly.io free tier (single `shared-cpu-1x`, 3GB persistent volume).
Sync strategy: database webhook on `influencers_cache` INSERT/UPDATE → Deno edge function
→ Meilisearch REST API upsert. Meilisearch index becomes the search read layer;
PostgreSQL remains the write source of truth.

**Python enrichment worker:** A lightweight Python process (`aiohttp` + `httpx` +
`beautifulsoup4`) running as a Railway cron handles the nightly stale-profile refresh,
replacing ad-hoc manual enrichment. This decouples enrichment throughput from user
button clicks and enables consistent 200–400 creator refreshes per night.

**FAISS offline lookalike pre-computation:** Move nightly lookalike computation out of
the PostgreSQL RPC into an offline Python FAISS job. Results are written to the
`creator_lookalikes` table. UI queries become a plain `SELECT` — zero vector math at
request time.

### Medium-Term (6–12 months)

**Qdrant vector database:** Replace pgvector for ANN at >100k creators. Qdrant's
pre-filtered ANN (`filter` in the search request applied before the approximate search)
eliminates the recall collapse that pgvector experiences on filtered similarity queries
(e.g. "find creators like @x but only in Lahore with >100k followers").

**HDBSCAN niche clustering:** Offline nightly job that groups all creator embeddings
into natural clusters using HDBSCAN (density-based, handles arbitrary cluster shapes and
noise). Cluster IDs written to `influencer_profiles.cluster_id`. Enables "trending niche"
dashboard analytics and campaign-level audience clustering.

**Campaign targeting intelligence:** Given a free-text campaign brief, embed the brief
text → ANN search across all creator embeddings → return creators semantically aligned
with the campaign. Zero-shot, no labelled training data required.

### Long-Term (12+ months)

**Full intelligence platform option:**

```
Redpanda (Kafka-compatible) event bus
  → creator.enriched events
  → campaign.event events
  → user.action events

ClickHouse (columnar OLAP)
  → "average engagement by niche in Lahore, last 90 days" in <100ms
  → Enables trending creator dashboard + market intelligence reports

ML training pipeline
  → ROAS prediction model (campaign ROI forecasting)
  → Fraud detection model (replaces heuristic bot_signals with trained classifier)
  → MLflow experiment tracking

Model serving
  → BentoML or Ray Serve
  → Replaces LLM prompting for niche classification with a fine-tuned local classifier

Self-hosted infrastructure
  → AWS RDS PostgreSQL (Multi-AZ) when Supabase cost > $1,200/mo
  → Ory Kratos for auth (when auth.uid() RLS coupling becomes migration blocker)
  → ECS Fargate for enrichment workers (replaces Railway free tier)
```

### Architecture Evolution Decision Tree

```
Is search latency > 200ms p95?
  Yes → Deploy Meilisearch / Typesense
  No  → Stay on PostgreSQL FTS

Is pgvector recall dropping on filtered ANN?
  Yes → Migrate to Qdrant
  No  → Stay on pgvector

Is Supabase bill > $600/mo?
  Yes → Evaluate self-hosted PostgreSQL on AWS RDS
  No  → Stay on Supabase

Do you need analytics queries (trends, cohorts, market data)?
  Yes → Add ClickHouse
  No  → PostgreSQL is sufficient

Is enrichment blocking user experience?
  Yes → Add async Python worker + job queue
  No  → On-demand enrichment is sufficient
```

---

*Last updated: March 2026*
*Maintained by the Mushin engineering team*
