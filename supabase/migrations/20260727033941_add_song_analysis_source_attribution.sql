-- Preserve licensed soundtrack provenance for provider-sourced audio.

alter table public.song_analyses
  add column if not exists source_provider text,
  add column if not exists source_track_id text,
  add column if not exists source_title text,
  add column if not exists source_artist text,
  add column if not exists source_url text,
  add column if not exists source_licence_name text,
  add column if not exists source_licence_url text;

alter table public.song_analyses
  drop constraint if exists song_analyses_source_attribution_check;

alter table public.song_analyses
  add constraint song_analyses_source_attribution_check
  check (
    (
      source_provider is null
      and source_track_id is null
      and source_title is null
      and source_artist is null
      and source_url is null
      and source_licence_name is null
      and source_licence_url is null
    )
    or
    (
      source_provider = 'jamendo'
      and source_track_id ~ '^[0-9]+$'
      and length(source_track_id) <= 24
      and length(trim(source_title)) between 1 and 180
      and length(trim(source_artist)) between 1 and 180
      and source_url = 'https://www.jamendo.com/track/' || source_track_id
      and source_licence_name ~ '^(CC BY|CC0) [0-9]+(\.[0-9]+)?$'
      and source_licence_url ~ '^https://creativecommons\.org/(licenses/by|publicdomain/zero)/[0-9]+(\.[0-9]+)?/$'
    )
  );

comment on column public.song_analyses.source_provider is
  'External soundtrack provider, currently jamendo; null for user uploads.';
comment on column public.song_analyses.source_track_id is
  'Provider-owned track identifier used for provenance and idempotent attribution.';
comment on column public.song_analyses.source_title is
  'Provider-supplied track title displayed with the soundtrack attribution.';
comment on column public.song_analyses.source_artist is
  'Provider-supplied artist name displayed with the soundtrack attribution.';
comment on column public.song_analyses.source_url is
  'Canonical provider page linked anywhere the sourced soundtrack is played.';
comment on column public.song_analyses.source_licence_name is
  'Short Creative Commons licence label for the sourced soundtrack.';
comment on column public.song_analyses.source_licence_url is
  'Canonical Creative Commons licence URL for the sourced soundtrack.';
