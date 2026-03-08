# Mushin — Zero-Budget Architecture Design

> **Strict $0 operating cost design for the Mushin influencer discovery platform.**
> Every infrastructure decision is constrained to free tiers, open-source software, or self-hosted solutions.
> Designed for a low-traffic startup phase with limited engineering resources.
> Last reviewed: March 2026.

---

## Constraints Reference

| Category | Rule |
|---|---|
| Infrastructure | Free tier, open-source, or self-hosted only |
| Paid proxies | Prohibited |
| Paid AI APIs | Prohibited — Groq free tier or local inference only |
| Paid search clusters | Prohibited — PostgreSQL extensions first |
| Paid cloud compute | Prohibited — Vercel / Supabase / Railway / Fly.io free tiers only |
| Heavy streaming systems | Prohibited — Kafka, Redpanda, Pulsar, etc. |
| Feature stores | Prohibited |
| OLAP warehouses | Prohibited — ClickHouse, BigQuery, Snowflake |
| Background compute | Minimised — user-triggered processing preferred |

---

## 1. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER BROWSER                               │
│                   React 18 + TypeScript + Vite                      │
│                   Tailwind CSS + shadcn/ui                          │
│                   Hosted on Vercel (free CDN edge)                  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │  HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     SUPABASE EDGE FUNCTIONS                         │
│                    Deno / TypeScript runtime                         │
│                    500k invocations / month free                    │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Auth / JWT   │  │ Plan Quotas  │  │ Business Logic           │  │
│  │ enforcement  │  │ Redis bucket │  │ (search, enrich, AI)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
           ┌────────────────────┼─────────────────────┐
           │                    │                      │
           ▼                    ▼                      ▼
┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐
│   SUPABASE DB   │  │  UPSTASH REDIS  │  │   GROQ API (free)    │
│  PostgreSQL 16  │  │   Free tier     │  │  Llama 3.3 70B       │
│  500MB free     │  │  10k req/day    │  │  14,400 req/day      │
│  + pgvector     │  │  Rate limiting  │  │  No credit card      │
│  + pg_trgm      │  │  Hot query cache│  │  required            │
│  + pg_cron      │  └─────────────────┘  └──────────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│              PYTHON ENRICHMENT WORKER (nightly only)                │
│              Railway free (500 hrs/mo) or local machine             │
│                                                                     │
│  ┌─────────────────────┐    ┌────────────────────────────────────┐  │
│  │ YouTube Data API v3 │    │ Public page scrape (last resort)   │  │
│  │ 10k units/day free  │    │ ~1 req/70s — SocialBlade, TikTok  │  │
│  │ ~1,000 full lookups │    │ 7-day cache TTL                    │  │
│  └─────────────────────┘    └────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ sentence-transformers (local)                               │    │
│  │ paraphrase-multilingual-MiniLM-L12-v2 (384-dim)            │    │
│  │ Generates embeddings in-process — no API call               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ FAISS offline (in-process library, no service)              │    │
│  │ Builds nightly lookalike index → writes to PostgreSQL       │    │
│  │ creator_lookalikes table: plain SELECT at query time        │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

| Layer | Technology | Why | Cost |
|---|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite | Already built; fast, type-safe | $0 |
| **Styling** | Tailwind CSS + shadcn/ui | Already integrated | $0 |
| **Frontend host** | Vercel free | CDN edge, 100GB bandwidth/mo, PR previews | $0 |
| **Edge functions** | Deno / TypeScript (Supabase) | Supabase-native, 500k invocations/mo free | $0 |
| **Database** | PostgreSQL 16 (Supabase free) | 500MB, pgvector, pg_trgm, pg_cron built in | $0 |
| **Full-text search** | PostgreSQL FTS + pg_trgm | No extra service, GIN-indexed tsvector | $0 |
| **Fuzzy name matching** | pg_trgm `%` operator | Same GIN index, Roman-Urdu tolerant | $0 |
| **Vector search** | pgvector HNSW (0–30k creators) | Already provisioned, no extra service | $0 |
| **Lookalike** | FAISS offline → `creator_lookalikes` table | In-process library, results stored as SQL | $0 |
| **Rate limiting** | Upstash Redis free | 10k req/day token buckets | $0 |
| **Hot query cache** | Upstash Redis free | Same free allowance, 1hr TTL | $0 |
| **LLM / AI insights** | Groq free (Llama 3.3 70B) | 14,400 req/day, no card required | $0 |
| **Embeddings** | sentence-transformers (local Python) | In-process in enrichment worker | $0 |
| **YouTube enrichment** | YouTube Data API v3 | 10k units/day official, no billing | $0 |
| **Scraping** | aiohttp + BeautifulSoup4 (Python) | Public pages only, slow rate | $0 |
| **Enrichment runtime** | Railway free (500 hrs/mo) | ~120 hrs/mo nightly jobs | $0 |
| **Auth** | Supabase Auth (included) | JWT, magic links, Google OAuth | $0 |
| **Payments** | Stripe (no monthly fees — per-transaction only) | Activated only when revenue exists | $0 |
| **Total monthly** | | | **$0** |

---

## 3. Frontend Architecture

### Hosting

