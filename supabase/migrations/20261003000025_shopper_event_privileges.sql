-- Reassert the caller-bound analytics capabilities after the declaration is rebuilt.
revoke all on function public.track_event(text,uuid,jsonb,text,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.track_event(text,uuid,jsonb,text,jsonb) to authenticated, service_role;
revoke all on function private.track_event(text,uuid,jsonb,text,jsonb) from public, anon, authenticated, service_role;
grant execute on function private.track_event(text,uuid,jsonb,text,jsonb) to authenticated, service_role;
