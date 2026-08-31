-- Moving the replay canvas changed the path included in the sealed renderer
-- fingerprint. Keep database validation aligned with the deployed sources.

create or replace function public.current_firework_import_renderer_contract_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.fireworks-engine.import-renderer.v1+sha256.5d15f52fdb8f8fe190be106ee4fb4b2116685694c85a22c65b59317df17fb8bb'::text;
$$;

revoke execute on function public.current_firework_import_renderer_contract_version()
  from public, anon, authenticated;
