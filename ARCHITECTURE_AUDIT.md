# Mushin — Architecture Audit

> Two-part deep evaluation of the Mushin platform architecture.
> **Part 1** — Second-level audit challenging the initial recommendations.
> **Part 2** — Full reassessment under a $0 operating budget constraint.

---

# Part 1: Second-Level Architecture Audit

---

## 1. Search Engine Deep Comparison

### Benchmark Reference Points

| Dimension | Meilisearch | Typesense | Elasticsearch |
|---|---|---|---|
| **Query latency (100k docs)** | 2–8ms | 1–5ms | 5–20ms |
| **Query latency (1M docs)** | 15–40ms | 8–25ms | 10–30ms (with warm cache) |
| **Filter cardinality** | Good — bitmap indexes | Excellent — columnar store | Excellent — inverted index + doc values |
| **Multilingual / typo tolerance** | Native DFA-based, per-language dictionaries | Native DFA, per-field typo config | Requires ngram tokenizer config + custom analyzers |
| **Urdu / Roman-Urdu** | Needs custom dictionary | Needs custom dictionary | Needs `icu_analysis` plugin + custom tokenizer |
| **Infrastructure** | Single binary, no JVM | Single binary, no JVM | JVM, multi-node cluster |
| **Memory footprint** | ~200MB per 1M docs | ~150MB per 1M docs | 1–4GB per node (JVM heap) |
| **Scaling model** | Vertical only (v1.x); sharding in v1.6+ | Multi-node clustering, auto-shard | Horizontal shard/replica model, mature |
| **Operational cost (self-hosted)** | $10–30/mo Railway | $10–30/mo Railway | $80–200/mo minimum (3-node HA) |
| **Managed cost** | Meilisearch Cloud ~$30/mo | Typesense Cloud ~$25/mo | Elastic Cloud ~$95/mo |
| **License** | MIT | GPL v3 | Elastic License 2.0 (not OSS) |

### Analysis

**Meilisearch** prioritises developer experience. Its ranking pipeline (BM25 + custom rules) is preconfigured for most use cases, and its REST API is the simplest of the three. The limitation is scaling: before v1.6, it is single-node, meaning a dataset approaching 500k creators with high write throughput (continuous enrichment) will start to show index lock contention.

**Typesense** matches or beats Meilisearch on every performance dimension while being equally simple operationally. Its columnar filter store is materially better for the filtering pattern Mushin requires — range filters on `followers` and `engagement_rate` combined with exact filters on `niche`, `city`, and `platform`. These are the dominant query shapes for influencer discovery, and Typesense's architecture handles them in a single pass without secondary index lookups. Typesense clustering is also simpler than Elasticsearch's shard model.

**Elasticsearch** is over-engineered for this use case at current scale. Its operational overhead (JVM tuning, shard splitting, Kibana/cluster health monitoring) is disproportionate. It becomes the right answer only above ~5M indexed documents with sub-5ms SLA requirements across all query types simultaneously.

### Recommendation: Typesense

Typesense over Meilisearch for one concrete reason: **compound range + term filter performance**. The dominant search pattern for Mushin is:

```
platform = "instagram"
AND city IN ["Karachi", "Lahore"]
AND followers BETWEEN 50000 AND 500000
AND engagement_rate >= 3.5
AND niche = "fashion"
```

Typesense indexes these attributes in a columnar format that performs this filter in O(n/64) with SIMD bitwise operations. Meilisearch must intersect multiple posting lists which is slower for high-cardinality numeric ranges. At 100k creators the difference is imperceptible (~3ms); at 500k it diverges to ~8ms vs ~25ms.

For Roman-Urdu/Urdu name matching, both require a custom dictionary. Typesense allows per-field `min_len_1_typo` and `min_len_2_typo` tuning, which lets you configure aggressive typo tolerance on `username` and `display_name` without polluting precision on `niche` and `city`.

**Typesense schema for Mushin:**

```typescript
{
  name: "creators",
  fields: [
    { name: "username",        type: "string"  },
    { name: "display_name",    type: "string"  },
    { name: "platform",        type: "string",  facet: true },
    { name: "niche",           type: "string",  facet: true },
    { name: "city",            type: "string",  facet: true },
    { name: "followers",       type: "int32",   facet: true },
    { name: "engagement_rate", type: "float",   facet: true },
    { name: "iq_score",        type: "float"               },
    { name: "fraud_risk",      type: "float"               },
    { name: "embedding",       type: "float[]", num_dim: 384 },
  ],
  default_sorting_field: "iq_score",
}
```

Typesense's built-in vector search (from v0.25) means the semantic similarity layer and the keyword search layer can live in the same index, avoiding a separate FAISS/Qdrant service at the cost of some ANN performance — acceptable until the dataset exceeds 200k creators.

---

## 2. Scraping & Enrichment Architecture

### The Core Problem

Instagram, TikTok, and YouTube aggressively fingerprint scraping traffic. A naive Playwright + rotating-IP setup gets blocked within hours at scale. The architecture must therefore treat detection avoidance as a first-class concern, not an afterthought.

### Full Enrichment Pipeline Design

