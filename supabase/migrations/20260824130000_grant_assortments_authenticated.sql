-- Fix: 20260824120000_add_assortments.sql only granted table-level SELECT to
-- `anon`, never to `authenticated`. Supabase anonymous-auth sessions (the
-- kiosk's own no-account sessions) carry the Postgres role `authenticated`,
-- not `anon` — only genuinely session-less requests use `anon`. Without an
-- `authenticated` grant, every anon-signed-in kiosk request hit
-- "permission denied for table assortments" before row level security was
-- even consulted, since the coarse GRANT check happens first.
--
-- Matches the existing convention on catalogue_items/show_presets: broad
-- GRANT to `authenticated` (SELECT/INSERT/UPDATE), with RLS policies doing
-- the actual admin-only enforcement on writes. DELETE is only granted on
-- assortment_items, since that is the only row-level delete this feature
-- performs (app/actions/admin-assortments.ts has no delete-assortment
-- action).

grant select, insert, update on public.assortments to authenticated;
grant select, insert, update, delete on public.assortment_items to authenticated;
