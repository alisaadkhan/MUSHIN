-- ═══════════════════════════════════════════════════════════════════════════════
-- SECURITY GAPS MIGRATION
-- Applied: 2026-03-21
-- Fixes two remaining vulnerabilities identified in the security audit:
--   1. Storage bucket user-UUID enumeration via anon SELECT on storage.objects
--   2. support_ticket_replies.is_admin injection by non-admin users
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: Storage enumeration fix
-- The previous "avatars_public_read" SELECT policy had no role restriction,
-- meaning the anon role could call storage.list() and enumerate every user
-- UUID from the folder structure ({uid}/avatar.jpg).
--
-- NOTE: Setting bucket public=true in storage.buckets means individual files
-- remain accessible via the public CDN URL
-- (/storage/v1/object/public/avatars/{uid}/avatar.jpg) without going through
-- RLS — so display of other users' avatars in the UI continues to work.
-- The SELECT RLS policy below only affects the storage *listing* API.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the overly broad read policy that allowed anon enumeration
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;

-- Authenticated users may only list/download their own avatar folder.
-- Public CDN URLs (used by the app for displaying any user's avatar) bypass
-- this policy entirely because the bucket is public=true.
DROP POLICY IF EXISTS "avatars_own_select" ON storage.objects;
CREATE POLICY "avatars_own_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: support_ticket_replies.is_admin injection fix
-- The INSERT RLS policy "Users reply to own tickets" correctly validates author_id
-- and ticket ownership, but it performs NO check on the is_admin column value.
-- A regular user could therefore insert a reply with is_admin=true, making
-- their message appear as "Support Team" in the UI.
--
-- Fix: a BEFORE INSERT OR UPDATE trigger that enforces is_admin=false for
-- non-admin callers. Admins (role IN admin/super_admin) are allowed to set
-- is_admin=true. service_role (edge functions) bypasses the check entirely.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_reply_is_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role bypass (edge functions may set is_admin freely)
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- If caller attempts to set is_admin = true, verify they hold an admin role
  IF NEW.is_admin = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    ) THEN
      RAISE EXCEPTION 'SECURITY_VIOLATION: Only admins may set is_admin=true on support replies';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reply_is_admin_check ON public.support_ticket_replies;
CREATE TRIGGER trg_reply_is_admin_check
  BEFORE INSERT OR UPDATE ON public.support_ticket_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_reply_is_admin();

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: Harden the handle_new_user trigger against metadata injection
-- When a new user signs up, Supabase fires handle_new_user() which creates
-- the profile and workspace. Ensure it never reads is_admin, role, or any
-- privilege-escalating key from raw_user_meta_data — only safe fields
-- (full_name, avatar_url) are allowed.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  -- Only extract safe, non-privilege fields from metadata
  v_full_name    text := COALESCE(
                           NEW.raw_user_meta_data->>'full_name',
                           split_part(NEW.email, '@', 1)
                         );
BEGIN
  -- 1. Create profile (never reads role/is_admin from metadata)
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, v_full_name, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  -- 2. Create default workspace for the new user
  v_workspace_id := gen_random_uuid();
  INSERT INTO public.workspaces (id, owner_id, name, plan)
  VALUES (
    v_workspace_id,
    NEW.id,
    v_full_name || '''s Workspace',
    'free'
  )
  ON CONFLICT DO NOTHING;

  -- 3. Add owner as workspace member
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never break signup due to a trigger error
  RETURN NEW;
END;
$$;
