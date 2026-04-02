-- Add event_name column to drink_logs
ALTER TABLE public.drink_logs
  ADD COLUMN IF NOT EXISTS event_name text;

-- ============================================================
-- Updated get_feed — includes brand, rating, event_name
-- ============================================================
DROP FUNCTION IF EXISTS public.get_feed(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_feed(
  p_user_id uuid,
  p_limit   int DEFAULT 20,
  p_offset  int DEFAULT 0
)
RETURNS TABLE (
  id            uuid,
  user_id       uuid,
  drink_type    text,
  drink_name    text,
  brand         text,
  quantity      numeric,
  location_name text,
  location_lat  numeric,
  location_lng  numeric,
  notes         text,
  photo_url     text,
  rating        numeric,
  event_name    text,
  logged_at     timestamptz,
  created_at    timestamptz,
  username      text,
  display_name  text,
  avatar_url    text,
  session_id    uuid,
  session_title text
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
    dl.rating,
    dl.event_name,
    dl.logged_at,
    dl.created_at,
    p.username,
    p.display_name,
    p.avatar_url,
    s.id        AS session_id,
    s.title     AS session_title
  FROM public.drink_logs dl
  JOIN public.profiles p ON p.id = dl.user_id
  LEFT JOIN public.sessions s ON s.id = dl.session_id
  WHERE dl.user_id = p_user_id
     OR dl.user_id IN (
       SELECT following_id FROM public.follows WHERE follower_id = p_user_id
     )
  ORDER BY dl.logged_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
