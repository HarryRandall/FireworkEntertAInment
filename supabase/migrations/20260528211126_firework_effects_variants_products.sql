-- Split firework modelling into:
-- 1. colourless base effects (`firework_effects`)
-- 2. concrete firework variants (`firework_variants`)
-- 3. sold products (`products`) with ordered shots (`product_shots`)
--
-- This is intentionally additive. Existing shows still resolve through
-- product_shots.effect_spec_id while the app moves to product_shots.firework_variant_id.

create table if not exists public.firework_effects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  family text not null default 'aerial_burst',
  pattern_key text not null,
  model_json jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint firework_effects_family_check check (
    family in ('aerial_burst', 'ascending', 'ground', 'noise', 'compound')
  ),
  constraint firework_effects_source_check check (
    source in ('manual', 'reference', 'legacy_migrated', 'video_inferred', 'llm_generated')
  )
);

create table if not exists public.firework_variants (
  id uuid primary key default gen_random_uuid(),
  effect_id uuid not null references public.firework_effects(id) on delete restrict,
  source_effect_spec_id uuid unique references public.effect_specs(id) on delete set null,
  slug text not null unique,
  name text not null,
  description text,
  primary_color text,
  secondary_color text,
  color_palette text[] not null default '{}',
  caliber text,
  duration_seconds numeric,
  height_meters numeric,
  variant_json jsonb not null default '{}'::jsonb,
  render_overrides_json jsonb not null default '{}'::jsonb,
  source text not null default 'manual',
  confidence numeric not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint firework_variants_primary_color_check check (
    primary_color is null or primary_color ~* '^#[0-9a-f]{6}$'
  ),
  constraint firework_variants_secondary_color_check check (
    secondary_color is null or secondary_color ~* '^#[0-9a-f]{6}$'
  ),
  constraint firework_variants_duration_check check (
    duration_seconds is null or duration_seconds > 0
  ),
  constraint firework_variants_height_check check (
    height_meters is null or height_meters >= 0
  ),
  constraint firework_variants_confidence_check check (confidence >= 0 and confidence <= 1),
  constraint firework_variants_source_check check (
    source in ('manual', 'catalogue', 'legacy_migrated', 'video_inferred', 'llm_generated')
  )
);

alter table public.products
  add column if not exists product_kind text,
  add column if not exists product_metadata jsonb not null default '{}'::jsonb;

with shot_counts as (
  select product_id, count(*) as shot_count
  from public.product_shots
  group by product_id
)
update public.products p
set product_kind = case
  when lower(coalesce(p.subtype, '')) in ('assortment', 'reloadable shell kit', 'shell kit') then 'assortment'
  when lower(coalesce(p.subtype, '')) in ('cake', 'aerial rack', 'fanned aerial cake', 'zipper cake') then 'multi_shot'
  when coalesce(sc.shot_count, 0) > 1 then 'multi_shot'
  else 'single_shot'
end
from shot_counts sc
where sc.product_id = p.id
  and p.product_kind is null;

update public.products
set product_kind = coalesce(product_kind, 'single_shot')
where product_kind is null;

alter table public.products
  alter column product_kind set default 'single_shot',
  alter column product_kind set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_product_kind_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_product_kind_check check (
        product_kind in ('single_shot', 'multi_shot', 'assortment', 'cake', 'rack', 'shell_kit', 'fountain', 'other')
      );
  end if;
end $$;

alter table public.product_shots
  add column if not exists firework_variant_id uuid,
  add column if not exists tilt_degrees integer not null default 0,
  add column if not exists position_override_json jsonb,
  add column if not exists shot_notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_shots_firework_variant_id_fkey'
      and conrelid = 'public.product_shots'::regclass
  ) then
    alter table public.product_shots
      add constraint product_shots_firework_variant_id_fkey
      foreign key (firework_variant_id) references public.firework_variants(id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_shots_tilt_degrees_check'
      and conrelid = 'public.product_shots'::regclass
  ) then
    alter table public.product_shots
      add constraint product_shots_tilt_degrees_check check (tilt_degrees >= -90 and tilt_degrees <= 90);
  end if;
end $$;

create index if not exists firework_variants_effect_id_idx
  on public.firework_variants(effect_id);

create index if not exists firework_variants_source_effect_spec_id_idx
  on public.firework_variants(source_effect_spec_id);

create index if not exists product_shots_firework_variant_id_idx
  on public.product_shots(firework_variant_id);

create index if not exists products_product_kind_idx
  on public.products(product_kind);

insert into public.firework_effects
  (slug, name, description, family, pattern_key, sort_order, source, model_json)
