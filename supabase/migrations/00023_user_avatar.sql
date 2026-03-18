-- supabase/migrations/00023_user_avatar.sql
-- Add avatar fields to profiles and create the avatars storage bucket.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url       TEXT,
  ADD COLUMN IF NOT EXISTS avatar_halo_color TEXT;

-- Storage bucket (public — avatars are shown to all users)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects (idempotent — safe to run even if already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users may upload only to their own path
CREATE POLICY "users_upload_own_avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "users_update_own_avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: anyone can read avatars (shown in nav, chat, explore)
CREATE POLICY "public_read_avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
