-- Direct star counts, fountain rates and ground emission durations replace implicit scaling.
-- Revalidate sealed import evidence after deploying the matching renderer.
create or replace function public.current_firework_import_renderer_contract_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.fireworks-engine.import-renderer.v1+sha256.6d54362ec140033bb67a4195b038839a581aa30bdcf58986c2047e20c3e0470a'::text;
$$;

comment on function public.current_firework_import_renderer_contract_version() is
  'Returns the renderer source fingerprint required for publishable firework import evidence.';
