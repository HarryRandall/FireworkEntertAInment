-- Admin-managed draft/publish controls for curated Explore/Home show presets.

alter table public.show_presets
  add column if not exists is_published boolean not null default true,
  add column if not exists published_at timestamptz;

update public.show_presets
set published_at = coalesce(published_at, created_at, now())
where is_published = true
  and published_at is null;

comment on column public.show_presets.is_published is
  'Controls whether a curated show preset is visible to public Explore/Home reads.';
comment on column public.show_presets.published_at is
  'Timestamp when the curated show preset was last published.';

create index if not exists show_presets_public_library_idx
  on public.show_presets (is_published desc, is_featured desc, sort_order, title);

grant select on public.show_presets to anon;
grant select, insert, update, delete on public.show_presets to authenticated;

drop policy if exists show_presets_read_anyone on public.show_presets;
drop policy if exists show_presets_read_authenticated on public.show_presets;
drop policy if exists show_templates_read_authenticated on public.show_presets;
create policy show_presets_read_published_or_admin on public.show_presets
  for select
  using (
    is_published
    or public.current_user_has_permission('admin.manage_catalogue')
  );

drop policy if exists show_presets_admin_modify on public.show_presets;
drop policy if exists show_templates_admin_modify on public.show_presets;
create policy show_presets_admin_modify on public.show_presets
  for all
  using (public.current_user_has_permission('admin.manage_catalogue'))
  with check (public.current_user_has_permission('admin.manage_catalogue'));
