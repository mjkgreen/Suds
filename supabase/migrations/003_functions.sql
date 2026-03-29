-- ============================================================
-- FEED FUNCTION
-- Returns drink_logs from yourself + people you follow.
-- ============================================================
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
  quantity      numeric,
  location_name text,
  location_lat  numeric,
  location_lng  numeric,
  notes         text,
  photo_url     text,
  logged_at     timestamptz,
  created_at    timestamptz,
  -- profile fields joined inline
  username      text,
  display_name  text,
  avatar_url    text
) AS $$
  SELECT
    dl.id,
    dl.user_id,
    dl.drink_type,
    dl.drink_name,
    dl.quantity,
    dl.location_name,
    dl.location_lat,
    dl.location_lng,
    dl.notes,
    dl.photo_url,
    dl.logged_at,
    dl.created_at,
    p.username,
    p.display_name,
    p.avatar_url
  FROM public.drink_logs dl
  JOIN public.profiles p ON p.id = dl.user_id
  WHERE dl.user_id = p_user_id
     OR dl.user_id IN (
       SELECT following_id FROM public.follows WHERE follower_id = p_user_id
     )
  ORDER BY dl.logged_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- USER STATS FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'total_drinks',       COUNT(*),
    'total_quantity',     COALESCE(SUM(quantity), 0),
    'drinks_this_week',   COUNT(*) FILTER (WHERE logged_at >= date_trunc('week', now())),
    'drinks_this_month',  COUNT(*) FILTER (WHERE logged_at >= date_trunc('month', now())),
    'favorite_drink_types', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT drink_type, COUNT(*) AS count
        FROM public.drink_logs
        WHERE user_id = p_user_id
        GROUP BY drink_type
        ORDER BY count DESC
        LIMIT 3
      ) t
    ),
    'activity_by_day', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT
          to_char(date_trunc('day', logged_at), 'YYYY-MM-DD') AS date,
          COUNT(*) AS count
        FROM public.drink_logs
        WHERE user_id = p_user_id
          AND logged_at >= now() - interval '365 days'
        GROUP BY date_trunc('day', logged_at)
        ORDER BY date
      ) t
    )
  )
  INTO v_result
  FROM public.drink_logs
  WHERE user_id = p_user_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- PROFILE COUNTS VIEW (follower/following counts)
-- ============================================================
CREATE OR REPLACE VIEW public.profile_counts AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.created_at,
  COUNT(DISTINCT f1.follower_id)  AS followers_count,
  COUNT(DISTINCT f2.following_id) AS following_count
FROM public.profiles p
LEFT JOIN public.follows f1 ON f1.following_id = p.id
LEFT JOIN public.follows f2 ON f2.follower_id = p.id
GROUP BY p.id;
