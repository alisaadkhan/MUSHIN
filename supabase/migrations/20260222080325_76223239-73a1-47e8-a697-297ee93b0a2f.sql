
-- Create influencer_evaluations table for caching AI evaluation results
CREATE TABLE public.influencer_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  evaluation JSONB NOT NULL DEFAULT '{}'::jsonb,
  overall_score INTEGER NOT NULL DEFAULT 0,
  evaluated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE
);

-- Unique constraint per workspace
ALTER TABLE public.influencer_evaluations
  ADD CONSTRAINT influencer_evaluations_platform_username_workspace_key
  UNIQUE (platform, username, workspace_id);

-- Index for sorting by score
CREATE INDEX idx_influencer_evaluations_score ON public.influencer_evaluations (overall_score DESC);

-- Index for lookups
CREATE INDEX idx_influencer_evaluations_lookup ON public.influencer_evaluations (platform, username, workspace_id);

-- Enable RLS
ALTER TABLE public.influencer_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS policies scoped to workspace members
CREATE POLICY "Members can view evaluations"
  ON public.influencer_evaluations FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Members can create evaluations"
  ON public.influencer_evaluations FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "Members can update evaluations"
  ON public.influencer_evaluations FOR UPDATE
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Members can delete evaluations"
  ON public.influencer_evaluations FOR DELETE
  USING (is_workspace_member(workspace_id));
