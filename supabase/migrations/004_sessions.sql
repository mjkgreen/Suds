-- ============================================================
-- SESSIONS
-- Groups multiple drink_logs into a single "night out" event.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text,
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON public.sessions(started_at DESC);

-- Link drink_logs to a session
ALTER TABLE public.drink_logs
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_drink_logs_session_id ON public.drink_logs(session_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select" ON public.sessions
  FOR SELECT USING (
    auth.uid() = user_id
    OR user_id IN (
      SELECT following_id FROM public.follows WHERE follower_id = auth.uid()
    )
  );

CREATE POLICY "sessions_insert" ON public.sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sessions_update" ON public.sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "sessions_delete" ON public.sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- Updated get_feed — includes session_id + session_title
-- ============================================================
DROP FUNCTION IF EXISTS public.get_feed(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_feed(
  p_user_id uuid,
  p_limit   int DEFAULT 20,
  p_offset  int DEFAULT 0
)
RETURNS TABLE (
  id            uuid,
  user_id       uuid,
  drink_type    text,
  drink_name    text,
  quantity      numeric,
  location_name text,
  location_lat  numeric,
  location_lng  numeric,
  notes         text,
  photo_url     text,
  logged_at     timestamptz,
  created_at    timestamptz,
  username      text,
  display_name  text,
  avatar_url    text,
  session_id    uuid,
  session_title text
) AS $$
  SELECT
    dl.id,
    dl.user_id,
    dl.drink_type,
    dl.drink_name,
    dl.quantity,
    dl.location_name,
    dl.location_lat,
    dl.location_lng,
    dl.notes,
    dl.photo_url,
    dl.logged_at,
    dl.created_at,
    p.username,
    p.display_name,
    p.avatar_url,
    s.id        AS session_id,
    s.title     AS session_title
  FROM public.drink_logs dl
  JOIN public.profiles p ON p.id = dl.user_id
  LEFT JOIN public.sessions s ON s.id = dl.session_id
  WHERE dl.user_id = p_user_id
     OR dl.user_id IN (
       SELECT following_id FROM public.follows WHERE follower_id = p_user_id
     )
  ORDER BY dl.logged_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
