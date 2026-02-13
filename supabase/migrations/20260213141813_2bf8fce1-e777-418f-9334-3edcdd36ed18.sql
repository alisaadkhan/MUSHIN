-- Add unique constraint to prevent duplicate influencers in the same list
ALTER TABLE public.list_items ADD CONSTRAINT list_items_list_platform_username_unique UNIQUE (list_id, platform, username);
