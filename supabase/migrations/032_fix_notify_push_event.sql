-- ============================================================
-- Scope the EXCEPTION handler in notify_push_event() to the
-- HTTP call only.
--
-- Previously EXCEPTION WHEN OTHERS covered the entire function
-- body, meaning a failed INSERT into in_app_notifications was
-- silently swallowed (logged as a WARNING, but the trigger
-- succeeded and the notification was lost).
--
-- Now:
--   • The in_app_notifications INSERT is outside any exception
--     handler — if it fails the trigger fails, which is the
--     correct behaviour (the source row insert is rolled back,
--     and the error is visible).
--   • The net.http_post() call is wrapped in its own nested
--     BEGIN…EXCEPTION…END so push-delivery failures remain
--     best-effort and never break likes, comments, follows, or
--     session invites.
-- ============================================================

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