```
[Enrich Request]
       │
       ▼
[Job Deduplication Layer]        ← Redis SET with TTL
       │                            prevents concurrent enrichment of same creator
       ▼
[Priority Queue]                 ← Celery with Redis broker
       │                            priority 1: user-triggered
       │                            priority 2: scheduled refresh (nightly cron)
       ▼
[Worker Pool — Python/Celery]
       │
       ├──► [API Enrichment Path]     ← Social Blade, RapidAPI, official APIs
       │           │                    fast, cheap, limited depth
       │           └──► Write to DB
       │
       └──► [Scraping Enrichment Path]
                   │
                   ▼
           [Browser Farm]
           ┌──────────────────────────────────────────┐
           │  Fingerprint Randomization               │
           │  - Canvas/WebGL noise injection           │
           │  - Random user-agent rotation             │
           │  - Randomised viewport + timezone         │
           │  - navigator.webdriver = false patching   │
           │                                          │
           │  Playwright + playwright-stealth plugin   │
           └──────────────────────────────────────────┘
                   │
                   ▼
           [Proxy Layer]
           ┌──────────────────────────────────────────┐
           │  Residential Proxy Pool                  │
           │  - Bright Data / Oxylabs / IPRoyal       │
           │  - City-level targeting (PK-focused)     │
           │  - Sticky sessions per creator domain    │
           │  - Automatic IP rotation on 407/429      │
           │                                          │
           │  IP Reputation Pre-check                 │
           │  - DNSBL lookup before assigning proxy   │
           │  - Score threshold: discard IPs with     │
           │    fraud score > 0.4 (IPQualityScore API)│
           └──────────────────────────────────────────┘
                   │
                   ▼
           [CAPTCHA Handler]
           ┌──────────────────────────────────────────┐
           │  Tier 1 — Avoid triggering CAPTCHAs:    │
           │  - Respect crawl delays (2–8s jitter)    │
           │  - Simulate human scroll/mouse events    │
           │  - Never scrape >3 pages per session     │
           │                                          │
           │  Tier 2 — Solve if triggered:            │
           │  - 2captcha / CapSolver for reCAPTCHA v2 │
           │  - Cloudflare Turnstile: wait + re-try   │
           │    with fresh residential IP             │
           └──────────────────────────────────────────┘
                   │
                   ▼
           [Rate Limit Controller]
           ┌──────────────────────────────────────────┐
           │  Per-domain token bucket (Redis)         │
           │  instagram.com:   10 req/min per IP      │
           │  tiktok.com:      8 req/min per IP       │
           │  youtube.com:     20 req/min per IP      │
           │                                          │
           │  Global back-pressure:                   │
           │  - Circuit breaker: open after 5 429s   │
           │  - Half-open probe: 1 request after 5m  │
           │  - Closed: resume on 200                 │
           └──────────────────────────────────────────┘
                   │
                   ▼
           [Parse + Validate]
           - Pydantic models enforce data contracts
           - If parse fails: dead-letter queue → manual review
                   │
                   ▼
           [Write to PostgreSQL]
           - influencer_profiles upsert (ON CONFLICT DO UPDATE)
           - Typesense sync webhook (HTTP POST to indexer on update)
```

### Failure Recovery

Dead-letter queues (separate Celery queue `dlq.enrichment`) capture failed tasks. A supervisor process retries DLQ entries with exponential backoff capped at 6h. After 5 cumulative failures per creator, the task is moved to a `failed_enrichments` table for analyst review and the creator's `enrichment_status` is set to `manual_required`.

### Proxy Cost Estimate

Residential proxies for Pakistan-focused scraping: ~$0.60–1.20/GB. At 500 creator enrichments/day with ~2MB data transfer each: ~$300–600/month. This justifies the API-first path (Social Blade ~$40/mo) and scraping only for profiles where API coverage fails.

---

## 3. High-Performance Backend Services

### Go vs Rust vs Node.js

#### Performance

**Rust** produces binaries within 5–10% of hand-optimised C for CPU-intensive work. For I/O-bound services (which most backend services are), all three are within 15% of each other. The difference is not latency on individual requests — it is **tail latency at high concurrency**. Rust's `tokio` async runtime produces dramatically lower p99/p999 latency than Go under GC pressure, and Node.js under the event loop's single-threaded queue.

**Go** compiles fast, has a simple concurrency model (goroutines + channels), and its GC has improved significantly — p99 pauses are now sub-1ms for most workloads. For a backend service handling <50k RPS, Go's GC is not a practical bottleneck.

**Node.js** has the lowest cold-start time of the three (critical for serverless) but suffers from single-threaded execution for CPU-bound tasks and unpredictable GC behaviour under sustained throughput.

#### Memory Safety

Rust: **compile-time guaranteed**. No null pointer dereferences, no use-after-free, no data races — all caught by the borrow checker before the binary is produced.

Go: **runtime-safe** but not compile-time. Nil pointer panics are possible and occur in production. Race conditions require the `-race` flag at test time.

Node.js: **neither**. Prototype pollution, async stack corruption, and callback ordering bugs are all runtime-only failures.

#### Concurrency Model

| | Go | Rust | Node.js |
|---|---|---|---|
| Model | M:N goroutines, cooperative preemption | async/await (tokio) or OS threads | Single-threaded event loop + worker threads |
| Best for | Many simultaneous lightweight tasks | Maximum throughput + strict tail latency | I/O-heavy, low CPU, JS ecosystem required |
| Pitfall | GC pauses under heavy allocation | Steep learning curve, borrow checker friction | CPU-bound blocks the event loop |

#### Service Allocation

| Service | Language | Rationale |
|---|---|---|
| **BFF / API gateway** | Deno (TypeScript) | Keep existing, Supabase-native, low complexity |
| **Webhook ingestion** | Go | High concurrency, simple fan-out, fast compilation for iteration |
| **Indexing pipeline** | Rust | Zero-copy parsing of large enrichment JSON payloads; tight Typesense write throughput |
| **Data pipeline / ETL** | Python | Pandas/Polars ecosystem, data science tooling, analyst-friendly |
| **Realtime event bus** | Go | goroutines map directly to per-connection streaming |
| **Embedding service** | Python (FastAPI) | sentence-transformers runs on Python; no benefit to Rust here |

**On Rust for indexing pipelines specifically:** when syncing enriched creator records from PostgreSQL into Typesense, the bottleneck is JSON deserialisation → field extraction → HTTP write. A Rust service using `serde_json` + `reqwest` + `tokio` handles this at ~80k records/sec on a single core. A Go equivalent reaches ~40k records/sec. A Node.js equivalent ~15k records/sec. For Mushin's current scale this is irrelevant. At 500k creators with nightly full re-index, Rust completes the job in ~7 seconds; Go in ~13 seconds; Node.js in ~33 seconds. Rust wins here, but Go is adequate until scale demands it.

**The firm recommendation:** Go for new backend services today. Rust for the indexing pipeline only once you have >200k creators and re-index time becomes operationally significant.

---

## 4. AI & Embedding Architecture

### Current Design Assessment

FastAPI + sentence-transformers + pgvector is correct directionally. The gaps are:

1. `pgvector` with `ivfflat` index degrades above ~500k vectors (index build time, recall drop)
2. In-process Python embedding is fine for batch but too slow for real-time similarity at query time
3. No plan for niche clustering or campaign targeting beyond raw similarity

### Expanded Architecture

#### Embedding Generation

