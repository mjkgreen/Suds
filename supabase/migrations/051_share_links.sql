-- ============================================================
-- SHARE LINKS: invite people who aren't on Suds (yet)
--
-- Two kinds of reusable link, both opened at
-- https://drink-with-suds.com/invite/<token>:
--
--   • 'session' — "Share invite link" on a night out. Anyone with
--     the link can see a public preview of the night out and join
--     it. The host opts in per night out by creating the link and
--     can turn it off (revoke). Joining stops working when the
--     night out ends, or 24h after the link was made if it never
--     ends. The preview stays readable for 24h after that, showing
--     the ended night out, so a link opened the next morning still
--     lands somewhere useful (it offers to follow the host).
--   • 'profile' — a personal "Invite friends to Suds" link. Never
--     expires; the owner can revoke it (and get a new one).
--
-- Joining or accepting through a link also follows the person who
-- shared it — or sends them a follow request if they're private.
-- They get one notification for it ('share_link_join' or
-- 'invite_accepted') instead of a separate follow notification.
--
-- Unlike session_invites (029), a link isn't tied to an invitee,
-- so it can be shared with people who don't have an account.
--
-- Privacy of the public preview (get_share_preview):
--   • only fields that are safe to show anyone: names, usernames,
--     avatars, the night out's title, live/ended and a drink total;
--   • never locations, drink names, notes or media;
--   • the drink total only counts drinks of members the viewer may
--     see (can_view_user): a signed-out viewer sees public
--     accounts' drinks only; private members' drinks are left out;
--   • anyone blocked in either direction with the viewer is left
--     out, and a viewer blocked by/blocking the sharer gets
--     'not_found'.
-- ============================================================

-- ── 1. Tables ────────────────────────────────────────────────
CREATE TABLE public.share_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 12 URL-safe characters (72 random bits).
  token       text NOT NULL UNIQUE
              DEFAULT translate(encode(gen_random_bytes(9), 'base64'), '+/', '-_'),
  kind        text NOT NULL CHECK (kind IN ('session', 'profile')),
  inviter_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id  uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- NULL = never (profile links).
  expires_at  timestamptz,
  revoked_at  timestamptz,
  CONSTRAINT share_links_session_kind CHECK ((kind = 'session') = (session_id IS NOT NULL))
);

-- At most one live link per night out and per person.
CREATE UNIQUE INDEX share_links_one_per_session
  ON public.share_links(session_id) WHERE revoked_at IS NULL AND kind = 'session';
CREATE UNIQUE INDEX share_links_one_per_profile
  ON public.share_links(inviter_id) WHERE revoked_at IS NULL AND kind = 'profile';
CREATE INDEX idx_share_links_inviter ON public.share_links(inviter_id);

