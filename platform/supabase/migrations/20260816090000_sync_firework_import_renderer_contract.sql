-- Keep sealed import evidence aligned with the deployed FireworksEngine bytes.

create or replace function public.current_firework_import_renderer_contract_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.fireworks-engine.import-renderer.v1+sha256.f24d5b8e1e7ff87737d1ffe1ff05d9ac4a07b59f7ad1c03f0bb6e7ace1aa51ff'::text;
$$;

revoke execute on function public.current_firework_import_renderer_contract_version()
  from public, anon, authenticated;
