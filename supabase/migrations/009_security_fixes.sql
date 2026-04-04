-- ============================================================
-- SECURITY FIXES
-- ============================================================

-- Fix: security_definer_view for profile_counts
-- Sets the view to use security_invoker = true so it runs with the privileges 
-- of the user invoking it rather than the user who created it
ALTER VIEW public.profile_counts SET (security_invoker = true);
ALTER VIEW public.profile_counts SET (security_invoker = true);