-- Who came in through which link (first use only). Lets the sharer be
-- notified once per person, and is the basis for invite stats.
CREATE TABLE public.share_link_uses (
  link_id    uuid NOT NULL REFERENCES public.share_links(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_session boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (link_id, user_id)
);
CREATE INDEX idx_share_link_uses_user ON public.share_link_uses(user_id);

-- Reads only; every write goes through the SECURITY DEFINER functions below.
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "share_links_select_own" ON public.share_links
  FOR SELECT USING ((SELECT auth.uid()) = inviter_id);

ALTER TABLE public.share_link_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "share_link_uses_select" ON public.share_link_uses
  FOR SELECT USING (
    (SELECT auth.uid()) = user_id
    OR link_id IN (SELECT id FROM public.share_links WHERE inviter_id = (SELECT auth.uid()))
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.share_links FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.share_link_uses FROM anon, authenticated;
REVOKE ALL ON public.share_links FROM anon;
REVOKE ALL ON public.share_link_uses FROM anon;

-- ── 2. Notification types ────────────────────────────────────
ALTER TABLE public.in_app_notifications DROP CONSTRAINT in_app_notifications_type_check;
ALTER TABLE public.in_app_notifications ADD CONSTRAINT in_app_notifications_type_check
  CHECK (type IN ('like', 'comment', 'follow', 'session_invite',
                  'follow_request', 'follow_request_accepted',
                  'mention', 'tag',
                  'share_link_join', 'invite_accepted'));

-- ── 3. notify_push_event: let link joins send one notification ─
-- Body copied from 041_reliable_push.sql. One edit: the follows and
-- follow_requests branches return early while suds.quiet_follow is
-- set (transaction-local, by follow_or_request below), because the
-- link functions send their own combined notification instead.
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
    -- A share link sends its own notification (see follow_or_request).
    IF current_setting('suds.quiet_follow', true) = 'on' THEN
      RETURN NEW;
    END IF;
    v_actor_id := NEW.follower_id;
    v_recipient_id := NEW.following_id;
    v_type := 'follow';
    v_context := '{}'::jsonb;

  ELSIF TG_TABLE_NAME = 'follow_requests' THEN
    IF current_setting('suds.quiet_follow', true) = 'on' THEN
      RETURN NEW;
    END IF;
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

  RETURN NEW;
END;
$$;

-- ── 4. Internal helpers ──────────────────────────────────────
-- Follows p_target, or requests to if they're private. Returns
-- 'following' or 'requested'. Same rules as the follows /
-- follow_requests insert policies (037), which SECURITY DEFINER
-- bypasses; callers must have checked blocks already.
CREATE OR REPLACE FUNCTION public.follow_or_request(p_follower uuid, p_target uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.follows WHERE follower_id = p_follower AND following_id = p_target) THEN
    RETURN 'following';
  END IF;

  PERFORM set_config('suds.quiet_follow', 'on', true);
  IF (SELECT is_private FROM public.profiles WHERE id = p_target) THEN
    INSERT INTO public.follow_requests (requester_id, target_id)
    VALUES (p_follower, p_target)
    ON CONFLICT DO NOTHING;
    v_status := 'requested';
  ELSE
    INSERT INTO public.follows (follower_id, following_id)
    VALUES (p_follower, p_target)
    ON CONFLICT DO NOTHING;
    v_status := 'following';
  END IF;
  PERFORM set_config('suds.quiet_follow', 'off', true);

  RETURN v_status;
END;
$$;

-- The link row plus its state, for the functions below. Not exposed.
--   can_join:    a session link that still lets people join.
--   viewable:    the preview may be shown (not revoked, within the
--                24h grace after joining stopped).
CREATE OR REPLACE FUNCTION public.share_link_state(p_token text)
RETURNS TABLE (
  link       public.share_links,
  can_join   boolean,
  viewable   boolean,
  revoked    boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l,
    l.kind = 'session' AND l.revoked_at IS NULL AND s.ended_at IS NULL AND now() < l.expires_at,
    l.revoked_at IS NULL AND (
      l.kind = 'profile'
      OR now() < LEAST(l.expires_at, COALESCE(s.ended_at, l.expires_at)) + interval '24 hours'
    ),
    l.revoked_at IS NOT NULL
  FROM public.share_links l
  LEFT JOIN public.sessions s ON s.id = l.session_id
  WHERE l.token = p_token;
$$;

REVOKE ALL ON FUNCTION public.follow_or_request(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.share_link_state(text) FROM PUBLIC, anon, authenticated;

-- ── 5. Create / revoke ───────────────────────────────────────
-- Returns the caller's live link of that kind, creating it if needed.
-- 'session' links: only the host of a night out that hasn't ended.
CREATE OR REPLACE FUNCTION public.get_or_create_share_link(p_kind text, p_session_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me   uuid := auth.uid();
  v_link public.share_links%ROWTYPE;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;

  IF p_kind = 'session' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.session_members sm ON sm.session_id = s.id
      WHERE s.id = p_session_id AND s.ended_at IS NULL
        AND sm.user_id = v_me AND sm.role = 'host'
    ) THEN
      RETURN jsonb_build_object('error', 'not_host_of_active_session');
    END IF;

    SELECT * INTO v_link FROM public.share_links
    WHERE session_id = p_session_id AND kind = 'session' AND revoked_at IS NULL
    FOR UPDATE;

    -- A link past its 24h is retired so a fresh one can take its place.
    IF FOUND AND v_link.expires_at <= now() THEN
      UPDATE public.share_links SET revoked_at = now() WHERE id = v_link.id;
      v_link := NULL;
    END IF;

    IF v_link.id IS NULL THEN
      INSERT INTO public.share_links (kind, inviter_id, session_id, expires_at)
      VALUES ('session', v_me, p_session_id, now() + interval '24 hours')
      RETURNING * INTO v_link;
    END IF;

  ELSIF p_kind = 'profile' THEN
    SELECT * INTO v_link FROM public.share_links
    WHERE inviter_id = v_me AND kind = 'profile' AND revoked_at IS NULL;

    IF NOT FOUND THEN
      INSERT INTO public.share_links (kind, inviter_id)
      VALUES ('profile', v_me)
      RETURNING * INTO v_link;
    END IF;

  ELSE
    RAISE EXCEPTION 'unknown link kind %', p_kind;
  END IF;

  RETURN jsonb_build_object(
    'token',      v_link.token,
    'kind',       v_link.kind,
    'session_id', v_link.session_id,
    'expires_at', v_link.expires_at
  );
END;
$$;

-- Turns a link off. Only the person who made it.
CREATE OR REPLACE FUNCTION public.revoke_share_link(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.share_links
  SET revoked_at = now()
  WHERE token = p_token AND inviter_id = auth.uid() AND revoked_at IS NULL;
$$;

-- ── 6. Public preview ────────────────────────────────────────
-- Callable signed out (anon). Returns only the safe fields listed at
-- the top of this file, or { error: 'not_found' | 'revoked' | 'expired' }.
CREATE OR REPLACE FUNCTION public.get_share_preview(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer   uuid := auth.uid();
  v_state    record;
  v_link     public.share_links%ROWTYPE;
  v_inviter  public.profiles%ROWTYPE;
  v_session  public.sessions%ROWTYPE;
  v_members  jsonb;
  v_total    numeric;
  v_viewer_ctx jsonb := NULL;
  v_follow   text;
BEGIN
  SELECT * INTO v_state FROM public.share_link_state(p_token);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  v_link := v_state.link;

  -- Someone blocked in either direction can't tell the link exists.
  IF v_viewer IS NOT NULL AND public.is_blocked(v_viewer, v_link.inviter_id) THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_state.revoked THEN
    RETURN jsonb_build_object('error', 'revoked');
  END IF;
  IF NOT v_state.viewable THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  SELECT * INTO v_inviter FROM public.profiles WHERE id = v_link.inviter_id;

  IF v_viewer IS NOT NULL THEN
    v_follow := CASE
      WHEN v_viewer = v_link.inviter_id THEN 'self'
      WHEN EXISTS (SELECT 1 FROM public.follows WHERE follower_id = v_viewer AND following_id = v_link.inviter_id) THEN 'following'
      WHEN EXISTS (SELECT 1 FROM public.follow_requests WHERE requester_id = v_viewer AND target_id = v_link.inviter_id) THEN 'requested'
      ELSE 'none'
    END;
    v_viewer_ctx := jsonb_build_object(
      'is_inviter',    v_viewer = v_link.inviter_id,
      'follow_status', v_follow,
      'is_member',     v_link.session_id IS NOT NULL AND EXISTS (
                         SELECT 1 FROM public.session_members
                         WHERE session_id = v_link.session_id AND user_id = v_viewer)
    );
  END IF;

  IF v_link.kind = 'session' THEN
    SELECT * INTO v_session FROM public.sessions WHERE id = v_link.session_id;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'user_id',      p.id,
             'username',     p.username,
             'display_name', p.display_name,
             'avatar_url',   p.avatar_url,
             'role',         sm.role
           ) ORDER BY sm.role = 'guest', sm.joined_at), '[]'::jsonb)
    INTO v_members
    FROM public.session_members sm
    JOIN public.profiles p ON p.id = sm.user_id
    WHERE sm.session_id = v_link.session_id
      AND (v_viewer IS NULL OR v_viewer = sm.user_id OR NOT public.is_blocked(v_viewer, sm.user_id));

    -- Alcoholic drinks by quantity (the app-wide rule, migration 050),
    -- only from people the viewer may see.
    SELECT coalesce(sum(dl.quantity), 0) INTO v_total
    FROM public.drink_logs dl
    WHERE dl.session_id = v_link.session_id
      AND public.is_alcoholic_drink(dl.drink_type)
      AND public.can_view_user(v_viewer, dl.user_id);
  END IF;

  RETURN jsonb_build_object(
    'kind',     v_link.kind,
    'can_join', v_state.can_join,
    'inviter',  jsonb_build_object(
      'id',           v_inviter.id,
      'username',     v_inviter.username,
      'display_name', v_inviter.display_name,
      'avatar_url',   v_inviter.avatar_url,
      'is_private',   v_inviter.is_private
    ),
    'session',  CASE WHEN v_link.kind = 'session' THEN jsonb_build_object(
      'id',          v_session.id,
      'title',       v_session.title,
      'started_at',  v_session.started_at,
      'ended_at',    v_session.ended_at,
      'drink_total', v_total,
      'members',     v_members
    ) END,
    'viewer',   v_viewer_ctx
  );
END;
$$;

-- ── 7. Join a night out through its link ─────────────────────
-- Same result shape as accept_session_invite (029), plus id (the app's
-- SessionWithRole reads .id) and follow_status.
-- Keeps the app's rule that a host must end their own night out first.
-- (A guest elsewhere is moved out by the app before calling, as for
-- invites.)
CREATE OR REPLACE FUNCTION public.join_session_via_link(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me      uuid := auth.uid();
  v_state   record;
  v_link    public.share_links%ROWTYPE;
  v_session public.sessions%ROWTYPE;
  v_follow  text;
  v_first   boolean;
  v_actor   record;
BEGIN
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('error', 'not_signed_in');
  END IF;

  SELECT * INTO v_state FROM public.share_link_state(p_token);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  v_link := v_state.link;
  IF v_link.kind <> 'session' OR public.is_blocked(v_me, v_link.inviter_id) THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_link.inviter_id = v_me THEN
    RETURN jsonb_build_object('error', 'own_link');
  END IF;
  IF v_state.revoked THEN
    RETURN jsonb_build_object('error', 'revoked');
  END IF;
  IF NOT v_state.can_join THEN
    RETURN jsonb_build_object('error', 'session_ended');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.session_members sm ON sm.session_id = s.id
    WHERE sm.user_id = v_me AND sm.role = 'host' AND s.ended_at IS NULL
      AND s.id <> v_link.session_id
  ) THEN
    RETURN jsonb_build_object('error', 'hosting_active_session');
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = v_link.session_id;

  INSERT INTO public.session_members (session_id, user_id, role)
  VALUES (v_link.session_id, v_me, 'guest')
  ON CONFLICT (session_id, user_id) DO NOTHING;

  v_follow := public.follow_or_request(v_me, v_link.inviter_id);

  INSERT INTO public.share_link_uses (link_id, user_id, joined_session)
  VALUES (v_link.id, v_me, true)
  ON CONFLICT (link_id, user_id) DO NOTHING
  RETURNING true INTO v_first;

  IF v_first THEN
    SELECT username, display_name INTO v_actor FROM public.profiles WHERE id = v_me;
    INSERT INTO public.in_app_notifications (user_id, actor_id, actor_name, type, context)
    VALUES (
      v_link.inviter_id, v_me, coalesce(v_actor.display_name, v_actor.username),
      'share_link_join',
      jsonb_build_object('session_id', v_link.session_id, 'follow_status', v_follow)
    );
  END IF;

  RETURN jsonb_build_object(
    'id',            v_session.id,
    'session_id',    v_session.id,
    'user_id',       v_session.user_id,
    'title',         v_session.title,
    'started_at',    v_session.started_at,
    'ended_at',      v_session.ended_at,
    'created_at',    v_session.created_at,
    'my_role',       'guest',
    'follow_status', v_follow
  );
END;
$$;

-- ── 8. Accept an invite (follow the sharer) ──────────────────
-- For 'profile' links, and for a night-out link that can no longer
-- be joined but is still viewable ("follow the host instead").
CREATE OR REPLACE FUNCTION public.accept_share_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me     uuid := auth.uid();
  v_state  record;
  v_link   public.share_links%ROWTYPE;
  v_follow text;
  v_first  boolean;
  v_actor  record;
BEGIN
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('error', 'not_signed_in');
  END IF;

  SELECT * INTO v_state FROM public.share_link_state(p_token);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  v_link := v_state.link;
  IF public.is_blocked(v_me, v_link.inviter_id) THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_link.inviter_id = v_me THEN
    RETURN jsonb_build_object('error', 'own_link');
  END IF;
  IF v_state.revoked THEN
    RETURN jsonb_build_object('error', 'revoked');
  END IF;
  IF NOT v_state.viewable THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  v_follow := public.follow_or_request(v_me, v_link.inviter_id);

  INSERT INTO public.share_link_uses (link_id, user_id)
  VALUES (v_link.id, v_me)
  ON CONFLICT (link_id, user_id) DO NOTHING
  RETURNING true INTO v_first;

  IF v_first THEN
    SELECT username, display_name INTO v_actor FROM public.profiles WHERE id = v_me;
    INSERT INTO public.in_app_notifications (user_id, actor_id, actor_name, type, context)
    VALUES (
      v_link.inviter_id, v_me, coalesce(v_actor.display_name, v_actor.username),
      'invite_accepted',
      jsonb_build_object('follow_status', v_follow)
    );
  END IF;

  RETURN jsonb_build_object('inviter_id', v_link.inviter_id, 'follow_status', v_follow);
END;
$$;

-- ── 9. Grants ────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.get_or_create_share_link(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_share_link(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_session_via_link(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_share_invite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_share_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_share_link(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_share_link(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_session_via_link(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_share_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_share_preview(text) TO anon, authenticated;
