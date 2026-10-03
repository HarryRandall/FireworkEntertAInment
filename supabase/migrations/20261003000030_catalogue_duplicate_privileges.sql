-- Catalogue duplication checks the table-backed editor role in its private implementation.
revoke all on function private.duplicate_catalogue_item(text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.duplicate_catalogue_item(text, uuid) from public, anon, authenticated, service_role;
grant execute on function private.duplicate_catalogue_item(text, uuid) to authenticated;
grant execute on function public.duplicate_catalogue_item(text, uuid) to authenticated;