```
Creator record upserted
        │
        ▼
[Embedding Worker — Python]
  Input: display_name + niche + bio + top_hashtags (concatenated)
  Model: paraphrase-multilingual-MiniLM-L12-v2 (384-dim)
         - Supports Urdu, Roman-Urdu, English natively
         - 14k sentences/sec on single A10 GPU
  Output: float[384] vector
        │
        ▼
  Write to:
  ├── pgvector column (source of truth)
  └── Qdrant collection (high-speed ANN queries)
```

#### Vector Store Comparison: FAISS vs Qdrant vs pgvector

| | FAISS | Qdrant | pgvector |
|---|---|---|---|
| **Type** | In-process library | Dedicated vector DB | PostgreSQL extension |
| **ANN algorithm** | HNSW, IVF, PQ | HNSW (primary) | HNSW, IVFFlat |
| **Filtering during ANN** | Post-filter only (recall loss) | Pre-filter with payload index | Post-filter only |
| **Recall @ 100k** | ~95% | ~98% | ~95% |
| **Recall @ 1M** | ~88% (IVF degrades) | ~97% (HNSW scales well) | ~85% |
| **Persistence** | Manual (save/load) | Native, WAL | PostgreSQL WAL |
| **Horizontal scaling** | Manual sharding | Native distributed mode | pgvector is single-node |
| **Payload filtering** | Not native | First-class (filters on metadata pre-search) | Not native |
| **Memory (1M 384-dim vectors)** | ~1.5GB (HNSW) | ~1.5GB (HNSW) | ~1.5GB + PG overhead |

**FAISS** is a library, not a service. It requires you to manage persistence, index rebuild, and concurrency yourself. It is ideal embedded inside a Python model server but not as a standalone search service.

**pgvector** is the path-of-least-resistance choice (already in Supabase). For Mushin's current scale (<100k creators), it is adequate. Above 200k creators, HNSW index build time and query recall both degrade enough to matter.

**Qdrant** is the correct long-term answer. Its pre-filtering capability is critical: when a user requests "find creators similar to @x but only in Lahore with >100k followers", Qdrant filters the vector space before running ANN — rather than running ANN on all 500k vectors and post-filtering the results. This prevents the recall collapse that FAISS and pgvector experience on filtered similarity queries.

### Recommendation: Dual-Write with Migration Path

```
Phase 1 (now):      pgvector for all ANN queries — already provisioned
Phase 2 (>100k):    Dual-write to Qdrant; serve similarity queries from Qdrant only
Phase 3 (>300k):    Qdrant as primary; pgvector retained as audit trail only
```

### Feature Implementations

**Influencer similarity detection:** Qdrant `/search` with `with_payload: true`, `limit: 20`, payload filter on `platform`. Returns nearest neighbours by embedding cosine distance.

**Niche clustering:** Offline job — extract all embeddings, run `HDBSCAN` (handles irregular cluster shapes, noise-tolerant, critical for real-world niche distribution). Cluster labels written to `influencer_profiles.cluster_id`. Runs nightly via Python Celery task.

```python
import hdbscan
import numpy as np

embeddings = np.array(fetch_all_embeddings())  # shape: (N, 384)
clusterer = hdbscan.HDBSCAN(min_cluster_size=15, metric='cosine')
labels = clusterer.fit_predict(embeddings)
# labels[i] == -1 → noise (outlier creator, no clear niche cluster)
```

**Lookalike creator discovery:** Given target creator's embedding, Qdrant ANN search with filters. Result set re-ranked by IQ score, then fraud risk, then follower count delta.

**Campaign targeting intelligence:** Given campaign brief (free text), generate embedding of the brief → ANN search → returns creators semantically aligned with the campaign. This is a zero-shot classifier — no labelled training data needed.

---

## 5. Supabase Vendor Lock-in Risk

### What Supabase Abstracts Away

| Feature | Supabase abstraction | Self-hosted equivalent | Migration effort |
|---|---|---|---|
| Auth | JWT + magic links + OAuth providers | Keycloak / Auth0 / Ory Kratos | High — RLS policies reference `auth.uid()` throughout |
| Realtime | Logical replication → WS | Debezium + Kafka + custom WS server | High |
| Edge Functions | Deno Deploy on managed infra | Deno Deploy paid / Fly.io / Cloudflare Workers | Medium |
| Storage | S3-compatible object store | AWS S3 / GCS | Low |
| Row Level Security | PostgreSQL native | PostgreSQL native | None — it's just SQL |
| Dashboard | Supabase Studio | pgAdmin + Grafana | Low |

### Scaling Limits

| Constraint | Free tier | Pro ($25/mo) | Team ($599/mo) | Risk |
|---|---|---|---|---|
| Database size | 500MB | 8GB | 100GB | 🟡 Hit at ~2M cached creators |
| Bandwidth | 2GB | 50GB | 200GB | 🟡 Realtime subscriptions are bandwidth-heavy |
| Edge invocations | 500k/mo | 2M/mo | Unlimited | 🟡 Enrichment function calls stack fast |
| Concurrent connections | 200 | 400 | 1000 | 🔴 Direct pg connection pool — hardest limit |
| Read replicas | None | None | Included | 🔴 All reads hit primary until Team tier |

The **connection limit** is the practical ceiling. At 400 concurrent connections (Pro), with a typical idle pool size of 5–10 per service, you can run 40–80 concurrent service instances before hitting the limit. This is sufficient for early-stage. Above ~10k daily active users, you must either upgrade to Team ($599/mo) or migrate to PgBouncer in transaction-mode pooling.

### Cost at Scale

| Monthly Active Users | Estimated DB size | Supabase cost | Equivalent AWS RDS cost |
|---|---|---|---|
| 1,000 | ~2GB | $25 (Pro) | ~$35 (db.t4g.small) |
| 10,000 | ~20GB | $25–599 | ~$100 (db.t4g.medium) |
| 100,000 | ~200GB | $599+ Enterprise | ~$400 (db.m6g.large + read replica) |
| 1,000,000 | ~2TB | Custom Enterprise | ~$1,200 (db.r6g.xlarge + Multi-AZ) |

### Mitigation Strategy (Without Full Migration)

1. **Decouple Auth immediately:** Do not hard-code `auth.uid()` RLS patterns in new tables. Use a `user_id UUID` column with application-level enforcement — this makes auth provider swap possible without rewriting policies.

2. **Isolate Realtime dependency:** Use Supabase Realtime only for collaborative features (Kanban board updates). Avoid depending on it for data pipeline events — use a separate event bus (Redis Streams or a lightweight Kafka).

