-- ShowCrafter authentication and Storage integration.

set search_path = public, extensions;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

create policy "audio_delete_own" on "storage"."objects" as PERMISSIVE for DELETE to "authenticated" using (((bucket_id = 'audio'::text) AND ( SELECT current_user_is_active() AS current_user_is_active) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

create policy "audio_insert_own" on "storage"."objects" as PERMISSIVE for INSERT to "authenticated" with check (((bucket_id = 'audio'::text) AND ( SELECT current_user_is_active() AS current_user_is_active) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

create policy "audio_read_own" on "storage"."objects" as PERMISSIVE for SELECT to "authenticated" using (((bucket_id = 'audio'::text) AND ( SELECT current_user_is_active() AS current_user_is_active) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

create policy "audio_update_own" on "storage"."objects" as PERMISSIVE for UPDATE to "authenticated" using (((bucket_id = 'audio'::text) AND ( SELECT current_user_is_active() AS current_user_is_active) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))) with check (((bucket_id = 'audio'::text) AND ( SELECT current_user_is_active() AS current_user_is_active) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

create policy "covers_delete_own" on "storage"."objects" as PERMISSIVE for DELETE to "authenticated" using (((bucket_id = 'covers'::text) AND ( SELECT current_user_is_active() AS current_user_is_active) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

create policy "covers_insert_own" on "storage"."objects" as PERMISSIVE for INSERT to "authenticated" with check (((bucket_id = 'covers'::text) AND ( SELECT current_user_is_active() AS current_user_is_active) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

create policy "covers_select_own" on "storage"."objects" as PERMISSIVE for SELECT to "authenticated" using (((bucket_id = 'covers'::text) AND ( SELECT current_user_is_active() AS current_user_is_active) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

create policy "covers_update_own" on "storage"."objects" as PERMISSIVE for UPDATE to "authenticated" using (((bucket_id = 'covers'::text) AND ( SELECT current_user_is_active() AS current_user_is_active) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))) with check (((bucket_id = 'covers'::text) AND ( SELECT current_user_is_active() AS current_user_is_active) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

create policy "import_videos_admin_delete" on "storage"."objects" as PERMISSIVE for DELETE to "authenticated" using (((bucket_id = 'import-videos'::text) AND ( SELECT current_user_has_permission('admin.manage_imports'::text) AS current_user_has_permission) AND (name ~~ ((( SELECT auth.uid() AS uid))::text || '/%'::text)) AND (NOT (EXISTS ( SELECT 1
   FROM (media_assets asset
     JOIN import_jobs job ON ((job.media_asset_id = asset.id)))
  WHERE ((asset.storage_path = objects.name) AND (job.kind = 'firework_video'::text))))) AND (NOT (EXISTS ( SELECT 1
   FROM import_run_outputs output
  WHERE (output.storage_path = objects.name))))));

create policy "import_videos_admin_insert" on "storage"."objects" as PERMISSIVE for INSERT to "authenticated" with check (((bucket_id = 'import-videos'::text) AND ( SELECT current_user_has_permission('admin.manage_imports'::text) AS current_user_has_permission) AND (name ~~ ((( SELECT auth.uid() AS uid))::text || '/%'::text))));

create policy "import_videos_admin_read" on "storage"."objects" as PERMISSIVE for SELECT to "authenticated" using (((bucket_id = 'import-videos'::text) AND ( SELECT current_user_has_permission('admin.manage_imports'::text) AS current_user_has_permission) AND ((name ~~ ((( SELECT auth.uid() AS uid))::text || '/%'::text)) OR (EXISTS ( SELECT 1
   FROM (media_assets asset
     JOIN import_jobs job ON ((job.media_asset_id = asset.id)))
  WHERE ((asset.storage_path = objects.name) AND (job.kind = 'firework_video'::text)))) OR (EXISTS ( SELECT 1
   FROM import_run_outputs output
  WHERE (output.storage_path = objects.name))))));

create policy "import_videos_admin_update" on "storage"."objects" as PERMISSIVE for UPDATE to "authenticated" using (((bucket_id = 'import-videos'::text) AND ( SELECT current_user_has_permission('admin.manage_imports'::text) AS current_user_has_permission) AND (name ~~ ((( SELECT auth.uid() AS uid))::text || '/%'::text)) AND (NOT (EXISTS ( SELECT 1
   FROM (media_assets asset
     JOIN import_jobs job ON ((job.media_asset_id = asset.id)))
  WHERE ((asset.storage_path = objects.name) AND (job.kind = 'firework_video'::text))))) AND (NOT (EXISTS ( SELECT 1
   FROM import_run_outputs output
  WHERE (output.storage_path = objects.name)))))) with check (((bucket_id = 'import-videos'::text) AND ( SELECT current_user_has_permission('admin.manage_imports'::text) AS current_user_has_permission) AND (name ~~ ((( SELECT auth.uid() AS uid))::text || '/%'::text)) AND (NOT (EXISTS ( SELECT 1
   FROM (media_assets asset
     JOIN import_jobs job ON ((job.media_asset_id = asset.id)))
  WHERE ((asset.storage_path = objects.name) AND (job.kind = 'firework_video'::text))))) AND (NOT (EXISTS ( SELECT 1
   FROM import_run_outputs output
  WHERE (output.storage_path = objects.name))))));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) select id, name, public, file_size_limit, allowed_mime_types from jsonb_populate_recordset(null::storage.buckets, '[{"allowed_mime_types": ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"], "file_size_limit": 262144000, "id": "import-videos", "name": "import-videos", "public": false}, {"allowed_mime_types": ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave", "audio/aac", "audio/mp4", "audio/x-m4a"], "file_size_limit": 52428800, "id": "audio", "name": "audio", "public": false}, {"allowed_mime_types": ["image/png", "image/jpeg"], "file_size_limit": 5242880, "id": "covers", "name": "covers", "public": true}, {"allowed_mime_types": ["image/webp"], "file_size_limit": 1048576, "id": "firework-previews", "name": "firework-previews", "public": true}]'::jsonb);
