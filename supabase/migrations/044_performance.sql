-- ============================================================
-- DATABASE PERFORMANCE
--
-- The project runs on the smallest compute, so every bit of
-- per-request work counts. This migration:
--   1. Makes upsert_push_token a no-op when nothing changed, so
--      repeated registrations don't write rows (and WAL that
--      Realtime has to decode).
--   2. Evaluates auth.uid() once per query in RLS policies instead
--      of once per row, by wrapping it as (SELECT auth.uid())
--      (Supabase advisor: auth_rls_initplan).
--   3. Merges the two permissive SELECT policies on drink_logs and
--      on sessions into one each. Permissive policies are OR'd, so
--      this doesn't change who can see what; it just gives the
--      planner one expression (advisor: multiple_permissive_policies).
--   4. Indexes foreign keys that had no covering index, so deletes
--      of users/sessions don't scan the referencing tables
--      (advisor: unindexed_foreign_keys).
-- Policy bodies below are the live definitions with only the
-- auth.uid() wrapping (and, for 3, the OR) changed.
-- ============================================================

-- ── 1. No-op push token upserts ─────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_push_token(p_token text, p_platform text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.push_tokens (user_id, token, platform, updated_at)
  VALUES (auth.uid(), p_token, p_platform, now())
  ON CONFLICT (token)
  DO UPDATE SET
    user_id    = auth.uid(),
    platform   = EXCLUDED.platform,
    updated_at = now()
  WHERE push_tokens.user_id IS DISTINCT FROM auth.uid()
     OR push_tokens.platform IS DISTINCT FROM EXCLUDED.platform;
$$;

-- ── 2 & 3. RLS policies ─────────────────────────────────────
ALTER POLICY "reports_insert" ON public.content_reports
  WITH CHECK (((SELECT auth.uid()) = reporter_id));

ALTER POLICY "comments_delete" ON public.drink_comments
  USING (((SELECT auth.uid()) = user_id));

ALTER POLICY "comments_insert" ON public.drink_comments
  WITH CHECK ((((SELECT auth.uid()) = user_id) AND (NOT public.is_blocked((SELECT auth.uid()), ( SELECT dl.user_id
   FROM public.drink_logs dl
  WHERE (dl.id = drink_comments.drink_log_id))))));

ALTER POLICY "comments_select" ON public.drink_comments
  USING ((NOT public.is_blocked((SELECT auth.uid()), user_id)));

ALTER POLICY "likes_delete" ON public.drink_likes
  USING (((SELECT auth.uid()) = user_id));

ALTER POLICY "likes_insert" ON public.drink_likes
  WITH CHECK ((((SELECT auth.uid()) = user_id) AND (NOT public.is_blocked((SELECT auth.uid()), ( SELECT dl.user_id
   FROM public.drink_logs dl
  WHERE (dl.id = drink_likes.drink_log_id))))));

ALTER POLICY "likes_select" ON public.drink_likes
  USING ((NOT public.is_blocked((SELECT auth.uid()), user_id)));

ALTER POLICY "Drink logs visible to self and followers" ON public.drink_logs
  USING ((((user_id = (SELECT auth.uid())) OR (user_id IN ( SELECT follows.following_id
   FROM public.follows
  WHERE (follows.follower_id = (SELECT auth.uid())))))) OR (((session_id IS NOT NULL) AND (session_id IN ( SELECT sm.session_id
   FROM public.session_members sm
  WHERE (sm.user_id = (SELECT auth.uid())))))));

ALTER POLICY "Users can delete their own drink logs" ON public.drink_logs
  USING ((user_id = (SELECT auth.uid())));

ALTER POLICY "Users can insert their own drink logs" ON public.drink_logs
  WITH CHECK ((user_id = (SELECT auth.uid())));

ALTER POLICY "Users can update their own drink logs" ON public.drink_logs
  USING ((user_id = (SELECT auth.uid())));

ALTER POLICY "drink_tags_delete" ON public.drink_tags
  USING (((user_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
   FROM public.drink_logs dl
  WHERE ((dl.id = drink_tags.drink_log_id) AND (dl.user_id = (SELECT auth.uid())))))));

