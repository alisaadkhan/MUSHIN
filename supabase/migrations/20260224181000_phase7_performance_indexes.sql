-- Phase 7: Scalability & Performance Indexes

-- 1. Accelerate Search & Filtering
-- Composite index for the most common search patterns (platform + niche + follower range)
CREATE INDEX IF NOT EXISTS idx_influencer_search_composite 
ON public.influencer_profiles (platform, primary_niche, followers_count DESC);

-- Partial index for high-engagement influencers (frequently queried)
CREATE INDEX IF NOT EXISTS idx_high_engagement_creators 
ON public.influencer_profiles (engagement_rate DESC) 
WHERE engagement_rate > 3.0;

-- 2. Accelerate Analytics & Reporting
-- Finding latest metrics quickly
CREATE INDEX IF NOT EXISTS idx_metrics_recent 
ON public.campaign_metrics (date DESC, tracking_link_id);

-- Speed up brand mention queries for the affinity panel
CREATE INDEX IF NOT EXISTS idx_brand_mentions_analytics
ON public.brand_mentions (brand_name, mentioned_at DESC);

-- 3. Partitioning Setup (Conceptual for future scale)
-- If influencer_posts table grows beyond 10s of millions of rows, 
-- we would partition it by date. For now, a strong index is sufficient:
CREATE INDEX IF NOT EXISTS idx_posts_profile_date 
ON public.influencer_posts (profile_id, created_at DESC);
