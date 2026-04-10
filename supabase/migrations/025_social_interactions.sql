-- ── Likes ────────────────────────────────────────────────────
CREATE TABLE public.drink_likes (
  drink_log_id uuid NOT NULL REFERENCES public.drink_logs(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (drink_log_id, user_id)
);
CREATE INDEX idx_drink_likes_drink_log ON public.drink_likes(drink_log_id);

ALTER TABLE public.drink_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_select" ON public.drink_likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON public.drink_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete" ON public.drink_likes FOR DELETE USING (auth.uid() = user_id);

-- ── Comments ─────────────────────────────────────────────────
CREATE TABLE public.drink_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drink_log_id uuid NOT NULL REFERENCES public.drink_logs(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  content      text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_drink_comments_drink_log ON public.drink_comments(drink_log_id);

ALTER TABLE public.drink_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select" ON public.drink_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON public.drink_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON public.drink_comments FOR DELETE USING (auth.uid() = user_id);

-- ── Update get_feed() to include like/comment counts ─────────
DROP FUNCTION IF EXISTS public.get_feed(uuid, int, int);

CREATE OR REPLACE FUNCTION public.get_feed(
  p_user_id uuid,
  p_limit   int DEFAULT 20,
  p_offset  int DEFAULT 0
)
RETURNS TABLE (
  id               uuid,
  user_id          uuid,
  drink_type       text,
  drink_name       text,
  brand            text,
  quantity         numeric,
  location_name    text,
  location_lat     numeric,
  location_lng     numeric,
  notes            text,
  photo_url        text,
  rating           numeric,
  event_name       text,
  logged_at        timestamptz,
  ended_at         timestamptz,
  created_at       timestamptz,
  username         text,
  display_name     text,
  avatar_url       text,
  displayed_badges text[],
  session_id       uuid,
  session_title    text,
  like_count       bigint,
  comment_count    bigint,
  user_liked       boolean
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
    dl.ended_at,
    dl.created_at,
    p.username,
    p.display_name,
    p.avatar_url,
    p.displayed_badges,
    s.id        AS session_id,
    s.title     AS session_title,
    lk_agg.like_count,
    cm_agg.comment_count,
    COALESCE(ul.user_liked, false) AS user_liked
  FROM public.drink_logs dl
  JOIN public.profiles p ON p.id = dl.user_id
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
  WHERE dl.user_id = p_user_id
     OR dl.user_id IN (
       SELECT following_id FROM public.follows WHERE follower_id = p_user_id
     )
  ORDER BY dl.logged_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
