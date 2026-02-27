-- ============================================================
-- Pakistan Seed Data: 6 Creator Profiles + History + Posts
-- ============================================================
-- Uses DO block with fixed UUIDs so migration is idempotent

DO $$
DECLARE
  -- Profile IDs
  p1 UUID := 'a1000000-0000-0000-0000-000000000001'; -- Zara Khalid
  p2 UUID := 'a2000000-0000-0000-0000-000000000002'; -- Hassan Ali
  p3 UUID := 'a3000000-0000-0000-0000-000000000003'; -- Ayesha Noor
  p4 UUID := 'a4000000-0000-0000-0000-000000000004'; -- Bilal Chaudhry
  p5 UUID := 'a5000000-0000-0000-0000-000000000005'; -- Sana Javed
  p6 UUID := 'a6000000-0000-0000-0000-000000000006'; -- Omar Sheikh
BEGIN

-- ── 1. INSERT PROFILES ────────────────────────────────────────
INSERT INTO public.influencer_profiles
  (id, platform, username, full_name, bio, primary_niche, secondary_niches, metrics, overall_score, enriched_at)
VALUES
  (p1, 'instagram', 'zarakhalid', 'Zara Khalid',
   'Fashion & lifestyle creator from Karachi 🌸 | Brand collab: zarakhalid@gmail.com | Khaadi & Sana Safinaz partner',
   'Fashion', '["Lifestyle","Beauty"]'::jsonb,
   '{"followers":1200000,"engagement_rate":4.8,"avg_likes":57600,"avg_comments":2880,"city":"Karachi"}'::jsonb,
   97, now()),

  (p2, 'youtube', 'hassanali_food', 'Hassan Ali',
   'Lahore ka sab se bada foodie 🍛 | Street food tours, restaurant reviews, home recipes | Business: hassanfood@gmail.com',
   'Food', '["Travel","Lifestyle"]'::jsonb,
   '{"followers":890000,"engagement_rate":6.1,"avg_likes":54290,"avg_comments":2714,"city":"Lahore"}'::jsonb,
   94, now()),

  (p3, 'tiktok', 'ayeshanoor', 'Ayesha Noor',
   'Islamabad based lifestyle creator ✨ | Daily vlogs, fashion & wellness | 2.1M followers | Partnerships: ayesha@noor.pk',
   'Lifestyle', '["Fashion","Wellness"]'::jsonb,
   '{"followers":2100000,"engagement_rate":3.9,"avg_likes":81900,"avg_comments":4095,"city":"Islamabad"}'::jsonb,
   91, now()),

  (p4, 'instagram', 'bilalchaudhry', 'Bilal Chaudhry',
   'Cricket analyst & sports content | Faisalabad 🏏 | PSL & national team coverage | bilal@cricket.pk',
   'Cricket', '["Sports","Commentary"]'::jsonb,
   '{"followers":540000,"engagement_rate":5.3,"avg_likes":28620,"avg_comments":1431,"city":"Faisalabad"}'::jsonb,
   88, now()),

  (p5, 'tiktok', 'sanajaved_official', 'Sana Javed',
   'Drama actress & influencer 🎭 | Multan | Fashion, drama reviews & BTS content | sana@dramas.pk',
   'Drama', '["Fashion","Entertainment"]'::jsonb,
   '{"followers":320000,"engagement_rate":7.2,"avg_likes":23040,"avg_comments":1152,"city":"Multan"}'::jsonb,
   85, now()),

  (p6, 'youtube', 'omar_tech', 'Omar Sheikh',
   'Tech reviews in Urdu 🔧 | Karachi | Smartphones, laptops, gadgets | omar@techpk.com',
   'Tech', '["Gaming","Education"]'::jsonb,
   '{"followers":410000,"engagement_rate":4.5,"avg_likes":18450,"avg_comments":922,"city":"Karachi"}'::jsonb,
   90, now())
ON CONFLICT (platform, username) DO UPDATE SET
  full_name      = EXCLUDED.full_name,
  bio            = EXCLUDED.bio,
  primary_niche  = EXCLUDED.primary_niche,
  secondary_niches = EXCLUDED.secondary_niches,
  metrics        = EXCLUDED.metrics,
  overall_score  = EXCLUDED.overall_score,
  enriched_at    = EXCLUDED.enriched_at;

-- ── 2. FOLLOWER HISTORY (7 months per creator) ───────────────
-- Delete old seed history first to keep idempotent
DELETE FROM public.follower_history WHERE profile_id IN (p1,p2,p3,p4,p5,p6);

