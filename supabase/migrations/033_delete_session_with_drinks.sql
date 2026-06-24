-- RPC that lets the host hard-delete a session and all its drink_logs.
-- SECURITY DEFINER lets it bypass RLS on drink_logs so it can remove
-- drinks belonging to guest members as well.
CREATE OR REPLACE FUNCTION public.delete_session_with_drinks(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only the session host may call this
  IF NOT EXISTS (
    SELECT 1 FROM public.sessions
    WHERE id = p_session_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.drink_logs WHERE session_id = p_session_id;
  DELETE FROM public.sessions WHERE id = p_session_id AND user_id = auth.uid();
END;
$$;
