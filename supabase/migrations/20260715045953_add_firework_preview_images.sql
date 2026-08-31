-- Persist one confirmed renderer still for each reusable visual source. The
-- manifest is deliberately separate from the editor tables: poster capture
-- must not change their optimistic-concurrency `updated_at` revisions.
create table public.firework_preview_images (
  id uuid primary key default gen_random_uuid(),
  firework_effect_id uuid unique references public.firework_effects(id) on delete cascade,
  firework_id uuid unique references public.fireworks(id) on delete cascade,
  multishot_id uuid unique references public.multishots(id) on delete cascade,
  source_revision bigint not null default 1,
  renderer_version text,
  source_signature text,
  storage_path text,
  width integer,
  height integer,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint firework_preview_images_one_target_check check (
    num_nonnulls(firework_effect_id, firework_id, multishot_id) = 1
  ),
  constraint firework_preview_images_revision_check check (source_revision > 0),
  constraint firework_preview_images_signature_check check (
    source_signature is null or source_signature ~ '^[0-9a-f]{64}$'
  ),
  constraint firework_preview_images_dimensions_check check (
    (width is null and height is null)
    or (width > 0 and height > 0)
  ),
  constraint firework_preview_images_complete_capture_check check (
    (
      storage_path is null
      and renderer_version is null
      and source_signature is null
      and width is null
      and height is null
      and captured_at is null
    )
    or (
      storage_path is not null
      and renderer_version is not null
      and source_signature is not null
      and width is not null
      and height is not null
      and captured_at is not null
    )
  ),
  constraint firework_preview_images_versioned_path_check check (
    storage_path is null
    or (
      storage_path ~ '/r[1-9][0-9]*-[0-9a-f]{64}\.webp$'
      and storage_path like case
        when firework_effect_id is not null then
          renderer_version || '/effect/' || firework_effect_id::text || '/r' || source_revision::text || '-%'
        when firework_id is not null then
          renderer_version || '/firework/' || firework_id::text || '/r' || source_revision::text || '-%'
        else
          renderer_version || '/multishot/' || multishot_id::text || '/r' || source_revision::text || '-%'
      end
    )
  )
);

comment on table public.firework_preview_images is
  'Public manifest for immutable renderer stills used by firework browse cards.';
comment on column public.firework_preview_images.source_revision is
  'Monotonic visual-source revision used to reject captures that finish after an edit.';
comment on column public.firework_preview_images.storage_path is
  'Immutable WebP path in the public firework-previews bucket; null while capture is required.';

alter table public.firework_preview_images enable row level security;

-- These paths point to non-sensitive catalogue artwork already visible on
-- public browse routes. Browser writes remain unavailable; the RBAC-gated
-- server upload route uses the service role after validating the capture.
revoke all on table public.firework_preview_images from anon, authenticated;
grant select on table public.firework_preview_images to anon, authenticated;
grant all on table public.firework_preview_images to service_role;

create policy firework_preview_images_select_anyone
  on public.firework_preview_images
  for select
  to anon, authenticated
  using (true);

-- Trigger-owned rows exist before a poster is available, which gives list
-- queries an authoritative missing/current state without probing Storage.
create or replace function private.ensure_firework_preview_image()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'firework_effects' then
    insert into public.firework_preview_images (firework_effect_id)
    values (new.id)
    on conflict (firework_effect_id) do nothing;
  elsif tg_table_name = 'fireworks' then
    insert into public.firework_preview_images (firework_id)
    values (new.id)
    on conflict (firework_id) do nothing;
  elsif tg_table_name = 'multishots' then
    insert into public.firework_preview_images (multishot_id)
    values (new.id)
    on conflict (multishot_id) do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function private.ensure_firework_preview_image()
  from public, anon, authenticated, service_role;

create trigger firework_effects_ensure_preview_image
  after insert on public.firework_effects
  for each row execute function private.ensure_firework_preview_image();