3. **Use connection pooling now:** Route all application reads through `pgbouncer` in transaction mode, even on Supabase Pro. This extends the 400-connection limit by 5–10× for typical workloads.

4. **Export edge functions to portable Deno:** Ensure every edge function works with standard `Deno.serve()` — avoid Supabase-specific runtime globals. This makes Cloudflare Workers / Deno Deploy migration trivial.

### Self-Hosted Migration Trigger Points

| Signal | Action |
|---|---|
| DB size > 80GB | Evaluate AWS RDS PostgreSQL + pgBouncer |
| Monthly Supabase bill > $1,200 | Migrate to self-hosted or AWS |
| >800 concurrent connections needed | Migrate immediately |
| Need read replicas for search | Migrate or upgrade to Team tier |
| Custom WAL replication required | Self-host only |

**AWS equivalent stack** (for reference, not immediate action):

```
AWS RDS PostgreSQL 16 (Multi-AZ, db.r6g.large)   — $280/mo
AWS ElastiCache (Redis, cache.r6g.large)           — $150/mo
AWS ECS Fargate (enrichment workers)               — $80/mo
AWS ALB                                             — $20/mo
Cloudflare Workers (edge functions)                — $5/mo
Total                                               — ~$535/mo
```

This replaces Supabase Pro at roughly equivalent capability, with full operational control, at comparable cost. The migration cost (engineering time) is estimated at 6–10 weeks.

---

## 6. Long-Term System Evolution Paths

### Option A — SaaS Influencer Search Tool

The platform remains a search and discovery product. Revenue comes from subscriptions. Engineering focus is on search quality, data freshness, and UX.

**Architecture evolution:**
- Typesense cluster (3-node HA) for primary search
- Qdrant for similarity/lookalike (incremental, after 100k creators)
- Enrichment workers scaled horizontally (Python/Celery, auto-scaling on queue depth)
- PostgreSQL stays as-is through Supabase Team tier up to ~$5k MRR, then migrate to self-hosted
- Analytics: ClickHouse append-only table for search event logs — enables "trending creator" and "search volume" features
- ML: HDBSCAN niche clustering runs nightly, no model training required

**What you do NOT need:** Custom ML pipelines, real-time feature stores, model serving infrastructure, stream processing.

**Critical path:** Search quality (Typesense tuning, Roman-Urdu dictionaries, ranking formula refinement) > data freshness (enrichment pipeline reliability) > fraud detection accuracy (bot model improvement).

---

### Option B — Full Influencer Intelligence Platform

The platform expands beyond search into campaign management, contract negotiation, performance benchmarking, audience analytics, and predictive ROAS. Revenue diversifies into enterprise contracts, white-label API, and data licensing.

**Architecture evolution:**

```
┌─────────────────────────────────────────────────────────┐
│ Data Ingestion Layer                                     │
│  Kafka (or Redpanda — Kafka-compatible, Rust-native)    │
│  Topics: creator.enriched, campaign.event, user.action  │
│  Consumers: indexer, ML feature store, analytics sink   │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│ Typesense    │  │ ClickHouse   │  │ Feature Store    │
│ (search)     │  │ (analytics)  │  │ Feast + Redis    │
│              │  │              │  │ (ML features)    │
└──────────────┘  └──────────────┘  └──────────────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │ ML Training      │
                 │ - ROAS predictor │
                 │ - Fraud scorer   │
                 │ - Niche tagger   │
                 │ MLflow tracking  │
                 │ Airflow DAGs     │
                 └──────────────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │ Model Serving    │
                 │ BentoML / Ray   │
                 │ Serve           │
                 └──────────────────┘
```

**ClickHouse** is the key addition for Option B. It is a columnar OLAP engine that handles analytical queries like "average engagement rate across all creators in Lahore niche fashion over last 90 days" in milliseconds on billions of rows — queries that would bring PostgreSQL to its knees.

**Redpanda** (Kafka-compatible, written in C++) replaces or augments Redis Streams as the event bus. It provides durable, replayable event streams with consumer groups — critical for eventually-consistent feature computation across the ML pipeline.

**Airflow** for DAG orchestration of the nightly batch jobs: data freshness checks, HDBSCAN clustering runs, ClickHouse aggregation refreshes, Typesense re-indexing.

---

## 7. Final Optimized Architecture (Paid)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             MUSHIN PLATFORM                                 │
└─────────────────────────────────────────────────────────────────────────────┘

FRONTEND
  React + TypeScript + Vite
  Tailwind CSS + shadcn/ui + Framer Motion
  Hosted: Vercel (CDN edge, zero-config, PR previews)

API / BACKEND SERVICES
  ┌─────────────────────────────────────────────────────┐
  │  BFF / Edge Layer — Deno on Supabase Edge Functions │
  │  - Auth enforcement (JWT validation)                │
  │  - Plan quota checks (Redis token bucket)           │
  │  - Request routing to downstream services           │
  │  - Invoice generation, export, tracking links       │
  └─────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────┐
  │  Webhook Ingestion Service — Go + net/http          │
  │  - Stripe webhook processing                        │
  │  - Platform event ingestion (future)                │
  │  - Fan-out to Redis Streams                         │
  └─────────────────────────────────────────────────────┘

BACKGROUND WORKERS
  ┌─────────────────────────────────────────────────────┐
  │  Enrichment Workers — Python + Celery               │
  │  - API enrichment path (Social Blade, RapidAPI)     │
  │  - Scraping path (Playwright + stealth + proxies)   │
  │  - Embedding generation (sentence-transformers)     │
  │  - Dual-write to pgvector + Qdrant                  │
  │  - Nightly HDBSCAN niche clustering                 │
  │  Priority queue, DLQ, circuit breakers              │
  └─────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────┐
  │  Indexing Pipeline — Rust (when scale demands)      │
  │  - PostgreSQL CDC → Typesense sync                  │
  │  - Zero-copy JSON deserialisation                   │
  │  - Batch upsert with retry + backpressure           │
  │  (Go initially; migrate to Rust post-200k creators) │
  └─────────────────────────────────────────────────────┘

SEARCH INFRASTRUCTURE
  ┌─────────────────────────────────────────────────────┐
  │  Typesense (3-node cluster post-100k creators)      │
  │  - Creator discovery: keyword + filter queries      │
  │  - Typo tolerance for Roman-Urdu/Urdu names         │
  │  - Integrated vector search (to 200k creators)      │
  │  Managed on Typesense Cloud or self-hosted on Fly   │
  └─────────────────────────────────────────────────────┘

