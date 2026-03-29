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
