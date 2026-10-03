-- Market reference data, sale rules and garden safety bands, with distances in metres.
create table public.markets (
  code text primary key,
  name text not null,
  currency char(3) not null,
  locale text not null,
  timezone text not null,
  min_age smallint not null check (min_age >= 0),
  units text not null check (units in ('metric', 'imperial')),
  regions text[] not null default '{}',
  licence_note text,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.markets enable row level security;
create trigger set_updated_at before update on public.markets
  for each row execute function private.set_updated_at();

create table public.sale_periods (
  id uuid primary key default gen_random_uuid(),
  market text not null references public.markets(code),
  region text,
  name text not null,
  rule jsonb not null check (jsonb_typeof(rule) = 'object'),
  requires_licence_outside boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sale_periods enable row level security;
create trigger set_updated_at before update on public.sale_periods
  for each row execute function private.set_updated_at();

create table public.safety_bands (
  market text not null references public.markets(code),
  band text not null check (band in ('small', 'medium', 'large')),
  max_distance_m smallint not null check (max_distance_m > 0),
  allowed_categories text[] not null,
  primary key (market, band),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.safety_bands enable row level security;
create trigger set_updated_at before update on public.safety_bands
  for each row execute function private.set_updated_at();

create index sale_periods_market_idx on public.sale_periods(market);

-- Markets access is granted separately for each operation.
create policy markets_select on public.markets for select to anon, authenticated
  using ((enabled or (select private.staff_role()) is not null));
create policy markets_insert on public.markets for insert to authenticated
  with check ((select private.staff_role()) in ('super_admin', 'catalogue_editor'));
create policy markets_update on public.markets for update to authenticated
  using ((select private.staff_role()) in ('super_admin', 'catalogue_editor'))
  with check ((select private.staff_role()) in ('super_admin', 'catalogue_editor'));
create policy markets_delete on public.markets for delete to authenticated
  using ((select private.staff_role()) in ('super_admin', 'catalogue_editor'));

-- Sale periods access is granted separately for each operation.
create policy sale_periods_select on public.sale_periods for select to anon, authenticated
  using ((exists (select from public.markets as reference_market where reference_market.code = sale_periods.market and reference_market.enabled) or (select private.staff_role()) is not null));
create policy sale_periods_insert on public.sale_periods for insert to authenticated
  with check ((select private.staff_role()) in ('super_admin', 'catalogue_editor'));
create policy sale_periods_update on public.sale_periods for update to authenticated
  using ((select private.staff_role()) in ('super_admin', 'catalogue_editor'))
  with check ((select private.staff_role()) in ('super_admin', 'catalogue_editor'));
create policy sale_periods_delete on public.sale_periods for delete to authenticated
  using ((select private.staff_role()) in ('super_admin', 'catalogue_editor'));

-- Safety bands access is granted separately for each operation.
create policy safety_bands_select on public.safety_bands for select to anon, authenticated
  using ((exists (select from public.markets as reference_market where reference_market.code = safety_bands.market and reference_market.enabled) or (select private.staff_role()) is not null));
create policy safety_bands_insert on public.safety_bands for insert to authenticated
  with check ((select private.staff_role()) in ('super_admin', 'catalogue_editor'));
create policy safety_bands_update on public.safety_bands for update to authenticated
  using ((select private.staff_role()) in ('super_admin', 'catalogue_editor'))
  with check ((select private.staff_role()) in ('super_admin', 'catalogue_editor'));
create policy safety_bands_delete on public.safety_bands for delete to authenticated
  using ((select private.staff_role()) in ('super_admin', 'catalogue_editor'));