Vercel free tier: 100 GB/mo bandwidth, unlimited deployments, automatic preview URLs per PR, built-in CDN across 70+ edge locations. No configuration required beyond `vercel.json` (already in repo).

### Bundle Strategy

Keep the initial JS bundle below 200KB gzipped. Mushin's current stack (Vite + React 18 + shadcn/ui) achieves this with code-splitting per route. Profile pages, admin pages, and billing pages are lazy-loaded — they are not part of the initial bundle that every visitor downloads.

```typescript
// src/App.tsx — route-level code splitting (already implemented)
const LandingPage    = lazy(() => import('./pages/LandingPage'));
const SearchPage     = lazy(() => import('./pages/SearchPage'));
const ProfilePage    = lazy(() => import('./pages/InfluencerProfilePage'));
const AnalyticsPage  = lazy(() => import('./pages/AnalyticsPage'));
```

### Client-Side Caching

React Query (already in the project) provides automatic stale-while-revalidate caching for all API responses. Configure per-query cache windows to reduce edge function invocations against the free limit:

| Query type | staleTime | gcTime |
|---|---|---|
| Creator search results | 5 minutes | 30 minutes |
| Influencer profile | 10 minutes | 1 hour |
| AI insights | 30 minutes | 2 hours |
| Lookalike results | 30 minutes | 2 hours |
| User plan/credits | 30 seconds | 5 minutes |

This means a user refreshing the search page sees cached results immediately without generating a new edge function call — critical for staying within the 500k/mo free invocation limit.

### Static Asset Budget

| Asset | Budget |
|---|---|
| Total JS (gzipped) | < 220KB |
| CSS (gzipped) | < 30KB |
| Images | WebP, lazy loaded, max 120KB each |
| Fonts | Roboto subset via Google Fonts CDN (already configured) |

---

## 4. Backend Architecture

### Principle: Serverless-First, No Persistent Services

The backend is entirely Supabase Edge Functions (Deno/TypeScript). No always-on server. No Express app. No Node.js process to keep alive. Each edge function is a stateless handler that wakes on request and terminates within milliseconds.

### Edge Function Invocation Budget

Supabase free tier: **500,000 invocations/month**.

At 500k invocations, with a typical session generating ~20 edge function calls (search × 5, profile views × 5, auth × 3, misc × 7), the free budget supports approximately:

```
500,000 invocations ÷ 20 calls/session = 25,000 sessions/month
25,000 sessions ÷ 30 days = ~833 sessions/day → sufficient for early-stage
```

With React Query client-side caching reducing repeat calls, the effective daily active user ceiling is closer to **2,000–3,000 DAU** before the invocation limit becomes a concern.

### Function Grouping by Domain

```
supabase/functions/
│
├── Auth & Account
│   ├── check-subscription/        Plan status + credit balance
│   ├── delete-account/            GDPR account removal
│   └── export-user-data/          GDPR data export
│
├── Search & Discovery
│   ├── search-influencers/        PostgreSQL FTS + pg_trgm search
│   ├── search-natural/            Groq LLM query parsing → structured filters
│   └── find-lookalikes/           SELECT from creator_lookalikes table (pre-computed)
│
├── Profile & Enrichment
│   ├── enrich-influencer/         YouTube API + scrape trigger (user-triggered only)
│   ├── generate-public-profile/   Public shareable profile page
│   └── generate-embeddings/       Batch embedding trigger (service role only)
│
├── AI Intelligence
│   ├── ai-insights/               Groq LLM narrative generation
│   ├── classify-niche/            Rule-based + Groq fallback classification
│   └── detect-bot-entendre/       Signal analysis, feedback loop
│
├── Campaigns
│   ├── fetch-campaign-metrics/    Campaign performance reads
│   ├── generate-tracking-link/    Click tracking URLs
│   └── send-outreach-email/       Transactional email via Resend (free 3k/mo)
│
└── Billing & Admin
    ├── create-checkout/            Stripe checkout session
    ├── customer-portal/            Stripe billing portal
    ├── generate-invoice/           PDF invoice generation
    └── admin-*/                    Admin-only management functions
```

### Authentication Flow

```
Browser → POST /auth/v1/token (Supabase Auth)
        ← JWT (RS256, 1hr expiry)

Edge function receives JWT:
  1. Verify signature using SUPABASE_JWT_SECRET
  2. Extract auth.uid() → user_id
  3. Check RLS policies (enforced at PostgreSQL level)
  4. Check plan limits (Redis token bucket)
  5. Execute business logic
```

All user data access is gated by Row Level Security policies enforced at the database layer — not application layer. No authenticated user can read another user's data regardless of what the edge function does.

---

## 5. Database Strategy

### Schema Overview

```sql
-- Core creator data
influencers_cache          -- search index (username, platform, followers, niche, city)
influencer_profiles        -- enriched data (bio, engagement_rate, embedding vector)
creator_lookalikes         -- pre-computed FAISS results (creator_id, similar_id, similarity)

-- Search support
search_cache               -- cached query results (query_hash, results_json, expires_at)
scrape_cooldowns           -- domain backoff tracking (domain, cooldown_until)

-- User data
users                      -- workspace settings, plan references
user_credits               -- credit balances (search_credits, enrichment_credits)
credit_transactions        -- audit log of credit changes

-- Campaigns & collaboration
campaigns                  -- campaign metadata
campaign_influencers       -- junction: campaign ↔ creator
pipeline_cards             -- Kanban pipeline state
outreach_log               -- email outreach history
influencer_lists           -- saved creator lists

-- AI & signals
bot_detection_feedback     -- user corrections on bot analysis
support_tickets            -- user support requests
```

