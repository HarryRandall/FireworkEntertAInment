create or replace function public.show_preset_composition_signature(p_preview_cues jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(string_agg(cue_key, '|' order by cue_key), 'no-resolved-cues')
  from (
    select distinct coalesce(
      nullif(cue.value ->> 'catalogueItemId', ''),
      nullif(cue.value ->> 'catalogueItemSlug', ''),
      nullif(cue.value ->> 'fireworkSlug', ''),
      'unresolved-cue'
    ) as cue_key
    from jsonb_array_elements(
      case
        when jsonb_typeof(p_preview_cues) = 'array' then p_preview_cues
        else '[]'::jsonb
      end
    ) as cue(value)
  ) as cue_keys;
$$;

revoke all on function public.show_preset_composition_signature(jsonb) from public;
revoke all on function public.show_preset_composition_signature(jsonb) from anon;
grant execute on function public.show_preset_composition_signature(jsonb)
  to authenticated, service_role;

alter table public.show_presets
  add column if not exists composition_signature text
  generated always as (public.show_preset_composition_signature(preview_cues)) stored;

alter table public.show_presets
  alter column composition_signature set not null;

grant select (composition_signature) on table public.show_presets to anon, authenticated;

comment on function public.show_preset_composition_signature(jsonb) is
  'Returns the stable set of catalogue references used by a preset cue timeline.';

comment on column public.show_presets.composition_signature is
  'Generated cue-composition key used to avoid repeating equivalent shows across Explore shelves.';
