-- Push tokens table (multi-device support)
-- UNIQUE on token ensures upserts are idempotent:
-- if the same device re-registers (e.g. new user signs in), user_id and updated_at are refreshed.
CREATE TABLE public.push_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token       text NOT NULL,
  platform    text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_tokens_token_key UNIQUE (token)
);

CREATE INDEX idx_push_tokens_user_id ON public.push_tokens(user_id);

-- Notification preferences (one row per user, all default true = opt-out model)
CREATE TABLE public.notification_preferences (
  user_id          uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  notify_likes     boolean NOT NULL DEFAULT true,
  notify_comments  boolean NOT NULL DEFAULT true,
  notify_follows   boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- auto-update updated_at (reuses function from 001_init_schema.sql)
CREATE TRIGGER push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS: users can only manage their own tokens
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_tokens_select_own" ON public.push_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "push_tokens_insert_own" ON public.push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_tokens_update_own" ON public.push_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "push_tokens_delete_own" ON public.push_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- RLS: users can only manage their own preferences
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_prefs_select_own" ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notification_prefs_insert_own" ON public.notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notification_prefs_update_own" ON public.notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Trigger function: fires on drink_likes, drink_comments, follows inserts.
-- Calls the send-push-notification Edge Function via pg_net.
-- Mirrors the pattern in 20260407183736_setup_signup_email_trigger.sql.
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
      'actor_id',    v_actor_id,
      'actor_name',  coalesce(v_actor.display_name, v_actor.username),
      'recipient_id', v_recipient_id,
      'type',        v_type,
      'context',     v_context
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_push_event: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_drink_liked
  AFTER INSERT ON public.drink_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_push_event();

CREATE TRIGGER on_drink_commented
  AFTER INSERT ON public.drink_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_push_event();

CREATE TRIGGER on_followed
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_push_event();
