-- Ensure every colourless base effect has at least one concrete variant that
-- can be selected from product shot editing.

with variant_defaults as (
  select *
  from (
    values
      ('peony', '#00e5ff', '#8b5cf6', 'crysanthemum', 4.4, 1500, 5.0, 200),
      ('chrysanthemum', '#14fc56', '#ffd166', 'crysanthemum', 4.6, 1700, 5.5, 210),
      ('brocade', '#ffd166', '#ffffff', 'crysanthemum', 5.4, 2600, 6.5, 230),
      ('willow', '#ffd166', '#f5f7fa', 'willow', 5.0, 3400, 7.0, 220),
      ('palm', '#ffd166', '#00e5ff', 'palm', 4.0, 2300, 5.8, 210),
      ('ring', '#00e5ff', '#f5f7fa', 'ring', 4.2, 1500, 4.8, 200),
      ('crossette', '#ff3df2', '#00e5ff', 'crossette', 4.3, 1700, 5.2, 210),
      ('horsetail', '#ffd166', '#f5f7fa', 'horsetail', 4.6, 3100, 6.2, 210),
      ('comet', '#00e5ff', '#ffd166', 'comet', 2.2, 2200, 3.4, 160),
      ('mine', '#8b5cf6', '#00e5ff', 'comet', 3.2, 1500, 3.2, 120),
      ('strobe', '#ffffff', '#00e5ff', 'strobe', 4.5, 1700, 5.0, 220),
      ('crackle', '#ffd166', '#ff3df2', 'crackle', 4.8, 1600, 5.0, 210)
  ) as defaults(effect_slug, primary_color, secondary_color, shell_type, spread_size, star_life_ms, duration_seconds, height_meters)
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
    'shellType', vd.shell_type,
    'spreadSize', vd.spread_size,
    'starLifeMs', vd.star_life_ms,
    'starLifeVariation', 0.18,
    'starDensity', 1,
    'color', vd.primary_color,
    'colorPalette', jsonb_build_array(vd.primary_color, vd.secondary_color),
    'glitter', case
      when fe.slug in ('brocade', 'willow', 'palm', 'horsetail') then 'willow'
      when fe.slug in ('strobe', 'crackle', 'crossette') then 'medium'
      else 'light'
    end,
    'crackle', fe.slug = 'crackle',
    'strobe', fe.slug = 'strobe',
    'ring', fe.slug = 'ring',
    'crossette', fe.slug = 'crossette',
    'horsetail', fe.slug = 'horsetail'
  ),
  '{}'::jsonb,
  'catalogue',
  0.75
from public.firework_effects fe
join variant_defaults vd on vd.effect_slug = fe.slug
where not exists (
  select 1
  from public.firework_variants existing
  where existing.effect_id = fe.id
)
on conflict (slug) do nothing;