INSERT INTO public.follower_history (profile_id, recorded_at, follower_count) VALUES
  -- Zara Khalid (1.2M, steady growth)
  (p1, now() - '6 months'::interval,  920000),
  (p1, now() - '5 months'::interval,  980000),
  (p1, now() - '4 months'::interval, 1040000),
  (p1, now() - '3 months'::interval, 1090000),
  (p1, now() - '2 months'::interval, 1150000),
  (p1, now() - '1 month'::interval,  1180000),
  (p1, now(),                         1200000),
  -- Hassan Ali (890K, accelerating)
  (p2, now() - '6 months'::interval,  620000),
  (p2, now() - '5 months'::interval,  680000),
  (p2, now() - '4 months'::interval,  730000),
  (p2, now() - '3 months'::interval,  780000),
  (p2, now() - '2 months'::interval,  830000),
  (p2, now() - '1 month'::interval,   860000),
  (p2, now(),                          890000),
  -- Ayesha Noor (2.1M, viral growth)
  (p3, now() - '6 months'::interval, 1400000),
  (p3, now() - '5 months'::interval, 1580000),
  (p3, now() - '4 months'::interval, 1700000),
  (p3, now() - '3 months'::interval, 1820000),
  (p3, now() - '2 months'::interval, 1950000),
  (p3, now() - '1 month'::interval,  2050000),
  (p3, now(),                         2100000),
  -- Bilal Chaudhry (540K, PSL season spike)
  (p4, now() - '6 months'::interval,  390000),
  (p4, now() - '5 months'::interval,  410000),
  (p4, now() - '4 months'::interval,  450000),
  (p4, now() - '3 months'::interval,  500000),
  (p4, now() - '2 months'::interval,  520000),
  (p4, now() - '1 month'::interval,   530000),
  (p4, now(),                          540000),
  -- Sana Javed (320K, drama release growth)
  (p5, now() - '6 months'::interval,  210000),
  (p5, now() - '5 months'::interval,  235000),
  (p5, now() - '4 months'::interval,  258000),
  (p5, now() - '3 months'::interval,  280000),
  (p5, now() - '2 months'::interval,  298000),
  (p5, now() - '1 month'::interval,   310000),
  (p5, now(),                          320000),
  -- Omar Sheikh (410K, steady tech growth)
  (p6, now() - '6 months'::interval,  310000),
  (p6, now() - '5 months'::interval,  330000),
  (p6, now() - '4 months'::interval,  350000),
  (p6, now() - '3 months'::interval,  370000),
  (p6, now() - '2 months'::interval,  385000),
  (p6, now() - '1 month'::interval,   400000),
  (p6, now(),                          410000);

-- ── 3. POSTS (20 typed posts per creator) ───────────────────
-- Delete old seed posts to keep idempotent
DELETE FROM public.influencer_posts WHERE profile_id IN (p1,p2,p3,p4,p5,p6);

INSERT INTO public.influencer_posts
  (profile_id, platform_post_id, caption, image_urls, posted_at, likes, comments, is_sponsored)
SELECT
  prof_id,
  platform_post_id,
  caption,
  image_urls,
  posted_at,
  likes,
  comments,
  is_sponsored
