-- ============================================================
-- Migration: Admin RBAC + Audit Log
-- Handles BOTH empty DB (creates enum) and existing DB (adds values)
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1.1 Create app_role enum with all values (or add missing ones if it already exists)
DO $$
BEGIN
  -- Create the type fresh if it doesn't exist at all
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'super_admin', 'support', 'viewer', 'system_admin');
  ELSE
    -- Type exists (existing DB): add new values if missing
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'super_admin' AND enumtypid = 'public.app_role'::regtype) THEN
      ALTER TYPE public.app_role ADD VALUE 'super_admin';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'support' AND enumtypid = 'public.app_role'::regtype) THEN
      ALTER TYPE public.app_role ADD VALUE 'support';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'viewer' AND enumtypid = 'public.app_role'::regtype) THEN
      ALTER TYPE public.app_role ADD VALUE 'viewer';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'system_admin' AND enumtypid = 'public.app_role'::regtype) THEN
      ALTER TYPE public.app_role ADD VALUE 'system_admin';
    END IF;
  END IF;
END $$;
-- 1.2 Create workspace_role enum if missing (needed by workspace_members)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'member');
  END IF;
END $$;
-- 1.3 Create campaign_status enum if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaign_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.campaign_status AS ENUM ('draft', 'active', 'completed', 'archived');
  END IF;
END $$;
-- 1.4 Create enrichment_status enum if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrichment_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.enrichment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'dead_letter');
  END IF;
END $$;
-- ── Core tables (safe to run on empty DB) ─────────────────────────────────────

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  consent_given_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
CREATE POLICY "Users can manage own profile" ON public.profiles
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
-- workspaces
CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  search_credits_remaining integer NOT NULL DEFAULT 3,
  ai_credits_remaining integer NOT NULL DEFAULT 5,
  email_sends_remaining integer NOT NULL DEFAULT 10,
  enrichment_credits_remaining integer NOT NULL DEFAULT 5,
  credits_reset_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace owner access" ON public.workspaces;
CREATE POLICY "Workspace owner access" ON public.workspaces
  USING (auth.uid() = owner_id);
-- workspace_members
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.workspace_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view own membership" ON public.workspace_members;
CREATE POLICY "Members can view own membership" ON public.workspace_members
  USING (auth.uid() = user_id);
-- user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
-- subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner can read subscription" ON public.subscriptions;
CREATE POLICY "Owner can read subscription" ON public.subscriptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  );
-- influencers_cache
CREATE TABLE IF NOT EXISTS public.influencers_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  username text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  city_extracted text,
  enriched_at timestamptz,
  ttl_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(platform, username)
);
-- influencer_lists
CREATE TABLE IF NOT EXISTS public.influencer_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.influencer_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace members can manage lists" ON public.influencer_lists;
CREATE POLICY "Workspace members can manage lists" ON public.influencer_lists
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = influencer_lists.workspace_id AND wm.user_id = auth.uid()));
-- list_items
CREATE TABLE IF NOT EXISTS public.list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.influencer_lists(id) ON DELETE CASCADE,
  platform text NOT NULL,
  username text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(list_id, platform, username)
);
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "List members can manage items" ON public.list_items;
CREATE POLICY "List members can manage items" ON public.list_items
  USING (EXISTS (
    SELECT 1 FROM public.influencer_lists il
    JOIN public.workspace_members wm ON wm.workspace_id = il.workspace_id
    WHERE il.id = list_id AND wm.user_id = auth.uid()
  ));
-- campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  budget numeric,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace members can manage campaigns" ON public.campaigns;
CREATE POLICY "Workspace members can manage campaigns" ON public.campaigns
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = campaigns.workspace_id AND wm.user_id = auth.uid()));
-- pipeline_stages
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#6d28d9',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace members can manage pipeline stages" ON public.pipeline_stages;
CREATE POLICY "Workspace members can manage pipeline stages" ON public.pipeline_stages
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = campaign_id AND wm.user_id = auth.uid()
  ));
-- pipeline_cards
CREATE TABLE IF NOT EXISTS public.pipeline_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  username text NOT NULL,
  platform text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  notes text,
  agreed_rate numeric,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pipeline_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace members can manage pipeline cards" ON public.pipeline_cards;
CREATE POLICY "Workspace members can manage pipeline cards" ON public.pipeline_cards
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = campaign_id AND wm.user_id = auth.uid()
  ));
-- campaign_activity
CREATE TABLE IF NOT EXISTS public.campaign_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaign_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace members can view activity" ON public.campaign_activity;
CREATE POLICY "Workspace members can view activity" ON public.campaign_activity
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = campaign_id AND wm.user_id = auth.uid()
    )
  );
