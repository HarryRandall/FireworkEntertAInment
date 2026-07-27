-- Keep repeated Jamendo selection lookups bounded to completed analyses owned
-- by the current user. Existing RLS continues to enforce row ownership.

create index if not exists song_analyses_jamendo_reuse_idx
  on public.song_analyses (user_id, source_track_id, completed_at desc)
  where source_provider = 'jamendo'
    and status = 'completed'
    and analysis_json is not null;
