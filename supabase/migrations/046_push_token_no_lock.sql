-- ============================================================
-- upsert_push_token: return without locking when nothing changed
--
-- Builds up to 14 have a client loop (fixed in useNotifications.ts)
-- that can call this RPC ~140 times a second from one device. 044
-- stopped those calls writing, but INSERT ... ON CONFLICT DO UPDATE
-- ... WHERE still row-locks the existing token, so the calls queued
-- behind each other, held PostgREST's connection pool and hit the 8s
-- statement timeout, which stalled every other request.
--
-- Check with a plain (lock-free) read first; only fall through to
-- the upsert when the token is new or moved user/platform.
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_push_token(p_token text, p_platform text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.push_tokens
    WHERE token = p_token
      AND user_id = auth.uid()
      AND platform = p_platform
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.push_tokens (user_id, token, platform, updated_at)
  VALUES (auth.uid(), p_token, p_platform, now())
  ON CONFLICT (token)
  DO UPDATE SET
    user_id    = auth.uid(),
    platform   = EXCLUDED.platform,
    updated_at = now()
  WHERE push_tokens.user_id IS DISTINCT FROM auth.uid()
     OR push_tokens.platform IS DISTINCT FROM EXCLUDED.platform;
END;
$$;
