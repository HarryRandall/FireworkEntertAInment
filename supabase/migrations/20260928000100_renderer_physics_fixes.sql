-- Renderer physics fixes: sound no longer consumes visual randomness, short
-- fuses burst instead of expiring, playback runs on fixed steps, snapshot
-- restores never re-fire cues, and strobe/twinkle phases are seeded per star.
-- Import evidence must be revalidated against this renderer.
create or replace function public.current_firework_import_renderer_contract_version()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'showcrafter.fireworks-engine.import-renderer.v1+sha256.124a4e2ec7d9e671a806581629a974ba425a37fcd94660e1894b9ceb7f23a1aa'::text;
$$;

comment on function public.current_firework_import_renderer_contract_version() is
  'Returns the renderer source fingerprint required for publishable firework import evidence.';