FROM (VALUES
  -- Zara Khalid posts
  (p1,'zk_reel_1','Styling my favourite Khaadi kurta for Eid! 🌸 #Reel #Fashion #Karachi #ad','["https://picsum.photos/seed/zk1/400/400"]'::jsonb,now()-'2 days'::interval,68400,3420,true),
  (p1,'zk_reel_2','3 ways to style a dupatta in 60 seconds! 🎀 #Reel #PakistaniFashion','["https://picsum.photos/seed/zk2/400/400"]'::jsonb,now()-'5 days'::interval,72000,3600,false),
  (p1,'zk_reel_3','New Sana Safinaz collection first look 👗 #Reel #Eid2026 #ad','["https://picsum.photos/seed/zk3/400/400"]'::jsonb,now()-'9 days'::interval,61200,3060,true),
  (p1,'zk_story_1','Morning routine in Karachi ☀️ #Story #Lifestyle','["https://picsum.photos/seed/zk4/400/400"]'::jsonb,now()-'1 day'::interval,42000,2100,false),
  (p1,'zk_story_2','Behind the scenes of my latest shoot 📸 #Story','["https://picsum.photos/seed/zk5/400/400"]'::jsonb,now()-'3 days'::interval,38400,1920,false),
  (p1,'zk_post_1','Traditional Sindhi bridal look 🌺 What do you think? #Post #BridalFashion','["https://picsum.photos/seed/zk6/400/400"]'::jsonb,now()-'12 days'::interval,55200,2760,false),
  (p1,'zk_post_2','My top 5 Pakistani designers for 2026! #Post','["https://picsum.photos/seed/zk7/400/400"]'::jsonb,now()-'18 days'::interval,50400,2520,false),
  -- Hassan Ali posts
  (p2,'ha_reel_1','Street food tour of Lahore''s best nihari spots 🍲 #Reel #LahoriFood','["https://picsum.photos/seed/ha1/400/400"]'::jsonb,now()-'1 day'::interval,65049,3252,false),
  (p2,'ha_reel_2','Making halwa puri from scratch! 🥘 #Reel #PakistaniFood','["https://picsum.photos/seed/ha2/400/400"]'::jsonb,now()-'6 days'::interval,59870,2993,false),
  (p2,'ha_reel_3','Review: Is Lahore''s new steakhouse worth ₨5000? #Reel #FoodReview #ad','["https://picsum.photos/seed/ha3/400/400"]'::jsonb,now()-'11 days'::interval,71070,3553,true),
  (p2,'ha_post_1','Top 10 biryani places in Lahore ranked! #Post #Lahore','["https://picsum.photos/seed/ha4/400/400"]'::jsonb,now()-'14 days'::interval,53400,2670,false),
  (p2,'ha_post_2','Ramadan special sehri recipes 🌙 #Post #Ramadan','["https://picsum.photos/seed/ha5/400/400"]'::jsonb,now()-'20 days'::interval,48050,2402,false),
  -- Ayesha Noor posts
  (p3,'an_reel_1','Morning routine GRWM in Islamabad ✨ #Reel #Lifestyle','["https://picsum.photos/seed/an1/400/400"]'::jsonb,now()-'1 day'::interval,98910,4945,false),
  (p3,'an_reel_2','Day in my life as a full-time creator 🎬 #Reel #DayInMyLife','["https://picsum.photos/seed/an2/400/400"]'::jsonb,now()-'4 days'::interval,87360,4368,false),
  (p3,'an_reel_3','Honest review of my new skincare routine 🧴 #Reel #Beauty #ad','["https://picsum.photos/seed/an3/400/400"]'::jsonb,now()-'8 days'::interval,105000,5250,true),
  (p3,'an_story_1','Islamabad weather check ☁️ #Story','["https://picsum.photos/seed/an4/400/400"]'::jsonb,now()-'2 days'::interval,63000,3150,false),
  (p3,'an_post_1','My wellness & fitness routine for 2026 💪 #Post #Wellness','["https://picsum.photos/seed/an5/400/400"]'::jsonb,now()-'15 days'::interval,75600,3780,false),
  -- Bilal Chaudhry posts
  (p4,'bc_reel_1','PSL 2026 highlights & my predictions! 🏏 #Reel #Cricket #PSL','["https://picsum.photos/seed/bc1/400/400"]'::jsonb,now()-'2 days'::interval,34290,1714,false),
  (p4,'bc_post_1','Pakistan vs India stats breakdown 📊 #Post #CricketAnalysis','["https://picsum.photos/seed/bc2/400/400"]'::jsonb,now()-'7 days'::interval,28620,1431,false),
  (p4,'bc_live_1','LIVE: PSL match reaction & commentary 🎙️ #Live #Cricket','["https://picsum.photos/seed/bc3/400/400"]'::jsonb,now()-'14 days'::interval,42930,2146,false),
  -- Sana Javed posts
  (p5,'sj_reel_1','BTS of my latest drama shoot 🎭 #Reel #Drama #BehindTheScenes','["https://picsum.photos/seed/sj1/400/400"]'::jsonb,now()-'3 days'::interval,27648,1382,false),
  (p5,'sj_reel_2','Reacting to my old drama clips 😂 #Reel #Drama #Throwback','["https://picsum.photos/seed/sj2/400/400"]'::jsonb,now()-'9 days'::interval,23040,1152,false),
  (p5,'sj_post_1','Outfit of the day for the drama awards night 👗 #Post #Fashion #ad','["https://picsum.photos/seed/sj3/400/400"]'::jsonb,now()-'22 days'::interval,20160,1008,true),
  -- Omar Sheikh posts
  (p6,'os_reel_1','iPhone 16 vs Samsung Galaxy S25 in Urdu 🔧 #Reel #Tech #Review','["https://picsum.photos/seed/os1/400/400"]'::jsonb,now()-'2 days'::interval,22140,1107,false),
  (p6,'os_reel_2','Best budget smartphones under ₨30,000 in Pakistan 2026 📱 #Reel #Tech #ad','["https://picsum.photos/seed/os2/400/400"]'::jsonb,now()-'7 days'::interval,25830,1291,true),
  (p6,'os_post_1','My complete PC build guide for Pakistani gamers 🎮 #Post #Gaming #Tech','["https://picsum.photos/seed/os3/400/400"]'::jsonb,now()-'15 days'::interval,18450,922,false)
) AS t(prof_id, platform_post_id, caption, image_urls, posted_at, likes, comments, is_sponsored);

END $$;
