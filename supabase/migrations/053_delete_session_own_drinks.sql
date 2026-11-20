-- ============================================================
-- DELETING A NIGHT OUT CAN DELETE YOUR OWN DRINKS TOO
--
-- Since 050, deleting a night out removed only the night out:
-- drink_logs.session_id is ON DELETE SET NULL, so every drink in
-- it turned into a separate entry in the feed. Most of the time
-- the host wants their drinks from that night gone as well.
--
-- delete_session_with_drinks now takes p_delete_own_drinks. When
-- true, the caller's own drinks in the night out are deleted
-- (their media is queued for cleanup by the 040 triggers). Other
-- members' drinks always stay in their own history: nobody can
-- delete someone else's drinks.
--
-- It defaults to false, so older app versions that call it with
-- p_session_id alone behave exactly as before.
-- ============================================================

-- Replace the one-argument version; keeping both would make a
-- call with only p_session_id ambiguous.
DROP FUNCTION IF EXISTS public.delete_session_with_drinks(uuid);

CREATE FUNCTION public.delete_session_with_drinks(
  p_session_id uuid,
  p_delete_own_drinks boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sessions
    WHERE id = p_session_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_delete_own_drinks THEN
    DELETE FROM public.drink_logs
    WHERE session_id = p_session_id AND user_id = v_uid;
  END IF;

  -- Everyone else's drinks are unlinked (ON DELETE SET NULL).
  DELETE FROM public.sessions WHERE id = p_session_id AND user_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_session_with_drinks(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_session_with_drinks(uuid, boolean) TO authenticated;
