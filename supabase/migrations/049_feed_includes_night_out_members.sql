-- ============================================================
-- FEED INCLUDES EVERYONE IN YOUR NIGHT OUTS
--
-- get_feed only returned drinks from you and people you follow, so a
-- night out shared with someone you don't follow showed only part of
-- the group's drinks on your feed card: the totals were short and you
-- couldn't +1 their drinks. Your own feed now also includes every
-- drink in a night out you're a member of. Blocked users stay hidden.
-- Otherwise identical to 042's get_feed.
-- ============================================================

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
  media              jsonb,
  tagged_users       jsonb
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
    dl.media,
    COALESCE(tg.tagged_users, '[]'::jsonb) AS tagged_users
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
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
             jsonb_build_object('id', tp.id, 'username', tp.username, 'display_name', tp.display_name)
             ORDER BY t.created_at
           ) AS tagged_users
    FROM public.drink_tags t
    JOIN public.profiles tp ON tp.id = t.user_id
    WHERE t.drink_log_id = dl.id
      AND NOT public.is_blocked(auth.uid(), t.user_id)
  ) tg ON true
  WHERE (
    (
      p_user_id = auth.uid()
      AND (
        dl.user_id = p_user_id
        OR dl.user_id IN (
          SELECT following_id FROM public.follows WHERE follower_id = p_user_id
        )
        -- Everyone's drinks in night outs you're part of, followed or not,
        -- so the night-out card shows (and totals) the whole group.
        OR dl.session_id IN (
          SELECT sm.session_id FROM public.session_members sm WHERE sm.user_id = p_user_id
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
