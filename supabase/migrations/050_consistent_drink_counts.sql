-- ============================================================
-- CONSISTENT DRINK COUNTS
--
-- Simulating night outs showed the profile's numbers disagreeing
-- with each other and with what people actually drank:
--
--   • get_user_stats counted log entries (COUNT(*)), so a pitcher
--     logged as quantity 3 counted as 1 drink, and water / soft
--     drinks counted toward Total, This Week, This Month and the
--     weekly goal.
--   • get_milestones counted alcoholic entries (also ignoring
--     quantity), so the milestone banner showed a different total
--     from the profile.
--   • get_advanced_stats counted entries of every type.
--   • Days, weeks, months and hours were all cut in UTC, so for
--     someone in the US an evening's drinks landed on the next day.
--   • activity_by_day stopped at 365 days; it now covers all history
--     for the progress chart's 1Y / All ranges.
--   • delete_session_with_drinks deleted every drink in the night
--     out — including guests' — although the app tells the host
--     the drinks stay in their history.
--
-- Now every count is the number of alcoholic drinks (sum of
-- quantity; water, soft drinks, mocktails and non-alcoholic don't
-- count), the same rule the BAC estimate uses, and the stats
-- functions take the viewer's time zone (optional, default UTC so
-- older app versions keep working). Deleting a night out removes
-- the night out only; everyone's drinks stay in their history.
-- ============================================================

-- ── Shared rule ──────────────────────────────────────────────
-- Matches NON_ALCOHOLIC_DRINK_TYPES in src/types/models.ts.
CREATE OR REPLACE FUNCTION public.is_alcoholic_drink(p_drink_type text)
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  SELECT p_drink_type NOT IN ('water', 'soft_drink', 'mocktail', 'non_alcoholic')
$$;

-- An IANA zone name the server knows, or UTC.
CREATE OR REPLACE FUNCTION public.safe_time_zone(p_tz text)
RETURNS text
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_tz IS NOT NULL AND EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_tz) THEN p_tz
    ELSE 'UTC'
  END
$$;

-- ── get_user_stats ───────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_user_stats(uuid);
DROP FUNCTION IF EXISTS public.get_user_stats_unguarded(uuid);

CREATE FUNCTION public.get_user_stats_unguarded(p_user_id uuid, p_tz text DEFAULT 'UTC')
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_weekly_limit numeric;
  v_goal_updated_at timestamptz;
  v_created_at timestamptz;
  v_tz text := public.safe_time_zone(p_tz);
  v_now_local timestamp := now() AT TIME ZONE public.safe_time_zone(p_tz);
BEGIN
  SELECT weekly_limit, created_at INTO v_weekly_limit, v_goal_updated_at
  FROM public.goals
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT created_at INTO v_created_at FROM public.profiles WHERE id = p_user_id;

  WITH logs AS (
    SELECT
      dl.drink_type,
      dl.quantity,
      dl.location_country_code,
      dl.logged_at AT TIME ZONE v_tz AS local_at,
      public.is_alcoholic_drink(dl.drink_type) AS alcoholic
    FROM public.drink_logs dl
    WHERE dl.user_id = p_user_id
  )
  SELECT json_build_object(
    -- Alcoholic drinks, counting quantity.
    'total_drinks',       COALESCE(SUM(quantity) FILTER (WHERE alcoholic), 0),
    -- Everything logged, any type (unchanged meaning).
    'total_quantity',     COALESCE(SUM(quantity), 0),
    'drinks_this_week',   COALESCE(SUM(quantity) FILTER (WHERE alcoholic AND local_at >= date_trunc('week', v_now_local)), 0),
    'drinks_this_month',  COALESCE(SUM(quantity) FILTER (WHERE alcoholic AND local_at >= date_trunc('month', v_now_local)), 0),
    'happy_hour_count',   COUNT(*) FILTER (WHERE alcoholic AND EXTRACT(HOUR FROM local_at) BETWEEN 16 AND 18),
    'last_call_count',    COUNT(*) FILTER (WHERE alcoholic AND (EXTRACT(HOUR FROM local_at) >= 1 AND EXTRACT(HOUR FROM local_at) < 5)),
    'early_bird_count',   COUNT(*) FILTER (WHERE alcoholic AND EXTRACT(HOUR FROM local_at) BETWEEN 10 AND 15),
    'unique_countries_count', COUNT(DISTINCT location_country_code) FILTER (WHERE location_country_code IS NOT NULL),
    'weekly_limit',       COALESCE(v_weekly_limit, 0),
    'goal_updated_at',    v_goal_updated_at,
    'user_created_at',    v_created_at,
    -- Alcoholic only, so the shares add up to total_drinks.
    'favorite_drink_types', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT drink_type, SUM(quantity) AS count
        FROM logs
        WHERE alcoholic
        GROUP BY drink_type
        ORDER BY count DESC
        LIMIT 10
      ) t
    ),
    'activity_by_day', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT
          to_char(date_trunc('day', local_at), 'YYYY-MM-DD') AS date,
          COALESCE(SUM(quantity) FILTER (WHERE alcoholic), 0) AS alcohol_count,
          COALESCE(SUM(quantity) FILTER (WHERE drink_type = 'water'), 0) AS water_count,
          -- What the calendar, trend line and weekly-goal badges show: drinks.
          COALESCE(SUM(quantity) FILTER (WHERE alcoholic), 0) AS count
        FROM logs
        -- All history (was 365 days) so the progress chart's "All" range works.
        GROUP BY date_trunc('day', local_at)
        ORDER BY date
      ) t
    )
  )
  INTO v_result
  FROM logs;

  RETURN v_result;