ALTER POLICY "drink_tags_insert" ON public.drink_tags
  WITH CHECK (((EXISTS ( SELECT 1
   FROM public.drink_logs dl
  WHERE ((dl.id = drink_tags.drink_log_id) AND (dl.user_id = (SELECT auth.uid()))))) AND (user_id <> (SELECT auth.uid())) AND (NOT public.is_blocked((SELECT auth.uid()), user_id))));

ALTER POLICY "drink_tags_select" ON public.drink_tags
  USING (((user_id = (SELECT auth.uid())) OR public.can_view_user((SELECT auth.uid()), ( SELECT dl.user_id
   FROM public.drink_logs dl
  WHERE (dl.id = drink_tags.drink_log_id)))));

ALTER POLICY "follow_requests_delete" ON public.follow_requests
  USING ((((SELECT auth.uid()) = requester_id) OR ((SELECT auth.uid()) = target_id)));

ALTER POLICY "follow_requests_insert" ON public.follow_requests
  WITH CHECK (((requester_id = (SELECT auth.uid())) AND (NOT public.is_blocked(requester_id, target_id)) AND ( SELECT profiles.is_private
   FROM public.profiles
  WHERE (profiles.id = follow_requests.target_id)) AND (NOT (EXISTS ( SELECT 1
   FROM public.follows
  WHERE ((follows.follower_id = follow_requests.requester_id) AND (follows.following_id = follow_requests.target_id)))))));

ALTER POLICY "follow_requests_select" ON public.follow_requests
  USING ((((SELECT auth.uid()) = requester_id) OR ((SELECT auth.uid()) = target_id)));

ALTER POLICY "Users can follow others" ON public.follows
  WITH CHECK (((follower_id = (SELECT auth.uid())) AND (NOT public.is_blocked(follower_id, following_id)) AND (NOT ( SELECT profiles.is_private
   FROM public.profiles
  WHERE (profiles.id = follows.following_id)))));

ALTER POLICY "Users can unfollow" ON public.follows
  USING ((follower_id = (SELECT auth.uid())));

ALTER POLICY "Users can delete their own goal" ON public.goals
  USING (((SELECT auth.uid()) = user_id));

ALTER POLICY "Users can insert their own goal" ON public.goals
  WITH CHECK (((SELECT auth.uid()) = user_id));

ALTER POLICY "Users can update their own goal" ON public.goals
  USING (((SELECT auth.uid()) = user_id));

ALTER POLICY "Users can view their own goal" ON public.goals
  USING (((SELECT auth.uid()) = user_id));

ALTER POLICY "in_app_notifications_delete" ON public.in_app_notifications
  USING (((SELECT auth.uid()) = user_id));

ALTER POLICY "in_app_notifications_select" ON public.in_app_notifications
  USING (((SELECT auth.uid()) = user_id));

ALTER POLICY "in_app_notifications_update" ON public.in_app_notifications
  USING (((SELECT auth.uid()) = user_id));

ALTER POLICY "notification_prefs_insert_own" ON public.notification_preferences
  WITH CHECK (((SELECT auth.uid()) = user_id));

ALTER POLICY "notification_prefs_select_own" ON public.notification_preferences
  USING (((SELECT auth.uid()) = user_id));

ALTER POLICY "notification_prefs_update_own" ON public.notification_preferences
  USING (((SELECT auth.uid()) = user_id));

ALTER POLICY "Users can update their own profile" ON public.profiles
  USING (((SELECT auth.uid()) = id));

ALTER POLICY "push_tokens_delete_own" ON public.push_tokens
  USING (((SELECT auth.uid()) = user_id));

ALTER POLICY "push_tokens_insert_own" ON public.push_tokens
  WITH CHECK (((SELECT auth.uid()) = user_id));

ALTER POLICY "push_tokens_select_own" ON public.push_tokens
  USING (((SELECT auth.uid()) = user_id));

