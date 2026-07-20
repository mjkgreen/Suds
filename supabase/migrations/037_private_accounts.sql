-- ============================================================
-- PRIVATE ACCOUNTS (Instagram-style)
--
-- Private users must approve follow requests before followers
-- can see their drinks, stats, or badges. A pending request is
-- a row in the new follow_requests table — NOT a follows row —
-- so every existing follow-gated RLS policy (drink_logs,
-- sessions) becomes private-safe without modification.
--
-- Also closes pre-existing holes: the SECURITY DEFINER stats
-- RPCs and get_feed accepted arbitrary p_user_id with no caller
-- check, exposing any user's stats/history to any caller.
-- ============================================================

-- ── 1. Privacy flag ──────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN is_private boolean NOT NULL DEFAULT false;

-- ── 2. Visibility helper ─────────────────────────────────────
-- True when p_viewer may see p_target's content: self, or a
-- non-blocked viewer of a public account, or an accepted
-- follower of a private one. Null-safe: an anonymous viewer
-- (p_viewer IS NULL) can see public accounts only.
CREATE OR REPLACE FUNCTION public.can_view_user(p_viewer uuid, p_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(p_viewer = p_target, false)
      OR (
        NOT public.is_blocked(p_viewer, p_target)
        AND (
          NOT (SELECT is_private FROM public.profiles WHERE id = p_target)
          OR EXISTS (
            SELECT 1 FROM public.follows
            WHERE follower_id = p_viewer AND following_id = p_target
          )
        )
      );
$$;

REVOKE ALL ON FUNCTION public.can_view_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_user(uuid, uuid) TO authenticated;

-- ── 3. Follow requests ───────────────────────────────────────
CREATE TABLE public.follow_requests (
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, target_id),
  CHECK (requester_id <> target_id)
);
CREATE INDEX idx_follow_requests_target ON public.follow_requests(target_id);

ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

-- Requests only make sense toward private accounts; a request to a
-- public account (race: target flipped public mid-flight) is rejected
-- so the client can fall back to a direct follow.
CREATE POLICY "follow_requests_insert" ON public.follow_requests FOR INSERT
  WITH CHECK (
    requester_id = auth.uid()
    AND NOT public.is_blocked(requester_id, target_id)
    AND (SELECT is_private FROM public.profiles WHERE id = target_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = requester_id AND following_id = target_id
    )
  );

CREATE POLICY "follow_requests_select" ON public.follow_requests FOR SELECT
  USING (auth.uid() IN (requester_id, target_id));

-- Requester cancels; target declines.
CREATE POLICY "follow_requests_delete" ON public.follow_requests FOR DELETE
  USING (auth.uid() IN (requester_id, target_id));

-- ── 4. Private accounts can't be followed directly ───────────
-- Follows toward a private account are created only by
-- accept_follow_request() / handle_privacy_flip(), which run as
-- SECURITY DEFINER and bypass RLS.
DROP POLICY "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others"
  ON public.follows FOR INSERT
  WITH CHECK (
    follower_id = auth.uid()
    AND NOT public.is_blocked(follower_id, following_id)
    AND NOT (SELECT is_private FROM public.profiles WHERE id = following_id)
  );

-- ── 5. New notification types ────────────────────────────────
ALTER TABLE public.in_app_notifications DROP CONSTRAINT in_app_notifications_type_check;
ALTER TABLE public.in_app_notifications ADD CONSTRAINT in_app_notifications_type_check
  CHECK (type IN ('like', 'comment', 'follow', 'session_invite',
                  'follow_request', 'follow_request_accepted'));

-- ── 6. notify_push_event: follow_requests branch + suppress the
--       redundant 'follow' notification on accept ─────────────
-- Body copied from 032_fix_notify_push_event.sql with two edits:
--   • follows branch returns early when the row is being created
--     by the followed user themselves (accept RPC / privacy-flip
--     auto-accept) — the requester gets 'follow_request_accepted'
--     instead, and the accepter shouldn't be told about a follow
--     they just approved.
--   • new follow_requests branch (type 'follow_request').
CREATE OR REPLACE FUNCTION public.notify_push_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id     uuid;
  v_recipient_id uuid;
  v_type         text;
  v_context      jsonb;
  v_actor        record;
  v_drink_owner  uuid;