AI SERVICES
  ┌─────────────────────────────────────────────────────┐
  │  Embedding Service — Python FastAPI                 │
  │  - paraphrase-multilingual-MiniLM-L12-v2            │
  │  - Batch endpoint for nightly re-embedding           │
  │  - Real-time endpoint for campaign brief matching   │
  └─────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────┐
  │  Vector Search — Qdrant (phase 2, post-200k)        │
  │  - Pre-filtered ANN for similarity queries          │
  │  - Lookalike discovery, campaign targeting          │
  └─────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────┐
  │  LLM — OpenAI API (GPT-4o)                         │
  │  - AI insights narrative generation                 │
  │  - Niche classification (low-confidence fallback)   │
  └─────────────────────────────────────────────────────┘

DATABASE LAYER
  ┌─────────────────────────────────────────────────────┐
  │  PostgreSQL 16 (Supabase → self-hosted at scale)    │
  │  + pgvector (embeddings, phase 1 ANN)               │
  │  + pg_cron (nightly cache cleanup)                  │
  │  + Row Level Security                               │
  └─────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────┐
  │  Upstash Redis                                      │
  │  - Rate limiting (token buckets per plan/user)      │
  │  - Job deduplication (enrichment idempotency)       │
  │  - Celery broker                                    │
  │  - Session cache                                    │
  └─────────────────────────────────────────────────────┘

INFRASTRUCTURE PLATFORM
  Phase 1 (now):      Supabase + Vercel + Railway (workers)
  Phase 2 (>$2k MRR): + Typesense Cloud + Qdrant Cloud
  Phase 3 (>$10k MRR): Self-hosted PostgreSQL on AWS RDS,
                        workers on ECS Fargate, evaluate
                        Supabase Auth → Ory Kratos migration
  Phase 4 (>$50k MRR): Full AWS/GCP, Redpanda event bus,
                        ClickHouse analytics, Airflow DAGs
```

---

---

# Part 2: Zero-Budget Architecture Audit

> **Constraint:** $0 operating cost. All infrastructure must be free tier or self-hosted open-source. No paid proxies, no paid APIs, no paid clusters.

---

## 1. Search Engine on Free Hosting

### Reality Check on Free Tiers

Before comparing engines, the infrastructure ceiling defines everything:

| Platform | Free RAM | Free disk | Sleep on inactivity | Suitable for |
|---|---|---|---|---|
| Railway free | 512MB RAM | 1GB ephemeral | No (but 500 hrs/mo credit) | Meilisearch small dataset |
| Fly.io free | 256MB RAM (shared-cpu-1x) | 3GB persistent volume | Yes (after 15min) | Meilisearch, Typesense if tiny |
| Render free | 512MB RAM | No persistent disk | Yes (after 15min inactivity) | Not viable for search indexes |
| Supabase free | Shared PostgreSQL | 500MB | DB pauses after 1 week inactivity | pg_trgm, pgvector |
| Vercel free | N/A — serverless only | None | N/A | No long-running process |

**The critical constraint:** Meilisearch and Typesense both require persistent disk to survive restarts. Render's free tier has no persistent disk — the index is destroyed on every cold start. Fly.io's free persistent volume (3GB) is the only viable free-tier host for a dedicated search engine.

Fly.io free also sleeps after 15 minutes of inactivity, adding a cold-start penalty of ~3–8 seconds on first query after sleep. For a low-traffic early-stage product, this is acceptable.

### Dataset-Scaled Comparison

#### Up to 10k creators

| Engine | Verdict |
|---|---|
| **PostgreSQL full-text (Supabase free)** | ✅ Best option. Zero infra cost, already provisioned, sub-50ms on 10k rows with GIN index. |
| Meilisearch on Fly.io | Overkill. Extra service, cold-start risk, 10k rows is trivially fast in PostgreSQL. |
| Typesense on Fly.io | Same — unnecessary complexity at this scale. |
| pg_trgm | ✅ Good complement for fuzzy name matching on top of full-text. |

At 10k creators, PostgreSQL is the correct and only answer. No additional service is justified.

#### Up to 50k creators

PostgreSQL full-text search with a proper GIN index on a `tsvector` computed column handles 50k rows comfortably — typical query time is 5–30ms depending on filter complexity. The compound filter queries (platform + city + followers range + engagement range) benefit from a combination of:

```sql
-- Computed tsvector column for full-text
ALTER TABLE influencers_cache
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(username,'') || ' ' ||
      coalesce(display_name,'') || ' ' ||
      coalesce(niche,'') || ' ' ||
      coalesce(city,'')
    )
  ) STORED;

CREATE INDEX idx_search_vector ON influencers_cache USING GIN(search_vector);

-- Partial indexes for the hot filter paths
CREATE INDEX idx_ig_followers ON influencers_cache(followers) WHERE platform = 'instagram';
CREATE INDEX idx_tt_followers ON influencers_cache(followers) WHERE platform = 'tiktok';
CREATE INDEX idx_yt_followers ON influencers_cache(followers) WHERE platform = 'youtube';
CREATE INDEX idx_niche ON influencers_cache(niche, city);
```

With these indexes, a compound query at 50k rows resolves in ~15–40ms — acceptable for a search UI. The GIN index occupies ~8MB on disk (well within Supabase's 500MB free limit).

For fuzzy username matching (Roman-Urdu name misspellings), add pg_trgm:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_username_trgm    ON influencers_cache USING GIN(username gin_trgm_ops);
CREATE INDEX idx_displayname_trgm ON influencers_cache USING GIN(display_name gin_trgm_ops);
```

Combined query pattern:

```sql
SELECT *, similarity(display_name, $1) AS name_score
FROM influencers_cache
WHERE
  (
    search_vector @@ plainto_tsquery('english', $1)
    OR display_name % $1
  )
  AND platform     = ANY($2)
  AND followers    BETWEEN $3 AND $4
  AND engagement_rate >= $5
ORDER BY name_score DESC, iq_score DESC
LIMIT 20;
```

**At 50k creators, stay on PostgreSQL.** No additional service needed.

#### Up to 100k creators

At 100k creators, PostgreSQL full-text begins to show query time creep on unindexed filter combinations (~100–300ms in worst cases). Two realistic zero-budget options:

**Option A: Meilisearch on Fly.io free tier**

