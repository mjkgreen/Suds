-- ============================================================
-- USER BLOCKING + CONTENT REPORTING (App Store guideline 1.2)
-- ============================================================

-- ── Blocks ───────────────────────────────────────────────────
CREATE TABLE public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX idx_user_blocks_blocked ON public.user_blocks(blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks_select" ON public.user_blocks FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "blocks_insert" ON public.user_blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocks_delete" ON public.user_blocks FOR DELETE USING (auth.uid() = blocker_id);

-- Returns true when a block exists in EITHER direction between the two users.
-- SECURITY DEFINER: user_blocks RLS hides the reverse-direction row from the
-- caller, but policies on other tables need to see both directions.
CREATE OR REPLACE FUNCTION public.is_blocked(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = a AND blocked_id = b)
       OR (blocker_id = b AND blocked_id = a)
  );
$$;

REVOKE ALL ON FUNCTION public.is_blocked(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) TO authenticated;

-- Blocking removes the social connection in both directions. The reverse
-- follow edge can't be deleted by the client (follows delete policy is
-- follower-only), so this runs as SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.block_user(p_blocked uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_blocked IS NULL OR p_blocked = auth.uid() THEN
    RAISE EXCEPTION 'invalid block target';
  END IF;

  INSERT INTO public.user_blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), p_blocked)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.follows
  WHERE (follower_id = auth.uid() AND following_id = p_blocked)
     OR (follower_id = p_blocked AND following_id = auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.block_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;

-- ── Reports ──────────────────────────────────────────────────
CREATE TYPE public.report_target_type AS ENUM ('drink_log', 'comment', 'user');

CREATE TABLE public.content_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type public.report_target_type NOT NULL,
  target_id   uuid NOT NULL,
  reason      text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 100),
  details     text CHECK (details IS NULL OR char_length(details) <= 1000),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_reports_target ON public.content_reports(target_type, target_id);

-- Write-only from the client; reports are reviewed in the Supabase dashboard.
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_insert" ON public.content_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- ── Enforce blocks in existing policies ──────────────────────

-- Likes/comments from either side of a block are invisible, and blocked
-- users can't interact with the drink owner's content.
DROP POLICY "likes_select" ON public.drink_likes;
CREATE POLICY "likes_select" ON public.drink_likes FOR SELECT
  USING (NOT public.is_blocked(auth.uid(), user_id));

DROP POLICY "likes_insert" ON public.drink_likes;
CREATE POLICY "likes_insert" ON public.drink_likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND NOT public.is_blocked(
      auth.uid(),
      (SELECT dl.user_id FROM public.drink_logs dl WHERE dl.id = drink_log_id)
    )
  );

DROP POLICY "comments_select" ON public.drink_comments;
CREATE POLICY "comments_select" ON public.drink_comments FOR SELECT
  USING (NOT public.is_blocked(auth.uid(), user_id));

DROP POLICY "comments_insert" ON public.drink_comments;
CREATE POLICY "comments_insert" ON public.drink_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND NOT public.is_blocked(
      auth.uid(),
      (SELECT dl.user_id FROM public.drink_logs dl WHERE dl.id = drink_log_id)
    )
  );

-- Prevent re-following across a block in either direction.
DROP POLICY "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others"
  ON public.follows FOR INSERT
  WITH CHECK (
    follower_id = auth.uid()
    AND NOT public.is_blocked(follower_id, following_id)
  );

-- ── get_feed: hide drinks from blocked users ─────────────────
-- Body copied from 034_feed_session_times.sql with a block filter added.
-- The filter keys off auth.uid() (the actual viewer), not p_user_id,
-- because useMyFeed calls this with the viewed user's id.
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
  user_liked         boolean
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
    p.displayed_badges,
    s.id         AS session_id,
    s.title      AS session_title,
    s.started_at AS session_started_at,
    s.ended_at   AS session_ended_at,
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
  WHERE (
    dl.user_id = p_user_id
    OR dl.user_id IN (
      SELECT following_id FROM public.follows WHERE follower_id = p_user_id
    )
  )
  AND (dl.user_id = auth.uid() OR NOT public.is_blocked(auth.uid(), dl.user_id))
  ORDER BY dl.logged_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