ALTER POLICY "push_tokens_update_own" ON public.push_tokens
  USING (true)
  WITH CHECK (((SELECT auth.uid()) = user_id));

ALTER POLICY "session_invites_insert" ON public.session_invites
  WITH CHECK ((((SELECT auth.uid()) = inviter_id) AND (EXISTS ( SELECT 1
   FROM public.session_members sm
  WHERE ((sm.session_id = session_invites.session_id) AND (sm.user_id = (SELECT auth.uid())) AND (sm.role = 'host'::text))))));

ALTER POLICY "session_invites_select" ON public.session_invites
  USING ((((SELECT auth.uid()) = inviter_id) OR ((SELECT auth.uid()) = invitee_id)));

ALTER POLICY "session_invites_update" ON public.session_invites
  USING (((SELECT auth.uid()) = invitee_id));

ALTER POLICY "session_members_delete" ON public.session_members
  USING ((((SELECT auth.uid()) = user_id) AND (role = 'guest'::text)));

ALTER POLICY "session_members_insert" ON public.session_members
  WITH CHECK (((SELECT auth.uid()) = user_id));

ALTER POLICY "sessions_delete" ON public.sessions
  USING (((SELECT auth.uid()) = user_id));

ALTER POLICY "sessions_insert" ON public.sessions
  WITH CHECK (((SELECT auth.uid()) = user_id));

ALTER POLICY "sessions_select" ON public.sessions
  USING (((((SELECT auth.uid()) = user_id) OR (user_id IN ( SELECT follows.following_id
   FROM public.follows
  WHERE (follows.follower_id = (SELECT auth.uid())))))) OR ((id IN ( SELECT sm.session_id
   FROM public.session_members sm
  WHERE (sm.user_id = (SELECT auth.uid()))))));

ALTER POLICY "sessions_update" ON public.sessions
  USING (((SELECT auth.uid()) = user_id));

ALTER POLICY "badges_delete" ON public.user_badges
  USING ((user_id = (SELECT auth.uid())));

ALTER POLICY "badges_insert" ON public.user_badges
  WITH CHECK ((user_id = (SELECT auth.uid())));

ALTER POLICY "badges_select" ON public.user_badges
  USING (public.can_view_user((SELECT auth.uid()), user_id));

ALTER POLICY "badges_update" ON public.user_badges
  USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));

ALTER POLICY "blocks_delete" ON public.user_blocks
  USING (((SELECT auth.uid()) = blocker_id));

ALTER POLICY "blocks_insert" ON public.user_blocks
  WITH CHECK (((SELECT auth.uid()) = blocker_id));

ALTER POLICY "blocks_select" ON public.user_blocks
  USING (((SELECT auth.uid()) = blocker_id));

ALTER POLICY "own_metrics_delete" ON public.user_private_metrics
  USING ((user_id = (SELECT auth.uid())));

ALTER POLICY "own_metrics_insert" ON public.user_private_metrics
  WITH CHECK ((user_id = (SELECT auth.uid())));

ALTER POLICY "own_metrics_select" ON public.user_private_metrics
  USING ((user_id = (SELECT auth.uid())));

ALTER POLICY "own_metrics_update" ON public.user_private_metrics
  USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));

DROP POLICY "Drink logs visible to session members" ON public.drink_logs;
DROP POLICY "sessions_select_as_member" ON public.sessions;

ALTER POLICY "Drink logs visible to self and followers" ON public.drink_logs
  RENAME TO "Drink logs visible to self, followers and session members";

-- ── 4. Foreign key indexes ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_session_invites_inviter      ON public.session_invites (inviter_id);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_actor   ON public.in_app_notifications (actor_id);
CREATE INDEX IF NOT EXISTS idx_drink_likes_user             ON public.drink_likes (user_id);
CREATE INDEX IF NOT EXISTS idx_drink_comments_user          ON public.drink_comments (user_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter     ON public.content_reports (reporter_id);
