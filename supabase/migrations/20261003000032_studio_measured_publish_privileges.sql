-- Measured publication is restricted to authenticated callers with checked editor authority.
revoke all on function private.publish_measured_effect_version(uuid,jsonb,integer,numeric) from public, anon, authenticated, service_role;
revoke all on function public.publish_measured_effect_version(uuid,jsonb,integer,numeric) from public, anon, authenticated, service_role;
grant execute on function private.publish_measured_effect_version(uuid,jsonb,integer,numeric) to authenticated;
grant execute on function public.publish_measured_effect_version(uuid,jsonb,integer,numeric) to authenticated;
