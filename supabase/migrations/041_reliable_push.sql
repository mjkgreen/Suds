-- ============================================================
-- RELIABLE PUSH NOTIFICATIONS
--
-- Pushes used to be sent by each trigger calling the
-- send-push-notification edge function with
--   Authorization: Bearer current_setting('app.anon_key')
-- That setting isn't created by any migration; if it's missing on
-- the database the header is null, the function rejects the call
-- (or pg_net drops it) and no push is ever sent. The endpoint also
-- trusted whatever recipient/actor/text it was given, so anyone
-- holding the public anon key could push arbitrary messages to any
-- user.
--
-- Now every push comes from an in_app_notifications row:
--   • an AFTER INSERT trigger calls send-push-notification with
--     just the notification id (no key needed, see
--     call_edge_function below);
--   • the function claims the row by setting pushed_at (so each
--     notification is pushed at most once) and builds the message
--     from the stored row — callers can't inject content.
--
-- 040's storage cleanup had the same app.anon_key dependency and
-- now goes through the same keyless helper.
--
-- Deploy both functions with --no-verify-jwt:
--   supabase functions deploy send-push-notification --no-verify-jwt
--   supabase functions deploy cleanup-storage --no-verify-jwt
-- ============================================================

-- ── 0. Keyless edge-function calls ───────────────────────────
-- Sends no Authorization header: the functions it calls only act
-- on rows already in the database (a queued cleanup, an unsent
-- notification), so they're safe to invoke without a key.
-- Best-effort: never raises. pg_net sends the request after the
-- transaction commits, so the function sees rows written in it.
CREATE OR REPLACE FUNCTION public.call_edge_function(p_name text, p_body jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url     := coalesce(
                 nullif(current_setting('app.supabase_url', true), ''),
                 'https://gbenibgytweskljxneup.supabase.co'
               ) || '/functions/v1/' || p_name,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := p_body
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'call_edge_function(%): %', p_name, SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.call_edge_function(text, jsonb) FROM PUBLIC;

-- Replaces 040's version, which sent app.anon_key.
CREATE OR REPLACE FUNCTION public.kick_storage_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.storage_cleanup_queue) THEN
    PERFORM public.call_edge_function('cleanup-storage');
  END IF;
  RETURN NULL;
END;
$$;

-- ── 1. Track delivery ────────────────────────────────────────
ALTER TABLE public.in_app_notifications
  ADD COLUMN IF NOT EXISTS pushed_at timestamptz;

-- Existing notifications must never be (re)pushed.
UPDATE public.in_app_notifications SET pushed_at = created_at WHERE pushed_at IS NULL;

-- ── 2. Push every new notification ───────────────────────────
CREATE OR REPLACE FUNCTION public.push_in_app_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.call_edge_function(
    'send-push-notification',
    jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS in_app_notifications_push ON public.in_app_notifications;
CREATE TRIGGER in_app_notifications_push
  AFTER INSERT ON public.in_app_notifications
  FOR EACH ROW EXECUTE FUNCTION public.push_in_app_notification();

-- ── 3. Drop the direct push calls ────────────────────────────
-- Bodies identical to 037 minus the net.http_post block; the
-- in_app_notifications insert they already do now triggers the push.
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

  RETURN NEW;
END;
$$;

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
END;
$$;
