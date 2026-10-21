-- ============================================================
-- STORAGE CLEANUP FOR DELETED MEDIA
--
-- When a drink log is deleted, or a photo/video is removed from
-- one, its files are queued here and the cleanup-storage edge
-- function deletes them through the Storage API. (Deleting rows
-- from storage.objects in SQL would leave the files behind.)
--
-- Doing it from triggers covers every path that deletes drinks:
--   • deleting a single drink
--   • delete_session_with_drinks() — the host can't delete guest
--     members' files from the client, storage RLS blocks it
--   • delete_account() — cascades through profiles → drink_logs
-- Deleted profiles also queue their avatar.
--
-- Requires the cleanup-storage edge function to be deployed.
-- Anything that fails to delete stays queued and is retried on
-- the next run.
-- ============================================================

-- ── 1. Queue ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.storage_cleanup_queue (
  id         bigserial PRIMARY KEY,
  bucket_id  text        NOT NULL,
  path       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- No policies: only the service role (edge function) and the
-- SECURITY DEFINER triggers below can touch it.
ALTER TABLE public.storage_cleanup_queue ENABLE ROW LEVEL SECURITY;

-- ── 2. Helpers ───────────────────────────────────────────────
-- Public URLs look like
--   https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>[?v=…]
CREATE OR REPLACE FUNCTION public.storage_path_from_url(p_url text, p_bucket text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(
    split_part(substring(p_url FROM '/object/public/' || p_bucket || '/(.*)$'), '?', 1),
    ''
  );
$$;

-- Every file URL a drink log row points at (media, video posters,
-- and the legacy photo columns).
CREATE OR REPLACE FUNCTION public.drink_log_file_urls(
  p_media      jsonb,
  p_photo_urls text[],
  p_photo_url  text
)
RETURNS TABLE (url text)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT u FROM (
    SELECT m->>'url' AS u FROM jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) m
    UNION
    SELECT m->>'poster_url' FROM jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) m
    UNION
    SELECT unnest(coalesce(p_photo_urls, '{}'::text[]))
    UNION
    SELECT p_photo_url
  ) all_urls
  WHERE u IS NOT NULL;
$$;

-- ── 3. Queue files from deleted / edited drink logs ──────────
CREATE OR REPLACE FUNCTION public.queue_drink_log_file_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.storage_cleanup_queue (bucket_id, path)
  SELECT DISTINCT 'drink-photos', public.storage_path_from_url(old_urls.url, 'drink-photos')
  FROM public.drink_log_file_urls(OLD.media, OLD.photo_urls, OLD.photo_url) old_urls
  WHERE public.storage_path_from_url(old_urls.url, 'drink-photos') IS NOT NULL
    AND (
      TG_OP = 'DELETE'
      OR old_urls.url NOT IN (
        SELECT new_urls.url
        FROM public.drink_log_file_urls(NEW.media, NEW.photo_urls, NEW.photo_url) new_urls
      )
    );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS drink_logs_queue_file_cleanup_delete ON public.drink_logs;
CREATE TRIGGER drink_logs_queue_file_cleanup_delete
  AFTER DELETE ON public.drink_logs
  FOR EACH ROW EXECUTE FUNCTION public.queue_drink_log_file_cleanup();

DROP TRIGGER IF EXISTS drink_logs_queue_file_cleanup_update ON public.drink_logs;
CREATE TRIGGER drink_logs_queue_file_cleanup_update
  AFTER UPDATE OF media, photo_urls, photo_url ON public.drink_logs
  FOR EACH ROW EXECUTE FUNCTION public.queue_drink_log_file_cleanup();

-- ── 4. Queue avatars from deleted profiles ───────────────────
CREATE OR REPLACE FUNCTION public.queue_avatar_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_path text := public.storage_path_from_url(OLD.avatar_url, 'avatars');
BEGIN
  IF v_path IS NOT NULL THEN
    INSERT INTO public.storage_cleanup_queue (bucket_id, path) VALUES ('avatars', v_path);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS profiles_queue_avatar_cleanup ON public.profiles;
CREATE TRIGGER profiles_queue_avatar_cleanup
  AFTER DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.queue_avatar_cleanup();

-- ── 5. Kick the edge function ────────────────────────────────
-- Once per statement, so deleting a whole session makes one call.
-- pg_net sends the request after the transaction commits, so the
-- function sees the queued rows. Best-effort: a failure here never
-- blocks the delete, and leftovers are drained on the next run.
CREATE OR REPLACE FUNCTION public.kick_storage_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.storage_cleanup_queue) THEN
    RETURN NULL;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url     := coalesce(
                   nullif(current_setting('app.supabase_url', true), ''),
                   'https://gbenibgytweskljxneup.supabase.co'
                 ) || '/functions/v1/cleanup-storage',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.anon_key', true)
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'kick_storage_cleanup: %', SQLERRM;
  END;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS drink_logs_kick_storage_cleanup ON public.drink_logs;
CREATE TRIGGER drink_logs_kick_storage_cleanup
  AFTER DELETE OR UPDATE OF media, photo_urls, photo_url ON public.drink_logs
  FOR EACH STATEMENT EXECUTE FUNCTION public.kick_storage_cleanup();

DROP TRIGGER IF EXISTS profiles_kick_storage_cleanup ON public.profiles;
CREATE TRIGGER profiles_kick_storage_cleanup
  AFTER DELETE ON public.profiles
  FOR EACH STATEMENT EXECUTE FUNCTION public.kick_storage_cleanup();
