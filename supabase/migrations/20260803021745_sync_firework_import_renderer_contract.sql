-- Keep sealed import evidence aligned with the deployed FireworksEngine bytes.

create or replace function public.current_firework_import_renderer_contract_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.fireworks-engine.import-renderer.v1+sha256.90a37b6ccf746f598adfb0ad88efed910b2b699a063cf5cbd2b0f2f04773358f'::text;
$$;

revoke execute on function public.current_firework_import_renderer_contract_version()
  from public, anon, authenticated;
