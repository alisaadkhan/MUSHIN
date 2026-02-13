
-- ==========================================
-- InfluenceIQ Phase 1 Database Schema
-- ==========================================

-- 1. ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.enrichment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'dead_letter');

-- 2. BASE TABLES

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Workspaces
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_credits_remaining INTEGER NOT NULL DEFAULT 50,
  enrichment_credits_remaining INTEGER NOT NULL DEFAULT 10,
  credits_reset_at TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Workspace Members
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role workspace_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user ON public.workspace_members(user_id);

-- User Roles (global roles, separate from workspace roles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Influencers Cache
CREATE TABLE public.influencers_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  enriched_at TIMESTAMPTZ,
  city_extracted TEXT,
  ttl_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.influencers_cache ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX idx_influencers_cache_platform_username ON public.influencers_cache(platform, username);

-- Enrichment Jobs
CREATE TABLE public.enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  status enrichment_status NOT NULL DEFAULT 'pending',
  idempotency_key TEXT NOT NULL,
  failure_reason TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.enrichment_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_enrichment_jobs_status ON public.enrichment_jobs(status, created_at);
CREATE UNIQUE INDEX idx_enrichment_jobs_idempotency ON public.enrichment_jobs(idempotency_key);

-- Search History
CREATE TABLE public.search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  platform TEXT NOT NULL,
  location TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_search_history_workspace ON public.search_history(workspace_id);

-- Saved Searches
CREATE TABLE public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- Influencer Lists
CREATE TABLE public.influencer_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.influencer_lists ENABLE ROW LEVEL SECURITY;

-- List Items
CREATE TABLE public.list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.influencer_lists(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_list_items_list ON public.list_items(list_id);

-- Credits Usage
CREATE TABLE public.credits_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.credits_usage ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_credits_usage_workspace ON public.credits_usage(workspace_id);

-- 3. HELPER FUNCTIONS

-- Check workspace membership
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = auth.uid()
  )
$$;

-- Check workspace ownership
CREATE OR REPLACE FUNCTION public.is_workspace_owner(_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND owner_id = auth.uid()
  )
$$;

-- Check global role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get user's workspace id (convenience)
CREATE OR REPLACE FUNCTION public.get_user_workspace_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.workspace_members
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- 4. TRIGGERS

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id UUID;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );

  -- Create default workspace
  new_workspace_id := gen_random_uuid();
  INSERT INTO public.workspaces (id, name, owner_id)
  VALUES (new_workspace_id, 'My Workspace', NEW.id);

  -- Add user as owner of workspace
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner');

  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.influencer_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_influencers_cache_updated_at BEFORE UPDATE ON public.influencers_cache FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_enrichment_jobs_updated_at BEFORE UPDATE ON public.enrichment_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5. RLS POLICIES

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Workspaces
CREATE POLICY "Members can view workspace" ON public.workspaces FOR SELECT TO authenticated USING (public.is_workspace_member(id));
CREATE POLICY "Users can create workspace" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners can update workspace" ON public.workspaces FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owners can delete workspace" ON public.workspaces FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Workspace Members
CREATE POLICY "Members can view members" ON public.workspace_members FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Owners can add members" ON public.workspace_members FOR INSERT TO authenticated WITH CHECK (public.is_workspace_owner(workspace_id));
CREATE POLICY "Owners can remove members" ON public.workspace_members FOR DELETE TO authenticated USING (public.is_workspace_owner(workspace_id));

-- User Roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Influencers Cache (shared resource, readable by any authenticated user for cache efficiency)
CREATE POLICY "Authenticated users can read cache" ON public.influencers_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage cache" ON public.influencers_cache FOR ALL TO service_role USING (true);

-- Enrichment Jobs
CREATE POLICY "Members can view workspace jobs" ON public.enrichment_jobs FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members can create jobs" ON public.enrichment_jobs FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Service role can update jobs" ON public.enrichment_jobs FOR UPDATE TO service_role USING (true);

-- Search History
CREATE POLICY "Members can view search history" ON public.search_history FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members can create search history" ON public.search_history FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));

-- Saved Searches
CREATE POLICY "Members can view saved searches" ON public.saved_searches FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members can create saved searches" ON public.saved_searches FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Members can update saved searches" ON public.saved_searches FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members can delete saved searches" ON public.saved_searches FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));

-- Influencer Lists
CREATE POLICY "Members can view lists" ON public.influencer_lists FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members can create lists" ON public.influencer_lists FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Members can update lists" ON public.influencer_lists FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members can delete lists" ON public.influencer_lists FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));

-- List Items (access via parent list's workspace)
CREATE POLICY "Members can view list items" ON public.list_items FOR SELECT TO authenticated
  USING (public.is_workspace_member((SELECT workspace_id FROM public.influencer_lists WHERE id = list_id)));
CREATE POLICY "Members can create list items" ON public.list_items FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member((SELECT workspace_id FROM public.influencer_lists WHERE id = list_id)));
CREATE POLICY "Members can update list items" ON public.list_items FOR UPDATE TO authenticated
  USING (public.is_workspace_member((SELECT workspace_id FROM public.influencer_lists WHERE id = list_id)));
CREATE POLICY "Members can delete list items" ON public.list_items FOR DELETE TO authenticated
  USING (public.is_workspace_member((SELECT workspace_id FROM public.influencer_lists WHERE id = list_id)));

-- Credits Usage
CREATE POLICY "Members can view credits" ON public.credits_usage FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members can log usage" ON public.credits_usage FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
