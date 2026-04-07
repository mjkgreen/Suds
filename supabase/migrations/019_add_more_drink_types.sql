-- Update drink_type check constraint to include new types
ALTER TABLE public.drink_logs
DROP CONSTRAINT IF EXISTS drink_logs_drink_type_check;

ALTER TABLE public.drink_logs
ADD CONSTRAINT drink_logs_drink_type_check
CHECK (drink_type IN (
  'beer', 'wine', 'cocktail', 'spirit', 'cider', 'seltzer',
  'water', 'soft_drink', 'mocktail', 'non_alcoholic', 'other'
));

-- Update get_user_stats to distinguish between alcoholic and total drinks
-- Suggestion: Milestone stats ('total_drinks') should only count alcoholic drinks.
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'total_drinks',       COUNT(*) FILTER (WHERE drink_type NOT IN ('water', 'soft_drink', 'mocktail', 'non_alcoholic')),
    'total_quantity',     COALESCE(SUM(quantity) FILTER (WHERE drink_type NOT IN ('water', 'soft_drink', 'mocktail', 'non_alcoholic')), 0),
    'drinks_this_week',   COUNT(*) FILTER (WHERE logged_at >= date_trunc('week', now()) AND drink_type NOT IN ('water', 'soft_drink', 'mocktail', 'non_alcoholic')),
    'drinks_this_month',  COUNT(*) FILTER (WHERE logged_at >= date_trunc('month', now()) AND drink_type NOT IN ('water', 'soft_drink', 'mocktail', 'non_alcoholic')),
    'happy_hour_count',   COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM (logged_at AT TIME ZONE 'UTC')) BETWEEN 16 AND 18 AND drink_type NOT IN ('water', 'soft_drink', 'mocktail', 'non_alcoholic')),
    'last_call_count',    COUNT(*) FILTER (WHERE (EXTRACT(HOUR FROM (logged_at AT TIME ZONE 'UTC')) >= 1 OR EXTRACT(HOUR FROM (logged_at AT TIME ZONE 'UTC')) < 5) AND drink_type NOT IN ('water', 'soft_drink', 'mocktail', 'non_alcoholic')),
    'early_bird_count',   COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM (logged_at AT TIME ZONE 'UTC')) BETWEEN 10 AND 15 AND drink_type NOT IN ('water', 'soft_drink', 'mocktail', 'non_alcoholic')),
    'unique_countries_count', COUNT(DISTINCT location_country_code) FILTER (WHERE location_country_code IS NOT NULL),
    'favorite_drink_types', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT drink_type, COUNT(*) AS count
        FROM public.drink_logs
        WHERE user_id = p_user_id
        GROUP BY drink_type
        ORDER BY count DESC
        LIMIT 10
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

-- Update get_streaks to only consider alcoholic drinks for breaking the sober streak
CREATE OR REPLACE FUNCTION public.get_streaks(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_drink_streak  int := 0;
  v_sober_streak  int := 0;
  v_last_drink    date;
BEGIN
  -- Date of the most recent ALCOHOLIC drink
  SELECT DATE(logged_at AT TIME ZONE 'UTC')
  INTO v_last_drink
  FROM public.drink_logs
  WHERE user_id = p_user_id
    AND drink_type NOT IN ('water', 'soft_drink', 'mocktail', 'non_alcoholic')
  ORDER BY logged_at DESC
  LIMIT 1;

  -- Sober streak = days since last drink (0 if drank today)
  IF v_last_drink IS NULL THEN
    v_sober_streak := 0;
  ELSIF v_last_drink = CURRENT_DATE THEN
    v_sober_streak := 0;
  ELSE
    v_sober_streak := (CURRENT_DATE - v_last_drink)::int - 1;
    IF v_sober_streak < 0 THEN v_sober_streak := 0; END IF;
  END IF;

  -- Drink streak = consecutive days ending today or yesterday with >= 1 ALCOHOLIC drink
  WITH daily_drinks AS (
    SELECT DATE(logged_at AT TIME ZONE 'UTC') AS day
    FROM public.drink_logs
    WHERE user_id = p_user_id
      AND drink_type NOT IN ('water', 'soft_drink', 'mocktail', 'non_alcoholic')
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

-- Update get_milestones to only count alcoholic drinks for overall totals
CREATE OR REPLACE FUNCTION public.get_milestones(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  WITH
  -- Overall alcoholic drink count
  overall AS (
    SELECT COUNT(*) AS total
    FROM public.drink_logs
    WHERE user_id = p_user_id
      AND drink_type NOT IN ('water', 'soft_drink', 'mocktail', 'non_alcoholic')
  ),
  -- Per drink-type counts (including non-alcoholic for specific badges)
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
         AND drink_type NOT IN ('water', 'soft_drink', 'mocktail', 'non_alcoholic')
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
