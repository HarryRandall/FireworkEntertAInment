-- Product compositions, supplier listings and confirmed catalogue safety facts.
-- BEGIN GENERATED COMPOSITION SCHEMA
-- Generated from supabase/documents/composition.v1.json; use pnpm db:documents to refresh.
create or replace function private.composition_schema()
returns json
language sql
immutable
set search_path = ''
as $function$
  select $schema${"$schema":"http://json-schema.org/draft-07/schema#","title":"ShowCrafter product composition v1","type":"object","additionalProperties":false,"required":["tubes"],"properties":{"box":{"type":"object","additionalProperties":false,"required":["rows","cols","pitch_mm"],"properties":{"rows":{"type":"integer","minimum":1},"cols":{"type":"integer","minimum":1},"pitch_mm":{"type":"number","exclusiveMinimum":0}}},"tubes":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["i","letter","t_ms","angle_deg"],"properties":{"i":{"type":"integer","minimum":0},"letter":{"type":"string","pattern":"^[a-z]{1,2}$"},"t_ms":{"type":["integer","null"],"minimum":0},"angle_deg":{"type":"number","minimum":-90,"maximum":90},"pos":{"type":"array","items":{"type":"integer","minimum":0},"minItems":2,"maxItems":2},"seed":{"type":"integer","minimum":0,"maximum":4294967295}}}},"fuse_delay_ms":{"type":"integer","minimum":0}}}$schema$::json;
$function$;
comment on function private.composition_schema() is 'Returns the canonical v1 JSON Schema for database document validation.';
-- END GENERATED COMPOSITION SCHEMA

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, name text not null,
  kind text not null check (kind in ('single','cake','rocket_pack','candle','fountain','wheel','ground','pack')),
  status text not null default 'draft' check (status in ('draft','needs_review','published','archived')),
  current_version_id uuid, draft_version_id uuid,
  brand text, description text,
  calibre_mm smallint check (calibre_mm > 0), nec_grams numeric(8,1) check (nec_grams >= 0),
  min_safety_distance_m smallint check (min_safety_distance_m >= 0),
  noise_level smallint check (noise_level between 0 and 3),
  safety_supplied_by uuid references public.profiles(id),
  safety_supplier_id uuid,
  safety_confirmed_by uuid references public.profiles(id), safety_confirmed_at timestamptz,
  has_bangs boolean not null default false, has_crackle boolean not null default false, has_whistle boolean not null default false,
  shot_count smallint check (shot_count >= 0), duration_ms int check (duration_ms >= 0),
  apex_m numeric(5,1) check (apex_m >= 0), energy numeric(3,2) check (energy between 0 and 1),
  colours text[] not null default '{}', tags text[] not null default '{}',
  gtin text, created_by uuid references public.profiles(id), archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
create trigger set_updated_at before update on public.products
  for each row execute function private.set_updated_at();

