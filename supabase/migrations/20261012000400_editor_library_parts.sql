begin;

-- Reusable editor parts: one renderer design envelope per saved star group, trail, effect or tail.
-- Parts are shared between catalogue editors and never edited in place; delete and save again instead.
create table public.editor_library_parts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text not null check (category in ('stars', 'trails', 'effects', 'tails')),
  design jsonb not null check (jsonb_typeof(design) = 'object' and design ? 'kind'),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index editor_library_parts_recent on public.editor_library_parts(created_at desc, id);
alter table public.editor_library_parts enable row level security;
revoke all on public.editor_library_parts from public, anon, authenticated;
create policy editor_library_parts_catalogue_read on public.editor_library_parts
  for select to authenticated using (public.current_user_has_permission('admin.manage_catalogue'));
create policy editor_library_parts_catalogue_insert on public.editor_library_parts
  for insert to authenticated with check (
    public.current_user_has_permission('admin.manage_catalogue') and created_by = auth.uid()
  );
create policy editor_library_parts_catalogue_delete on public.editor_library_parts
  for delete to authenticated using (public.current_user_has_permission('admin.manage_catalogue'));
grant select, delete on public.editor_library_parts to authenticated;
grant insert (name, category, design) on public.editor_library_parts to authenticated;

commit;
