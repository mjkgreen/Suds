-- ============================================================
-- SHARED SESSIONS
-- Adds multi-participant support to the existing sessions table.
-- sessions.user_id remains the host; session_members is the
-- authoritative membership record for all participants.
-- ============================================================

-- ── session_members ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_members (
  session_id  uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('host', 'guest')),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_session_members_session_id ON public.session_members(session_id);
CREATE INDEX IF NOT EXISTS idx_session_members_user_id    ON public.session_members(user_id);

-- ── session_invites ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  inviter_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted', 'declined')),
  token       text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_invites_session_invitee_unique UNIQUE (session_id, invitee_id),
  CONSTRAINT no_self_invite CHECK (inviter_id != invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_session_invites_token    ON public.session_invites(token);
CREATE INDEX IF NOT EXISTS idx_session_invites_invitee  ON public.session_invites(invitee_id);
CREATE INDEX IF NOT EXISTS idx_session_invites_session  ON public.session_invites(session_id);

-- ── Auto-insert host on session create ───────────────────────
CREATE OR REPLACE FUNCTION public.add_session_host()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.session_members(session_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'host')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_session_created ON public.sessions;
CREATE TRIGGER on_session_created
  AFTER INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.add_session_host();

-- Backfill existing sessions so they all have a host row
INSERT INTO public.session_members(session_id, user_id, role, joined_at)
SELECT id, user_id, 'host', created_at
FROM public.sessions
ON CONFLICT DO NOTHING;

-- ── RLS: session_members ─────────────────────────────────────
ALTER TABLE public.session_members ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helper avoids infinite recursion: a policy on session_members
-- cannot query session_members directly without triggering itself.
CREATE OR REPLACE FUNCTION public.get_my_session_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT session_id FROM public.session_members WHERE user_id = auth.uid();
$$;

-- Any member can see all members of their sessions
CREATE POLICY "session_members_select" ON public.session_members
  FOR SELECT USING (
    session_id IN (SELECT public.get_my_session_ids())
  );

-- Users can only insert their own membership row (guests accepting invites)
CREATE POLICY "session_members_insert" ON public.session_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Guests can remove themselves; hosts must use end-session flow
CREATE POLICY "session_members_delete" ON public.session_members
  FOR DELETE USING (auth.uid() = user_id AND role = 'guest');

-- ── RLS: session_invites ─────────────────────────────────────
ALTER TABLE public.session_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_invites_select" ON public.session_invites
  FOR SELECT USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- Only the session host can send invites
CREATE POLICY "session_invites_insert" ON public.session_invites
  FOR INSERT WITH CHECK (
    auth.uid() = inviter_id
    AND EXISTS (
      SELECT 1 FROM public.session_members sm
      WHERE sm.session_id = session_invites.session_id
        AND sm.user_id = auth.uid()
        AND sm.role = 'host'
    )
  );

-- Only the invitee can update status (accept / decline)
CREATE POLICY "session_invites_update" ON public.session_invites
  FOR UPDATE USING (auth.uid() = invitee_id);

-- ── Extend sessions visibility to non-follower members ───────
CREATE POLICY "sessions_select_as_member" ON public.sessions
  FOR SELECT USING (
    id IN (
      SELECT sm.session_id FROM public.session_members sm WHERE sm.user_id = auth.uid()
    )
  );

-- ── Extend drink_logs visibility to session co-members ───────
-- Additive: existing "Drink logs visible to self and followers" still applies.
CREATE POLICY "Drink logs visible to session members" ON public.drink_logs
  FOR SELECT USING (
    session_id IS NOT NULL
    AND session_id IN (
      SELECT sm.session_id FROM public.session_members sm WHERE sm.user_id = auth.uid()
    )
  );

-- ── notify_session_invites preference column ─────────────────
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS notify_session_invites boolean NOT NULL DEFAULT true;

-- ── RPC: get_my_active_session() ─────────────────────────────
-- Replaces the direct sessions query in useMyOpenSession.
-- Returns the active session + the caller's role in it.
CREATE OR REPLACE FUNCTION public.get_my_active_session()
RETURNS TABLE (
  id          uuid,
  user_id     uuid,
  title       text,
  started_at  timestamptz,
  ended_at    timestamptz,
  created_at  timestamptz,
  my_role     text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.user_id,
    s.title,
    s.started_at,
    s.ended_at,
    s.created_at,
    sm.role AS my_role
  FROM public.sessions s
  JOIN public.session_members sm
    ON sm.session_id = s.id AND sm.user_id = auth.uid()
  WHERE s.ended_at IS NULL
  ORDER BY s.started_at DESC
  LIMIT 1;
$$;

-- ── RPC: get_session_members_with_profiles(p_session_id) ─────
CREATE OR REPLACE FUNCTION public.get_session_members_with_profiles(p_session_id uuid)
RETURNS TABLE (
  user_id      uuid,
  role         text,
  joined_at    timestamptz,
  username     text,
  display_name text,
  avatar_url   text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sm.user_id,
    sm.role,
    sm.joined_at,
    p.username,
    p.display_name,
    p.avatar_url
  FROM public.session_members sm
  JOIN public.profiles p ON p.id = sm.user_id
  WHERE sm.session_id = p_session_id
    AND EXISTS (
      SELECT 1 FROM public.session_members me
      WHERE me.session_id = p_session_id AND me.user_id = auth.uid()
    )
  ORDER BY sm.joined_at;
$$;

-- ── RPC: get_invite_preview(p_token) ─────────────────────────
-- For the join screen: invitee reads invite data before they're a member.
-- SECURITY DEFINER so it can bypass sessions RLS.
CREATE OR REPLACE FUNCTION public.get_invite_preview(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite  public.session_invites%ROWTYPE;
  v_session public.sessions%ROWTYPE;
  v_inviter public.profiles%ROWTYPE;
BEGIN
  -- Two-step lookup: find by token first so we can distinguish "not found" from "wrong invitee"
  SELECT * INTO v_invite
  FROM public.session_invites
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_invite.invitee_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'not_your_invite');
  END IF;

  IF v_invite.status != 'pending' THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = v_invite.session_id;
  SELECT * INTO v_inviter FROM public.profiles WHERE id = v_invite.inviter_id;

  RETURN jsonb_build_object(
    'invite',  to_jsonb(v_invite),
    'session', to_jsonb(v_session),
    'inviter', jsonb_build_object(
      'id',           v_inviter.id,
      'username',     v_inviter.username,
      'display_name', v_inviter.display_name,
      'avatar_url',   v_inviter.avatar_url
    )
  );
END;
$$;

-- ── RPC: accept_session_invite(p_token) ──────────────────────
-- Atomic: validates invite, accepts it, inserts member row.
-- Returns jsonb with session data on success or error key on failure.
CREATE OR REPLACE FUNCTION public.accept_session_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite  public.session_invites%ROWTYPE;
  v_session public.sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_invite
  FROM public.session_invites
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invite_not_found');
  END IF;

  IF v_invite.invitee_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'not_your_invite');
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'invite_expired');
  END IF;

  IF v_invite.status != 'pending' THEN
    RETURN jsonb_build_object(
      'error',  'invite_already_used',
      'status', v_invite.status
    );
  END IF;

  SELECT * INTO v_session
  FROM public.sessions
  WHERE id = v_invite.session_id AND ended_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'session_ended');
  END IF;

  -- Accept the invite
  UPDATE public.session_invites
  SET status = 'accepted'
  WHERE id = v_invite.id;

  -- Join the session
  INSERT INTO public.session_members(session_id, user_id, role)
  VALUES (v_invite.session_id, auth.uid(), 'guest')
  ON CONFLICT (session_id, user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'session_id',  v_session.id,
    'user_id',     v_session.user_id,
    'title',       v_session.title,
    'started_at',  v_session.started_at,
    'ended_at',    v_session.ended_at,
    'created_at',  v_session.created_at,
    'my_role',     'guest'
  );
END;
$$;

-- ── Extend notify_push_event() for session_invites ───────────
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
      'drink_log_id', NEW.drink_log_id,
      'comment_preview', left(NEW.content, 80)
    );

  ELSIF TG_TABLE_NAME = 'follows' THEN
    v_actor_id := NEW.follower_id;
    v_recipient_id := NEW.following_id;
    v_type := 'follow';
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

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_push_event: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_session_invite_sent ON public.session_invites;
CREATE TRIGGER on_session_invite_sent
  AFTER INSERT ON public.session_invites
  FOR EACH ROW EXECUTE FUNCTION public.notify_push_event();