create table public.product_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id), number int not null check (number > 0),
  status text not null default 'draft' check (status in ('draft','in_review','changes_requested','published','superseded','rejected')),
  composition jsonb not null, composition_schema smallint not null default 1 check (composition_schema = 1),
  summary jsonb not null default '{}' check (jsonb_typeof(summary) = 'object'), change_note text,
  source text not null default 'manual' check (source in ('manual','finale_import','video_import','supplier')),
  candidate_id uuid, author_id uuid references public.profiles(id),
  published_at timestamptz, published_by uuid references public.profiles(id),
  unique (product_id, number), unique (product_id, id),
  constraint product_composition_valid check (extensions.jsonb_matches_schema(private.composition_schema(), composition)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.product_versions enable row level security;
create trigger set_updated_at before update on public.product_versions
  for each row execute function private.set_updated_at();

create table public.product_version_effects (
  product_version_id uuid not null references public.product_versions(id),
  letter text not null check (letter ~ '^[a-z]{1,2}$'), effect_id uuid not null references public.effects(id),
  primary key (product_version_id, letter),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.product_version_effects enable row level security;
create trigger set_updated_at before update on public.product_version_effects
  for each row execute function private.set_updated_at();

create table public.pack_items (
  pack_id uuid not null references public.products(id), item_id uuid not null references public.products(id),
  quantity smallint not null check (quantity > 0), sort smallint not null default 0,
  primary key (pack_id, item_id), check (pack_id <> item_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pack_items enable row level security;
create trigger set_updated_at before update on public.pack_items
  for each row execute function private.set_updated_at();

create table public.product_markets (
  product_id uuid not null references public.products(id), market text not null references public.markets(code),
  legal_category text not null check (length(legal_category) > 0), min_age smallint check (min_age >= 0),
  allowed boolean not null default true,
  supplied_by uuid references public.profiles(id), supplier_id uuid,
  confirmed_by uuid references public.profiles(id), confirmed_at timestamptz,
  primary key (product_id, market),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.product_markets enable row level security;
create trigger set_updated_at before update on public.product_markets
  for each row execute function private.set_updated_at();

create table public.product_media (
  product_id uuid not null references public.products(id), media_id uuid not null references public.media(id),
  role text not null check (role in ('demo_video','photo','box_art','safety_sheet')),
  sort smallint not null default 0, primary key (product_id, media_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.product_media enable row level security;
create trigger set_updated_at before update on public.product_media
  for each row execute function private.set_updated_at();

create table public.suppliers (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  country text references public.markets(code), contact_email text, website text,
  price_list_format jsonb check (jsonb_typeof(price_list_format) = 'object'),
  status text not null default 'active' check (status in ('invited','active','paused','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.suppliers enable row level security;
create trigger set_updated_at before update on public.suppliers
  for each row execute function private.set_updated_at();

create table public.supplier_members (
  supplier_id uuid not null references public.suppliers(id), profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','member')), primary key (supplier_id, profile_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.supplier_members enable row level security;
create trigger set_updated_at before update on public.supplier_members
  for each row execute function private.set_updated_at();

create table public.supplier_products (
  id uuid primary key default gen_random_uuid(), supplier_id uuid not null references public.suppliers(id),
  product_id uuid references public.products(id), supplier_code text not null, name_raw text not null,
  cost_minor bigint check (cost_minor >= 0), currency char(3) check (currency ~ '^[A-Z]{3}$'),
  rrp_minor bigint check (rrp_minor >= 0), case_qty smallint check (case_qty > 0), gtin text,
  available boolean not null default true, last_import_id uuid,
  safety_facts jsonb not null default '{}' check (jsonb_typeof(safety_facts) = 'object'),
  supplied_by uuid references public.profiles(id),
  check ((cost_minor is null and rrp_minor is null) or currency is not null),
  unique (supplier_id, supplier_code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.supplier_products enable row level security;
create trigger set_updated_at before update on public.supplier_products
  for each row execute function private.set_updated_at();

comment on column public.product_versions.candidate_id is 'Nullable reference to public.design_candidates(id), the source reconstruction candidate.';
comment on column public.supplier_products.last_import_id is 'Nullable reference to public.imports(id), the most recent source price list.';
alter table public.products add constraint products_current_version_fk foreign key (id, current_version_id) references public.product_versions(product_id, id);
alter table public.products add constraint products_draft_version_fk foreign key (id, draft_version_id) references public.product_versions(product_id, id);
alter table public.products add constraint products_safety_supplier_fk foreign key (safety_supplier_id) references public.suppliers(id);
alter table public.product_markets add constraint product_markets_supplier_fk foreign key (supplier_id) references public.suppliers(id);
alter table public.media add constraint media_supplier_fk foreign key (supplier_id) references public.suppliers(id);
alter table public.poster_renders add constraint poster_product_version_fk foreign key (product_version_id) references public.product_versions(id);
alter table public.branding add constraint branding_logo_media_fk foreign key (logo_media_id) references public.media(id);
create trigger guard_history before update or delete on public.product_versions
  for each row execute function private.guard_version_history('product_id');
create unique index product_versions_open_draft_idx on public.product_versions(product_id) where status = 'draft';
create unique index product_versions_open_review_idx on public.product_versions(product_id) where status in ('in_review','changes_requested');
create index supplier_members_profile_idx on public.supplier_members(profile_id);
create index supplier_products_product_idx on public.supplier_products(product_id);
create index pack_items_item_idx on public.pack_items(item_id);
create index product_media_media_idx on public.product_media(media_id);

-- Returns active suppliers belonging to the active, non-anonymous caller.
create or replace function private.supplier_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select member.supplier_id from public.supplier_members as member
  join public.suppliers as supplier on supplier.id = member.supplier_id and supplier.status = 'active'
  join public.profiles as profile on profile.id = member.profile_id and profile.status = 'active'
  where member.profile_id = private.uid() and not private.is_anon() and not profile.is_anonymous;
$$;
comment on function private.supplier_ids() is 'Returns the active supplier memberships of the active non-anonymous request user.';

-- Refuses catalogue mutation by shoppers, retailer members and non-editor staff.
create or replace function private.require_catalogue_editor()
returns void
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict error
begin
  if coalesce(private.staff_role(), '') not in ('super_admin','catalogue_editor') then
    raise exception using errcode = '42501', message = 'Catalogue editor permission required';
  end if;
end;
$$;
comment on function private.require_catalogue_editor() is 'Raises insufficient_privilege unless the active caller has catalogue editing rights.';

-- Locks the containing draft before changing its letter bindings, preserving published composition history.
create or replace function private.guard_effect_binding()
returns trigger
language plpgsql
set search_path = ''
as $$
#variable_conflict error
declare
  version_status text;
  version_id uuid;
begin
  version_id := case when tg_op = 'DELETE' then old.product_version_id else new.product_version_id end;
  if tg_op = 'UPDATE' and new.product_version_id <> old.product_version_id then
    raise exception using errcode = '23514', message = 'Binding identity is immutable';
  end if;
  select status into version_status from public.product_versions where id = version_id for update;
  if version_status is distinct from 'draft' then
    raise exception using errcode = '23514', message = 'Version bindings are immutable outside a draft';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
comment on function private.guard_effect_binding() is 'Serialises binding writes against the containing draft; rejects updates or deletion of historical bindings.';
create trigger guard_binding before insert or update or delete on public.product_version_effects
  for each row execute function private.guard_effect_binding();

create policy products_select on public.products for select to anon, authenticated
  using (status = 'published' or (select private.staff_role()) is not null);
create policy product_versions_select on public.product_versions for select to anon, authenticated
  using ((select private.staff_role()) is not null or (status = 'published' and exists (
    select from public.products where products.id = product_id and products.status = 'published' and products.current_version_id = product_versions.id)));
create policy product_version_effects_select on public.product_version_effects for select to anon, authenticated
  using (exists (select from public.product_versions where product_versions.id = product_version_id));
create policy poster_renders_select on public.poster_renders for select to anon, authenticated
  using ((select private.staff_role()) is not null or (status = 'ready' and (
    exists (select from public.effect_versions where effect_versions.id = effect_version_id)
    or exists (select from public.product_versions where product_versions.id = product_version_id))));
create policy poster_renders_insert on public.poster_renders for insert to authenticated
  with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy poster_renders_update on public.poster_renders for update to authenticated
  using ((select private.staff_role()) in ('super_admin','catalogue_editor'))
  with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy media_select on public.media for select to authenticated
  using ((select private.staff_role()) is not null or supplier_id in (select private.supplier_ids())
    or organisation_id in (select private.org_ids('staff')));
create policy media_insert on public.media for insert to authenticated
  with check (uploaded_by = (select private.uid()) and ((select private.staff_role()) in ('super_admin','catalogue_editor')
    or (organisation_id is null and supplier_id in (select private.supplier_ids()))));
create policy pack_items_select on public.pack_items for select to anon, authenticated
  using ((select private.staff_role()) is not null or (exists (select from public.products where products.id = pack_id and products.status = 'published') and exists (select from public.products as item where item.id = item_id and item.status = 'published')));
create policy product_markets_select on public.product_markets for select to anon, authenticated
  using ((select private.staff_role()) is not null or (exists (select from public.products where products.id = product_id and products.status = 'published')));
create policy product_media_select on public.product_media for select to anon, authenticated
  using ((select private.staff_role()) is not null or (exists (select from public.products where products.id = product_id and products.status = 'published')));
create policy product_media_insert on public.product_media for insert to authenticated with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy product_media_update on public.product_media for update to authenticated using ((select private.staff_role()) in ('super_admin','catalogue_editor')) with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy product_media_delete on public.product_media for delete to authenticated using ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy suppliers_select on public.suppliers for select to authenticated using ((select private.staff_role()) is not null or id in (select private.supplier_ids()));
create policy suppliers_insert on public.suppliers for insert to authenticated with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy suppliers_update on public.suppliers for update to authenticated using ((select private.staff_role()) in ('super_admin','catalogue_editor')) with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy suppliers_delete on public.suppliers for delete to authenticated using ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy supplier_members_select on public.supplier_members for select to authenticated using ((select private.staff_role()) is not null or supplier_id in (select private.supplier_ids()));
create policy supplier_members_insert on public.supplier_members for insert to authenticated with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy supplier_members_update on public.supplier_members for update to authenticated using ((select private.staff_role()) in ('super_admin','catalogue_editor')) with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy supplier_members_delete on public.supplier_members for delete to authenticated using ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy supplier_products_select on public.supplier_products for select to authenticated using ((select private.staff_role()) is not null or supplier_id in (select private.supplier_ids()));
create policy supplier_products_insert on public.supplier_products for insert to authenticated with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy supplier_products_update on public.supplier_products for update to authenticated using ((select private.staff_role()) in ('super_admin','catalogue_editor')) with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy supplier_products_delete on public.supplier_products for delete to authenticated using ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create index products_colours_idx on public.products using gin(colours);
create index products_tags_idx on public.products using gin(tags);
create index products_duration_idx on public.products(duration_ms);
create index products_noise_level_idx on public.products(noise_level);
create index products_energy_idx on public.products(energy);

-- Applies a saved multiplicative control to one numeric field, preserving its units and schema bounds.
create or replace function private.adjusted_control(value numeric, document jsonb, control text, factor numeric, minimum numeric, maximum numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select least(maximum, greatest(minimum, value * power(factor, coalesce((document->'adjustments'->>control)::int, 0))));
$$;
comment on function private.adjusted_control(numeric,jsonb,text,numeric,numeric,numeric) is 'Returns a field scaled by its saved dimensionless adjustment level and clamped to the supplied bounds in the field units.';

-- Resolves climb-time controls in JSONB key order, matching the renderer after a stored document is read back.
create or replace function private.adjusted_climb_time(value numeric, document jsonb, control_scope text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
#variable_conflict error
declare
  -- Stored renderer control factors, dimensionless; schema bounds are seconds.
  height_factor constant numeric := 1.12;
  climb_factor constant numeric := 0.85;
  minimum_s constant numeric := 0.001;
  maximum_s constant numeric := 120;
  control record;
begin
  for control in select adjustment.key, adjustment.value::int as level from jsonb_each_text(coalesce(document->'adjustments','{}')) as adjustment loop
    if control.key = control_scope || '.height' then
      value := least(maximum_s,greatest(minimum_s,value * power(sqrt(height_factor),control.level)));
    elsif control.key = control_scope || '.climb' then
      value := least(maximum_s,greatest(minimum_s,value * power(climb_factor,control.level)));
    end if;
  end loop;
  return value;
end;
$$;
comment on function private.adjusted_climb_time(numeric,jsonb,text) is 'Returns climb duration in seconds after sequential height/climb adjustments and per-control schema clamps; respects stored JSONB key order.';

-- Maps a hex colour to the nearest catalogue palette swatch in RGB, a visual search approximation.
create or replace function private.colour_bucket(colour text)
returns text
language sql
immutable
set search_path = ''
as $$
  with swatches(name, hex) as (values
    ('red','#ff3b2f'), ('orange','#ff8a28'), ('gold','#ffd060'), ('silver','#ffffff'),
    ('green','#2ee6a0'), ('blue','#398cff'), ('purple','#8f7bff'), ('pink','#ff59b4')),
  source as (select decode(substr(colour, 2), 'hex') as rgb)
  select name from swatches cross join source
    order by power(get_byte(rgb,0) - get_byte(decode(substr(hex,2),'hex'),0), 2)
      + power(get_byte(rgb,1) - get_byte(decode(substr(hex,2),'hex'),1), 2)
      + power(get_byte(rgb,2) - get_byte(decode(substr(hex,2),'hex'),2), 2), name limit 1;
$$;
comment on function private.colour_bucket(text) is 'Returns the nearest named RGB palette swatch for a validated six-digit hex colour; used only for catalogue search.';

-- Bounds fountain height from the authored emitter, direction and acceleration, excluding drag which reduces ascent.
create or replace function private.fountain_apex(document jsonb)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
#variable_conflict error
declare
  -- Stored renderer adjustment factors, dimensionless, and schema limits in metres/second and cone units.
  speed_factor constant numeric := 1.1;
  cone_factor constant numeric := 1.25;
  max_speed_m_s constant numeric := 200;
  max_cone constant numeric := 4;
  -- Renderer spray lifetime scale: longest possible spark lasts this multiple of authored seconds.
  spray_life_scale constant numeric := 1.75;
  fountain jsonb := document#>'{ground,fountain}';
  acceleration_m_s2 numeric := (fountain->>'gravity_m_s2')::numeric;
  life_s numeric := (fountain->>'life_s')::numeric * spray_life_scale;
  upward_speed_m_s numeric;
  apex_time_s numeric;
begin
  -- A unit random direction has y <= 1; gerb speed is at most the authored speed.
  upward_speed_m_s := private.adjusted_control((fountain->>'speed_m_s')::numeric,document,'ground.height',speed_factor,0,max_speed_m_s)
    * greatest(0,(fountain#>>'{direction,1}')::numeric + private.adjusted_control((fountain->>'cone')::numeric,document,'ground.spray',cone_factor,0,max_cone));
  apex_time_s := case when acceleration_m_s2 > 0 then least(life_s,upward_speed_m_s / acceleration_m_s2) else life_s end;
  -- Ballistic displacement v*t - g*t^2/2 bounds the damped renderer trajectory over the full possible lifetime.
  return (fountain->>'height_m')::numeric + upward_speed_m_s * apex_time_s - acceleration_m_s2 * power(apex_time_s,2) / 2;
end;
$$;
comment on function private.fountain_apex(jsonb) is 'Returns a conservative fountain apex in metres above ground from a validated design, including emitter height, saved speed/cone adjustments and maximum spray lifetime; ignores drag.';

-- Derives catalogue search facts from a validated design; time starts at firing and distances are metres.
create or replace function private.effect_facts(document jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
#variable_conflict error
declare
  -- Control factors and bounds mirror the stored renderer adjustment definitions.
  height_factor constant numeric := 1.12;
  radius_factor constant numeric := 1.15;
  burn_factor constant numeric := 1.25;
  trail_factor constant numeric := 1.3;
  brightness_factor constant numeric := 1.2;
  star_factor constant numeric := 1.3;
  spark_factor constant numeric := 1.35;
  flash_factor constant numeric := 1.3;
  fountain_duration_factor constant numeric := 1.2;
  min_time_s constant numeric := 0.001;
  max_time_s constant numeric := 120;
  max_height_m constant numeric := 1000;
  max_radius_m constant numeric := 500;
  max_trail_s constant numeric := 20;
  max_particles constant numeric := 10000;
  max_brightness constant numeric := 10;
  -- Visible tail allowances and scales from the renderer's shotDuration, in seconds.
  shell_tail_s constant numeric := 0.4;
  comet_tail_s constant numeric := 1.8;
  wheel_tail_s constant numeric := 1.4;
  spinner_stagger_s constant numeric := 0.4;
  spinner_tail_s constant numeric := 0.8;
  crackle_tail_s constant numeric := 0.5;
  split_tail_s constant numeric := 0.8;
  pop_tail_s constant numeric := 0.7;
  trail_duration_scale constant numeric := 1.3;
  -- Unit conversion and visual pacing normalisation, not a renderer particle limit.
  milliseconds_per_second constant numeric := 1000;
  energy_full_scale constant numeric := 10000;
  -- Named noise levels are conservative visual/audio classifications, not measured decibels.
  quiet_noise constant int := 0;
  lift_noise constant int := 1;
  crackle_noise constant int := 2;
  report_noise constant int := 3;
  -- Renderer adjustment and timing defaults, counts and seconds respectively.
  min_adjusted_stars constant int := 3;
  rounding_offset constant numeric := 0.5;
  max_ground_count constant int := 500;
  large_comet_count constant int := 3;
  default_sequence_gap_s constant numeric := 0.5;
  default_split_life_s constant numeric := 0.7;
  kind text := document->>'kind';
  break_document jsonb;
  layer jsonb;
  modifier jsonb;
  ground jsonb;
  key_prefix text;
  duration_s numeric := 0;
  apex_m numeric := 0;
  launch_s numeric := 0;
  layer_life_s numeric;
  layer_trail_s numeric;
  modifier_tail_s numeric;
  star_count numeric;
  nominal_particles numeric := 0;
  weighted_stars numeric := 0;
  noise int := quiet_noise;
  tags text[] := array[kind];
  colours text[] := '{}';
  colour text;
  count_level int;
  ground_count int;
begin
  if document->'launch' <> 'null'::jsonb then
    apex_m := private.adjusted_control((document#>>'{launch,height_m}')::numeric, document, 'launch.height', height_factor, 0, max_height_m);
    launch_s := private.adjusted_climb_time((document#>>'{launch,time_s}')::numeric, document, 'launch');
    if kind = 'mine' then launch_s := 0; apex_m := 0; end if;
    tags := tags || (document#>>'{launch,tail}');
    if (document#>>'{sound,lift}')::numeric > 0 then noise := lift_noise; end if;
  end if;
  for break_document in select value from jsonb_array_elements(document->'breaks') loop
    if (break_document#>>'{core,enabled}')::boolean then
      colours := colours || private.colour_bucket(break_document#>>'{core,colour}');
      nominal_particles := nominal_particles + (break_document#>>'{core,count}')::numeric;
      if private.adjusted_control((break_document#>>'{core,flash}')::numeric, document, 'break.flash', flash_factor, 0, max_brightness) > 0
        and (document#>>'{sound,break}')::numeric > 0 then noise := report_noise; end if;
    end if;
    for layer in select value from jsonb_array_elements(break_document->'layers') loop
      key_prefix := 'layer.' || (layer->>'id') || '.';
      layer_life_s := private.adjusted_control((layer->>'life_s')::numeric, document, key_prefix || 'burn', burn_factor, min_time_s, max_time_s);
      layer_trail_s := private.adjusted_control((layer#>>'{trail,length_s}')::numeric, document, key_prefix || 'trail.length', trail_factor, min_time_s, max_trail_s);
      modifier_tail_s := 0;
      for modifier in select value from jsonb_array_elements(layer->'modifiers') loop
        tags := tags || (modifier->>'kind');
        modifier_tail_s := greatest(modifier_tail_s, case modifier->>'kind'
          when 'crackle' then crackle_tail_s when 'split' then split_tail_s
          when 'crossette' then split_tail_s when 'pop' then pop_tail_s else 0 end);
      end loop;
      -- Longest possible lifetime includes variance, spray decay and modifier children.
      duration_s := greatest(duration_s, (break_document->>'at_s')::numeric + (layer->>'delay_s')::numeric
        + layer_life_s * (1 + (layer->>'life_var')::numeric) + layer_trail_s * trail_duration_scale + modifier_tail_s);
      apex_m := greatest(apex_m, coalesce(private.adjusted_control((document#>>'{launch,height_m}')::numeric, document, 'launch.height', height_factor, 0, max_height_m),0)
        + private.adjusted_control((layer->>'radius_m')::numeric, document, key_prefix || 'size', radius_factor, 0, max_radius_m));
      if not (layer->>'hidden')::boolean then
        tags := tags || (layer->>'pattern');
        for colour in select jsonb_array_elements_text(case when jsonb_typeof(value->1) = 'array' then value->1 else jsonb_build_array(value->1) end)
          from jsonb_array_elements(layer#>'{colour,stops}') loop
          colours := colours || private.colour_bucket(colour);
        end loop;
        star_count := (layer->>'count')::numeric;
        if coalesce((document->'adjustments'->>(key_prefix || 'stars'))::int,0) <> 0 then
          -- JavaScript Math.round is floor(x + 0.5) for these non-negative counts.
          star_count := floor(private.adjusted_control(star_count, document, key_prefix || 'stars', star_factor, min_adjusted_stars, max_particles) + rounding_offset);
        end if;
        weighted_stars := weighted_stars + star_count * coalesce((select max(private.adjusted_control((value->>1)::numeric, document, key_prefix || 'brightness', brightness_factor, 0, max_brightness)) from jsonb_array_elements(layer->'brightness')),0);
        nominal_particles := nominal_particles + star_count * (1 + private.adjusted_control((layer#>>'{trail,sparks}')::numeric, document, key_prefix || 'trail.density', spark_factor, 0, max_particles));
      end if;
    end loop;
  end loop;
  if jsonb_array_length(document->'breaks') > 0 then duration_s := launch_s + greatest(duration_s,1) + shell_tail_s; end if;
  if document->'ground' <> 'null'::jsonb then
    ground := document->'ground'->(case when kind in ('comet','candle') then 'comets' else kind end);
    if kind in ('comet','candle','tourbillon') then
      launch_s := private.adjusted_climb_time((ground->>'time_s')::numeric, document, 'ground');
      apex_m := private.adjusted_control((ground->>'height_m')::numeric, document, 'ground.height', height_factor, min_time_s, max_height_m);
      duration_s := launch_s + case when kind = 'tourbillon' then wheel_tail_s else comet_tail_s end;
      ground_count := (ground->>'count')::int;
      count_level := coalesce((document->'adjustments'->>'ground.count')::int,0);
      ground_count := least(max_ground_count,greatest(1,ground_count + count_level * case when kind <> 'tourbillon' and ground_count > large_comet_count then 2 else 1 end));
      if ground->>'pattern' = 'sequence' then duration_s := duration_s + (ground_count - 1) * case when (ground->>'gap_s')::numeric = 0 then default_sequence_gap_s else (ground->>'gap_s')::numeric end; end if;
      if ground->'split' is not null and ground->'split' <> 'null'::jsonb then duration_s := duration_s + case when (ground#>>'{split,life_s}')::numeric = 0 then default_split_life_s else (ground#>>'{split,life_s}')::numeric end; end if;
      weighted_stars := ground_count;
    elsif kind = 'fountain' then
      duration_s := private.adjusted_control((ground->>'duration_s')::numeric, document, 'ground.duration', fountain_duration_factor, min_time_s, max_time_s) + (ground->>'life_s')::numeric + shell_tail_s;
      apex_m := private.fountain_apex(document);
      weighted_stars := (ground->>'rate_per_s')::numeric * (ground->>'life_s')::numeric;
    elsif kind = 'wheel' then
      duration_s := (ground->>'duration_s')::numeric + wheel_tail_s;
      apex_m := (ground->>'height_m')::numeric + (ground->>'radius_m')::numeric;
      weighted_stars := (ground->>'sparks')::numeric;
    elsif kind = 'spinner' then
      duration_s := (ground->>'duration_s')::numeric + (ground->>'count')::numeric * spinner_stagger_s + spinner_tail_s;
      weighted_stars := (ground->>'count')::numeric * (ground->>'sparks')::numeric;
    end if;
    for colour in select colour_value.document#>>'{}'
      from jsonb_path_query(ground, '$.** ? (@.type() == "string")') as colour_value(document)
      where (colour_value.document#>>'{}') ~ '^#[0-9a-fA-F]{6}$' loop colours := colours || private.colour_bucket(colour); end loop;
    nominal_particles := weighted_stars;
  end if;
  -- A mix gain does not create an event; tags come from authored effects, not enabled sound channels.
  if kind in ('comet','candle') and coalesce((ground->>'whistle')::boolean,false) then tags := tags || 'whistle'::text; end if;
  if 'crackle' = any(tags) and (document#>>'{sound,crackle}')::numeric > 0 then noise := greatest(noise,crackle_noise); end if;
  if 'whistle' = any(tags) and (document#>>'{sound,whistle}')::numeric > 0 then noise := greatest(noise,crackle_noise); end if;
  select coalesce(array_agg(distinct value order by value),'{}') into colours from unnest(colours) as value;
  select coalesce(array_agg(distinct value order by value),'{}') into tags from unnest(tags) as value;
  return jsonb_build_object('colours',colours,'tags',tags,'duration_ms',ceil(duration_s * milliseconds_per_second),
    'apex_m',round(apex_m,1),'noise_level',noise,'energy',least(1,round(weighted_stars / energy_full_scale,2)),
    'particles_peak',ceil(nominal_particles),'particles_peak_source','authored_estimate');
end;
$$;
comment on function private.effect_facts(jsonb) is 'Computes search colours, tags, conservative duration in ms, apex bound in metres, ordinal noise and visual energy from validated v1 fields. particles_peak is a nominal authored budget, not a measured simulation peak.';

-- Creates a numbered effect draft under a parent-row lock, optionally restoring an earlier version without rewriting it.
create or replace function private.create_effect_draft(p_effect_id uuid, p_slug text, p_name text, p_family text, p_design jsonb, p_renderer text, p_parent_version_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_effect_id uuid := p_effect_id;
  v_version_id uuid;
  next_number int;
  effect_kind text;
begin
  perform private.require_catalogue_editor();
  if v_effect_id is null then
    insert into public.effects(slug,name,family,kind,created_by)
      values (p_slug,p_name,p_family,p_design->>'kind',private.uid()) returning id into v_effect_id;
  end if;
  select kind into effect_kind from public.effects where id = v_effect_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Effect not found'; end if;
  if effect_kind <> p_design->>'kind' then raise exception using errcode = '23514', message = 'Effect kind must match its design'; end if;
  update public.effects set slug = p_slug, name = p_name, family = p_family where id = v_effect_id;
  select coalesce(max(version.number),0) + 1 into next_number from public.effect_versions as version where version.effect_id = v_effect_id;
  insert into public.effect_versions(effect_id,number,design,renderer,parent_version_id,author_id)
    values (v_effect_id,next_number,p_design,p_renderer,p_parent_version_id,private.uid()) returning id into v_version_id;
  update public.effects set draft_version_id = v_version_id where id = v_effect_id;
  return v_version_id;
end;
$$;
comment on function private.create_effect_draft(uuid, text, text, text, jsonb, text, uuid) is 'Creates a numbered effect draft under a parent-row lock, optionally restoring an earlier version without rewriting it.';

-- Creates a numbered effect draft under a parent-row lock, optionally restoring an earlier version without rewriting it.
create or replace function public.create_effect_draft(p_effect_id uuid, p_slug text, p_name text, p_family text, p_design jsonb, p_renderer text, p_parent_version_id uuid default null)
returns uuid
language sql
set search_path = ''
as $$ select private.create_effect_draft(p_effect_id, p_slug, p_name, p_family, p_design, p_renderer, p_parent_version_id); $$;
comment on function public.create_effect_draft(uuid, text, text, text, jsonb, text, uuid) is 'Creates a numbered effect draft under a parent-row lock, optionally restoring an earlier version without rewriting it.';

-- Autosaves only a matching effect draft; database JSON Schema validation applies to every writer.
create or replace function private.save_effect_draft(p_version_id uuid, p_design jsonb, p_renderer text, p_change_note text default null, p_checks jsonb default '{}', p_reference_media_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
begin
  perform private.require_catalogue_editor();
  update public.effect_versions as version set design = p_design, renderer = p_renderer, change_note = p_change_note, checks = p_checks, reference_media_id = p_reference_media_id
    where version.id = p_version_id and version.status = 'draft'
      and exists (select from public.effects where effects.id = version.effect_id and effects.kind = p_design->>'kind');
  if not found then raise exception using errcode = '23514', message = 'Matching effect draft required'; end if;
end;
$$;
comment on function private.save_effect_draft(uuid, jsonb, text, text, jsonb, uuid) is 'Autosaves only a matching effect draft; database JSON Schema validation applies to every writer.';

-- Autosaves only a matching effect draft; database JSON Schema validation applies to every writer.
create or replace function public.save_effect_draft(p_version_id uuid, p_design jsonb, p_renderer text, p_change_note text default null, p_checks jsonb default '{}', p_reference_media_id uuid default null)
returns void
language sql
set search_path = ''
as $$ select private.save_effect_draft(p_version_id, p_design, p_renderer, p_change_note, p_checks, p_reference_media_id); $$;
comment on function public.save_effect_draft(uuid, jsonb, text, text, jsonb, uuid) is 'Autosaves only a matching effect draft; database JSON Schema validation applies to every writer.';

-- Creates a numbered composed product draft and its letter bindings in one transaction under a parent-row lock.
create or replace function private.create_product_draft(p_product_id uuid, p_slug text, p_name text, p_kind text, p_composition jsonb, p_bindings jsonb, p_source text default 'manual')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_product_id uuid := p_product_id;
  v_version_id uuid;
  next_number int;
  product_kind text;
begin
  perform private.require_catalogue_editor();
  if jsonb_typeof(p_bindings) is distinct from 'object' then raise exception using errcode = '23514', message = 'Bindings must be a letter-to-effect object'; end if;
  if v_product_id is null then
    insert into public.products(slug,name,kind,created_by) values (p_slug,p_name,p_kind,private.uid()) returning id into v_product_id;
  end if;
  select kind into product_kind from public.products where id = v_product_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Product not found'; end if;
  if product_kind <> p_kind or p_kind = 'pack' then raise exception using errcode = '23514', message = 'Matching composed product kind required'; end if;
  update public.products set slug = p_slug, name = p_name where id = v_product_id;
  select coalesce(max(version.number),0) + 1 into next_number from public.product_versions as version where version.product_id = v_product_id;
  insert into public.product_versions(product_id,number,composition,source,author_id)
    values (v_product_id,next_number,p_composition,p_source,private.uid()) returning id into v_version_id;
  insert into public.product_version_effects(product_version_id,letter,effect_id)
    select v_version_id,key,value::uuid from jsonb_each_text(p_bindings);
  update public.products set draft_version_id = v_version_id where id = v_product_id;
  return v_version_id;
end;
$$;
comment on function private.create_product_draft(uuid, text, text, text, jsonb, jsonb, text) is 'Creates a numbered composed product draft and its letter bindings in one transaction under a parent-row lock.';

-- Creates a numbered composed product draft and its letter bindings in one transaction under a parent-row lock.
create or replace function public.create_product_draft(p_product_id uuid, p_slug text, p_name text, p_kind text, p_composition jsonb, p_bindings jsonb, p_source text default 'manual')
returns uuid
language sql
set search_path = ''
as $$ select private.create_product_draft(p_product_id, p_slug, p_name, p_kind, p_composition, p_bindings, p_source); $$;
comment on function public.create_product_draft(uuid, text, text, text, jsonb, jsonb, text) is 'Creates a numbered composed product draft and its letter bindings in one transaction under a parent-row lock.';

-- Autosaves the composition and complete letter bindings atomically, rejecting non-draft versions.
create or replace function private.save_product_draft(p_version_id uuid, p_composition jsonb, p_bindings jsonb, p_change_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
begin
  perform private.require_catalogue_editor();
  if jsonb_typeof(p_bindings) is distinct from 'object' then raise exception using errcode = '23514', message = 'Bindings must be a letter-to-effect object'; end if;
  perform 1 from public.product_versions where id = p_version_id and status = 'draft' for update;
  if not found then raise exception using errcode = '23514', message = 'Product draft required'; end if;
  delete from public.product_version_effects where product_version_id = p_version_id;
  insert into public.product_version_effects(product_version_id,letter,effect_id)
    select p_version_id,key,value::uuid from jsonb_each_text(p_bindings);
  update public.product_versions set composition = p_composition, change_note = p_change_note where id = p_version_id;
end;
$$;
comment on function private.save_product_draft(uuid, jsonb, jsonb, text) is 'Autosaves the composition and complete letter bindings atomically, rejecting non-draft versions.';

-- Autosaves the composition and complete letter bindings atomically, rejecting non-draft versions.
create or replace function public.save_product_draft(p_version_id uuid, p_composition jsonb, p_bindings jsonb, p_change_note text default null)
returns void
language sql
set search_path = ''
as $$ select private.save_product_draft(p_version_id, p_composition, p_bindings, p_change_note); $$;
comment on function public.save_product_draft(uuid, jsonb, jsonb, text) is 'Autosaves the composition and complete letter bindings atomically, rejecting non-draft versions.';

-- Derives composed product facts from current effect facts and tube offsets in milliseconds.
create or replace function private.product_facts(version_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with shots as (
    select tube, effect.* from public.product_versions as version
    cross join lateral jsonb_array_elements(version.composition->'tubes') as tube
    join public.product_version_effects as binding on binding.product_version_id = version.id and binding.letter = tube->>'letter'
    join public.effects as effect on effect.id = binding.effect_id
    where version.id = version_id
  ), aggregate_facts as (
    select count(*) as shot_count,
      coalesce(max(coalesce((tube->>'t_ms')::int,0) + duration_ms),0) as duration_ms,
      coalesce(max(apex_m),0) as apex_m, coalesce(max(noise_level),0) as noise_level,
      coalesce(avg((version.summary->>'energy')::numeric),0) as energy
    from shots join public.effect_versions as version on version.id = shots.current_version_id
  )
  select jsonb_build_object('shot_count',shot_count,'duration_ms',duration_ms,'apex_m',apex_m,'noise_level',noise_level,
    'energy',round(energy,2),'colours',array(select distinct unnest(colours) from shots order by 1),
    'tags',array(select distinct unnest(tags) from shots order by 1)) from aggregate_facts;
$$;
comment on function private.product_facts(uuid) is 'Returns current-effect search facts for a product composition: duration in ms from first firing, apex in metres, shot count, colour/tag unions, maximum noise and mean visual energy. Fuse ignition delay is excluded.';

-- Copies derived product facts while leaving supplier-confirmed safety noise untouched.
create or replace function private.write_product_facts(product_id uuid, facts jsonb)
returns void
language plpgsql
set search_path = ''
as $$
#variable_conflict error
declare
  -- Catalogue ordinal 3 denotes an audible report, distinct from the confirmed safety override.
  report_noise constant int := 3;
begin
  update public.products set shot_count = (facts->>'shot_count')::smallint, duration_ms = (facts->>'duration_ms')::int,
    apex_m = (facts->>'apex_m')::numeric, energy = (facts->>'energy')::numeric,
    colours = array(select jsonb_array_elements_text(facts->'colours')),
    tags = array(select jsonb_array_elements_text(facts->'tags')),
    has_crackle = (facts->'tags') ? 'crackle', has_whistle = (facts->'tags') ? 'whistle',
    has_bangs = (facts->>'noise_level')::int = report_noise
  where id = product_id;
end;
$$;
comment on function private.write_product_facts(uuid,jsonb) is 'Copies computed search facts to the product row; does not overwrite confirmed product safety noise.';

-- Validates tube identity, grid positions, kind semantics and complete published-effect bindings before publication.
create or replace function private.check_product_composition(version_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
#variable_conflict error
declare
  document jsonb;
  product_kind text;
  tube_count int;
begin
  select version.composition, product.kind into document, product_kind from public.product_versions as version
    join public.products as product on product.id = version.product_id where version.id = version_id;
  tube_count := jsonb_array_length(document->'tubes');
  if tube_count = 0 or product_kind = 'pack' or (product_kind in ('single','fountain','wheel','ground') and tube_count <> 1) then
    raise exception using errcode = '23514', message = 'Tube count does not match product kind';
  end if;
  if exists (select from jsonb_array_elements(document->'tubes') as tube
    group by tube->>'i' having count(*) > 1) then
    raise exception using errcode = '23514', message = 'Tube indices must be unique';
  end if;
  if exists (select from jsonb_array_elements(document->'tubes') as tube where
    (product_kind in ('rocket_pack','candle') and tube->'t_ms' <> 'null'::jsonb)
    or (product_kind not in ('rocket_pack','candle') and tube->'t_ms' = 'null'::jsonb)
    or (document ? 'box' and (tube->>'i')::int >= (document#>>'{box,rows}')::int * (document#>>'{box,cols}')::int)
    or (document ? 'box' and (tube ? 'pos') and (
      (tube#>>'{pos,0}')::int >= (document#>>'{box,rows}')::int
      or (tube#>>'{pos,1}')::int >= (document#>>'{box,cols}')::int))) then
    raise exception using errcode = '23514', message = 'Invalid tube timing or grid position';
  end if;
  if exists (select from jsonb_array_elements(document->'tubes') as tube where tube ? 'pos'
    group by tube->'pos' having count(*) > 1) then
    raise exception using errcode = '23514', message = 'Tube positions must be unique';
  end if;
  if exists (select from jsonb_array_elements(document->'tubes') as tube
    left join public.product_version_effects as binding on binding.product_version_id = version_id and binding.letter = tube->>'letter'
    left join public.effects as effect on effect.id = binding.effect_id
    where effect.status is distinct from 'published' or effect.current_version_id is null)
    or exists (select from public.product_version_effects as binding where binding.product_version_id = version_id
      and not exists (select from jsonb_array_elements(document->'tubes') as tube where tube->>'letter' = binding.letter)) then
    raise exception using errcode = '23514', message = 'Every tube letter needs exactly one published effect binding';
  end if;
end;
$$;
comment on function private.check_product_composition(uuid) is 'Rejects invalid tube counts, duplicate indices, incompatible nullable timing, positions outside the grid and missing or unused published effect bindings.';

-- Publishes the current effect draft, supersedes its predecessor without payload edits, and refreshes current product search facts atomically.
create or replace function private.publish_effect_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  version public.effect_versions;
  effect public.effects;
  facts jsonb;
  affected_product public.products;
begin
  perform private.require_catalogue_editor();
  -- Serialises catalogue publication so effect refresh and product publication use one lock order.
  perform pg_advisory_xact_lock(hashtextextended('catalogue.publication',0));
  select * into version from public.effect_versions where id = p_version_id;
  if not found then raise exception using errcode = 'P0002', message = 'Effect version not found'; end if;
  select * into effect from public.effects where id = version.effect_id for update;
  select * into version from public.effect_versions where id = p_version_id for update;
  if version.status <> 'draft' or effect.draft_version_id is distinct from version.id then
    raise exception using errcode = '23514', message = 'Current effect draft required';
  end if;
  facts := private.effect_facts(version.design);
  update public.effect_versions set status = 'superseded' where id = effect.current_version_id;
  update public.effect_versions set status = 'published', summary = facts, published_at = now(), published_by = private.uid() where id = version.id;
  update public.effects set status = 'published', current_version_id = version.id, draft_version_id = null, archived_at = null,
    colours = array(select jsonb_array_elements_text(facts->'colours')), tags = array(select jsonb_array_elements_text(facts->'tags')),
    duration_ms = (facts->>'duration_ms')::int, apex_m = (facts->>'apex_m')::numeric, noise_level = (facts->>'noise_level')::smallint
    where id = effect.id;
  -- Products play current effects. Refresh their search columns without changing historical version summaries.
  for affected_product in select product.* from public.products as product where product.status = 'published' and exists (
    select from public.product_version_effects as binding where binding.product_version_id = product.current_version_id and binding.effect_id = effect.id)
    order by product.id for update loop
    perform private.write_product_facts(affected_product.id,private.product_facts(affected_product.current_version_id));
  end loop;
  perform private.refresh_pack_facts();
end;
$$;
comment on function private.publish_effect_version(uuid) is 'Publishes the current effect draft, supersedes its predecessor without payload edits, and refreshes current product search facts atomically.';

-- Publishes the current effect draft, supersedes its predecessor without payload edits, and refreshes current product search facts atomically.
create or replace function public.publish_effect_version(p_version_id uuid)
returns void
language sql
set search_path = ''
as $$ select private.publish_effect_version(p_version_id); $$;
comment on function public.publish_effect_version(uuid) is 'Publishes the current effect draft, supersedes its predecessor without payload edits, and refreshes current product search facts atomically.';

-- Publishes a safety-confirmed product draft and its validated composition, superseding the previous version and copying derived facts in one transaction.
create or replace function private.publish_product_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  version public.product_versions;
  product public.products;
  facts jsonb;
begin
  perform private.require_catalogue_editor();
  perform pg_advisory_xact_lock(hashtextextended('catalogue.publication',0));
  select * into version from public.product_versions where id = p_version_id;
  if not found then raise exception using errcode = 'P0002', message = 'Product version not found'; end if;
  select * into product from public.products where id = version.product_id for update;
  select * into version from public.product_versions where id = p_version_id for update;
  if version.status <> 'draft' or product.draft_version_id is distinct from version.id then
    raise exception using errcode = '23514', message = 'Current product draft required';
  end if;
  perform private.check_product_safety(product.id);
  perform private.check_product_composition(version.id);
  facts := private.product_facts(version.id);
  update public.product_versions set status = 'superseded' where id = product.current_version_id;
  update public.product_versions set status = 'published', summary = facts, published_at = now(), published_by = private.uid() where id = version.id;
  update public.products set status = 'published', current_version_id = version.id, draft_version_id = null, archived_at = null where id = product.id;
  perform private.write_product_facts(product.id,facts);
  perform private.refresh_pack_facts();
end;
$$;
comment on function private.publish_product_version(uuid) is 'Publishes a safety-confirmed product draft and its validated composition, superseding the previous version and copying derived facts in one transaction.';

-- Publishes a safety-confirmed product draft and its validated composition, superseding the previous version and copying derived facts in one transaction.
create or replace function public.publish_product_version(p_version_id uuid)
returns void
language sql
set search_path = ''
as $$ select private.publish_product_version(p_version_id); $$;
comment on function public.publish_product_version(uuid) is 'Publishes a safety-confirmed product draft and its validated composition, superseding the previous version and copying derived facts in one transaction.';

-- Archives the effect without rewriting version history; refuses to break published catalogue dependencies.
create or replace function private.archive_effect(p_effect_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
begin
  perform private.require_catalogue_editor();
  perform pg_advisory_xact_lock(hashtextextended('catalogue.publication',0));
  if exists (select from public.product_version_effects as binding join public.products as product
    on product.current_version_id = binding.product_version_id where binding.effect_id = p_effect_id and product.status = 'published') then
    raise exception using errcode = '23514', message = 'Effect is used by a published product';
  end if;
  update public.effects set status = 'archived', archived_at = now() where id = p_effect_id;
  if not found then raise exception using errcode = 'P0002', message = 'Effect not found'; end if;
end;
$$;
comment on function private.archive_effect(uuid) is 'Archives the effect without rewriting version history; refuses to break published catalogue dependencies.';

-- Archives the effect without rewriting version history; refuses to break published catalogue dependencies.
create or replace function public.archive_effect(p_effect_id uuid)
returns void
language sql
set search_path = ''
as $$ select private.archive_effect(p_effect_id); $$;
comment on function public.archive_effect(uuid) is 'Archives the effect without rewriting version history; refuses to break published catalogue dependencies.';

-- Archives the product without rewriting version history; refuses to break published catalogue dependencies.
create or replace function private.archive_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
begin
  perform private.require_catalogue_editor();
  perform pg_advisory_xact_lock(hashtextextended('catalogue.publication',0));
  if exists (select from public.pack_items as item join public.products as pack on pack.id = item.pack_id
    where item.item_id = p_product_id and pack.status = 'published') then
    raise exception using errcode = '23514', message = 'Product is used by a published pack';
  end if;
  update public.products set status = 'archived', archived_at = now() where id = p_product_id;
  if not found then raise exception using errcode = 'P0002', message = 'Product not found'; end if;
end;
$$;
comment on function private.archive_product(uuid) is 'Archives the product without rewriting version history; refuses to break published catalogue dependencies.';

-- Archives the product without rewriting version history; refuses to break published catalogue dependencies.
create or replace function public.archive_product(p_product_id uuid)
returns void
language sql
set search_path = ''
as $$ select private.archive_product(p_product_id); $$;
comment on function public.archive_product(uuid) is 'Archives the product without rewriting version history; refuses to break published catalogue dependencies.';

-- Requires supplied and staff-confirmed physical safety and at least one confirmed enabled-market legal category.
create or replace function private.check_product_safety(product_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
#variable_conflict error
begin
  if not exists (select from public.products as product where product.id = product_id
    and product.min_safety_distance_m is not null and product.noise_level is not null
    and product.safety_supplied_by is not null and product.safety_confirmed_by is not null and product.safety_confirmed_at is not null)
    or not exists (select from public.product_markets as legal join public.markets as market on market.code = legal.market
      where legal.product_id = check_product_safety.product_id and legal.allowed and market.enabled
        and legal.supplied_by is not null and legal.confirmed_by is not null and legal.confirmed_at is not null) then
    raise exception using errcode = '23514', message = 'Confirmed physical safety and market legality required';
  end if;
end;
$$;
comment on function private.check_product_safety(uuid) is 'Refuses publication until supplier/admin safety facts and an enabled-market legal category have staff confirmation and source attribution.';

-- Refreshes published selection packs from the leaves upwards, so nested contents keep current search facts.
create or replace function private.refresh_pack_facts()
returns void
language plpgsql
set search_path = ''
as $$
#variable_conflict error
declare
  pack record;
  facts jsonb;
begin
  for pack in
    with recursive contents(root, item, depth) as (
      select pack_id,item_id,1 from public.pack_items
      union all
      select contents.root, item.item_id, contents.depth + 1 from contents
        join public.pack_items as item on item.pack_id = contents.item
    ) select product.id, max(contents.depth) as depth from public.products as product
      join contents on contents.root = product.id where product.kind = 'pack' and product.status = 'published'
      group by product.id order by depth, product.id
  loop
    select jsonb_build_object('shot_count',sum(item.quantity * product.shot_count),
      'duration_ms',sum(item.quantity * product.duration_ms), 'apex_m',max(product.apex_m),
      'noise_level',max(product.noise_level),'energy',round(sum(item.quantity * product.energy) / sum(item.quantity),2),
      'colours',array(select distinct unnest(product.colours) from public.pack_items as item join public.products as product on product.id = item.item_id where item.pack_id = pack.id order by 1),
      'tags',array(select distinct unnest(product.tags) from public.pack_items as item join public.products as product on product.id = item.item_id where item.pack_id = pack.id order by 1))
      into facts from public.pack_items as item join public.products as product on product.id = item.item_id where item.pack_id = pack.id;
    perform private.write_product_facts(pack.id,facts);
  end loop;
end;
$$;
comment on function private.refresh_pack_facts() is 'Refreshes current selection-pack facts in dependency order; quantity-weighted counts, total duration in ms, maximum apex in metres, union colours/tags and mean energy.';

-- Protects pack identity, draft-only contents and acyclic nesting even for elevated writers.
create or replace function private.guard_pack_item()
returns trigger
language plpgsql
set search_path = ''
as $$
#variable_conflict error
declare
  pack_id uuid;
begin
  pack_id := case when tg_op = 'DELETE' then old.pack_id else new.pack_id end;
  perform pg_advisory_xact_lock(hashtextextended('catalogue.publication',0));
  if tg_op = 'UPDATE' and new.pack_id <> old.pack_id then
    raise exception using errcode = '23514', message = 'Pack identity is immutable';
  end if;
  perform 1 from public.products where id = pack_id and kind = 'pack' and status = 'draft' for update;
  if not found then raise exception using errcode = '23514', message = 'Pack contents require a draft selection pack'; end if;
  if tg_op = 'DELETE' then return old; end if;
  if exists (with recursive descendants(id) as (
    select new.item_id union select item.item_id from public.pack_items as item join descendants on item.pack_id = descendants.id
  ) select from descendants where id = new.pack_id) then
    raise exception using errcode = '23514', message = 'Selection pack contents must not form a cycle';
  end if;
  return new;
end;
$$;
comment on function private.guard_pack_item() is 'Locks pack content writes, rejects non-pack or non-draft parents and prevents recursive selection-pack cycles.';
create trigger guard_pack before insert or update or delete on public.pack_items for each row execute function private.guard_pack_item();

-- Records supplied physical safety and complete market legality, with source attribution and the current staff confirmation, atomically.
create or replace function private.confirm_product_safety(p_product_id uuid, p_distance_m smallint, p_noise_level smallint, p_markets jsonb, p_supplier_id uuid default null, p_supplied_by uuid default null, p_calibre_mm smallint default null, p_nec_grams numeric default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  supplier_actor uuid := coalesce(p_supplied_by,private.uid());
begin
  perform private.require_catalogue_editor();
  perform pg_advisory_xact_lock(hashtextextended('catalogue.publication',0));
  perform 1 from public.products where id = p_product_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Product not found'; end if;
  if p_distance_m is null or p_noise_level is null or jsonb_typeof(p_markets) is distinct from 'array' or jsonb_array_length(p_markets) = 0 then
    raise exception using errcode = '23514', message = 'Physical safety and legal categories required';
  end if;
  if not exists (select from public.profiles as profile where profile.id = supplier_actor and profile.status = 'active' and not profile.is_anonymous)
    or (p_supplier_id is not null and not exists (select from public.supplier_members where supplier_id = p_supplier_id and profile_id = supplier_actor))
    or (p_supplier_id is null and not exists (select from public.staff_roles where profile_id = supplier_actor and role in ('super_admin','catalogue_editor'))) then
    raise exception using errcode = '23514', message = 'Safety source must be an active supplier member or catalogue editor';
  end if;
  update public.products set min_safety_distance_m = p_distance_m, noise_level = p_noise_level,
    calibre_mm = p_calibre_mm, nec_grams = p_nec_grams, safety_supplied_by = supplier_actor, safety_supplier_id = p_supplier_id,
    safety_confirmed_by = private.uid(), safety_confirmed_at = now() where id = p_product_id;
  delete from public.product_markets where product_id = p_product_id;
  insert into public.product_markets(product_id,market,legal_category,min_age,allowed,supplied_by,supplier_id,confirmed_by,confirmed_at)
    select p_product_id, fact->>'market', fact->>'legal_category', (fact->>'min_age')::smallint,
      coalesce((fact->>'allowed')::boolean,true),supplier_actor,p_supplier_id,private.uid(),now()
      from jsonb_array_elements(p_markets) as fact;
  if exists (select from public.products where id = p_product_id and status = 'published') then
    perform private.check_product_safety(p_product_id);
  end if;
  perform private.refresh_pack_facts();
end;
$$;
comment on function private.confirm_product_safety(uuid, smallint, smallint, jsonb, uuid, uuid, smallint, numeric) is 'Records supplied physical safety and complete market legality, with source attribution and the current staff confirmation, atomically.';

-- Records supplied physical safety and complete market legality, with source attribution and the current staff confirmation, atomically.
create or replace function public.confirm_product_safety(p_product_id uuid, p_distance_m smallint, p_noise_level smallint, p_markets jsonb, p_supplier_id uuid default null, p_supplied_by uuid default null, p_calibre_mm smallint default null, p_nec_grams numeric default null)
returns void
language sql
set search_path = ''
as $$ select private.confirm_product_safety(p_product_id, p_distance_m, p_noise_level, p_markets, p_supplier_id, p_supplied_by, p_calibre_mm, p_nec_grams); $$;
comment on function public.confirm_product_safety(uuid, smallint, smallint, jsonb, uuid, uuid, smallint, numeric) is 'Records supplied physical safety and complete market legality, with source attribution and the current staff confirmation, atomically.';

-- Creates a draft selection pack whose contents are product rows rather than tube compositions.
create or replace function private.create_pack(p_slug text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  pack_id uuid;
begin
  perform private.require_catalogue_editor();
  insert into public.products(slug,name,kind,created_by) values (p_slug,p_name,'pack',private.uid()) returning id into pack_id;
  return pack_id;
end;
$$;
comment on function private.create_pack(text, text) is 'Creates a draft selection pack whose contents are product rows rather than tube compositions.';

-- Creates a draft selection pack whose contents are product rows rather than tube compositions.
create or replace function public.create_pack(p_slug text, p_name text)
returns uuid
language sql
set search_path = ''
as $$ select private.create_pack(p_slug, p_name); $$;
comment on function public.create_pack(text, text) is 'Creates a draft selection pack whose contents are product rows rather than tube compositions.';

-- Replaces complete draft pack contents atomically, validating quantities, product foreign keys and cycles.
create or replace function private.save_pack_items(p_pack_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
begin
  perform private.require_catalogue_editor();
  perform pg_advisory_xact_lock(hashtextextended('catalogue.publication',0));
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception using errcode = '23514', message = 'Pack items must be an array'; end if;
  perform 1 from public.products where id = p_pack_id and kind = 'pack' and status = 'draft' for update;
  if not found then raise exception using errcode = '23514', message = 'Draft selection pack required'; end if;
  delete from public.pack_items where pack_id = p_pack_id;
  insert into public.pack_items(pack_id,item_id,quantity,sort)
    select p_pack_id,(item->>'item_id')::uuid,(item->>'quantity')::smallint,coalesce((item->>'sort')::smallint,0)
      from jsonb_array_elements(p_items) as item;
end;
$$;
comment on function private.save_pack_items(uuid, jsonb) is 'Replaces complete draft pack contents atomically, validating quantities, product foreign keys and cycles.';

-- Replaces complete draft pack contents atomically, validating quantities, product foreign keys and cycles.
create or replace function public.save_pack_items(p_pack_id uuid, p_items jsonb)
returns void
language sql
set search_path = ''
as $$ select private.save_pack_items(p_pack_id, p_items); $$;
comment on function public.save_pack_items(uuid, jsonb) is 'Replaces complete draft pack contents atomically, validating quantities, product foreign keys and cycles.';

-- Publishes a confirmed selection pack containing only published products and derives its search facts atomically.
create or replace function private.publish_pack(p_pack_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
begin
  perform private.require_catalogue_editor();
  perform pg_advisory_xact_lock(hashtextextended('catalogue.publication',0));
  perform 1 from public.products where id = p_pack_id and kind = 'pack' and status = 'draft' for update;
  if not found then raise exception using errcode = '23514', message = 'Draft selection pack required'; end if;
  perform private.check_product_safety(p_pack_id);
  if not exists (select from public.pack_items where pack_id = p_pack_id)
    or exists (select from public.pack_items as item join public.products as product on product.id = item.item_id
      where item.pack_id = p_pack_id and product.status <> 'published') then
    raise exception using errcode = '23514', message = 'Pack contents must be non-empty and published';
  end if;
  update public.products set status = 'published' where id = p_pack_id;
  perform private.refresh_pack_facts();
end;
$$;
comment on function private.publish_pack(uuid) is 'Publishes a confirmed selection pack containing only published products and derives its search facts atomically.';

-- Publishes a confirmed selection pack containing only published products and derives its search facts atomically.
create or replace function public.publish_pack(p_pack_id uuid)
returns void
language sql
set search_path = ''
as $$ select private.publish_pack(p_pack_id); $$;
comment on function public.publish_pack(uuid) is 'Publishes a confirmed selection pack containing only published products and derives its search facts atomically.';

-- Updates canonical product descriptions and barcode without changing confirmed safety or derived search facts.
create or replace function private.save_product_details(p_product_id uuid, p_brand text, p_description text, p_gtin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
begin
  perform private.require_catalogue_editor();
  update public.products set brand = p_brand, description = p_description, gtin = p_gtin where id = p_product_id;
  if not found then raise exception using errcode = 'P0002', message = 'Product not found'; end if;
end;
$$;
comment on function private.save_product_details(uuid, text, text, text) is 'Updates canonical product descriptions and barcode without changing confirmed safety or derived search facts.';

-- Updates canonical product descriptions and barcode without changing confirmed safety or derived search facts.
create or replace function public.save_product_details(p_product_id uuid, p_brand text, p_description text, p_gtin text)
returns void
language sql
set search_path = ''
as $$ select private.save_product_details(p_product_id, p_brand, p_description, p_gtin); $$;
comment on function public.save_product_details(uuid, text, text, text) is 'Updates canonical product descriptions and barcode without changing confirmed safety or derived search facts.';

-- Updates effect library metadata without changing the renderer document, lifecycle or derived search facts.
create or replace function private.save_effect_details(p_effect_id uuid, p_name text, p_family text, p_is_template boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
begin
  perform private.require_catalogue_editor();
  update public.effects set name = p_name, family = p_family, is_template = p_is_template where id = p_effect_id;
  if not found then raise exception using errcode = 'P0002', message = 'Effect not found'; end if;
end;
$$;
comment on function private.save_effect_details(uuid, text, text, boolean) is 'Updates effect library metadata without changing the renderer document, lifecycle or derived search facts.';

-- Updates effect library metadata without changing the renderer document, lifecycle or derived search facts.
create or replace function public.save_effect_details(p_effect_id uuid, p_name text, p_family text, p_is_template boolean)
returns void
language sql
set search_path = ''
as $$ select private.save_effect_details(p_effect_id, p_name, p_family, p_is_template); $$;
comment on function public.save_effect_details(uuid, text, text, boolean) is 'Updates effect library metadata without changing the renderer document, lifecycle or derived search facts.';

-- Copies catalogue content into a new draft without carrying confirmed safety or publication.
create or replace function private.duplicate_catalogue_item(p_kind text, p_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  source_effect public.effects;
  source_product public.products;
  effect_version public.effect_versions;
  product_version public.product_versions;
  new_version uuid;
  new_parent uuid;
  bindings jsonb;
  contents jsonb;
  copy_slug text;
begin
  perform private.require_catalogue_editor();
  -- Match catalogue publication's lock order before locking source parents or pack contents.
  perform pg_advisory_xact_lock(hashtextextended('catalogue.publication',0));
  copy_slug := 'copy-' || extensions.gen_random_uuid()::text;
  if p_kind = 'effect' then
    select * into source_effect from public.effects where id = p_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'Effect not found'; end if;
    select * into effect_version from public.effect_versions
      where id = coalesce(source_effect.draft_version_id, source_effect.current_version_id) for update;
    if not found then raise exception using errcode = '23514', message = 'Effect has no version to duplicate'; end if;
    new_version := private.create_effect_draft(null, copy_slug, source_effect.name || ' copy',
      source_effect.family, effect_version.design, effect_version.renderer);
    select effect_id into new_parent from public.effect_versions where id = new_version;
  elsif p_kind = 'product' then
    select * into source_product from public.products where id = p_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'Product not found'; end if;
    if source_product.kind = 'pack' then
      new_parent := private.create_pack(copy_slug, source_product.name || ' copy');
      select coalesce(jsonb_agg(jsonb_build_object('item_id', item_id, 'quantity', quantity, 'sort', sort)), '[]')
        into contents from public.pack_items where pack_id = p_id;
      perform private.save_pack_items(new_parent, contents);
    else
      -- Lock the source draft so autosave cannot separate its composition from its letter bindings.
      select * into product_version from public.product_versions
        where id = coalesce(source_product.draft_version_id, source_product.current_version_id) for update;
      if not found then raise exception using errcode = '23514', message = 'Product has no version to duplicate'; end if;
      select coalesce(jsonb_object_agg(letter, effect_id), '{}') into bindings
        from public.product_version_effects where product_version_id = product_version.id;
      new_version := private.create_product_draft(null, copy_slug, source_product.name || ' copy',
        source_product.kind, product_version.composition, bindings);
      select product_id into new_parent from public.product_versions where id = new_version;
    end if;
  else
    raise exception using errcode = '22023', message = 'Unknown catalogue kind';
  end if;
  return new_parent;
end;
$$;
comment on function private.duplicate_catalogue_item(text, uuid) is 'Atomically duplicates the preferred draft or current version, including bindings or pack contents, as an unpublished parent with no confirmed safety.';

-- Exposes atomic duplication only through the catalogue editor boundary.
create or replace function public.duplicate_catalogue_item(p_kind text, p_id uuid)
returns uuid language sql set search_path = '' as $$
  select private.duplicate_catalogue_item(p_kind, p_id);
$$;
comment on function public.duplicate_catalogue_item(text, uuid) is 'Duplicates an effect or product into an independent draft and returns its parent UUID.';
