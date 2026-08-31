alter table public.multishot_fireworks
  add column timeline_track_index integer not null default 0
  constraint multishot_fireworks_timeline_track_range
  check (timeline_track_index between 0 and 1999);

comment on column public.multishot_fireworks.timeline_track_index is
  'Zero-based editor track that keeps timeline placement stable when shot timing changes.';
