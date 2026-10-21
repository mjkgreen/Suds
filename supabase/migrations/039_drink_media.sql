-- ============================================================
-- DRINK MEDIA
--
-- Photos are now cropped by the user into a fixed landscape
-- (4:3) or portrait (4:5) frame before upload, and drinks can
-- carry short videos. Each attachment is described in a new
-- `media` jsonb array so the UI can render it at its real frame:
--
--   [{ "url": text, "type": "image" | "video",
--      "width": int, "height": int,
--      "poster_url": text, "duration": number }]   -- last two: video only
--
-- photo_url / photo_urls are still written (image URLs, or a
-- video's poster) so older app builds keep working.
-- ============================================================

-- ── 1. media column + backfill ───────────────────────────────
ALTER TABLE public.drink_logs
  ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Legacy photos have no known size; the app renders them landscape.
UPDATE public.drink_logs
  SET media = (
    SELECT jsonb_agg(jsonb_build_object('url', u, 'type', 'image') ORDER BY ord)
    FROM unnest(photo_urls) WITH ORDINALITY AS t(u, ord)
  )
  WHERE media = '[]'::jsonb AND cardinality(photo_urls) > 0;

-- ── 2. Allow video in the drink-photos bucket ────────────────
-- Files are now streamed from disk rather than sent as base64,
-- so larger files are fine. 50 MB is the Supabase free-plan cap.
UPDATE storage.buckets
  SET file_size_limit = 52428800,
      allowed_mime_types = ARRAY[
        'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
        'video/mp4', 'video/quicktime', 'video/webm'
      ]
  WHERE id = 'drink-photos';

-- ── 3. get_feed: return media ────────────────────────────────
-- Body identical to 038 with dl.media appended to the result.
DROP FUNCTION IF EXISTS public.get_feed(uuid, int, int);

CREATE OR REPLACE FUNCTION public.get_feed(
  p_user_id uuid,
  p_limit   int DEFAULT 20,
  p_offset  int DEFAULT 0
)
RETURNS TABLE (
  id                 uuid,
  user_id            uuid,
  drink_type         text,
  drink_name         text,
  brand              text,
  quantity           numeric,
  location_name      text,
  location_lat       numeric,
  location_lng       numeric,
  notes              text,
  photo_url          text,
  photo_urls         text[],
  rating             numeric,
  event_name         text,
  logged_at          timestamptz,
  ended_at           timestamptz,
  created_at         timestamptz,
  username           text,
  display_name       text,
  avatar_url         text,
  displayed_badges   text[],
  session_id         uuid,
  session_title      text,
  session_started_at timestamptz,
  session_ended_at   timestamptz,
  like_count         bigint,
  comment_count      bigint,
  user_liked         boolean,
  media              jsonb
) AS $$
  SELECT
    dl.id,
    dl.user_id,
    dl.drink_type,
    dl.drink_name,
    dl.brand,
    dl.quantity,
    dl.location_name,
    dl.location_lat,
    dl.location_lng,
    dl.notes,
    dl.photo_url,
    dl.photo_urls,
    dl.rating,
    dl.event_name,
    dl.logged_at,
    dl.ended_at,
    dl.created_at,
    p.username,
    p.display_name,
    p.avatar_url,
    ub.badge_ids AS displayed_badges,
    s.id         AS session_id,
    s.title      AS session_title,
    s.started_at AS session_started_at,
    s.ended_at   AS session_ended_at,
    lk_agg.like_count,
    cm_agg.comment_count,
    COALESCE(ul.user_liked, false) AS user_liked,
    dl.media
  FROM public.drink_logs dl
  JOIN public.profiles p ON p.id = dl.user_id
  LEFT JOIN public.user_badges ub ON ub.user_id = dl.user_id
  LEFT JOIN public.sessions s ON s.id = dl.session_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS like_count FROM public.drink_likes WHERE drink_log_id = dl.id
  ) lk_agg ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS comment_count FROM public.drink_comments WHERE drink_log_id = dl.id
  ) cm_agg ON true
  LEFT JOIN LATERAL (
    SELECT true AS user_liked FROM public.drink_likes
    WHERE drink_log_id = dl.id AND user_id = p_user_id
    LIMIT 1
  ) ul ON true
  WHERE (
    (
      p_user_id = auth.uid()
      AND (
        dl.user_id = p_user_id
        OR dl.user_id IN (
          SELECT following_id FROM public.follows WHERE follower_id = p_user_id
        )
      )
    )
    OR (
      p_user_id <> auth.uid()
      AND dl.user_id = p_user_id
      AND public.can_view_user(auth.uid(), p_user_id)
    )
  )
  AND (dl.user_id = auth.uid() OR NOT public.is_blocked(auth.uid(), dl.user_id))
  ORDER BY dl.logged_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
