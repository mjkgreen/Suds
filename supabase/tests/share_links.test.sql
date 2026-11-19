-- Share links (051): privacy of the public preview, joining, follows,
-- notifications, revoke and expiry. Run with supabase/tests/run.sh.
\set ON_ERROR_STOP 1
SET client_min_messages = warning;
-- Users: host (public), phost (private host), g_pub, g_priv (private guest),
-- viewer, blk (blocked by viewer), newbie.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('00000000-0000-0000-0000-00000000000a','host@x','{"username":"host"}'),
 ('00000000-0000-0000-0000-00000000000b','phost@x','{"username":"phost"}'),
 ('00000000-0000-0000-0000-00000000000c','gpub@x','{"username":"gpub"}'),
 ('00000000-0000-0000-0000-00000000000d','gpriv@x','{"username":"gpriv"}'),
 ('00000000-0000-0000-0000-00000000000e','viewer@x','{"username":"viewer"}'),
 ('00000000-0000-0000-0000-00000000000f','blk@x','{"username":"blk"}'),
 ('00000000-0000-0000-0000-000000000010','newbie@x','{"username":"newbie"}');
UPDATE public.profiles SET onboarded = true, display_name = initcap(username);
UPDATE public.profiles SET is_private = true WHERE username IN ('phost','gpriv');

CREATE TEMP TABLE ids AS SELECT
 '00000000-0000-0000-0000-00000000000a'::uuid host, '00000000-0000-0000-0000-00000000000b'::uuid phost,
 '00000000-0000-0000-0000-00000000000c'::uuid gpub, '00000000-0000-0000-0000-00000000000d'::uuid gpriv,
 '00000000-0000-0000-0000-00000000000e'::uuid viewer, '00000000-0000-0000-0000-00000000000f'::uuid blk,
 '00000000-0000-0000-0000-000000000010'::uuid newbie;
GRANT SELECT ON ids TO anon, authenticated;
CREATE TEMP TABLE t (k text PRIMARY KEY, v text);
GRANT ALL ON t TO anon, authenticated;

-- Sessions: s1 hosted by host with gpub, gpriv, blk; s2 hosted by phost.
INSERT INTO public.sessions (id, user_id, title, started_at) VALUES
 ('10000000-0000-0000-0000-000000000001', (SELECT host FROM ids), 'Friday', now() - interval '1 hour'),
 ('10000000-0000-0000-0000-000000000002', (SELECT phost FROM ids), 'Private night', now() - interval '1 hour');
INSERT INTO public.session_members (session_id, user_id, role)
 SELECT '10000000-0000-0000-0000-000000000001', u, 'guest' FROM ids, unnest(ARRAY[gpub, gpriv, blk]) u;
-- Drinks: host 2 beers (+ water, ignored), gpub 1, gpriv 3, blk 4. Locations set to check they never leak.
INSERT INTO public.drink_logs (user_id, session_id, drink_type, quantity, location_name, location_lat, location_lng)
 SELECT host, '10000000-0000-0000-0000-000000000001'::uuid, 'beer', 2, 'Secret Bar', 1, 1 FROM ids UNION ALL
 SELECT host, '10000000-0000-0000-0000-000000000001'::uuid, 'water', 5, 'Secret Bar', 1, 1 FROM ids UNION ALL
 SELECT gpub, '10000000-0000-0000-0000-000000000001'::uuid, 'wine', 1, 'Secret Bar', 1, 1 FROM ids UNION ALL
 SELECT gpriv, '10000000-0000-0000-0000-000000000001'::uuid, 'beer', 3, 'Secret Bar', 1, 1 FROM ids UNION ALL
 SELECT blk, '10000000-0000-0000-0000-000000000001'::uuid, 'beer', 4, 'Secret Bar', 1, 1 FROM ids UNION ALL
 SELECT phost, '10000000-0000-0000-0000-000000000002'::uuid, 'beer', 6, NULL, NULL, NULL FROM ids;
INSERT INTO public.user_blocks (blocker_id, blocked_id) SELECT viewer, blk FROM ids;