### Index Design

Every query pattern gets its own index. PostgreSQL's query planner cannot use a general index effectively for the compound filter queries Mushin runs.

```sql
-- Full-text search: computed tsvector column
ALTER TABLE influencers_cache
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(username, '')      || ' ' ||
      coalesce(display_name, '') || ' ' ||
      coalesce(niche, '')        || ' ' ||
      coalesce(city, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_ic_search_vector
  ON influencers_cache USING GIN(search_vector);

-- Fuzzy name matching (Roman-Urdu typo tolerance)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_ic_username_trgm
  ON influencers_cache USING GIN(username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ic_displayname_trgm
  ON influencers_cache USING GIN(display_name gin_trgm_ops);

-- Compound filter partial indexes (platform-scoped for planner efficiency)
CREATE INDEX IF NOT EXISTS idx_ic_ig_followers
  ON influencers_cache(followers) WHERE platform = 'instagram';
CREATE INDEX IF NOT EXISTS idx_ic_tt_followers
  ON influencers_cache(followers) WHERE platform = 'tiktok';
CREATE INDEX IF NOT EXISTS idx_ic_yt_followers
  ON influencers_cache(followers) WHERE platform = 'youtube';

CREATE INDEX IF NOT EXISTS idx_ic_niche_city
  ON influencers_cache(niche, city);
CREATE INDEX IF NOT EXISTS idx_ic_engagement
  ON influencers_cache(engagement_rate DESC NULLS LAST);

-- pgvector HNSW for similarity queries (up to 30k creators)
CREATE INDEX IF NOT EXISTS idx_ip_embedding_hnsw
  ON influencer_profiles USING hnsw(embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 128);

-- Lookalike pre-computed results
CREATE INDEX IF NOT EXISTS idx_cl_creator
  ON creator_lookalikes(creator_id);

-- Search cache lookup
CREATE INDEX IF NOT EXISTS idx_sc_hash
  ON search_cache(query_hash) WHERE expires_at > now();
```

### Query Pattern: Compound Creator Search

```sql
-- Used by search-influencers edge function
SELECT
  ic.id,
  ic.username,
  ic.display_name,
  ic.platform,
  ic.followers,
  ic.engagement_rate,
  ic.niche,
  ic.city,
  ic.iq_score,
  similarity(ic.display_name, $1) AS name_score
FROM influencers_cache ic
WHERE
  (
    ic.search_vector @@ plainto_tsquery('simple', $1)
    OR ic.display_name % $1          -- pg_trgm fuzzy match
    OR ic.username    % $1
  )
  AND ($2::text[]    IS NULL OR ic.platform = ANY($2))
  AND ($3::int       IS NULL OR ic.followers >= $3)
  AND ($4::int       IS NULL OR ic.followers <= $4)
  AND ($5::float     IS NULL OR ic.engagement_rate >= $5)
  AND ($6::text      IS NULL OR ic.niche = $6)
  AND ($7::text      IS NULL OR ic.city  = $7)
ORDER BY
  name_score DESC,
  ic.iq_score DESC
LIMIT 20 OFFSET $8;
```

### Credit Consumption (Atomic Functions)

Credit checks and decrements are atomic PostgreSQL functions — no race condition between "check balance" and "deduct" is possible:

```sql
-- consume_search_credit: returns TRUE if credit was available and consumed
CREATE OR REPLACE FUNCTION consume_search_credit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_credits INT;
BEGIN
  SELECT search_credits INTO v_credits
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;                     -- row-level lock

  IF v_credits IS NULL OR v_credits <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE user_credits
  SET search_credits = search_credits - 1,
      updated_at     = now()
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### pg_cron Scheduled Jobs

Supabase includes pg_cron. Use it to replace background processes:

```sql
-- Purge expired search cache rows (nightly, low I/O)
SELECT cron.schedule(
  'purge-search-cache',
  '0 3 * * *',
  $$ DELETE FROM search_cache WHERE expires_at < now() $$
);

-- Mark creators stale for re-enrichment queue (nightly)
SELECT cron.schedule(
  'mark-stale-creators',
  '30 2 * * *',
  $$
    UPDATE influencer_profiles
    SET enrichment_status = 'stale'
    WHERE enriched_at < now() - INTERVAL '7 days'
      AND enrichment_status = 'success'
  $$
);

