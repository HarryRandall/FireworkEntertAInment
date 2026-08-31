-- Admin-controlled catalogue fields sent to LLM cue generation.

alter table public.generation_settings
  add column if not exists product_catalogue_fields jsonb not null default
    '[
      "id",
      "name",
      "description",
      "durationSeconds",
      "shotCount",
      "isMultiShot",
      "heightMeters",
      "caliber",
      "shellType",
      "color",
      "colorPalette",
      "effects"
    ]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'generation_settings_product_catalogue_fields_array_check'
  ) then
    alter table public.generation_settings
      add constraint generation_settings_product_catalogue_fields_array_check
      check (jsonb_typeof(product_catalogue_fields) = 'array');
  end if;
end $$;

update public.generation_settings
set product_catalogue_fields = coalesce(
  product_catalogue_fields,
  '[
    "id",
    "name",
    "description",
    "durationSeconds",
    "shotCount",
    "isMultiShot",
    "heightMeters",
    "caliber",
    "shellType",
    "color",
    "colorPalette",
    "effects"
  ]'::jsonb
)
where key = 'show_cue_generation';
