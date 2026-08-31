-- Site width (feet) and allowed firework types from the new-show flow.
-- Width caps the number of launch positions used by cue generation;
-- firework_types constrains the catalogue offered to the choreographer.
alter table public.shows
  add column if not exists site_width_feet integer,
  add column if not exists firework_types text[];

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shows_site_width_feet_check'
  ) then
    alter table public.shows
      add constraint shows_site_width_feet_check
      check (site_width_feet is null or (site_width_feet between 5 and 2000));
  end if;
end $$;
