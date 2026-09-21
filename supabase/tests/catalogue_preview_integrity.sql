begin;

do $$
declare
  target public.fireworks;
  preview public.firework_preview_images;
  revised public.firework_preview_images;
  multishot_id uuid;
begin
  select f.* into target from public.fireworks f
  join public.firework_preview_images p on p.firework_id = f.id
  where p.storage_path is not null limit 1;
  select * into preview from public.firework_preview_images where firework_id = target.id;
  update public.fireworks set primary_color = case when primary_color = '#123456' then '#654321' else '#123456' end where id = target.id;
  select * into revised from public.firework_preview_images where firework_id = target.id;
  if revised.source_revision <= preview.source_revision or revised.storage_path is not null
    or revised.source_signature is not null or revised.renderer_version is not null then
    raise exception 'Editing a firework did not invalidate its persisted preview';
  end if;
  if exists (select 1 from public.firework_preview_images p
    join public.multishot_fireworks shot on shot.multishot_id = p.multishot_id
    where shot.firework_id = target.id and p.storage_path is not null) then
    raise exception 'Editing a firework did not invalidate dependent multishot previews';
  end if;
  if has_table_privilege('authenticated', 'public.firework_preview_images', 'UPDATE')
    or has_table_privilege('anon', 'public.firework_preview_images', 'UPDATE') then
    raise exception 'Only the trusted capture service may publish previews';
  end if;
  if not has_table_privilege('anon', 'public.firework_preview_images', 'SELECT') then
    raise exception 'Public catalogue previews are unavailable';
  end if;
  begin
    insert into public.firework_preview_images (firework_id, firework_effect_id)
    values (target.id, target.firework_effect_id);
    raise exception 'Preview unexpectedly accepted multiple source identities';
  exception when check_violation then null;
  end;
end $$;

rollback;
