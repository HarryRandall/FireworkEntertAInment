-- Pre-rendered cover poster path. The shader cover identity (`cover_shader`)
-- stays the source of truth for the live animated background on the generating
-- screen; `cover_image_path` points at a PNG rendered once from that shader and
-- stored in the `covers` bucket so browse pages can show an <img> instead of
-- mounting a WebGL context per card.
ALTER TABLE shows ADD COLUMN IF NOT EXISTS cover_image_path text;
ALTER TABLE show_presets ADD COLUMN IF NOT EXISTS cover_image_path text;

comment on column shows.cover_image_path is
  'Storage path of the pre-rendered cover PNG in the covers bucket; null until rendered.';
comment on column show_presets.cover_image_path is
  'Storage path of the pre-rendered cover PNG in the covers bucket; null until rendered.';

-- ─── covers storage bucket ──────────────────────────────────────────
-- Public read: /library, /home, /catalogue, and the dashboard render cover
-- posters anonymously. Cover images are non-sensitive abstract gradients
-- derived from the show/preset palette, so public read is intentional and
-- matches the public-read policy on the show_presets row itself.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/png'])
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types,
    public = excluded.public;

-- Public read for everyone.
drop policy if exists "covers_select_anyone" on storage.objects;
create policy "covers_select_anyone" on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'covers');

-- Owner-scoped writes for user show covers stored under `<user id>/...`.
-- Preset covers under `presets/...` are written by the admin backfill through
-- the service role, which bypasses RLS, so no client policy is needed there.
drop policy if exists "covers_insert_own" on storage.objects;
create policy "covers_insert_own" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'covers'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "covers_update_own" on storage.objects;
create policy "covers_update_own" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'covers'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'covers'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "covers_delete_own" on storage.objects;
create policy "covers_delete_own" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'covers'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
