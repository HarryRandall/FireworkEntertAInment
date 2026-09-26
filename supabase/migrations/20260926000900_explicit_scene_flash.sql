-- Burst flash is explicit, lighting fades by elapsed time, and automatic sound is removed.
-- Revalidate sealed import evidence after deploying the matching renderer.
create or replace function public.current_firework_import_renderer_contract_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.fireworks-engine.import-renderer.v1+sha256.e482f62136432e0d4615e884067fe24227cfe484e45042fc1c3c684d830c0370'::text;
$$;

comment on function public.current_firework_import_renderer_contract_version() is
  'Returns the renderer source fingerprint required for publishable firework import evidence.';
