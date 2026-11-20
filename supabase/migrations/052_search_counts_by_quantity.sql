-- ============================================================
-- SEARCH COUNTS DRINKS, NOT LOG ENTRIES
--
-- search_places, popular_places and search_drinks (048) reported
-- "N drinks" as the number of log rows, so one "3 beers" log
-- counted as 1 drink — unlike the map, night outs and profile,
-- which count quantities. drink_count is now the sum of
-- quantities (numeric, so 2.5 stays 2.5). Like the map, every
-- drink type counts here: these say what was logged at a place
-- or under a name. Otherwise identical to 048.
-- ============================================================

DROP FUNCTION IF EXISTS public.search_places(text, int);
DROP FUNCTION IF EXISTS public.popular_places(int, int);
DROP FUNCTION IF EXISTS public.search_drinks(text, int);

CREATE FUNCTION public.search_places(p_query text, p_limit int DEFAULT 6)
RETURNS TABLE (
  place_name     text,
  drink_count    numeric, -- sum of quantities (was a row count)
  people_count   bigint,
  last_logged_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH matches AS (
    SELECT dl.user_id, btrim(dl.location_name) AS name, dl.logged_at, dl.quantity,
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
         sum(m.quantity),
         count(DISTINCT m.user_id),
         max(m.logged_at)
    FROM matches m
   WHERE m.user_id IN (SELECT user_id FROM visible_users)
   GROUP BY m.normalized
   ORDER BY count(DISTINCT m.user_id) DESC, sum(m.quantity) DESC, max(m.logged_at) DESC
   LIMIT LEAST(GREATEST(p_limit, 1), 20);
$$;

CREATE FUNCTION public.popular_places(p_days int DEFAULT 30, p_limit int DEFAULT 6)
RETURNS TABLE (
  place_name     text,
  drink_count    numeric, -- sum of quantities (was a row count)
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
         sum(dl.quantity),
         count(DISTINCT dl.user_id),
         max(dl.logged_at)
    FROM public.drink_logs dl
   WHERE dl.user_id IN (SELECT user_id FROM circle)
     AND dl.logged_at > now() - make_interval(days => LEAST(GREATEST(p_days, 1), 365))
     AND public.is_searchable_place(dl.location_name, dl.location_lat)
   GROUP BY public.normalize_drink_label(dl.location_name)
   ORDER BY count(DISTINCT dl.user_id) DESC, sum(dl.quantity) DESC, max(dl.logged_at) DESC
   LIMIT LEAST(GREATEST(p_limit, 1), 20);
$$;

CREATE FUNCTION public.search_drinks(p_query text, p_limit int DEFAULT 6)
RETURNS TABLE (
  kind           text,
  label          text,
  drink_type     text,
  drink_count    numeric, -- sum of quantities (was a row count)
  people_count   bigint,
  last_logged_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH matches AS (
    SELECT 'brand'::text AS kind, btrim(dl.brand) AS label, dl.drink_type, dl.user_id, dl.logged_at, dl.quantity,
           public.normalize_drink_label(dl.brand) AS normalized
      FROM public.drink_logs dl
     WHERE dl.brand IS NOT NULL
       AND public.normalize_drink_label(dl.brand) LIKE public.drink_search_pattern(p_query)
    UNION ALL
    SELECT 'name'::text, btrim(dl.drink_name), dl.drink_type, dl.user_id, dl.logged_at, dl.quantity,
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
         sum(m.quantity),
         count(DISTINCT m.user_id),
         max(m.logged_at)
    FROM matches m
   WHERE m.user_id IN (SELECT user_id FROM visible_users)
     AND char_length(m.normalized) >= 2
   GROUP BY m.kind, m.normalized
   ORDER BY count(DISTINCT m.user_id) DESC, sum(m.quantity) DESC, max(m.logged_at) DESC
   LIMIT LEAST(GREATEST(p_limit, 1), 20);
$$;

REVOKE ALL ON FUNCTION public.search_places(text, int)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_drinks(text, int)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.popular_places(int, int)  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_places(text, int)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_drinks(text, int)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.popular_places(int, int)  TO authenticated;