values
  (
    'peony',
    'Peony',
    'Round burst of stars without persistent tails.',
    'aerial_burst',
    'peony',
    10,
    'reference',
    '{"version":1,"geometry":"sphere","trailProfile":"none","renderDefaults":{"pattern":"fibonacci","size":220,"burst":{"speed":[2.0,3.7],"gravity":[-1.35,-0.18],"life":[0.65,4.7],"flairColorMode":"bombColor"},"flair":{"enabled":false},"crackle":{"enabled":false,"probability":0,"sound":"crackle"},"sound":{"boom":"auto"},"mortar":{"sound":true,"smokeParticles":100}}}'::jsonb
  ),
  (
    'chrysanthemum',
    'Chrysanthemum',
    'Round flower burst with visible spark trails on the stars.',
    'aerial_burst',
    'chrysanthemum',
    20,
    'reference',
    '{"version":1,"geometry":"sphere","trailProfile":"spark","renderDefaults":{"pattern":"fibonacci","size":240,"burst":{"speed":[2.0,3.8],"gravity":[-1.45,-0.2],"life":[0.75,5.0],"flairColorMode":"bombColor"},"flair":{"enabled":true},"crackle":{"enabled":false,"probability":0,"sound":"crackle"},"sound":{"boom":"auto"},"mortar":{"sound":true,"smokeParticles":110}}}'::jsonb
  ),
  (
    'brocade',
    'Brocade',
    'Dense crown of glittering trailing stars that hang and fall.',
    'aerial_burst',
    'brocade',
    30,
    'reference',
    '{"version":1,"geometry":"crown","trailProfile":"glitter","renderDefaults":{"pattern":"wave","size":300,"burst":{"speed":[2.1,4.0],"gravity":[-0.9,-0.16],"life":[1.0,5.8],"flairColorMode":"bombColor"},"flair":{"enabled":true},"crackle":{"enabled":true,"probability":0.04,"sound":"lightBoom"},"sound":{"boom":"heavy"},"mortar":{"sound":true,"smokeParticles":135}}}'::jsonb
  ),
  (
    'willow',
    'Willow',
    'Long-burning stars that droop into a soft umbrella canopy.',
    'aerial_burst',
    'willow',
    40,
    'reference',
    '{"version":1,"geometry":"weeping","trailProfile":"long_hang","renderDefaults":{"pattern":"wave","size":280,"burst":{"speed":[1.6,3.2],"gravity":[-0.55,-0.08],"life":[1.4,6.5],"flairColorMode":"bombColor"},"flair":{"enabled":true},"crackle":{"enabled":false,"probability":0,"sound":"crackle"},"sound":{"boom":"auto"},"mortar":{"sound":true,"smokeParticles":125}}}'::jsonb
  ),
  (
    'palm',
    'Palm',
    'Few large arms with a rising trunk-like tail.',
    'aerial_burst',
    'palm',
    50,
    'reference',
    '{"version":1,"geometry":"radial_arms","trailProfile":"thick_tail","renderDefaults":{"pattern":"wave","size":170,"burst":{"speed":[2.5,4.6],"gravity":[-0.95,-0.14],"life":[1.0,5.2],"flairColorMode":"bombColor"},"flair":{"enabled":true},"crackle":{"enabled":false,"probability":0,"sound":"crackle"},"sound":{"boom":"auto"},"mortar":{"sound":true,"smokeParticles":120}}}'::jsonb
  ),
  (
    'ring',
    'Ring',
    'Stars arranged in a circular halo.',
    'aerial_burst',
    'ring',
    60,
    'reference',
    '{"version":1,"geometry":"ring","trailProfile":"none","renderDefaults":{"pattern":"fibonacci","size":190,"burst":{"speed":[2.0,3.7],"gravity":[-1.2,-0.18],"life":[0.65,4.3],"flairColorMode":"bombColor"},"flair":{"enabled":false},"crackle":{"enabled":false,"probability":0,"sound":"crackle"},"sound":{"boom":"light"},"mortar":{"sound":true,"smokeParticles":95}}}'::jsonb
  ),
  (
    'crossette',
    'Crossette',
    'Stars split into crossing fragments after the first break.',
    'aerial_burst',
    'crossette',
    70,
    'reference',
    '{"version":1,"geometry":"split_cross","trailProfile":"fragmenting","renderDefaults":{"pattern":"strobe","size":210,"burst":{"speed":[2.2,4.0],"gravity":[-1.3,-0.2],"life":[0.55,4.6],"flairColorMode":"bombColor","flairSizeStrobe":[10,150]},"flair":{"enabled":true},"crackle":{"enabled":true,"probability":0.05,"sound":"crackle"},"sound":{"boom":"auto"},"mortar":{"sound":true,"smokeParticles":110}}}'::jsonb
  ),
  (
    'horsetail',
    'Horsetail',
    'Soft asymmetric break where stars fall in a tail shape.',
    'aerial_burst',
    'horsetail',
    80,
    'reference',
    '{"version":1,"geometry":"falling_tail","trailProfile":"long_hang","renderDefaults":{"pattern":"wave","size":180,"burst":{"speed":[1.1,2.4],"gravity":[-0.45,-0.06],"life":[1.3,5.8],"flairColorMode":"bombColor"},"flair":{"enabled":true},"crackle":{"enabled":false,"probability":0,"sound":"crackle"},"sound":{"boom":"light"},"mortar":{"sound":true,"smokeParticles":100}}}'::jsonb
  ),
  (
    'comet',
    'Comet',
    'Single rising projectile with a bright tail and little or no burst.',
    'ascending',
    'comet',
    90,
    'reference',
    '{"version":1,"geometry":"single_tail","trailProfile":"thick_tail","renderDefaults":{"pattern":"wave","size":80,"burst":{"speed":[0.6,1.4],"gravity":[-0.5,-0.1],"life":[0.8,2.8],"flairColorMode":"bombColor"},"flair":{"enabled":true},"crackle":{"enabled":false,"probability":0,"sound":"crackle"},"sound":{"boom":"light"},"mortar":{"sound":true,"smokeParticles":65}}}'::jsonb
  ),
  (
    'mine',
    'Mine',
    'Ground-launched spray of stars that opens upward.',
    'ground',
    'mine',
    100,
    'reference',
    '{"version":1,"geometry":"upward_fan","trailProfile":"spray","renderDefaults":{"pattern":"wave","size":160,"liftVelocity":8,"shellLife":8,"burst":{"speed":[1.5,3.0],"gravity":[-1.0,-0.18],"life":[0.5,3.0],"flairColorMode":"mixed"},"flair":{"enabled":true},"crackle":{"enabled":false,"probability":0,"sound":"crackle"},"sound":{"boom":"light"},"mortar":{"sound":true,"smokeParticles":80}}}'::jsonb
  ),
  (
    'strobe',
    'Strobe',
    'Stars blink or pulse after break rather than glowing steadily.',
    'aerial_burst',
    'strobe',
    110,
    'reference',
    '{"version":1,"geometry":"sphere","trailProfile":"blink","renderDefaults":{"pattern":"strobe","size":240,"burst":{"speed":[2.0,3.7],"gravity":[-1.45,-0.22],"life":[0.55,4.8],"flairColorMode":"mixed","flairSizeStrobe":[10,150]},"flair":{"enabled":true},"crackle":{"enabled":false,"probability":0,"sound":"crackle"},"sound":{"boom":"heavy"},"mortar":{"sound":true,"smokeParticles":120}}}'::jsonb
  ),
  (
    'crackle',
    'Crackle',
    'Burst or tail with audible crackling fragments.',
    'noise',
    'crackle',
    120,
    'reference',
    '{"version":1,"geometry":"fragment_cloud","trailProfile":"crackle","renderDefaults":{"pattern":"strobe","size":260,"burst":{"speed":[2.2,4.0],"gravity":[-1.55,-0.24],"life":[0.5,4.3],"flairColorMode":"mixed","flairSizeStrobe":[10,150]},"flair":{"enabled":true},"crackle":{"enabled":true,"probability":0.1,"sound":"heavyBoom"},"sound":{"boom":"heavy"},"mortar":{"sound":true,"smokeParticles":130}}}'::jsonb
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

with inferred as (
  select
    es.*,
    case
      when lower(es.name || ' ' || es.slug || ' ' || es.type) like '%strobe%' then 'strobe'
      when lower(es.name || ' ' || es.slug || ' ' || es.type) like '%brocade%' then 'brocade'
      when lower(es.name || ' ' || es.slug || ' ' || es.type) like '%willow%' then 'willow'
      when lower(es.name || ' ' || es.slug || ' ' || es.type) like '%palm%' then 'palm'
      when lower(es.name || ' ' || es.slug || ' ' || es.type) like '%ring%' then 'ring'
      when lower(es.name || ' ' || es.slug || ' ' || es.type) like '%crossette%' then 'crossette'
      when lower(es.name || ' ' || es.slug || ' ' || es.type) like '%horse%' then 'horsetail'
      when lower(es.name || ' ' || es.slug || ' ' || es.type) like '%comet%' then 'comet'
      when lower(es.name || ' ' || es.slug || ' ' || es.type) like '%mine%' then 'mine'
      when es.spec_json ->> 'pattern' = 'strobe' then 'strobe'
      when es.spec_json ->> 'pattern' = 'wave' then 'chrysanthemum'
      else 'peony'
    end as effect_slug,
    case
      when jsonb_typeof(es.spec_json -> 'color') = 'string'
        and es.spec_json ->> 'color' ~* '^#[0-9a-f]{6}$'
        then lower(es.spec_json ->> 'color')
      when jsonb_typeof(es.spec_json -> 'color') = 'object'
        and es.spec_json #>> '{color,r}' is not null
        and es.spec_json #>> '{color,g}' is not null
        and es.spec_json #>> '{color,b}' is not null
        then concat(
          '#',
          lpad(to_hex(round(((es.spec_json #>> '{color,r}')::numeric) * 255)::integer), 2, '0'),
          lpad(to_hex(round(((es.spec_json #>> '{color,g}')::numeric) * 255)::integer), 2, '0'),
          lpad(to_hex(round(((es.spec_json #>> '{color,b}')::numeric) * 255)::integer), 2, '0')
        )
      else null
    end as inferred_primary_color
  from public.effect_specs es
)
insert into public.firework_variants (
  effect_id,
  source_effect_spec_id,
  slug,
  name,
  description,
  primary_color,
  duration_seconds,
  height_meters,
  variant_json,
  render_overrides_json,
  source,
  confidence
)
select
  fe.id,
  inferred.id,
  inferred.slug,
  inferred.name,
  inferred.description,
  inferred.inferred_primary_color,
  inferred.duration_seconds,
  inferred.height_meters,
  jsonb_build_object(
    'version', 1,
    'legacyEffectSpecId', inferred.id,
    'legacyEffectSlug', inferred.slug,
    'legacyEffectType', inferred.type
  ),
  inferred.spec_json,
  'legacy_migrated',
  inferred.confidence
from inferred
join public.firework_effects fe on fe.slug = inferred.effect_slug
on conflict (source_effect_spec_id) do update set
  effect_id = excluded.effect_id,
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description,
  primary_color = excluded.primary_color,
  duration_seconds = excluded.duration_seconds,
  height_meters = excluded.height_meters,
  variant_json = excluded.variant_json,
  render_overrides_json = excluded.render_overrides_json,
  source = excluded.source,
  confidence = excluded.confidence,
  updated_at = now();

update public.product_shots ps
set firework_variant_id = fv.id
from public.firework_variants fv
where fv.source_effect_spec_id = ps.effect_spec_id
  and ps.firework_variant_id is null;

alter table public.firework_effects enable row level security;
alter table public.firework_variants enable row level security;

drop policy if exists "firework_effects_select_authenticated" on public.firework_effects;
create policy "firework_effects_select_authenticated" on public.firework_effects
  for select using (auth.uid() is not null);

drop policy if exists "firework_effects_admin_modify" on public.firework_effects;
create policy "firework_effects_admin_modify" on public.firework_effects
  for all using (public.current_user_has_permission('admin.manage_catalogue'))
  with check (public.current_user_has_permission('admin.manage_catalogue'));

drop policy if exists "firework_variants_select_authenticated" on public.firework_variants;
create policy "firework_variants_select_authenticated" on public.firework_variants
  for select using (auth.uid() is not null);

drop policy if exists "firework_variants_admin_modify" on public.firework_variants;
create policy "firework_variants_admin_modify" on public.firework_variants
  for all using (public.current_user_has_permission('admin.manage_catalogue'))
  with check (public.current_user_has_permission('admin.manage_catalogue'));

drop trigger if exists firework_effects_set_updated_at on public.firework_effects;
create trigger firework_effects_set_updated_at before update on public.firework_effects
  for each row execute function public.set_updated_at();

drop trigger if exists firework_variants_set_updated_at on public.firework_variants;
create trigger firework_variants_set_updated_at before update on public.firework_variants
  for each row execute function public.set_updated_at();

comment on table public.firework_effects is
  'Colourless base firework effect patterns, for example peony, brocade, willow, crossette.';

comment on table public.firework_variants is
  'Concrete firework appearances based on a base effect. Colour, calibre, height, duration, and render overrides belong here.';

comment on column public.firework_effects.model_json is
  'Colourless pattern model and renderer defaults. Do not store product-specific colour here.';

comment on column public.firework_variants.render_overrides_json is
  'Variant-level renderer overrides applied on top of the base effect model.';

comment on column public.product_shots.firework_variant_id is
  'Preferred concrete firework variant for this product shot. effect_spec_id remains as a legacy fallback.';
