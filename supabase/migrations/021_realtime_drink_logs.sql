-- ============================================================
-- REALTIME: drink_logs
-- ============================================================
-- The Live Activity hook (src/hooks/useLiveActivity.ts) subscribes to
-- postgres_changes INSERT events on drink_logs to sync the widget count
-- and the in-app feed the moment the +1 intent's write lands.
--
-- postgres_changes only emits events for tables in the `supabase_realtime`
-- publication. No prior migration added drink_logs, so the channel
-- subscribed successfully but never received a single event — realtime
-- sync was silently dead. Idempotent so re-runs are safe.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'drink_logs'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.drink_logs;
  END IF;
END $$;