END;
$$;

CREATE FUNCTION public.get_user_stats(p_user_id uuid, p_tz text DEFAULT 'UTC')
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id
     AND public.can_view_user(auth.uid(), p_user_id) IS NOT TRUE THEN
    RETURN NULL;
  END IF;
  RETURN public.get_user_stats_unguarded(p_user_id, p_tz);
END;
$$;

-- ── get_milestones ───────────────────────────────────────────
-- A milestone is earned by the drink that takes the running total
-- (by quantity) to the threshold.
CREATE OR REPLACE FUNCTION public.get_milestones_unguarded(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  WITH
  running AS (
    SELECT
      logged_at,
      SUM(quantity) OVER (ORDER BY logged_at, id ROWS UNBOUNDED PRECEDING) AS running_total
    FROM public.drink_logs
    WHERE user_id = p_user_id AND public.is_alcoholic_drink(drink_type)
  ),
  overall AS (
    SELECT COALESCE(MAX(running_total), 0) AS total FROM running
  ),
  by_type AS (
    SELECT drink_type, SUM(quantity) AS cnt
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
      (SELECT MIN(r.logged_at) FROM running r WHERE r.running_total >= mt.threshold) AS earned_at
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
    'total_drinks',     (SELECT total FROM overall),
    'latest_milestone', (SELECT threshold FROM latest_overall),
    'latest_earned_at', (SELECT earned_at FROM latest_overall),
    'is_new',           (SELECT earned_at >= now() - INTERVAL '7 days' FROM latest_overall),
    'all_earned',       (SELECT json_agg(threshold ORDER BY threshold) FROM overall_milestones WHERE earned_at IS NOT NULL),
    'by_type',          (SELECT json_object_agg(drink_type, cnt) FROM by_type)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

-- ── get_streaks ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_streaks(uuid);
DROP FUNCTION IF EXISTS public.get_streaks_unguarded(uuid);

CREATE FUNCTION public.get_streaks_unguarded(p_user_id uuid, p_tz text DEFAULT 'UTC')
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz text := public.safe_time_zone(p_tz);
  v_today date := (now() AT TIME ZONE public.safe_time_zone(p_tz))::date;
  v_drink_streak int := 0;
  v_sober_streak int := 0;
  v_last_drink   date;
BEGIN
  SELECT (logged_at AT TIME ZONE v_tz)::date INTO v_last_drink
  FROM public.drink_logs
  WHERE user_id = p_user_id AND public.is_alcoholic_drink(drink_type)
  ORDER BY logged_at DESC
  LIMIT 1;

  IF v_last_drink IS NULL OR v_last_drink >= v_today THEN
    v_sober_streak := 0;
  ELSE
    v_sober_streak := GREATEST((v_today - v_last_drink) - 1, 0);
  END IF;

  WITH daily_drinks AS (
    SELECT (logged_at AT TIME ZONE v_tz)::date AS day
    FROM public.drink_logs
    WHERE user_id = p_user_id AND public.is_alcoholic_drink(drink_type)
    GROUP BY 1
  ),
  islands AS (
    SELECT day, day - (ROW_NUMBER() OVER (ORDER BY day))::int AS grp FROM daily_drinks
  ),
  groups AS (
    SELECT MAX(day) AS end_day, COUNT(*) AS len FROM islands GROUP BY grp
  )
  SELECT len::int INTO v_drink_streak
  FROM groups
  WHERE end_day >= v_today - 1
  ORDER BY end_day DESC
  LIMIT 1;

  RETURN json_build_object(
    'drink_streak', COALESCE(v_drink_streak, 0),
    'sober_streak', v_sober_streak,
    'last_drink_date', v_last_drink
  );
END;
$$;

CREATE FUNCTION public.get_streaks(p_user_id uuid, p_tz text DEFAULT 'UTC')
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id
     AND public.can_view_user(auth.uid(), p_user_id) IS NOT TRUE THEN
    RETURN NULL;
  END IF;
  RETURN public.get_streaks_unguarded(p_user_id, p_tz);
END;
$$;

-- ── get_advanced_stats ───────────────────────────────────────
-- Same JSON shape; "count" fields are now alcoholic drinks by
-- quantity, in the viewer's time zone.
DROP FUNCTION IF EXISTS public.get_advanced_stats(uuid);
DROP FUNCTION IF EXISTS public.get_advanced_stats_unguarded(uuid);

CREATE FUNCTION public.get_advanced_stats_unguarded(p_user_id uuid, p_tz text DEFAULT 'UTC')
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_tz text := public.safe_time_zone(p_tz);
  v_now_local timestamp := now() AT TIME ZONE public.safe_time_zone(p_tz);
BEGIN
  WITH logs AS (
    SELECT
      session_id,
      quantity,
      logged_at,
      logged_at AT TIME ZONE v_tz AS local_at
    FROM public.drink_logs
    WHERE user_id = p_user_id AND public.is_alcoholic_drink(drink_type)
  )
  SELECT json_build_object(
    'weekly_trend', (
      SELECT json_agg(row_to_json(t) ORDER BY t.week_start) FROM (
        SELECT
          to_char(date_trunc('week', local_at), 'YYYY-MM-DD') AS week_start,
          SUM(quantity) AS count,
          SUM(quantity) AS total_quantity
        FROM logs
        WHERE local_at >= date_trunc('week', v_now_local) - INTERVAL '11 weeks'
        GROUP BY date_trunc('week', local_at)
      ) t
    ),
    'monthly_trend', (
      SELECT json_agg(row_to_json(t) ORDER BY t.month) FROM (
        SELECT
          to_char(date_trunc('month', local_at), 'YYYY-MM') AS month,
          SUM(quantity) AS count,
          SUM(quantity) AS total_quantity
        FROM logs
        WHERE local_at >= date_trunc('month', v_now_local) - INTERVAL '11 months'
        GROUP BY date_trunc('month', local_at)
      ) t
    ),
    'by_day_of_week', (
      SELECT json_agg(row_to_json(t) ORDER BY t.day_of_week) FROM (
        SELECT EXTRACT(DOW FROM local_at)::int AS day_of_week, SUM(quantity) AS count
        FROM logs GROUP BY 1
      ) t
    ),
    'by_hour', (
      SELECT json_agg(row_to_json(t) ORDER BY t.hour) FROM (
        SELECT EXTRACT(HOUR FROM local_at)::int AS hour, SUM(quantity) AS count
        FROM logs GROUP BY 1
      ) t
    ),
    'this_year_count', (
      SELECT COALESCE(SUM(quantity), 0) FROM logs
      WHERE local_at >= date_trunc('year', v_now_local)
    ),
    'last_year_count', (
      SELECT COALESCE(SUM(quantity), 0) FROM logs
      WHERE local_at >= date_trunc('year', v_now_local) - INTERVAL '1 year'
        AND local_at < date_trunc('year', v_now_local)
    ),
    'avg_per_week', (
      SELECT ROUND(
        (COALESCE(SUM(quantity), 0) / GREATEST(EXTRACT(EPOCH FROM (now() - MIN(logged_at))) / 604800.0, 1))::numeric,
        1
      )
      FROM logs
    ),
    'best_session_count', (
      SELECT MAX(cnt) FROM (
        SELECT session_id, SUM(quantity) AS cnt
        FROM logs
        WHERE session_id IS NOT NULL
        GROUP BY session_id
      ) s
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

CREATE FUNCTION public.get_advanced_stats(p_user_id uuid, p_tz text DEFAULT 'UTC')
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id
     AND public.can_view_user(auth.uid(), p_user_id) IS NOT TRUE THEN
    RETURN NULL;
  END IF;
  RETURN public.get_advanced_stats_unguarded(p_user_id, p_tz);
END;
$$;

-- ── Grants (as in 037) ───────────────────────────────────────
REVOKE ALL ON FUNCTION public.get_user_stats_unguarded(uuid, text)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_milestones_unguarded(uuid)           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_streaks_unguarded(uuid, text)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_advanced_stats_unguarded(uuid, text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_user_stats(uuid, text)     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_streaks(uuid, text)        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_advanced_stats(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_stats(uuid, text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_streaks(uuid, text)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_advanced_stats(uuid, text) TO authenticated;

-- ── delete_session_with_drinks ───────────────────────────────
-- Name kept for app compatibility. Deletes the night out only:
-- drink_logs.session_id is ON DELETE SET NULL, so every member's
-- drinks stay in their own history and totals.
CREATE OR REPLACE FUNCTION public.delete_session_with_drinks(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sessions
    WHERE id = p_session_id AND user_id = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.sessions WHERE id = p_session_id AND user_id = (SELECT auth.uid());
END;
$$;