CREATE FUNCTION pg_temp.act(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', coalesce(u::text, ''), false) $$;

-- ── Creating links ──
SET ROLE authenticated;
SELECT pg_temp.act((SELECT gpub FROM ids));
DO $$ BEGIN ASSERT (public.get_or_create_share_link('session', '10000000-0000-0000-0000-000000000001')->>'error') = 'not_host_of_active_session', 'guest cannot create'; END $$;
SELECT pg_temp.act((SELECT host FROM ids));
INSERT INTO t SELECT 's1', public.get_or_create_share_link('session', '10000000-0000-0000-0000-000000000001')->>'token';
DO $$ BEGIN ASSERT (SELECT v FROM t WHERE k='s1') = public.get_or_create_share_link('session', '10000000-0000-0000-0000-000000000001')->>'token', 'idempotent'; END $$;
DO $$ BEGIN ASSERT length((SELECT v FROM t WHERE k='s1')) = 12, 'token length'; END $$;
INSERT INTO t SELECT 'p', public.get_or_create_share_link('profile')->>'token';
SELECT pg_temp.act((SELECT phost FROM ids));
INSERT INTO t SELECT 's2', public.get_or_create_share_link('session', '10000000-0000-0000-0000-000000000002')->>'token';
-- Clients can't write the table directly.
DO $$ BEGIN
  BEGIN INSERT INTO public.share_links (kind, inviter_id) VALUES ('profile', auth.uid()); RAISE EXCEPTION 'direct insert allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
-- Only own links are readable.
DO $$ BEGIN ASSERT (SELECT count(*) FROM public.share_links) = 1, 'phost sees only own link'; END $$;
RESET ROLE;

-- ── Preview as signed-out visitor ──
SET ROLE anon; SELECT pg_temp.act(NULL);
DO $$ DECLARE p jsonb := public.get_share_preview((SELECT v FROM t WHERE k='s1')); BEGIN
  RAISE NOTICE 'anon preview: %', p;
  ASSERT p->>'kind' = 'session' AND (p->>'can_join')::boolean, 'joinable';
  ASSERT p->'session'->>'title' = 'Friday';
  -- host 2 + gpub 1 + blk 4 (public); gpriv's 3 and the water excluded.
  ASSERT (p->'session'->>'drink_total')::numeric = 7, 'anon total excludes private: ' || (p->'session'->>'drink_total');
  ASSERT jsonb_array_length(p->'session'->'members') = 4, 'anon sees all 4 members';
  ASSERT p->'session'->'members'->0->>'role' = 'host', 'host first';
  ASSERT p->'viewer' = 'null'::jsonb, 'no viewer ctx';
  ASSERT p::text NOT LIKE '%Secret Bar%' AND p::text NOT LIKE '%location%', 'no locations';
  ASSERT p->'inviter' ? 'id' AND NOT (p->'inviter' ? 'email'), 'safe inviter fields';
END $$;
-- Private host: name/title shown, their drinks not counted.
DO $$ DECLARE p jsonb := public.get_share_preview((SELECT v FROM t WHERE k='s2')); BEGIN
  ASSERT (p->'inviter'->>'is_private')::boolean, 'private flag';
  ASSERT (p->'session'->>'drink_total')::numeric = 0, 'private host drinks hidden';
END $$;
DO $$ BEGIN ASSERT public.get_share_preview('nope')->>'error' = 'not_found'; END $$;
-- Signed-out callers can't use the write RPCs.
DO $$ BEGIN
  BEGIN PERFORM public.join_session_via_link('x'); RAISE EXCEPTION 'anon join allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.get_or_create_share_link('profile'); RAISE EXCEPTION 'anon create allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
-- The tables aren't readable to anon at all.
DO $$ BEGIN
  BEGIN PERFORM 1 FROM public.share_links; RAISE EXCEPTION 'anon read allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

-- ── Preview as signed-in viewer who blocked blk ──
SET ROLE authenticated; SELECT pg_temp.act((SELECT viewer FROM ids));
DO $$ DECLARE p jsonb := public.get_share_preview((SELECT v FROM t WHERE k='s1')); BEGIN
  ASSERT (p->'session'->>'drink_total')::numeric = 3, 'blocked user drinks hidden: ' || (p->'session'->>'drink_total');
  ASSERT jsonb_array_length(p->'session'->'members') = 3, 'blocked member hidden';
  ASSERT p::text NOT LIKE '%"blk"%', 'blk absent';
  ASSERT p->'viewer'->>'follow_status' = 'none' AND NOT (p->'viewer'->>'is_member')::boolean;
END $$;
RESET ROLE;
-- Follower of a private guest sees their drinks.
INSERT INTO public.follows (follower_id, following_id) SELECT viewer, gpriv FROM ids;
SET ROLE authenticated; SELECT pg_temp.act((SELECT viewer FROM ids));
DO $$ BEGIN ASSERT (public.get_share_preview((SELECT v FROM t WHERE k='s1'))->'session'->>'drink_total')::numeric = 6, 'approved follower sees private drinks'; END $$;
RESET ROLE;
-- The blocked user (block made by viewer, so it applies both ways) on viewer's link: not_found.
SET ROLE authenticated; SELECT pg_temp.act((SELECT viewer FROM ids));
INSERT INTO t SELECT 'pv', public.get_or_create_share_link('profile')->>'token';
SELECT pg_temp.act((SELECT blk FROM ids));
DO $$ BEGIN
  ASSERT public.get_share_preview((SELECT v FROM t WHERE k='pv'))->>'error' = 'not_found', 'blocked: preview';
  ASSERT public.accept_share_invite((SELECT v FROM t WHERE k='pv'))->>'error' = 'not_found', 'blocked: accept';
END $$;
RESET ROLE;

-- ── Joining ──
SET ROLE authenticated; SELECT pg_temp.act((SELECT newbie FROM ids));
DO $$ DECLARE r jsonb := public.join_session_via_link((SELECT v FROM t WHERE k='s1')); BEGIN
  ASSERT r->>'my_role' = 'guest' AND r->>'session_id' = '10000000-0000-0000-0000-000000000001', 'joined: ' || r;
  ASSERT r->>'follow_status' = 'following', 'public host followed';
  -- Joining again is harmless.
  ASSERT public.join_session_via_link((SELECT v FROM t WHERE k='s1'))->>'my_role' = 'guest';
END $$;
DO $$ BEGIN ASSERT (public.get_share_preview((SELECT v FROM t WHERE k='s1'))->'viewer'->>'is_member')::boolean; END $$;
RESET ROLE;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM public.follows WHERE follower_id = (SELECT newbie FROM ids) AND following_id = (SELECT host FROM ids));
  ASSERT (SELECT count(*) FROM public.in_app_notifications WHERE user_id = (SELECT host FROM ids)) = 1, 'one notification, not two';
  ASSERT (SELECT type FROM public.in_app_notifications WHERE user_id = (SELECT host FROM ids)) = 'share_link_join';
  ASSERT (SELECT count(*) FROM net.calls WHERE body ? 'notification_id') >= 1, 'push queued';
