-- ============================================================
-- SEARCH PLACES AND DRINKS
--
-- The search screen finds places and drinks as well as people:
--   • search_places('bellw')   → places whose name matches, with
--     how many drinks / people were logged there
--   • search_drinks('guinn')   → drink names and brands that match
--   • popular_places()         → where you and the people you follow
--     have been over the last 30 days (shown before you type)
--   • get_matching_drinks(...) → the drinks behind one of those
--     results, in the same shape as get_feed, for the list screen
--
-- Privacy: every function only counts or returns drinks the caller
-- could already see on that person's profile (can_view_user: their
-- own, public accounts, or private accounts they follow; never
-- across a block). Places only come from drinks saved with
-- coordinates and a name that doesn't start with a house number, so
-- home addresses and Privacy Mode's street-level names (which are
-- saved without coordinates) never show up as places.
--
-- Matching uses normalize_drink_label() from 047, so "joes ipa"
-- finds "Joe's IPA" and "rum and coke" finds "Rum & Coke".
-- ============================================================

-- ── 1. Trigram indexes for substring search ──────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_drink_logs_location_trgm ON public.drink_logs
  USING gin (public.normalize_drink_label(location_name) extensions.gin_trgm_ops)
  WHERE location_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drink_logs_drink_name_trgm ON public.drink_logs
  USING gin (public.normalize_drink_label(drink_name) extensions.gin_trgm_ops)
  WHERE drink_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drink_logs_brand_trgm ON public.drink_logs
  USING gin (public.normalize_drink_label(brand) extensions.gin_trgm_ops)
  WHERE brand IS NOT NULL;

