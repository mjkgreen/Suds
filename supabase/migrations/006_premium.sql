-- ============================================================
-- PREMIUM SUBSCRIPTION
-- ============================================================

-- Add subscription tier to profiles
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

-- Auto-update updated_at
CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS for goals
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
-- Returns:
--   drink_streak  — consecutive days ending today/yesterday with >= 1 drink
--   sober_streak  — consecutive days ending today with 0 drinks
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_streaks(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_drink_streak  int := 0;
  v_sober_streak  int := 0;
  v_last_drink    date;
BEGIN
  -- Date of the most recent drink
  SELECT DATE(logged_at AT TIME ZONE 'UTC')
  INTO v_last_drink
  FROM public.drink_logs
  WHERE user_id = p_user_id
  ORDER BY logged_at DESC
  LIMIT 1;

  -- Sober streak = days since last drink (0 if drank today)
  IF v_last_drink IS NULL THEN
    -- Never logged a drink
    v_sober_streak := 0;
  ELSIF v_last_drink = CURRENT_DATE THEN
    v_sober_streak := 0;
  ELSE
    v_sober_streak := (CURRENT_DATE - v_last_drink)::int - 1;
    IF v_sober_streak < 0 THEN v_sober_streak := 0; END IF;
  END IF;

  -- Drink streak = consecutive days ending today or yesterday with >= 1 drink
  WITH daily_drinks AS (
    SELECT DATE(logged_at AT TIME ZONE 'UTC') AS day
    FROM public.drink_logs
    WHERE user_id = p_user_id
    GROUP BY 1
  ),
  -- Island/gap detection
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
-- Returns earned milestone thresholds crossed, and whether
-- the most recent one is "new" (earned within last 7 days).
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_milestones(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  WITH
  -- Overall drink count
  overall AS (
    SELECT COUNT(*) AS total
    FROM public.drink_logs
    WHERE user_id = p_user_id
  ),
  -- Per drink-type counts
  by_type AS (
    SELECT drink_type, COUNT(*) AS cnt
    FROM public.drink_logs
    WHERE user_id = p_user_id
    GROUP BY drink_type
  ),
  -- The drink that crossed each milestone threshold (overall)
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
  -- Most recent overall milestone
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
-- Returns richer analytics for premium users.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_advanced_stats(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    -- Last 12 weeks, week-by-week drink count
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
    -- Last 12 months, month-by-month drink count
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
    -- Distribution by day of week (0 = Sunday, 6 = Saturday)
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
    -- Distribution by hour of day
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
    -- Year-over-year: this year vs last year total
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
    -- Average drinks per week (based on all history)
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
    -- Longest session (most drinks in a single session)
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
