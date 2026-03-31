-- Enable PostGIS for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      text UNIQUE NOT NULL,
  display_name  text,
  avatar_url    text,
  bio           text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- DRINK LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.drink_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  drink_type    text NOT NULL CHECK (drink_type IN ('beer','wine','cocktail','spirit','cider','seltzer','other')),
  drink_name    text,
  quantity      numeric(4,2) NOT NULL CHECK (quantity > 0),
  location_name text,
  location_lat  numeric(10,7),
  location_lng  numeric(10,7),
  location_geom geography(POINT, 4326),
  notes         text,
  photo_url     text,
  logged_at     timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drink_logs_user_id   ON public.drink_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_drink_logs_logged_at ON public.drink_logs(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_drink_logs_geom      ON public.drink_logs USING GIST (location_geom);

-- Auto-compute PostGIS geometry from lat/lng on insert/update
CREATE OR REPLACE FUNCTION public.set_location_geom()
RETURNS trigger AS $$
BEGIN
  IF NEW.location_lat IS NOT NULL AND NEW.location_lng IS NOT NULL THEN
    NEW.location_geom = ST_SetSRID(
      ST_MakePoint(NEW.location_lng, NEW.location_lat), 4326
    )::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS drink_logs_set_geom ON public.drink_logs;
CREATE TRIGGER drink_logs_set_geom
  BEFORE INSERT OR UPDATE ON public.drink_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_location_geom();

-- ============================================================
-- FOLLOWS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower  ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);
-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drink_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows    ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES ----

CREATE POLICY "Profiles are publicly readable"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ---- DRINK LOGS ----

-- Visible to the owner and their followers
CREATE POLICY "Drink logs visible to self and followers"
  ON public.drink_logs FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT following_id FROM public.follows WHERE follower_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own drink logs"
  ON public.drink_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own drink logs"
  ON public.drink_logs FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own drink logs"
  ON public.drink_logs FOR DELETE
  USING (user_id = auth.uid());

-- ---- FOLLOWS ----

CREATE POLICY "Follows are publicly readable"
  ON public.follows FOR SELECT
  USING (true);

CREATE POLICY "Users can follow others"
  ON public.follows FOR INSERT
  WITH CHECK (follower_id = auth.uid());

CREATE POLICY "Users can unfollow"
  ON public.follows FOR DELETE
  USING (follower_id = auth.uid());
-- ============================================================
-- FEED FUNCTION
-- Returns drink_logs from yourself + people you follow.
-- ============================================================
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
  -- profile fields joined inline
  username      text,
  display_name  text,
  avatar_url    text
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
    p.avatar_url
  FROM public.drink_logs dl
  JOIN public.profiles p ON p.id = dl.user_id
  WHERE dl.user_id = p_user_id
     OR dl.user_id IN (
       SELECT following_id FROM public.follows WHERE follower_id = p_user_id
     )
  ORDER BY dl.logged_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- USER STATS FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'total_drinks',       COUNT(*),
    'total_quantity',     COALESCE(SUM(quantity), 0),
    'drinks_this_week',   COUNT(*) FILTER (WHERE logged_at >= date_trunc('week', now())),
    'drinks_this_month',  COUNT(*) FILTER (WHERE logged_at >= date_trunc('month', now())),
    'favorite_drink_types', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT drink_type, COUNT(*) AS count
        FROM public.drink_logs
        WHERE user_id = p_user_id
        GROUP BY drink_type
        ORDER BY count DESC
        LIMIT 3
      ) t
    ),
    'activity_by_day', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT
          to_char(date_trunc('day', logged_at), 'YYYY-MM-DD') AS date,
          COUNT(*) AS count
        FROM public.drink_logs
        WHERE user_id = p_user_id
          AND logged_at >= now() - interval '365 days'
        GROUP BY date_trunc('day', logged_at)
        ORDER BY date
      ) t
    )
  )
  INTO v_result
  FROM public.drink_logs
  WHERE user_id = p_user_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- PROFILE COUNTS VIEW (follower/following counts)
