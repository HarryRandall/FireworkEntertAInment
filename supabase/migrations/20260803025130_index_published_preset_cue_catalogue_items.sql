create or replace function private.show_preset_cue_catalogue_item_ids(cues jsonb)
returns text[]
language sql
immutable
set search_path to ''
as $$
  select coalesce(array_agg(cue ->> 'catalogueItemId'), array[]::text[])
  from jsonb_array_elements(cues) as cue;
$$;

revoke execute on function private.show_preset_cue_catalogue_item_ids(jsonb) from public;

create index if not exists show_presets_published_cue_catalogue_item_ids_idx
  on public.show_presets
  using gin (private.show_preset_cue_catalogue_item_ids(preview_cues))
  where is_published;

create or replace function private.assert_published_presets_for_catalogue_item(
  p_catalogue_item_id uuid
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  preset public.show_presets%rowtype;
begin
  for preset in
    select show_preset.*
    from public.show_presets show_preset
    where show_preset.is_published
      and private.show_preset_cue_catalogue_item_ids(show_preset.preview_cues)
            @> array[p_catalogue_item_id::text]
    order by show_preset.id
  loop
    perform private.assert_show_preset_publishable(
      preset.id,
      preset.is_published,
      preset.published_at,
      preset.duration_seconds,
      preset.preview_cues
    );
  end loop;
end;
$$;
;
