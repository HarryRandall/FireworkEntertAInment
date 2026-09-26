-- Renderer extraction, explicit star layers and shared emission budgets change capture output.
-- Existing sealed import evidence must be rendered and validated again.
create or replace function public.current_firework_import_renderer_contract_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.fireworks-engine.import-renderer.v1+sha256.696058d7e332ae9e8523aa9ba15590d697d36cddb2fab56dc5524543dc5ee277'::text;
$$;

comment on function public.current_firework_import_renderer_contract_version() is
  'Returns the renderer source fingerprint required for publishable firework import evidence.';
