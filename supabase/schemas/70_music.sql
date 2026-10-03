-- Shared track identities and immutable audio analyses pinned by show snapshots.
create table public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('jamendo','upload','licensed','owned')),
  provider_track_id text,
  title text not null, artist text,
  duration_ms int not null check (duration_ms > 0),
  audio_media_id uuid references public.media(id),
  preview_media_id uuid references public.media(id),
  waveform jsonb check (jsonb_typeof(waveform) = 'array'),
  genres text[] not null default '{}', moods text[] not null default '{}',
  bpm numeric(5,1) check (bpm > 0),
  licence_code text not null, licence_url text, attribution text,
  commercial_use boolean not null default false check (not commercial_use),
  public_performance text check (public_performance in ('none','retailer_covered','included')),
  status text not null default 'draft' check (status in ('draft','published','withdrawn')),
  check (provider <> 'jamendo' or nullif(provider_track_id,'') is not null),
  unique (provider,provider_track_id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
comment on column public.music_tracks.commercial_use is 'False while commercial music licensing is unconfirmed, including for trusted backend writes.';
create table public.music_analyses (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.music_tracks(id) on delete cascade,
  algorithm text not null check (length(algorithm) > 0),
  analysis jsonb not null check (jsonb_typeof(analysis) = 'object'),
  audio_sha256 text not null check (audio_sha256 ~ '^[0-9a-f]{64}$'),
  is_current boolean not null default true,
  reviewed_by uuid references public.profiles(id),
  unique (track_id,algorithm,audio_sha256),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
comment on column public.music_analyses.audio_sha256 is 'SHA-256 audio fingerprint encoded as 64 lower-case hexadecimal characters.';
create unique index music_analyses_current_idx on public.music_analyses(track_id) where is_current;
create index music_analyses_track_id_idx on public.music_analyses(track_id);
alter table public.music_tracks enable row level security;
alter table public.music_analyses enable row level security;
create trigger set_updated_at before update on public.music_tracks
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.music_analyses
  for each row execute function private.set_updated_at();
create policy music_tracks_read on public.music_tracks for select to anon,authenticated
  using (status = 'published' or (select private.staff_role()) is not null);
create policy music_tracks_insert on public.music_tracks for insert to authenticated
  with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy music_tracks_update on public.music_tracks for update to authenticated
  using ((select private.staff_role()) in ('super_admin','catalogue_editor'))
  with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));

create function private.can_read_music_analysis(p_track uuid,p_current boolean,p_analysis uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.staff_role() is not null or exists (
    select from public.music_tracks as track where track.id = p_track and track.status = 'published'
      and (p_current or exists (select from public.show_versions as version
        where version.soundtrack_analysis_id = p_analysis
          and (private.show_access(version.organisation_id,version.owner_id,false)
            or exists (select from public.shows as show where show.id = version.show_id
              and show.organisation_id is not null and show.status = 'live')))));
$$;
comment on function private.can_read_music_analysis(uuid,boolean,uuid) is 'Reads published current analyses or historical analyses pinned by a caller-accessible show; staff can inspect all.';
create policy music_analyses_read on public.music_analyses for select to anon,authenticated
  using (private.can_read_music_analysis(track_id,is_current,id));

-- Reanalysis changes the current pointer, never the audio features used by a saved show.
create function private.preserve_music_analysis()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  if (new.id,new.track_id,new.algorithm,new.analysis,new.audio_sha256,new.created_at)
    is distinct from (old.id,old.track_id,old.algorithm,old.analysis,old.audio_sha256,old.created_at) then
    raise exception using errcode = '23514', message = 'Music analysis payload is immutable';
  end if;
  return new;
end;
$$;
comment on function private.preserve_music_analysis() is 'Preserves analysed audio features while permitting current-pointer and reviewer updates.';
create trigger preserve_analysis before update on public.music_analyses
  for each row execute function private.preserve_music_analysis();

alter table public.shows add constraint shows_soundtrack_track_fk
  foreign key (soundtrack_track_id) references public.music_tracks(id);
alter table public.show_versions add constraint show_versions_soundtrack_analysis_fk
  foreign key (soundtrack_analysis_id) references public.music_analyses(id);

create function private.validate_show_soundtrack()
returns trigger language plpgsql security definer set search_path = '' as $$
#variable_conflict error
begin
  if new.soundtrack_analysis_id is not null and not exists (
    select from public.music_analyses as analysis join public.shows as show on show.id = new.show_id
      where analysis.id = new.soundtrack_analysis_id and analysis.track_id = show.soundtrack_track_id) then
    raise exception using errcode = '23514', message = 'Analysis must match show soundtrack';
  end if;
  if new.plan_session_id is not null and not exists (
    select from public.plan_sessions as session where session.id = new.plan_session_id
      and session.shopper_id = new.owner_id) then
    raise exception using errcode = '23514', message = 'Plan session must match show shopper';
  end if;
  return new;
end;
$$;
comment on function private.validate_show_soundtrack() is 'Checks pinned audio belongs to the show track and a planning session belongs to the shopper owner when saving a snapshot.';
create trigger validate_soundtrack before insert on public.show_versions
  for each row execute function private.validate_show_soundtrack();

-- Serialise shared-track reanalysis and reuse identical algorithm/audio results.
create function private.save_music_analysis(p_track uuid,p_algorithm text,p_analysis jsonb,p_audio_sha256 text)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_analysis uuid;
begin
  perform track.id from public.music_tracks as track where track.id = p_track for update;
  if not found then
    raise exception using errcode = '23503', message = 'Music track required';
  end if;
  select analysis.id into v_analysis from public.music_analyses as analysis
    where analysis.track_id = p_track and analysis.algorithm = p_algorithm and analysis.audio_sha256 = p_audio_sha256;
  update public.music_analyses set is_current = false where track_id = p_track and is_current;
  if v_analysis is null then
    insert into public.music_analyses(track_id,algorithm,analysis,audio_sha256)
      values (p_track,p_algorithm,p_analysis,p_audio_sha256) returning id into v_analysis;
  else
    update public.music_analyses set is_current = true where id = v_analysis;
  end if;
  return v_analysis;
end;
$$;
comment on function private.save_music_analysis(uuid,text,jsonb,text) is 'Atomically selects one current shared analysis per track, reusing an identical algorithm and audio hash; immutable historical features remain pinned. Returns its UUID.';
create function public.save_music_analysis(p_track uuid,p_algorithm text,p_analysis jsonb,p_audio_sha256 text)
returns uuid language sql set search_path = '' as $$ select private.save_music_analysis(p_track,p_algorithm,p_analysis,p_audio_sha256); $$;
comment on function public.save_music_analysis(uuid,text,jsonb,text) is 'Backend-only shared analysis installation; serialises the current pointer and returns the reused or created UUID.';

create function private.preserve_music_track_identity()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  if (new.id,new.provider,new.provider_track_id,new.created_at)
    is distinct from (old.id,old.provider,old.provider_track_id,old.created_at) then
    raise exception using errcode = '23514', message = 'Shared music track identity cannot change';
  end if;
  return new;
end;
$$;
comment on function private.preserve_music_track_identity() is 'Preserves the shared provider identity while allowing metadata and availability updates.';
create trigger preserve_track_identity before update on public.music_tracks
  for each row execute function private.preserve_music_track_identity();
