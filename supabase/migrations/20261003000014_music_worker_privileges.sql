-- Feature results are writable only by trusted job workers.
revoke all on function public.install_music_result(uuid,text,smallint,text,jsonb,text,bigint,text,jsonb) from public, anon, authenticated, service_role;
revoke all on function private.install_music_result(uuid,text,smallint,text,jsonb,text,bigint,text,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.install_music_result(uuid,text,smallint,text,jsonb,text,bigint,text,jsonb), private.install_music_result(uuid,text,smallint,text,jsonb,text,bigint,text,jsonb) to service_role;
