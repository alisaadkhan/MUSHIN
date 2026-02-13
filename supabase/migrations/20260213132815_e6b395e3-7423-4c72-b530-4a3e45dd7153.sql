-- Add unique constraint for upsert on influencers_cache
ALTER TABLE public.influencers_cache ADD CONSTRAINT influencers_cache_platform_username_key UNIQUE (platform, username);
