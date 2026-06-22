-- ============================================================
-- IN-APP NOTIFICATIONS
-- Persists notification events so users can review them in-app.
-- The existing notify_push_event() trigger is extended to also
-- write a row here alongside the push delivery.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name  text,
  type        text NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'session_invite')),
  context     jsonb NOT NULL DEFAULT '{}',
  read        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_id
  ON public.in_app_notifications(user_id);

-- Partial index speeds up unread count queries
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_unread
  ON public.in_app_notifications(user_id, created_at DESC) WHERE read = false;

ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "in_app_notifications_select" ON public.in_app_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "in_app_notifications_update" ON public.in_app_notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "in_app_notifications_delete" ON public.in_app_notifications
  FOR DELETE USING (auth.uid() = user_id);

-- ── Extend notify_push_event() to also write in_app_notifications ─
-- Full CREATE OR REPLACE required because the function body changes.
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

  -- Persist in-app notification
  INSERT INTO public.in_app_notifications(user_id, actor_id, actor_name, type, context)
  VALUES (
    v_recipient_id,
    v_actor_id,
    coalesce(v_actor.display_name, v_actor.username),
    v_type,
    v_context
  );

  -- Fire push notification (best-effort; errors are swallowed below)
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