-- outreach_log
CREATE TABLE IF NOT EXISTS public.outreach_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.pipeline_cards(id) ON DELETE CASCADE,
  username text NOT NULL,
  platform text NOT NULL,
  method text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'sent',
  email_to text,
  email_subject text,
  notes text,
  contacted_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz,
  clicked_at timestamptz,
  unsubscribed boolean DEFAULT false
);
ALTER TABLE public.outreach_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace members can view outreach" ON public.outreach_log;
CREATE POLICY "Workspace members can view outreach" ON public.outreach_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = campaign_id AND wm.user_id = auth.uid()
    )
  );
-- email_templates
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace members can manage templates" ON public.email_templates;
CREATE POLICY "Workspace members can manage templates" ON public.email_templates
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = email_templates.workspace_id AND wm.user_id = auth.uid()));
-- search_history
CREATE TABLE IF NOT EXISTS public.search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  query text NOT NULL,
  platform text NOT NULL,
  location text,
  result_count integer NOT NULL DEFAULT 0,
  filters jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace members can view history" ON public.search_history;
CREATE POLICY "Workspace members can view history" ON public.search_history
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = search_history.workspace_id AND wm.user_id = auth.uid()));
-- saved_searches
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace members can manage saved searches" ON public.saved_searches;
CREATE POLICY "Workspace members can manage saved searches" ON public.saved_searches
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = saved_searches.workspace_id AND wm.user_id = auth.uid()));
-- credits_usage
CREATE TABLE IF NOT EXISTS public.credits_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  amount integer NOT NULL,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.credits_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace members can view credits" ON public.credits_usage;
CREATE POLICY "Workspace members can view credits" ON public.credits_usage
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = credits_usage.workspace_id AND wm.user_id = auth.uid()));
-- influencer_evaluations
CREATE TABLE IF NOT EXISTS public.influencer_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform text NOT NULL,
  username text NOT NULL,
  evaluation jsonb NOT NULL DEFAULT '{}',
  overall_score integer NOT NULL DEFAULT 0,
  evaluated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.influencer_evaluations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace members can view evaluations" ON public.influencer_evaluations;
CREATE POLICY "Workspace members can view evaluations" ON public.influencer_evaluations
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = influencer_evaluations.workspace_id AND wm.user_id = auth.uid()));
-- enrichment_jobs
CREATE TABLE IF NOT EXISTS public.enrichment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform text NOT NULL,
  username text NOT NULL,
  status public.enrichment_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  idempotency_key text NOT NULL UNIQUE,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.enrichment_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace owners can manage jobs" ON public.enrichment_jobs;
CREATE POLICY "Workspace owners can manage jobs" ON public.enrichment_jobs
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
-- workspace_secrets
CREATE TABLE IF NOT EXISTS public.workspace_secrets (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  hubspot_api_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workspace_secrets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace owners can manage secrets" ON public.workspace_secrets;
CREATE POLICY "Workspace owners can manage secrets" ON public.workspace_secrets
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
-- tracking_links (if used by generate-tracking-link fn)
CREATE TABLE IF NOT EXISTS public.tracking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  original_url text NOT NULL,
  short_code text NOT NULL UNIQUE,
  click_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tracking_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace members can manage tracking links" ON public.tracking_links;
CREATE POLICY "Workspace members can manage tracking links" ON public.tracking_links
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = tracking_links.workspace_id AND wm.user_id = auth.uid()));
-- tracking_events
CREATE TABLE IF NOT EXISTS public.tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.tracking_links(id) ON DELETE CASCADE,
  ip_address text,
  user_agent text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  stripe_invoice_id text UNIQUE,
  amount_paid integer,
  currency text DEFAULT 'usd',
  status text,
  invoice_pdf text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace owners can view invoices" ON public.invoices;
CREATE POLICY "Workspace owners can view invoices" ON public.invoices
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
-- ── Helper functions ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;
CREATE OR REPLACE FUNCTION public.get_user_workspace_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT wm.workspace_id FROM public.workspace_members wm
  WHERE wm.user_id = auth.uid()
  LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.get_user_workspace()
RETURNS TABLE(workspace_id uuid, role text)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT wm.workspace_id, wm.role::text FROM public.workspace_members wm
  WHERE wm.user_id = auth.uid()
  LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = auth.uid()
  );
$$;
CREATE OR REPLACE FUNCTION public.is_workspace_owner(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND owner_id = auth.uid()
  );
$$;
-- ── Trigger: auto-create profile + workspace + membership + role on sign-up ──

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;

  -- Create workspace
  INSERT INTO public.workspaces (owner_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Workspace')
  RETURNING id INTO v_workspace_id;

  -- Add owner as workspace member
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'owner')
  ON CONFLICT DO NOTHING;

  -- Add default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- ── Admin audit log ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super_admin can view audit log" ON public.admin_audit_log;
CREATE POLICY "super_admin can view audit log" ON public.admin_audit_log
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
DROP POLICY IF EXISTS "service role can insert audit log" ON public.admin_audit_log;
CREATE POLICY "service role can insert audit log" ON public.admin_audit_log
  FOR INSERT WITH CHECK (true);
-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_roles_role    ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_ws  ON public.search_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_influencers_cache_platform_username ON public.influencers_cache(platform, username);