BEGIN
  IF TG_TABLE_NAME = 'drink_likes' THEN
    v_actor_id := NEW.user_id;
    v_type := 'like';
    SELECT user_id INTO v_drink_owner FROM drink_logs WHERE id = NEW.drink_log_id;
    v_recipient_id := v_drink_owner;
    v_context := jsonb_build_object('drink_log_id', NEW.drink_log_id);

  ELSIF TG_TABLE_NAME = 'drink_comments' THEN
    v_actor_id := NEW.user_id;
    v_type := 'comment';
    SELECT user_id INTO v_drink_owner FROM drink_logs WHERE id = NEW.drink_log_id;
    v_recipient_id := v_drink_owner;
    v_context := jsonb_build_object(
      'drink_log_id',    NEW.drink_log_id,
      'comment_preview', left(NEW.content, 80)
    );

  ELSIF TG_TABLE_NAME = 'follows' THEN
    -- Suppress when the followed user created the row themselves
    -- (accepting a request / flipping public auto-accepts).
    IF auth.uid() = NEW.following_id THEN
      RETURN NEW;
    END IF;
    v_actor_id := NEW.follower_id;
    v_recipient_id := NEW.following_id;
    v_type := 'follow';
    v_context := '{}'::jsonb;

  ELSIF TG_TABLE_NAME = 'follow_requests' THEN
    v_actor_id := NEW.requester_id;
    v_recipient_id := NEW.target_id;
    v_type := 'follow_request';
    v_context := '{}'::jsonb;

  ELSIF TG_TABLE_NAME = 'session_invites' THEN
    v_actor_id := NEW.inviter_id;
    v_recipient_id := NEW.invitee_id;
    v_type := 'session_invite';
    v_context := jsonb_build_object(
      'session_id',   NEW.session_id,
      'invite_token', NEW.token
    );
  END IF;

  -- Never notify yourself
  IF v_actor_id = v_recipient_id THEN
    RETURN NEW;
  END IF;

  SELECT username, display_name INTO v_actor FROM profiles WHERE id = v_actor_id;

  -- Persist in-app notification.
  -- Not wrapped in an exception handler: if this fails the trigger fails,
  -- surfacing the error rather than hiding it.
  INSERT INTO public.in_app_notifications(user_id, actor_id, actor_name, type, context)
  VALUES (
    v_recipient_id,
    v_actor_id,
    coalesce(v_actor.display_name, v_actor.username),
    v_type,
    v_context
  );

  -- Fire push notification (best-effort — delivery failures must not roll back
  -- the source row insert).
  BEGIN
    PERFORM net.http_post(
      url     := coalesce(
                   nullif(current_setting('app.supabase_url', true), ''),
                   'https://gbenibgytweskljxneup.supabase.co'
                 ) || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.anon_key', true)
      ),
      body := jsonb_build_object(
        'actor_id',     v_actor_id,
        'actor_name',   coalesce(v_actor.display_name, v_actor.username),
        'recipient_id', v_recipient_id,
        'type',         v_type,
        'context',      v_context
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_push_event (push delivery): %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_follow_requested
  AFTER INSERT ON public.follow_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_push_event();

-- ── 7. Accept a follow request ───────────────────────────────
-- Decline (target) and cancel (requester) are plain DELETEs via
-- the follow_requests RLS — no RPC needed.
CREATE OR REPLACE FUNCTION public.accept_follow_request(p_requester uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me record;
BEGIN
  DELETE FROM public.follow_requests
  WHERE requester_id = p_requester AND target_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no pending follow request from this user';
  END IF;

  -- The on_followed trigger fires here but is suppressed for the
  -- accepter (auth.uid() = following_id) — see notify_push_event.
  INSERT INTO public.follows (follower_id, following_id)
  VALUES (p_requester, auth.uid())
  ON CONFLICT DO NOTHING;

  SELECT username, display_name INTO v_me FROM profiles WHERE id = auth.uid();

  INSERT INTO public.in_app_notifications (user_id, actor_id, actor_name, type, context)
  VALUES (
    p_requester,
    auth.uid(),
    coalesce(v_me.display_name, v_me.username),
    'follow_request_accepted',
    '{}'::jsonb
  );

  -- Best-effort push to the requester.
  BEGIN
    PERFORM net.http_post(
      url     := coalesce(
                   nullif(current_setting('app.supabase_url', true), ''),
                   'https://gbenibgytweskljxneup.supabase.co'
                 ) || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.anon_key', true)
      ),
      body := jsonb_build_object(
        'actor_id',     auth.uid(),
        'actor_name',   coalesce(v_me.display_name, v_me.username),
        'recipient_id', p_requester,
        'type',         'follow_request_accepted',
        'context',      '{}'::jsonb
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'accept_follow_request (push delivery): %', SQLERRM;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_follow_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_follow_request(uuid) TO authenticated;

-- ── 8. Guard the stats RPCs ──────────────────────────────────
-- These SECURITY DEFINER functions accepted any p_user_id with no
-- caller check. Rather than duplicating their large bodies (which
-- drifts as they evolve), each latest version is renamed to an
-- *_unguarded internal function (client execute revoked) and a
-- thin guarded wrapper takes its place under the public name.
-- NOTE for future migrations: redefine the *_unguarded functions,
-- not the wrappers, or re-apply the guard.

ALTER FUNCTION public.get_user_stats(uuid) RENAME TO get_user_stats_unguarded;
ALTER FUNCTION public.get_streaks(uuid) RENAME TO get_streaks_unguarded;
ALTER FUNCTION public.get_milestones(uuid) RENAME TO get_milestones_unguarded;
ALTER FUNCTION public.get_advanced_stats(uuid) RENAME TO get_advanced_stats_unguarded;

REVOKE ALL ON FUNCTION public.get_user_stats_unguarded(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_streaks_unguarded(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_milestones_unguarded(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_advanced_stats_unguarded(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_user_stats(p_user_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id
     AND public.can_view_user(auth.uid(), p_user_id) IS NOT TRUE THEN
    RETURN NULL;
  END IF;
  RETURN public.get_user_stats_unguarded(p_user_id);
END;
$$;

CREATE FUNCTION public.get_streaks(p_user_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id
     AND public.can_view_user(auth.uid(), p_user_id) IS NOT TRUE THEN
    RETURN NULL;
  END IF;
  RETURN public.get_streaks_unguarded(p_user_id);
END;
$$;

CREATE FUNCTION public.get_milestones(p_user_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id
     AND public.can_view_user(auth.uid(), p_user_id) IS NOT TRUE THEN
    RETURN NULL;
  END IF;
  RETURN public.get_milestones_unguarded(p_user_id);
END;
$$;

CREATE FUNCTION public.get_advanced_stats(p_user_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id
     AND public.can_view_user(auth.uid(), p_user_id) IS NOT TRUE THEN
    RETURN NULL;
  END IF;
  RETURN public.get_advanced_stats_unguarded(p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_streaks(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_milestones(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_advanced_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_streaks(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_milestones(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_advanced_stats(uuid) TO authenticated;

-- ── 9. get_feed: privacy guard + close the transitive leak ───
-- Body copied from 036_user_blocks_and_reports.sql. WHERE clause
-- changed: previously get_feed(X) returned X's drinks AND the
-- drinks of everyone X follows, to ANY caller — so anyone could
-- read a private user P's history via any public follower of P
-- (or P's own id). Now:
--   • own-feed mode (p_user_id = auth.uid()): self + following,
--     unchanged.
--   • profile-grid mode (p_user_id <> auth.uid()): only that
--     user's rows, and only when the caller may view them.
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

-- ── 10. Blocking clears pending requests too ─────────────────
-- Body copied from 036 with the follow_requests DELETE added.
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

  DELETE FROM public.follow_requests
  WHERE (requester_id = auth.uid() AND target_id = p_blocked)
     OR (requester_id = p_blocked AND target_id = auth.uid());
END;
$$;

-- ── 11. Flipping back to public auto-accepts pending requests ─
-- Matches Instagram. Bulk follow inserts fire on_followed per row
-- but are suppressed for the owner (see notify_push_event);
-- requesters get an in-app 'follow_request_accepted' (no push —
-- avoids N http calls from a single UPDATE).
CREATE OR REPLACE FUNCTION public.handle_privacy_flip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.follows (follower_id, following_id)
  SELECT requester_id, target_id
  FROM public.follow_requests
  WHERE target_id = NEW.id
  ON CONFLICT DO NOTHING;

  INSERT INTO public.in_app_notifications (user_id, actor_id, actor_name, type, context)
  SELECT
    fr.requester_id,
    NEW.id,
    coalesce(NEW.display_name, NEW.username),
    'follow_request_accepted',
    '{}'::jsonb
  FROM public.follow_requests fr
  WHERE fr.target_id = NEW.id;

  DELETE FROM public.follow_requests WHERE target_id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_privacy_flip
  AFTER UPDATE OF is_private ON public.profiles
  FOR EACH ROW
  WHEN (OLD.is_private AND NOT NEW.is_private)
  EXECUTE FUNCTION public.handle_privacy_flip();
