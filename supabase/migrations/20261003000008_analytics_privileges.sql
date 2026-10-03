-- Explicit analytics capabilities; clients receive only the authorised operations.
revoke all on public.events from public, anon, authenticated, service_role;
grant all on public.events to service_role;
-- Live-feed facts exclude shopper identities, visit keys and private properties.
grant select (id,occurred_at,type,organisation_id,store_id,qr_code_id,campaign_id,show_id,product_id) on public.events to authenticated;
revoke all on public.metrics_daily from public, anon, authenticated, service_role;
grant all on public.metrics_daily to service_role;
grant select on public.metrics_daily to authenticated;
revoke all on public.metrics_hourly from public, anon, authenticated, service_role;
grant all on public.metrics_hourly to service_role;
grant select on public.metrics_hourly to authenticated;
revoke all on public.saved_reports from public, anon, authenticated, service_role;
grant all on public.saved_reports to service_role;
grant select on public.saved_reports to authenticated;
grant insert, update, delete on public.saved_reports to authenticated;
revoke all on function public.track_event(text,uuid,jsonb,text,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.track_event(text,uuid,jsonb,text,jsonb) to authenticated, service_role;
revoke all on function private.track_event(text,uuid,jsonb,text,jsonb) from public, anon, authenticated, service_role;
grant execute on function private.track_event(text,uuid,jsonb,text,jsonb) to authenticated, service_role;
revoke all on function private.rollup_events(timestamptz,timestamptz) from public, anon, authenticated, service_role;
grant execute on function private.rollup_events(timestamptz,timestamptz) to service_role;
revoke all on function private.maintain_event_partitions(text) from public, anon, authenticated, service_role;
grant execute on function private.maintain_event_partitions(text) to service_role;
grant usage, select on sequence public.events_id_seq to service_role;
