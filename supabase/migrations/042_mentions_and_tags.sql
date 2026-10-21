-- ============================================================
-- MENTIONS AND TAGS
--
--   • @username in a drink's notes or in a comment notifies that
--     user ('mention'). Only newly added mentions notify, so
--     editing a drink's notes doesn't re-ping everyone.
--   • A drink can tag people who were there (drink_tags). Each
--     new tag notifies the tagged user ('tag'). Tagged users can
--     remove themselves.
--   • Neither notifies across a block, or the author themselves.
--   • New "Mentions & Tags" notification preference.
--   • get_feed returns tagged_users.
-- ============================================================

-- ── 1. Notification types + preference ───────────────────────
ALTER TABLE public.in_app_notifications DROP CONSTRAINT in_app_notifications_type_check;
ALTER TABLE public.in_app_notifications ADD CONSTRAINT in_app_notifications_type_check
  CHECK (type IN ('like', 'comment', 'follow', 'session_invite',
                  'follow_request', 'follow_request_accepted',
                  'mention', 'tag'));

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS notify_mentions boolean NOT NULL DEFAULT true;

-- ── 2. Tags ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.drink_tags (
  drink_log_id uuid        NOT NULL REFERENCES public.drink_logs(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (drink_log_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_drink_tags_user ON public.drink_tags(user_id);

ALTER TABLE public.drink_tags ENABLE ROW LEVEL SECURITY;

-- Visible to anyone who can see the drink, and always to the tagged user.
CREATE POLICY "drink_tags_select" ON public.drink_tags FOR SELECT USING (
  user_id = auth.uid()
  OR public.can_view_user(
       auth.uid(),
       (SELECT dl.user_id FROM public.drink_logs dl WHERE dl.id = drink_log_id)
     )
);

-- Only the drink's owner tags, never themselves, never across a block.
CREATE POLICY "drink_tags_insert" ON public.drink_tags FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.drink_logs dl WHERE dl.id = drink_log_id AND dl.user_id = auth.uid())
  AND user_id <> auth.uid()
  AND NOT public.is_blocked(auth.uid(), user_id)
);

-- The owner can untag anyone; a tagged user can remove themselves.
CREATE POLICY "drink_tags_delete" ON public.drink_tags FOR DELETE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.drink_logs dl WHERE dl.id = drink_log_id AND dl.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.enforce_drink_tag_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM public.drink_tags WHERE drink_log_id = NEW.drink_log_id) >= 10 THEN
    RAISE EXCEPTION 'A drink can tag at most 10 people';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS drink_tags_limit ON public.drink_tags;
CREATE TRIGGER drink_tags_limit
  BEFORE INSERT ON public.drink_tags
  FOR EACH ROW EXECUTE FUNCTION public.enforce_drink_tag_limit();

CREATE OR REPLACE FUNCTION public.notify_drink_tag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_actor record;
BEGIN
  SELECT user_id INTO v_owner FROM drink_logs WHERE id = NEW.drink_log_id;
  IF v_owner IS NULL OR v_owner = NEW.user_id OR is_blocked(v_owner, NEW.user_id) THEN
    RETURN NULL;
  END IF;

  SELECT username, display_name INTO v_actor FROM profiles WHERE id = v_owner;

  INSERT INTO in_app_notifications (user_id, actor_id, actor_name, type, context)
  VALUES (
    NEW.user_id,
    v_owner,
    coalesce(v_actor.display_name, v_actor.username),
    'tag',
    jsonb_build_object('drink_log_id', NEW.drink_log_id)
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS drink_tags_notify ON public.drink_tags;
CREATE TRIGGER drink_tags_notify
  AFTER INSERT ON public.drink_tags
  FOR EACH ROW EXECUTE FUNCTION public.notify_drink_tag();

-- ── 3. Mentions ──────────────────────────────────────────────
-- Lower-cased usernames @-mentioned in a piece of text. "@" must
-- start the text or follow a non-username character, so emails
-- (a@b.com) don't count.
CREATE OR REPLACE FUNCTION public.extract_mentions(p_text text)
RETURNS SETOF text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT DISTINCT lower(m[1])
  FROM regexp_matches(coalesce(p_text, ''), '(?:^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]+)', 'g') AS m;
$$;

-- Notifies users newly mentioned in p_text (vs p_old_text).
-- p_skip: a user who'll already hear about this (e.g. the drink
-- owner, who gets the 'comment' notification).
CREATE OR REPLACE FUNCTION public.notify_mentions(
  p_actor        uuid,
  p_text         text,
  p_old_text     text,
  p_drink_log_id uuid,
  p_source       text,
  p_skip         uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
BEGIN
  SELECT username, display_name INTO v_actor FROM profiles WHERE id = p_actor;

  INSERT INTO in_app_notifications (user_id, actor_id, actor_name, type, context)
  SELECT p.id,
         p_actor,
         coalesce(v_actor.display_name, v_actor.username),
         'mention',
         jsonb_build_object(
           'drink_log_id',    p_drink_log_id,
           'comment_preview', left(p_text, 80),
           'source',          p_source
         )
  FROM profiles p
  WHERE lower(p.username) IN (
          SELECT extract_mentions(p_text)
          EXCEPT
          SELECT extract_mentions(p_old_text)
          LIMIT 10
        )
    AND p.id <> p_actor
    AND p.id IS DISTINCT FROM p_skip
    AND NOT is_blocked(p_actor, p.id);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_mentions(uuid, text, text, uuid, text, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.notify_drink_log_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM notify_mentions(
    NEW.user_id,
    NEW.notes,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.notes END,
    NEW.id,
    'drink'
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS drink_logs_notify_mentions ON public.drink_logs;
CREATE TRIGGER drink_logs_notify_mentions
  AFTER INSERT OR UPDATE OF notes ON public.drink_logs
  FOR EACH ROW
  WHEN (NEW.notes LIKE '%@%')
  EXECUTE FUNCTION public.notify_drink_log_mentions();

CREATE OR REPLACE FUNCTION public.notify_comment_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM notify_mentions(
    NEW.user_id,
    NEW.content,
    NULL,
    NEW.drink_log_id,
    'comment',
    (SELECT user_id FROM drink_logs WHERE id = NEW.drink_log_id)
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS drink_comments_notify_mentions ON public.drink_comments;
CREATE TRIGGER drink_comments_notify_mentions
  AFTER INSERT ON public.drink_comments
  FOR EACH ROW
  WHEN (NEW.content LIKE '%@%')
  EXECUTE FUNCTION public.notify_comment_mentions();

-- ── 4. get_feed: return tagged_users ─────────────────────────
-- Body identical to 039 with tagged_users appended.
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
