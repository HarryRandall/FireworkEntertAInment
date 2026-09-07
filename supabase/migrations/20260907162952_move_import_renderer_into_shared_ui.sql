-- The replay canvas now lives in apps/web/ui. Paths and import bytes are
-- part of sealed renderer evidence even when rendering behaviour is unchanged.

create or replace function public.current_firework_import_renderer_contract_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.fireworks-engine.import-renderer.v1+sha256.6a785b7dce1801c47d4374a480ebe6e2333b675203333134fb760d7b954b9308'::text;
$$;

revoke execute on function public.current_firework_import_renderer_contract_version()
  from public, anon, authenticated;
