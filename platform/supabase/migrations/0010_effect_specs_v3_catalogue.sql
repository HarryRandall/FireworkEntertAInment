-- Firework effect spec v3 catalogue wiring.
-- Keep legacy firework_specifications intact while new catalogue/product rows point at effect_specs.

alter table public.effect_specs
  drop constraint if exists effect_specs_version_check;

alter table public.effect_specs
  add constraint effect_specs_version_check check (version in (2, 3));

alter table public.catalogue_products
  add column if not exists effect_spec_id uuid references public.effect_specs(id) on delete set null;

create index if not exists catalogue_products_effect_spec_id_idx
  on public.catalogue_products (effect_spec_id);

comment on column public.effect_specs.spec_json is
  'Versioned standalone firework effect JSON. Version 3 stores CodePen-style shell parameters.';

comment on column public.show_cues.effect_spec_id is
  'Preferred standalone firework effect reference. firework_specification_id remains for legacy cues.';
