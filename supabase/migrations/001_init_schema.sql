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
