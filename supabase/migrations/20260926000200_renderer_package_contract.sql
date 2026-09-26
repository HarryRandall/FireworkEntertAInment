-- Renderer extraction, explicit star layers and shared emission budgets change capture output.
-- Existing sealed import evidence must be rendered and validated again.
create or replace function public.current_firework_import_renderer_contract_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.fireworks-engine.import-renderer.v1+sha256.822b2a0ddc97c3d9cd9a356c77c2bb3b8d2272bab028291f9312ebbc2c1c9563'::text;
$$;

comment on function public.current_firework_import_renderer_contract_version() is
  'Returns the renderer source fingerprint required for publishable firework import evidence.';
