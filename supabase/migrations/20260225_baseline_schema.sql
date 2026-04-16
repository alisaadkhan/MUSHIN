-- ============================================================
-- Migration: Baseline Creator Schema (V4 - Minimalist)
-- Date: 2026-02-25
-- Goal: Only define tables missing from the start of the sequence.
-- ============================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. influencer_profiles
CREATE TABLE IF NOT EXISTS public.influencer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  platform text NOT NULL,
  full_name text,
  display_name text,
  bio text,
  avatar_url text,
  profile_pic_url text,
  follower_count bigint,
  following_count bigint,
  posts_count integer,
  engagement_rate numeric, 
  normalized_engagement_score numeric(5,2), -- Ghost column requested by 2026030201
  primary_niche text,
  niche_confidence integer,
  niche_method text,
  niche_original text, 
  authenticity_score numeric, 
  engagement_quality_score numeric, 
  metrics jsonb DEFAULT '{}'::jsonb,
  fraud_score integer,
  audience_quality_score integer,
  bot_probability numeric, 
  data_source text,
  city text,
  tags text[] DEFAULT '{}'::text[],
  enrichment_status text DEFAULT 'pending',
  enrichment_ttl_days integer DEFAULT 30,
  enriched_at timestamptz,
  last_enriched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(platform, username)
);

-- 3. influencer_posts
CREATE TABLE IF NOT EXISTS public.influencer_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  platform_post_id text NOT NULL,
  caption text,
  image_urls text[],
  posted_at timestamptz,
  likes integer,
  comments integer,
  views integer,
  is_sponsored boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, platform_post_id)
);

-- 4. follower_history
CREATE TABLE IF NOT EXISTS public.follower_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  follower_count bigint NOT NULL,
  recorded_at timestamptz DEFAULT now()
);

-- 5. linked_accounts
CREATE TABLE IF NOT EXISTS public.linked_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id_a uuid REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  platform_a text NOT NULL,
  username_a text NOT NULL,
  platform_b text NOT NULL,
  username_b text NOT NULL,
  confidence_score numeric DEFAULT 0.0,
  matched_by text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(profile_id_a, platform_b, username_b)
);

-- 6. Basic Indexes
CREATE INDEX IF NOT EXISTS idx_ip_platform_username ON public.influencer_profiles(platform, username);
CREATE INDEX IF NOT EXISTS idx_ip_primary_niche ON public.influencer_profiles(primary_niche);
CREATE INDEX IF NOT EXISTS idx_ip_follower_count ON public.influencer_profiles(follower_count DESC);
