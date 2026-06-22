-- Fix infinite recursion in session_members_select policy.
-- The original policy queried session_members from within a session_members policy,
-- causing PostgreSQL to recurse indefinitely. A SECURITY DEFINER function bypasses
-- RLS for the inner lookup, breaking the cycle.

CREATE OR REPLACE FUNCTION public.get_my_session_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT session_id FROM public.session_members WHERE user_id = auth.uid();
$$;

DROP POLICY IF EXISTS "session_members_select" ON public.session_members;

CREATE POLICY "session_members_select" ON public.session_members
  FOR SELECT USING (
    session_id IN (SELECT public.get_my_session_ids())
  );



-- Fix upsert RLS failure on push_tokens.
-- When a new user signs in on the same device, the token already exists with
-- the previous owner's user_id. The upsert (ON CONFLICT token DO UPDATE) tries
-- to UPDATE that row, but USING (auth.uid() = user_id) checks the *existing*
-- row's user_id — which doesn't match the new user — so Postgres throws an RLS
-- violation. Setting USING to true lets the row be visible for the update while
-- WITH CHECK still enforces that user_id is always set to the current user.

DROP POLICY IF EXISTS "push_tokens_update_own" ON public.push_tokens;

CREATE POLICY "push_tokens_update_own" ON public.push_tokens
  FOR UPDATE
  USING (true)
  WITH CHECK (auth.uid() = user_id);