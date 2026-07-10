-- Track the generated show behind an imported Explore preset. This makes
-- imports idempotent even if the source title changes, and gives admin a
-- durable provenance link instead of relying on a slug fingerprint.
alter table public.show_presets
  add column if not exists source_show_id uuid
    references public.shows(id) on delete set null;

-- The source show belongs to a user and is admin-only provenance. Anonymous
-- Explore reads receive only the public preset columns, even through a direct
-- PostgREST request.
revoke select on table public.show_presets from anon;
grant select (
  id,
  slug,
  title,
  theme,
  description,
  duration_seconds,
  budget_cents,
  total_cents,
  effects_count,
  time_of_day,
  mood_tags,
  preview_cues,
  is_featured,
  sort_order,
  created_at,
  updated_at,
  cover_shader,
  cover_image_path,
  is_published,
  published_at
) on table public.show_presets to anon;

do $$
declare
  public_column text;
begin
  if has_table_privilege('anon', 'public.show_presets', 'select') then
    raise exception 'anon retained table-wide show_presets SELECT.';
  end if;

  if has_column_privilege('anon', 'public.show_presets', 'source_show_id', 'select') then
    raise exception 'anon can read private show preset provenance.';
  end if;

  foreach public_column in array array[
    'id', 'slug', 'title', 'theme', 'description', 'duration_seconds',
    'budget_cents', 'total_cents', 'effects_count', 'time_of_day',
    'mood_tags', 'preview_cues', 'is_featured', 'sort_order', 'created_at',
    'updated_at', 'cover_shader', 'cover_image_path', 'is_published',
    'published_at'
  ] loop
    if not has_column_privilege('anon', 'public.show_presets', public_column, 'select') then
      raise exception 'anon is missing public show_presets column %.', public_column;
    end if;
  end loop;
end;
$$;

-- Earlier imports ended with the first eight MD5 characters of the source
-- show UUID. Backfill only unambiguous one-to-one matches, leaving any
-- uncertain historical row untouched for manual review.
with candidates as (
  select
    preset.id as preset_id,
    source_show.id as source_show_id,
    count(*) over (partition by preset.id) as preset_match_count,
    count(*) over (partition by source_show.id) as source_match_count
  from public.show_presets preset
  join public.shows source_show
    on right(preset.slug, 8) = left(md5(source_show.id::text), 8)
  where preset.source_show_id is null
)
update public.show_presets preset
set source_show_id = candidates.source_show_id
from candidates
where preset.id = candidates.preset_id
  and candidates.preset_match_count = 1
  and candidates.source_match_count = 1;

create unique index if not exists show_presets_source_show_id_key
  on public.show_presets (source_show_id)
  where source_show_id is not null;

comment on column public.show_presets.source_show_id is
  'Generated show imported into this curated preset; null for manually curated presets.';