-- Reset monthly credits on billing anniversary
SELECT cron.schedule(
  'reset-credits-monthly',
  '0 0 1 * *',
  $$ SELECT reset_monthly_credits() $$
);
```

---

## 6. Search Strategy

### Three-Phase Search Evolution

#### Phase 1: PostgreSQL FTS (0–50k creators, $0)

**When to use:** From day one until query latency on complex filters consistently exceeds 150ms.

**How it works:** A GIN-indexed `tsvector` computed column on `influencers_cache` covers all keyword searches. The `pg_trgm` extension handles typo tolerance and Roman-Urdu name matching. Partial indexes on follower counts per platform allow the query planner to use efficient bitmap scans on range filters.

**Expected latency at 50k creators:**

| Query complexity | Expected latency |
|---|---|
| Keyword only | 5–20ms |
| Keyword + platform filter | 8–30ms |
| Full compound filter (platform + city + followers range + engagement + niche) | 20–80ms |
| Fuzzy name match only | 10–40ms |

All within acceptable range for a search UI (< 200ms threshold).

**Monitoring trigger:** Add Supabase query duration logging. When the 90th percentile of `search-influencers` function duration exceeds 400ms over a 7-day rolling window, move to Phase 2.

#### Phase 2: Redis Query Cache (50k–100k creators, $0)

**When to use:** When Phase 1 latency is creeping but the database is still below 80% of the 500MB free limit.

**How it works:** Before hitting PostgreSQL, the edge function checks Redis for a cached result set. Cache key is a deterministic hash of all filter parameters.

```typescript
// In search-influencers edge function
const cacheKey = `search:${hashFilters(filters)}`;
const cached   = await redis.get(cacheKey);

if (cached) {
  return new Response(cached, { headers: { "X-Cache": "HIT" } });
}

const results = await db.rpc('search_creators', filters);
await redis.setex(cacheKey, 3600, JSON.stringify(results)); // 1hr TTL
return new Response(JSON.stringify(results), { headers: { "X-Cache": "MISS" } });
```

**Cache hit rate analysis:** At early stage, search queries cluster around a small number of popular filter combinations (Karachi + fashion + Instagram, Lahore + lifestyle + TikTok, etc.). The top 20 filter combinations typically represent 60–70% of all queries. Caching these eliminates the majority of PostgreSQL load.

**Upstash Redis free allowance:** 10,000 requests/day. At 833 sessions/day × ~3 search calls each = ~2,500 search requests/day. Each search checks Redis once (GET) and may write once (SET). Total: ~5,000 Redis operations/day — well within the 10k/day free limit.

#### Phase 3: Meilisearch on Fly.io (100k+ creators, $0)

**When to use:** Only when Phase 2 is insufficient and average latency consistently exceeds 200ms AND the Fly.io free VM can be allocated without displacing a more critical service.

**Fly.io free budget:** 3 shared-cpu-1x VMs (256MB RAM, 1 shared vCPU each), 3GB total persistent volume. One VM is assigned to Meilisearch:

| Service | Fly.io VM | RAM | Use |
|---|---|---|---|
| Meilisearch | shared-cpu-1x | 256MB | Search index |
| enrichment-worker | (not needed if Railway is used) | — | — |

**Meilisearch resource estimate at 100k creators:**

| Metric | Estimate |
|---|---|
| Index size (disk) | ~140MB |
| RAM at rest | ~170MB |
| RAM during indexing | ~230MB (exceeds 256MB ceiling) |

The RAM ceiling is tight. Strategy: index writes happen in small batches (500 documents at a time) during off-peak hours. The Fly.io VM never attempts a full reindex while serving live queries.

**Sync strategy:** Supabase Database Webhook on `influencers_cache` updates → edge function → Meilisearch REST API upsert. No separate sync service required.

**Cold-start risk:** Fly.io sleeps machines after 15 minutes of inactivity. The first search query after sleep incurs a 3–8 second cold-start penalty. Mitigation: a pg_cron job pings the Meilisearch health endpoint every 10 minutes.

---

## 7. AI & Intelligence Layer

### Design Principle: Compute Offline, Serve from SQL

No AI inference happens at query time unless it is a cheap text-generation call (Groq). Vector similarity search, embedding generation, and niche clustering all run offline in the nightly Python worker and results are stored in PostgreSQL. Edge functions read pre-computed data — they never touch a model.

```
Query time:  Edge function → PostgreSQL SELECT → response   (< 10ms AI cost)
Offline:     Python worker → model inference → PostgreSQL INSERT   (nightly, free)
```

### Embedding Generation

**Model:** `paraphrase-multilingual-MiniLM-L12-v2`

- Dimensions: 384 (vs OpenAI's 1536 — 4× smaller storage)
- Language support: 50+ languages including Urdu and transliterated Roman-Urdu
- Speed: ~3,000 sentences/sec on CPU (no GPU required)
- License: Apache 2.0 — fully free to use commercially

**Input construction:**

```python
def build_embedding_input(profile: dict) -> str:
    parts = [
        profile.get("display_name", ""),
        profile.get("username", ""),
        profile.get("niche", ""),
        profile.get("city", ""),
        profile.get("bio", "")[:200],           # truncate long bios
        " ".join(profile.get("top_hashtags", [])[:10]),
    ]
    return " | ".join(filter(None, parts))
```

**Storage:** 384-dim float32 vector = 1,536 bytes per creator.

| Dataset size | Embedding storage | % of 500MB free DB |
|---|---|---|
| 10k creators | 15MB | 3% |
| 30k creators | 46MB | 9% |
| 50k creators | 77MB | 15% |

At 30k creators, pgvector uses ~9% of the database — safe. The pgvector HNSW index doubles this. **pgvector is viable to ~25k creators on the Supabase free tier** before embedding storage crowds out other tables.

### Lookalike Discovery (FAISS Offline)

FAISS is an in-process Python library (no service, no port, no deployment). It runs inside the Python enrichment worker as a nightly batch step:

```python
# worker/lookalike_compute.py
import faiss
import numpy as np
from database import fetch_all_embeddings, bulk_upsert_lookalikes

