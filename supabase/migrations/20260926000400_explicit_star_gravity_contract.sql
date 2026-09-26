-- Star gravity now follows authored ranges and explicit multipliers without hidden jitter or floors.
-- Existing sealed import evidence must be rendered and validated again.
create or replace function public.current_firework_import_renderer_contract_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.fireworks-engine.import-renderer.v1+sha256.63446536c6bc18b7f7bbb230080d2f0cfa76148af0364639ea2c8831c43b872a'::text;
$$;

comment on function public.current_firework_import_renderer_contract_version() is
  'Returns the renderer source fingerprint required for publishable firework import evidence.';
