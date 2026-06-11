-- Show style preset picked in the new-show wizard. Drives the cue-generation
-- engine: 'beat_test' uses the deterministic beat planner, everything else
-- selects an LLM prompt variant.
alter table public.shows
  add column if not exists show_style text not null default 'signature';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shows_show_style_check'
  ) then
    alter table public.shows
      add constraint shows_show_style_check
      check (show_style in ('signature', 'cinematic', 'minimalist', 'beat_test'));
  end if;
end $$;
