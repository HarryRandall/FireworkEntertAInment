-- Video firework import workflow.
-- Adds reviewable AI reconstruction state without changing existing import rows.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'import-videos',
  'import-videos',
  false,
  262144000,
  array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "import_videos_admin_read" on storage.objects;
create policy "import_videos_admin_read" on storage.objects
  for select using (
    bucket_id = 'import-videos'
    and public.current_user_has_permission('admin.manage_imports')
  );

drop policy if exists "import_videos_admin_insert" on storage.objects;
create policy "import_videos_admin_insert" on storage.objects
  for insert with check (
    bucket_id = 'import-videos'
    and public.current_user_has_permission('admin.manage_imports')
  );

drop policy if exists "import_videos_admin_update" on storage.objects;
create policy "import_videos_admin_update" on storage.objects
  for update using (
    bucket_id = 'import-videos'
    and public.current_user_has_permission('admin.manage_imports')
  )
  with check (
    bucket_id = 'import-videos'
    and public.current_user_has_permission('admin.manage_imports')
  );

drop policy if exists "import_videos_admin_delete" on storage.objects;
create policy "import_videos_admin_delete" on storage.objects
  for delete using (
    bucket_id = 'import-videos'
    and public.current_user_has_permission('admin.manage_imports')
  );

alter table public.import_jobs
  add column if not exists selected_model text,
  add column if not exists processing_progress integer not null default 0
    check (processing_progress >= 0 and processing_progress <= 100),
  add column if not exists processor_version text,
  add column if not exists approved_catalogue_product_id uuid
    references public.catalogue_products(id) on delete set null,
  add column if not exists approved_firework_specification_id uuid
    references public.firework_specifications(id) on delete set null,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

alter table public.catalogue_products
  add column if not exists firework_specification_id uuid
    references public.firework_specifications(id) on delete set null;

alter table public.import_outputs
  drop constraint if exists import_outputs_output_type_check;

alter table public.import_outputs
  add constraint import_outputs_output_type_check
  check (
    output_type in (
      'raw_rows',
      'model_output',
      'review_notes',
      'frame_analysis',
      'audio_analysis',
      'generated_spec',
      'draft_spec',
      'refinement',
      'processing_log'
    )
  );

create index if not exists import_outputs_job_created_idx
  on public.import_outputs (import_job_id, created_at);

create index if not exists catalogue_products_firework_specification_id_idx
  on public.catalogue_products (firework_specification_id);
