-- ═══════════════════════════════════════════════════════════════════
-- PHASE 7 MIGRATION — Final bug fixes
-- ═══════════════════════════════════════════════════════════════════

-- Fix consume_ai_credit (needed by ai-insights and search-natural)
CREATE OR REPLACE FUNCTION consume_ai_credit(ws_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE workspaces
  SET ai_credits_remaining = ai_credits_remaining - 1
  WHERE id = ws_id AND ai_credits_remaining > 0;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
  END IF;
END;
$$;
-- Fix consume_email_credit (needed by send-outreach-email)
CREATE OR REPLACE FUNCTION consume_email_credit(ws_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE workspaces
  SET email_sends_remaining = email_sends_remaining - 1
  WHERE id = ws_id AND email_sends_remaining > 0;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
  END IF;
END;
$$;
-- Fix consume_enrichment_credit (already exists but verify correctness)
CREATE OR REPLACE FUNCTION consume_enrichment_credit(ws_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE workspaces
  SET enrichment_credits_remaining = enrichment_credits_remaining - 1
  WHERE id = ws_id AND enrichment_credits_remaining > 0;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
  END IF;
END;
$$;
-- Fix consume_search_credit (already fixed in Phase 6 but ensure it's correct)
CREATE OR REPLACE FUNCTION consume_search_credit(ws_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE workspaces
  SET search_credits_remaining = search_credits_remaining - 1
  WHERE id = ws_id AND search_credits_remaining > 0;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
  END IF;
END;
$$;
-- Bot detection feedback tables (from Part 3)
CREATE TABLE IF NOT EXISTS public.bot_detection_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  username text NOT NULL,
  predicted_score int NOT NULL,
  user_verdict text NOT NULL CHECK (user_verdict IN ('authentic','bot','unsure')),
  signals_triggered jsonb DEFAULT '[]',
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bot_feedback_platform ON public.bot_detection_feedback(platform, username);
ALTER TABLE public.bot_detection_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can submit bot feedback" ON public.bot_detection_feedback
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins read bot feedback" ON public.bot_detection_feedback
  FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin')));
CREATE TABLE IF NOT EXISTS public.bot_signal_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_name text UNIQUE NOT NULL,
  weight_current numeric(6,2) NOT NULL DEFAULT 10,
  weight_original numeric(6,2) NOT NULL DEFAULT 10,
  feedback_count int NOT NULL DEFAULT 0,
  correct_count int NOT NULL DEFAULT 0,
  accuracy_rate numeric(5,2) GENERATED ALWAYS AS (
    CASE WHEN feedback_count > 0 THEN (correct_count::numeric / feedback_count) * 100 ELSE NULL END
  ) STORED,
  last_updated_at timestamptz DEFAULT now()
);
INSERT INTO public.bot_signal_weights (signal_name, weight_current, weight_original) VALUES
  ('suspicious_ratio',20,20),('ghost_audience',25,25),('high_engagement_rate',18,18),
  ('dead_audience_low_er',20,20),('no_bio',8,8),('low_posts_high_followers',15,15),
  ('very_new_account',12,12),('rapid_following',18,18),('comment_like_ratio',22,22),
  ('high_sponsored_ratio',8,8),('platform_er_outlier',18,18),('tiktok_like_view_ratio',12,12),
  ('suspicious_username',8,8),('very_low_post_rate',12,12),('abnormal_followers_per_post',10,10),
  ('growth_spike_anomaly',22,22)
ON CONFLICT (signal_name) DO NOTHING;
CREATE OR REPLACE FUNCTION process_bot_feedback(
  p_username text, p_platform text, p_predicted_score int,
  p_verdict text, p_signals_triggered jsonb
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_was_correct bool;
  v_signal text;
BEGIN
  v_was_correct := (p_verdict = 'bot' AND p_predicted_score >= 50) OR
                   (p_verdict = 'authentic' AND p_predicted_score < 50);
  FOR v_signal IN SELECT jsonb_array_elements_text(p_signals_triggered) LOOP
    UPDATE bot_signal_weights
    SET
      feedback_count = feedback_count + 1,
      correct_count = correct_count + CASE WHEN v_was_correct THEN 1 ELSE 0 END,
      weight_current = CASE
        WHEN v_was_correct THEN LEAST(weight_current * 1.05, weight_original * 2)
        ELSE GREATEST(weight_current * 0.95, weight_original * 0.3)
      END,
      last_updated_at = now()
    WHERE signal_name = v_signal;
  END LOOP;
END;
$$;
