-- Update get_user_stats to include user_created_at, hydration metrics, AND goal_updated_at
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_result json;
  v_weekly_limit numeric;
  v_goal_updated_at timestamptz;
  v_created_at timestamptz;
BEGIN
  -- Get weekly limit and when it was last changed
  SELECT weekly_limit, created_at INTO v_weekly_limit, v_goal_updated_at
  FROM public.goals
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT created_at INTO v_created_at
  FROM public.profiles
  WHERE id = p_user_id;

  SELECT json_build_object(
    'total_drinks',       COUNT(*),
    'total_quantity',     COALESCE(SUM(quantity), 0),
    'drinks_this_week',   COUNT(*) FILTER (WHERE logged_at >= date_trunc('week', now())),
    'drinks_this_month',  COUNT(*) FILTER (WHERE logged_at >= date_trunc('month', now())),
    'happy_hour_count',   COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM (logged_at AT TIME ZONE 'UTC')) BETWEEN 16 AND 18),
    'last_call_count',    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM (logged_at AT TIME ZONE 'UTC')) >= 1 OR EXTRACT(HOUR FROM (logged_at AT TIME ZONE 'UTC')) < 5),
    'early_bird_count',   COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM (logged_at AT TIME ZONE 'UTC')) BETWEEN 10 AND 15),
    'unique_countries_count', COUNT(DISTINCT location_country_code) FILTER (WHERE location_country_code IS NOT NULL),
    'weekly_limit',       COALESCE(v_weekly_limit, 0),
    'goal_updated_at',    v_goal_updated_at,
    'user_created_at',    v_created_at,
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
          COUNT(*) FILTER (WHERE drink_type NOT IN ('water', 'soft_drink', 'mocktail', 'non_alcoholic')) AS alcohol_count,
          COUNT(*) FILTER (WHERE drink_type = 'water') AS water_count,
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
