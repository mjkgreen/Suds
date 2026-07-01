-- Auto-end sessions that have had no drinks logged in the past 5 hours.
-- ended_at is set to the last drink's logged_at (not now()) so session
-- history reflects when activity actually stopped.

-- ── Standalone cleanup function (called by pg_cron) ──────────
CREATE OR REPLACE FUNCTION public.auto_end_stale_sessions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.sessions s
  SET ended_at = COALESCE(
    (SELECT MAX(dl.logged_at) FROM public.drink_logs dl WHERE dl.session_id = s.id),
    s.started_at  -- zero-drink sessions: end at start time
  )
  WHERE s.ended_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.drink_logs dl
      WHERE dl.session_id = s.id
        AND dl.logged_at > now() - interval '5 hours'
    )
    -- also catch zero-drink sessions started 5+ hours ago
    AND s.started_at < now() - interval '5 hours';
$$;

-- ── pg_cron: run hourly ───────────────────────────────────────
-- Requires the pg_cron extension (enabled by default on Supabase Pro).
-- If pg_cron is not available this block will error; remove it and
-- rely solely on the app-open auto-end logic below.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'auto-end-stale-sessions',
  '0 * * * *',
  'SELECT public.auto_end_stale_sessions()'
);

-- ── get_my_active_session: auto-end on app open ───────────────
-- Replaces the previous STABLE sql function with a plpgsql one that
-- silently ends any of the calling user's sessions idle for 5+ hours
-- before returning. This handles the case where the user relaunches the
-- app before the hourly cron fires.
DROP FUNCTION IF EXISTS public.get_my_active_session();

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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Silently end any of this user's sessions that have been idle 5+ hours
  UPDATE public.sessions s
  SET ended_at = COALESCE(
    (SELECT MAX(dl.logged_at) FROM public.drink_logs dl WHERE dl.session_id = s.id),
    s.started_at
  )
  WHERE s.user_id = auth.uid()
    AND s.ended_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.drink_logs dl
      WHERE dl.session_id = s.id
        AND dl.logged_at > now() - interval '5 hours'
    )
    AND s.started_at < now() - interval '5 hours';

  -- Return the active session (if any remains)
  RETURN QUERY
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
END;
$$;
