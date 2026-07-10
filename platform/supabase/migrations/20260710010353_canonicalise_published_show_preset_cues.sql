-- Convert published Explore preset cues from legacy fireworkSlug references to
-- stable catalogue IDs and part numbers. Draft data and out-of-duration cues
-- are intentionally outside this migration's scope.

do $$
begin
  if exists (
    select 1
    from public.show_presets
    where is_published
      and jsonb_typeof(preview_cues) is distinct from 'array'
  ) then
    raise exception 'Published show preset cues must be JSON arrays before canonicalisation.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from public.show_presets preset
    cross join lateral jsonb_array_elements(preset.preview_cues) as item(cue)
    where preset.is_published
      and jsonb_typeof(cue) is distinct from 'object'
  ) then
    raise exception 'Published show preset cues must contain only JSON objects.'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.show_presets'::regclass
      and tgname = 'show_templates_set_updated_at'
      and not tgisinternal
  ) then
    raise exception 'Expected show_presets updated_at trigger was not found.';
  end if;
end;
$$;

create temporary table show_preset_cue_canonicalisation as
with expanded as (
  select
    preset.id as preset_id,
    preset.updated_at as original_updated_at,
    cue_index,
    cue,
    id_item.id as id_item_id,
    id_item.part_number as id_item_slug,
    slug_item.id as slug_item_id,
    slug_item.part_number as slug_item_slug,
    legacy_item.id as legacy_item_id,
    legacy_item.part_number as legacy_item_slug
  from public.show_presets preset
  cross join lateral jsonb_array_elements(preset.preview_cues)
    with ordinality as item(cue, cue_index)
  left join public.catalogue_items id_item
    on id_item.id::text = cue->>'catalogueItemId'
  left join public.catalogue_items slug_item
    on slug_item.part_number = cue->>'catalogueItemSlug'
  left join public.catalogue_items legacy_item
    on legacy_item.part_number = cue->>'fireworkSlug'
  where preset.is_published
)
select
  preset_id,
  original_updated_at,
  cue_index,
  cue,
  id_item_id,
  slug_item_id,
  legacy_item_id,
  case
    when cue ? 'catalogueItemId' then id_item_id
    when cue ? 'catalogueItemSlug' then slug_item_id
    else legacy_item_id
  end as target_catalogue_item_id,
  case
    when cue ? 'catalogueItemId' then id_item_slug
    when cue ? 'catalogueItemSlug' then slug_item_slug
    else legacy_item_slug
  end as target_catalogue_item_slug
from expanded;

do $$
declare
  published_cue_count bigint;
  mapped_cue_count bigint;
begin
  if exists (
    select 1
    from show_preset_cue_canonicalisation
    where (
      id_item_id is not null
      and slug_item_id is not null
      and id_item_id <> slug_item_id
    ) or (
      id_item_id is not null
      and legacy_item_id is not null
      and id_item_id <> legacy_item_id
    ) or (
      slug_item_id is not null
      and legacy_item_id is not null
      and slug_item_id <> legacy_item_id
    )
  ) then
    raise exception 'Published show preset cue mapping is ambiguous.'
      using errcode = 'integrity_constraint_violation';
  end if;

  if exists (
    select 1
    from show_preset_cue_canonicalisation
    where target_catalogue_item_id is null
      or target_catalogue_item_slug is null
  ) then
    raise exception 'At least one published show preset cue has no unambiguous catalogue mapping.'
      using errcode = 'foreign_key_violation';
  end if;

  select coalesce(sum(jsonb_array_length(preview_cues)), 0)
  into published_cue_count
  from public.show_presets
  where is_published;

  select count(*) into mapped_cue_count
  from show_preset_cue_canonicalisation;

  if mapped_cue_count <> published_cue_count then
    raise exception 'Published cue mapping count changed from % to %.',
      published_cue_count,
      mapped_cue_count;
  end if;
end;
$$;

create temporary table rebuilt_published_show_preset_cues as
select
  preset_id,
  min(original_updated_at) as original_updated_at,
  count(*)::integer as cue_count,
  jsonb_agg(
    (cue - 'fireworkSlug')
      || jsonb_build_object(
        'catalogueItemId', target_catalogue_item_id,
        'catalogueItemSlug', target_catalogue_item_slug
      )
    order by cue_index
  ) as preview_cues
from show_preset_cue_canonicalisation
group by preset_id;

-- Preserve existing publication ordering. The normal trigger is temporarily
-- disabled because it always replaces updated_at during any update.
alter table public.show_presets disable trigger show_templates_set_updated_at;

update public.show_presets preset
set preview_cues = rebuilt.preview_cues,
    updated_at = rebuilt.original_updated_at
from rebuilt_published_show_preset_cues rebuilt
where preset.id = rebuilt.preset_id
  and preset.preview_cues is distinct from rebuilt.preview_cues;

alter table public.show_presets enable trigger show_templates_set_updated_at;

do $$
declare
  mapped_cue_count bigint;
  final_cue_count bigint;
begin
  if exists (
    select 1
    from rebuilt_published_show_preset_cues rebuilt
    join public.show_presets preset on preset.id = rebuilt.preset_id
    where jsonb_array_length(preset.preview_cues) <> rebuilt.cue_count
      or preset.updated_at <> rebuilt.original_updated_at
  ) then
    raise exception 'Published show preset cue count or timestamp changed during canonicalisation.';
  end if;

  if exists (
    select 1
    from public.show_presets preset
    cross join lateral jsonb_array_elements(preset.preview_cues) as cue_item(cue)
    left join public.catalogue_items item
      on item.id::text = cue->>'catalogueItemId'
     and item.part_number = cue->>'catalogueItemSlug'
    where preset.is_published
      and (
        item.id is null
        or cue ? 'fireworkSlug'
      )
  ) then
    raise exception 'Published show preset cue canonicalisation did not verify cleanly.';
  end if;

  select count(*) into mapped_cue_count
  from show_preset_cue_canonicalisation;

  select coalesce(sum(jsonb_array_length(preview_cues)), 0)
  into final_cue_count
  from public.show_presets
  where is_published;

  if final_cue_count <> mapped_cue_count then
    raise exception 'Published cue count changed from % to % during canonicalisation.',
      mapped_cue_count,
      final_cue_count;
  end if;
end;
$$;

drop table rebuilt_published_show_preset_cues;
drop table show_preset_cue_canonicalisation;