Fly.io's free allowance: 3 shared-cpu-1x VMs (256MB RAM each) + 3GB persistent volumes. Meilisearch at 100k creators with standard fields uses approximately:
- Disk: ~150MB index
- RAM: ~180MB at rest, ~220MB during active indexing

This fits within the 256MB RAM ceiling but leaves almost no headroom. Indexing new documents while serving queries can trigger OOM kills. The free Fly.io machine is also a shared CPU — query latency spikes under concurrent load.

**Option B: Stay on PostgreSQL + query optimisation**

A properly tuned PostgreSQL FTS setup on Supabase handles 100k rows in 40–150ms for the typical filter-heavy query. With Supabase free, you only lose the ability to have multiple simultaneous read replicas. For <1k searches/day (early stage), this is not a constraint.

The Meilisearch option gives better search quality (better ranking, typo tolerance without pg_trgm tuning). The PostgreSQL option gives zero operational overhead and zero cold-start risk.

### Recommendation by Scale

| Scale | Recommendation | Reasoning |
|---|---|---|
| 0–50k creators | PostgreSQL FTS + pg_trgm (Supabase free) | Zero extra infra, sufficient performance |
| 50k–100k creators | PostgreSQL FTS + pg_trgm + Redis query cache | Cache hot queries in Upstash Redis free tier (10k req/day) |
| 100k+ creators | Add Meilisearch on Fly.io **only when** avg latency exceeds 200ms | Deploy only when the pain is real, not anticipated |

**The cache layer is the cheapest performance multiplier.** Upstash Redis free tier allows 10,000 requests/day. Cache the results of common filter combinations (by platform, top cities, popular niches) with a 1-hour TTL. At early stage, >60% of searches will be cache hits — effectively zero PostgreSQL load for the majority of queries.

---

## 2. Scraping Architecture Without Paid Proxies

### Brutal Honesty First

Residential proxies exist because platforms actively block scraping. Without them, you are scraping from datacenter IPs or your own server IP. These get blocked faster. The architecture must therefore minimise scraping surface area to the point where blocking is rare.

### The Free-Budget Scraping Strategy

The guiding principle: **scrape as little as possible, cache as long as defensible.**

#### Tier 1 — Official Free APIs (use first, always)

| Source | What's free | Limits | Data quality |
|---|---|---|---|
| YouTube Data API v3 | Channel stats, subscriber count, video metrics | 10,000 units/day (~1,000 full profile lookups) | Excellent — official |
| Instagram Basic Display API | Own account only (deprecated for third-party) | N/A | Not useful for discovery |
| TikTok Research API | Video/user data for academic research | Approval required, 1000 req/day | Good if approved |
| SocialBlade (scrape public pages) | Public stats pages, no auth required | Aggressive rate limiting | Moderate |
| Instagram public profile HTML | Publicly visible bio, post count, follower count | Rate-limited hard without login | Limited but available |

**YouTube Data API v3 is the most valuable free asset.** 10,000 units/day is enough to enrich ~1,000 YouTube channels per day from scratch, or refresh 5,000 already-indexed ones (cheaper stat refresh queries cost 1–3 units vs full lookup at 10 units). This covers the YouTube platform entirely for free at early scale.

#### Tier 2 — Low-Rate Public Page Scraping

For Instagram and TikTok, where no usable free API exists, the strategy is:

**Only scrape when the user explicitly triggers enrichment.** No background workers running unsolicited. Each Enrich button click may trigger at most one scraping attempt per creator. Results are cached in `influencer_profiles` and not re-fetched for 7 days minimum.

```
User clicks Enrich
      │
      ├──► Check enriched_at timestamp
      │    If < 7 days ago: return cached data, skip scrape
      │
      └──► Proceed to scrape
            │
            ├── Try YouTube API (if YouTube creator) ← free, reliable
            ├── Try SocialBlade public page          ← low-rate, no auth
            └── Try platform public profile page     ← last resort
```

#### Free-Tier Scraping Practices

**Request rate:** Maximum 1 request per 8–12 seconds per domain, per server. Slow enough to stay below most automated detection thresholds.

**Session reuse:** Maintain a persistent `aiohttp.ClientSession` (or Playwright persistent context) rather than creating a new session per request. Session cookies from a non-logged-in browse accumulate trust signals over time.

**Login cookie reuse (with care):** Create dedicated scraper accounts (not tied to the business) on each platform and use their session cookies in the scraper. This raises the request quality level. Keep these accounts low-activity to avoid triggering platform abuse detection. Accept that these accounts may eventually be suspended.

**User-agent rotation:** Maintain a list of current real browser user-agents (updated quarterly). Rotate per request. Include matching `Accept-Language`, `Accept-Encoding`, and `Sec-Ch-Ua` headers that correspond to each user-agent.

```python
USER_AGENTS = [
    # Chrome 122 on Windows 11
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    # Chrome 122 on macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    # Firefox 123 on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
]
```

**Staggered scheduling:** The nightly refresh job must spread requests over the full night window (10 PM – 6 AM PKT) with random jitter between each request.

```python
import asyncio, random

async def staggered_enrich(creators: list):
    for creator in creators:
        await enrich_one(creator)
        # Sleep 45–120 seconds between creators
        await asyncio.sleep(random.uniform(45, 120))
```

At this rate, a nightly job can enrich ~200–400 creator profiles per night without triggering rate limits or IP bans on a residential IP. At datacenter IP rates, halve that estimate.

**Aggressive caching:** Cache everything. Enrichment results cached 7 days minimum. SocialBlade page parses cached 3 days. Platform profile HTML cached 1 day. Store in PostgreSQL with an `enriched_at` timestamp — not Redis (Upstash free tier has day-level request limits too low for cache storage).

**Detect and back off immediately:**

```python
DOMAIN_COOLDOWN_KEY = "scrape_cooldown:{domain}"

async def is_on_cooldown(domain: str) -> bool:
    row = await db.fetchone(
        "SELECT cooldown_until FROM scrape_cooldowns WHERE domain = $1", domain
    )
    return row and row["cooldown_until"] > datetime.utcnow()

async def set_cooldown(domain: str, hours: int = 4):
    until = datetime.utcnow() + timedelta(hours=hours)
    await db.execute(
        "INSERT INTO scrape_cooldowns(domain, cooldown_until) "
        "VALUES ($1, $2) ON CONFLICT (domain) DO UPDATE SET cooldown_until = $2",
        domain, until
    )
```

