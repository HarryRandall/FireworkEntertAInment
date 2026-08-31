-- Widen accepted Creative Commons licences for provider-sourced soundtracks.
--
-- Browse and search now surface the full Jamendo Creative Commons catalogue, not
-- just CC0/CC BY, so the stored attribution constraint must accept every CC
-- variant (including the non-commercial and no-derivatives forms). Provider,
-- track-id and source-url invariants are unchanged.

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
      and source_licence_name ~ '^(CC0|CC BY(-NC)?(-SA|-ND)?) [0-9]+(\.[0-9]+)?$'
      and source_licence_url ~ '^https://creativecommons\.org/(licenses/by(-nc)?(-sa|-nd)?|publicdomain/zero)/[0-9]+(\.[0-9]+)?/$'
    )
  );
