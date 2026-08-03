-- Preserve wider historical attribution while preventing new unsupported
-- soundtrack licences. Restricting only attribution writes lets the existing
-- lifecycle update and later clean up legacy rows without losing credit or
-- private Storage invariants.

create or replace function private.enforce_supported_song_analysis_source_licence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source_provider = 'jamendo'
    and (
      new.source_licence_name is null
      or new.source_licence_url is null
      or new.source_licence_name !~ '^(CC BY|CC0) [0-9]+(\.[0-9]+)?$'
      or new.source_licence_url !~ '^https://creativecommons\.org/(licenses/by|publicdomain/zero)/[0-9]+(\.[0-9]+)?/$'
    )
  then
    raise exception 'Unsupported Jamendo soundtrack licence.'
      using
        errcode = '23514',
        constraint = 'song_analyses_supported_source_licence_check';
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_supported_song_analysis_source_licence()
  from public, anon, authenticated, service_role;

drop trigger if exists enforce_supported_song_analysis_source_licence
  on public.song_analyses;

create trigger enforce_supported_song_analysis_source_licence
before insert or update of
  source_provider,
  source_track_id,
  source_title,
  source_artist,
  source_url,
  source_licence_name,
  source_licence_url
on public.song_analyses
for each row
execute function private.enforce_supported_song_analysis_source_licence();
