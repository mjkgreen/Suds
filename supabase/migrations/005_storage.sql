-- ============================================================
-- STORAGE: drink-photos bucket
-- Run this in the Supabase SQL editor.
-- ============================================================

-- Create the bucket (public so images load without auth tokens)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'drink-photos',
  'drink-photos',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read (public bucket)
CREATE POLICY "drink_photos_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'drink-photos');

-- Authenticated users can upload into their own folder (userId/filename)
CREATE POLICY "drink_photos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'drink-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own photos
CREATE POLICY "drink_photos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'drink-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
