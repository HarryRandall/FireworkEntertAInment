alter table public.firework_style_defaults
  drop constraint if exists firework_style_defaults_kind_check;

alter table public.firework_style_defaults
  add constraint firework_style_defaults_kind_check
  check (
    kind in (
      'geometry',
      'star',
      'trail',
      'launch',
      'smoke',
      'strobe',
      'crackle',
      'split',
      'sound'
    )
  );

comment on constraint firework_style_defaults_kind_check on public.firework_style_defaults is
  'Restricts reusable renderer defaults to editor-supported effect sections, including geometry.';
