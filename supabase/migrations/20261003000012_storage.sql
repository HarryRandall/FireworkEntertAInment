-- Bucket records and Storage-owned policies are not captured by application schema diffing.
insert into storage.buckets(id,name,public) values
  ('posters','posters',true),
  ('brand','brand',true),
  ('catalogue-media','catalogue-media',false),
  ('imports','imports',false),
  ('audio','audio',false),
  ('exports','exports',false);

revoke all on function private.storage_access(text,text,boolean) from public, anon, authenticated, service_role;
grant execute on function private.storage_access(text,text,boolean) to authenticated;
create policy posters_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'posters');
create policy posters_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'posters' and private.storage_access(bucket_id,name,true));
create policy posters_update on storage.objects for update to authenticated
  using (bucket_id = 'posters' and private.storage_access(bucket_id,name,true))
  with check (bucket_id = 'posters' and private.storage_access(bucket_id,name,true));
create policy posters_delete on storage.objects for delete to authenticated
  using (bucket_id = 'posters' and private.storage_access(bucket_id,name,true));
create policy brand_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'brand');
create policy brand_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'brand' and private.storage_access(bucket_id,name,true));
create policy brand_update on storage.objects for update to authenticated
  using (bucket_id = 'brand' and private.storage_access(bucket_id,name,true))
  with check (bucket_id = 'brand' and private.storage_access(bucket_id,name,true));
create policy brand_delete on storage.objects for delete to authenticated
  using (bucket_id = 'brand' and private.storage_access(bucket_id,name,true));
create policy catalogue_media_read on storage.objects for select to authenticated
  using (bucket_id = 'catalogue-media' and private.storage_access(bucket_id,name,false));
create policy catalogue_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'catalogue-media' and private.storage_access(bucket_id,name,true));
create policy catalogue_media_update on storage.objects for update to authenticated
  using (bucket_id = 'catalogue-media' and private.storage_access(bucket_id,name,true))
  with check (bucket_id = 'catalogue-media' and private.storage_access(bucket_id,name,true));
create policy catalogue_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'catalogue-media' and private.storage_access(bucket_id,name,true));
create policy imports_read on storage.objects for select to authenticated
  using (bucket_id = 'imports' and private.storage_access(bucket_id,name,false));
create policy imports_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'imports' and private.storage_access(bucket_id,name,true));
create policy imports_update on storage.objects for update to authenticated
  using (bucket_id = 'imports' and private.storage_access(bucket_id,name,true))
  with check (bucket_id = 'imports' and private.storage_access(bucket_id,name,true));
create policy imports_delete on storage.objects for delete to authenticated
  using (bucket_id = 'imports' and private.storage_access(bucket_id,name,true));
create policy audio_read on storage.objects for select to authenticated
  using (bucket_id = 'audio' and private.storage_access(bucket_id,name,false));
create policy audio_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'audio' and private.storage_access(bucket_id,name,true));
create policy audio_update on storage.objects for update to authenticated
  using (bucket_id = 'audio' and private.storage_access(bucket_id,name,true))
  with check (bucket_id = 'audio' and private.storage_access(bucket_id,name,true));
create policy audio_delete on storage.objects for delete to authenticated
  using (bucket_id = 'audio' and private.storage_access(bucket_id,name,true));
create policy exports_read on storage.objects for select to authenticated
  using (bucket_id = 'exports' and private.storage_access(bucket_id,name,false));
