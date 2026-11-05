-- ============================================================
-- 043: Supabase security/performance advisor fixes
--
--   • Auth RLS Initialization Plan (public.profiles): the update policy
--     called auth.uid() once per row. Wrapping it in a sub-select lets
--     Postgres evaluate it once per statement. Same rule, same result.
--   • RLS Disabled in Public (public.spatial_ref_sys): PostGIS's reference
--     table sits in the API-exposed public schema. Turn RLS on with a
--     read-only policy (PostGIS reads it for SRID lookups, e.g. the
--     drink_logs location_geom trigger, so reads must keep working) and
--     take away API write access.
-- ============================================================

-- ── 1. profiles update policy ────────────────────────────────
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING ((SELECT auth.uid()) = id);

-- ── 2. spatial_ref_sys ───────────────────────────────────────
-- Nobody should edit SRID definitions through the API.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.spatial_ref_sys FROM anon, authenticated;

-- On Supabase the table is owned by supabase_admin, so the migration role
-- may not be allowed to enable RLS. Don't fail the migration over it: the
-- REVOKE above already closes the write path.
DO $$
BEGIN
  ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "spatial_ref_sys is readable" ON public.spatial_ref_sys;
  CREATE POLICY "spatial_ref_sys is readable"
    ON public.spatial_ref_sys FOR SELECT
    USING (true);
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'spatial_ref_sys: not owner, RLS left as is (writes already revoked)';
END;
$$;