create trigger fireworks_ensure_preview_image
  after insert on public.fireworks
  for each row execute function private.ensure_firework_preview_image();

create trigger multishots_ensure_preview_image
  after insert on public.multishots
  for each row execute function private.ensure_firework_preview_image();

create or replace function private.bump_effect_preview_images()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.firework_preview_images preview
  set source_revision = preview.source_revision + 1,
      renderer_version = null,
      source_signature = null,
      storage_path = null,
      width = null,
      height = null,
      captured_at = null,
      updated_at = now()
  where preview.firework_effect_id = new.id
     or preview.firework_id in (
       select firework.id
       from public.fireworks firework
       where firework.firework_effect_id = new.id
     )
     or preview.multishot_id in (
       select distinct shot.multishot_id
       from public.multishot_fireworks shot
       join public.fireworks firework on firework.id = shot.firework_id
       where firework.firework_effect_id = new.id
     );
  return new;
end;
$$;

revoke execute on function private.bump_effect_preview_images()
  from public, anon, authenticated, service_role;

create trigger firework_effects_bump_preview_images
  after update of model_json, pattern_key on public.firework_effects
  for each row
  when (
    (old.model_json, old.pattern_key)
      is distinct from
    (new.model_json, new.pattern_key)
  )
  execute function private.bump_effect_preview_images();

create or replace function private.bump_firework_preview_images()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.firework_preview_images preview
  set source_revision = preview.source_revision + 1,
      renderer_version = null,
      source_signature = null,
      storage_path = null,
      width = null,
      height = null,
      captured_at = null,
      updated_at = now()
  where preview.firework_id = new.id
     or preview.multishot_id in (
       select distinct shot.multishot_id
       from public.multishot_fireworks shot
       where shot.firework_id = new.id
     );
  return new;
end;
$$;

revoke execute on function private.bump_firework_preview_images()
  from public, anon, authenticated, service_role;

create trigger fireworks_bump_preview_images
  after update of
    firework_effect_id,
    primary_color,
    secondary_color,
    color_palette,
    caliber,
    duration_seconds,
    height_meters,
    variant_json,
    render_overrides_json
  on public.fireworks
  for each row
  when (
    (
      old.firework_effect_id,
      old.primary_color,
      old.secondary_color,
      old.color_palette,
      old.caliber,
      old.duration_seconds,
      old.height_meters,
      old.variant_json,
      old.render_overrides_json
    ) is distinct from (
      new.firework_effect_id,
      new.primary_color,
      new.secondary_color,
      new.color_palette,
      new.caliber,
      new.duration_seconds,
      new.height_meters,
      new.variant_json,
      new.render_overrides_json
    )
  )
  execute function private.bump_firework_preview_images();

create or replace function private.bump_multishot_preview_image()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.firework_preview_images preview
  set source_revision = preview.source_revision + 1,
      renderer_version = null,
      source_signature = null,
      storage_path = null,
      width = null,
      height = null,
      captured_at = null,
      updated_at = now()
  where preview.multishot_id = new.id;
  return new;
end;
$$;

revoke execute on function private.bump_multishot_preview_image()
  from public, anon, authenticated, service_role;

-- Shot mutations already update the parent through
-- multishot_fireworks_sync_derived_state, so every composition edit reaches
-- this trigger as one parent-row update.
create trigger multishots_bump_preview_image
  after update on public.multishots
  for each row execute function private.bump_multishot_preview_image();

insert into public.firework_preview_images (firework_effect_id)
select id from public.firework_effects
on conflict (firework_effect_id) do nothing;

insert into public.firework_preview_images (firework_id)
select id from public.fireworks
on conflict (firework_id) do nothing;

insert into public.firework_preview_images (multishot_id)
select id from public.multishots
on conflict (multishot_id) do nothing;

-- Public reads use the Storage public-object endpoint. No browser write policy
-- is created for this bucket; only the trusted service-role route uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('firework-previews', 'firework-previews', true, 1048576, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
