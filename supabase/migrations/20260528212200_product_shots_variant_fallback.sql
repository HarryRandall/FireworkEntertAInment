-- Allow newly authored product shots to use the new firework variant model
-- without inventing a legacy effect_specs row. Existing rows keep their
-- effect_spec_id as a fallback while product_shots.firework_variant_id becomes
-- the preferred path.

alter table public.product_shots
  alter column effect_spec_id drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_shots_effect_or_variant_check'
      and conrelid = 'public.product_shots'::regclass
  ) then
    alter table public.product_shots
      add constraint product_shots_effect_or_variant_check
      check (effect_spec_id is not null or firework_variant_id is not null);
  end if;
end $$;
