-- Renderer extraction, explicit star layers and shared emission budgets change capture output.
-- Existing sealed import evidence must be rendered and validated again.
create or replace function public.current_firework_import_renderer_contract_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.fireworks-engine.import-renderer.v1+sha256.4029c44ca247f32860c90fc286575cda8a96a848edfae68c4cbea225fad7d2a4'::text;
$$;

comment on function public.current_firework_import_renderer_contract_version() is
  'Returns the renderer source fingerprint required for publishable firework import evidence.';
