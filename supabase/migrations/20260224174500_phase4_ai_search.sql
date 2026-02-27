-- Phase 4: AI Search & Lookalikes Schema

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding vector and search credits
ALTER TABLE public.influencer_profiles ADD COLUMN embedding vector(1536);
ALTER TABLE public.workspaces ADD COLUMN ai_search_credits_remaining INTEGER NOT NULL DEFAULT 100;

-- Function for similarity search
CREATE OR REPLACE FUNCTION match_influencers (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_platform text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  platform text,
  username text,
  full_name text,
  primary_niche text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ip.id,
    ip.platform,
    ip.username,
    ip.full_name,
    ip.primary_niche,
    1 - (ip.embedding <=> query_embedding) AS similarity
  FROM influencer_profiles ip
  WHERE (filter_platform IS NULL OR ip.platform = filter_platform)
    AND 1 - (ip.embedding <=> query_embedding) > match_threshold
  ORDER BY ip.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