async def compute_lookalikes():
    rows    = await fetch_all_embeddings()          # [(id, embedding_bytes), ...]
    ids     = np.array([r["id"] for r in rows], dtype=object)
    vectors = np.frombuffer(
        b"".join(r["embedding"] for r in rows),
        dtype=np.float32
    ).reshape(len(rows), 384)

    # Normalise for cosine similarity via inner product
    faiss.normalize_L2(vectors)

    index = faiss.IndexFlatIP(384)                  # exact cosine search
    index.add(vectors)

    # Search top-21 (index 0 is always self, similarity = 1.0)
    k = 21
    distances, indices = index.search(vectors, k)

    lookalikes = []
    for i, (dists, idxs) in enumerate(zip(distances, indices)):
        creator_id = str(ids[i])
        for dist, idx in zip(dists[1:], idxs[1:]):     # skip self
            if idx == -1:
                continue
            lookalikes.append((creator_id, str(ids[idx]), float(dist)))

    await bulk_upsert_lookalikes(lookalikes)
    print(f"Computed {len(lookalikes)} lookalike pairs for {len(rows)} creators")
```

**Query time result:** The `find-lookalikes` edge function issues a plain SQL SELECT:

```sql
SELECT
  ic.id, ic.username, ic.display_name, ic.platform,
  ic.followers, ic.engagement_rate, ic.niche, ic.city,
  cl.similarity
FROM creator_lookalikes cl
JOIN influencers_cache ic ON ic.id = cl.similar_id
WHERE cl.creator_id = $1
ORDER BY cl.similarity DESC
LIMIT 10;
```

This executes in < 5ms regardless of total creator count. No vector math at query time.

### AI Insights (Groq Free Tier)

**Model:** Llama 3.3 70B Versatile via Groq API

**Free limits:** 30 requests/minute, 14,400 requests/day. No credit card required. Rate limits are per API key.

**Integration drop-in (OpenAI-compatible):**

```typescript
// supabase/functions/ai-insights/index.ts
const groqResponse = await fetch(
  "https://api.groq.com/openai/v1/chat/completions",
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("GROQ_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a marketing intelligence analyst. Analyse influencer data and generate concise, professional insights. Respond in English unless the platform data suggests a Urdu-speaking audience.",
        },
        { role: "user", content: buildInsightPrompt(profileData) },
      ],
      max_tokens: 400,
      temperature: 0.4,
    }),
  }
);
```

**Cache AI responses:** AI insight text is expensive (1 invocation per request). Cache the generated text in the `influencer_profiles` table under an `ai_insights_cache` JSONB column with a `ai_insights_generated_at` timestamp. Re-generate only when the profile data has changed since the last generation.

```sql
ALTER TABLE influencer_profiles
  ADD COLUMN IF NOT EXISTS ai_insights_cache     JSONB,
  ADD COLUMN IF NOT EXISTS ai_insights_generated_at TIMESTAMPTZ;
```

At 14,400 free Groq requests/day at one insight per creator profile view, the daily budget supports ~14,400 profile views that trigger fresh AI generation. With caching, this is effectively unlimited for early-stage traffic.

### Niche Classification

**Primary method:** Rule-based classification from hashtags and bio keywords. No model required for 80% of creators.

```python
NICHE_KEYWORDS = {
    "fashion":    ["fashion", "ootd", "style", "outfit", "clothing", "لباس", "فیشن"],
    "food":       ["food", "recipe", "cooking", "restaurant", "کھانا", "ریسپی"],
    "beauty":     ["beauty", "makeup", "skincare", "cosmetics", "خوبصورتی"],
    "tech":       ["tech", "technology", "gadget", "review", "unboxing", "ٹیکنالوجی"],
    "lifestyle":  ["lifestyle", "vlog", "daily", "life", "زندگی"],
    "fitness":    ["fitness", "gym", "workout", "health", "sport", "صحت"],
    "travel":     ["travel", "trip", "explore", "سفر", "tourism"],
    "education":  ["education", "learn", "tutorial", "tips", "تعلیم"],
}

