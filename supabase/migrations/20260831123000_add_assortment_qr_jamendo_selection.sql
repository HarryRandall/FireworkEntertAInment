-- A completed provider analysis can safely serve multiple independent QR
-- capabilities for the same funding user. Selection and storage paths are not
-- ownership boundaries, so keep indexed lookups without one-to-one constraints.
alter table public.assortment_song_selections
  drop constraint if exists assortment_song_selections_audio_path_key,
  drop constraint if exists assortment_song_selections_music_analysis_id_key;

create index if not exists assortment_song_selections_audio_path_idx
  on public.assortment_song_selections (audio_path);
create index if not exists assortment_song_selections_music_analysis_idx
  on public.assortment_song_selections (music_analysis_id)
  where music_analysis_id is not null;

comment on table public.assortment_song_selections is
  'Short-lived anonymous song selection capabilities funded by the owning retailer. Raw access tokens are never stored.';

-- Atomically bind a server-validated Jamendo track to the existing QR
-- selection model. The capability is revalidated inside the transaction and
-- the caller can never choose the funding user.
create or replace function public.prepare_assortment_jamendo_selection(
  p_assortment_token text,
  p_selection_id uuid,
  p_access_token_hash text,
  p_audio_path text,
  p_original_filename text,
  p_content_type text,
  p_size_bytes bigint,
  p_new_analysis_id uuid,
  p_source_track_id text,
  p_source_title text,
  p_source_artist text,
  p_source_url text,
  p_source_licence_name text,
  p_source_licence_url text,
  p_reusable_analysis_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_row public.assortment_public_links;
  assortment_row public.assortments;
  reusable_analysis public.song_analyses;
  selected_analysis_id uuid;
  selected_audio_path text;
  selected_original_filename text;
  selected_content_type text;
  selected_size_bytes bigint;
  reused boolean := false;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;
  if p_access_token_hash !~ '^[a-f0-9]{64}$'
    or p_source_track_id !~ '^[0-9]{1,24}$'
    or p_source_url <> ('https://www.jamendo.com/track/' || p_source_track_id)
    or p_source_licence_name !~ '^(CC BY|CC0) [0-9]'
    or p_source_licence_url !~ '^https://creativecommons[.]org/(licenses/by|publicdomain/zero)/'
  then
    raise exception 'Invalid Jamendo selection.' using errcode = '22023';
  end if;

  select * into link_row
  from public.assortment_public_links link
  where link.public_token = p_assortment_token
    and link.is_enabled = true
  for share;
  if not found then
    raise exception 'Assortment unavailable.' using errcode = 'P0002';
  end if;

  select * into assortment_row
  from public.assortments assortment
  where assortment.id = link_row.assortment_id
    and assortment.is_active = true
  for share;
  if not found or not exists (
    select 1 from public.users funding_user
    where funding_user.id = link_row.funding_user_id
      and funding_user.status = 'active'
  ) then
    raise exception 'Assortment unavailable.' using errcode = 'P0002';
  end if;

  if p_reusable_analysis_id is not null then
    select * into reusable_analysis
    from public.song_analyses analysis
    where analysis.id = p_reusable_analysis_id
      and analysis.user_id = link_row.funding_user_id
      and analysis.source_provider = 'jamendo'
      and analysis.source_track_id = p_source_track_id
      and analysis.status = 'completed'
      and analysis.analysis_json is not null
      and analysis.content_type is not null
      and analysis.size_bytes between 1 and 52428800
      and exists (
        select 1 from public.shows show_row
        where show_row.user_id = link_row.funding_user_id
          and show_row.music_analysis_id = analysis.id
      )
    for share;
    if not found then
      raise exception 'Reusable analysis unavailable.' using errcode = 'P0002';
    end if;

    selected_analysis_id := reusable_analysis.id;
    selected_audio_path := reusable_analysis.audio_path;
    selected_original_filename := reusable_analysis.original_filename;
    selected_content_type := reusable_analysis.content_type;
    selected_size_bytes := reusable_analysis.size_bytes;
    reused := true;
  else
    if p_new_analysis_id is null
      or p_content_type <> 'audio/mpeg'
      or p_size_bytes not between 1 and 52428800
      or p_audio_path <> (link_row.funding_user_id::text || '/assortment-qr/jamendo/'
        || p_selection_id::text || '-' || p_original_filename)
      or nullif(btrim(p_original_filename), '') is null
      or char_length(p_original_filename) > 180
      or nullif(btrim(p_source_title), '') is null
      or nullif(btrim(p_source_artist), '') is null
    then
      raise exception 'Invalid Jamendo selection.' using errcode = '22023';
    end if;

    perform private.reserve_assortment_ai_credit(
      link_row.funding_user_id,
      'music_analysis',
      'song_analyses',
      p_new_analysis_id,
      'music-analysis:' || p_new_analysis_id::text || ':reserve',
      jsonb_build_object(
        'assortmentId', assortment_row.id,
        'source', 'assortment_qr_jamendo',
        'audioPath', p_audio_path,
        'contentType', p_content_type,
        'sizeBytes', p_size_bytes,
        'sourceProvider', 'jamendo',
        'sourceTrackId', p_source_track_id
      )
    );

    insert into public.song_analyses (
      id,
      user_id,
      audio_path,
      original_filename,
      content_type,
      size_bytes,
      personality,
      status,
      runner_version,
      schema_version,
      source_provider,
      source_track_id,
      source_title,
      source_artist,
      source_url,
      source_licence_name,
      source_licence_url
    ) values (
      p_new_analysis_id,
      link_row.funding_user_id,
      p_audio_path,
      p_original_filename,
      p_content_type,
      p_size_bytes,
      'balanced',
      'running',
      'modal-librosa-2',
      '1.4.0',
      'jamendo',
      p_source_track_id,
      p_source_title,
      p_source_artist,
      p_source_url,
      p_source_licence_name,
      p_source_licence_url
    );

    selected_analysis_id := p_new_analysis_id;
    selected_audio_path := p_audio_path;
    selected_original_filename := p_original_filename;
    selected_content_type := p_content_type;
    selected_size_bytes := p_size_bytes;
  end if;

  insert into public.assortment_song_selections (
    id,
    assortment_id,
    funding_user_id,
    access_token_hash,
    audio_path,
    original_filename,
    content_type,
    size_bytes,
    music_analysis_id
  ) values (
    p_selection_id,
    assortment_row.id,
    link_row.funding_user_id,
    p_access_token_hash,
    selected_audio_path,
    selected_original_filename,
    selected_content_type,
    selected_size_bytes,
    selected_analysis_id
  );

  return jsonb_build_object(
    'ok', true,
    'analysisId', selected_analysis_id,
    'fundingUserId', link_row.funding_user_id,
    'reusedAnalysis', reused
  );
end;
$$;

revoke execute on function public.prepare_assortment_jamendo_selection(
  text, uuid, text, text, text, text, bigint, uuid, text, text, text, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.prepare_assortment_jamendo_selection(
  text, uuid, text, text, text, text, bigint, uuid, text, text, text, text, text, text, uuid
) to service_role;
