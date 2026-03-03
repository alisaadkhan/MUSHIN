-- ── influencer_profiles: public read (profiles are not personal data), service-role writes ──
ALTER TABLE public.influencer_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.influencer_profiles;
CREATE POLICY "Authenticated users can read profiles" ON public.influencer_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role manages profiles" ON public.influencer_profiles;
CREATE POLICY "Service role manages profiles" ON public.influencer_profiles
  FOR ALL USING (auth.role() = 'service_role');

-- ── influencer_posts: public read for authenticated users ──
ALTER TABLE public.influencer_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read posts" ON public.influencer_posts;
CREATE POLICY "Authenticated users can read posts" ON public.influencer_posts
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Service role manages posts" ON public.influencer_posts;
CREATE POLICY "Service role manages posts" ON public.influencer_posts
  FOR ALL USING (auth.role() = 'service_role');

-- ── follower_history: workspace members only (contains enrichment timing intelligence) ──
ALTER TABLE public.follower_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace members can read follower history" ON public.follower_history;
CREATE POLICY "Workspace members can read follower history" ON public.follower_history
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));
DROP POLICY IF EXISTS "Service role manages follower history" ON public.follower_history;
CREATE POLICY "Service role manages follower history" ON public.follower_history
  FOR ALL USING (auth.role() = 'service_role');

-- ── linked_accounts ──
ALTER TABLE public.linked_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read linked accounts" ON public.linked_accounts;
CREATE POLICY "Authenticated can read linked accounts" ON public.linked_accounts
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Service role manages linked accounts" ON public.linked_accounts;
CREATE POLICY "Service role manages linked accounts" ON public.linked_accounts
  FOR ALL USING (auth.role() = 'service_role');

-- ── influencer_evaluations ──
ALTER TABLE public.influencer_evaluations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace members can read evaluations" ON public.influencer_evaluations;
CREATE POLICY "Workspace members can read evaluations" ON public.influencer_evaluations
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Service role manages evaluations" ON public.influencer_evaluations;
CREATE POLICY "Service role manages evaluations" ON public.influencer_evaluations
  FOR ALL USING (auth.role() = 'service_role');

-- ── audience_analysis ──
ALTER TABLE public.audience_analysis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read audience analysis" ON public.audience_analysis;
CREATE POLICY "Authenticated can read audience analysis" ON public.audience_analysis
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Service role manages audience analysis" ON public.audience_analysis;
CREATE POLICY "Service role manages audience analysis" ON public.audience_analysis
  FOR ALL USING (auth.role() = 'service_role');