def classify_niche(bio: str, hashtags: list[str]) -> str:
    text = (bio + " " + " ".join(hashtags)).lower()
    scores = {niche: 0 for niche in NICHE_KEYWORDS}
    for niche, keywords in NICHE_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                scores[niche] += 1
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "general"
```

**Fallback:** If rule-based confidence is zero, call Groq with a one-shot classification prompt. Costs 1 Groq request per ambiguous creator — acceptable given the 14,400/day budget.

### Bot Signal Analysis

Bot signal scoring is entirely rule-based — no model inference required. Signals are computed from enriched data already in PostgreSQL:

| Signal | Weight | Source |
|---|---|---|
| Follower/following ratio < 0.05 | 0.25 | enriched profile |
| Engagement rate < 0.3% with > 100k followers | 0.30 | calculated |
| Account age < 90 days with > 50k followers | 0.20 | enriched profile |
| Spike in follower growth (>50% in 30 days) | 0.15 | historical cache |
| Comment-to-like ratio < 0.01 | 0.10 | enriched profile |
| **Score ≥ 0.55** → flagged as high bot risk | | |

Results cached in `influencer_profiles.bot_signals` JSONB column. Recomputed only on profile re-enrichment.

---

## 8. Scraping Strategy

### Principle: Scrape as Little as Possible

Every scraping request is a liability: risk of IP ban, rate limit, platform ToS violation, and wasted compute. The strategy minimises scraping surface to the absolute minimum required to serve user needs.

### Priority Order for Data Acquisition

```
1. Return cached data if < 7 days old  (cost: 0 requests)
2. YouTube Data API v3 (if YouTube creator)  (cost: 1–10 API units, free to 10k/day)
3. SocialBlade public page scrape  (cost: 1 HTTP request, low block risk)
4. Platform public profile page scrape  (cost: 1 HTTP request, higher block risk)
5. Mark as enrichment_pending, inform user (cost: 0 requests)
```

Step 5 is acceptable. It is better to tell a user "this creator's data will be refreshed tonight" than to fire an aggressive scrape that gets the IP banned.

### User-Triggered Only

No background enrichment loop runs unsolicited. Enrichment fires only when:

1. A user clicks the "Enrich" button on a profile
2. A creator enters the nightly stale queue (pg_cron marks them, worker enriches them at slow rate)

This eliminates the "background scraper running 24/7" pattern entirely.

### Rate Management

```python
import asyncio, random, aiohttp
from datetime import datetime, timedelta
from database import get_cooldown, set_cooldown

DOMAIN_RATES = {
    "socialblade.com": (60, 90),      # sleep range in seconds between requests
    "www.tiktok.com":  (80, 120),
    "www.instagram.com": (90, 150),
}

async def safe_fetch(session: aiohttp.ClientSession, url: str, domain: str) -> str | None:
    # Check cooldown (4-hour backoff if previously rate-limited)
    if await get_cooldown(domain):
        return None

    min_sleep, max_sleep = DOMAIN_RATES.get(domain, (60, 90))
    await asyncio.sleep(random.uniform(min_sleep, max_sleep))

    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status == 429 or resp.status == 403:
                await set_cooldown(domain, hours=4)
                return None
            if resp.status != 200:
                return None
            return await resp.text()
    except asyncio.TimeoutError:
        return None
