-- Disabled colour settings now remain in compiled documents and resolve at simulation entry.
-- Existing sealed import evidence must be rendered and validated again.
create or replace function public.current_firework_import_renderer_contract_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.fireworks-engine.import-renderer.v1+sha256.59e6ace712fed858b6b9a2605577f4211d4cd72b850c0ba9ced080c86d984559'::text;
$$;

comment on function public.current_firework_import_renderer_contract_version() is
  'Returns the renderer source fingerprint required for publishable firework import evidence.';