-- ── API cost tracking table ──
CREATE TABLE IF NOT EXISTS public.api_cost_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  api_name text NOT NULL,           -- 'apify', 'serper', 'youtube', 'openai'
  action text NOT NULL,             -- 'enrich', 'search', 'embed', 'ai_insight'
  cost_usd numeric(10,4) NOT NULL DEFAULT 0,
  units_consumed int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_cost_log_workspace_date
  ON public.api_cost_log(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_cost_log_api_date
  ON public.api_cost_log(api_name, created_at DESC);

ALTER TABLE public.api_cost_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members can read own costs" ON public.api_cost_log
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Service role manages cost log" ON public.api_cost_log
  FOR ALL USING (auth.role() = 'service_role');

-- Monthly budget caps per workspace
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS monthly_api_budget_usd numeric(10,2) DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS current_month_spend_usd numeric(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS budget_alert_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_locked boolean NOT NULL DEFAULT false;

-- Function: check and enforce budget cap before enrichment
CREATE OR REPLACE FUNCTION check_workspace_budget(ws_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_budget numeric;
  v_spend numeric;
  v_locked boolean;
BEGIN
  SELECT monthly_api_budget_usd, current_month_spend_usd, enrichment_locked
  INTO v_budget, v_spend, v_locked
  FROM public.workspaces WHERE id = ws_id;

  IF v_locked THEN
    RAISE EXCEPTION 'budget_exceeded' USING ERRCODE = 'P0002';
  END IF;

  IF v_spend >= v_budget * 0.90 THEN
    -- Auto-lock at 90% of budget
    UPDATE public.workspaces SET enrichment_locked = true WHERE id = ws_id;
    RAISE EXCEPTION 'budget_exceeded' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- Function: record API spend and update workspace monthly total
CREATE OR REPLACE FUNCTION record_api_cost(
  ws_id uuid,
  p_api_name text,
  p_action text,
  p_cost_usd numeric,
  p_units int DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.api_cost_log(workspace_id, api_name, action, cost_usd, units_consumed)
  VALUES (ws_id, p_api_name, p_action, p_cost_usd, p_units);

  UPDATE public.workspaces
  SET current_month_spend_usd = current_month_spend_usd + p_cost_usd
  WHERE id = ws_id;
END;
$$;

-- Cursor-based pagination helper for influencer_profiles
CREATE OR REPLACE FUNCTION get_profiles_page(
  p_platform text DEFAULT NULL,
  p_niche text DEFAULT NULL,
  p_cursor uuid DEFAULT NULL,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid, username text, platform text, full_name text, primary_niche text,
  follower_count bigint, engagement_rate numeric, avatar_url text,
  enrichment_status text, normalized_engagement_score numeric,
  next_cursor uuid
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.id, p.username, p.platform, p.full_name, p.primary_niche,
    p.follower_count, p.engagement_rate, p.avatar_url,
    p.enrichment_status, p.normalized_engagement_score,
    p.id AS next_cursor
  FROM public.influencer_profiles p
  WHERE
    (p_platform IS NULL OR p.platform = p_platform)
    AND (p_niche IS NULL OR p.primary_niche = p_niche)
    AND (p_cursor IS NULL OR p.id > p_cursor)
    AND p.enrichment_status = 'success'
  ORDER BY p.id ASC
  LIMIT LEAST(p_limit, 100);  -- Hard cap: never return more than 100 rows
$$;

-- Behavioral anomaly detection: rapid search burst tracking per workspace
CREATE TABLE IF NOT EXISTS public.behavioral_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  anomaly_type text NOT NULL CHECK (anomaly_type IN ('search_burst','enrich_burst','concurrent_workspace','scraper_pattern')),
  details jsonb NOT NULL DEFAULT '{}',
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  resolved boolean NOT NULL DEFAULT false,
  detected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_behavioral_anomalies_workspace
  ON public.behavioral_anomalies(workspace_id, detected_at DESC);

ALTER TABLE public.behavioral_anomalies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read anomalies" ON public.behavioral_anomalies
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin'))
  );
CREATE POLICY "Service role manages anomalies" ON public.behavioral_anomalies
  FOR ALL USING (auth.role() = 'service_role');

-- Consent log (GDPR)
CREATE TABLE IF NOT EXISTS public.consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL,      -- 'data_processing', 'marketing', 'profiling'
  granted boolean NOT NULL,
  ip_address text,
  user_agent text,
  consented_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own consent" ON public.consent_log
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service role manages consent" ON public.consent_log
  FOR ALL USING (auth.role() = 'service_role');

-- Data retention: auto-archive search_history older than 1 year
CREATE OR REPLACE FUNCTION archive_old_search_history()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM public.search_history
  WHERE created_at < now() - INTERVAL '1 year';
$$;

-- Platform TOS legal risk scoring function
CREATE OR REPLACE FUNCTION compute_platform_tos_risk(p_platform text)
RETURNS jsonb
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_platform
    WHEN 'instagram' THEN jsonb_build_object(
      'risk_level', 'medium',
      'note', 'Apify scraping is subject to Meta TOS Section 3.2. Data is public profile data only. No private data accessed.',
      'score', 45
    )
    WHEN 'tiktok' THEN jsonb_build_object(
      'risk_level', 'medium',
      'note', 'TikTok scraping via Apify accesses public data only. TOS Section 2(d) prohibits automated access but enforcement is inconsistent.',
      'score', 50
    )
    WHEN 'youtube' THEN jsonb_build_object(
      'risk_level', 'low',
      'note', 'YouTube Data API v3 is the official API. Full TOS compliance.',
      'score', 10
    )
    ELSE jsonb_build_object('risk_level', 'unknown', 'score', 50)
  END;
$$;

-- Atomic AI credit deduction (Phase 3 Critical #4)
CREATE OR REPLACE FUNCTION consume_ai_credit(ws_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE workspaces
  SET ai_credits_remaining = ai_credits_remaining - 1
  WHERE id = ws_id
    AND ai_credits_remaining > 0;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- Allow 'partial' status for fallback enrichments (Phase 4 High #4)
ALTER TABLE public.influencer_profiles 
DROP CONSTRAINT IF EXISTS influencer_profiles_enrichment_status_check;

ALTER TABLE public.influencer_profiles 
ADD CONSTRAINT influencer_profiles_enrichment_status_check 
CHECK (enrichment_status IN ('pending','processing','success','failed','partial','queued'));

-- Niche confidence and correction tracking (Phase 4 High #5)
ALTER TABLE public.influencer_profiles
  ADD COLUMN IF NOT EXISTS niche_confidence int CHECK (niche_confidence >= 0 AND niche_confidence <= 100),
  ADD COLUMN IF NOT EXISTS niche_method text,
  ADD COLUMN IF NOT EXISTS niche_corrected_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS niche_corrected_at timestamptz,
  ADD COLUMN IF NOT EXISTS niche_original text;  -- stores AI-classified niche before human correction

-- Function: record a human niche correction (builds training dataset)
CREATE OR REPLACE FUNCTION correct_influencer_niche(
  p_profile_id uuid,
  p_new_niche text,
  p_correcting_user uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.influencer_profiles
  SET 
    niche_original = COALESCE(niche_original, primary_niche),  -- preserve first AI guess
    primary_niche = p_new_niche,
    niche_confidence = 100,  -- human-corrected = 100% confident
    niche_corrected_by = p_correcting_user,
    niche_corrected_at = now()
  WHERE id = p_profile_id;
END;
$$;

-- View: training data for future ML niche model
-- Export this to retrain the classifier when you have 500+ corrections
CREATE OR REPLACE VIEW public.niche_training_data AS
SELECT 
  id,
  platform,
  username,
  bio,
  primary_niche AS corrected_niche,
  niche_original AS ai_predicted_niche,
  niche_confidence,
  niche_corrected_at
FROM public.influencer_profiles
WHERE niche_corrected_by IS NOT NULL
ORDER BY niche_corrected_at DESC;

-- Weekly follower growth summary (computed from follower_history) (Phase 4 High #6)
CREATE OR REPLACE VIEW public.influencer_growth_signals AS
SELECT 
  p.id,
  p.platform,
  p.username,
  p.follower_count AS current_followers,
  -- 7-day delta
  (p.follower_count - LAG(fh.follower_count) OVER (
    PARTITION BY fh.profile_id ORDER BY fh.recorded_at
  )) AS weekly_delta,
  -- 30-day delta (approx — latest vs 30 days ago)
  (p.follower_count - FIRST_VALUE(fh.follower_count) OVER (
    PARTITION BY fh.profile_id 
    ORDER BY fh.recorded_at
    RANGE BETWEEN INTERVAL '30 days' PRECEDING AND INTERVAL '30 days' PRECEDING
  )) AS monthly_delta,
  -- Growth rate per day (lifetime average)
  CASE 
    WHEN EXTRACT(EPOCH FROM (now() - MIN(fh.recorded_at) OVER (PARTITION BY fh.profile_id))) > 0
    THEN p.follower_count / NULLIF(
      EXTRACT(EPOCH FROM (now() - MIN(fh.recorded_at) OVER (PARTITION BY fh.profile_id))) / 86400, 0
    )
    ELSE NULL
  END AS avg_daily_growth,
  -- Signal: is this creator accelerating?
  CASE
    WHEN (p.follower_count - LAG(fh.follower_count) OVER (
      PARTITION BY fh.profile_id ORDER BY fh.recorded_at
    )) > 1000 THEN 'accelerating'
    WHEN (p.follower_count - LAG(fh.follower_count) OVER (
      PARTITION BY fh.profile_id ORDER BY fh.recorded_at
    )) < -500 THEN 'declining'
    ELSE 'stable'
  END AS growth_signal,
  fh.recorded_at AS snapshot_at
FROM public.influencer_profiles p
JOIN public.follower_history fh ON fh.profile_id = p.id;
