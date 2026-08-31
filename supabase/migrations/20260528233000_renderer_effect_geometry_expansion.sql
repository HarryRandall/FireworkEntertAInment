-- Add the Keystone reference effect families that were not yet represented in
-- the colourless base-effect catalogue. These names map directly to renderer
-- geometry and trail profiles rather than being flattened into generic bursts.

insert into public.firework_effects
  (slug, name, description, family, pattern_key, sort_order, source, model_json)
values
  (
    'pistil',
    'Pistil',
    'Nested inner-and-outer sphere with separate colours.',
    'aerial_burst',
    'pistil',
    65,
    'reference',
    '{"version":2,"geometry":"pistil","trailProfile":"spark","renderDefaults":{"pattern":"fibonacci","geometry":"pistil","trailProfile":"spark","size":240,"burst":{"speed":[2.0,3.8],"gravity":[-1.25,-0.18],"life":[0.7,4.6],"flairColorMode":"bombColor"},"flair":{"enabled":true},"pistil":{"enabled":true,"sizeRatio":0.36,"speedRatio":0.48},"crackle":{"enabled":false,"probability":0,"sound":"crackle"},"sound":{"boom":"auto"},"mortar":{"sound":true,"smokeParticles":110}}}'::jsonb
  ),
  (
    'pearls',
    'Pearls',
    'Large discrete glowing stars with little trail.',
    'aerial_burst',
    'pearls',
    75,
    'reference',
    '{"version":2,"geometry":"pearls","trailProfile":"pearls","renderDefaults":{"pattern":"wave","geometry":"pearls","trailProfile":"pearls","size":150,"burst":{"speed":[1.2,2.4],"gravity":[-1.15,-0.2],"life":[0.7,3.2],"flairColorMode":"bombColor"},"flair":{"enabled":false},"crackle":{"enabled":false,"probability":0,"sound":"crackle"},"sound":{"boom":"light"},"mortar":{"sound":true,"smokeParticles":85}}}'::jsonb
  ),
  (
    'tail',
    'Tail',
    'Bright ascending star with a tapered spark tail.',
    'ascending',
    'tail',
    92,
    'reference',
    '{"version":2,"geometry":"single_tail","trailProfile":"thick_tail","renderDefaults":{"pattern":"wave","geometry":"single_tail","trailProfile":"thick_tail","size":92,"liftVelocity":13,"burst":{"speed":[0.5,1.2],"gravity":[-0.65,-0.12],"life":[0.8,2.6],"flairColorMode":"bombColor"},"flair":{"enabled":true},"crackle":{"enabled":false,"probability":0,"sound":"crackle"},"sound":{"boom":"light"},"mortar":{"sound":true,"smokeParticles":60}}}'::jsonb
  ),
  (
    'silver-fish',
    'Silver Fish',
    'Small silver stars that swim and squirm after the break.',
    'aerial_burst',
    'silver-fish',
    125,
    'reference',
    '{"version":2,"geometry":"fish","trailProfile":"fish","renderDefaults":{"pattern":"wave","geometry":"fish","trailProfile":"fish","size":190,"burst":{"speed":[1.5,2.9],"gravity":[-0.7,-0.08],"life":[0.8,2.8],"flairColorMode":"bombColor"},"flair":{"enabled":true},"crackle":{"enabled":false,"probability":0,"sound":"crackle"},"sound":{"boom":"light"},"mortar":{"sound":true,"smokeParticles":90}}}'::jsonb
  ),
  (
    'waterfall',
    'Waterfall',
    'Curtain of long falling silver or gold embers.',
    'aerial_burst',
    'waterfall',
    130,
    'reference',
    '{"version":2,"geometry":"waterfall","trailProfile":"waterfall","renderDefaults":{"pattern":"wave","geometry":"waterfall","trailProfile":"waterfall","size":220,"liftVelocity":9,"burst":{"speed":[0.8,1.7],"gravity":[-0.45,-0.08],"life":[1.8,6.4],"flairColorMode":"bombColor"},"flair":{"enabled":true},"crackle":{"enabled":false,"probability":0,"sound":"crackle"},"sound":{"boom":"light"},"mortar":{"sound":true,"smokeParticles":95}}}'::jsonb
  ),
  (
    'whirl',
    'Whirl',
    'Spinning stars that carve bright curling trails.',
    'aerial_burst',
    'whirl',
    135,
    'reference',
    '{"version":2,"geometry":"whirl","trailProfile":"whirl","renderDefaults":{"pattern":"strobe","geometry":"whirl","trailProfile":"whirl","size":170,"burst":{"speed":[1.3,2.8],"gravity":[-0.85,-0.1],"life":[0.8,3.2],"flairColorMode":"mixed","flairSizeStrobe":[10,140]},"flair":{"enabled":true},"crackle":{"enabled":false,"probability":0,"sound":"crackle"},"sound":{"boom":"light"},"mortar":{"sound":true,"smokeParticles":90}}}'::jsonb
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  family = excluded.family,
  pattern_key = excluded.pattern_key,
  model_json = excluded.model_json,
  sort_order = excluded.sort_order,
  source = excluded.source,
  updated_at = now();

with variant_defaults as (
  select *
  from (
    values
      ('pistil', '#00e5ff', '#ffd166', 4.7, 210),
      ('pearls', '#ff3df2', '#00e5ff', 3.4, 150),
      ('tail', '#ffd166', '#ffffff', 2.8, 120),
      ('silver-fish', '#f5f7fa', '#00e5ff', 3.2, 170),
      ('waterfall', '#f5f7fa', '#ffd166', 6.6, 190),
      ('whirl', '#ffd166', '#ffffff', 3.0, 160)
  ) as defaults(effect_slug, primary_color, secondary_color, duration_seconds, height_meters)
)
insert into public.firework_variants (
  effect_id,
  slug,
  name,
  description,
  primary_color,
  secondary_color,
  color_palette,
  duration_seconds,
  height_meters,
  variant_json,
  render_overrides_json,
  source,
  confidence
)
select
  fe.id,
  fe.slug || '-default',
  fe.name || ' Default',
  'Default selectable variant for ' || fe.name || '.',
  vd.primary_color,
  vd.secondary_color,
  array[vd.primary_color, vd.secondary_color],
  vd.duration_seconds,
  vd.height_meters,
  jsonb_build_object(
    'shellType',
    case fe.slug
      when 'tail' then 'comet'
      when 'silver-fish' then 'comet'
      when 'waterfall' then 'willow'
      when 'whirl' then 'strobe'
      else 'crysanthemum'
    end,
    'spreadSize', 4.0,
    'starLifeMs', (vd.duration_seconds * 700)::integer,
    'color', vd.primary_color,
    'colorPalette', jsonb_build_array(vd.primary_color, vd.secondary_color),
    'glitter',
    case fe.slug
      when 'pearls' then 'none'
      when 'tail' then 'streamer'
      when 'waterfall' then 'willow'
      else 'medium'
    end,
    'pistil', fe.slug = 'pistil',
    'strobe', fe.slug = 'whirl'
  ),
  '{}'::jsonb,
  'catalogue',
  0.82
from public.firework_effects fe
join variant_defaults vd on vd.effect_slug = fe.slug
where not exists (
  select 1
  from public.firework_variants existing
  where existing.effect_id = fe.id
)
on conflict (slug) do nothing;
