begin;

drop trigger fireworks_bump_preview_images on public.fireworks;
create trigger fireworks_bump_preview_images
  after update of firework_effect_id, primary_color, secondary_color, color_palette,
    caliber, duration_seconds, height_meters, variant_json, render_overrides_json,
    render_snapshot_json, design, design_schema
  on public.fireworks for each row
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
    old.render_snapshot_json is distinct from new.render_snapshot_json or
    old.design is distinct from new.design or
    old.design_schema is distinct from new.design_schema
  ) execute function private.bump_firework_preview_images();

drop trigger firework_effects_bump_preview_images on public.firework_effects;
create trigger firework_effects_bump_preview_images
  after update of model_json, pattern_key, design, design_schema on public.firework_effects for each row
  when (old.model_json is distinct from new.model_json or old.pattern_key is distinct from new.pattern_key or old.design is distinct from new.design or old.design_schema is distinct from new.design_schema)
  execute function private.bump_effect_preview_images();
commit;
