-- Canonical schema names for the user, show-analysis, and firework catalogue model.
-- Legacy tables are used as migration sources, then removed at the end of this
-- migration so the public schema exposes only the canonical names.

-- ─── User profile rename ────────────────────────────────────────────────

alter table if exists public.profiles rename to users;

create or replace function public.current_user_access()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with current_profile as (
    select id, email, full_name, phone, status, theme_preference
    from public.users
    where id = auth.uid()
  ),
  assigned_roles as (
    select r.id, r.key, r.name
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
  ),
  role_grants as (
    select distinct p.key
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
  ),
  overrides as (
    select p.key, upo.enabled
    from public.user_permission_overrides upo
    join public.permissions p on p.id = upo.permission_id
    where upo.user_id = auth.uid()
  ),
  final_permissions as (
    select key from role_grants
    where key not in (select key from overrides where enabled = false)
    union
    select key from overrides where enabled = true
  )
  select jsonb_build_object(
    'profile', coalesce((select to_jsonb(current_profile) from current_profile), '{}'::jsonb),
    'roles', coalesce((select jsonb_agg(key order by key) from assigned_roles), '[]'::jsonb),
    'permissions', coalesce((select jsonb_agg(key order by key) from final_permissions), '[]'::jsonb)
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  default_role_id uuid;
  admin_role_id uuid;
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  select id into default_role_id from public.roles where key = 'user';
  if default_role_id is not null then
    insert into public.user_roles (user_id, role_id)
    values (new.id, default_role_id)
    on conflict do nothing;
  end if;

  if lower(coalesce(new.email, '')) = 'randallhazza@gmail.com' then
    select id into admin_role_id from public.roles where key = 'admin';
    if admin_role_id is not null then
      insert into public.user_roles (user_id, role_id)
      values (new.id, admin_role_id)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop policy if exists users_select_own on public.users;
drop policy if exists profiles_select_own on public.users;
create policy users_select_own on public.users
  for select using (auth.uid() = id);

drop policy if exists users_insert_own on public.users;
drop policy if exists profiles_insert_own on public.users;
create policy users_insert_own on public.users
  for insert with check (auth.uid() = id);

drop policy if exists users_update_own on public.users;
drop policy if exists profiles_update_own on public.users;
create policy users_update_own on public.users
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists users_admin_select_all on public.users;
drop policy if exists profiles_admin_select_all on public.users;
create policy users_admin_select_all on public.users
  for select using (public.current_user_has_permission('admin.manage_users'));

drop policy if exists users_admin_update_all on public.users;
drop policy if exists profiles_admin_update_all on public.users;
create policy users_admin_update_all on public.users
  for update using (public.current_user_has_permission('admin.manage_users'))
  with check (public.current_user_has_permission('admin.manage_users'));

-- ─── Song analysis and show generation naming ───────────────────────────

alter table if exists public.music_analyses rename to song_analyses;

comment on table public.song_analyses is 'Upload-scoped song analysis rows generated after audio upload.';
grant select, insert, update, delete on public.song_analyses to authenticated;

drop policy if exists song_analyses_select_own on public.song_analyses;
drop policy if exists music_analyses_select_own on public.song_analyses;
create policy song_analyses_select_own on public.song_analyses
  for select using (user_id = auth.uid());

drop policy if exists song_analyses_insert_own on public.song_analyses;
drop policy if exists music_analyses_insert_own on public.song_analyses;
create policy song_analyses_insert_own on public.song_analyses
  for insert with check (user_id = auth.uid());

drop policy if exists song_analyses_update_own on public.song_analyses;
drop policy if exists music_analyses_update_own on public.song_analyses;
create policy song_analyses_update_own on public.song_analyses
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists song_analyses_delete_own on public.song_analyses;
drop policy if exists music_analyses_delete_own on public.song_analyses;
create policy song_analyses_delete_own on public.song_analyses
  for delete using (user_id = auth.uid());

alter table if exists public.show_analyses rename to show_generation_runs;

comment on table public.show_generation_runs is 'Per-show generation attempt history, replacing legacy public.show_analyses.';
grant select, insert, update, delete on public.show_generation_runs to authenticated;

drop policy if exists show_generation_runs_select_own on public.show_generation_runs;
drop policy if exists show_analyses_select_own on public.show_generation_runs;
drop policy if exists show_analyses_select_via_show on public.show_generation_runs;
create policy show_generation_runs_select_own on public.show_generation_runs
  for select to authenticated
  using (
    auth.uid() is not null
    and user_id = auth.uid()
    and exists (
      select 1 from public.shows s
      where s.id = show_generation_runs.show_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists show_generation_runs_insert_own on public.show_generation_runs;
drop policy if exists show_analyses_insert_own on public.show_generation_runs;
drop policy if exists show_analyses_insert_via_show on public.show_generation_runs;
create policy show_generation_runs_insert_own on public.show_generation_runs
  for insert to authenticated
  with check (
    auth.uid() is not null
    and user_id = auth.uid()
    and exists (
      select 1 from public.shows s
      where s.id = show_generation_runs.show_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists show_generation_runs_update_own on public.show_generation_runs;
drop policy if exists show_analyses_update_own on public.show_generation_runs;
drop policy if exists show_analyses_update_via_show on public.show_generation_runs;
create policy show_generation_runs_update_own on public.show_generation_runs
  for update to authenticated
  using (
    auth.uid() is not null
    and user_id = auth.uid()
    and exists (
      select 1 from public.shows s
      where s.id = show_generation_runs.show_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() is not null
    and user_id = auth.uid()
    and exists (
      select 1 from public.shows s
      where s.id = show_generation_runs.show_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists show_generation_runs_delete_own on public.show_generation_runs;
drop policy if exists show_analyses_delete_own on public.show_generation_runs;
drop policy if exists show_analyses_delete_via_show on public.show_generation_runs;
create policy show_generation_runs_delete_own on public.show_generation_runs
  for delete to authenticated
  using (
    auth.uid() is not null
    and user_id = auth.uid()
    and exists (
      select 1 from public.shows s
      where s.id = show_generation_runs.show_id
        and s.user_id = auth.uid()
    )
  );

alter table if exists public.show_templates rename to show_presets;

comment on table public.show_presets is 'Reusable show presets shown in the library.';
grant select, insert, update, delete on public.show_presets to authenticated;

drop policy if exists show_presets_read_authenticated on public.show_presets;
drop policy if exists show_templates_read_authenticated on public.show_presets;
create policy show_presets_read_authenticated on public.show_presets
  for select using (auth.uid() is not null);

drop policy if exists show_presets_admin_modify on public.show_presets;
drop policy if exists show_templates_admin_modify on public.show_presets;
create policy show_presets_admin_modify on public.show_presets
  using (public.current_user_has_permission('admin.manage_catalogue'))
  with check (public.current_user_has_permission('admin.manage_catalogue'));

-- ─── Core firework visual model ─────────────────────────────────────────

alter table if exists public.firework_variants rename to fireworks;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'fireworks'
      and column_name = 'effect_id'
  ) then
    alter table public.fireworks rename column effect_id to firework_effect_id;
  end if;
end $$;

comment on table public.fireworks is 'Atomic visual fireworks: one ignition and one rendered visual outcome.';
comment on column public.fireworks.firework_effect_id is 'Base visual pattern from public.firework_effects.';
comment on column public.fireworks.render_overrides_json is 'Firework-level renderer overrides applied on top of the base effect model.';

insert into public.firework_effects (
  slug,
  name,
  description,
  family,
  pattern_key,
  model_json,
  source,
  sort_order
)
values (
  'legacy-effect-spec',
  'Legacy effect spec',
  'Fallback base effect used for migrated effect_specs rows without a concrete firework.',
  'aerial_burst',
  'legacy',
  '{}'::jsonb,
  'legacy_migrated',
  9999
)
on conflict (slug) do nothing;

insert into public.fireworks (
  id,
  firework_effect_id,
  source_effect_spec_id,
  slug,
  name,
  description,
  color_palette,
  duration_seconds,
  height_meters,
  variant_json,
  render_overrides_json,
  source,
  confidence,
  created_at,
  updated_at
)
select
  es.id,
  fe.id,
  es.id,
  es.slug,
  es.name,
  es.description,
  '{}'::text[],
  es.duration_seconds,
  es.height_meters,
  jsonb_build_object('legacyEffectSpecId', es.id, 'type', es.type),
  es.spec_json,
  'legacy_migrated',
  es.confidence,
  es.created_at,
  es.updated_at
from public.effect_specs es
cross join public.firework_effects fe
where fe.slug = 'legacy-effect-spec'
  and not exists (
    select 1
    from public.fireworks fw
    where fw.id = es.id
       or fw.source_effect_spec_id = es.id
       or fw.slug = es.slug
  );

grant select, insert, update, delete on public.fireworks to authenticated;
grant select on public.fireworks to anon;

drop policy if exists fireworks_select_authenticated on public.fireworks;
create policy fireworks_select_authenticated on public.fireworks
  for select using (auth.uid() is not null);

drop policy if exists fireworks_admin_modify on public.fireworks;
create policy fireworks_admin_modify on public.fireworks
  using (public.current_user_has_permission('admin.manage_catalogue'))
  with check (public.current_user_has_permission('admin.manage_catalogue'));

create table if not exists public.multishots (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  duration_seconds numeric(8,2),
  shot_count integer not null default 0 check (shot_count >= 0),
  source_product_id uuid unique references public.products(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.multishots is 'Composite visual fireworks made from ordered atomic fireworks.';

create trigger multishots_set_updated_at
  before update on public.multishots
  for each row
  execute function public.set_updated_at();

create table if not exists public.multishot_fireworks (
  id uuid primary key default gen_random_uuid(),
  multishot_id uuid not null references public.multishots(id) on delete cascade,
  firework_id uuid not null references public.fireworks(id) on delete restrict,
  sequence_index integer not null,
  time_offset_seconds numeric not null default 0 check (time_offset_seconds >= 0),
  pan_degrees integer not null default 0,
  tilt_degrees integer not null default 0 check (tilt_degrees >= -90 and tilt_degrees <= 90),
  position_override_json jsonb,
  caliber text,
  notes text,
  source_product_shot_id uuid unique,
  created_at timestamptz not null default now(),
  unique (multishot_id, sequence_index)
);

comment on table public.multishot_fireworks is 'Ordered firework sequence inside each multishot.';

create index if not exists multishot_fireworks_multishot_id_idx
  on public.multishot_fireworks (multishot_id, sequence_index);

create index if not exists multishot_fireworks_firework_id_idx
  on public.multishot_fireworks (firework_id);

with product_shot_counts as (
  select
    p.id as product_id,
    count(ps.id)::integer as shot_count
  from public.products p
  left join public.product_shots ps on ps.product_id = p.id
  group by p.id
)
insert into public.multishots (
  id,
  slug,
  name,
  description,
  duration_seconds,
  shot_count,
  source_product_id,
  metadata,
  created_at,
  updated_at
)
select
  p.id,
  p.part_number,
  p.name,
  p.description,
  p.duration_seconds,
  psc.shot_count,
  p.id,
  p.product_metadata,
  p.created_at,
  p.updated_at
from public.products p
join product_shot_counts psc on psc.product_id = p.id
where psc.shot_count > 1
   or p.product_kind in ('multi_shot', 'cake', 'rack', 'shell_kit', 'assortment')
on conflict (id) do update
set slug = excluded.slug,
    name = excluded.name,
    description = excluded.description,
    duration_seconds = excluded.duration_seconds,
    shot_count = excluded.shot_count,
    metadata = excluded.metadata,
    updated_at = excluded.updated_at;

insert into public.multishot_fireworks (
  id,
  multishot_id,
  firework_id,
  sequence_index,
  time_offset_seconds,
  pan_degrees,
  tilt_degrees,
  position_override_json,
  caliber,
  notes,
  source_product_shot_id,
  created_at
)
select
  ps.id,
  ps.product_id,
  coalesce(ps.firework_variant_id, ps.effect_spec_id),
  ps.shot_index,
  ps.time_offset_seconds,
  ps.pan_degrees,
  ps.tilt_degrees,
  ps.position_override_json,
  ps.caliber,
  ps.shot_notes,
  ps.id,
  coalesce(ps.created_at, now())
from public.product_shots ps
join public.multishots ms on ms.id = ps.product_id
where coalesce(ps.firework_variant_id, ps.effect_spec_id) is not null
on conflict (id) do update
set multishot_id = excluded.multishot_id,
    firework_id = excluded.firework_id,
    sequence_index = excluded.sequence_index,
    time_offset_seconds = excluded.time_offset_seconds,
    pan_degrees = excluded.pan_degrees,
    tilt_degrees = excluded.tilt_degrees,
    position_override_json = excluded.position_override_json,
    caliber = excluded.caliber,
    notes = excluded.notes;

create table if not exists public.catalogue_items (
  id uuid primary key default gen_random_uuid(),
  part_number text not null unique,
  name text not null,
  manufacturer text,
  description text,
  catalogue_item_kind text not null,
  firework_id uuid references public.fireworks(id) on delete restrict,
  multishot_id uuid references public.multishots(id) on delete restrict,
  firework_type text,
  duration_seconds numeric(8,2),
  metadata jsonb not null default '{}'::jsonb,
  source_product_id uuid unique references public.products(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalogue_items_kind_check
    check (catalogue_item_kind in ('firework', 'multishot', 'bundle', 'other')),
  constraint catalogue_items_visual_target_check
    check (
      (catalogue_item_kind = 'firework' and firework_id is not null and multishot_id is null)
      or (catalogue_item_kind = 'multishot' and firework_id is null and multishot_id is not null)
      or (catalogue_item_kind in ('bundle', 'other') and firework_id is null and multishot_id is null)
    )
);

comment on table public.catalogue_items is 'Supplier-facing catalogue entries. Each row exposes either an atomic firework or a multishot to sourcing and show selection workflows.';

create trigger catalogue_items_set_updated_at
  before update on public.catalogue_items
  for each row
  execute function public.set_updated_at();

create index if not exists catalogue_items_firework_id_idx
  on public.catalogue_items (firework_id)
  where firework_id is not null;

create index if not exists catalogue_items_multishot_id_idx
  on public.catalogue_items (multishot_id)
  where multishot_id is not null;

create index if not exists catalogue_items_kind_name_idx
  on public.catalogue_items (catalogue_item_kind, name);

with product_shot_counts as (
  select
    p.id as product_id,
    count(ps.id)::integer as shot_count
  from public.products p
  left join public.product_shots ps on ps.product_id = p.id
  group by p.id
),
first_product_firework as (
  select distinct on (ps.product_id)
    ps.product_id,
    coalesce(ps.firework_variant_id, ps.effect_spec_id) as firework_id
  from public.product_shots ps
  where coalesce(ps.firework_variant_id, ps.effect_spec_id) is not null
  order by ps.product_id, ps.shot_index
),
classified_products as (
  select
    p.*,
    psc.shot_count,
    fpf.firework_id,
    (psc.shot_count > 1 or p.product_kind in ('multi_shot', 'cake', 'rack', 'shell_kit', 'assortment')) as is_multishot
  from public.products p
  join product_shot_counts psc on psc.product_id = p.id
  left join first_product_firework fpf on fpf.product_id = p.id
)
insert into public.catalogue_items (
  id,
  part_number,
  name,
  manufacturer,
  description,
  catalogue_item_kind,
  firework_id,
  multishot_id,
  firework_type,
  duration_seconds,
  metadata,
  source_product_id,
  created_at,
  updated_at
)
select
  cp.id,
  cp.part_number,
  cp.name,
  cp.manufacturer,
  cp.description,
  case
    when cp.is_multishot then 'multishot'
    when cp.firework_id is not null then 'firework'
    when cp.product_kind in ('assortment', 'shell_kit') then 'bundle'
    else 'other'
  end,
  case when cp.is_multishot then null else cp.firework_id end,
  case when cp.is_multishot then cp.id else null end,
  cp.subtype,
  cp.duration_seconds,
  cp.product_metadata,
  cp.id,
  cp.created_at,
  cp.updated_at
from classified_products cp
on conflict (id) do update
set part_number = excluded.part_number,
    name = excluded.name,
    manufacturer = excluded.manufacturer,
    description = excluded.description,
    catalogue_item_kind = excluded.catalogue_item_kind,
    firework_id = excluded.firework_id,
    multishot_id = excluded.multishot_id,
    firework_type = excluded.firework_type,
    duration_seconds = excluded.duration_seconds,
    metadata = excluded.metadata,
    updated_at = excluded.updated_at;

alter table public.multishots enable row level security;
alter table public.multishot_fireworks enable row level security;
alter table public.catalogue_items enable row level security;

drop policy if exists multishots_select_authenticated on public.multishots;
create policy multishots_select_authenticated on public.multishots
  for select using (auth.uid() is not null);

drop policy if exists multishots_admin_modify on public.multishots;
create policy multishots_admin_modify on public.multishots
  using (public.current_user_has_permission('admin.manage_catalogue'))
  with check (public.current_user_has_permission('admin.manage_catalogue'));

drop policy if exists multishot_fireworks_select_authenticated on public.multishot_fireworks;
create policy multishot_fireworks_select_authenticated on public.multishot_fireworks
  for select using (auth.uid() is not null);

drop policy if exists multishot_fireworks_admin_modify on public.multishot_fireworks;
create policy multishot_fireworks_admin_modify on public.multishot_fireworks
  using (public.current_user_has_permission('admin.manage_catalogue'))
  with check (public.current_user_has_permission('admin.manage_catalogue'));

drop policy if exists catalogue_items_select_authenticated on public.catalogue_items;
create policy catalogue_items_select_authenticated on public.catalogue_items
  for select using (auth.uid() is not null);

drop policy if exists catalogue_items_admin_modify on public.catalogue_items;
create policy catalogue_items_admin_modify on public.catalogue_items
  using (public.current_user_has_permission('admin.manage_catalogue'))
  with check (public.current_user_has_permission('admin.manage_catalogue'));

grant select on public.multishots, public.multishot_fireworks, public.catalogue_items to anon;
grant select, insert, update, delete on public.multishots, public.multishot_fireworks, public.catalogue_items to authenticated;
grant all on public.multishots, public.multishot_fireworks, public.catalogue_items to service_role;

-- ─── Show timeline and supplier links ───────────────────────────────────

alter table if exists public.show_cues rename to show_timeline_items;

alter table public.show_timeline_items
  drop constraint if exists show_cues_product_id_fkey;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'show_timeline_items'
      and column_name = 'product_id'
  ) then
    alter table public.show_timeline_items rename column product_id to catalogue_item_id;
  end if;
end $$;

alter table public.show_timeline_items
  add constraint show_timeline_items_catalogue_item_id_fkey
  foreign key (catalogue_item_id) references public.catalogue_items(id);

comment on table public.show_timeline_items is 'Scheduled catalogue items on a show timeline.';
comment on column public.show_timeline_items.catalogue_item_id is 'Selected supplier-facing catalogue item.';

grant select, insert, update, delete on public.show_timeline_items to authenticated;

drop policy if exists show_timeline_items_select_via_show on public.show_timeline_items;
drop policy if exists show_cues_select_via_show on public.show_timeline_items;
create policy show_timeline_items_select_via_show on public.show_timeline_items
  for select using (
    exists (
      select 1 from public.shows s
      where s.id = show_timeline_items.show_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists show_timeline_items_modify_via_show on public.show_timeline_items;
drop policy if exists show_cues_modify_via_show on public.show_timeline_items;
create policy show_timeline_items_modify_via_show on public.show_timeline_items
  using (
    exists (
      select 1 from public.shows s
      where s.id = show_timeline_items.show_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.shows s
      where s.id = show_timeline_items.show_id
        and s.user_id = auth.uid()
    )
  );

alter table public.supplier_inventory_items
  add column if not exists catalogue_item_id uuid;

update public.supplier_inventory_items sii
set catalogue_item_id = product_id
where catalogue_item_id is null
  and product_id is not null
  and exists (
    select 1 from public.catalogue_items ci
    where ci.id = sii.product_id
  );

alter table public.supplier_inventory_items
  add constraint supplier_inventory_items_catalogue_item_id_fkey
  foreign key (catalogue_item_id) references public.catalogue_items(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'supplier_inventory_items_supplier_catalogue_item_unique'
      and conrelid = 'public.supplier_inventory_items'::regclass
  ) then
    alter table public.supplier_inventory_items
      add constraint supplier_inventory_items_supplier_catalogue_item_unique
      unique (supplier_id, catalogue_item_id);
  end if;
end $$;

create index if not exists supplier_inventory_items_catalogue_item_id_idx
  on public.supplier_inventory_items (catalogue_item_id)
  where catalogue_item_id is not null;

comment on column public.supplier_inventory_items.catalogue_item_id is 'Canonical catalogue item stocked by this supplier.';

alter table public.import_jobs
  add column if not exists approved_catalogue_item_id uuid;

update public.import_jobs ij
set approved_catalogue_item_id = approved_product_id
where approved_catalogue_item_id is null
  and approved_product_id is not null
  and exists (
    select 1 from public.catalogue_items ci
    where ci.id = ij.approved_product_id
  );

alter table public.import_jobs
  add constraint import_jobs_approved_catalogue_item_id_fkey
  foreign key (approved_catalogue_item_id) references public.catalogue_items(id) on delete set null;

create index if not exists import_jobs_approved_catalogue_item_id_idx
  on public.import_jobs (approved_catalogue_item_id)
  where approved_catalogue_item_id is not null;

comment on column public.import_jobs.approved_catalogue_item_id is 'Canonical catalogue item approved from an import job.';

-- ─── Final legacy cleanup ───────────────────────────────────────────────

drop view if exists public.firework_variants;
drop view if exists public.music_analyses;
drop view if exists public.profiles;
drop view if exists public.show_analyses;
drop view if exists public.show_cues;
drop view if exists public.show_templates;

alter table if exists public.fireworks
  drop constraint if exists firework_variants_source_effect_spec_id_fkey,
  drop column if exists source_effect_spec_id;

alter table if exists public.catalogue_items
  drop constraint if exists catalogue_items_source_product_id_fkey,
  drop column if exists source_product_id;

alter table if exists public.multishots
  drop constraint if exists multishots_source_product_id_fkey,
  drop column if exists source_product_id;

alter table if exists public.multishot_fireworks
  drop column if exists source_product_shot_id;

alter table if exists public.supplier_inventory_items
  drop constraint if exists supplier_inventory_items_product_id_fkey,
  drop column if exists product_id;

alter table if exists public.import_jobs
  drop constraint if exists import_jobs_approved_product_id_fkey,
  drop column if exists approved_product_id,
  drop column if exists approved_firework_specification_id;

drop table if exists public.product_shots;
drop table if exists public.products;
drop table if exists public.effect_specs;
