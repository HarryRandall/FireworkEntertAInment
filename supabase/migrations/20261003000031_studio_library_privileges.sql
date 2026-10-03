-- Catalogue editors share immutable parts through the fenced save function.
revoke all on public.studio_library_parts from anon, authenticated;
grant select on public.studio_library_parts to authenticated;
grant all on public.studio_library_parts to service_role;
revoke all on function private.save_studio_library_part(text, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.save_studio_library_part(text, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function private.save_studio_library_part(text, text, jsonb) to authenticated;
grant execute on function public.save_studio_library_part(text, text, jsonb) to authenticated;
