-- Launch speed and shell size are independent of star count and distribution.
-- Revalidate sealed import evidence after deploying the matching renderer.
create or replace function public.current_firework_import_renderer_contract_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.fireworks-engine.import-renderer.v1+sha256.f32ad4d4942a4bd99339dc594b37514e70e44c8920e7f3958465da1160702572'::text;
$$;

comment on function public.current_firework_import_renderer_contract_version() is
  'Returns the renderer source fingerprint required for publishable firework import evidence.';