```

### Request Disguise (Minimal)

Without residential proxies, the only defence is making requests look like real browser traffic:

```python
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,ur;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}
```

**Realistic expectations without proxies:** Instagram will eventually block a datacenter IP. The strategy accepts this — Instagram data is the lowest priority source. YouTube API (official, free, reliable) covers YouTube creators completely. SocialBlade scraping is lenient at slow rates. TikTok public pages are moderately scrapeable at 1 req/100s.

### Nightly Worker Throughput

At 1 request per 70–90 seconds per domain, the nightly 4-hour window (2 AM–6 AM PKT) yields:

```
4 hours = 14,400 seconds
14,400s ÷ 80s avg sleep = 180 creators enriched per night
```

180 creator enrichments per night with 7-day TTL means the system can keep a live working set of **~1,260 actively maintained creator profiles** entirely fresh. For a discovery platform at early stage, this is sufficient.

### Scrape Cooldown Table

```sql
CREATE TABLE IF NOT EXISTS scrape_cooldowns (
  domain         TEXT PRIMARY KEY,
  cooldown_until TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Edge function readable: is this domain currently blocked?
CREATE OR REPLACE FUNCTION is_domain_on_cooldown(p_domain TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM scrape_cooldowns
    WHERE domain = p_domain
      AND cooldown_until > now()
  );
$$ LANGUAGE sql STABLE;
```

---

## 9. Caching & Performance Optimisation

### Cache Hierarchy

```
Layer 1: React Query (browser)
  - In-memory, per-session
  - staleTime: 5–30 minutes depending on query type
  - Eliminates repeat edge function calls within a session

Layer 2: Upstash Redis (edge)
  - Shared across all users and sessions
  - Search results: 1-hour TTL keyed by filter hash
  - Rate limit buckets: per-user, per-plan
  - 10k requests/day free limit

Layer 3: PostgreSQL (persistent application cache)
  - search_cache table: query results cached by hash, 1-hour TTL
  - ai_insights_cache: JSONB in influencer_profiles, no TTL (invalidate on re-enrich)
  - creator_lookalikes: no TTL (nightly refresh via worker)
  - influencer_profiles: full enriched data, 7-day TTL
```

### Cache Key Schema

```typescript
// Deterministic cache key from search filters
function hashFilters(filters: SearchFilters): string {
  const sorted = JSON.stringify({
    q:          filters.query?.toLowerCase().trim() ?? "",
    platform:   (filters.platforms ?? []).sort().join(","),
    follower_min: filters.minFollowers ?? 0,
    follower_max: filters.maxFollowers ?? 999_000_000,
    engagement:   filters.minEngagement ?? 0,
    niche:        filters.niche ?? "",
    city:         filters.city ?? "",
    page:         filters.page ?? 0,
  });
  // Use a fast non-cryptographic hash — results are not security-sensitive
  return btoa(sorted).slice(0, 32);
}
```

### PostgreSQL Performance Tuning

On Supabase free, `shared_buffers` and `work_mem` are already tuned by Supabase. The main application-level optimisation is avoiding N+1 query patterns:

```sql
-- Bad: N+1 (1 query to list creators, N queries for their lookalikes)
-- Good: JOIN in a single query
SELECT
  ic.*,
  COALESCE(
    json_agg(
      json_build_object('id', similar_ic.id, 'similarity', cl.similarity)
      ORDER BY cl.similarity DESC
    ) FILTER (WHERE cl.similar_id IS NOT NULL),
    '[]'
  ) AS lookalikes
FROM influencers_cache ic
LEFT JOIN creator_lookalikes cl ON cl.creator_id = ic.id
LEFT JOIN influencers_cache similar_ic ON similar_ic.id = cl.similar_id
WHERE ic.id = ANY($1::UUID[])
GROUP BY ic.id;
```

### Edge Function Response Compression

All edge function responses should include `Content-Encoding: br` (Brotli) for JSON payloads > 1KB. Supabase Edge Functions support this natively — add the `Accept-Encoding: br` header detection:

```typescript
const body = JSON.stringify(results);
return new Response(body, {
  headers: {
    "Content-Type":  "application/json",
    "Cache-Control": "public, max-age=300",    // allow CDN caching of public data
  },
});
```

---

## 10. Module Breakdown

### Frontend Modules (`src/modules/`)

```
src/modules/
├── index.ts                        ← System barrel export
│
├── search/
│   ├── index.ts                    ← keyword-engine, platform-scanner, ranking exports
│   ├── keyword-engine/             ← useSavedSearches, useSearchHistory
│   ├── platform-scanner/           ← Platform type, PlatformScanResult
│   └── ranking/                    ← rankResults() client-side sort utility
│
├── profiles/
│   ├── index.ts                    ← fetcher, display, normalization exports
│   ├── fetcher/                    ← useInfluencerProfile hook
│   ├── display/                    ← InfluencerProfilePage component
│   └── normalization/              ← normalizeUsername(), bothVariants()
│
├── enrichment/
│   ├── index.ts                    ← ON-DEMAND ONLY barrel (no auto-trigger exports)
│   ├── bot-analysis/               ← useInfluencerEvaluation hook
│   └── audience-analysis/          ← useAIInsights hook
│
├── campaigns/
│   └── index.ts                    ← useCampaigns, useCampaignActivity, usePipelineCards
│
└── auth/
    └── index.ts                    ← AuthContext, useAdminPermissions
```

### Backend Modules (`supabase/functions/_shared/`)

```
supabase/functions/_shared/
├── bot_signals.ts      analyzeFullBotSignals() — rule-based scoring, no model
├── engagement.ts       calculateEngagementRate(), isEngagementSuspicious()
├── followers.ts        parseFollowerCount(), normalizeFollowers()
├── geo.ts              detectCity(), normalizePakistanCity()
├── niche.ts            classifyNiche() — keyword rules + Groq fallback
├── platform.ts         detectPlatform(), validatePlatformHandle()
├── rate_limit.ts       checkRateLimit() — Redis token bucket
└── verify_hmac.ts      verifyWebhookSignature() — Stripe webhook security
```

### Python Worker Modules (`worker/`)

```
worker/                             ← Not yet created; created when first needed
├── enricher.py         Main nightly loop — orchestrates all enrichment
├── youtube_api.py      YouTube Data API v3 channel enrichment
├── scraper.py          aiohttp + BeautifulSoup4 public page scraping
├── embedder.py         sentence-transformers embedding generation
├── lookalike.py        FAISS offline index build + creator_lookalikes upsert
├── niche_classifier.py Rule-based + Groq fallback niche classification
└── database.py         asyncpg connection pool + query helpers
```

---

## 11. Cost Justification

### Monthly Cost Breakdown

| Service | Free Allowance | Mushin Projected Usage | Projected Cost |
|---|---|---|---|
| **Vercel** (frontend hosting) | 100 GB bandwidth, unlimited deployments | < 5 GB/mo at early stage | $0 |
| **Supabase** (DB + edge functions) | 500MB DB, 500k invocations/mo, 2GB bandwidth | < 300MB DB, < 200k invocations, < 1GB bandwidth | $0 |
| **Upstash Redis** (cache + rate limiting) | 10k requests/day | ~5,000 req/day (search cache + rate checks) | $0 |
| **YouTube Data API v3** (enrichment) | 10,000 units/day | ~1,000 units/day (200 creator lookups × ~5 units avg) | $0 |
| **Groq API** (LLM / AI insights) | 14,400 req/day (Llama 3.3 70B) | ~500 req/day (cached after first generation) | $0 |
| **Railway** (nightly Python worker) | 500 execution hours/month | ~120 hrs/mo (4 hrs/night × 30 nights) | $0 |
| **Fly.io** (Meilisearch — Phase 3 only) | 3 shared VMs + 3GB volume | 1 VM + 1GB volume (Phase 3 only) | $0 |
| **Stripe** (payments) | No monthly fee — per-transaction processing only | Activated only when first subscription revenue exists | $0 |
| **Resend** (email) | 3,000 emails/month free | < 500 transactional emails/mo | $0 |
| **Google Fonts** (Roboto) | Unlimited CDN | As needed | $0 |
| **Total** | | | **$0/month** |

### Invocation Budget Scenario

```
Assumption: 500 daily active users (DAU)

Per-session edge function calls:
  - Auth check on load:        1 call
  - Search (avg 3 per session): 3 calls
  - Profile views (avg 2):     2 calls
  - AI insights (1 per visit):  1 call (cached 80% of time → 0.2 actual calls)
  - Other (plan check, etc.):  2 calls
  Total per session:           ~9.2 edge function calls

Daily:   500 DAU × 9.2 = 4,600 invocations/day
Monthly: 4,600 × 30   = 138,000 invocations

Free limit: 500,000 / month
Headroom:   362,000 invocations buffer → supports 3.6× traffic growth before upgrade needed
```

### Database Size Budget

```
Table sizes at 10k creators:
  influencers_cache:         ~  50MB (10k rows with indexes)
  influencer_profiles:       ~  40MB (10k rows with enriched JSON)
  embedding vectors (384-dim): ~ 15MB (10k × 1.5KB)
  pgvector HNSW index:        ~ 20MB
  creator_lookalikes:         ~ 10MB (10k × 20 pairs × ~50 bytes)
  All other tables combined:  ~ 20MB
  Total:                      ~155MB (31% of 500MB free limit)

Runway to free tier limit:   ~22k creators before Supabase Pro required
Supabase Pro ($25/mo) limit: 8GB database → supports ~900k creators
```

---

## 12. Scaling Escape Plan

When any single constraint is hit, the minimum spend to resolve it is identified below. Never upgrade everything at once — find and fix the specific bottleneck.

### Escape Triggers

| Threshold Hit | Constraint | Minimum Fix | Monthly Cost Increase |
|---|---|---|---|
| DB > 350MB | Supabase free DB saturating | Supabase Pro | +$25/mo |
| 500k edge invocations/mo | Daily active users ~833, growing | Supabase Pro | +$25/mo (same upgrade) |
| Search P90 latency > 400ms | PostgreSQL FTS insufficient | Meilisearch on Fly.io free VM | +$0 |
| 10k YouTube API units/day | Enrichment demand > 1,000 creators/day | YouTube API quota increase request (free, submit to Google) | +$0 |
| Groq free rate limit hit (14,400/day) | AI insights at scale without caching | Improve AI response caching | +$0 |
| Railway 500 hrs/mo used | Worker running > ~16 hrs/day | Migrate worker to Fly.io free VM | +$0 |
| pgvector slowing at 25k+ creators | HNSW index degrading | Keep pgvector + move to FAISS-only offline | +$0 |

### The Single Best First Investment

**Supabase Pro at $25/month** unlocks:
- DB limit: 500MB → 8GB (supports ~22k → ~900k creators)
- Edge invocations: 500k/mo → 2M/mo (supports ~3.6× → ~14.5× current DAU)
- Bandwidth: 2GB → 50GB
- Point-in-time recovery (critical once real user data is at stake)
- No change to application code required

This single upgrade extends the zero-infrastructure architecture to approximately **$3,000 MRR** before any further infrastructure spend is necessary.

### Scale Progression

```
Phase 0 — Pre-launch ($0/mo)
  Infra:   Supabase free + Vercel free + Railway free + Upstash free
  Scale:   0–500 DAU, 0–10k creators, 0–200k invocations/mo
  Action:  None

Phase 1 — Early traction ($25/mo)
  Trigger: DB > 350MB OR invocations > 400k/mo OR first paying customer
  Change:  Upgrade Supabase to Pro
  Scale:   500–3,000 DAU, 10k–250k creators

Phase 2 — Growth ($25/mo, no change)
  Trigger: Search P90 > 400ms
  Change:  Deploy Meilisearch on Fly.io free VM (no cost increase)
  Scale:   250k–500k creators with faster search

Phase 3 — Revenue-positive ($75–125/mo)
  Trigger: Monthly revenue > $2,000 (5% infra/revenue ratio)
  Change:  Supabase Team ($599/mo) OR self-hosted PostgreSQL on Hetzner (~$35/mo)
           Qdrant single-node for ANN (Qdrant Cloud Starter: $25/mo)
  Scale:   500k–2M creators, 10k+ DAU

Phase 4 — Scale ($500+/mo, revenue justified)
  Trigger: Monthly revenue > $10,000
  Change:  Evaluate Typesense Cloud cluster, self-hosted infra, dedicated workers
  Scale:   Millions of creators, enterprise clients
```

### What Never Changes (Stable Across All Phases)

- React + TypeScript + Vite frontend
- Supabase Auth (JWT, RLS) — migration cost too high to justify
- Deno/TypeScript edge function pattern
- PostgreSQL as the relational source of truth
- Upstash Redis for rate limiting
- Stripe for payments
- pg_cron for scheduled jobs

The architecture is designed so that scaling is **additive** (new services layered on) rather than **replacement** (rewrites). Each phase adds one new service; nothing from a previous phase is discarded.
