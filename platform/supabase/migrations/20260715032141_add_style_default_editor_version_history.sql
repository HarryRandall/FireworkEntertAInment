alter table public.firework_editor_versions
  add column firework_style_default_id uuid
    references public.firework_style_defaults(id) on delete cascade;

alter table public.firework_editor_versions
  drop constraint firework_editor_versions_target_kind_check,
  drop constraint firework_editor_versions_target_fk_check;

alter table public.firework_editor_versions
  add constraint firework_editor_versions_target_kind_check
    check (target_kind in ('firework', 'effect', 'style_default')),
  add constraint firework_editor_versions_target_fk_check
    check (
      (
        target_kind = 'firework'
        and firework_id is not null
        and firework_effect_id is null
        and firework_style_default_id is null
      )
      or
      (
        target_kind = 'effect'
        and firework_effect_id is not null
        and firework_id is null
        and firework_style_default_id is null
      )
      or
      (
        target_kind = 'style_default'
        and firework_style_default_id is not null
        and firework_id is null
        and firework_effect_id is null
      )
    );

comment on column public.firework_editor_versions.firework_style_default_id is
  'Reusable renderer style default changed by this immutable editor version.';

comment on table public.firework_editor_versions is
  'Immutable admin editor version history for fireworks, base firework effects, and style defaults.';

create index firework_editor_versions_style_default_created_at_idx
  on public.firework_editor_versions (firework_style_default_id, created_at desc);
