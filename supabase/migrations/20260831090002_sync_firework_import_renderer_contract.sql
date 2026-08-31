-- Launch-position parsing now lives in its own capture-affecting source file.
-- Keep sealed import evidence aligned with the deployed renderer sources.

create or replace function public.current_firework_import_renderer_contract_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.fireworks-engine.import-renderer.v1+sha256.ee7dee06a901d53e4f2b1d1b277d76b88a21d5fa798b20ec69ada9e936bf290e'::text;
$$;

revoke execute on function public.current_firework_import_renderer_contract_version()
  from public, anon, authenticated;
