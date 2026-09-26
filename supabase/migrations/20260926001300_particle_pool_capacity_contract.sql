-- Preserve live particles when the allocation cursor wraps or capacity is reached.
-- Import evidence must be revalidated against this corrected renderer.
create or replace function public.current_firework_import_renderer_contract_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.fireworks-engine.import-renderer.v1+sha256.c162988a69bff574e42d13fdd003a16d915efe60c66c4572833f4e5bf7663690'::text;
$$;

comment on function public.current_firework_import_renderer_contract_version() is
  'Returns the renderer source fingerprint required for publishable firework import evidence.';
