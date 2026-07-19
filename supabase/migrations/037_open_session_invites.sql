-- ============================================================
-- OPEN SESSION INVITES (shareable "join my night out" links)
-- Unlike session_invites (bound to a specific existing user),
-- a share link is multi-use and can be sent to anyone — including
-- people without an account. The token rides a universal link
-- (https://drink-with-suds.com/join/{token}) and is claimed after
-- signup for new users.
-- ============================================================

-- ── session_share_links ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_share_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  created_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(9), 'base64url'),
  revoked     boolean NOT NULL DEFAULT false,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- One live link per member per session keeps get-or-create simple
  CONSTRAINT session_share_links_unique UNIQUE (session_id, created_by)
);

CREATE INDEX IF NOT EXISTS idx_session_share_links_token   ON public.session_share_links(token);
CREATE INDEX IF NOT EXISTS idx_session_share_links_session ON public.session_share_links(session_id);

ALTER TABLE public.session_share_links ENABLE ROW LEVEL SECURITY;

-- Members of the session can see its share links
CREATE POLICY "session_share_links_select" ON public.session_share_links
  FOR SELECT USING (
    session_id IN (SELECT public.get_my_session_ids())
  );

-- Any session member can create their own share link (every member is a recruiter)
CREATE POLICY "session_share_links_insert" ON public.session_share_links
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND session_id IN (SELECT public.get_my_session_ids())
  );

-- Creator can revoke their own link
CREATE POLICY "session_share_links_update" ON public.session_share_links
  FOR UPDATE USING (auth.uid() = created_by);

-- ── RPC: get_or_create_session_share_link(p_session_id) ──────
-- Returns the caller's live share link for the session, minting one if needed.
CREATE OR REPLACE FUNCTION public.get_or_create_session_share_link(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.session_share_links%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.session_members
    WHERE session_id = p_session_id AND user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('error', 'not_a_member');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.sessions WHERE id = p_session_id AND ended_at IS NULL
  ) THEN
    RETURN jsonb_build_object('error', 'session_ended');
  END IF;

  SELECT * INTO v_link
  FROM public.session_share_links
  WHERE session_id = p_session_id AND created_by = auth.uid();

  IF FOUND AND (v_link.revoked OR v_link.expires_at < now()) THEN
    -- Refresh a dead link in place with a new token
    UPDATE public.session_share_links
    SET token = encode(gen_random_bytes(9), 'base64url'),
        revoked = false,
        expires_at = now() + interval '7 days',
        created_at = now()
    WHERE id = v_link.id
    RETURNING * INTO v_link;
  ELSIF NOT FOUND THEN
    INSERT INTO public.session_share_links(session_id, created_by)
    VALUES (p_session_id, auth.uid())
    RETURNING * INTO v_link;
  END IF;

  RETURN jsonb_build_object(
    'token',      v_link.token,
    'expires_at', v_link.expires_at
  );
END;
$$;

-- ── RPC: get_open_invite_preview(p_token) ────────────────────
-- Public preview for the join page (web + native, signed in or not).
-- Deliberately exposes only what the invite card needs.
CREATE OR REPLACE FUNCTION public.get_open_invite_preview(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link    public.session_share_links%ROWTYPE;
  v_session public.sessions%ROWTYPE;
  v_creator public.profiles%ROWTYPE;
  v_member_count int;
BEGIN
  SELECT * INTO v_link FROM public.session_share_links WHERE token = p_token;

  IF NOT FOUND OR v_link.revoked THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_link.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = v_link.session_id;

  IF v_session.ended_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'session_ended');
  END IF;

  SELECT * INTO v_creator FROM public.profiles WHERE id = v_link.created_by;
  SELECT count(*) INTO v_member_count
  FROM public.session_members WHERE session_id = v_session.id;

  RETURN jsonb_build_object(
    'session', jsonb_build_object(
      'id',         v_session.id,
      'title',      v_session.title,
      'started_at', v_session.started_at
    ),
    'inviter', jsonb_build_object(
      'id',           v_creator.id,
      'username',     v_creator.username,
      'display_name', v_creator.display_name,
      'avatar_url',   v_creator.avatar_url
    ),
    'member_count', v_member_count
  );
END;
$$;

-- The join page must work before sign-in / on the public web
GRANT EXECUTE ON FUNCTION public.get_open_invite_preview(text) TO anon;

-- ── RPC: join_session_by_token(p_token) ──────────────────────
-- Multi-use join: adds the caller as a guest and creates a mutual
-- follow with the link creator so the new user's feed isn't empty.
CREATE OR REPLACE FUNCTION public.join_session_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link    public.session_share_links%ROWTYPE;
  v_session public.sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT * INTO v_link
  FROM public.session_share_links
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND OR v_link.revoked THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_link.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  SELECT * INTO v_session
  FROM public.sessions
  WHERE id = v_link.session_id AND ended_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'session_ended');
  END IF;

  INSERT INTO public.session_members(session_id, user_id, role)
  VALUES (v_session.id, auth.uid(), 'guest')
  ON CONFLICT (session_id, user_id) DO NOTHING;

  -- Mutual follow between joiner and inviter (skip self-joins)
  IF v_link.created_by != auth.uid() THEN
    INSERT INTO public.follows(follower_id, following_id)
    VALUES (auth.uid(), v_link.created_by)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.follows(follower_id, following_id)
    VALUES (v_link.created_by, auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;

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
