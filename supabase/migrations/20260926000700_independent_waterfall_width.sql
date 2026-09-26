-- Waterfall width is an explicit distance independent of star counts.
-- Revalidate sealed import evidence after deploying the matching renderer.
create or replace function public.current_firework_import_renderer_contract_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.fireworks-engine.import-renderer.v1+sha256.3e028324684c3ff8658cdf22b3d913ed8e165bd72a2baf75245294c65bb6ac3e'::text;
$$;

comment on function public.current_firework_import_renderer_contract_version() is
  'Returns the renderer source fingerprint required for publishable firework import evidence.';