#### Free Data Sources Summary

| Source | Method | Data | Usefulness |
|---|---|---|---|
| YouTube Data API v3 | Official API | Subscribers, views, upload count, description | ⭐⭐⭐⭐⭐ |
| SocialBlade public pages | HTML scrape | Estimated followers, grade, historical trend | ⭐⭐⭐ |
| Instagram public JSON (`?__a=1`) | HTTP GET (unreliable) | Follower count, bio, post count | ⭐⭐ (often blocked) |
| TikTok public profile page | HTML scrape | Follower count, video count, bio | ⭐⭐⭐ |
| Google search snippets | HTML scrape of SERP | Creator name + platform confirms, estimated reach | ⭐⭐ |

#### Where Scraping Ends and Manual Entry Begins

Accept that some creators will require manual data entry or will have stale data. Build a UI affordance: a "Data last refreshed: 14 days ago — [Request refresh]" indicator on profile pages. The user clicking this queues the creator for the next nightly run. This turns data freshness into a user-driven pull model rather than a system-driven push model — dramatically more sustainable at zero budget.

---

## 3. Backend Language Stack on Free Infrastructure

### Free Tier Reality for Long-Running Processes

| Platform | What runs free | Limitation |
|---|---|---|
| Supabase Edge Functions | Deno, 500k invocations/mo | 150ms wall time (extensible to 400ms on free) |
| Vercel serverless | Node.js, 100GB-hrs/mo | 10s execution limit on free, no persistent state |
| Fly.io | 3 shared VMs (256MB each) | Sleeps, limited CPU |
| Railway | 500 execution hours/mo | Hard monthly cap |
| Local machine | Unlimited | Only works if developer machine is always on |

**Go and Rust are unusable on free serverless platforms** — they require compilation and long-lived process hosting. Compiling a Rust binary on Fly.io free doesn't fail, but deploying a persistent Rust service consumes one of your 3 free VMs, leaving 2 for other services.

### Pragmatic Language Stack

| Service | Language | Platform | Reasoning |
|---|---|---|---|
| BFF + API | Deno (TypeScript) | Supabase Edge Functions | Zero cost, already deployed, Supabase-native, 500k invocations/mo free |
| Enrichment workers | Python | Local machine or Railway free | `aiohttp` + `httpx` + `beautifulsoup4` handles scraping well |
| Any CPU-bound pipeline | Python | Local / scheduled | pandas, numpy, scikit-learn — no new infra needed |
| Database access | Raw SQL via Supabase client | N/A | Eliminates framework dependencies |

**Drop Go entirely at zero budget.** There is no free platform that makes a persistent Go service easier to run than Python. Go's concurrency advantages matter at >10k RPS — you will not reach that on free tier. Python's `asyncio` is sufficient for the concurrency level a free-tier system can generate.

**Drop Rust entirely at zero budget.** The indexing pipeline Rust would optimise (syncing 100k creators into a search engine) runs once per night. On Python, it takes ~45 seconds. That is completely acceptable.

**The complete zero-budget backend stack:**

```
Deno/TypeScript — edge functions (BFF, auth, plan checks)
Python 3.12     — enrichment workers, nightly batch jobs, embedding generation
SQL             — all data access logic
```

### Python Enrichment Worker on Free Infrastructure

The enrichment worker runs as a simple cron job. On Railway free (500 hrs/mo), a worker that runs 4 hours per night consumes 120 hrs/mo — within the free limit. Alternatively, a Raspberry Pi 4 on a home network (one-time hardware cost, zero recurring cost) handles 200–400 creator enrichments nightly.

```python
# worker/enricher.py — runs as a nightly cron (2 AM PKT)
import asyncio, random
from enrichment import enrich_creator
from database import get_stale_creators

async def main():
    creators = await get_stale_creators(days_old=7, limit=200)
    for creator in creators:
        await enrich_creator(creator)
        await asyncio.sleep(random.uniform(60, 90))  # ~1 request/min

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 4. Vector Search Without Dedicated Infrastructure

### Free Options Evaluated

#### pgvector on Supabase free

A 384-dimensional embedding stored as `vector(384)` occupies ~1.5KB per row (float32 × 384 = 1,536 bytes + overhead):

| Creator count | Embedding storage | % of 500MB free DB |
|---|---|---|
| 10k | ~15MB | 3% |
| 30k | ~45MB | 9% |
| 50k | ~75MB | 15% |
| 100k | ~150MB | 30% |

The IVFFlat index adds approximately the same footprint again. At 100k creators with indexed embeddings: ~300MB consumed — leaving only 200MB for all other data.

**pgvector works comfortably to ~30k creators on Supabase free.** Becomes problematic above 50k.

#### Typesense built-in vector search (Fly.io free)

At 100k creators with 384-dim embeddings, Typesense needs approximately 600MB RAM to serve ANN queries efficiently — exceeding Fly.io's 256MB free RAM ceiling by 2×. Unusable on free tier for vector search at this scale. At 10k creators (~60MB RAM) it is feasible, but at that scale pgvector is simpler.

#### In-memory FAISS for offline jobs

FAISS running in-process on the Python enrichment worker is the zero-cost vector search solution. It requires no separate service. The workflow:

```python
# Nightly batch: build FAISS index from pgvector data
import faiss
import numpy as np
from database import fetch_all_embeddings

async def build_lookalike_index():
    rows    = await fetch_all_embeddings()      # list of {id, embedding}
    ids     = np.array([r["id"] for r in rows])
    vectors = np.array([r["embedding"] for r in rows], dtype=np.float32)

    # Normalise for cosine similarity via inner product
    faiss.normalize_L2(vectors)

    index = faiss.IndexFlatIP(384)              # exact search, no ANN approximation
    index.add(vectors)                          # 50k creators: ~75ms build time

    faiss.write_index(index, "/tmp/creators.faiss")
    np.save("/tmp/creator_ids.npy", ids)
