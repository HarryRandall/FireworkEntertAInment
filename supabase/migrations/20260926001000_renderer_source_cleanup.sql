-- Remove unused import reconstruction helpers from the fingerprinted source.
-- Rendering is unchanged, but sealed evidence must match the deployed source bytes.
create or replace function public.current_firework_import_renderer_contract_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.fireworks-engine.import-renderer.v1+sha256.0e082d12beda9643774b537afde34402e258656e95bc96859e3d560fc8ec3b5b'::text;
$$;

comment on function public.current_firework_import_renderer_contract_version() is
  'Returns the renderer source fingerprint required for publishable firework import evidence.';
