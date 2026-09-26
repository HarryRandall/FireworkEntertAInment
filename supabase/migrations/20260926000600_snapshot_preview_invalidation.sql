begin;

-- Firework appearance is owned by its resolved snapshot. Capture the snapshot
-- change once even when the same save also updates the original overrides.
drop trigger fireworks_bump_preview_images on public.fireworks;
create trigger fireworks_bump_preview_images
  after update of firework_effect_id, primary_color, secondary_color, color_palette,
    caliber, duration_seconds, height_meters, variant_json, render_overrides_json,
    render_snapshot_json
  on public.fireworks
  for each row
  when (
    old.firework_effect_id is distinct from new.firework_effect_id or
    old.primary_color is distinct from new.primary_color or
    old.secondary_color is distinct from new.secondary_color or
    old.color_palette is distinct from new.color_palette or
    old.caliber is distinct from new.caliber or
    old.duration_seconds is distinct from new.duration_seconds or
    old.height_meters is distinct from new.height_meters or
    old.variant_json is distinct from new.variant_json or
    old.render_overrides_json is distinct from new.render_overrides_json or
    old.render_snapshot_json is distinct from new.render_snapshot_json
  ) execute function private.bump_firework_preview_images();

-- Editing a source effect must not invalidate posters for independent copies.
create or replace function private.bump_effect_preview_images() returns trigger
language plpgsql security definer set search_path = '' as $$
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
  where preview.firework_effect_id = new.id;
  return new;
end;
$$;

commit;