```

For **real-time** lookalike queries from the UI, the offline-built FAISS index cannot be served directly from an edge function. The bridge is to pre-compute results and write them back to PostgreSQL:

```sql
CREATE TABLE creator_lookalikes (
  creator_id   UUID REFERENCES influencer_profiles(id),
  similar_id   UUID REFERENCES influencer_profiles(id),
  similarity   FLOAT,
  computed_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (creator_id, similar_id)
);
```

The nightly job computes top-20 lookalikes for every creator and writes them to this table. The edge function reads them with a simple `SELECT` — zero vector infrastructure needed at query time.

```python
async def compute_and_store_lookalikes(index, ids, vectors):
    k = 21  # top 20 + self
    distances, indices = index.search(vectors, k)

    rows = []
    for i, (dists, idxs) in enumerate(zip(distances, indices)):
        creator_id = ids[i]
        for dist, idx in zip(dists[1:], idxs[1:]):   # skip self (index 0)
            rows.append((str(creator_id), str(ids[idx]), float(dist)))

    await db.executemany(
        "INSERT INTO creator_lookalikes(creator_id, similar_id, similarity) "
        "VALUES ($1, $2, $3) ON CONFLICT (creator_id, similar_id) "
        "DO UPDATE SET similarity = $3, computed_at = now()",
        rows
    )
```

At 50k creators, the nightly FAISS index build and full similarity computation takes ~3–8 minutes on a modest machine. Results are instantly available from PostgreSQL as plain SQL.

### Zero-Budget Vector Search Decision Matrix

| Dataset size | Solution | Notes |
|---|---|---|
| 0–30k creators | pgvector on Supabase free | Direct ANN queries from edge functions |
| 30k–100k creators | FAISS offline + pre-computed lookalikes in PostgreSQL | Nightly job, real-time reads are just SQL |
| 100k+ creators | Migrate pgvector to self-hosted PostgreSQL OR Qdrant on Fly.io (single node, tight) | Trigger only when free Supabase is outgrown |

**The FAISS offline pattern is the right long-term answer for zero budget.** It requires no dedicated service, no paid tier, and scales as far as your nightly batch machine can handle. Lookalike queries from the UI are sub-5ms `SELECT` statements.

---

## 5. Complete Zero-Budget Architecture

```
FRONTEND
  React + TypeScript + Vite
  Hosted: Vercel free tier
  CDN: Vercel edge network (included)

BFF / EDGE
  Deno edge functions — Supabase free (500k invocations/mo)
  - Auth, plan checks, quota enforcement
  - All user-facing API endpoints
  - Reads pre-computed results from PostgreSQL

DATABASE (single source of truth)
  Supabase free — PostgreSQL 16 + pgvector + pg_trgm
  - influencers_cache         (search index source)
  - influencer_profiles       (enriched data, embeddings to 30k)
  - creator_lookalikes        (pre-computed FAISS results)
  - search_cache              (query result cache, 1hr TTL)
  - scrape_cooldowns          (domain backoff tracking)
  GIN indexes for FTS + trgm
  Upstash Redis free (10k req/day) — hot query cache

SEARCH
  Phase 1 (0–50k):    PostgreSQL FTS + pg_trgm (already provisioned)
  Phase 2 (50k–100k): + Redis cache layer for top-100 query patterns
  Phase 3 (100k+):    Add Meilisearch on Fly.io free (1 of 3 free VMs)

ENRICHMENT WORKERS — Python 3.12
  Runtime: Railway free (120 hrs/mo) OR local machine / Raspberry Pi
  - YouTube Data API v3 (10k units/day free)
  - SocialBlade HTML scrape (~1 req/70s)
  - Platform profile page scrape (last resort, ~1 req/90s)
  - Max 200 creator enrichments per night
  - 7-day cache TTL (no re-fetch until stale)
  - Domain cooldown on 429 (4hr backoff)

EMBEDDING + AI
  Offline generation: Python sentence-transformers (free, local)
  - paraphrase-multilingual-MiniLM-L12-v2 (384-dim)
  - Runs in enrichment worker immediately after profile enrich
  - Writes embedding to pgvector column
  FAISS lookalike computation: nightly batch (in-process, no service)
  - Writes top-20 lookalikes per creator to creator_lookalikes table
  LLM: Groq free tier (30 req/min, Llama 3.3 70B — no credit card required)

NIGHTLY BATCH ORCHESTRATION
  pg_cron (free, built into Supabase):
  - Purge stale search_cache rows
  - Mark creators due for re-enrichment
  - Trigger enrichment worker via HTTP (Railway webhook)
  Python worker (Railway or local):
  - Enrichment loop with rate limiting
  - Embedding generation
  - FAISS index rebuild + lookalike computation
  - Meilisearch sync (if deployed at phase 3)
```

### Groq as the Free LLM

Groq's free tier: 30 requests/minute, 14,400 requests/day on Llama 3.3 70B — a direct drop-in replacement for OpenAI in Supabase edge functions:

```typescript
// supabase/functions/ai-insights/index.ts
const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${Deno.env.get("GROQ_API_KEY")}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 500,
  }),
});
```

No credit card required for Groq developer tier.

### Monthly Cost Summary

| Service | Free allowance | Mushin usage | Cost |
|---|---|---|---|
| Vercel | 100GB bandwidth | <5GB | $0 |
| Supabase | 500MB DB, 500k edge invocations | Within limits to 30k creators | $0 |
| Upstash Redis | 10k req/day | Hot query cache | $0 |
| YouTube Data API | 10k units/day | ~300 creator lookups/day | $0 |
| Groq AI | 14,400 req/day | AI insights on demand | $0 |
| Railway (workers) | 500 hrs/mo | ~120 hrs/mo (4hr/night) | $0 |
| Fly.io (Meilisearch, phase 3 only) | 3 VMs free | 1 VM for Meilisearch | $0 |
| **Total** | | | **$0** |

### Scaling Exit Points

The zero-budget architecture sustains the platform until approximately:

| Threshold | Constraint hit | First dollar spent |
|---|---|---|
| 30k indexed creators | pgvector consumes >50% of Supabase free DB | Supabase Pro ($25/mo) — removes DB size limit, raises invocations to 2M/mo |
| 50k indexed creators | PostgreSQL FTS latency noticeable on complex filters | Add Meilisearch on Fly.io (free VM) |
| 500k edge invocations/mo | Supabase free limit (~5,000 DAU) | Supabase Pro ($25/mo) |
| 10k YouTube API units/day | ~300 new YouTube enrichments/day | Google Cloud free tier extension or YouTube API quota increase request |

The single best first expenditure — if and when it becomes necessary — is **Supabase Pro at $25/month**. It removes the database size ceiling, increases edge function invocations to 2M/mo, and extends the architecture's runway from 30k to ~500k creators before any further spend is required.
