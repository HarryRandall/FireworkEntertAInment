-- Style defaults are reusable saved renderer fragments, not live references.
-- Preserve the current rendered look by copying selected defaults into the
-- owning effect/firework JSON before dropping the old FK/link storage.

create or replace function pg_temp.deep_merge_jsonb(base jsonb, override jsonb)
returns jsonb
language sql
immutable
as $$
  select
    case
      when jsonb_typeof(coalesce(base, '{}'::jsonb)) = 'object'
        and jsonb_typeof(coalesce(override, '{}'::jsonb)) = 'object'
      then coalesce(
        (
          select jsonb_object_agg(key, value)
          from (
            select
              b.key,
              case
                when o.value is null then b.value
                else pg_temp.deep_merge_jsonb(b.value, o.value)
              end as value
            from jsonb_each(coalesce(base, '{}'::jsonb)) as b(key, value)
            left join jsonb_each(coalesce(override, '{}'::jsonb)) as o(key, value)
              on o.key = b.key

            union all

            select o.key, o.value
            from jsonb_each(coalesce(override, '{}'::jsonb)) as o(key, value)
            where not coalesce(base, '{}'::jsonb) ? o.key
          ) merged
        ),
        '{}'::jsonb
      )
      else coalesce(override, base, '{}'::jsonb)
    end;
$$;

with recursive
kind_order(kind, position) as (
  values
    ('star', 1),
    ('trail', 2),
    ('launch', 3),
    ('smoke', 4),
    ('strobe', 5),
    ('crackle', 6),
    ('split', 7),
    ('sound', 8)
),
effect_default_sources as (
  select id as firework_effect_id, 'star'::text as kind, star_style_default_id as style_default_id, 1 as priority
  from public.firework_effects
  where star_style_default_id is not null

  union all

  select id, 'trail'::text, trail_style_default_id, 1
  from public.firework_effects
  where trail_style_default_id is not null

  union all

  select firework_effect_id, kind, style_default_id, 2
  from public.firework_effect_style_default_links
),
effect_default_rows as (
  select distinct on (source.firework_effect_id, source.kind)
    source.firework_effect_id,
    source.kind,
    defaults.defaults_json::jsonb as defaults_json
  from effect_default_sources source
  join public.firework_style_defaults defaults
    on defaults.id = source.style_default_id
   and defaults.kind = source.kind
  order by source.firework_effect_id, source.kind, source.priority desc
),
effect_fragments as (
  select
    row.firework_effect_id,
    row.defaults_json,
    row_number() over (
      partition by row.firework_effect_id
      order by kind_order.position
    ) as rn
  from effect_default_rows row
  join kind_order on kind_order.kind = row.kind
),
effect_owners as (
  select distinct firework_effect_id
  from effect_fragments
),
merged_effect_defaults(firework_effect_id, rn, defaults_json) as (
  select firework_effect_id, 0::bigint, '{}'::jsonb
  from effect_owners

  union all

  select
    merged.firework_effect_id,
    fragment.rn,
    pg_temp.deep_merge_jsonb(merged.defaults_json, fragment.defaults_json)
  from merged_effect_defaults merged
  join effect_fragments fragment
    on fragment.firework_effect_id = merged.firework_effect_id
   and fragment.rn = merged.rn + 1
),
final_effect_defaults as (
  select distinct on (firework_effect_id)
    firework_effect_id,
    defaults_json
  from merged_effect_defaults
  order by firework_effect_id, rn desc
)
update public.firework_effects effect
set model_json = jsonb_set(
  coalesce(effect.model_json::jsonb, '{}'::jsonb),
  '{renderDefaults}',
  pg_temp.deep_merge_jsonb(
    final.defaults_json,
    coalesce(effect.model_json::jsonb -> 'renderDefaults', '{}'::jsonb)
  ),
  true
)
from final_effect_defaults final
where final.firework_effect_id = effect.id;

with recursive
kind_order(kind, position) as (
  values
    ('star', 1),
    ('trail', 2),
    ('launch', 3),
    ('smoke', 4),
    ('strobe', 5),
    ('crackle', 6),
    ('split', 7),
    ('sound', 8)
),
firework_default_sources as (
  select id as firework_id, 'star'::text as kind, star_style_default_id as style_default_id, 1 as priority
  from public.fireworks
  where star_style_default_id is not null

  union all

  select id, 'trail'::text, trail_style_default_id, 1
  from public.fireworks
  where trail_style_default_id is not null

  union all

  select firework_id, kind, style_default_id, 2
  from public.firework_style_default_links
),
firework_default_rows as (
  select distinct on (source.firework_id, source.kind)
    source.firework_id,
    source.kind,
    defaults.defaults_json::jsonb as defaults_json
  from firework_default_sources source
  join public.firework_style_defaults defaults
    on defaults.id = source.style_default_id
   and defaults.kind = source.kind
  order by source.firework_id, source.kind, source.priority desc
),
firework_fragments as (
  select
    row.firework_id,
    row.defaults_json,
    row_number() over (
      partition by row.firework_id
      order by kind_order.position
    ) as rn
  from firework_default_rows row
  join kind_order on kind_order.kind = row.kind
),
firework_owners as (
  select distinct firework_id
  from firework_fragments
),
merged_firework_defaults(firework_id, rn, defaults_json) as (
  select firework_id, 0::bigint, '{}'::jsonb
  from firework_owners

  union all

  select
    merged.firework_id,
    fragment.rn,
    pg_temp.deep_merge_jsonb(merged.defaults_json, fragment.defaults_json)
  from merged_firework_defaults merged
  join firework_fragments fragment
    on fragment.firework_id = merged.firework_id
   and fragment.rn = merged.rn + 1
),
final_firework_defaults as (
  select distinct on (firework_id)
    firework_id,
    defaults_json
  from merged_firework_defaults
  order by firework_id, rn desc
)
update public.fireworks firework
set render_overrides_json = pg_temp.deep_merge_jsonb(
  final.defaults_json,
  coalesce(firework.render_overrides_json::jsonb, '{}'::jsonb)
)
from final_firework_defaults final
where final.firework_id = firework.id;

drop table if exists public.firework_effect_style_default_links;
drop table if exists public.firework_style_default_links;

alter table if exists public.firework_effects
  drop column if exists star_style_default_id,
  drop column if exists trail_style_default_id;

alter table if exists public.fireworks
  drop column if exists star_style_default_id,
  drop column if exists trail_style_default_id;

drop index if exists public.show_analyses_show_latest_idx;
drop index if exists public.show_analyses_user_created_idx;