-- ── 2. Helpers ───────────────────────────────────────────────
-- A search query as a LIKE pattern on normalized labels:
-- normalized, with LIKE wildcards escaped, wrapped in %…%.
-- NULL when the query is too short to be useful.
CREATE OR REPLACE FUNCTION public.drink_search_pattern(p_query text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN char_length(public.normalize_drink_label(p_query)) < 2 THEN NULL
    ELSE '%' || replace(replace(replace(public.normalize_drink_label(p_query),
                 '\', '\\'), '%', '\%'), '_', '\_') || '%'
  END;
$$;

-- Whether a drink's location counts as a public place (see header).
CREATE OR REPLACE FUNCTION public.is_searchable_place(p_name text, p_lat numeric)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_name IS NOT NULL
     AND p_lat IS NOT NULL
     AND btrim(p_name) !~ '^[0-9]'
     AND char_length(public.normalize_drink_label(p_name)) >= 2;
$$;

-- ── 3. search_places ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_places(p_query text, p_limit int DEFAULT 6)
RETURNS TABLE (
  place_name     text,
  drink_count    bigint,
  people_count   bigint,
  last_logged_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH matches AS (
    SELECT dl.user_id, btrim(dl.location_name) AS name, dl.logged_at,
           public.normalize_drink_label(dl.location_name) AS normalized
      FROM public.drink_logs dl
     WHERE dl.location_name IS NOT NULL
       AND public.normalize_drink_label(dl.location_name) LIKE public.drink_search_pattern(p_query)
       AND public.is_searchable_place(dl.location_name, dl.location_lat)
  ),
  visible_users AS (
    SELECT u.user_id
      FROM (SELECT DISTINCT user_id FROM matches) u
     WHERE public.can_view_user((SELECT auth.uid()), u.user_id)
  )
  SELECT mode() WITHIN GROUP (ORDER BY m.name),
         count(*),
         count(DISTINCT m.user_id),
         max(m.logged_at)
    FROM matches m
   WHERE m.user_id IN (SELECT user_id FROM visible_users)
   GROUP BY m.normalized
   ORDER BY count(DISTINCT m.user_id) DESC, count(*) DESC, max(m.logged_at) DESC
   LIMIT LEAST(GREATEST(p_limit, 1), 20);
$$;

-- ── 4. search_drinks ─────────────────────────────────────────
-- kind is 'brand' or 'name'. drink_type is the type most people
-- logged it as, for the icon.
CREATE OR REPLACE FUNCTION public.search_drinks(p_query text, p_limit int DEFAULT 6)
RETURNS TABLE (
  kind           text,
  label          text,
  drink_type     text,
  drink_count    bigint,
  people_count   bigint,
  last_logged_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH matches AS (
    SELECT 'brand'::text AS kind, btrim(dl.brand) AS label, dl.drink_type, dl.user_id, dl.logged_at,
           public.normalize_drink_label(dl.brand) AS normalized
      FROM public.drink_logs dl
     WHERE dl.brand IS NOT NULL
       AND public.normalize_drink_label(dl.brand) LIKE public.drink_search_pattern(p_query)
    UNION ALL
    SELECT 'name'::text, btrim(dl.drink_name), dl.drink_type, dl.user_id, dl.logged_at,
           public.normalize_drink_label(dl.drink_name)
      FROM public.drink_logs dl
     WHERE dl.drink_name IS NOT NULL
       AND public.normalize_drink_label(dl.drink_name) LIKE public.drink_search_pattern(p_query)
  ),
  visible_users AS (
    SELECT u.user_id
      FROM (SELECT DISTINCT user_id FROM matches) u
     WHERE public.can_view_user((SELECT auth.uid()), u.user_id)
  )
  SELECT m.kind,
         mode() WITHIN GROUP (ORDER BY m.label),
         mode() WITHIN GROUP (ORDER BY m.drink_type),
         count(*),
         count(DISTINCT m.user_id),
         max(m.logged_at)
    FROM matches m
   WHERE m.user_id IN (SELECT user_id FROM visible_users)
     AND char_length(m.normalized) >= 2
   GROUP BY m.kind, m.normalized
   ORDER BY count(DISTINCT m.user_id) DESC, count(*) DESC, max(m.logged_at) DESC
   LIMIT LEAST(GREATEST(p_limit, 1), 20);
$$;

-- ── 5. popular_places ────────────────────────────────────────
-- Where you and the people you follow have been lately.
CREATE OR REPLACE FUNCTION public.popular_places(p_days int DEFAULT 30, p_limit int DEFAULT 6)
RETURNS TABLE (
  place_name     text,
  drink_count    bigint,
  people_count   bigint,
  last_logged_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH circle AS (
    SELECT (SELECT auth.uid()) AS user_id
    UNION
    SELECT f.following_id
      FROM public.follows f
     WHERE f.follower_id = (SELECT auth.uid())
       AND NOT public.is_blocked((SELECT auth.uid()), f.following_id)
  )
  SELECT mode() WITHIN GROUP (ORDER BY btrim(dl.location_name)),
         count(*),
         count(DISTINCT dl.user_id),
         max(dl.logged_at)
    FROM public.drink_logs dl
   WHERE dl.user_id IN (SELECT user_id FROM circle)
     AND dl.logged_at > now() - make_interval(days => LEAST(GREATEST(p_days, 1), 365))
     AND public.is_searchable_place(dl.location_name, dl.location_lat)
   GROUP BY public.normalize_drink_label(dl.location_name)
   ORDER BY count(DISTINCT dl.user_id) DESC, count(*) DESC, max(dl.logged_at) DESC
   LIMIT LEAST(GREATEST(p_limit, 1), 20);
$$;

-- ── 6. get_matching_drinks ───────────────────────────────────
-- The drinks at one place (p_place), or with one brand / drink name
-- (p_label + p_kind 'brand' | 'name'), newest first. Same columns as
-- get_feed so the app renders them with the same card.
CREATE OR REPLACE FUNCTION public.get_matching_drinks(
  p_place  text DEFAULT NULL,
  p_label  text DEFAULT NULL,
  p_kind   text DEFAULT NULL,
  p_limit  int  DEFAULT 20,
  p_offset int  DEFAULT 0
)
RETURNS TABLE (
  id                 uuid,
  user_id            uuid,
  drink_type         text,
  drink_name         text,
  brand              text,
  quantity           numeric,
  location_name      text,
  location_lat       numeric,
  location_lng       numeric,
  notes              text,
  photo_url          text,
  photo_urls         text[],
  rating             numeric,
  event_name         text,
  logged_at          timestamptz,
  ended_at           timestamptz,
  created_at         timestamptz,
  username           text,
  display_name       text,
  avatar_url         text,
  displayed_badges   text[],
  session_id         uuid,
  session_title      text,
  session_started_at timestamptz,
  session_ended_at   timestamptz,
  like_count         bigint,
  comment_count      bigint,
  user_liked         boolean,
  media              jsonb,
  tagged_users       jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH matches AS (
    SELECT dl.*
      FROM public.drink_logs dl
     WHERE (
             p_place IS NOT NULL
             AND public.normalize_drink_label(dl.location_name) = public.normalize_drink_label(p_place)
             AND public.is_searchable_place(dl.location_name, dl.location_lat)
           )
        OR (
             p_place IS NULL AND p_kind = 'brand'
             AND public.normalize_drink_label(dl.brand) = public.normalize_drink_label(p_label)
           )
        OR (
             p_place IS NULL AND p_kind = 'name'
             AND public.normalize_drink_label(dl.drink_name) = public.normalize_drink_label(p_label)
           )
  ),
  visible_users AS (
    SELECT u.user_id
      FROM (SELECT DISTINCT user_id FROM matches) u
     WHERE public.can_view_user((SELECT auth.uid()), u.user_id)
  )
  SELECT
    dl.id,
    dl.user_id,
    dl.drink_type,
    dl.drink_name,
    dl.brand,
    dl.quantity,
    dl.location_name,
    dl.location_lat,
    dl.location_lng,
    dl.notes,
    dl.photo_url,
    dl.photo_urls,
    dl.rating,
    dl.event_name,
    dl.logged_at,
    dl.ended_at,
    dl.created_at,
    p.username,
    p.display_name,
    p.avatar_url,
    ub.badge_ids AS displayed_badges,
    s.id         AS session_id,
    s.title      AS session_title,
    s.started_at AS session_started_at,
    s.ended_at   AS session_ended_at,
    lk_agg.like_count,
    cm_agg.comment_count,
    COALESCE(ul.user_liked, false) AS user_liked,
    dl.media,
    COALESCE(tg.tagged_users, '[]'::jsonb) AS tagged_users
  FROM matches dl
  JOIN public.profiles p ON p.id = dl.user_id
  LEFT JOIN public.user_badges ub ON ub.user_id = dl.user_id
  LEFT JOIN public.sessions s ON s.id = dl.session_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS like_count FROM public.drink_likes WHERE drink_log_id = dl.id
  ) lk_agg ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS comment_count FROM public.drink_comments WHERE drink_log_id = dl.id
  ) cm_agg ON true
  LEFT JOIN LATERAL (
    SELECT true AS user_liked FROM public.drink_likes
    WHERE drink_log_id = dl.id AND user_id = (SELECT auth.uid())
    LIMIT 1
  ) ul ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
             jsonb_build_object('id', tp.id, 'username', tp.username, 'display_name', tp.display_name)
             ORDER BY t.created_at
           ) AS tagged_users
    FROM public.drink_tags t
    JOIN public.profiles tp ON tp.id = t.user_id
    WHERE t.drink_log_id = dl.id
      AND NOT public.is_blocked((SELECT auth.uid()), t.user_id)
  ) tg ON true
  WHERE dl.user_id IN (SELECT user_id FROM visible_users)
  ORDER BY dl.logged_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 50)
  OFFSET GREATEST(p_offset, 0);
$$;

-- ── 7. Who can call them ─────────────────────────────────────
REVOKE ALL ON FUNCTION public.search_places(text, int)                       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_drinks(text, int)                       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.popular_places(int, int)                       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_matching_drinks(text, text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_places(text, int)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_drinks(text, int)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.popular_places(int, int)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_matching_drinks(text, text, text, int, int) TO authenticated;
