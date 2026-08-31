alter table public.shows
  add column if not exists selected_cue_model text;

comment on column public.shows.selected_cue_model is
  'OpenRouter cue-assignment model selected by the creator. Null falls back to the server default.';
