-- ─────────────────────────────────────────────────────────────────────────────
-- HuggingFace AI Upgrade — 2026-03-13
-- • Replaces Lovable AI embeddings (vector(1536) / OpenAI text-embedding-3-small)
--   with HuggingFace BGE-large-en-v1.5 (vector(1024))
-- • Adds creator_tags table (normalized, weighted, source-tracked)
-- • Updates match_influencers() to use the new vector dimension
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. creator_tags — normalized tag store
--    One row per (creator, tag). Weights [0,1] — higher = more important.
--    Sources: 'ai' | 'bio' | 'hashtag' | 'niche' | 'manual'
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.creator_tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id  UUID NOT NULL REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
    tag         TEXT NOT NULL CHECK (length(tag) >= 2 AND length(tag) <= 50),
    weight      FLOAT NOT NULL DEFAULT 0.5 CHECK (weight BETWEEN 0 AND 1),
    source      TEXT NOT NULL DEFAULT 'bio'
                  CHECK (source IN ('ai', 'bio', 'hashtag', 'niche', 'manual')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (creator_id, tag)
);

-- RLS: read-only for authenticated users; write only via service role
ALTER TABLE public.creator_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creator_tags_read" ON public.creator_tags
    FOR SELECT TO authenticated USING (true);

-- Fast tag lookup
CREATE INDEX IF NOT EXISTS idx_creator_tags_creator_id
    ON public.creator_tags (creator_id);

CREATE INDEX IF NOT EXISTS idx_creator_tags_tag
    ON public.creator_tags (tag);

-- GIN on (tag, weight) for "find all creators with tag X, sorted by weight"
CREATE INDEX IF NOT EXISTS idx_creator_tags_tag_weight
    ON public.creator_tags (tag, weight DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Embedding dimension upgrade: vector(1536) → vector(1024)
--    BGE-large-en-v1.5 outputs 1024 dimensions (vs OpenAI's 1536).
--    We drop old column and recreate — existing embeddings are incompatible.
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. Drop the HNSW index that depends on the old column
DROP INDEX IF EXISTS public.influencer_profiles_embedding_idx;

-- 2b. Drop old 1536-dim column
ALTER TABLE public.influencer_profiles
    DROP COLUMN IF EXISTS embedding;

-- 2c. Add new 1024-dim column
ALTER TABLE public.influencer_profiles
    ADD COLUMN IF NOT EXISTS embedding VECTOR(1024);

-- 2d. Recreate HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_ip_embedding_hnsw
    ON public.influencer_profiles
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Update match_influencers() to use 1024-dim vectors
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.match_influencers(VECTOR, FLOAT, INT, TEXT);

CREATE OR REPLACE FUNCTION public.match_influencers(
    query_embedding  VECTOR(1024),
    match_threshold  FLOAT    DEFAULT 0.5,
    match_count      INT      DEFAULT 20,
    filter_platform  TEXT     DEFAULT NULL
)
RETURNS TABLE (
    id               UUID,
    username         TEXT,
    platform         TEXT,
    full_name        TEXT,
    bio              TEXT,
    follower_count   BIGINT,
    engagement_rate  FLOAT,
    avatar_url       TEXT,
    primary_niche    TEXT,
    city             TEXT,
    similarity       FLOAT
)
LANGUAGE sql STABLE
AS $$
    SELECT
        p.id,
        p.username,
        p.platform,
        p.full_name,
        p.bio,
        p.follower_count,
        p.engagement_rate,
        p.avatar_url,
        p.primary_niche,
        p.city,
        1 - (p.embedding <=> query_embedding) AS similarity
    FROM public.influencer_profiles p
    WHERE p.embedding IS NOT NULL
      AND (filter_platform IS NULL OR p.platform = filter_platform)
      AND 1 - (p.embedding <=> query_embedding) >= match_threshold
    ORDER BY p.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Ensure platform column exists on creator_tags for efficient cross-table
--    queries (denormalized from influencer_profiles for join elimination)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.creator_tags
    ADD COLUMN IF NOT EXISTS platform TEXT;

CREATE INDEX IF NOT EXISTS idx_creator_tags_platform_tag
    ON public.creator_tags (platform, tag);

-- Populate platform from influencer_profiles (for existing rows, if any)
UPDATE public.creator_tags ct
SET platform = p.platform
FROM public.influencer_profiles p
WHERE ct.creator_id = p.id
  AND ct.platform IS NULL;
