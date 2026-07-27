-- Keep provider-sourced soundtracks within the product's CC0 or plain CC BY
-- contract. This follows the earlier widening migration so environments that
-- already applied it converge back to the supported licence set.

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
