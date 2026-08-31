-- Allow anonymous (logged-out) visitors to browse the public firework catalogue
-- and curated show templates. The /catalogue, /library and /library/[id] pages
-- and the /home community-templates section read these tables server-side with
-- the anon client, so SELECT policies must permit anon, not just authenticated
-- users. Admin write policies are left untouched.

-- show_presets: curated public show templates shown in /library and /home.
grant select on public.show_presets to anon;
-- Intentionally public: templates are browseable marketing/catalogue content.
drop policy if exists show_presets_read_authenticated on public.show_presets;
create policy show_presets_read_anyone on public.show_presets
  for select using (true);

-- fireworks: the public firework visual model used by catalogue and replay specs.
-- Intentionally public: firework specifications are browseable catalogue content.
drop policy if exists fireworks_select_authenticated on public.fireworks;
create policy fireworks_select_anyone on public.fireworks
  for select using (true);

-- catalogue_items: the selectable firework catalogue shown on /catalogue.
-- Intentionally public: the catalogue is browseable by logged-out visitors.
drop policy if exists catalogue_items_select_authenticated on public.catalogue_items;
create policy catalogue_items_select_anyone on public.catalogue_items
  for select using (true);

-- multishots: multi-shot firework groupings referenced by catalogue_items.
-- Intentionally public: multishot metadata is part of the browseable catalogue.
drop policy if exists multishots_select_authenticated on public.multishots;
create policy multishots_select_anyone on public.multishots
  for select using (true);

-- multishot_fireworks: the shot sequence rows backing multishot products.
-- Intentionally public: shot sequences are part of the browseable catalogue.
drop policy if exists multishot_fireworks_select_authenticated on public.multishot_fireworks;
create policy multishot_fireworks_select_anyone on public.multishot_fireworks
  for select using (true);
