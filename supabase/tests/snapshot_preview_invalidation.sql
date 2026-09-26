begin;

do $$
declare
  target public.fireworks;
  before_revision bigint;
  after_revision bigint;
  effect_before bigint;
begin
  select f.* into strict target from public.fireworks f
  join public.firework_preview_images p on p.firework_id = f.id
  where f.render_snapshot_json is not null order by f.id limit 1;
  select source_revision into before_revision from public.firework_preview_images where firework_id = target.id;
  update public.fireworks set render_snapshot_json = jsonb_set(render_snapshot_json, '{stars,outer,count}',
    to_jsonb(case when (render_snapshot_json #>> '{stars,outer,count}')::integer = 19 then 20 else 19 end)) where id = target.id;
  select source_revision into after_revision from public.firework_preview_images where firework_id = target.id;
  if after_revision <> before_revision + 1 then
    raise exception 'Snapshot-only edit must invalidate its poster exactly once';
  end if;
  if exists (select 1 from public.firework_preview_images p
    join public.multishot_fireworks shot on shot.multishot_id = p.multishot_id
    where shot.firework_id = target.id and p.storage_path is not null) then
    raise exception 'Snapshot-only edit kept stale multishot posters';
  end if;
  before_revision := after_revision;
  update public.fireworks set render_snapshot_json = render_snapshot_json where id = target.id;
  select source_revision into after_revision from public.firework_preview_images where firework_id = target.id;
  if after_revision <> before_revision then raise exception 'Unchanged snapshots invalidate posters'; end if;
  select source_revision into effect_before from public.firework_preview_images where firework_effect_id = target.firework_effect_id;
  update public.firework_effects set model_json = jsonb_set(model_json, '{previewTest}', 'true'::jsonb) where id = target.firework_effect_id;
  select source_revision into after_revision from public.firework_preview_images where firework_id = target.id;
  if after_revision <> before_revision then raise exception 'Source effect edit invalidated a copied firework'; end if;
  if (select source_revision from public.firework_preview_images where firework_effect_id = target.firework_effect_id) <> effect_before + 1 then
    raise exception 'Source effect edit did not invalidate its own poster';
  end if;
end $$;

rollback;
