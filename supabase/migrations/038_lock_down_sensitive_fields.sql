-- ============================================================
-- LOCK DOWN SENSITIVE PROFILE FIELDS
--
-- profiles has a public SELECT policy (USING (true)), so every
-- column was readable by any authenticated user via the API —
-- including height, weight, birthdate, and displayed_badges.
-- RLS is row-level, not column-level, so the only way to make
-- these row-aware-private is to move them out of profiles into
-- dedicated tables with their own policies.
--
--   • height/weight/birthdate  → user_private_metrics (owner-only)
--   • displayed_badges         → user_badges (self + approved
--     viewers, via the can_view_user() helper from 037)
--
-- profiles keeps its public policy but now holds only public
-- fields (name, username, avatar, bio, is_private, tier), so all
-- existing `profiles!fk(*)` embeds keep working.
-- ============================================================

-- ── 1. Owner-only body metrics ───────────────────────────────
CREATE TABLE public.user_private_metrics (
  user_id     uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  height      numeric(5,2),
  height_unit text CHECK (height_unit IN ('cm', 'in')),
  weight      numeric(5,1),
  weight_unit text CHECK (weight_unit IN ('kg', 'lb')),
  birthdate   date,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_private_metrics ENABLE ROW LEVEL SECURITY;

-- Only the owner can ever see or touch these rows — no one else,
-- regardless of follow/approval status.
CREATE POLICY "own_metrics_select" ON public.user_private_metrics
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own_metrics_insert" ON public.user_private_metrics
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_metrics_update" ON public.user_private_metrics
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_metrics_delete" ON public.user_private_metrics
  FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_private_metrics TO authenticated;

-- ── 2. Badges (self + approved viewers) ──────────────────────
CREATE TABLE public.user_badges (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_ids  text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Visible to the owner, to anyone for a public account, and to
-- approved followers of a private account — same rule as the
-- rest of a profile's content (get_feed, stats).
CREATE POLICY "badges_select" ON public.user_badges
  FOR SELECT USING (public.can_view_user(auth.uid(), user_id));
CREATE POLICY "badges_insert" ON public.user_badges
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "badges_update" ON public.user_badges
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "badges_delete" ON public.user_badges
  FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_badges TO authenticated;

-- ── 3. Backfill from the existing columns ────────────────────
INSERT INTO public.user_private_metrics (user_id, height, height_unit, weight, weight_unit, birthdate)
SELECT id, height, height_unit, weight, weight_unit, birthdate
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_badges (user_id, badge_ids)
SELECT id, COALESCE(displayed_badges, '{}')
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- ── 4. New signups get companion rows ────────────────────────
-- Body from 027 with the two companion inserts appended. Runs as
-- SECURITY DEFINER so it writes past the new tables' RLS.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, subscription_tier)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'premium'
  );
  INSERT INTO public.user_private_metrics (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_badges (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 5. get_feed: source badges from user_badges ──────────────
-- Body identical to 037 except p.displayed_badges is replaced by
-- a LEFT JOIN on user_badges. Must run BEFORE dropping the column
-- so nothing references profiles.displayed_badges at drop time.
DROP FUNCTION IF EXISTS public.get_feed(uuid, int, int);

CREATE OR REPLACE FUNCTION public.get_feed(
  p_user_id uuid,
  p_limit   int DEFAULT 20,
  p_offset  int DEFAULT 0
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
  user_liked         boolean
) AS $$
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
    COALESCE(ul.user_liked, false) AS user_liked
  FROM public.drink_logs dl
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
    WHERE drink_log_id = dl.id AND user_id = p_user_id
    LIMIT 1
  ) ul ON true
  WHERE (
    (
      p_user_id = auth.uid()
      AND (
        dl.user_id = p_user_id
        OR dl.user_id IN (
          SELECT following_id FROM public.follows WHERE follower_id = p_user_id
        )
      )
    )
    OR (
      p_user_id <> auth.uid()
      AND dl.user_id = p_user_id
      AND public.can_view_user(auth.uid(), p_user_id)
    )
  )
  AND (dl.user_id = auth.uid() OR NOT public.is_blocked(auth.uid(), dl.user_id))
  ORDER BY dl.logged_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── 6. Drop the now-migrated columns ─────────────────────────
ALTER TABLE public.profiles
  DROP COLUMN height,
  DROP COLUMN height_unit,
  DROP COLUMN weight,
  DROP COLUMN weight_unit,
  DROP COLUMN birthdate,
  DROP COLUMN displayed_badges;
