-- Consumer previews now compress tall launches without changing burst timing.
-- Authored catalogue and import captures retain their original presentation.
-- Shared renderer source bytes changed, so existing evidence needs revalidation.
create or replace function public.current_firework_import_renderer_contract_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.fireworks-engine.import-renderer.v1+sha256.50b7ae73ce365a99491f9d6cad3b4b56e63b22148d47f26024c88ee28e965879'::text;
$$;

comment on function public.current_firework_import_renderer_contract_version() is
  'Returns the renderer source fingerprint required for publishable firework import evidence.';