END $$;
-- Private host: join sends a request.
SET ROLE authenticated; SELECT pg_temp.act((SELECT newbie FROM ids));
DO $$ BEGIN ASSERT public.join_session_via_link((SELECT v FROM t WHERE k='s2'))->>'error' IS NULL; END $$;
RESET ROLE;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM public.follow_requests WHERE requester_id = (SELECT newbie FROM ids) AND target_id = (SELECT phost FROM ids)), 'request sent';
  ASSERT NOT EXISTS (SELECT 1 FROM public.follows WHERE follower_id = (SELECT newbie FROM ids) AND following_id = (SELECT phost FROM ids)), 'no direct follow of private';
  ASSERT (SELECT context->>'follow_status' FROM public.in_app_notifications WHERE user_id = (SELECT phost FROM ids)) = 'requested';
  ASSERT (SELECT count(*) FROM public.in_app_notifications WHERE user_id = (SELECT phost FROM ids)) = 1;
END $$;
-- Ordinary follows still notify (quiet flag doesn't leak).
INSERT INTO public.follows (follower_id, following_id) SELECT gpub, viewer FROM ids;
DO $$ BEGIN ASSERT EXISTS (SELECT 1 FROM public.in_app_notifications WHERE user_id = (SELECT viewer FROM ids) AND type = 'follow'); END $$;
-- Hosting rule: phost hosts s2 and can't join s1.
SET ROLE authenticated; SELECT pg_temp.act((SELECT phost FROM ids));
DO $$ BEGIN ASSERT public.join_session_via_link((SELECT v FROM t WHERE k='s1'))->>'error' = 'hosting_active_session'; END $$;
-- Own link.
SELECT pg_temp.act((SELECT host FROM ids));
DO $$ BEGIN ASSERT public.join_session_via_link((SELECT v FROM t WHERE k='s1'))->>'error' = 'own_link'; END $$;
-- Profile link isn't joinable as a session.
SELECT pg_temp.act((SELECT gpub FROM ids));
DO $$ BEGIN ASSERT public.join_session_via_link((SELECT v FROM t WHERE k='p'))->>'error' = 'not_found'; END $$;
-- Profile invite: accept follows the inviter, notifies once.
SELECT pg_temp.act((SELECT newbie FROM ids));
DO $$ DECLARE r jsonb := public.accept_share_invite((SELECT v FROM t WHERE k='pv')); BEGIN
  ASSERT r->>'follow_status' = 'following', 'accept: ' || r;
  PERFORM public.accept_share_invite((SELECT v FROM t WHERE k='pv'));
END $$;
RESET ROLE;
DO $$ BEGIN ASSERT (SELECT count(*) FROM public.in_app_notifications WHERE user_id = (SELECT viewer FROM ids) AND type = 'invite_accepted') = 1; END $$;

-- ── Revoke ──
SET ROLE authenticated; SELECT pg_temp.act((SELECT gpub FROM ids));
SELECT public.revoke_share_link((SELECT v FROM t WHERE k='s1'));  -- not theirs: no-op
DO $$ BEGIN ASSERT public.get_share_preview((SELECT v FROM t WHERE k='s1'))->>'error' IS NULL, 'others cannot revoke'; END $$;
SELECT pg_temp.act((SELECT host FROM ids));
SELECT public.revoke_share_link((SELECT v FROM t WHERE k='s1'));
SELECT pg_temp.act((SELECT viewer FROM ids));
DO $$ BEGIN
  ASSERT public.get_share_preview((SELECT v FROM t WHERE k='s1'))->>'error' = 'revoked';
  ASSERT public.join_session_via_link((SELECT v FROM t WHERE k='s1'))->>'error' = 'revoked';
END $$;
-- A new link replaces the revoked one.
SELECT pg_temp.act((SELECT host FROM ids));
INSERT INTO t SELECT 's1b', public.get_or_create_share_link('session', '10000000-0000-0000-0000-000000000001')->>'token';
DO $$ BEGIN ASSERT (SELECT v FROM t WHERE k='s1b') <> (SELECT v FROM t WHERE k='s1'); END $$;
RESET ROLE;

-- ── Ended night out: preview for 24h more, join closed ──
UPDATE public.sessions SET ended_at = now() - interval '1 hour' WHERE id = '10000000-0000-0000-0000-000000000001';
SET ROLE anon; SELECT pg_temp.act(NULL);
DO $$ DECLARE p jsonb := public.get_share_preview((SELECT v FROM t WHERE k='s1b')); BEGIN
  ASSERT p->>'error' IS NULL AND NOT (p->>'can_join')::boolean AND p->'session'->>'ended_at' IS NOT NULL, 'ended preview: ' || p;
END $$;
RESET ROLE;
SET ROLE authenticated; SELECT pg_temp.act((SELECT viewer FROM ids));
DO $$ BEGIN
  ASSERT public.join_session_via_link((SELECT v FROM t WHERE k='s1b'))->>'error' = 'session_ended';
  ASSERT public.accept_share_invite((SELECT v FROM t WHERE k='s1b'))->>'follow_status' = 'following', 'follow host after end';
  ASSERT public.get_or_create_share_link('session', '10000000-0000-0000-0000-000000000001')->>'error' = 'not_host_of_active_session';
END $$;
RESET ROLE;
UPDATE public.sessions SET ended_at = now() - interval '25 hours' WHERE id = '10000000-0000-0000-0000-000000000001';
SET ROLE anon; SELECT pg_temp.act(NULL);
DO $$ BEGIN ASSERT public.get_share_preview((SELECT v FROM t WHERE k='s1b'))->>'error' = 'expired', 'expired after grace'; END $$;
RESET ROLE;

-- ── Never-ended night out: link stops after 24h, then preview after 48h ──
UPDATE public.share_links SET expires_at = now() - interval '1 hour', created_at = now() - interval '25 hours' WHERE session_id = '10000000-0000-0000-0000-000000000002';
SET ROLE authenticated; SELECT pg_temp.act((SELECT viewer FROM ids));
DO $$ BEGIN
  ASSERT public.join_session_via_link((SELECT v FROM t WHERE k='s2'))->>'error' = 'session_ended', 'stale link not joinable';
  ASSERT NOT (public.get_share_preview((SELECT v FROM t WHERE k='s2'))->>'can_join')::boolean;
END $$;
RESET ROLE;
UPDATE public.share_links SET expires_at = now() - interval '25 hours' WHERE token = (SELECT v FROM t WHERE k='s2');
SET ROLE anon; SELECT pg_temp.act(NULL);
DO $$ BEGIN ASSERT public.get_share_preview((SELECT v FROM t WHERE k='s2'))->>'error' = 'expired', 'never-ended link preview expires'; END $$;
RESET ROLE;
-- Host asking again gets a fresh link.
SET ROLE authenticated; SELECT pg_temp.act((SELECT phost FROM ids));
DO $$ BEGIN ASSERT public.get_or_create_share_link('session', '10000000-0000-0000-0000-000000000002')->>'token' <> (SELECT v FROM t WHERE k='s2'), 'fresh link'; END $$;
RESET ROLE;
SELECT 'all share link tests passed' AS result;
