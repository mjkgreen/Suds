-- Replace push token upsert with a SECURITY DEFINER function.
-- The plain upsert via RLS has a known edge case: when a token already exists
-- for a different user (same device, account switch), the UPDATE policy's USING
-- clause rejects the row because the existing user_id != auth.uid(). A
-- SECURITY DEFINER function bypasses RLS, sets user_id = auth.uid() internally
-- (so the caller can't fake it), and handles the token-conflict upsert safely.

CREATE OR REPLACE FUNCTION public.upsert_push_token(
  p_token    text,
  p_platform text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.push_tokens (user_id, token, platform, updated_at)
  VALUES (auth.uid(), p_token, p_platform, now())
  ON CONFLICT (token)
  DO UPDATE SET
    user_id    = auth.uid(),
    platform   = EXCLUDED.platform,
    updated_at = now();
$$;

-- Revoke public execute, grant only to authenticated users
REVOKE ALL ON FUNCTION public.upsert_push_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_push_token(text, text) TO authenticated;
