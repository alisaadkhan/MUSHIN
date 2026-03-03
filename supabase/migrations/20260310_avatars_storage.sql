-- ── Avatar Storage Bucket + RLS Policies ──────────────────────────────────
-- Creates the public 'avatars' bucket and grants authenticated users the
-- ability to upload/update/delete their own avatar file.
-- Public read access lets avatar URLs work in <img> tags without a signed URL.

-- 1. Create bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  1048576,   -- 1 MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public            = true,
      file_size_limit   = 1048576,
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/gif','image/webp'];

-- 2. Drop existing policies to avoid conflicts on re-run
DROP POLICY IF EXISTS "avatars_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_insert"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_update"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_delete"   ON storage.objects;

-- 3. Public read — anyone (including anon) can view avatars via public URL
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- 4. Authenticated upload — users can only write to their own folder ({uid}/*)
CREATE POLICY "avatars_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Authenticated update (upsert overwrites existing file)
CREATE POLICY "avatars_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 6. Authenticated delete — users can remove their own avatar
CREATE POLICY "avatars_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
