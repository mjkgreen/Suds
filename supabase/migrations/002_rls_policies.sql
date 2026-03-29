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