-- ============================================================
CREATE OR REPLACE VIEW public.profile_counts AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.created_at,
  COUNT(DISTINCT f1.follower_id)  AS followers_count,
  COUNT(DISTINCT f2.following_id) AS following_count
FROM public.profiles p
LEFT JOIN public.follows f1 ON f1.following_id = p.id
LEFT JOIN public.follows f2 ON f2.follower_id = p.id
GROUP BY p.id;

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

ALTER TABLE public.drink_logs
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_drink_logs_session_id ON public.drink_logs(session_id);

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

-- Updated get_feed — includes session_id + session_title
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

-- ============================================================
-- STORAGE: drink-photos bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'drink-photos',
  'drink-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "drink_photos_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'drink-photos');

CREATE POLICY "drink_photos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'drink-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "drink_photos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'drink-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- STORAGE: avatars bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = regexp_replace(storage.filename(name), '\.[^.]+$', '')
  );

CREATE POLICY "avatars_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = regexp_replace(storage.filename(name), '\.[^.]+$', '')
  );

CREATE POLICY "avatars_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = regexp_replace(storage.filename(name), '\.[^.]+$', '')
  );

-- ============================================================
-- PREMIUM SUBSCRIPTION
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'premium'));

-- ============================================================
-- GOALS TABLE (free feature — moderation tool)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.goals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weekly_limit  int NOT NULL CHECK (weekly_limit > 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goal"
  ON public.goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goal"
  ON public.goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goal"
  ON public.goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goal"
  ON public.goals FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- STREAKS FUNCTION (free feature)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_streaks(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_drink_streak  int := 0;
  v_sober_streak  int := 0;
  v_last_drink    date;
BEGIN
  SELECT DATE(logged_at AT TIME ZONE 'UTC')
  INTO v_last_drink
  FROM public.drink_logs
  WHERE user_id = p_user_id
  ORDER BY logged_at DESC
  LIMIT 1;

  IF v_last_drink IS NULL THEN
    v_sober_streak := 0;
  ELSIF v_last_drink = CURRENT_DATE THEN
    v_sober_streak := 0;
  ELSE
    v_sober_streak := (CURRENT_DATE - v_last_drink)::int - 1;
    IF v_sober_streak < 0 THEN v_sober_streak := 0; END IF;
  END IF;

  WITH daily_drinks AS (
    SELECT DATE(logged_at AT TIME ZONE 'UTC') AS day
    FROM public.drink_logs
    WHERE user_id = p_user_id
    GROUP BY 1
  ),
  islands AS (
    SELECT
      day,
      day - (ROW_NUMBER() OVER (ORDER BY day) * INTERVAL '1 day')::interval AS grp
    FROM daily_drinks
  ),
  groups AS (
    SELECT
      MIN(day) AS start_day,
      MAX(day) AS end_day,
      COUNT(*) AS len
    FROM islands
    GROUP BY grp
  )
  SELECT COALESCE(len, 0)::int
  INTO v_drink_streak
  FROM groups
  WHERE end_day >= CURRENT_DATE - INTERVAL '1 day'
  ORDER BY end_day DESC
  LIMIT 1;

  IF v_drink_streak IS NULL THEN
    v_drink_streak := 0;
  END IF;

  RETURN json_build_object(
    'drink_streak', v_drink_streak,
    'sober_streak', v_sober_streak,
    'last_drink_date', v_last_drink
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- MILESTONES FUNCTION (free feature — gamification)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_milestones(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  WITH
  overall AS (
    SELECT COUNT(*) AS total
    FROM public.drink_logs
    WHERE user_id = p_user_id
  ),
  by_type AS (
    SELECT drink_type, COUNT(*) AS cnt
    FROM public.drink_logs
    WHERE user_id = p_user_id
    GROUP BY drink_type
  ),
  milestone_thresholds(threshold) AS (
    VALUES (1),(10),(25),(50),(100),(200),(300),(400),(500),(750),(1000)
  ),
  overall_milestones AS (
    SELECT
      mt.threshold,
      (SELECT logged_at FROM public.drink_logs
       WHERE user_id = p_user_id
       ORDER BY logged_at ASC
       LIMIT 1 OFFSET mt.threshold - 1) AS earned_at
    FROM milestone_thresholds mt
    JOIN overall o ON o.total >= mt.threshold
  ),
  latest_overall AS (
    SELECT threshold, earned_at
    FROM overall_milestones
    WHERE earned_at IS NOT NULL
    ORDER BY threshold DESC
    LIMIT 1
  )
  SELECT json_build_object(
    'total_drinks',        (SELECT total FROM overall),
    'latest_milestone',    (SELECT threshold FROM latest_overall),
    'latest_earned_at',    (SELECT earned_at FROM latest_overall),
    'is_new',              (
                             SELECT earned_at >= now() - INTERVAL '7 days'
                             FROM latest_overall
                           ),
    'all_earned',          (
                             SELECT json_agg(threshold ORDER BY threshold)
                             FROM overall_milestones
                             WHERE earned_at IS NOT NULL
                           ),
    'by_type',             (
                             SELECT json_object_agg(drink_type, cnt)
                             FROM by_type
                           )
  )
  INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- ADVANCED STATS FUNCTION (premium feature)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_advanced_stats(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'weekly_trend', (
      SELECT json_agg(row_to_json(t) ORDER BY t.week_start) FROM (
        SELECT
          to_char(date_trunc('week', logged_at), 'YYYY-MM-DD') AS week_start,
          COUNT(*) AS count,
          COALESCE(SUM(quantity), 0) AS total_quantity
        FROM public.drink_logs
        WHERE user_id = p_user_id
          AND logged_at >= now() - INTERVAL '12 weeks'
        GROUP BY date_trunc('week', logged_at)
        ORDER BY 1
      ) t
    ),
    'monthly_trend', (
      SELECT json_agg(row_to_json(t) ORDER BY t.month) FROM (
        SELECT
          to_char(date_trunc('month', logged_at), 'YYYY-MM') AS month,
          COUNT(*) AS count,
          COALESCE(SUM(quantity), 0) AS total_quantity
        FROM public.drink_logs
        WHERE user_id = p_user_id
          AND logged_at >= now() - INTERVAL '12 months'
        GROUP BY date_trunc('month', logged_at)
        ORDER BY 1
      ) t
    ),
    'by_day_of_week', (
      SELECT json_agg(row_to_json(t) ORDER BY t.day_of_week) FROM (
        SELECT
          EXTRACT(DOW FROM logged_at AT TIME ZONE 'UTC')::int AS day_of_week,
          COUNT(*) AS count
        FROM public.drink_logs
        WHERE user_id = p_user_id
        GROUP BY 1
        ORDER BY 1
      ) t
    ),
    'by_hour', (
      SELECT json_agg(row_to_json(t) ORDER BY t.hour) FROM (
        SELECT
          EXTRACT(HOUR FROM logged_at AT TIME ZONE 'UTC')::int AS hour,
          COUNT(*) AS count
        FROM public.drink_logs
        WHERE user_id = p_user_id
        GROUP BY 1
        ORDER BY 1
      ) t
    ),
    'this_year_count', (
      SELECT COUNT(*) FROM public.drink_logs
      WHERE user_id = p_user_id
        AND logged_at >= date_trunc('year', now())
    ),
    'last_year_count', (
      SELECT COUNT(*) FROM public.drink_logs
      WHERE user_id = p_user_id
        AND logged_at >= date_trunc('year', now()) - INTERVAL '1 year'
        AND logged_at < date_trunc('year', now())
    ),
    'avg_per_week', (
      SELECT ROUND(
        COUNT(*) / GREATEST(
          EXTRACT(EPOCH FROM (now() - MIN(logged_at))) / 604800.0,
          1
        )::numeric,
        1
      )
      FROM public.drink_logs
      WHERE user_id = p_user_id
    ),
    'best_session_count', (
      SELECT MAX(cnt) FROM (
        SELECT session_id, COUNT(*) AS cnt
        FROM public.drink_logs
        WHERE user_id = p_user_id
          AND session_id IS NOT NULL
        GROUP BY session_id
      ) s
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
