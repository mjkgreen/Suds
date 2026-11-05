-- ============================================================
-- RESTORE pg_net
--
-- call_edge_function() (041) sends pushes and storage cleanup
-- through net.http_post(), but no migration ever installed pg_net;
-- it was enabled from the dashboard. Sometime between
-- 2026-10-21 01:35 and 2026-10-22 20:20 UTC it was removed. Since
-- then every call has failed inside call_edge_function's
-- EXCEPTION handler, which only raises a WARNING, so no push has
-- been sent and no storage cleanup has run, and nothing errored.
--
-- Installing it here so the dependency lives in the repo. pg_net
-- always creates its functions in the `net` schema; the WITH
-- SCHEMA only places the extension's own record.
--
-- Old notifications are not re-sent: the push trigger fires on
-- INSERT only, so pushes resume with the next new notification.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
