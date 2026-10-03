-- Shared database capabilities; optional partition management follows image availability.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_jsonschema with schema extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists supabase_vault with schema vault;

do $$
begin
  if exists (select from pg_catalog.pg_available_extensions where name = 'pg_partman') then
    create schema if not exists partman;
    create extension if not exists pg_partman with schema partman;
  else
    raise notice 'pg_partman is unavailable; event partitioning must use native PostgreSQL partitions.';
  end if;
end;
$$;

-- Identity and timestamp helpers shared by policies and mutable domain rows.
create schema if not exists private;

-- Returns the caller's Supabase user UUID, or null for a request without a user.
create or replace function private.uid()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid();
$$;

comment on function private.uid() is 'Returns the request user UUID; null means no authenticated user.';

-- Reads the server-issued anonymous claim, never editable user metadata.
create or replace function private.is_anon()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

comment on function private.is_anon() is 'Returns the JWT anonymous-user flag, defaulting to false when absent.';

-- Overwrites updated_at with transaction time (timestamptz) on the trigger's NEW row.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

comment on function private.set_updated_at() is 'BEFORE UPDATE row trigger: replaces updated_at with the current transaction timestamp.';

-- Returns the active caller's table-backed staff role; JWT role claims grant no staff rights.
create or replace function private.staff_role()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return (
    select staff.role from public.staff_roles as staff
    join public.profiles as profile on profile.id = staff.profile_id
    where staff.profile_id = private.uid() and profile.status = 'active'
      and not private.is_anon() and not profile.is_anonymous
  );
end;
$$;
comment on function private.staff_role() is 'Returns an active non-anonymous user staff role from staff_roles, or null.';

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

-- Auth identities, platform staff and retailer tenancy with scoped store access.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  is_anonymous boolean not null default true,
  locale text,
  market text references public.markets(code),
  status text not null default 'active' check (status in ('active', 'suspended', 'deactivated')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

create table public.staff_roles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('super_admin', 'catalogue_editor', 'reviewer', 'support', 'finance')),
  requires_mfa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.staff_roles enable row level security;
create trigger set_updated_at before update on public.staff_roles
  for each row execute function private.set_updated_at();

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  kind text check (kind in ('shop', 'garden_centre', 'supermarket', 'popup', 'online', 'other')),
  home_market text not null references public.markets(code),
  billing_currency char(3) not null,
  website text,
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'cancelling', 'suspended', 'closed')),
  onboarding jsonb not null default '{}' check (jsonb_typeof(onboarding) = 'object'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.organisations enable row level security;
create trigger set_updated_at before update on public.organisations
  for each row execute function private.set_updated_at();

create table public.organisation_markets (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  market text not null references public.markets(code),
  primary key (organisation_id, market),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.organisation_markets enable row level security;
create trigger set_updated_at before update on public.organisation_markets
  for each row execute function private.set_updated_at();

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  slug text not null,
  market text not null references public.markets(code),
  region text,
  address jsonb,
  postcode text,
  location extensions.geography(point),
  timezone text not null,
  licence text not null check (licence in ('seasonal', 'all_year')),
  opening_hours jsonb,
  shopper_settings jsonb not null default '{}' check (jsonb_typeof(shopper_settings) = 'object'),
  status text not null default 'open' check (status in ('open', 'closed', 'archived')),
  unique (organisation_id, slug),
  unique (organisation_id, id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.stores enable row level security;
create trigger set_updated_at before update on public.stores
  for each row execute function private.set_updated_at();

create table public.memberships (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'staff')),
  store_ids uuid[],
  primary key (organisation_id, profile_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.memberships enable row level security;
create trigger set_updated_at before update on public.memberships
  for each row execute function private.set_updated_at();

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  email extensions.citext not null,
  role text not null check (role in ('owner', 'manager', 'staff')),
  store_ids uuid[],
  token_hash text not null unique,
  invited_by uuid references public.profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.invitations enable row level security;
create trigger set_updated_at before update on public.invitations
  for each row execute function private.set_updated_at();

create table public.branding (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  store_id uuid,
  logo_media_id uuid,
  accent text check (accent ~ '^#[0-9a-f]{6}$'),
  theme text not null default 'night' check (theme in ('night', 'system')),
  welcome text check (char_length(welcome) <= 90),
  footer text,
  foreign key (organisation_id, store_id) references public.stores(organisation_id, id) on delete cascade,
  unique nulls not distinct (organisation_id, store_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.branding enable row level security;
create trigger set_updated_at before update on public.branding
  for each row execute function private.set_updated_at();

comment on column public.branding.logo_media_id is 'Nullable reference to public.media(id); stores the organisation logo media UUID.';
comment on column public.branding.welcome is 'Store greeting, limited to 90 characters by the product design.';
create index stores_organisation_id_idx on public.stores(organisation_id);
create index memberships_profile_id_idx on public.memberships(profile_id);
create index invitations_organisation_id_idx on public.invitations(organisation_id);
create index invitations_invited_by_idx on public.invitations(invited_by);
create index branding_store_id_idx on public.branding(store_id);

-- Returns organisations where the active caller meets a recognised minimum membership role.
create or replace function private.org_ids(min_role text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select member.organisation_id
  from public.memberships as member
  join public.profiles as profile on profile.id = member.profile_id
  where member.profile_id = private.uid() and profile.status = 'active'
    and not private.is_anon() and not profile.is_anonymous
    and case min_role
      when 'staff' then member.role in ('staff', 'manager', 'owner')
      when 'manager' then member.role in ('manager', 'owner')
      when 'owner' then member.role = 'owner'
      else false
    end;
$$;
comment on function private.org_ids(text) is 'Returns caller organisation UUIDs at or above staff, manager or owner; unknown roles return no rows.';

-- Fixed retailer permissions; unknown roles and permissions fail closed.
create or replace function private.org_role_can(member_role text, permission text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(case member_role
    when 'owner' then permission = any(array[
      'labels.print', 'qr.manage', 'range.manage', 'prices.manage',
      'customers.view', 'insights.view', 'billing.manage', 'team.manage'])
    when 'manager' then permission = any(array[
      'labels.print', 'qr.manage', 'range.manage', 'prices.manage',
      'customers.view', 'insights.view'])
    when 'staff' then permission = 'labels.print'
    else false
  end, false);
$$;
comment on function private.org_role_can(text, text) is 'Checks the fixed owner, manager and staff permission map; unknown input is denied.';

-- Organisation-wide writes require an unrestricted membership; a store list never broadens access.
create or replace function private.can(org uuid, permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select from public.memberships as member
    where member.organisation_id = org
      and member.organisation_id in (select private.org_ids('staff'))
      and member.profile_id = private.uid() and member.store_ids is null
      and private.org_role_can(member.role, permission)
  );
$$;
comment on function private.can(uuid, text) is 'Checks an organisation-wide permission for the active caller; store-restricted memberships are denied.';

-- Checks both store ownership and membership scope, including an explicitly empty store list.
create or replace function private.store_access(org uuid, store uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select from public.memberships as member
    join public.stores as location on location.organisation_id = member.organisation_id
    where member.organisation_id = org and location.id = store
      and member.organisation_id in (select private.org_ids('staff'))
      and member.profile_id = private.uid()
      and (member.store_ids is null or store = any(member.store_ids))
  );
$$;
comment on function private.store_access(uuid, uuid) is 'Checks caller membership and store UUID scope inside the supplied organisation; null scope means all stores.';

-- Checks a retailer permission at one store; null store requests organisation-wide access.
create or replace function private.can_store(org uuid, store uuid, permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when store is null then private.can(org, permission)
    else private.store_access(org, store) and exists (
      select from public.memberships as member
      where member.organisation_id = org and member.profile_id = private.uid()
        and private.org_role_can(member.role, permission)
    )
  end;
$$;
comment on function private.can_store(uuid, uuid, text) is 'Checks a permission for one scoped store, or organisation-wide access when store is null.';

-- Rejects store scopes containing nulls, unknown stores or stores from another organisation.
create or replace function private.validate_store_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.store_ids is not null and exists (
    select from pg_catalog.unnest(new.store_ids) as scoped_store(id)
    where scoped_store.id is null or not exists (
      select from public.stores as location
      where location.id = scoped_store.id and location.organisation_id = new.organisation_id
    )
  ) then
    raise exception 'Store scope must belong to the same organisation' using errcode = '23514';
  end if;
  return new;
end;
$$;
comment on function private.validate_store_scope() is 'Validates every supplied store UUID against NEW.organisation_id before membership or invitation writes.';
create trigger validate_store_scope before insert or update on public.memberships
  for each row execute function private.validate_store_scope();
create trigger validate_store_scope before insert or update on public.invitations
  for each row execute function private.validate_store_scope();

-- Auth owns email and anonymous status; account upgrades keep the original profile UUID.
create or replace function private.sync_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, is_anonymous)
  values (new.id, new.email, coalesce(new.is_anonymous, false))
  on conflict (id) do update
    set email = excluded.email, is_anonymous = excluded.is_anonymous;
  return new;
end;
$$;
comment on function private.sync_auth_profile() is 'Mirrors Auth email and anonymous status on insertion or account changes; preserves user-edited profile fields.';

-- Profiles access is granted separately for each operation.
create policy profiles_select on public.profiles for select to authenticated
  using ((id = (select private.uid()) or (select private.staff_role()) is not null or exists (select from public.memberships as member where member.profile_id = profiles.id and member.organisation_id in (select private.org_ids('staff')))));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select private.uid()))
  with check (id = (select private.uid()));

-- Staff roles access is granted separately for each operation.
create policy staff_roles_select on public.staff_roles for select to authenticated
  using ((select private.staff_role()) = 'super_admin');
create policy staff_roles_insert on public.staff_roles for insert to authenticated
  with check ((select private.staff_role()) = 'super_admin');
create policy staff_roles_update on public.staff_roles for update to authenticated
  using ((select private.staff_role()) = 'super_admin')
  with check ((select private.staff_role()) = 'super_admin');
create policy staff_roles_delete on public.staff_roles for delete to authenticated
  using ((select private.staff_role()) = 'super_admin');

-- Organisations access is granted separately for each operation.
create policy organisations_select on public.organisations for select to authenticated
  using (((select private.staff_role()) is not null or id in (select private.org_ids('staff'))));
create policy organisations_insert on public.organisations for insert to authenticated
  with check ((select private.staff_role()) = 'super_admin');
create policy organisations_update on public.organisations for update to authenticated
  using (((select private.staff_role()) = 'super_admin' or private.can(id, 'team.manage')))
  with check (((select private.staff_role()) = 'super_admin' or private.can(id, 'team.manage')));

-- Organisation markets access is granted separately for each operation.
create policy organisation_markets_select on public.organisation_markets for select to authenticated
  using (((select private.staff_role()) is not null or organisation_id in (select private.org_ids('staff'))));
create policy organisation_markets_insert on public.organisation_markets for insert to authenticated
  with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'team.manage')));
create policy organisation_markets_update on public.organisation_markets for update to authenticated
  using (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'team.manage')))
  with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'team.manage')));
create policy organisation_markets_delete on public.organisation_markets for delete to authenticated
  using (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'team.manage')));

-- Stores access is granted separately for each operation.
create policy stores_select on public.stores for select to authenticated
  using (((select private.staff_role()) is not null or private.store_access(organisation_id, id)));
create policy stores_insert on public.stores for insert to authenticated
  with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'range.manage')));
create policy stores_update on public.stores for update to authenticated
  using (((select private.staff_role()) = 'super_admin' or private.can_store(organisation_id, id, 'range.manage')))
  with check (((select private.staff_role()) = 'super_admin' or private.can_store(organisation_id, id, 'range.manage')));

-- Memberships access is granted separately for each operation.
create policy memberships_select on public.memberships for select to authenticated
  using (((select private.staff_role()) is not null or organisation_id in (select private.org_ids('staff'))));
create policy memberships_insert on public.memberships for insert to authenticated
  with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'team.manage')));
create policy memberships_update on public.memberships for update to authenticated
  using (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'team.manage')))
  with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'team.manage')));
create policy memberships_delete on public.memberships for delete to authenticated
  using (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'team.manage')));

-- Invitations access is granted separately for each operation.
create policy invitations_select on public.invitations for select to authenticated
  using (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'team.manage')));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'team.manage')));
create policy invitations_update on public.invitations for update to authenticated
  using (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'team.manage')))
  with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'team.manage')));

-- Branding access is granted separately for each operation.
create policy branding_select on public.branding for select to authenticated
  using (((select private.staff_role()) is not null or (store_id is null and organisation_id in (select private.org_ids('staff'))) or private.store_access(organisation_id, store_id)));
create policy branding_insert on public.branding for insert to authenticated
  with check (((select private.staff_role()) = 'super_admin' or private.can_store(organisation_id, store_id, 'qr.manage')));
create policy branding_update on public.branding for update to authenticated
  using (((select private.staff_role()) = 'super_admin' or private.can_store(organisation_id, store_id, 'qr.manage')))
  with check (((select private.staff_role()) = 'super_admin' or private.can_store(organisation_id, store_id, 'qr.manage')));
create policy branding_delete on public.branding for delete to authenticated
  using (((select private.staff_role()) = 'super_admin' or private.can_store(organisation_id, store_id, 'qr.manage')));

-- Locks an invitation while validating Auth identity and creating its scoped membership.
create or replace function private.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_user_id uuid := private.uid();
  v_email extensions.citext;
  v_invitation public.invitations%rowtype;
begin
  select actor.email into v_email from auth.users as actor
  join public.profiles as profile on profile.id = actor.id
  where actor.id = v_user_id and actor.email_confirmed_at is not null
    and not coalesce(actor.is_anonymous, false) and profile.status = 'active';
  if v_email is null then
    raise exception 'A verified email account is required' using errcode = '42501';
  end if;
  if p_token is null or p_token = '' then
    raise exception 'Invitation is invalid' using errcode = '22023';
  end if;
  select invitation.* into v_invitation from public.invitations as invitation
  where invitation.token_hash = pg_catalog.encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;
  if not found then
    raise exception 'Invitation is invalid' using errcode = '22023';
  end if;
  if v_invitation.accepted_by = v_user_id then
    return v_invitation.organisation_id;
  end if;
  if pg_catalog.lower(v_invitation.email::text) <> pg_catalog.lower(v_email::text) or v_invitation.accepted_at is not null
    or v_invitation.revoked_at is not null or v_invitation.expires_at <= now() then
    raise exception 'Invitation cannot be accepted by this account' using errcode = '42501';
  end if;
  -- Existing membership rights are never overwritten by an invitation.
  insert into public.memberships (organisation_id, profile_id, role, store_ids)
  values (v_invitation.organisation_id, v_user_id, v_invitation.role, v_invitation.store_ids)
  on conflict (organisation_id, profile_id) do nothing;
  update public.invitations as invitation set accepted_at = now(), accepted_by = v_user_id
  where invitation.id = v_invitation.id;
  return v_invitation.organisation_id;
end;
$$;
comment on function private.accept_invitation(text) is 'Accepts a SHA-256 token for the active verified Auth email in one locked transaction; repeats by its accepting user return the organisation UUID.';

-- The API wrapper delegates the fenced multi-row write without elevating itself.
create or replace function public.accept_invitation(p_token text)
returns uuid language sql set search_path = ''
as $$ select private.accept_invitation(p_token); $$;
comment on function public.accept_invitation(text) is 'Accepts an invitation using the signed-in verified email and returns its organisation UUID.';

-- Exposes only the current caller's already fenced table-backed staff role to the API.
create or replace function public.current_staff_role()
returns text language sql stable set search_path = ''
as $$ select private.staff_role(); $$;
comment on function public.current_staff_role() is 'Returns the active caller staff role from staff_roles, never editable metadata or JWT staff claims.';

-- Renderer documents, immutable effect history and media metadata.
-- BEGIN GENERATED DESIGN SCHEMA
-- Generated from packages/fireworks/schema/design.v1.json; use pnpm db:documents to refresh.
create or replace function private.design_schema()
returns json
language sql
immutable
set search_path = ''
as $function$
  select $schema${"$schema":"http://json-schema.org/draft-07/schema#","$id":"https://showcrafter.app/schema/design.v1.json","title":"ShowCrafter design v1","description":"Stored renderer input. Version 1 is recorded externally as design_schema; defaults are authoring annotations, never applied during validation. All stored fields are explicit.","definitions":{"hexColour":{"type":"string","pattern":"^#[0-9a-fA-F]{6}$","default":"#8f7bff"},"vectorM":{"type":"array","items":[{"type":"number","minimum":-1000,"maximum":1000,"default":0,"description":"Metres on the world x, y or z axis."},{"type":"number","minimum":-1000,"maximum":1000,"default":0,"description":"Metres on the world x, y or z axis."},{"type":"number","minimum":-1000,"maximum":1000,"default":0,"description":"Metres on the world x, y or z axis."}],"minItems":3,"maxItems":3,"additionalItems":false},"direction":{"type":"array","items":[{"type":"number","minimum":-1,"maximum":1,"default":0,"description":"Direction component, not a position."},{"type":"number","minimum":-1,"maximum":1,"default":0,"description":"Direction component, not a position."},{"type":"number","minimum":-1,"maximum":1,"default":0,"description":"Direction component, not a position."}],"minItems":3,"maxItems":3,"additionalItems":false},"colourValue":{"anyOf":[{"$ref":"#/definitions/hexColour"},{"type":"array","items":{"$ref":"#/definitions/hexColour"},"minItems":1,"maxItems":16}]},"colourStop":{"type":"array","items":[{"type":"number","minimum":0,"maximum":2,"default":0,"description":"Normalised star lifetime."},{"$ref":"#/definitions/colourValue"}],"minItems":2,"maxItems":2,"additionalItems":false},"colour":{"type":"object","additionalProperties":false,"properties":{"mode":{"type":"string","enum":["solid","alternate","random","per_star"],"default":"solid"},"stops":{"type":"array","items":{"$ref":"#/definitions/colourStop"},"minItems":2,"maxItems":32},"reignition":{"type":"object","additionalProperties":false,"required":["at","duration","amount"],"properties":{"at":{"type":"number","minimum":0,"maximum":1,"default":0.55},"duration":{"type":"number","exclusiveMinimum":0,"maximum":1,"default":0.1},"amount":{"type":"number","minimum":0,"maximum":10,"default":0.5}}}},"required":["mode","stops"],"description":"Piecewise linear in linear RGB over normalised life; stops may extend past 1 for a late colour change. Each value is a hex colour or a palette. Select the same index at every stop: solid first, alternate cycles, random seeded, per_star explicit index. Duplicate times encode steps. Stops are ordered, begin at 0 and end at or beyond 1. Fade is applied separately."},"brightnessStop":{"type":"array","items":[{"type":"number","minimum":0,"maximum":1,"default":0,"description":"Normalised lifetime."},{"type":"number","minimum":0,"maximum":10,"default":1,"description":"Brightness multiplier, independent of the burn fade."}],"minItems":2,"maxItems":2,"additionalItems":false},"brightness":{"type":"array","items":{"$ref":"#/definitions/brightnessStop"},"minItems":2,"maxItems":32,"description":"Ordered piecewise linear brightness multipliers, from time 0 to 1. Duplicate times encode steps. Multiplied by the fade envelope."},"head":{"type":"object","additionalProperties":false,"properties":{"size":{"type":"number","minimum":0,"maximum":10,"default":1,"description":"Relative head size."},"visible":{"type":"boolean","default":true},"halo":{"type":"number","minimum":0,"maximum":4,"default":1,"description":"Halo strength. If absent: 0 for strobe, otherwise 1."}},"required":["size","visible"]},"trail":{"type":"object","additionalProperties":false,"properties":{"sparks":{"type":"integer","minimum":0,"maximum":10000,"default":18,"description":"Nominal live spark count before renderer density tuning."},"length_s":{"type":"number","minimum":0.001,"maximum":20,"default":0.5,"description":"Base spark lifetime in seconds, before renderer tuning."},"spread_m_s":{"type":"number","minimum":0,"maximum":200,"default":1.4,"description":"Spark ejection speed in metres per second."},"gravity_m_s2":{"type":"number","minimum":-40,"maximum":100,"default":3,"description":"Spark acceleration in metres per second squared."},"drag_per_s":{"type":"number","minimum":0.001,"maximum":30,"default":2.6,"description":"Drag coefficient in inverse seconds."},"size":{"type":"number","minimum":0,"maximum":10,"default":1,"description":"Relative spark size."},"flicker":{"type":"number","minimum":0,"maximum":1,"default":0.3,"description":"Dimensionless multiplier or fraction."},"colour":{"anyOf":[{"type":"string","enum":["house","star"],"default":"house"},{"$ref":"#/definitions/hexColour"}]},"glitter":{"type":"number","minimum":0,"maximum":1,"default":0,"description":"Dimensionless multiplier or fraction."},"glitter_delay_s":{"type":"number","minimum":0,"maximum":20,"default":0.35,"description":"Seconds before glitter ignition."},"fork":{"type":"number","minimum":0,"maximum":1,"default":0,"description":"Dimensionless multiplier or fraction."}},"required":["sparks","length_s","spread_m_s","gravity_m_s2","drag_per_s","size","flicker","colour","glitter","glitter_delay_s","fork"]},"modifier":{"type":"object","additionalProperties":false,"properties":{"kind":{"type":"string","enum":["crackle","strobe","twinkle","crossette","ghost","fish","bees","flutter","pop","glitter","twist","split","whistle"]},"at":{"type":"number","minimum":0,"maximum":1,"default":0.7,"description":"Trigger as a fraction of each star lifetime."},"rate_hz":{"type":"number","minimum":0.001,"maximum":500,"default":12,"description":"Strobe cycles or twinkle samples per second."},"count":{"type":"integer","minimum":1,"maximum":400,"default":8,"description":"Dimensionless multiplier or fraction."},"amount":{"type":"number","minimum":-20,"maximum":20,"default":1,"description":"Dimensionless multiplier or fraction."},"spread":{"type":"string","enum":["burst","continuous"],"default":"burst"},"gap":{"type":"number","minimum":0,"maximum":1,"default":0.12,"description":"Ghost dark interval as a lifetime fraction."},"angular_speed_rad_s":{"type":"number","minimum":-500,"maximum":500,"default":0,"description":"Twist angular speed in radians per second."},"rate_rad_s":{"type":"number","minimum":0,"maximum":500,"default":12,"description":"Fish wriggle angular speed in radians per second."}},"required":["kind","at","rate_hz","count","amount","spread","gap","angular_speed_rad_s","rate_rad_s"]},"layer":{"type":"object","additionalProperties":false,"properties":{"id":{"type":"string","minLength":1,"maxLength":64,"pattern":"^[A-Za-z0-9][A-Za-z0-9_-]*$"},"name":{"type":"string","minLength":1,"maxLength":120,"default":"Stars"},"pattern":{"type":"string","enum":["sphere","ring","double_ring","heart","spiral","random","fan","cone","straight","sequence","bottom"],"default":"sphere"},"count":{"type":"integer","minimum":0,"maximum":10000,"default":64,"description":"Dimensionless multiplier or fraction."},"radius_m":{"type":"number","minimum":0,"maximum":500,"default":26,"description":"Asymptotic travel radius in metres, not diameter."},"tilt":{"type":"number","minimum":-2,"maximum":2,"default":0.4,"description":"Dimensionless ring tilt: angle = tilt * pi / 2 + 0.3 radians. The range -2 to 2 permits a half turn in either direction around the fixed offset."},"speed_var":{"type":"number","minimum":0,"maximum":1,"default":0.22,"description":"Dimensionless multiplier or fraction."},"drag_per_s":{"type":"number","minimum":0.001,"maximum":30,"default":2.2,"description":"Closed-form drag coefficient in inverse seconds, must be positive."},"gravity_m_s2":{"type":"number","minimum":-40,"maximum":100,"default":6,"description":"Acceleration in metres per second squared."},"life_s":{"type":"number","minimum":0.001,"maximum":120,"default":2.2,"description":"Star burn lifetime in seconds."},"life_var":{"type":"number","minimum":0,"maximum":1,"default":0.2,"description":"Dimensionless multiplier or fraction."},"delay_s":{"type":"number","minimum":0,"maximum":120,"default":0,"description":"Seconds after this break; prototype event delays move to break.at_s."},"offset_m":{"$ref":"#/definitions/vectorM"},"flash":{"type":"boolean","default":true},"hidden":{"type":"boolean","default":false},"colour":{"$ref":"#/definitions/colour"},"brightness":{"$ref":"#/definitions/brightness"},"head":{"$ref":"#/definitions/head"},"trail":{"$ref":"#/definitions/trail"},"modifiers":{"type":"array","items":{"$ref":"#/definitions/modifier"},"minItems":0,"maxItems":16}},"required":["id","name","pattern","count","radius_m","tilt","speed_var","drag_per_s","gravity_m_s2","life_s","life_var","delay_s","offset_m","flash","hidden","colour","brightness","head","trail","modifiers"]},"core":{"type":"object","additionalProperties":false,"properties":{"enabled":{"type":"boolean","default":true},"colour":{"type":"string","pattern":"^#[0-9a-fA-F]{6}$","default":"#ff3b2f"},"count":{"type":"integer","minimum":0,"maximum":10000,"default":110,"description":"Dimensionless multiplier or fraction."},"radius":{"type":"number","minimum":0,"maximum":4,"default":0.5,"description":"Fraction of layer radius, not metres."},"flash":{"type":"number","minimum":0,"maximum":10,"default":1,"description":"Flash and report strength."},"flash_on":{"type":"boolean","default":true},"ring":{"type":"boolean","default":false}},"required":["enabled","colour","count","radius","flash","flash_on","ring"]},"fade":{"type":"object","additionalProperties":false,"properties":{"white_hot":{"type":"number","minimum":0,"maximum":1,"default":0.03,"description":"Lifetime fraction, multiplied by 0.5 + each star life hash."},"ember_at":{"type":"number","minimum":0,"maximum":1,"default":0.8,"description":"Lifetime fraction at which the warm shift starts."},"fade_at":{"type":"number","minimum":0,"maximum":1,"default":0.72,"description":"Lifetime fraction at which linear fade-out starts."},"prime_s":{"type":"number","minimum":0,"maximum":10,"default":0.25,"description":"Orange ignition ramp in seconds."}},"required":["white_hot","ember_at","fade_at","prime_s"]},"break":{"type":"object","additionalProperties":false,"properties":{"at_s":{"type":"number","minimum":0,"maximum":120,"default":0,"description":"Seconds after launch apex; for mines, after firing."},"core":{"$ref":"#/definitions/core"},"fade":{"$ref":"#/definitions/fade"},"layers":{"type":"array","items":{"$ref":"#/definitions/layer"},"minItems":1,"maxItems":32}},"required":["at_s","core","fade","layers"]},"launch":{"type":"object","additionalProperties":false,"properties":{"height_m":{"type":"number","minimum":0,"maximum":1000,"default":60,"description":"Apex height in metres above ground."},"time_s":{"type":"number","minimum":0.001,"maximum":120,"default":1.8,"description":"Actual lift duration in seconds; no implicit height scaling."},"tilt_deg":{"type":"number","minimum":-85,"maximum":85,"default":0,"description":"Tilt from vertical in degrees."},"tail":{"type":"string","enum":["gold","silver","glitter","comet","crackle","whistle","heli","rocket","tiger","willow","strobe","brocade","dark","flowers"],"default":"gold"},"sparks":{"type":"integer","minimum":0,"maximum":10000,"default":180,"description":"Dimensionless multiplier or fraction."},"spread":{"type":"number","minimum":0,"maximum":20,"default":1.4,"description":"Multiplier on the selected launch style ejection speed."},"smoke":{"type":"number","minimum":0,"maximum":4,"default":1,"description":"Dimensionless multiplier or fraction."}},"required":["height_m","time_s","tilt_deg","tail","sparks","spread","smoke"]},"adjustments":{"type":"object","propertyNames":{"pattern":"^(launch\\.(height|tail|climb)|break\\.(flash|core_ring)|ground\\.(height|count|fan|climb|star_size|spin|duration|density|spray)|layer\\.[A-Za-z0-9][A-Za-z0-9_-]*\\.(size|stars|brightness|burn|droop|spread|star_size|trail\\.(length|density|spray|glitter)|modifier\\.(amount|timing)))$"},"additionalProperties":{"type":"integer","minimum":-3,"maximum":3},"default":{},"description":"Finale-style quick adjustment levels. Layer keys use the stable layer id; values are resolved by the renderer registry."},"sound":{"type":"object","additionalProperties":false,"properties":{"lift":{"type":"number","minimum":0,"maximum":1,"default":0.7,"description":"Dimensionless multiplier or fraction."},"break":{"type":"number","minimum":0,"maximum":1,"default":0.85,"description":"Dimensionless multiplier or fraction."},"crackle":{"type":"number","minimum":0,"maximum":1,"default":0.6,"description":"Dimensionless multiplier or fraction."},"whistle":{"type":"number","minimum":0,"maximum":1,"default":0,"description":"Dimensionless multiplier or fraction."}},"required":["lift","break","crackle","whistle"]},"split":{"type":"object","additionalProperties":false,"properties":{"count":{"type":"integer","minimum":1,"maximum":64,"default":4,"description":"Dimensionless multiplier or fraction."},"distance_m":{"type":"number","minimum":0.001,"maximum":500,"default":10,"description":"Child asymptotic reach in metres."},"life_s":{"type":"number","minimum":0.001,"maximum":30,"default":0.7,"description":"Child lifetime in seconds."}},"required":["count","distance_m","life_s"]},"comets":{"type":"object","additionalProperties":false,"properties":{"count":{"type":"integer","minimum":1,"maximum":500,"default":1,"description":"Dimensionless multiplier or fraction."},"pattern":{"type":"string","enum":["straight","fan","random","sequence","sweep"],"default":"straight"},"spread_deg":{"type":"number","minimum":0,"maximum":180,"default":60,"description":"Fan or random spread in degrees."},"height_m":{"type":"number","minimum":0.001,"maximum":1000,"default":50,"description":"Travel height above the muzzle in metres."},"time_s":{"type":"number","minimum":0.001,"maximum":120,"default":2.2,"description":"Climb duration in seconds."},"colour":{"$ref":"#/definitions/colour"},"trail":{"anyOf":[{"type":"string","enum":["house","star"],"default":"house"},{"$ref":"#/definitions/hexColour"}]},"size":{"type":"number","minimum":0,"maximum":10,"default":1,"description":"Dimensionless multiplier or fraction."},"sparks":{"type":"integer","minimum":0,"maximum":10000,"default":200,"description":"Dimensionless multiplier or fraction."},"tail_life_s":{"type":"number","minimum":0.001,"maximum":30,"default":1.4,"description":"Tail spark lifetime in seconds."},"glitter":{"type":"number","minimum":0,"maximum":1,"default":0,"description":"Dimensionless multiplier or fraction."},"gap_s":{"type":"number","minimum":0.001,"maximum":120,"default":0.5,"description":"Seconds between sequential or sweep shots."},"spin_rad_s":{"type":"number","minimum":-500,"maximum":500,"default":0,"description":"Corkscrew angular speed in radians per second."},"spin_radius_m":{"type":"number","minimum":0,"maximum":100,"default":2.2,"description":"Corkscrew radius in metres."},"pop":{"type":"boolean","default":false},"split":{"anyOf":[{"$ref":"#/definitions/split"},{"type":"null"}]},"halo":{"type":"number","minimum":0,"maximum":4,"default":1,"description":"Dimensionless multiplier or fraction."},"whistle":{"type":"boolean","default":false}},"required":["count","pattern","spread_deg","height_m","time_s","colour","trail","size","sparks","tail_life_s","glitter","gap_s","spin_rad_s","spin_radius_m","pop","split","halo","whistle"]},"fountain":{"type":"object","additionalProperties":false,"properties":{"duration_s":{"type":"number","minimum":0.001,"maximum":120,"default":7,"description":"Emission duration in seconds."},"rate_per_s":{"type":"number","minimum":0,"maximum":20000,"default":1600,"description":"Sparks per second before emitter density scaling."},"speed_m_s":{"type":"number","minimum":0,"maximum":200,"default":20,"description":"Spark ejection speed in metres per second."},"cone":{"type":"number","minimum":0,"maximum":4,"default":0.1,"description":"Direction-vector spread multiplier, not degrees."},"colour":{"$ref":"#/definitions/hexColour"},"life_s":{"type":"number","minimum":0.001,"maximum":30,"default":1.2,"description":"Spark lifetime in seconds."},"emitters":{"type":"integer","minimum":1,"maximum":500,"default":1,"description":"Dimensionless multiplier or fraction."},"spacing_m":{"type":"number","minimum":0.001,"maximum":100,"default":1.2,"description":"Emitter spacing in metres."},"height_m":{"type":"number","minimum":0,"maximum":1000,"default":0.6,"description":"Emitter height above ground, not plume height."},"glow_height_m":{"type":"number","minimum":0,"maximum":1000,"description":"Height of the muzzle glow above the ground in metres. Defaults to height_m when absent."},"direction":{"$ref":"#/definitions/direction"},"streak":{"type":"integer","minimum":0,"maximum":16,"default":2,"description":"Dimensionless multiplier or fraction."},"gravity_m_s2":{"type":"number","minimum":-40,"maximum":100,"default":14,"description":"Spark acceleration in metres per second squared."},"drag_per_s":{"type":"number","minimum":0.001,"maximum":30,"default":0.9,"description":"Spark drag coefficient in inverse seconds."},"size":{"type":"number","minimum":0,"maximum":10,"default":1,"description":"Dimensionless multiplier or fraction."},"flicker":{"type":"number","minimum":0,"maximum":1,"default":0.3,"description":"Dimensionless multiplier or fraction."},"glitter":{"type":"number","minimum":0,"maximum":1,"default":0,"description":"Dimensionless multiplier or fraction."},"fork":{"type":"number","minimum":0,"maximum":1,"default":0,"description":"Dimensionless multiplier or fraction."},"glow":{"type":"number","minimum":0,"maximum":20,"default":3,"description":"Relative muzzle glow size."},"glow_alpha":{"type":"number","minimum":0,"maximum":4,"default":0.2,"description":"Dimensionless multiplier or fraction."}},"required":["duration_s","rate_per_s","speed_m_s","cone","colour","life_s","emitters","spacing_m","height_m","direction","streak","gravity_m_s2","drag_per_s","size","flicker","glitter","fork","glow","glow_alpha"]},"tourbillon":{"type":"object","additionalProperties":false,"properties":{"height_m":{"type":"number","minimum":0.001,"maximum":1000,"default":38,"description":"Apex height above ground in metres."},"time_s":{"type":"number","minimum":0.001,"maximum":120,"default":2.4,"description":"Climb duration in seconds."},"radius_m":{"type":"number","minimum":0,"maximum":100,"default":1.2,"description":"Helix radius in metres."},"spin_rad_s":{"type":"number","minimum":-500,"maximum":500,"default":60,"description":"Angular speed in radians per second."},"count":{"type":"integer","minimum":1,"maximum":500,"default":5,"description":"Dimensionless multiplier or fraction."},"sparks":{"type":"integer","minimum":0,"maximum":10000,"default":110,"description":"Dimensionless multiplier or fraction."}},"required":["height_m","time_s","radius_m","spin_rad_s","count","sparks"]},"wheel":{"type":"object","additionalProperties":false,"properties":{"radius_m":{"type":"number","minimum":0,"maximum":100,"default":3,"description":"Rim radius in metres."},"height_m":{"type":"number","minimum":0,"maximum":1000,"default":6,"description":"Hub height above ground in metres."},"spin_hz":{"type":"number","minimum":-100,"maximum":100,"default":2,"description":"Revolutions per second."},"drivers":{"type":"integer","minimum":1,"maximum":100,"default":6,"description":"Dimensionless multiplier or fraction."},"duration_s":{"type":"number","minimum":0.001,"maximum":120,"default":7,"description":"Emission duration in seconds."},"colour":{"$ref":"#/definitions/hexColour"},"sparks":{"type":"integer","minimum":0,"maximum":10000,"default":240,"description":"Dimensionless multiplier or fraction."},"glitter":{"type":"number","minimum":0,"maximum":1,"default":0,"description":"Dimensionless multiplier or fraction."}},"required":["radius_m","height_m","spin_hz","drivers","duration_s","colour","sparks","glitter"]},"spinner":{"type":"object","additionalProperties":false,"properties":{"count":{"type":"integer","minimum":1,"maximum":500,"default":4,"description":"Dimensionless multiplier or fraction."},"duration_s":{"type":"number","minimum":0.001,"maximum":120,"default":4,"description":"Emission duration per spinner in seconds."},"spin_rad_s":{"type":"number","minimum":-500,"maximum":500,"default":70,"description":"Angular speed in radians per second."},"wander_m":{"type":"number","minimum":0,"maximum":100,"default":1,"description":"Wandering amplitude in metres."},"sparks":{"type":"integer","minimum":0,"maximum":10000,"default":90,"description":"Dimensionless multiplier or fraction."},"colours":{"type":"array","items":{"$ref":"#/definitions/hexColour"},"minItems":1,"maxItems":16}},"required":["count","duration_s","spin_rad_s","wander_m","sparks","colours"]}},"oneOf":[{"type":"object","additionalProperties":false,"properties":{"kind":{"const":"shell"},"adjustments":{"$ref":"#/definitions/adjustments"},"launch":{"$ref":"#/definitions/launch"},"breaks":{"type":"array","items":{"$ref":"#/definitions/break"},"minItems":1,"maxItems":64},"ground":{"type":"null"},"sound":{"$ref":"#/definitions/sound"},"seed":{"type":"integer","minimum":0,"maximum":4294967295,"default":11,"description":"Unsigned 32-bit default seed; zero is valid."}},"required":["kind","launch","breaks","ground","sound","seed"]},{"type":"object","additionalProperties":false,"properties":{"kind":{"const":"mine"},"adjustments":{"$ref":"#/definitions/adjustments"},"launch":{"$ref":"#/definitions/launch"},"breaks":{"type":"array","items":{"$ref":"#/definitions/break"},"minItems":1,"maxItems":64},"ground":{"type":"null"},"sound":{"$ref":"#/definitions/sound"},"seed":{"type":"integer","minimum":0,"maximum":4294967295,"default":11,"description":"Unsigned 32-bit default seed; zero is valid."}},"required":["kind","launch","breaks","ground","sound","seed"]},{"type":"object","additionalProperties":false,"properties":{"kind":{"const":"rocket"},"adjustments":{"$ref":"#/definitions/adjustments"},"launch":{"$ref":"#/definitions/launch"},"breaks":{"type":"array","items":{"$ref":"#/definitions/break"},"minItems":1,"maxItems":64},"ground":{"type":"null"},"sound":{"$ref":"#/definitions/sound"},"seed":{"type":"integer","minimum":0,"maximum":4294967295,"default":11,"description":"Unsigned 32-bit default seed; zero is valid."}},"required":["kind","launch","breaks","ground","sound","seed"]},{"type":"object","additionalProperties":false,"properties":{"kind":{"const":"comet"},"adjustments":{"$ref":"#/definitions/adjustments"},"launch":{"type":"null"},"breaks":{"type":"array","items":{"$ref":"#/definitions/break"},"minItems":0,"maxItems":0},"ground":{"type":"object","additionalProperties":false,"properties":{"kind":{"const":"comet"},"comets":{"$ref":"#/definitions/comets"}},"required":["kind","comets"]},"sound":{"$ref":"#/definitions/sound"},"seed":{"type":"integer","minimum":0,"maximum":4294967295,"default":11,"description":"Unsigned 32-bit default seed; zero is valid."}},"required":["kind","launch","breaks","ground","sound","seed"]},{"type":"object","additionalProperties":false,"properties":{"kind":{"const":"candle"},"adjustments":{"$ref":"#/definitions/adjustments"},"launch":{"type":"null"},"breaks":{"type":"array","items":{"$ref":"#/definitions/break"},"minItems":0,"maxItems":0},"ground":{"type":"object","additionalProperties":false,"properties":{"kind":{"const":"candle"},"comets":{"$ref":"#/definitions/comets"}},"required":["kind","comets"]},"sound":{"$ref":"#/definitions/sound"},"seed":{"type":"integer","minimum":0,"maximum":4294967295,"default":11,"description":"Unsigned 32-bit default seed; zero is valid."}},"required":["kind","launch","breaks","ground","sound","seed"]},{"type":"object","additionalProperties":false,"properties":{"kind":{"const":"fountain"},"adjustments":{"$ref":"#/definitions/adjustments"},"launch":{"type":"null"},"breaks":{"type":"array","items":{"$ref":"#/definitions/break"},"minItems":0,"maxItems":0},"ground":{"type":"object","additionalProperties":false,"properties":{"kind":{"const":"fountain"},"fountain":{"$ref":"#/definitions/fountain"}},"required":["kind","fountain"]},"sound":{"$ref":"#/definitions/sound"},"seed":{"type":"integer","minimum":0,"maximum":4294967295,"default":11,"description":"Unsigned 32-bit default seed; zero is valid."}},"required":["kind","launch","breaks","ground","sound","seed"]},{"type":"object","additionalProperties":false,"properties":{"kind":{"const":"tourbillon"},"adjustments":{"$ref":"#/definitions/adjustments"},"launch":{"type":"null"},"breaks":{"type":"array","items":{"$ref":"#/definitions/break"},"minItems":0,"maxItems":0},"ground":{"type":"object","additionalProperties":false,"properties":{"kind":{"const":"tourbillon"},"tourbillon":{"$ref":"#/definitions/tourbillon"}},"required":["kind","tourbillon"]},"sound":{"$ref":"#/definitions/sound"},"seed":{"type":"integer","minimum":0,"maximum":4294967295,"default":11,"description":"Unsigned 32-bit default seed; zero is valid."}},"required":["kind","launch","breaks","ground","sound","seed"]},{"type":"object","additionalProperties":false,"properties":{"kind":{"const":"wheel"},"adjustments":{"$ref":"#/definitions/adjustments"},"launch":{"type":"null"},"breaks":{"type":"array","items":{"$ref":"#/definitions/break"},"minItems":0,"maxItems":0},"ground":{"type":"object","additionalProperties":false,"properties":{"kind":{"const":"wheel"},"wheel":{"$ref":"#/definitions/wheel"}},"required":["kind","wheel"]},"sound":{"$ref":"#/definitions/sound"},"seed":{"type":"integer","minimum":0,"maximum":4294967295,"default":11,"description":"Unsigned 32-bit default seed; zero is valid."}},"required":["kind","launch","breaks","ground","sound","seed"]},{"type":"object","additionalProperties":false,"properties":{"kind":{"const":"spinner"},"adjustments":{"$ref":"#/definitions/adjustments"},"launch":{"type":"null"},"breaks":{"type":"array","items":{"$ref":"#/definitions/break"},"minItems":0,"maxItems":0},"ground":{"type":"object","additionalProperties":false,"properties":{"kind":{"const":"spinner"},"spinner":{"$ref":"#/definitions/spinner"}},"required":["kind","spinner"]},"sound":{"$ref":"#/definitions/sound"},"seed":{"type":"integer","minimum":0,"maximum":4294967295,"default":11,"description":"Unsigned 32-bit default seed; zero is valid."}},"required":["kind","launch","breaks","ground","sound","seed"]}]}$schema$::json;
$function$;
comment on function private.design_schema() is 'Returns the canonical v1 JSON Schema for database document validation.';
-- END GENERATED DESIGN SCHEMA

create table public.effects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  family text not null,
  kind text not null check (kind in ('shell','mine','comet','fountain','tourbillon','wheel','spinner','rocket','candle')),
  is_template boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  current_version_id uuid,
  draft_version_id uuid,
  colours text[] not null default '{}',
  tags text[] not null default '{}',
  duration_ms int check (duration_ms >= 0),
  apex_m numeric(5,1) check (apex_m >= 0),
  noise_level smallint check (noise_level between 0 and 3),
  created_by uuid references public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  path text not null,
  kind text not null check (kind in ('video','image','audio','document','price_list')),
  mime text not null,
  bytes bigint not null check (bytes >= 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  duration_ms int check (duration_ms >= 0),
  width int check (width > 0),
  height int check (height > 0),
  fps numeric(6,2) check (fps > 0),
  organisation_id uuid references public.organisations(id),
  supplier_id uuid,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, path),
  check (organisation_id is null or supplier_id is null)
);
create index media_organisation_idx on public.media(organisation_id);
create index media_supplier_idx on public.media(supplier_id);

create table public.effect_versions (
  id uuid primary key default gen_random_uuid(),
  effect_id uuid not null references public.effects(id),
  number int not null check (number > 0),
  status text not null default 'draft' check (status in ('draft','in_review','changes_requested','published','superseded','rejected')),
  design jsonb not null,
  design_schema smallint not null default 1 check (design_schema = 1),
  renderer text not null check (length(renderer) > 0),
  summary jsonb not null default '{}' check (jsonb_typeof(summary) = 'object'),
  checks jsonb not null default '{}' check (jsonb_typeof(checks) = 'object'),
  change_note text,
  parent_version_id uuid,
  reference_media_id uuid references public.media(id),
  author_id uuid references public.profiles(id),
  submitted_at timestamptz,
  published_at timestamptz,
  published_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (effect_id, number),
  unique (effect_id, id),
  foreign key (effect_id, parent_version_id) references public.effect_versions(effect_id, id),
  constraint effect_design_valid check (extensions.jsonb_matches_schema(private.design_schema(), design))
);
create unique index effect_versions_open_draft_idx on public.effect_versions(effect_id) where status = 'draft';
create unique index effect_versions_open_review_idx on public.effect_versions(effect_id) where status in ('in_review','changes_requested');
alter table public.effects add constraint effects_current_version_fk foreign key (id, current_version_id) references public.effect_versions(effect_id, id);
alter table public.effects add constraint effects_draft_version_fk foreign key (id, draft_version_id) references public.effect_versions(effect_id, id);

create table public.poster_renders (
  id uuid primary key default gen_random_uuid(),
  effect_version_id uuid references public.effect_versions(id),
  product_version_id uuid,
  renderer text not null check (length(renderer) > 0),
  framing text not null check (framing in ('card','wide','square','og')),
  width int not null check (width > 0),
  height int not null check (height > 0),
  t_ms int not null check (t_ms >= 0),
  path text not null,
  status text not null default 'pending' check (status in ('pending','ready','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((effect_version_id is null) <> (product_version_id is null)),
  unique nulls not distinct (effect_version_id, product_version_id, renderer, framing)
);

-- Stops history edits, including service-role writes; only a payload-preserving supersession is allowed.
create or replace function private.guard_version_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception using errcode = '23514', message = 'Version history is immutable'; end if;
    return old;
  end if;
  if new.id <> old.id or new.number <> old.number or
    (to_jsonb(new)->tg_argv[0]) is distinct from (to_jsonb(old)->tg_argv[0]) then
    raise exception using errcode = '23514', message = 'Version identity is immutable';
  end if;
  if old.status <> 'draft' then
    if not (current_user = 'postgres' and old.status = 'published' and new.status = 'superseded'
      and (to_jsonb(new) - 'status' - 'updated_at') = (to_jsonb(old) - 'status' - 'updated_at')) then
      raise exception using errcode = '23514', message = 'Version history is immutable';
    end if;
  elsif new.status <> 'draft' and current_user <> 'postgres' then
    raise exception using errcode = '23514', message = 'Use the version lifecycle RPC';
  end if;
  return new;
end;
$$;
comment on function private.guard_version_history() is 'Rejects changes to saved history except a payload-preserving published-to-superseded transition by the lifecycle owner.';
create trigger guard_history before update or delete on public.effect_versions
  for each row execute function private.guard_version_history('effect_id');

create index effects_colours_idx on public.effects using gin(colours);
create index effects_tags_idx on public.effects using gin(tags);
create index effects_duration_idx on public.effects(duration_ms);
create index effects_noise_idx on public.effects(noise_level);

alter table public.effects enable row level security;
alter table public.effect_versions enable row level security;
alter table public.poster_renders enable row level security;
alter table public.media enable row level security;
create trigger set_updated_at before update on public.effects for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.effect_versions for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.poster_renders for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.media for each row execute function private.set_updated_at();

create policy effects_select on public.effects for select to anon, authenticated
  using (status = 'published' or (select private.staff_role()) is not null);
create policy effect_versions_select on public.effect_versions for select to anon, authenticated
  using ((select private.staff_role()) is not null or (status = 'published' and exists (
    select from public.effects where effects.id = effect_id and effects.status = 'published' and effects.current_version_id = effect_versions.id)));

-- Product compositions, supplier listings and confirmed catalogue safety facts.
-- BEGIN GENERATED COMPOSITION SCHEMA
-- Generated from supabase/documents/composition.v1.json; use pnpm db:documents to refresh.
create or replace function private.composition_schema()
returns json
language sql
immutable
set search_path = ''
as $function$
  select $schema${"$schema":"http://json-schema.org/draft-07/schema#","title":"ShowCrafter product composition v1","type":"object","additionalProperties":false,"required":["tubes"],"properties":{"box":{"type":"object","additionalProperties":false,"required":["rows","cols","pitch_mm"],"properties":{"rows":{"type":"integer","minimum":1},"cols":{"type":"integer","minimum":1},"pitch_mm":{"type":"number","exclusiveMinimum":0}}},"tubes":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["i","letter","t_ms","angle_deg"],"properties":{"i":{"type":"integer","minimum":0},"letter":{"type":"string","pattern":"^[a-z]{1,2}$"},"t_ms":{"type":["integer","null"],"minimum":0},"angle_deg":{"type":"number","minimum":-90,"maximum":90},"pos":{"type":"array","items":{"type":"integer","minimum":0},"minItems":2,"maxItems":2},"seed":{"type":"integer","minimum":0,"maximum":4294967295}}}},"fuse_delay_ms":{"type":"integer","minimum":0}}}$schema$::json;
$function$;
comment on function private.composition_schema() is 'Returns the canonical v1 JSON Schema for database document validation.';
-- END GENERATED COMPOSITION SCHEMA

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, name text not null,
  kind text not null check (kind in ('single','cake','rocket_pack','candle','fountain','wheel','ground','pack')),
  status text not null default 'draft' check (status in ('draft','needs_review','published','archived')),
  current_version_id uuid, draft_version_id uuid,
  brand text, description text,
  calibre_mm smallint check (calibre_mm > 0), nec_grams numeric(8,1) check (nec_grams >= 0),
  min_safety_distance_m smallint check (min_safety_distance_m >= 0),
  noise_level smallint check (noise_level between 0 and 3),
  safety_supplied_by uuid references public.profiles(id),
  safety_supplier_id uuid,
  safety_confirmed_by uuid references public.profiles(id), safety_confirmed_at timestamptz,
  has_bangs boolean not null default false, has_crackle boolean not null default false, has_whistle boolean not null default false,
  shot_count smallint check (shot_count >= 0), duration_ms int check (duration_ms >= 0),
  apex_m numeric(5,1) check (apex_m >= 0), energy numeric(3,2) check (energy between 0 and 1),
  colours text[] not null default '{}', tags text[] not null default '{}',
  gtin text, created_by uuid references public.profiles(id), archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
create trigger set_updated_at before update on public.products
  for each row execute function private.set_updated_at();

create table public.product_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id), number int not null check (number > 0),
  status text not null default 'draft' check (status in ('draft','in_review','changes_requested','published','superseded','rejected')),
  composition jsonb not null, composition_schema smallint not null default 1 check (composition_schema = 1),
  summary jsonb not null default '{}' check (jsonb_typeof(summary) = 'object'), change_note text,
  source text not null default 'manual' check (source in ('manual','finale_import','video_import','supplier')),
  candidate_id uuid, author_id uuid references public.profiles(id),
  published_at timestamptz, published_by uuid references public.profiles(id),
  unique (product_id, number), unique (product_id, id),
  constraint product_composition_valid check (extensions.jsonb_matches_schema(private.composition_schema(), composition)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.product_versions enable row level security;
create trigger set_updated_at before update on public.product_versions
  for each row execute function private.set_updated_at();

create table public.product_version_effects (
  product_version_id uuid not null references public.product_versions(id),
  letter text not null check (letter ~ '^[a-z]{1,2}$'), effect_id uuid not null references public.effects(id),
  primary key (product_version_id, letter),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.product_version_effects enable row level security;
create trigger set_updated_at before update on public.product_version_effects
  for each row execute function private.set_updated_at();

create table public.pack_items (
  pack_id uuid not null references public.products(id), item_id uuid not null references public.products(id),
  quantity smallint not null check (quantity > 0), sort smallint not null default 0,
  primary key (pack_id, item_id), check (pack_id <> item_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pack_items enable row level security;
create trigger set_updated_at before update on public.pack_items
  for each row execute function private.set_updated_at();

create table public.product_markets (
  product_id uuid not null references public.products(id), market text not null references public.markets(code),
  legal_category text not null check (length(legal_category) > 0), min_age smallint check (min_age >= 0),
  allowed boolean not null default true,
  supplied_by uuid references public.profiles(id), supplier_id uuid,
  confirmed_by uuid references public.profiles(id), confirmed_at timestamptz,
  primary key (product_id, market),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.product_markets enable row level security;
create trigger set_updated_at before update on public.product_markets
  for each row execute function private.set_updated_at();

create table public.product_media (
  product_id uuid not null references public.products(id), media_id uuid not null references public.media(id),
  role text not null check (role in ('demo_video','photo','box_art','safety_sheet')),
  sort smallint not null default 0, primary key (product_id, media_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.product_media enable row level security;
create trigger set_updated_at before update on public.product_media
  for each row execute function private.set_updated_at();

create table public.suppliers (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  country text references public.markets(code), contact_email text, website text,
  price_list_format jsonb check (jsonb_typeof(price_list_format) = 'object'),
  status text not null default 'active' check (status in ('invited','active','paused','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.suppliers enable row level security;
create trigger set_updated_at before update on public.suppliers
  for each row execute function private.set_updated_at();

create table public.supplier_members (
  supplier_id uuid not null references public.suppliers(id), profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','member')), primary key (supplier_id, profile_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.supplier_members enable row level security;
create trigger set_updated_at before update on public.supplier_members
  for each row execute function private.set_updated_at();

create table public.supplier_products (
  id uuid primary key default gen_random_uuid(), supplier_id uuid not null references public.suppliers(id),
  product_id uuid references public.products(id), supplier_code text not null, name_raw text not null,
  cost_minor bigint check (cost_minor >= 0), currency char(3) check (currency ~ '^[A-Z]{3}$'),
  rrp_minor bigint check (rrp_minor >= 0), case_qty smallint check (case_qty > 0), gtin text,
  available boolean not null default true, last_import_id uuid,
  safety_facts jsonb not null default '{}' check (jsonb_typeof(safety_facts) = 'object'),
  supplied_by uuid references public.profiles(id),
  check ((cost_minor is null and rrp_minor is null) or currency is not null),
  unique (supplier_id, supplier_code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.supplier_products enable row level security;
create trigger set_updated_at before update on public.supplier_products
  for each row execute function private.set_updated_at();

comment on column public.product_versions.candidate_id is 'Nullable reference to public.design_candidates(id), the source reconstruction candidate.';
comment on column public.supplier_products.last_import_id is 'Nullable reference to public.imports(id), the most recent source price list.';
alter table public.products add constraint products_current_version_fk foreign key (id, current_version_id) references public.product_versions(product_id, id);
alter table public.products add constraint products_draft_version_fk foreign key (id, draft_version_id) references public.product_versions(product_id, id);
alter table public.products add constraint products_safety_supplier_fk foreign key (safety_supplier_id) references public.suppliers(id);
alter table public.product_markets add constraint product_markets_supplier_fk foreign key (supplier_id) references public.suppliers(id);
alter table public.media add constraint media_supplier_fk foreign key (supplier_id) references public.suppliers(id);
alter table public.poster_renders add constraint poster_product_version_fk foreign key (product_version_id) references public.product_versions(id);
alter table public.branding add constraint branding_logo_media_fk foreign key (logo_media_id) references public.media(id);
create trigger guard_history before update or delete on public.product_versions
  for each row execute function private.guard_version_history('product_id');
create unique index product_versions_open_draft_idx on public.product_versions(product_id) where status = 'draft';
create unique index product_versions_open_review_idx on public.product_versions(product_id) where status in ('in_review','changes_requested');
create index supplier_members_profile_idx on public.supplier_members(profile_id);
create index supplier_products_product_idx on public.supplier_products(product_id);
create index pack_items_item_idx on public.pack_items(item_id);
create index product_media_media_idx on public.product_media(media_id);

-- Returns active suppliers belonging to the active, non-anonymous caller.
create or replace function private.supplier_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select member.supplier_id from public.supplier_members as member
  join public.suppliers as supplier on supplier.id = member.supplier_id and supplier.status = 'active'
  join public.profiles as profile on profile.id = member.profile_id and profile.status = 'active'
  where member.profile_id = private.uid() and not private.is_anon() and not profile.is_anonymous;
$$;
comment on function private.supplier_ids() is 'Returns the active supplier memberships of the active non-anonymous request user.';

-- Refuses catalogue mutation by shoppers, retailer members and non-editor staff.
create or replace function private.require_catalogue_editor()
returns void
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict error
begin
  if coalesce(private.staff_role(), '') not in ('super_admin','catalogue_editor') then
    raise exception using errcode = '42501', message = 'Catalogue editor permission required';
  end if;
end;
$$;
comment on function private.require_catalogue_editor() is 'Raises insufficient_privilege unless the active caller has catalogue editing rights.';

-- Locks the containing draft before changing its letter bindings, preserving published composition history.
create or replace function private.guard_effect_binding()
returns trigger
language plpgsql
set search_path = ''
as $$
#variable_conflict error
declare
  version_status text;
  version_id uuid;
begin
  version_id := case when tg_op = 'DELETE' then old.product_version_id else new.product_version_id end;
  if tg_op = 'UPDATE' and new.product_version_id <> old.product_version_id then
    raise exception using errcode = '23514', message = 'Binding identity is immutable';
  end if;
  select status into version_status from public.product_versions where id = version_id for update;
  if version_status is distinct from 'draft' then
    raise exception using errcode = '23514', message = 'Version bindings are immutable outside a draft';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
comment on function private.guard_effect_binding() is 'Serialises binding writes against the containing draft; rejects updates or deletion of historical bindings.';
create trigger guard_binding before insert or update or delete on public.product_version_effects
  for each row execute function private.guard_effect_binding();

create policy products_select on public.products for select to anon, authenticated
  using (status = 'published' or (select private.staff_role()) is not null);
create policy product_versions_select on public.product_versions for select to anon, authenticated
  using ((select private.staff_role()) is not null or (status = 'published' and exists (
    select from public.products where products.id = product_id and products.status = 'published' and products.current_version_id = product_versions.id)));
create policy product_version_effects_select on public.product_version_effects for select to anon, authenticated
  using (exists (select from public.product_versions where product_versions.id = product_version_id));
create policy poster_renders_select on public.poster_renders for select to anon, authenticated
  using ((select private.staff_role()) is not null or (status = 'ready' and (
    exists (select from public.effect_versions where effect_versions.id = effect_version_id)
    or exists (select from public.product_versions where product_versions.id = product_version_id))));
create policy poster_renders_insert on public.poster_renders for insert to authenticated
  with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy poster_renders_update on public.poster_renders for update to authenticated
  using ((select private.staff_role()) in ('super_admin','catalogue_editor'))
  with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy media_select on public.media for select to authenticated
  using ((select private.staff_role()) is not null or supplier_id in (select private.supplier_ids())
    or organisation_id in (select private.org_ids('staff')));
create policy media_insert on public.media for insert to authenticated
  with check (uploaded_by = (select private.uid()) and ((select private.staff_role()) in ('super_admin','catalogue_editor')
    or (organisation_id is null and supplier_id in (select private.supplier_ids()))));
create policy pack_items_select on public.pack_items for select to anon, authenticated
  using ((select private.staff_role()) is not null or (exists (select from public.products where products.id = pack_id and products.status = 'published') and exists (select from public.products as item where item.id = item_id and item.status = 'published')));
create policy product_markets_select on public.product_markets for select to anon, authenticated
  using ((select private.staff_role()) is not null or (exists (select from public.products where products.id = product_id and products.status = 'published')));
create policy product_media_select on public.product_media for select to anon, authenticated
  using ((select private.staff_role()) is not null or (exists (select from public.products where products.id = product_id and products.status = 'published')));
create policy product_media_insert on public.product_media for insert to authenticated with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy product_media_update on public.product_media for update to authenticated using ((select private.staff_role()) in ('super_admin','catalogue_editor')) with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy product_media_delete on public.product_media for delete to authenticated using ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy suppliers_select on public.suppliers for select to authenticated using ((select private.staff_role()) is not null or id in (select private.supplier_ids()));
create policy suppliers_insert on public.suppliers for insert to authenticated with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy suppliers_update on public.suppliers for update to authenticated using ((select private.staff_role()) in ('super_admin','catalogue_editor')) with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy suppliers_delete on public.suppliers for delete to authenticated using ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy supplier_members_select on public.supplier_members for select to authenticated using ((select private.staff_role()) is not null or supplier_id in (select private.supplier_ids()));
create policy supplier_members_insert on public.supplier_members for insert to authenticated with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy supplier_members_update on public.supplier_members for update to authenticated using ((select private.staff_role()) in ('super_admin','catalogue_editor')) with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy supplier_members_delete on public.supplier_members for delete to authenticated using ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy supplier_products_select on public.supplier_products for select to authenticated using ((select private.staff_role()) is not null or supplier_id in (select private.supplier_ids()));
create policy supplier_products_insert on public.supplier_products for insert to authenticated with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy supplier_products_update on public.supplier_products for update to authenticated using ((select private.staff_role()) in ('super_admin','catalogue_editor')) with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy supplier_products_delete on public.supplier_products for delete to authenticated using ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create index products_colours_idx on public.products using gin(colours);
create index products_tags_idx on public.products using gin(tags);
create index products_duration_idx on public.products(duration_ms);
create index products_noise_level_idx on public.products(noise_level);
create index products_energy_idx on public.products(energy);

-- Applies a saved multiplicative control to one numeric field, preserving its units and schema bounds.
create or replace function private.adjusted_control(value numeric, document jsonb, control text, factor numeric, minimum numeric, maximum numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select least(maximum, greatest(minimum, value * power(factor, coalesce((document->'adjustments'->>control)::int, 0))));
$$;
comment on function private.adjusted_control(numeric,jsonb,text,numeric,numeric,numeric) is 'Returns a field scaled by its saved dimensionless adjustment level and clamped to the supplied bounds in the field units.';

-- Resolves climb-time controls in JSONB key order, matching the renderer after a stored document is read back.
create or replace function private.adjusted_climb_time(value numeric, document jsonb, control_scope text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
#variable_conflict error
declare
  -- Stored renderer control factors, dimensionless; schema bounds are seconds.
  height_factor constant numeric := 1.12;
  climb_factor constant numeric := 0.85;
  minimum_s constant numeric := 0.001;
  maximum_s constant numeric := 120;
  control record;
begin
  for control in select adjustment.key, adjustment.value::int as level from jsonb_each_text(coalesce(document->'adjustments','{}')) as adjustment loop
    if control.key = control_scope || '.height' then
      value := least(maximum_s,greatest(minimum_s,value * power(sqrt(height_factor),control.level)));
    elsif control.key = control_scope || '.climb' then
      value := least(maximum_s,greatest(minimum_s,value * power(climb_factor,control.level)));
    end if;
  end loop;
  return value;
end;
$$;
comment on function private.adjusted_climb_time(numeric,jsonb,text) is 'Returns climb duration in seconds after sequential height/climb adjustments and per-control schema clamps; respects stored JSONB key order.';

-- Maps a hex colour to the nearest catalogue palette swatch in RGB, a visual search approximation.
create or replace function private.colour_bucket(colour text)
returns text
language sql
immutable
set search_path = ''
as $$
  with swatches(name, hex) as (values
    ('red','#ff3b2f'), ('orange','#ff8a28'), ('gold','#ffd060'), ('silver','#ffffff'),
    ('green','#2ee6a0'), ('blue','#398cff'), ('purple','#8f7bff'), ('pink','#ff59b4')),
  source as (select decode(substr(colour, 2), 'hex') as rgb)
  select name from swatches cross join source
    order by power(get_byte(rgb,0) - get_byte(decode(substr(hex,2),'hex'),0), 2)
      + power(get_byte(rgb,1) - get_byte(decode(substr(hex,2),'hex'),1), 2)
      + power(get_byte(rgb,2) - get_byte(decode(substr(hex,2),'hex'),2), 2), name limit 1;
$$;
comment on function private.colour_bucket(text) is 'Returns the nearest named RGB palette swatch for a validated six-digit hex colour; used only for catalogue search.';

-- Bounds fountain height from the authored emitter, direction and acceleration, excluding drag which reduces ascent.
create or replace function private.fountain_apex(document jsonb)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
#variable_conflict error
declare
  -- Stored renderer adjustment factors, dimensionless, and schema limits in metres/second and cone units.
  speed_factor constant numeric := 1.1;
  cone_factor constant numeric := 1.25;
  max_speed_m_s constant numeric := 200;
  max_cone constant numeric := 4;
  -- Renderer spray lifetime scale: longest possible spark lasts this multiple of authored seconds.
  spray_life_scale constant numeric := 1.75;
  fountain jsonb := document#>'{ground,fountain}';
  acceleration_m_s2 numeric := (fountain->>'gravity_m_s2')::numeric;
  life_s numeric := (fountain->>'life_s')::numeric * spray_life_scale;
  upward_speed_m_s numeric;
  apex_time_s numeric;
begin
  -- A unit random direction has y <= 1; gerb speed is at most the authored speed.
  upward_speed_m_s := private.adjusted_control((fountain->>'speed_m_s')::numeric,document,'ground.height',speed_factor,0,max_speed_m_s)
    * greatest(0,(fountain#>>'{direction,1}')::numeric + private.adjusted_control((fountain->>'cone')::numeric,document,'ground.spray',cone_factor,0,max_cone));
  apex_time_s := case when acceleration_m_s2 > 0 then least(life_s,upward_speed_m_s / acceleration_m_s2) else life_s end;
  -- Ballistic displacement v*t - g*t^2/2 bounds the damped renderer trajectory over the full possible lifetime.
  return (fountain->>'height_m')::numeric + upward_speed_m_s * apex_time_s - acceleration_m_s2 * power(apex_time_s,2) / 2;
end;
$$;
comment on function private.fountain_apex(jsonb) is 'Returns a conservative fountain apex in metres above ground from a validated design, including emitter height, saved speed/cone adjustments and maximum spray lifetime; ignores drag.';

-- Derives catalogue search facts from a validated design; time starts at firing and distances are metres.
create or replace function private.effect_facts(document jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
#variable_conflict error
declare
  -- Control factors and bounds mirror the stored renderer adjustment definitions.
  height_factor constant numeric := 1.12;
  radius_factor constant numeric := 1.15;
  burn_factor constant numeric := 1.25;
  trail_factor constant numeric := 1.3;
  brightness_factor constant numeric := 1.2;
  star_factor constant numeric := 1.3;
  spark_factor constant numeric := 1.35;
  flash_factor constant numeric := 1.3;
  fountain_duration_factor constant numeric := 1.2;
  min_time_s constant numeric := 0.001;
  max_time_s constant numeric := 120;
  max_height_m constant numeric := 1000;
  max_radius_m constant numeric := 500;
  max_trail_s constant numeric := 20;
  max_particles constant numeric := 10000;
  max_brightness constant numeric := 10;
  -- Visible tail allowances and scales from the renderer's shotDuration, in seconds.
  shell_tail_s constant numeric := 0.4;
  comet_tail_s constant numeric := 1.8;
  wheel_tail_s constant numeric := 1.4;
  spinner_stagger_s constant numeric := 0.4;
  spinner_tail_s constant numeric := 0.8;
  crackle_tail_s constant numeric := 0.5;
  split_tail_s constant numeric := 0.8;
  pop_tail_s constant numeric := 0.7;
  trail_duration_scale constant numeric := 1.3;
  -- Unit conversion and visual pacing normalisation, not a renderer particle limit.
  milliseconds_per_second constant numeric := 1000;
  energy_full_scale constant numeric := 10000;
  -- Named noise levels are conservative visual/audio classifications, not measured decibels.
  quiet_noise constant int := 0;
  lift_noise constant int := 1;
  crackle_noise constant int := 2;
  report_noise constant int := 3;
  -- Renderer adjustment and timing defaults, counts and seconds respectively.
  min_adjusted_stars constant int := 3;
  rounding_offset constant numeric := 0.5;
  max_ground_count constant int := 500;
  large_comet_count constant int := 3;
  default_sequence_gap_s constant numeric := 0.5;
  default_split_life_s constant numeric := 0.7;
  kind text := document->>'kind';
  break_document jsonb;
  layer jsonb;
  modifier jsonb;
  ground jsonb;
  key_prefix text;
  duration_s numeric := 0;
  apex_m numeric := 0;
  launch_s numeric := 0;
  layer_life_s numeric;
  layer_trail_s numeric;
  modifier_tail_s numeric;
  star_count numeric;
  nominal_particles numeric := 0;
  weighted_stars numeric := 0;
  noise int := quiet_noise;
  tags text[] := array[kind];
  colours text[] := '{}';
  colour text;
  count_level int;
  ground_count int;
begin
  if document->'launch' <> 'null'::jsonb then
    apex_m := private.adjusted_control((document#>>'{launch,height_m}')::numeric, document, 'launch.height', height_factor, 0, max_height_m);
    launch_s := private.adjusted_climb_time((document#>>'{launch,time_s}')::numeric, document, 'launch');
    if kind = 'mine' then launch_s := 0; apex_m := 0; end if;
    tags := tags || (document#>>'{launch,tail}');
    if (document#>>'{sound,lift}')::numeric > 0 then noise := lift_noise; end if;
  end if;
  for break_document in select value from jsonb_array_elements(document->'breaks') loop
    if (break_document#>>'{core,enabled}')::boolean then
      colours := colours || private.colour_bucket(break_document#>>'{core,colour}');
      nominal_particles := nominal_particles + (break_document#>>'{core,count}')::numeric;
      if private.adjusted_control((break_document#>>'{core,flash}')::numeric, document, 'break.flash', flash_factor, 0, max_brightness) > 0
        and (document#>>'{sound,break}')::numeric > 0 then noise := report_noise; end if;
    end if;
    for layer in select value from jsonb_array_elements(break_document->'layers') loop
      key_prefix := 'layer.' || (layer->>'id') || '.';
      layer_life_s := private.adjusted_control((layer->>'life_s')::numeric, document, key_prefix || 'burn', burn_factor, min_time_s, max_time_s);
      layer_trail_s := private.adjusted_control((layer#>>'{trail,length_s}')::numeric, document, key_prefix || 'trail.length', trail_factor, min_time_s, max_trail_s);
      modifier_tail_s := 0;
      for modifier in select value from jsonb_array_elements(layer->'modifiers') loop
        tags := tags || (modifier->>'kind');
        modifier_tail_s := greatest(modifier_tail_s, case modifier->>'kind'
          when 'crackle' then crackle_tail_s when 'split' then split_tail_s
          when 'crossette' then split_tail_s when 'pop' then pop_tail_s else 0 end);
      end loop;
      -- Longest possible lifetime includes variance, spray decay and modifier children.
      duration_s := greatest(duration_s, (break_document->>'at_s')::numeric + (layer->>'delay_s')::numeric
        + layer_life_s * (1 + (layer->>'life_var')::numeric) + layer_trail_s * trail_duration_scale + modifier_tail_s);
      apex_m := greatest(apex_m, coalesce(private.adjusted_control((document#>>'{launch,height_m}')::numeric, document, 'launch.height', height_factor, 0, max_height_m),0)
        + private.adjusted_control((layer->>'radius_m')::numeric, document, key_prefix || 'size', radius_factor, 0, max_radius_m));
      if not (layer->>'hidden')::boolean then
        tags := tags || (layer->>'pattern');
        for colour in select jsonb_array_elements_text(case when jsonb_typeof(value->1) = 'array' then value->1 else jsonb_build_array(value->1) end)
          from jsonb_array_elements(layer#>'{colour,stops}') loop
          colours := colours || private.colour_bucket(colour);
        end loop;
        star_count := (layer->>'count')::numeric;
        if coalesce((document->'adjustments'->>(key_prefix || 'stars'))::int,0) <> 0 then
          -- JavaScript Math.round is floor(x + 0.5) for these non-negative counts.
          star_count := floor(private.adjusted_control(star_count, document, key_prefix || 'stars', star_factor, min_adjusted_stars, max_particles) + rounding_offset);
        end if;
        weighted_stars := weighted_stars + star_count * coalesce((select max(private.adjusted_control((value->>1)::numeric, document, key_prefix || 'brightness', brightness_factor, 0, max_brightness)) from jsonb_array_elements(layer->'brightness')),0);
        nominal_particles := nominal_particles + star_count * (1 + private.adjusted_control((layer#>>'{trail,sparks}')::numeric, document, key_prefix || 'trail.density', spark_factor, 0, max_particles));
      end if;
    end loop;
  end loop;
  if jsonb_array_length(document->'breaks') > 0 then duration_s := launch_s + greatest(duration_s,1) + shell_tail_s; end if;
  if document->'ground' <> 'null'::jsonb then
    ground := document->'ground'->(case when kind in ('comet','candle') then 'comets' else kind end);
    if kind in ('comet','candle','tourbillon') then
      launch_s := private.adjusted_climb_time((ground->>'time_s')::numeric, document, 'ground');
      apex_m := private.adjusted_control((ground->>'height_m')::numeric, document, 'ground.height', height_factor, min_time_s, max_height_m);
      duration_s := launch_s + case when kind = 'tourbillon' then wheel_tail_s else comet_tail_s end;
      ground_count := (ground->>'count')::int;
      count_level := coalesce((document->'adjustments'->>'ground.count')::int,0);
      ground_count := least(max_ground_count,greatest(1,ground_count + count_level * case when kind <> 'tourbillon' and ground_count > large_comet_count then 2 else 1 end));
      if ground->>'pattern' = 'sequence' then duration_s := duration_s + (ground_count - 1) * case when (ground->>'gap_s')::numeric = 0 then default_sequence_gap_s else (ground->>'gap_s')::numeric end; end if;
      if ground->'split' is not null and ground->'split' <> 'null'::jsonb then duration_s := duration_s + case when (ground#>>'{split,life_s}')::numeric = 0 then default_split_life_s else (ground#>>'{split,life_s}')::numeric end; end if;
      weighted_stars := ground_count;
    elsif kind = 'fountain' then
      duration_s := private.adjusted_control((ground->>'duration_s')::numeric, document, 'ground.duration', fountain_duration_factor, min_time_s, max_time_s) + (ground->>'life_s')::numeric + shell_tail_s;
      apex_m := private.fountain_apex(document);
      weighted_stars := (ground->>'rate_per_s')::numeric * (ground->>'life_s')::numeric;
    elsif kind = 'wheel' then
      duration_s := (ground->>'duration_s')::numeric + wheel_tail_s;
      apex_m := (ground->>'height_m')::numeric + (ground->>'radius_m')::numeric;
      weighted_stars := (ground->>'sparks')::numeric;
    elsif kind = 'spinner' then
      duration_s := (ground->>'duration_s')::numeric + (ground->>'count')::numeric * spinner_stagger_s + spinner_tail_s;
      weighted_stars := (ground->>'count')::numeric * (ground->>'sparks')::numeric;
    end if;
    for colour in select colour_value.document#>>'{}'
      from jsonb_path_query(ground, '$.** ? (@.type() == "string")') as colour_value(document)
      where (colour_value.document#>>'{}') ~ '^#[0-9a-fA-F]{6}$' loop colours := colours || private.colour_bucket(colour); end loop;
    nominal_particles := weighted_stars;
  end if;
  -- A mix gain does not create an event; tags come from authored effects, not enabled sound channels.
  if kind in ('comet','candle') and coalesce((ground->>'whistle')::boolean,false) then tags := tags || 'whistle'::text; end if;
  if 'crackle' = any(tags) and (document#>>'{sound,crackle}')::numeric > 0 then noise := greatest(noise,crackle_noise); end if;
  if 'whistle' = any(tags) and (document#>>'{sound,whistle}')::numeric > 0 then noise := greatest(noise,crackle_noise); end if;
  select coalesce(array_agg(distinct value order by value),'{}') into colours from unnest(colours) as value;
  select coalesce(array_agg(distinct value order by value),'{}') into tags from unnest(tags) as value;
  return jsonb_build_object('colours',colours,'tags',tags,'duration_ms',ceil(duration_s * milliseconds_per_second),
    'apex_m',round(apex_m,1),'noise_level',noise,'energy',least(1,round(weighted_stars / energy_full_scale,2)),
    'particles_peak',ceil(nominal_particles),'particles_peak_source','authored_estimate');
end;
$$;
comment on function private.effect_facts(jsonb) is 'Computes search colours, tags, conservative duration in ms, apex bound in metres, ordinal noise and visual energy from validated v1 fields. particles_peak is a nominal authored budget, not a measured simulation peak.';

-- Creates a numbered effect draft under a parent-row lock, optionally restoring an earlier version without rewriting it.
create or replace function private.create_effect_draft(p_effect_id uuid, p_slug text, p_name text, p_family text, p_design jsonb, p_renderer text, p_parent_version_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_effect_id uuid := p_effect_id;
  v_version_id uuid;
  next_number int;
  effect_kind text;
begin
  perform private.require_catalogue_editor();
  if v_effect_id is null then
    insert into public.effects(slug,name,family,kind,created_by)
      values (p_slug,p_name,p_family,p_design->>'kind',private.uid()) returning id into v_effect_id;
  end if;
  select kind into effect_kind from public.effects where id = v_effect_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Effect not found'; end if;
  if effect_kind <> p_design->>'kind' then raise exception using errcode = '23514', message = 'Effect kind must match its design'; end if;
  update public.effects set slug = p_slug, name = p_name, family = p_family where id = v_effect_id;
  select coalesce(max(version.number),0) + 1 into next_number from public.effect_versions as version where version.effect_id = v_effect_id;
  insert into public.effect_versions(effect_id,number,design,renderer,parent_version_id,author_id)
    values (v_effect_id,next_number,p_design,p_renderer,p_parent_version_id,private.uid()) returning id into v_version_id;
  update public.effects set draft_version_id = v_version_id where id = v_effect_id;
  return v_version_id;
end;
$$;
comment on function private.create_effect_draft(uuid, text, text, text, jsonb, text, uuid) is 'Creates a numbered effect draft under a parent-row lock, optionally restoring an earlier version without rewriting it.';

-- Creates a numbered effect draft under a parent-row lock, optionally restoring an earlier version without rewriting it.
create or replace function public.create_effect_draft(p_effect_id uuid, p_slug text, p_name text, p_family text, p_design jsonb, p_renderer text, p_parent_version_id uuid default null)
returns uuid
language sql
set search_path = ''
as $$ select private.create_effect_draft(p_effect_id, p_slug, p_name, p_family, p_design, p_renderer, p_parent_version_id); $$;
comment on function public.create_effect_draft(uuid, text, text, text, jsonb, text, uuid) is 'Creates a numbered effect draft under a parent-row lock, optionally restoring an earlier version without rewriting it.';

-- Autosaves only a matching effect draft; database JSON Schema validation applies to every writer.
create or replace function private.save_effect_draft(p_version_id uuid, p_design jsonb, p_renderer text, p_change_note text default null, p_checks jsonb default '{}', p_reference_media_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
begin
  perform private.require_catalogue_editor();
  update public.effect_versions as version set design = p_design, renderer = p_renderer, change_note = p_change_note, checks = p_checks, reference_media_id = p_reference_media_id
    where version.id = p_version_id and version.status = 'draft'
      and exists (select from public.effects where effects.id = version.effect_id and effects.kind = p_design->>'kind');
  if not found then raise exception using errcode = '23514', message = 'Matching effect draft required'; end if;
end;
$$;
comment on function private.save_effect_draft(uuid, jsonb, text, text, jsonb, uuid) is 'Autosaves only a matching effect draft; database JSON Schema validation applies to every writer.';

-- Autosaves only a matching effect draft; database JSON Schema validation applies to every writer.
create or replace function public.save_effect_draft(p_version_id uuid, p_design jsonb, p_renderer text, p_change_note text default null, p_checks jsonb default '{}', p_reference_media_id uuid default null)
returns void
language sql
set search_path = ''
as $$ select private.save_effect_draft(p_version_id, p_design, p_renderer, p_change_note, p_checks, p_reference_media_id); $$;
comment on function public.save_effect_draft(uuid, jsonb, text, text, jsonb, uuid) is 'Autosaves only a matching effect draft; database JSON Schema validation applies to every writer.';

-- Creates a numbered composed product draft and its letter bindings in one transaction under a parent-row lock.
create or replace function private.create_product_draft(p_product_id uuid, p_slug text, p_name text, p_kind text, p_composition jsonb, p_bindings jsonb, p_source text default 'manual')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_product_id uuid := p_product_id;
  v_version_id uuid;
  next_number int;
  product_kind text;
begin
  perform private.require_catalogue_editor();
  if jsonb_typeof(p_bindings) is distinct from 'object' then raise exception using errcode = '23514', message = 'Bindings must be a letter-to-effect object'; end if;
  if v_product_id is null then
    insert into public.products(slug,name,kind,created_by) values (p_slug,p_name,p_kind,private.uid()) returning id into v_product_id;
  end if;
  select kind into product_kind from public.products where id = v_product_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Product not found'; end if;
  if product_kind <> p_kind or p_kind = 'pack' then raise exception using errcode = '23514', message = 'Matching composed product kind required'; end if;
  update public.products set slug = p_slug, name = p_name where id = v_product_id;
  select coalesce(max(version.number),0) + 1 into next_number from public.product_versions as version where version.product_id = v_product_id;
  insert into public.product_versions(product_id,number,composition,source,author_id)
    values (v_product_id,next_number,p_composition,p_source,private.uid()) returning id into v_version_id;
  insert into public.product_version_effects(product_version_id,letter,effect_id)
    select v_version_id,key,value::uuid from jsonb_each_text(p_bindings);
  update public.products set draft_version_id = v_version_id where id = v_product_id;
  return v_version_id;
end;
$$;
comment on function private.create_product_draft(uuid, text, text, text, jsonb, jsonb, text) is 'Creates a numbered composed product draft and its letter bindings in one transaction under a parent-row lock.';

-- Creates a numbered composed product draft and its letter bindings in one transaction under a parent-row lock.
create or replace function public.create_product_draft(p_product_id uuid, p_slug text, p_name text, p_kind text, p_composition jsonb, p_bindings jsonb, p_source text default 'manual')
returns uuid
language sql
set search_path = ''
as $$ select private.create_product_draft(p_product_id, p_slug, p_name, p_kind, p_composition, p_bindings, p_source); $$;
comment on function public.create_product_draft(uuid, text, text, text, jsonb, jsonb, text) is 'Creates a numbered composed product draft and its letter bindings in one transaction under a parent-row lock.';

-- Autosaves the composition and complete letter bindings atomically, rejecting non-draft versions.
create or replace function private.save_product_draft(p_version_id uuid, p_composition jsonb, p_bindings jsonb, p_change_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
begin
  perform private.require_catalogue_editor();
  if jsonb_typeof(p_bindings) is distinct from 'object' then raise exception using errcode = '23514', message = 'Bindings must be a letter-to-effect object'; end if;
  perform 1 from public.product_versions where id = p_version_id and status = 'draft' for update;
  if not found then raise exception using errcode = '23514', message = 'Product draft required'; end if;
  delete from public.product_version_effects where product_version_id = p_version_id;
  insert into public.product_version_effects(product_version_id,letter,effect_id)
    select p_version_id,key,value::uuid from jsonb_each_text(p_bindings);
  update public.product_versions set composition = p_composition, change_note = p_change_note where id = p_version_id;
end;
$$;
comment on function private.save_product_draft(uuid, jsonb, jsonb, text) is 'Autosaves the composition and complete letter bindings atomically, rejecting non-draft versions.';

-- Autosaves the composition and complete letter bindings atomically, rejecting non-draft versions.
create or replace function public.save_product_draft(p_version_id uuid, p_composition jsonb, p_bindings jsonb, p_change_note text default null)
returns void
language sql
set search_path = ''
as $$ select private.save_product_draft(p_version_id, p_composition, p_bindings, p_change_note); $$;
comment on function public.save_product_draft(uuid, jsonb, jsonb, text) is 'Autosaves the composition and complete letter bindings atomically, rejecting non-draft versions.';

-- Derives composed product facts from current effect facts and tube offsets in milliseconds.
create or replace function private.product_facts(version_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with shots as (
    select tube, effect.* from public.product_versions as version
    cross join lateral jsonb_array_elements(version.composition->'tubes') as tube
    join public.product_version_effects as binding on binding.product_version_id = version.id and binding.letter = tube->>'letter'
    join public.effects as effect on effect.id = binding.effect_id
    where version.id = version_id
  ), aggregate_facts as (
    select count(*) as shot_count,
      coalesce(max(coalesce((tube->>'t_ms')::int,0) + duration_ms),0) as duration_ms,
      coalesce(max(apex_m),0) as apex_m, coalesce(max(noise_level),0) as noise_level,
      coalesce(avg((version.summary->>'energy')::numeric),0) as energy
    from shots join public.effect_versions as version on version.id = shots.current_version_id
  )
  select jsonb_build_object('shot_count',shot_count,'duration_ms',duration_ms,'apex_m',apex_m,'noise_level',noise_level,
    'energy',round(energy,2),'colours',array(select distinct unnest(colours) from shots order by 1),
    'tags',array(select distinct unnest(tags) from shots order by 1)) from aggregate_facts;
$$;
comment on function private.product_facts(uuid) is 'Returns current-effect search facts for a product composition: duration in ms from first firing, apex in metres, shot count, colour/tag unions, maximum noise and mean visual energy. Fuse ignition delay is excluded.';

-- Copies derived product facts while leaving supplier-confirmed safety noise untouched.
create or replace function private.write_product_facts(product_id uuid, facts jsonb)
returns void
language plpgsql
set search_path = ''
as $$
#variable_conflict error
declare
  -- Catalogue ordinal 3 denotes an audible report, distinct from the confirmed safety override.
  report_noise constant int := 3;
begin
  update public.products set shot_count = (facts->>'shot_count')::smallint, duration_ms = (facts->>'duration_ms')::int,
    apex_m = (facts->>'apex_m')::numeric, energy = (facts->>'energy')::numeric,
    colours = array(select jsonb_array_elements_text(facts->'colours')),
    tags = array(select jsonb_array_elements_text(facts->'tags')),
    has_crackle = (facts->'tags') ? 'crackle', has_whistle = (facts->'tags') ? 'whistle',
    has_bangs = (facts->>'noise_level')::int = report_noise
  where id = product_id;
end;
$$;
comment on function private.write_product_facts(uuid,jsonb) is 'Copies computed search facts to the product row; does not overwrite confirmed product safety noise.';

-- Validates tube identity, grid positions, kind semantics and complete published-effect bindings before publication.
create or replace function private.check_product_composition(version_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
#variable_conflict error
declare
  document jsonb;
  product_kind text;
  tube_count int;
begin
  select version.composition, product.kind into document, product_kind from public.product_versions as version
    join public.products as product on product.id = version.product_id where version.id = version_id;
  tube_count := jsonb_array_length(document->'tubes');
  if tube_count = 0 or product_kind = 'pack' or (product_kind in ('single','fountain','wheel','ground') and tube_count <> 1) then
    raise exception using errcode = '23514', message = 'Tube count does not match product kind';
  end if;
  if exists (select from jsonb_array_elements(document->'tubes') as tube
    group by tube->>'i' having count(*) > 1) then
    raise exception using errcode = '23514', message = 'Tube indices must be unique';
  end if;
  if exists (select from jsonb_array_elements(document->'tubes') as tube where
    (product_kind in ('rocket_pack','candle') and tube->'t_ms' <> 'null'::jsonb)
    or (product_kind not in ('rocket_pack','candle') and tube->'t_ms' = 'null'::jsonb)
    or (document ? 'box' and (tube->>'i')::int >= (document#>>'{box,rows}')::int * (document#>>'{box,cols}')::int)
    or (document ? 'box' and (tube ? 'pos') and (
      (tube#>>'{pos,0}')::int >= (document#>>'{box,rows}')::int
      or (tube#>>'{pos,1}')::int >= (document#>>'{box,cols}')::int))) then
    raise exception using errcode = '23514', message = 'Invalid tube timing or grid position';
  end if;
  if exists (select from jsonb_array_elements(document->'tubes') as tube where tube ? 'pos'
    group by tube->'pos' having count(*) > 1) then
    raise exception using errcode = '23514', message = 'Tube positions must be unique';
  end if;
  if exists (select from jsonb_array_elements(document->'tubes') as tube
    left join public.product_version_effects as binding on binding.product_version_id = version_id and binding.letter = tube->>'letter'
    left join public.effects as effect on effect.id = binding.effect_id
    where effect.status is distinct from 'published' or effect.current_version_id is null)
    or exists (select from public.product_version_effects as binding where binding.product_version_id = version_id
      and not exists (select from jsonb_array_elements(document->'tubes') as tube where tube->>'letter' = binding.letter)) then
    raise exception using errcode = '23514', message = 'Every tube letter needs exactly one published effect binding';
  end if;
end;
$$;
comment on function private.check_product_composition(uuid) is 'Rejects invalid tube counts, duplicate indices, incompatible nullable timing, positions outside the grid and missing or unused published effect bindings.';

-- Publishes the current effect draft, supersedes its predecessor without payload edits, and refreshes current product search facts atomically.
create or replace function private.publish_effect_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  version public.effect_versions;
  effect public.effects;
  facts jsonb;
  affected_product public.products;
begin
  perform private.require_catalogue_editor();
  -- Serialises catalogue publication so effect refresh and product publication use one lock order.
  perform pg_advisory_xact_lock(hashtextextended('catalogue.publication',0));
  select * into version from public.effect_versions where id = p_version_id;
  if not found then raise exception using errcode = 'P0002', message = 'Effect version not found'; end if;
  select * into effect from public.effects where id = version.effect_id for update;
  select * into version from public.effect_versions where id = p_version_id for update;
  if version.status <> 'draft' or effect.draft_version_id is distinct from version.id then
    raise exception using errcode = '23514', message = 'Current effect draft required';
  end if;
  facts := private.effect_facts(version.design);
  update public.effect_versions set status = 'superseded' where id = effect.current_version_id;
  update public.effect_versions set status = 'published', summary = facts, published_at = now(), published_by = private.uid() where id = version.id;
  update public.effects set status = 'published', current_version_id = version.id, draft_version_id = null, archived_at = null,
    colours = array(select jsonb_array_elements_text(facts->'colours')), tags = array(select jsonb_array_elements_text(facts->'tags')),
    duration_ms = (facts->>'duration_ms')::int, apex_m = (facts->>'apex_m')::numeric, noise_level = (facts->>'noise_level')::smallint
    where id = effect.id;
  -- Products play current effects. Refresh their search columns without changing historical version summaries.
  for affected_product in select product.* from public.products as product where product.status = 'published' and exists (
    select from public.product_version_effects as binding where binding.product_version_id = product.current_version_id and binding.effect_id = effect.id)
    order by product.id for update loop
    perform private.write_product_facts(affected_product.id,private.product_facts(affected_product.current_version_id));
  end loop;
  perform private.refresh_pack_facts();
end;
$$;
comment on function private.publish_effect_version(uuid) is 'Publishes the current effect draft, supersedes its predecessor without payload edits, and refreshes current product search facts atomically.';

-- Publishes the current effect draft, supersedes its predecessor without payload edits, and refreshes current product search facts atomically.
create or replace function public.publish_effect_version(p_version_id uuid)
returns void
language sql
set search_path = ''
as $$ select private.publish_effect_version(p_version_id); $$;
comment on function public.publish_effect_version(uuid) is 'Publishes the current effect draft, supersedes its predecessor without payload edits, and refreshes current product search facts atomically.';

-- Publishes a safety-confirmed product draft and its validated composition, superseding the previous version and copying derived facts in one transaction.
create or replace function private.publish_product_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  version public.product_versions;
  product public.products;
  facts jsonb;
begin
  perform private.require_catalogue_editor();
  perform pg_advisory_xact_lock(hashtextextended('catalogue.publication',0));
  select * into version from public.product_versions where id = p_version_id;
  if not found then raise exception using errcode = 'P0002', message = 'Product version not found'; end if;
  select * into product from public.products where id = version.product_id for update;
  select * into version from public.product_versions where id = p_version_id for update;
  if version.status <> 'draft' or product.draft_version_id is distinct from version.id then
    raise exception using errcode = '23514', message = 'Current product draft required';
  end if;
  perform private.check_product_safety(product.id);
  perform private.check_product_composition(version.id);
  facts := private.product_facts(version.id);
  update public.product_versions set status = 'superseded' where id = product.current_version_id;
  update public.product_versions set status = 'published', summary = facts, published_at = now(), published_by = private.uid() where id = version.id;
  update public.products set status = 'published', current_version_id = version.id, draft_version_id = null, archived_at = null where id = product.id;
  perform private.write_product_facts(product.id,facts);
  perform private.refresh_pack_facts();
end;
$$;
comment on function private.publish_product_version(uuid) is 'Publishes a safety-confirmed product draft and its validated composition, superseding the previous version and copying derived facts in one transaction.';

-- Publishes a safety-confirmed product draft and its validated composition, superseding the previous version and copying derived facts in one transaction.
create or replace function public.publish_product_version(p_version_id uuid)
returns void
language sql
set search_path = ''
as $$ select private.publish_product_version(p_version_id); $$;
comment on function public.publish_product_version(uuid) is 'Publishes a safety-confirmed product draft and its validated composition, superseding the previous version and copying derived facts in one transaction.';

-- Archives the effect without rewriting version history; refuses to break published catalogue dependencies.
create or replace function private.archive_effect(p_effect_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
begin
  perform private.require_catalogue_editor();
  perform pg_advisory_xact_lock(hashtextextended('catalogue.publication',0));
  if exists (select from public.product_version_effects as binding join public.products as product
    on product.current_version_id = binding.product_version_id where binding.effect_id = p_effect_id and product.status = 'published') then
    raise exception using errcode = '23514', message = 'Effect is used by a published product';
  end if;
  update public.effects set status = 'archived', archived_at = now() where id = p_effect_id;
  if not found then raise exception using errcode = 'P0002', message = 'Effect not found'; end if;
end;
$$;
comment on function private.archive_effect(uuid) is 'Archives the effect without rewriting version history; refuses to break published catalogue dependencies.';

-- Archives the effect without rewriting version history; refuses to break published catalogue dependencies.
create or replace function public.archive_effect(p_effect_id uuid)
returns void
language sql
set search_path = ''
as $$ select private.archive_effect(p_effect_id); $$;
comment on function public.archive_effect(uuid) is 'Archives the effect without rewriting version history; refuses to break published catalogue dependencies.';

-- Archives the product without rewriting version history; refuses to break published catalogue dependencies.
create or replace function private.archive_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
begin
  perform private.require_catalogue_editor();
  perform pg_advisory_xact_lock(hashtextextended('catalogue.publication',0));
  if exists (select from public.pack_items as item join public.products as pack on pack.id = item.pack_id
    where item.item_id = p_product_id and pack.status = 'published') then
    raise exception using errcode = '23514', message = 'Product is used by a published pack';
  end if;
  update public.products set status = 'archived', archived_at = now() where id = p_product_id;
  if not found then raise exception using errcode = 'P0002', message = 'Product not found'; end if;
end;
$$;
comment on function private.archive_product(uuid) is 'Archives the product without rewriting version history; refuses to break published catalogue dependencies.';

-- Archives the product without rewriting version history; refuses to break published catalogue dependencies.
create or replace function public.archive_product(p_product_id uuid)
returns void
language sql
set search_path = ''
as $$ select private.archive_product(p_product_id); $$;
comment on function public.archive_product(uuid) is 'Archives the product without rewriting version history; refuses to break published catalogue dependencies.';

-- Requires supplied and staff-confirmed physical safety and at least one confirmed enabled-market legal category.
create or replace function private.check_product_safety(product_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
#variable_conflict error
begin
  if not exists (select from public.products as product where product.id = product_id
    and product.min_safety_distance_m is not null and product.noise_level is not null
    and product.safety_supplied_by is not null and product.safety_confirmed_by is not null and product.safety_confirmed_at is not null)
    or not exists (select from public.product_markets as legal join public.markets as market on market.code = legal.market
      where legal.product_id = check_product_safety.product_id and legal.allowed and market.enabled
        and legal.supplied_by is not null and legal.confirmed_by is not null and legal.confirmed_at is not null) then
    raise exception using errcode = '23514', message = 'Confirmed physical safety and market legality required';
  end if;
end;
$$;
comment on function private.check_product_safety(uuid) is 'Refuses publication until supplier/admin safety facts and an enabled-market legal category have staff confirmation and source attribution.';

-- Refreshes published selection packs from the leaves upwards, so nested contents keep current search facts.
create or replace function private.refresh_pack_facts()
returns void
language plpgsql
set search_path = ''
as $$
#variable_conflict error
declare
  pack record;
  facts jsonb;
begin
  for pack in
    with recursive contents(root, item, depth) as (
      select pack_id,item_id,1 from public.pack_items
      union all
      select contents.root, item.item_id, contents.depth + 1 from contents
        join public.pack_items as item on item.pack_id = contents.item
    ) select product.id, max(contents.depth) as depth from public.products as product
      join contents on contents.root = product.id where product.kind = 'pack' and product.status = 'published'
      group by product.id order by depth, product.id
  loop
    select jsonb_build_object('shot_count',sum(item.quantity * product.shot_count),
      'duration_ms',sum(item.quantity * product.duration_ms), 'apex_m',max(product.apex_m),
      'noise_level',max(product.noise_level),'energy',round(sum(item.quantity * product.energy) / sum(item.quantity),2),
      'colours',array(select distinct unnest(product.colours) from public.pack_items as item join public.products as product on product.id = item.item_id where item.pack_id = pack.id order by 1),
      'tags',array(select distinct unnest(product.tags) from public.pack_items as item join public.products as product on product.id = item.item_id where item.pack_id = pack.id order by 1))
      into facts from public.pack_items as item join public.products as product on product.id = item.item_id where item.pack_id = pack.id;
    perform private.write_product_facts(pack.id,facts);
  end loop;
end;
$$;
comment on function private.refresh_pack_facts() is 'Refreshes current selection-pack facts in dependency order; quantity-weighted counts, total duration in ms, maximum apex in metres, union colours/tags and mean energy.';

-- Protects pack identity, draft-only contents and acyclic nesting even for elevated writers.
create or replace function private.guard_pack_item()
returns trigger
language plpgsql
set search_path = ''
as $$
#variable_conflict error
declare
  pack_id uuid;
begin
  pack_id := case when tg_op = 'DELETE' then old.pack_id else new.pack_id end;
  perform pg_advisory_xact_lock(hashtextextended('catalogue.publication',0));
  if tg_op = 'UPDATE' and new.pack_id <> old.pack_id then
    raise exception using errcode = '23514', message = 'Pack identity is immutable';
  end if;
  perform 1 from public.products where id = pack_id and kind = 'pack' and status = 'draft' for update;
  if not found then raise exception using errcode = '23514', message = 'Pack contents require a draft selection pack'; end if;
  if tg_op = 'DELETE' then return old; end if;
  if exists (with recursive descendants(id) as (
    select new.item_id union select item.item_id from public.pack_items as item join descendants on item.pack_id = descendants.id
  ) select from descendants where id = new.pack_id) then
    raise exception using errcode = '23514', message = 'Selection pack contents must not form a cycle';
  end if;
  return new;
end;
$$;
comment on function private.guard_pack_item() is 'Locks pack content writes, rejects non-pack or non-draft parents and prevents recursive selection-pack cycles.';
create trigger guard_pack before insert or update or delete on public.pack_items for each row execute function private.guard_pack_item();

-- Records supplied physical safety and complete market legality, with source attribution and the current staff confirmation, atomically.
create or replace function private.confirm_product_safety(p_product_id uuid, p_distance_m smallint, p_noise_level smallint, p_markets jsonb, p_supplier_id uuid default null, p_supplied_by uuid default null, p_calibre_mm smallint default null, p_nec_grams numeric default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  supplier_actor uuid := coalesce(p_supplied_by,private.uid());
begin
  perform private.require_catalogue_editor();
  perform pg_advisory_xact_lock(hashtextextended('catalogue.publication',0));
  perform 1 from public.products where id = p_product_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Product not found'; end if;
  if p_distance_m is null or p_noise_level is null or jsonb_typeof(p_markets) is distinct from 'array' or jsonb_array_length(p_markets) = 0 then
    raise exception using errcode = '23514', message = 'Physical safety and legal categories required';
  end if;
  if not exists (select from public.profiles as profile where profile.id = supplier_actor and profile.status = 'active' and not profile.is_anonymous)
    or (p_supplier_id is not null and not exists (select from public.supplier_members where supplier_id = p_supplier_id and profile_id = supplier_actor))
    or (p_supplier_id is null and not exists (select from public.staff_roles where profile_id = supplier_actor and role in ('super_admin','catalogue_editor'))) then
    raise exception using errcode = '23514', message = 'Safety source must be an active supplier member or catalogue editor';
  end if;
  update public.products set min_safety_distance_m = p_distance_m, noise_level = p_noise_level,
    calibre_mm = p_calibre_mm, nec_grams = p_nec_grams, safety_supplied_by = supplier_actor, safety_supplier_id = p_supplier_id,
    safety_confirmed_by = private.uid(), safety_confirmed_at = now() where id = p_product_id;
  delete from public.product_markets where product_id = p_product_id;
  insert into public.product_markets(product_id,market,legal_category,min_age,allowed,supplied_by,supplier_id,confirmed_by,confirmed_at)
    select p_product_id, fact->>'market', fact->>'legal_category', (fact->>'min_age')::smallint,
      coalesce((fact->>'allowed')::boolean,true),supplier_actor,p_supplier_id,private.uid(),now()
      from jsonb_array_elements(p_markets) as fact;
  if exists (select from public.products where id = p_product_id and status = 'published') then
    perform private.check_product_safety(p_product_id);
  end if;
  perform private.refresh_pack_facts();
end;
$$;
comment on function private.confirm_product_safety(uuid, smallint, smallint, jsonb, uuid, uuid, smallint, numeric) is 'Records supplied physical safety and complete market legality, with source attribution and the current staff confirmation, atomically.';

-- Records supplied physical safety and complete market legality, with source attribution and the current staff confirmation, atomically.
create or replace function public.confirm_product_safety(p_product_id uuid, p_distance_m smallint, p_noise_level smallint, p_markets jsonb, p_supplier_id uuid default null, p_supplied_by uuid default null, p_calibre_mm smallint default null, p_nec_grams numeric default null)
returns void
language sql
set search_path = ''
as $$ select private.confirm_product_safety(p_product_id, p_distance_m, p_noise_level, p_markets, p_supplier_id, p_supplied_by, p_calibre_mm, p_nec_grams); $$;
comment on function public.confirm_product_safety(uuid, smallint, smallint, jsonb, uuid, uuid, smallint, numeric) is 'Records supplied physical safety and complete market legality, with source attribution and the current staff confirmation, atomically.';

-- Creates a draft selection pack whose contents are product rows rather than tube compositions.
create or replace function private.create_pack(p_slug text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  pack_id uuid;
begin
  perform private.require_catalogue_editor();
  insert into public.products(slug,name,kind,created_by) values (p_slug,p_name,'pack',private.uid()) returning id into pack_id;
  return pack_id;
end;
$$;
comment on function private.create_pack(text, text) is 'Creates a draft selection pack whose contents are product rows rather than tube compositions.';

-- Creates a draft selection pack whose contents are product rows rather than tube compositions.
create or replace function public.create_pack(p_slug text, p_name text)
returns uuid
language sql
set search_path = ''
as $$ select private.create_pack(p_slug, p_name); $$;
comment on function public.create_pack(text, text) is 'Creates a draft selection pack whose contents are product rows rather than tube compositions.';

-- Replaces complete draft pack contents atomically, validating quantities, product foreign keys and cycles.
create or replace function private.save_pack_items(p_pack_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
begin
  perform private.require_catalogue_editor();
  perform pg_advisory_xact_lock(hashtextextended('catalogue.publication',0));
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception using errcode = '23514', message = 'Pack items must be an array'; end if;
  perform 1 from public.products where id = p_pack_id and kind = 'pack' and status = 'draft' for update;
  if not found then raise exception using errcode = '23514', message = 'Draft selection pack required'; end if;
  delete from public.pack_items where pack_id = p_pack_id;
  insert into public.pack_items(pack_id,item_id,quantity,sort)
    select p_pack_id,(item->>'item_id')::uuid,(item->>'quantity')::smallint,coalesce((item->>'sort')::smallint,0)
      from jsonb_array_elements(p_items) as item;
end;
$$;
comment on function private.save_pack_items(uuid, jsonb) is 'Replaces complete draft pack contents atomically, validating quantities, product foreign keys and cycles.';

-- Replaces complete draft pack contents atomically, validating quantities, product foreign keys and cycles.
create or replace function public.save_pack_items(p_pack_id uuid, p_items jsonb)
returns void
language sql
set search_path = ''
as $$ select private.save_pack_items(p_pack_id, p_items); $$;
comment on function public.save_pack_items(uuid, jsonb) is 'Replaces complete draft pack contents atomically, validating quantities, product foreign keys and cycles.';

-- Publishes a confirmed selection pack containing only published products and derives its search facts atomically.
create or replace function private.publish_pack(p_pack_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
begin
  perform private.require_catalogue_editor();
  perform pg_advisory_xact_lock(hashtextextended('catalogue.publication',0));
  perform 1 from public.products where id = p_pack_id and kind = 'pack' and status = 'draft' for update;
  if not found then raise exception using errcode = '23514', message = 'Draft selection pack required'; end if;
  perform private.check_product_safety(p_pack_id);
  if not exists (select from public.pack_items where pack_id = p_pack_id)
    or exists (select from public.pack_items as item join public.products as product on product.id = item.item_id
      where item.pack_id = p_pack_id and product.status <> 'published') then
    raise exception using errcode = '23514', message = 'Pack contents must be non-empty and published';
  end if;
  update public.products set status = 'published' where id = p_pack_id;
  perform private.refresh_pack_facts();
end;
$$;
comment on function private.publish_pack(uuid) is 'Publishes a confirmed selection pack containing only published products and derives its search facts atomically.';

-- Publishes a confirmed selection pack containing only published products and derives its search facts atomically.
create or replace function public.publish_pack(p_pack_id uuid)
returns void
language sql
set search_path = ''
as $$ select private.publish_pack(p_pack_id); $$;
comment on function public.publish_pack(uuid) is 'Publishes a confirmed selection pack containing only published products and derives its search facts atomically.';

-- Updates canonical product descriptions and barcode without changing confirmed safety or derived search facts.
create or replace function private.save_product_details(p_product_id uuid, p_brand text, p_description text, p_gtin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
begin
  perform private.require_catalogue_editor();
  update public.products set brand = p_brand, description = p_description, gtin = p_gtin where id = p_product_id;
  if not found then raise exception using errcode = 'P0002', message = 'Product not found'; end if;
end;
$$;
comment on function private.save_product_details(uuid, text, text, text) is 'Updates canonical product descriptions and barcode without changing confirmed safety or derived search facts.';

-- Updates canonical product descriptions and barcode without changing confirmed safety or derived search facts.
create or replace function public.save_product_details(p_product_id uuid, p_brand text, p_description text, p_gtin text)
returns void
language sql
set search_path = ''
as $$ select private.save_product_details(p_product_id, p_brand, p_description, p_gtin); $$;
comment on function public.save_product_details(uuid, text, text, text) is 'Updates canonical product descriptions and barcode without changing confirmed safety or derived search facts.';

-- Updates effect library metadata without changing the renderer document, lifecycle or derived search facts.
create or replace function private.save_effect_details(p_effect_id uuid, p_name text, p_family text, p_is_template boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
begin
  perform private.require_catalogue_editor();
  update public.effects set name = p_name, family = p_family, is_template = p_is_template where id = p_effect_id;
  if not found then raise exception using errcode = 'P0002', message = 'Effect not found'; end if;
end;
$$;
comment on function private.save_effect_details(uuid, text, text, boolean) is 'Updates effect library metadata without changing the renderer document, lifecycle or derived search facts.';

-- Updates effect library metadata without changing the renderer document, lifecycle or derived search facts.
create or replace function public.save_effect_details(p_effect_id uuid, p_name text, p_family text, p_is_template boolean)
returns void
language sql
set search_path = ''
as $$ select private.save_effect_details(p_effect_id, p_name, p_family, p_is_template); $$;
comment on function public.save_effect_details(uuid, text, text, boolean) is 'Updates effect library metadata without changing the renderer document, lifecycle or derived search facts.';

-- Copies catalogue content into a new draft without carrying confirmed safety or publication.
create or replace function private.duplicate_catalogue_item(p_kind text, p_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  source_effect public.effects;
  source_product public.products;
  effect_version public.effect_versions;
  product_version public.product_versions;
  new_version uuid;
  new_parent uuid;
  bindings jsonb;
  contents jsonb;
  copy_slug text;
begin
  perform private.require_catalogue_editor();
  -- Match catalogue publication's lock order before locking source parents or pack contents.
  perform pg_advisory_xact_lock(hashtextextended('catalogue.publication',0));
  copy_slug := 'copy-' || extensions.gen_random_uuid()::text;
  if p_kind = 'effect' then
    select * into source_effect from public.effects where id = p_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'Effect not found'; end if;
    select * into effect_version from public.effect_versions
      where id = coalesce(source_effect.draft_version_id, source_effect.current_version_id) for update;
    if not found then raise exception using errcode = '23514', message = 'Effect has no version to duplicate'; end if;
    new_version := private.create_effect_draft(null, copy_slug, source_effect.name || ' copy',
      source_effect.family, effect_version.design, effect_version.renderer);
    select effect_id into new_parent from public.effect_versions where id = new_version;
  elsif p_kind = 'product' then
    select * into source_product from public.products where id = p_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'Product not found'; end if;
    if source_product.kind = 'pack' then
      new_parent := private.create_pack(copy_slug, source_product.name || ' copy');
      select coalesce(jsonb_agg(jsonb_build_object('item_id', item_id, 'quantity', quantity, 'sort', sort)), '[]')
        into contents from public.pack_items where pack_id = p_id;
      perform private.save_pack_items(new_parent, contents);
    else
      -- Lock the source draft so autosave cannot separate its composition from its letter bindings.
      select * into product_version from public.product_versions
        where id = coalesce(source_product.draft_version_id, source_product.current_version_id) for update;
      if not found then raise exception using errcode = '23514', message = 'Product has no version to duplicate'; end if;
      select coalesce(jsonb_object_agg(letter, effect_id), '{}') into bindings
        from public.product_version_effects where product_version_id = product_version.id;
      new_version := private.create_product_draft(null, copy_slug, source_product.name || ' copy',
        source_product.kind, product_version.composition, bindings);
      select product_id into new_parent from public.product_versions where id = new_version;
    end if;
  else
    raise exception using errcode = '22023', message = 'Unknown catalogue kind';
  end if;
  return new_parent;
end;
$$;
comment on function private.duplicate_catalogue_item(text, uuid) is 'Atomically duplicates the preferred draft or current version, including bindings or pack contents, as an unpublished parent with no confirmed safety.';

-- Exposes atomic duplication only through the catalogue editor boundary.
create or replace function public.duplicate_catalogue_item(p_kind text, p_id uuid)
returns uuid language sql set search_path = '' as $$
  select private.duplicate_catalogue_item(p_kind, p_id);
$$;
comment on function public.duplicate_catalogue_item(text, uuid) is 'Duplicates an effect or product into an independent draft and returns its parent UUID.';

-- Supplier submissions, measured video evidence, proposed designs and client-append-only QA decisions.
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id),
  media_id uuid not null references public.media(id),
  submitted_by uuid references public.profiles(id),
  stage text not null default 'uploaded' check (stage in ('uploaded','reading','matching','review','published','failed')),
  mapping jsonb not null default '{}' check (jsonb_typeof(mapping) = 'object'),
  counts jsonb not null default '{}' check (jsonb_typeof(counts) = 'object'),
  error text, published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (supplier_id, id)
);
create index imports_supplier_idx on public.imports(supplier_id);
create index imports_media_idx on public.imports(media_id);
create table public.import_lines (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.imports(id) on delete cascade,
  row_number int not null check (row_number > 0),
  raw jsonb not null check (jsonb_typeof(raw) = 'object'),
  supplier_product_id uuid references public.supplier_products(id),
  suggested_product_id uuid references public.products(id),
  confidence numeric(3,2) check (confidence between 0 and 1),
  state text not null check (state in ('auto','suggested','new','accepted','rejected','error')),
  decided_by uuid references public.profiles(id), decided_at timestamptz, note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (import_id, row_number),
  check ((decided_by is null) = (decided_at is null))
);
create table public.video_analyses (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media(id),
  product_id uuid references public.products(id),
  supplier_product_id uuid references public.supplier_products(id),
  extractor text not null check (length(extractor) > 0),
  priors jsonb not null default '{}' check (jsonb_typeof(priors) = 'object'),
  shots jsonb check (jsonb_typeof(shots) = 'array'),
  features jsonb, keyframes jsonb,
  status text not null default 'queued' check (status in ('queued','measuring','interpreting','fitting','ready','failed')),
  error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index video_analyses_media_idx on public.video_analyses(media_id);
create index video_analyses_product_idx on public.video_analyses(product_id);
create index video_analyses_supplier_product_idx on public.video_analyses(supplier_product_id);
create table public.design_candidates (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.video_analyses(id) on delete cascade,
  source text not null check (source in ('llm','fit','manual')),
  model text, parent_id uuid,
  proposal jsonb not null check (jsonb_typeof(proposal) = 'object'),
  scores jsonb not null default '{}' check (jsonb_typeof(scores) = 'object'),
  overall numeric(4,3) check (overall between 0 and 1),
  renderer text not null check (length(renderer) > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (analysis_id, id),
  foreign key (analysis_id, parent_id) references public.design_candidates(analysis_id, id),
  check (parent_id <> id)
);
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  effect_version_id uuid references public.effect_versions(id) on delete cascade,
  product_version_id uuid references public.product_versions(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  decision text not null check (decision in ('approved','changes_requested','rejected','comment')),
  reasons text[] not null default '{}', note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((effect_version_id is null) <> (product_version_id is null))
);
create index reviews_effect_version_idx on public.reviews(effect_version_id);
create index reviews_product_version_idx on public.reviews(product_version_id);
alter table public.product_versions add constraint product_versions_candidate_fk
  foreign key (candidate_id) references public.design_candidates(id);
create unique index product_versions_candidate_idx on public.product_versions(candidate_id) where candidate_id is not null;
alter table public.supplier_products add constraint supplier_products_last_import_fk
  foreign key (last_import_id) references public.imports(id);
alter table public.supplier_products add constraint supplier_products_import_supplier_fk
  foreign key (supplier_id, last_import_id) references public.imports(supplier_id, id);
comment on column public.product_versions.candidate_id is 'Accepted public.design_candidates(id), retained as video reconstruction provenance.';
comment on column public.supplier_products.last_import_id is 'Latest public.imports(id) supplying this listing, from the same supplier.';

-- Validate linked evidence as the owner so supplier RLS cannot conceal a foreign reference.
create or replace function private.guard_import_evidence()
returns trigger language plpgsql security definer set search_path = '' as $$
#variable_conflict error
begin
  if tg_op = 'UPDATE' and (new.supplier_id is distinct from old.supplier_id or new.media_id is distinct from old.media_id
    or new.submitted_by is distinct from old.submitted_by) then
    raise exception using errcode = '23514', message = 'Import submission identity is immutable';
  end if;
  if not exists (select from public.media as media where media.id = new.media_id
    and media.supplier_id = new.supplier_id and media.organisation_id is null
    and media.kind = 'price_list') then
    raise exception using errcode = '23514', message = 'Import requires a price list owned by its supplier';
  end if;
  return new;
end;
$$;
comment on function private.guard_import_evidence() is 'Requires price-list evidence owned by the submitting supplier, including trusted backend writes.';
create trigger guard_evidence before insert or update on public.imports for each row execute function private.guard_import_evidence();

-- Keep matched listings inside the supplier boundary of the original upload.
create or replace function private.guard_import_line()
returns trigger language plpgsql security definer set search_path = '' as $$
#variable_conflict error
begin
  if new.supplier_product_id is not null and not exists (
    select from public.imports as upload join public.supplier_products as listing on listing.supplier_id = upload.supplier_id
    where upload.id = new.import_id and listing.id = new.supplier_product_id
  ) then
    raise exception using errcode = '23514', message = 'Matched listing must belong to the import supplier';
  end if;
  return new;
end;
$$;
comment on function private.guard_import_line() is 'Rejects import lines matched to another supplier listing.';
create trigger guard_listing before insert or update on public.import_lines for each row execute function private.guard_import_line();

-- Require video evidence and compatible supplier/product priors, without inferring safety.
create or replace function private.guard_video_evidence()
returns trigger language plpgsql security definer set search_path = '' as $$
#variable_conflict error
begin
  if tg_op = 'UPDATE' and exists (
    select from public.design_candidates as candidate join public.product_versions as version on version.candidate_id = candidate.id
    where candidate.analysis_id = old.id
  ) and (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
    raise exception using errcode = '23514', message = 'Accepted video evidence is immutable';
  end if;
  if not exists (select from public.media as media where media.id = new.media_id and media.kind = 'video') then
    raise exception using errcode = '23514', message = 'Analysis requires video media';
  end if;
  if new.supplier_product_id is not null and not exists (
    select from public.supplier_products as listing join public.media as media on media.supplier_id = listing.supplier_id
    where listing.id = new.supplier_product_id and media.id = new.media_id
      and (new.product_id is null or listing.product_id is null or listing.product_id = new.product_id)
  ) then
    raise exception using errcode = '23514', message = 'Video listing must match its media supplier and product';
  end if;
  return new;
end;
$$;
comment on function private.guard_video_evidence() is 'Rejects non-video evidence and incompatible supplier/product links.';
create trigger guard_evidence before insert or update on public.video_analyses for each row execute function private.guard_video_evidence();

alter table public.imports enable row level security;
create trigger set_updated_at before update on public.imports for each row execute function private.set_updated_at();

alter table public.import_lines enable row level security;
create trigger set_updated_at before update on public.import_lines for each row execute function private.set_updated_at();

alter table public.video_analyses enable row level security;
create trigger set_updated_at before update on public.video_analyses for each row execute function private.set_updated_at();

alter table public.design_candidates enable row level security;
create trigger set_updated_at before update on public.design_candidates for each row execute function private.set_updated_at();

alter table public.reviews enable row level security;
create trigger set_updated_at before update on public.reviews for each row execute function private.set_updated_at();
create policy imports_select on public.imports for select to authenticated
  using ((select private.staff_role()) is not null or supplier_id in (select private.supplier_ids()));
create policy imports_insert on public.imports for insert to authenticated with check (submitted_by = (select private.uid()) and ((select private.staff_role()) in ('super_admin','catalogue_editor') or (supplier_id in (select private.supplier_ids()) and stage = 'uploaded' and mapping = '{}'::jsonb and counts = '{}'::jsonb and error is null and published_at is null)));
create policy imports_update on public.imports for update to authenticated
  using ((select private.staff_role()) in ('super_admin','catalogue_editor'))
  with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy imports_delete on public.imports for delete to authenticated
  using ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy import_lines_select on public.import_lines for select to authenticated
  using ((select private.staff_role()) is not null or exists (select from public.imports as upload where upload.id = import_id and upload.supplier_id in (select private.supplier_ids())));
create policy import_lines_insert on public.import_lines for insert to authenticated with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy import_lines_update on public.import_lines for update to authenticated
  using ((select private.staff_role()) in ('super_admin','catalogue_editor'))
  with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy import_lines_delete on public.import_lines for delete to authenticated
  using ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy video_analyses_select on public.video_analyses for select to authenticated
  using ((select private.staff_role()) is not null);
create policy video_analyses_insert on public.video_analyses for insert to authenticated with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy video_analyses_update on public.video_analyses for update to authenticated
  using ((select private.staff_role()) in ('super_admin','catalogue_editor'))
  with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy video_analyses_delete on public.video_analyses for delete to authenticated
  using ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy design_candidates_select on public.design_candidates for select to authenticated
  using ((select private.staff_role()) is not null);
create policy design_candidates_insert on public.design_candidates for insert to authenticated with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy design_candidates_update on public.design_candidates for update to authenticated
  using ((select private.staff_role()) in ('super_admin','catalogue_editor'))
  with check ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy design_candidates_delete on public.design_candidates for delete to authenticated
  using ((select private.staff_role()) in ('super_admin','catalogue_editor'));
create policy reviews_select on public.reviews for select to authenticated
  using ((select private.staff_role()) is not null);
create policy reviews_insert on public.reviews for insert to authenticated
  with check (reviewer_id = (select private.uid()) and (select private.staff_role()) in ('super_admin','catalogue_editor','reviewer'));

-- Object overrides preserve unspecified fields; arrays and scalar values replace whole values.
create or replace function private.merge_design_overrides(p_base jsonb, p_overrides jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
#variable_conflict error
declare
  v_result jsonb := p_base;
  v_entry record;
begin
  for v_entry in select entry.key, entry.value from jsonb_each(p_overrides) as entry loop
    if jsonb_typeof(v_entry.value) = 'object' and jsonb_typeof(v_result->v_entry.key) = 'object' then
      v_result := jsonb_set(v_result, array[v_entry.key], private.merge_design_overrides(v_result->v_entry.key, v_entry.value));
    else
      v_result := jsonb_set(v_result, array[v_entry.key], v_entry.value);
    end if;
  end loop;
  return v_result;
end;
$$;
comment on function private.merge_design_overrides(jsonb, jsonb) is 'Returns a recursively overridden design object; arrays, scalars and explicit JSON null replace values, with no unit conversion.';

-- Validate the candidate document and exact letter coverage before creating catalogue rows.
create or replace function private.check_candidate_proposal(p_proposal jsonb, p_kind text)
returns void language plpgsql set search_path = '' as $$
#variable_conflict error
declare
  v_composition jsonb := p_proposal->'composition';
  v_effects jsonb := p_proposal->'effects';
begin
  if jsonb_typeof(v_effects) is distinct from 'object' or v_effects = '{}'::jsonb
    or not coalesce(extensions.jsonb_matches_schema(private.composition_schema(), v_composition), false)
    or exists (select from jsonb_object_keys(p_proposal) as entry(key) where entry.key not in ('effects','composition')) then
    raise exception using errcode = '23514', message = 'Candidate requires effects and a valid composition';
  end if;
  if jsonb_array_length(v_composition->'tubes') = 0 or p_kind = 'pack'
    or (p_kind in ('single','fountain','wheel','ground') and jsonb_array_length(v_composition->'tubes') <> 1) then
    raise exception using errcode = '23514', message = 'Tube count does not match product kind';
  end if;
  if exists (select from jsonb_array_elements(v_composition->'tubes') as tube
    group by tube->>'i' having count(*) > 1)
    or exists (select from jsonb_array_elements(v_composition->'tubes') as tube where tube ? 'pos'
      group by tube->'pos' having count(*) > 1) then
    raise exception using errcode = '23514', message = 'Tube indices and positions must be unique';
  end if;
  if exists (select from jsonb_array_elements(v_composition->'tubes') as tube where
    (p_kind in ('rocket_pack','candle') and tube->'t_ms' <> 'null'::jsonb)
    or (p_kind not in ('rocket_pack','candle') and tube->'t_ms' = 'null'::jsonb)
    or (v_composition ? 'box' and (tube->>'i')::int >= (v_composition#>>'{box,rows}')::int * (v_composition#>>'{box,cols}')::int)
    or (v_composition ? 'box' and tube ? 'pos' and (
      (tube#>>'{pos,0}')::int >= (v_composition#>>'{box,rows}')::int
      or (tube#>>'{pos,1}')::int >= (v_composition#>>'{box,cols}')::int))) then
    raise exception using errcode = '23514', message = 'Invalid tube timing or grid position';
  end if;
  if exists (select from jsonb_array_elements(v_composition->'tubes') as tube where not (v_effects ? (tube->>'letter')))
    or exists (select from jsonb_each(v_effects) as entry where entry.key !~ '^[a-z]{1,2}$'
      or not exists (select from jsonb_array_elements(v_composition->'tubes') as tube where tube->>'letter' = entry.key)) then
    raise exception using errcode = '23514', message = 'Candidate effects must match tube letters exactly';
  end if;
end;
$$;
comment on function private.check_candidate_proposal(jsonb, text) is 'Validates composition shape, product-kind timing in ms from first firing, grid bounds and exact effect-letter coverage; does not require publication.';

-- Resolve a published template by slug, then let the canonical design constraint validate overrides.
create or replace function private.create_candidate_effect(p_candidate_id uuid, p_letter text, p_effect jsonb, p_renderer text, p_media_id uuid)
returns uuid language plpgsql set search_path = '' as $$
#variable_conflict error
declare
  v_template record;
  v_design jsonb;
  v_version_id uuid;
  v_effect_id uuid;
begin
  if jsonb_typeof(p_effect) is distinct from 'object' then
    raise exception using errcode = '23514', message = 'Effect proposal must be an object';
  end if;
  if jsonb_typeof(p_effect->'template') is distinct from 'string'
    or (p_effect ? 'overrides' and jsonb_typeof(p_effect->'overrides') is distinct from 'object')
    or exists (select from jsonb_object_keys(p_effect) as entry(key) where entry.key not in ('template','overrides')) then
    raise exception using errcode = '23514', message = 'Effect proposal requires a template slug and object overrides';
  end if;
  select effect.name, effect.family, effect.kind, version.design into v_template
    from public.effects as effect join public.effect_versions as version on version.id = effect.current_version_id
    where effect.slug = p_effect->>'template' and effect.is_template and effect.status = 'published' and version.status = 'published'
    for share of effect, version;
  if not found then raise exception using errcode = '23514', message = 'Published effect template required'; end if;
  v_design := private.merge_design_overrides(v_template.design, coalesce(p_effect->'overrides', '{}'::jsonb));
  if v_design->>'kind' is distinct from v_template.kind then
    raise exception using errcode = '23514', message = 'Overrides cannot change template kind';
  end if;
  v_version_id := private.create_effect_draft(null, 'video-' || p_candidate_id::text || '-' || p_letter,
    v_template.name || ' (' || p_letter || ')', v_template.family, v_design, p_renderer);
  update public.effect_versions as version set reference_media_id = p_media_id where version.id = v_version_id returning version.effect_id into v_effect_id;
  return v_effect_id;
end;
$$;
comment on function private.create_candidate_effect(uuid, text, jsonb, text, uuid) is 'Creates one validated draft effect from a published template slug and recursive overrides, recording renderer and video reference; returns the effect UUID.';

-- Serialise acceptance and return the existing result on retry, preserving its provenance.
create or replace function private.accept_design_candidate(p_candidate_id uuid, p_slug text default null, p_name text default null, p_kind text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_candidate public.design_candidates%rowtype;
  v_analysis public.video_analyses%rowtype;
  v_product_slug text;
  v_product_name text;
  v_product_kind text;
  v_product_status text;
  v_draft_version_id uuid;
  v_version_id uuid;
  v_bindings jsonb := '{}'::jsonb;
  v_entry record;
  v_effect_id uuid;
begin
  perform private.require_catalogue_editor();
  select candidate.* into v_candidate from public.design_candidates as candidate where candidate.id = p_candidate_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Candidate not found'; end if;
  select version.id into v_version_id from public.product_versions as version where version.candidate_id = p_candidate_id;
  if found then return v_version_id; end if;
  select analysis.* into v_analysis from public.video_analyses as analysis where analysis.id = v_candidate.analysis_id for update;
  if v_analysis.status <> 'ready' then raise exception using errcode = '23514', message = 'Ready video analysis required'; end if;
  if v_analysis.product_id is not null then
    select product.slug, product.name, product.kind, product.status, product.draft_version_id
      into v_product_slug, v_product_name, v_product_kind, v_product_status, v_draft_version_id
      from public.products as product where product.id = v_analysis.product_id for update;
    if v_product_status = 'archived' or v_draft_version_id is not null then
      raise exception using errcode = '23514', message = 'Product must be active with no open draft';
    end if;
  else
    if nullif(btrim(p_slug), '') is null or nullif(btrim(p_name), '') is null or p_kind is null then
      raise exception using errcode = '23514', message = 'New product slug, name and kind required';
    end if;
    v_product_slug := p_slug;
    v_product_name := p_name;
    v_product_kind := p_kind;
  end if;
  perform private.check_candidate_proposal(v_candidate.proposal, v_product_kind);
  for v_entry in select entry.key, entry.value from jsonb_each(v_candidate.proposal->'effects') as entry order by entry.key loop
    v_effect_id := private.create_candidate_effect(p_candidate_id, v_entry.key, v_entry.value, v_candidate.renderer, v_analysis.media_id);
    v_bindings := v_bindings || jsonb_build_object(v_entry.key, v_effect_id);
  end loop;
  v_version_id := private.create_product_draft(v_analysis.product_id, v_product_slug, v_product_name, v_product_kind,
    v_candidate.proposal->'composition', v_bindings, 'video_import');
  update public.product_versions as version set candidate_id = p_candidate_id where version.id = v_version_id;
  return v_version_id;
end;
$$;
comment on function private.accept_design_candidate(uuid, text, text, text) is 'Atomically accepts a ready video candidate into draft effects and one video_import product version. Existing products keep metadata and published pointers; new products require slug/name/kind. Retries return the same version UUID.';

-- Expose acceptance through an invoker wrapper with narrowly granted owner-backed writes.
create or replace function public.accept_design_candidate(p_candidate_id uuid, p_slug text default null, p_name text default null, p_kind text default null)
returns uuid language sql set search_path = '' as $$
  select private.accept_design_candidate(p_candidate_id, p_slug, p_name, p_kind);
$$;
comment on function public.accept_design_candidate(uuid, text, text, text) is 'Creates draft catalogue content from a ready video candidate, with schema-validated template overrides and no publication or safety confirmation; returns the idempotent product-version UUID.';

-- Accepted proposals are provenance, so even backend callers cannot rewrite them.
create or replace function private.guard_accepted_candidate()
returns trigger language plpgsql security definer set search_path = '' as $$
#variable_conflict error
begin
  if exists (select from public.product_versions as version where version.candidate_id = old.id) then
    raise exception using errcode = '23514', message = 'Accepted candidate is immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
comment on function private.guard_accepted_candidate() is 'Preserves accepted candidate provenance against update and delete, including service-role writes.';
create trigger guard_accepted before update or delete on public.design_candidates for each row execute function private.guard_accepted_candidate();

-- Retailer pricing, curated collections and movement-derived stock. Lists do not reserve stock.
create table public.range_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  product_id uuid not null references public.products(id),
  price_minor bigint not null check (price_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  hidden boolean not null default false,
  added_via text check (added_via in ('starter','catalogue','import','till')),
  unique (organisation_id, product_id), unique (organisation_id, id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.range_items enable row level security;
create trigger set_updated_at before update on public.range_items
  for each row execute function private.set_updated_at();
create index range_items_organisation_id_idx on public.range_items(organisation_id);
create policy range_items_read on public.range_items for select to authenticated
  using ((select private.staff_role()) is not null or organisation_id in (select private.org_ids('staff')));
create policy range_items_insert on public.range_items for insert to authenticated with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage')));
create policy range_items_update on public.range_items for update to authenticated using (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage'))) with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage')));

create table public.store_items (
  store_id uuid not null,
  range_item_id uuid not null,
  organisation_id uuid not null references public.organisations(id),
  price_override_minor bigint check (price_override_minor >= 0),
  low_stock_at int not null default 5 check (low_stock_at >= 0),
  aisle text, bay text, till_sku text,
  hidden boolean not null default false,
  primary key (store_id, range_item_id),
  unique (organisation_id, store_id, range_item_id),
  foreign key (organisation_id, store_id) references public.stores(organisation_id,id),
  foreign key (organisation_id, range_item_id) references public.range_items(organisation_id,id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.store_items enable row level security;
create trigger set_updated_at before update on public.store_items
  for each row execute function private.set_updated_at();
create index store_items_organisation_id_idx on public.store_items(organisation_id);
create index store_items_store_id_idx on public.store_items(store_id);
create policy store_items_read on public.store_items for select to authenticated
  using ((select private.staff_role()) is not null or private.store_access(organisation_id, store_id));
create policy store_items_insert on public.store_items for insert to authenticated with check (((select private.staff_role()) = 'super_admin' or private.can_store(organisation_id,store_id,'prices.manage')));
create policy store_items_update on public.store_items for update to authenticated using (((select private.staff_role()) = 'super_admin' or private.can_store(organisation_id,store_id,'prices.manage'))) with check (((select private.staff_role()) = 'super_admin' or private.can_store(organisation_id,store_id,'prices.manage')));

create table public.stock_movements (
  id bigint generated always as identity primary key,
  organisation_id uuid not null references public.organisations(id),
  store_id uuid not null, range_item_id uuid not null,
  delta int not null, qty_after int not null check (qty_after >= 0),
  source text not null check (source in ('manual','csv','till')), ref text,
  at timestamptz not null default now(),
  foreign key (organisation_id, store_id, range_item_id)
    references public.store_items(organisation_id,store_id,range_item_id)
);
alter table public.stock_movements enable row level security;
create index stock_movements_organisation_id_idx on public.stock_movements(organisation_id);
create index stock_movements_store_id_idx on public.stock_movements(store_id);
create index stock_movements_balance_idx on public.stock_movements(store_id,range_item_id,id desc);
create policy stock_movements_read on public.stock_movements for select to authenticated
  using ((select private.staff_role()) is not null or private.store_access(organisation_id, store_id));

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  name text not null, slug text not null,
  kind text not null check (kind in ('manual','smart')),
  rule jsonb check (extensions.jsonb_matches_schema(
    '{"type":"object","additionalProperties":false,"properties":{"max_price_minor":{"type":"integer","minimum":0,"maximum":9223372036854775807},"max_noise":{"type":"integer","minimum":0,"maximum":3},"tags":{"type":"array","items":{"type":"string"}},"colours":{"type":"array","items":{"type":"string"}}}}'::json,rule)),
  status text not null default 'live' check (status in ('draft','live','archived')),
  archived_at timestamptz,
  unique (organisation_id,slug), unique (organisation_id,id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.collections enable row level security;
create trigger set_updated_at before update on public.collections
  for each row execute function private.set_updated_at();
create index collections_organisation_id_idx on public.collections(organisation_id);
create policy collections_read on public.collections for select to authenticated
  using ((select private.staff_role()) is not null or organisation_id in (select private.org_ids('staff')));
create policy collections_insert on public.collections for insert to authenticated with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage')));
create policy collections_update on public.collections for update to authenticated using (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage'))) with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage')));

create table public.collection_items (
  collection_id uuid not null, product_id uuid not null references public.products(id),
  organisation_id uuid not null references public.organisations(id),
  sort smallint not null default 0,
  primary key (collection_id,product_id),
  foreign key (organisation_id,collection_id) references public.collections(organisation_id,id),
  foreign key (organisation_id,product_id) references public.range_items(organisation_id,product_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.collection_items enable row level security;
create trigger set_updated_at before update on public.collection_items
  for each row execute function private.set_updated_at();
create index collection_items_organisation_id_idx on public.collection_items(organisation_id);
create policy collection_items_read on public.collection_items for select to authenticated
  using ((select private.staff_role()) is not null or organisation_id in (select private.org_ids('staff')));
create policy collection_items_insert on public.collection_items for insert to authenticated with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage')));
create policy collection_items_update on public.collection_items for update to authenticated using (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage'))) with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage')));
create policy collection_items_delete on public.collection_items for delete to authenticated using (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'range.manage')));

comment on column public.collections.rule is 'Smart collection filters: minor-unit maximum price bounded by SQL bigint, maximum supplier noise on the catalogue 0 to 3 scale, required tags and any matching colour.';
comment on column public.store_items.low_stock_at is 'Units remaining at which the retailer sees a low-stock warning; default five units is a schema-plan product setting.';

-- Invoker views retain the caller's RLS; public pages use the restricted private reader instead.
create view public.store_prices with (security_invoker = true) as
  select si.organisation_id, si.store_id, ri.product_id, si.range_item_id,
    coalesce(si.price_override_minor,ri.price_minor) as price_minor, ri.currency,
    coalesce(stock.quantity,0)::int as stock_qty, stock.source as stock_source,
    stock.updated_at as stock_updated_at, (ri.hidden or si.hidden) as hidden
  from public.store_items as si join public.range_items as ri on ri.id = si.range_item_id
  left join lateral (
    select sum(movement.delta) as quantity,
      (array_agg(movement.source order by movement.id desc))[1] as source,
      max(movement.at) as updated_at
    from public.stock_movements as movement
    where movement.store_id = si.store_id and movement.range_item_id = si.range_item_id
  ) as stock on true;

-- Lock the stock item so concurrent increments cannot both observe the same balance.
create function private.check_stock_movement()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
declare
  v_quantity bigint;
begin
  if tg_op <> 'INSERT' then
    raise exception using errcode = '23514', message = 'Stock history is append-only';
  end if;
  perform 1 from public.store_items as item
    where item.store_id = new.store_id and item.range_item_id = new.range_item_id for update;
  select coalesce(sum(movement.delta),0) + new.delta into v_quantity
    from public.stock_movements as movement
    where movement.store_id = new.store_id and movement.range_item_id = new.range_item_id;
  new.qty_after := v_quantity;
  new.at := now();
  return new;
end;
$$;
comment on function private.check_stock_movement() is 'Serialises stock deltas in units and derives the resulting non-negative balance; history updates and deletion are rejected.';
create trigger check_stock_movement before insert or update or delete on public.stock_movements
  for each row execute function private.check_stock_movement();

-- Append a CSV or manual stock change in units, never a reservation or editable balance.
create function private.record_stock(p_store uuid, p_range_item uuid, p_delta int, p_source text, p_ref text)
returns bigint language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_organisation uuid;
  v_movement bigint;
begin
  select item.organisation_id into v_organisation from public.store_items as item
    where item.store_id = p_store and item.range_item_id = p_range_item for update;
  if v_organisation is null or not (coalesce(private.staff_role() = 'super_admin',false)
    or private.can_store(v_organisation,p_store,'range.manage')) then
    raise exception using errcode = '42501', message = 'Stock management permission required';
  end if;
  if p_source is null or p_source not in ('manual','csv') then
    raise exception using errcode = '23514', message = 'Stock source must be manual or csv';
  end if;
  insert into public.stock_movements(organisation_id,store_id,range_item_id,delta,qty_after,source,ref)
    values (v_organisation,p_store,p_range_item,p_delta,0,p_source,p_ref) returning id into v_movement;
  return v_movement;
end;
$$;
comment on function private.record_stock(uuid,uuid,int,text,text) is 'Appends a signed delta in units for an authorised store; negative resulting stock fails atomically. Returns the movement ID.';
create function public.record_stock(p_store uuid, p_range_item uuid, p_delta int, p_source text, p_ref text default null)
returns bigint language sql set search_path = '' as $$
  select private.record_stock(p_store,p_range_item,p_delta,p_source,p_ref);
$$;
comment on function public.record_stock(uuid,uuid,int,text,text) is 'Records a CSV or manual delta in units at an authorised store and returns its immutable movement ID.';

-- Versioned retailer and shopper shows, QR routing and browser label metadata.
-- BEGIN GENERATED CUES SCHEMA
-- Generated from supabase/documents/cues.v1.json; use pnpm db:documents to refresh.
create or replace function private.cues_schema()
returns json
language sql
immutable
set search_path = ''
as $function$
  select $schema${"$schema":"http://json-schema.org/draft-07/schema#","title":"ShowCrafter show cues v1","type":"array","minItems":1,"items":{"type":"object","additionalProperties":false,"required":["t_ms","product_id","position","angle_deg"],"properties":{"t_ms":{"type":"integer","minimum":0},"product_id":{"type":"string","pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},"position":{"type":"number"},"angle_deg":{"type":"number","minimum":-90,"maximum":90},"beat":{"type":["integer","null"],"minimum":0}}}}$schema$::json;
$function$;
comment on function private.cues_schema() is 'Returns the canonical v1 JSON Schema for database document validation.';
-- END GENERATED CUES SCHEMA

create table public.shows (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id),
  owner_id uuid references public.profiles(id),
  name text not null,
  origin text not null check (origin in ('planner','pack','manual','template')),
  status text not null default 'draft' check (status in ('draft','live','stock_issue','archived')),
  current_version_id uuid,
  soundtrack_track_id uuid,
  tags text[] not null default '{}', share_token text unique,
  archived_at timestamptz,
  check ((organisation_id is null) <> (owner_id is null)),
  check (status not in ('live','stock_issue') or current_version_id is not null),
  unique (id,organisation_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.shows enable row level security;
create index shows_organisation_id_idx on public.shows(organisation_id);
create index shows_owner_id_idx on public.shows(owner_id);
create trigger set_updated_at before update on public.shows
  for each row execute function private.set_updated_at();

create table public.show_versions (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id),
  organisation_id uuid references public.organisations(id),
  owner_id uuid references public.profiles(id),
  number int not null check (number > 0),
  cues jsonb not null check (extensions.jsonb_matches_schema(private.cues_schema(),cues)),
  soundtrack_analysis_id uuid,
  soundtrack_offset_ms int not null default 0,
  duration_ms int not null check (duration_ms >= 0),
  plan_session_id uuid,
  change_note text, created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check ((organisation_id is null) <> (owner_id is null)),
  unique (show_id,number), unique (show_id,id)
);
alter table public.show_versions enable row level security;
create index show_versions_organisation_id_idx on public.show_versions(organisation_id);
create index show_versions_owner_id_idx on public.show_versions(owner_id);

create table public.show_version_products (
  show_version_id uuid not null references public.show_versions(id),
  organisation_id uuid references public.organisations(id),
  owner_id uuid references public.profiles(id),
  product_id uuid not null references public.products(id),
  quantity smallint not null check (quantity > 0),
  check ((organisation_id is null) <> (owner_id is null)),
  primary key (show_version_id,product_id)
);
alter table public.show_version_products enable row level security;
create index show_version_products_organisation_id_idx on public.show_version_products(organisation_id);
create index show_version_products_owner_id_idx on public.show_version_products(owner_id);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  name text not null, sale_period_id uuid references public.sale_periods(id),
  starts_on date, ends_on date,
  status text not null default 'scheduled' check (status in ('scheduled','live','ended','archived')),
  archived_at timestamptz,
  check (ends_on >= starts_on), unique (organisation_id,id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.campaigns enable row level security;
create index campaigns_organisation_id_idx on public.campaigns(organisation_id);
create trigger set_updated_at before update on public.campaigns
  for each row execute function private.set_updated_at();

create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  store_id uuid,
  slug text not null unique check (slug ~ '^[A-Za-z0-9_-]+$'),
  target_type text not null check (target_type in ('product','pack','collection','show','planner','store')),
  target_id uuid, campaign_id uuid,
  placement text check (placement in ('shelf_strip','counter_card','window_poster','bag','end_cap','till','other')),
  label_text text,
  status text not null default 'live' check (status in ('live','paused','archived')),
  archived_at timestamptz, created_by uuid references public.profiles(id),
  check ((target_type in ('planner','store')) = (target_id is null)),
  foreign key (organisation_id,store_id) references public.stores(organisation_id,id),
  foreign key (organisation_id,campaign_id) references public.campaigns(organisation_id,id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.qr_codes enable row level security;
create index qr_codes_organisation_id_idx on public.qr_codes(organisation_id);
create index qr_codes_store_id_idx on public.qr_codes(store_id);
create trigger set_updated_at before update on public.qr_codes
  for each row execute function private.set_updated_at();

create table public.label_batches (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  qr_code_ids uuid[] not null check (cardinality(qr_code_ids) > 0),
  size text not null check (size in ('shelf_strip','a6_card','a4_poster','till_sticker')),
  copies smallint not null default 1 check (copies > 0),
  pdf_media_id uuid references public.media(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.label_batches enable row level security;
create index label_batches_organisation_id_idx on public.label_batches(organisation_id);
create trigger set_updated_at before update on public.label_batches
  for each row execute function private.set_updated_at();

alter table public.shows add constraint shows_current_version_fk
  foreign key (id,current_version_id) references public.show_versions(show_id,id);
comment on column public.shows.soundtrack_track_id is 'Nullable UUID reference to public.music_tracks(id).';
comment on column public.show_versions.soundtrack_analysis_id is 'Nullable UUID reference to public.music_analyses(id).';
comment on column public.show_versions.plan_session_id is 'Nullable UUID reference to public.plan_sessions(id).';
comment on column public.show_versions.cues is 'Product launch cues: t_ms from show start, horizontal position in metres, angle_deg from vertical, optional beat index.';

-- Authorisation shared by history policies and the transactional save operation.
create function private.show_access(p_organisation uuid, p_owner uuid, p_write boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when p_organisation is null then
    p_owner = private.uid() and exists (select from public.profiles as profile
      where profile.id = p_owner and profile.status = 'active')
    when p_write then coalesce(private.staff_role() = 'super_admin',false)
      or private.can(p_organisation,'range.manage')
    else private.staff_role() is not null or p_organisation in (select private.org_ids('staff')) end;
$$;
comment on function private.show_access(uuid,uuid,boolean) is 'Checks active shopper ownership or retailer membership; show authoring requires range management rights.';
create policy shows_read on public.shows for select to authenticated
  using (private.show_access(organisation_id,owner_id,false));
create policy shows_insert on public.shows for insert to authenticated
  with check (private.show_access(organisation_id,owner_id,true));
create policy shows_update on public.shows for update to authenticated
  using (private.show_access(organisation_id,owner_id,true))
  with check (private.show_access(organisation_id,owner_id,true));
create policy show_versions_read on public.show_versions for select to authenticated
  using (private.show_access(organisation_id,owner_id,false));
create policy show_version_products_read on public.show_version_products for select to authenticated
  using (private.show_access(organisation_id,owner_id,false));
create policy campaigns_read on public.campaigns for select to authenticated
  using ((select private.staff_role()) is not null or (organisation_id in (select private.org_ids('staff'))));
create policy campaigns_insert on public.campaigns for insert to authenticated with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'qr.manage')));
create policy campaigns_update on public.campaigns for update to authenticated using (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'qr.manage'))) with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id,'qr.manage')));
create policy qr_codes_read on public.qr_codes for select to authenticated
  using ((select private.staff_role()) is not null or (private.store_access(organisation_id,store_id) or (store_id is null and organisation_id in (select private.org_ids('staff')))));
create policy qr_codes_insert on public.qr_codes for insert to authenticated with check (((select private.staff_role()) = 'super_admin' or private.can_store(organisation_id,store_id,'qr.manage')));
create policy qr_codes_update on public.qr_codes for update to authenticated using (((select private.staff_role()) = 'super_admin' or private.can_store(organisation_id,store_id,'qr.manage'))) with check (((select private.staff_role()) = 'super_admin' or private.can_store(organisation_id,store_id,'qr.manage')));
-- Batch access is the intersection of all QR store scopes, including store-restricted printers.
create function private.label_access(p_org uuid,p_codes uuid[],p_write boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select (case when p_write then coalesce(private.staff_role() = 'super_admin',false)
    else private.staff_role() is not null end)
    or (cardinality(p_codes) > 0 and not exists (
      select from unnest(p_codes) as entry(id) left join public.qr_codes as code on code.id = entry.id
      where code.id is null or code.organisation_id <> p_org or not (case when p_write
        then private.can_store(p_org,code.store_id,'labels.print')
        when code.store_id is null then p_org in (select private.org_ids('staff'))
        else private.store_access(p_org,code.store_id) end)));
$$;
comment on function private.label_access(uuid,uuid[],boolean) is 'Requires access to every QR store in the batch; label writes require print permission and foreign UUIDs fail closed.';
create policy label_batches_read on public.label_batches for select to authenticated
  using (private.label_access(organisation_id,qr_code_ids,false));
create policy label_batches_insert on public.label_batches for insert to authenticated
  with check (private.label_access(organisation_id,qr_code_ids,true));

-- History is immutable even for a trusted backend; versions are complete snapshots on save.
create function private.protect_show_history()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  raise exception using errcode = '23514', message = 'Show history is immutable';
end;
$$;
comment on function private.protect_show_history() is 'Rejects changes and deletion of saved show versions and their derived product quantities.';
create trigger protect_history before update or delete on public.show_versions
  for each row execute function private.protect_show_history();
create trigger protect_history before update or delete on public.show_version_products
  for each row execute function private.protect_show_history();

-- Protect tenancy and stable links independently of API grants.
create function private.validate_show_parent()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  if old.organisation_id is distinct from new.organisation_id or old.owner_id is distinct from new.owner_id then
    raise exception using errcode = '23514', message = 'Show ownership cannot change';
  end if;
  return new;
end;
$$;
comment on function private.validate_show_parent() is 'Keeps show history attached to its original retailer or shopper owner.';
create trigger validate_show_parent before update on public.shows
  for each row execute function private.validate_show_parent();

-- Polymorphic targets must exist in their own tenant; archived links retain their original slug.
create function private.validate_qr_code()
returns trigger language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_valid boolean;
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '23514', message = 'QR codes cannot be deleted';
  end if;
  if tg_op = 'UPDATE' and (new.id <> old.id or new.slug <> old.slug or new.organisation_id <> old.organisation_id
    or new.created_by is distinct from old.created_by) then
    raise exception using errcode = '23514', message = 'QR slug and ownership cannot change';
  end if;
  if tg_op = 'INSERT' and current_setting('role',true) = 'authenticated' then new.created_by := private.uid(); end if;
  if tg_op = 'UPDATE' and new.target_type is not distinct from old.target_type
    and new.target_id is not distinct from old.target_id then return new; end if;
  v_valid := case new.target_type
    when 'product' then exists (select from public.products as product where product.id = new.target_id and product.status = 'published' and product.kind <> 'pack')
    when 'pack' then exists (select from public.products as product where product.id = new.target_id and product.status = 'published' and product.kind = 'pack')
    when 'collection' then exists (select from public.collections as collection where collection.id = new.target_id and collection.organisation_id = new.organisation_id)
    when 'show' then exists (select from public.shows as show where show.id = new.target_id and show.organisation_id = new.organisation_id)
    when 'planner' then new.target_id is null
    when 'store' then new.target_id is null else false end;
  if not coalesce(v_valid,false) then
    raise exception using errcode = '23514', message = 'Invalid QR target or organisation';
  end if;
  return new;
end;
$$;
comment on function private.validate_qr_code() is 'Validates target type, publication and tenant; keeps QR slugs reserved permanently.';
create trigger validate_qr_code before insert or update or delete on public.qr_codes
  for each row execute function private.validate_qr_code();

-- Each label must refer to an accessible code and a PDF owned by this retailer.
create function private.validate_label_batch()
returns trigger language plpgsql security definer set search_path = '' as $$
#variable_conflict error
begin
  if current_setting('role',true) = 'authenticated'
    and not private.label_access(new.organisation_id,new.qr_code_ids,true) then
    raise exception using errcode = '42501', message = 'Label print permission required';
  end if;
  if exists (select from unnest(new.qr_code_ids) as entry(id)
    left join public.qr_codes as code on code.id = entry.id
    where code.id is null or code.organisation_id <> new.organisation_id) then
    raise exception using errcode = '23514', message = 'Label codes must belong to the retailer';
  end if;
  if current_setting('role',true) = 'authenticated' then new.created_by := private.uid(); end if;
  if new.pdf_media_id is not null and not exists (select from public.media as media
    where media.id = new.pdf_media_id and media.organisation_id = new.organisation_id
      and media.kind = 'document' and media.mime = 'application/pdf') then
    raise exception using errcode = '23514', message = 'Label PDF must belong to the retailer';
  end if;
  return new;
end;
$$;
comment on function private.validate_label_batch() is 'Rejects foreign or unknown QR UUIDs and media references in a label batch.';
create trigger validate_label_batch before insert or update on public.label_batches
  for each row execute function private.validate_label_batch();

-- Per-store price and availability are computed from current prices and movement balances.
create view public.show_store_status with (security_invoker = true) as
  select show.id as show_id, show.organisation_id, store.id as store_id,
    case when bool_and(price.product_id is not null) then sum(price.price_minor * needed.quantity) end as price_minor,
    min(price.currency::text)::char(3) as currency,
    bool_and(price.product_id is not null and not price.hidden and price.stock_qty >= needed.quantity
      and product.status = 'published') as available
  from public.shows as show join public.stores as store on store.organisation_id = show.organisation_id
  join public.show_version_products as needed on needed.show_version_id = show.current_version_id
  join public.products as product on product.id = needed.product_id
  left join public.store_prices as price on price.store_id = store.id and price.product_id = needed.product_id
  group by show.id,show.organisation_id,store.id;

-- Mark retailer shows with an unavailable product at every open store, and recover after replenishment.
create function private.recalculate_show_stock()
returns void language plpgsql security definer set search_path = '' as $$
#variable_conflict error
begin
  with desired as (
    select show.id,case when exists (
      select from public.show_version_products as needed
      where needed.show_version_id = show.current_version_id and not exists (
        select from public.store_prices as price join public.stores as store on store.id = price.store_id
        join public.products as product on product.id = price.product_id and product.status = 'published'
        where price.organisation_id = show.organisation_id and price.product_id = needed.product_id
          and store.status = 'open' and not price.hidden and price.stock_qty >= needed.quantity
      )) then 'stock_issue' else 'live' end as status
    from public.shows as show where show.organisation_id is not null and show.status in ('live','stock_issue')
  )
  update public.shows as show set status = desired.status from desired
    where show.id = desired.id and show.status is distinct from desired.status;
end;
$$;
comment on function private.recalculate_show_stock() is 'Recalculates live or stock_issue status from current range and stock for every retailer show; drafts and archived shows are untouched.';
-- Statement triggers and scheduled reconciliation share the same stock calculation.
create function private.refresh_show_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
#variable_conflict error
begin
  perform private.recalculate_show_stock();
  return null;
end;
$$;
comment on function private.refresh_show_stock() is 'Delegates stock and range statement changes to the shared show stock calculation.';
create trigger refresh_show_stock after insert on public.stock_movements
  for each statement execute function private.refresh_show_stock();
create trigger refresh_show_stock after insert or update on public.store_items
  for each statement execute function private.refresh_show_stock();
create trigger refresh_show_stock after update on public.range_items
  for each statement execute function private.refresh_show_stock();
create trigger refresh_show_stock after update on public.stores
  for each statement execute function private.refresh_show_stock();
create trigger refresh_show_stock after update of status on public.products
  for each statement execute function private.refresh_show_stock();

-- Save a complete cue document and derived quantities atomically under a parent lock.
create function private.save_show(p_show uuid, p_cues jsonb, p_duration_ms int,
  p_soundtrack_analysis uuid, p_soundtrack_offset_ms int, p_plan_session uuid, p_change_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_show public.shows;
  v_version uuid;
  v_number int;
begin
  select show.* into v_show from public.shows as show where show.id = p_show for update;
  if v_show.id is null or not private.show_access(v_show.organisation_id,v_show.owner_id,true) then
    raise exception using errcode = '42501', message = 'Show authoring permission required';
  end if;
  if p_cues is null or not extensions.jsonb_matches_schema(private.cues_schema(),p_cues) or jsonb_array_length(p_cues) = 0 then
    raise exception using errcode = '23514', message = 'Invalid show cues';
  end if;
  if exists (select from jsonb_array_elements(p_cues) as cue(document)
    left join public.products as product on product.id = (cue.document->>'product_id')::uuid
    where product.status is distinct from 'published' or (cue.document->>'t_ms')::bigint > p_duration_ms
      or (v_show.organisation_id is not null and not exists (select from public.range_items as item
        where item.organisation_id = v_show.organisation_id and item.product_id = product.id))) then
    raise exception using errcode = '23514', message = 'Cues need published products in the retailer range and times within the show';
  end if;
  select coalesce(max(version.number),0) + 1 into v_number from public.show_versions as version where version.show_id = p_show;
  insert into public.show_versions(show_id,organisation_id,owner_id,number,cues,duration_ms,
    soundtrack_analysis_id,soundtrack_offset_ms,plan_session_id,change_note,created_by)
    values (p_show,v_show.organisation_id,v_show.owner_id,v_number,p_cues,p_duration_ms,
      p_soundtrack_analysis,p_soundtrack_offset_ms,p_plan_session,p_change_note,private.uid()) returning id into v_version;
  update public.shows set current_version_id = v_version where id = p_show;
  return v_version;
end;
$$;
comment on function private.save_show(uuid,jsonb,int,uuid,int,uuid,text) is 'Saves immutable launch cues (milliseconds from show start), numbering and product counts in one transaction. Authorisation and product membership are checked; returns the version UUID.';
create function public.save_show(p_show uuid,p_cues jsonb,p_duration_ms int,
  p_soundtrack_analysis uuid default null,p_soundtrack_offset_ms int default 0,
  p_plan_session uuid default null,p_change_note text default null)
returns uuid language sql set search_path = '' as $$
  select private.save_show(p_show,p_cues,p_duration_ms,p_soundtrack_analysis,p_soundtrack_offset_ms,p_plan_session,p_change_note);
$$;
comment on function public.save_show(uuid,jsonb,int,uuid,int,uuid,text) is 'Atomically saves a show cue snapshot and quantities; cue times and soundtrack offset are milliseconds. Returns its immutable version UUID.';

-- Restrict the public product slice to open stores, active retailers and confirmed market listings.
create function private.shopper_store_products(p_store uuid)
returns table(product_id uuid,name text,kind text,price_minor bigint,currency char(3),stock_qty int,
  noise_level smallint,min_safety_distance_m smallint,duration_ms int,colours text[],tags text[])
language sql stable security definer set search_path = '' as $$
  select product.id,product.name,product.kind,price.price_minor,price.currency,price.stock_qty,
    product.noise_level,product.min_safety_distance_m,product.duration_ms,product.colours,product.tags
  from public.stores as store
  join public.organisations as organisation on organisation.id = store.organisation_id
  join public.markets as market on market.code = store.market and market.enabled
  join public.store_prices as price on price.store_id = store.id and not price.hidden
  join public.products as product on product.id = price.product_id and product.status = 'published'
  join public.product_markets as listing on listing.product_id = product.id and listing.market = store.market
  where store.id = p_store and store.status = 'open' and organisation.status in ('active','trial')
    and listing.confirmed_at is not null and price.currency = market.currency;
$$;
comment on function private.shopper_store_products(uuid) is 'Returns visible published store products with confirmed market safety, minor-unit prices and movement-derived stock units; excludes private retailer fields.';

-- Playback reads current product and effect pointers each time, including selection-pack contents.
-- Resolve pack children at runtime, following their published product pointers.
create function private.product_playback(p_product uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
#variable_conflict error
declare
  v_playback jsonb;
begin
  select jsonb_build_object('id',product.id,'name',product.name,'kind',product.kind,
    'version_id',version.id,'composition',version.composition,
    'effects',coalesce((select jsonb_agg(jsonb_build_object('letter',binding.letter,
      'effect_id',effect.id,'version_id',design.id,'design',design.design,'renderer',design.renderer) order by binding.letter)
      from public.product_version_effects as binding
      join public.effects as effect on effect.id = binding.effect_id and effect.status = 'published'
      join public.effect_versions as design on design.id = effect.current_version_id and design.status = 'published'
      where binding.product_version_id = version.id),'[]'::jsonb),
    'pack_items',coalesce((select jsonb_agg(jsonb_build_object('quantity',item.quantity,
      'product',private.product_playback(item.item_id)) order by item.item_id)
      from public.pack_items as item where item.pack_id = product.id),'[]'::jsonb))
  into v_playback
  from public.products as product
  left join public.product_versions as version on version.id = product.current_version_id and version.status = 'published'
  where product.id = p_product and product.status = 'published';
  return v_playback;
end;
$$;
comment on function private.product_playback(uuid) is 'Returns only published playback documents from the latest product and effect versions; recursively includes immutable selection-pack contents.';

-- Evaluate collection membership against the current visible range and store prices.
create function private.collection_products(p_collection uuid,p_store uuid)
returns table(product_id uuid,sort smallint)
language sql stable security definer set search_path = '' as $$
  select product.product_id,coalesce(item.sort,0)::smallint
  from public.collections as collection
  join public.stores as store on store.organisation_id = collection.organisation_id
  join private.shopper_store_products(p_store) as product on true
  left join public.collection_items as item on item.collection_id = collection.id and item.product_id = product.product_id
  where collection.id = p_collection and store.id = p_store and collection.status = 'live'
    and ((collection.kind = 'manual' and item.product_id is not null)
      or (collection.kind = 'smart'
        and (not (coalesce(collection.rule,'{}'::jsonb) ? 'max_price_minor') or product.price_minor <= (coalesce(collection.rule,'{}'::jsonb)->>'max_price_minor')::bigint)
        and (not (coalesce(collection.rule,'{}'::jsonb) ? 'max_noise') or product.noise_level <= (coalesce(collection.rule,'{}'::jsonb)->>'max_noise')::smallint)
        and product.tags @> array(select jsonb_array_elements_text(coalesce(coalesce(collection.rule,'{}'::jsonb)->'tags','[]'::jsonb)))
        and (coalesce(jsonb_array_length(coalesce(collection.rule,'{}'::jsonb)->'colours'),0) = 0
          or product.colours && array(select jsonb_array_elements_text(coalesce(collection.rule,'{}'::jsonb)->'colours')))));
$$;
comment on function private.collection_products(uuid,uuid) is 'Resolves live manual membership or smart price/noise/tag/colour filters against a matching store; prices use minor units and tags require every requested tag.';

-- A public store page explicitly selects safe fields rather than serialising retailer rows.
create function private.store_page(p_store uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('store',jsonb_build_object('id',store.id,'name',store.name,
    'slug',store.slug,'market',store.market,'address',store.address,'postcode',store.postcode,
    'timezone',store.timezone,'opening_hours',store.opening_hours),
    'organisation',jsonb_build_object('id',organisation.id,'name',organisation.name),
    'products',coalesce((select jsonb_agg(to_jsonb(product) order by product.name,product.product_id)
      from private.shopper_store_products(p_store) as product),'[]'::jsonb),
    'collections',coalesce((select jsonb_agg(jsonb_build_object('id',collection.id,'name',collection.name,
      'slug',collection.slug,'kind',collection.kind,'rule',collection.rule,
      'product_ids',coalesce((select jsonb_agg(item.product_id order by item.sort,item.product_id)
        from private.collection_products(collection.id,p_store) as item),'[]'::jsonb)) order by collection.name)
      from public.collections as collection where collection.organisation_id = store.organisation_id and collection.status = 'live'),'[]'::jsonb),
    'shows',coalesce((select jsonb_agg(jsonb_build_object('id',show.id,'name',show.name) order by show.name)
      from public.shows as show where show.organisation_id = store.organisation_id and show.status in ('live','stock_issue')),'[]'::jsonb))
  from public.stores as store join public.organisations as organisation on organisation.id = store.organisation_id
  join public.markets as market on market.code = store.market and market.enabled
  where store.id = p_store and store.status = 'open' and organisation.status in ('active','trial');
$$;
comment on function private.store_page(uuid) is 'Returns the open store public page with visible range, live collections and retailer shows; closed stores and inactive retailers return null.';
create function public.store_page(p_store uuid)
returns jsonb language sql stable set search_path = '' as $$ select private.store_page(p_store); $$;
comment on function public.store_page(uuid) is 'Reads a restricted public store page through the privileged reader; returns null when unavailable.';

-- Missing, hidden or foreign-store products prevent playback rather than leaking their documents.
create function private.show_for_store(p_show uuid,p_store uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',show.id,'name',show.name,'version_id',version.id,
    'cues',version.cues,'duration_ms',version.duration_ms,'soundtrack_track_id',show.soundtrack_track_id,
    'soundtrack_analysis_id',version.soundtrack_analysis_id,'soundtrack_offset_ms',version.soundtrack_offset_ms,
    'price_minor',(select sum(product.price_minor * needed.quantity) from public.show_version_products as needed
      join private.shopper_store_products(p_store) as product on product.product_id = needed.product_id
      where needed.show_version_id = version.id),
    'currency',(select min(product.currency::text) from private.shopper_store_products(p_store) as product
      join public.show_version_products as needed on needed.product_id = product.product_id where needed.show_version_id = version.id),
    'available',not exists (select from public.show_version_products as needed
      join private.shopper_store_products(p_store) as product on product.product_id = needed.product_id
      where needed.show_version_id = version.id and product.stock_qty < needed.quantity),
    'products',(select jsonb_agg(jsonb_build_object('quantity',needed.quantity,
      'product',private.product_playback(needed.product_id)) order by needed.product_id)
      from public.show_version_products as needed where needed.show_version_id = version.id))
  from public.shows as show join public.show_versions as version on version.id = show.current_version_id
  join public.stores as store on store.id = p_store
    and (store.organisation_id = show.organisation_id
      or (show.organisation_id is null and private.show_access(null,show.owner_id,false)))
  where show.id = p_show and store.id = p_store and show.status in ('live','stock_issue')
    and private.store_page(p_store) is not null
    and exists (select from public.show_version_products as needed where needed.show_version_id = version.id)
    and not exists (select from public.show_version_products as needed where needed.show_version_id = version.id
      and not exists (select from private.shopper_store_products(p_store) as product where product.product_id = needed.product_id));
$$;
comment on function private.show_for_store(uuid,uuid) is 'Returns retailer playback or the active caller''s own show with latest designs, minor-unit price and quantity-aware availability at an open store; inaccessible shows return null.';
create function public.show_for_store(p_show uuid,p_store uuid)
returns jsonb language sql stable set search_path = '' as $$ select private.show_for_store(p_show,p_store); $$;
comment on function public.show_for_store(uuid,uuid) is 'Reads restricted show playback at an open store; retailer shows are public and shopper shows require active ownership. Resolves the latest published designs.';

-- Recheck mutable target visibility for the selected store, independently of QR creation validity.
create function private.qr_target_visible(p_type text,p_target uuid,p_store uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'product' then exists (select from private.shopper_store_products(p_store) as product where product.product_id = p_target and product.kind <> 'pack')
    when 'pack' then exists (select from private.shopper_store_products(p_store) as product where product.product_id = p_target and product.kind = 'pack')
    when 'collection' then exists (select from public.collections as collection join public.stores as store
      on store.organisation_id = collection.organisation_id
      where collection.id = p_target and store.id = p_store and collection.status = 'live')
    when 'show' then private.show_for_store(p_target,p_store) is not null
    when 'planner' then true when 'store' then true else false end;
$$;
comment on function private.qr_target_visible(text,uuid,uuid) is 'Checks a QR target against visible catalogue, collection and show data at one store; unsupported types fail closed.';

-- Paused, archived and unavailable targets route to the store; organisation codes ask for a store.
create function private.resolve_qr(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
#variable_conflict error
declare
  v_code public.qr_codes;
  v_target_type text;
  v_target_id uuid;
  v_target_valid boolean;
begin
  select code.* into v_code from public.qr_codes as code
    join public.organisations as organisation on organisation.id = code.organisation_id
    where code.slug = p_slug and organisation.status in ('active','trial');
  if v_code.id is null then return null; end if;
  if v_code.store_id is null then
    return jsonb_build_object('qr_id',v_code.id,'organisation_id',v_code.organisation_id,'pick_store',true,
      'stores',coalesce((select jsonb_agg(jsonb_build_object('id',store.id,'name',store.name,
        'target_type',case when v_code.status = 'live' and private.qr_target_visible(v_code.target_type,v_code.target_id,store.id)
          then v_code.target_type else 'store' end,
        'target_id',case when v_code.status = 'live' and private.qr_target_visible(v_code.target_type,v_code.target_id,store.id)
          then v_code.target_id else null end) order by store.name)
        from public.stores as store where store.organisation_id = v_code.organisation_id
          and private.store_page(store.id) is not null),'[]'::jsonb));
  end if;
  if private.store_page(v_code.store_id) is null then return null; end if;
  v_target_type := v_code.target_type;
  v_target_id := v_code.target_id;
  v_target_valid := private.qr_target_visible(v_target_type,v_target_id,v_code.store_id);
  if v_code.status <> 'live' or not v_target_valid then v_target_type := 'store'; v_target_id := null; end if;
  return jsonb_build_object('qr_id',v_code.id,'store_id',v_code.store_id,
    'target_type',v_target_type,'target_id',v_target_id,'label_text',v_code.label_text);
end;
$$;
comment on function private.resolve_qr(text) is 'Resolves a permanent QR slug to visible public targets or a store fallback, and offers only open stores for organisation-wide codes.';
create function public.resolve_qr(p_slug text)
returns jsonb language sql stable set search_path = '' as $$ select private.resolve_qr(p_slug); $$;
comment on function public.resolve_qr(text) is 'Resolves a public QR slug; unknown or unavailable retailers return null, archived links fall back to the store.';

create trigger refresh_show_stock after update of current_version_id,status on public.shows
  for each row when (old.current_version_id is distinct from new.current_version_id or old.status is distinct from new.status)
  execute function private.refresh_show_stock();

-- Derive snapshot tenancy from the locked parent, including writes by trusted services.
create function private.validate_show_snapshot()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
declare
  v_show public.shows;
begin
  select show.* into v_show from public.shows as show where show.id = new.show_id for update;
  new.organisation_id := v_show.organisation_id;
  new.owner_id := v_show.owner_id;
  if not extensions.jsonb_matches_schema(private.cues_schema(),new.cues) then
    raise exception using errcode = '23514', message = 'Invalid show cues';
  end if;
  if exists (select from jsonb_array_elements(new.cues) as cue(document)
    left join public.products as product on product.id = (cue.document->>'product_id')::uuid
    where product.status is distinct from 'published' or (cue.document->>'t_ms')::bigint > new.duration_ms
      or (v_show.organisation_id is not null and not exists (select from public.range_items as item
        where item.organisation_id = v_show.organisation_id and item.product_id = product.id))) then
    raise exception using errcode = '23514', message = 'Invalid show product or cue time';
  end if;
  return new;
end;
$$;
comment on function private.validate_show_snapshot() is 'Copies immutable snapshot ownership from the locked show and validates publication, retailer range and millisecond cue bounds.';
create trigger validate_show_snapshot before insert on public.show_versions
  for each row execute function private.validate_show_snapshot();

-- Quantity and ownership have exactly one source: the containing immutable cue document.
create function private.derive_show_product()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
declare
  v_version public.show_versions;
begin
  select version.* into v_version from public.show_versions as version where version.id = new.show_version_id;
  new.organisation_id := v_version.organisation_id;
  new.owner_id := v_version.owner_id;
  select count(*) into new.quantity from jsonb_array_elements(v_version.cues) as cue(document)
    where (cue.document->>'product_id')::uuid = new.product_id;
  return new;
end;
$$;
comment on function private.derive_show_product() is 'Derives ownership and quantity in units from the saved cue document; unrelated products fail the positive quantity check.';
create trigger derive_show_product before insert on public.show_version_products
  for each row execute function private.derive_show_product();

-- Populate the complete index of products for every saved snapshot, including service inserts.
create function private.populate_show_products()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  insert into public.show_version_products(show_version_id,organisation_id,owner_id,product_id,quantity)
    select new.id,new.organisation_id,new.owner_id,(cue.document->>'product_id')::uuid,count(*)
    from jsonb_array_elements(new.cues) as cue(document) group by cue.document->>'product_id';
  return null;
end;
$$;
comment on function private.populate_show_products() is 'Builds the entire immutable product-quantity index from a new cue snapshot in the same transaction.';
create trigger populate_show_products after insert on public.show_versions
  for each row execute function private.populate_show_products();

-- Shopper planning snapshots, till lists and explicit retailer consent.
create function private.owns_shopper(p_shopper uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_shopper = private.uid() and exists (select from public.profiles as profile
    where profile.id = p_shopper and profile.status = 'active');
$$;
comment on function private.owns_shopper(uuid) is 'Checks active account ownership, including Supabase anonymous shoppers.';

create table public.plan_sessions (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id),
  qr_code_id uuid references public.qr_codes(id),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  age_confirmed_at timestamptz,
  solver text not null check (length(solver) > 0),
  input_hash text not null check (length(input_hash) > 0),
  status text not null default 'open' check (status in ('open','listed','abandoned')),
  credits_reservation_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
comment on column public.plan_sessions.credits_reservation_id is 'Nullable UUID reference to public.credit_reservations(id).';
create table public.plan_candidates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.plan_sessions(id) on delete cascade,
  rank smallint not null check (rank > 0),
  revision int not null default 0 check (revision >= 0),
  mood text, name text, blurb text,
  cues jsonb not null check (extensions.jsonb_matches_schema(private.cues_schema(),cues)),
  total_minor bigint not null check (total_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  duration_ms int not null check (duration_ms >= 0),
  scores jsonb not null default '{}' check (jsonb_typeof(scores) = 'object'),
  picked_at timestamptz,
  unique (session_id,rank), unique (session_id,id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.plan_edits (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.plan_sessions(id) on delete cascade,
  candidate_id uuid not null,
  seq int not null check (seq > 0),
  message text check (char_length(message) <= 300),
  source text not null check (source in ('chip','rule','llm')),
  ops jsonb not null check (jsonb_typeof(ops) = 'array'),
  diff jsonb check (jsonb_typeof(diff) = 'object'),
  outcome text not null check (outcome in ('applied','clarify','refused','infeasible')),
  reply text, llm_call_id bigint,
  foreign key (session_id,candidate_id) references public.plan_candidates(session_id,id) on delete cascade,
  unique (session_id,seq),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
comment on column public.plan_edits.message is 'Shopper edit text, limited to 300 characters by the planner contract.';
comment on column public.plan_edits.llm_call_id is 'Nullable bigint reference to public.llm_calls(id).';
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id),
  plan_candidate_id uuid references public.plan_candidates(id),
  till_code text not null unique check (till_code ~ '^[0-9]{16}$'),
  status text not null default 'open' check (status in ('open','redeemed','expired')),
  valid_until date not null,
  redeemed_at timestamptz, redeemed_by uuid references public.profiles(id),
  check ((status = 'redeemed') = (redeemed_at is not null)),
  check (status = 'redeemed' or redeemed_by is null),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
comment on column public.lists.till_code is 'Sixteen decimal digits for the shopper till barcode; uniqueness is enforced across stores.';
create table public.list_items (
  list_id uuid not null references public.lists(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity smallint not null default 1 check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  primary key (list_id,product_id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.follows (
  shopper_id uuid not null references public.profiles(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  visible_to_shop boolean not null default false,
  marketing_opt_in boolean not null default false,
  consent_text_version text not null check (length(consent_text_version) > 0),
  consented_at timestamptz not null default now(),
  primary key (shopper_id,organisation_id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('export','delete')),
  status text not null default 'pending' check (status in ('pending','done','failed')),
  result_media_id uuid references public.media(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.plan_sessions enable row level security;
create trigger set_updated_at before update on public.plan_sessions
  for each row execute function private.set_updated_at();
alter table public.plan_candidates enable row level security;
create trigger set_updated_at before update on public.plan_candidates
  for each row execute function private.set_updated_at();
alter table public.plan_edits enable row level security;
create trigger set_updated_at before update on public.plan_edits
  for each row execute function private.set_updated_at();
alter table public.lists enable row level security;
create trigger set_updated_at before update on public.lists
  for each row execute function private.set_updated_at();
alter table public.list_items enable row level security;
create trigger set_updated_at before update on public.list_items
  for each row execute function private.set_updated_at();
alter table public.follows enable row level security;
create trigger set_updated_at before update on public.follows
  for each row execute function private.set_updated_at();
alter table public.privacy_requests enable row level security;
create trigger set_updated_at before update on public.privacy_requests
  for each row execute function private.set_updated_at();
create index plan_sessions_shopper_id_idx on public.plan_sessions(shopper_id);
create index plan_sessions_store_id_idx on public.plan_sessions(store_id);
create index lists_shopper_id_idx on public.lists(shopper_id);
create index lists_store_id_idx on public.lists(store_id);
create index follows_organisation_id_idx on public.follows(organisation_id);
create index privacy_requests_shopper_id_idx on public.privacy_requests(shopper_id);

create function private.owns_plan(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select from public.plan_sessions as session
    where session.id = p_session and private.owns_shopper(session.shopper_id));
$$;
comment on function private.owns_plan(uuid) is 'Checks the session owner without exposing another shopper''s session.';
create function private.can_read_list(p_list uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select from public.lists as list join public.stores as store on store.id = list.store_id
    where list.id = p_list and (private.owns_shopper(list.shopper_id)
      or (list.status = 'redeemed' and private.store_access(store.organisation_id,store.id))));
$$;
comment on function private.can_read_list(uuid) is 'Allows the active shopper or scoped retailer members to read a redeemed list.';
create policy plan_sessions_read on public.plan_sessions for select to authenticated using (private.owns_shopper(shopper_id));
create policy plan_candidates_read on public.plan_candidates for select to authenticated using (private.owns_plan(session_id));
create policy plan_edits_read on public.plan_edits for select to authenticated using (private.owns_plan(session_id));
create policy lists_read on public.lists for select to authenticated using (private.can_read_list(id));
create policy list_items_read on public.list_items for select to authenticated using (private.can_read_list(list_id));
create policy follows_read on public.follows for select to authenticated
  using (private.owns_shopper(shopper_id) or (visible_to_shop and private.can(organisation_id,'customers.view')));
create policy follows_insert on public.follows for insert to authenticated with check (private.owns_shopper(shopper_id));
create policy follows_update on public.follows for update to authenticated
  using (private.owns_shopper(shopper_id)) with check (private.owns_shopper(shopper_id));
create policy follows_delete on public.follows for delete to authenticated using (private.owns_shopper(shopper_id));
create policy privacy_requests_read on public.privacy_requests for select to authenticated using (private.owns_shopper(shopper_id));
create policy privacy_requests_insert on public.privacy_requests for insert to authenticated
  with check (private.owns_shopper(shopper_id) and status = 'pending' and result_media_id is null);

-- Session creation and its credit settlement share a transaction.
create function private.start_plan_session(p_store uuid,p_answers jsonb,p_solver text,p_input_hash text,p_qr_code uuid,p_age_confirmed_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_session uuid;
  v_organisation uuid;
begin
  if not coalesce(private.owns_shopper(private.uid()),false) then
    raise exception using errcode = '42501', message = 'Active shopper required';
  end if;
  select store.organisation_id into v_organisation from public.stores as store
    join public.organisations as organisation on organisation.id = store.organisation_id
    where store.id = p_store and store.status = 'open' and organisation.status not in ('suspended','closed');
  if v_organisation is null or (p_qr_code is not null and not exists (
    select from public.qr_codes as code where code.id = p_qr_code and code.organisation_id = v_organisation
      and (code.store_id is null or code.store_id = p_store) and code.status = 'live')) then
    raise exception using errcode = '23514', message = 'Open store and matching live QR code required';
  end if;
  if p_age_confirmed_at is null or p_age_confirmed_at > now() then
    raise exception using errcode = '23514', message = 'Age confirmation required';
  end if;
  insert into public.plan_sessions(shopper_id,store_id,qr_code_id,answers,solver,input_hash,age_confirmed_at)
    values (private.uid(),p_store,p_qr_code,p_answers,p_solver,p_input_hash,p_age_confirmed_at) returning id into v_session;
  perform private.charge_plan_session(v_session);
  return v_session;
end;
$$;
comment on function private.start_plan_session(uuid,jsonb,text,text,uuid,timestamptz) is 'Starts an owned planning session atomically after store, QR and age confirmation checks; returns its UUID. Includes one credit settlement.';
create function public.start_plan_session(p_store uuid,p_answers jsonb,p_solver text,p_input_hash text,
  p_qr_code uuid default null,p_age_confirmed_at timestamptz default null)
returns uuid language sql set search_path = '' as $$
  select private.start_plan_session(p_store,p_answers,p_solver,p_input_hash,p_qr_code,p_age_confirmed_at);
$$;
comment on function public.start_plan_session(uuid,jsonb,text,text,uuid,timestamptz) is 'Starts the caller''s planning session; answers and input hash describe the solver snapshot. Returns a session UUID.';

-- Snapshots are backend-authored; clients cannot claim prices, outcomes or redemption.
create function private.validate_shopper_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_session public.plan_sessions;
begin
  if tg_table_name = 'plan_candidates' then
    if tg_op = 'UPDATE' and new.session_id <> old.session_id then
      raise exception using errcode = '23514', message = 'Candidate session cannot change';
    end if;
    if exists (select from jsonb_array_elements(new.cues) as cue(document)
      where (cue.document->>'t_ms')::bigint > new.duration_ms) then
      raise exception using errcode = '23514', message = 'Candidate cues exceed duration';
    end if;
  else
    if new.plan_candidate_id is not null then
      select session.* into v_session from public.plan_candidates as candidate
        join public.plan_sessions as session on session.id = candidate.session_id where candidate.id = new.plan_candidate_id;
      if v_session.shopper_id is distinct from new.shopper_id or v_session.store_id is distinct from new.store_id then
        raise exception using errcode = '23514', message = 'List candidate must match shopper and store';
      end if;
    end if;
    if tg_op = 'UPDATE' and (new.shopper_id,new.store_id,new.plan_candidate_id,new.till_code)
      is distinct from (old.shopper_id,old.store_id,old.plan_candidate_id,old.till_code) then
      raise exception using errcode = '23514', message = 'List ownership and barcode cannot change';
    end if;
  end if;
  return new;
end;
$$;
comment on function private.validate_shopper_snapshot() is 'Enforces candidate cue duration and stable list ownership with a matching candidate session.';
create trigger validate_snapshot before insert or update on public.plan_candidates
  for each row execute function private.validate_shopper_snapshot();
create trigger validate_snapshot before insert or update on public.lists
  for each row execute function private.validate_shopper_snapshot();

-- A narrow customer reader avoids extending general profile visibility with consent.
create function private.shop_customers(p_organisation uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
#variable_conflict error
begin
  if not coalesce(private.can(p_organisation,'customers.view'),false) then
    raise exception using errcode = '42501', message = 'Customer viewing permission required';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('shopper_id',profile.id,
    'display_name',profile.display_name,'email',profile.email,'marketing_opt_in',follow.marketing_opt_in,
    'lists',coalesce((select jsonb_agg(jsonb_build_object('id',list.id,'store_id',list.store_id,'status',list.status))
      from public.lists as list join public.stores as store on store.id = list.store_id
      where list.shopper_id = profile.id and store.organisation_id = p_organisation),'[]'::jsonb)))
    from public.follows as follow join public.profiles as profile on profile.id = follow.shopper_id
    where follow.organisation_id = p_organisation and follow.visible_to_shop and profile.status = 'active'),'[]'::jsonb);
end;
$$;
comment on function private.shop_customers(uuid) is 'Reads consenting active shoppers and their list summaries for an organisation with customer viewing permission.';
create function public.shop_customers(p_organisation uuid)
returns jsonb language sql stable set search_path = '' as $$ select private.shop_customers(p_organisation); $$;
comment on function public.shop_customers(uuid) is 'Returns consenting customers and list summaries; requires organisation-wide customer viewing permission.';

alter table public.show_versions add constraint show_versions_plan_session_fk
  foreign key (plan_session_id) references public.plan_sessions(id);

-- Caller supplies product quantities; store facts supply the immutable price snapshot.
create function private.create_list(p_store uuid,p_items jsonb,p_till_code text,p_valid_until date,p_candidate uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_list uuid;
  v_item jsonb;
  v_product uuid;
  v_quantity smallint;
  v_price bigint;
  v_currency char(3);
begin
  if not coalesce(private.owns_shopper(private.uid()),false) then
    raise exception using errcode = '42501', message = 'Active shopper required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0
    or p_valid_until is null or p_valid_until < current_date then
    raise exception using errcode = '23514', message = 'Non-empty items and unexpired validity required';
  end if;
  if p_candidate is not null and not exists (
    select from public.plan_candidates as candidate join public.plan_sessions as session on session.id = candidate.session_id
    where candidate.id = p_candidate and session.store_id = p_store and private.owns_shopper(session.shopper_id)) then
    raise exception using errcode = '42501', message = 'Own candidate at matching store required';
  end if;
  insert into public.lists(shopper_id,store_id,plan_candidate_id,till_code,valid_until)
    values (private.uid(),p_store,p_candidate,p_till_code,p_valid_until) returning id into v_list;
  for v_item in select item.document from jsonb_array_elements(p_items) as item(document) loop
    if jsonb_typeof(v_item) <> 'object' or not (v_item ? 'product_id' and v_item ? 'quantity')
      or (select count(*) from jsonb_object_keys(v_item) as key) <> 2
      or jsonb_typeof(v_item->'quantity') <> 'number' or (v_item->>'quantity') !~ '^[1-9][0-9]*$' then
      raise exception using errcode = '23514', message = 'Items require only product_id and positive integer quantity';
    end if;
    v_product := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::smallint;
    select product.price_minor,product.currency into v_price,v_currency
      from private.shopper_store_products(p_store) as product
      where product.product_id = v_product and product.stock_qty >= v_quantity;
    if v_price is null then
      raise exception using errcode = '23514', message = 'List product unavailable at store';
    end if;
    insert into public.list_items(list_id,product_id,quantity,unit_price_minor,currency)
      values (v_list,v_product,v_quantity,v_price,v_currency);
  end loop;
  if p_candidate is not null then
    update public.plan_sessions as session set status = 'listed'
      from public.plan_candidates as candidate where candidate.id = p_candidate and session.id = candidate.session_id;
    update public.plan_candidates set picked_at = now() where id = p_candidate;
  end if;
  return v_list;
end;
$$;
comment on function private.create_list(uuid,jsonb,text,date,uuid) is 'Atomically snapshots positive product quantities and current store prices in minor units, optionally picking an owned candidate; never reserves stock. Returns the list UUID.';
create function public.create_list(p_store uuid,p_items jsonb,p_till_code text,p_valid_until date,p_candidate uuid default null)
returns uuid language sql set search_path = '' as $$ select private.create_list(p_store,p_items,p_till_code,p_valid_until,p_candidate); $$;
comment on function public.create_list(uuid,jsonb,text,date,uuid) is 'Creates a till list from product UUIDs and positive quantities, using current store prices; validity is the caller-supplied sale-period end date. Returns its UUID.';

create function private.preserve_plan_session_owner()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  if (new.id,new.shopper_id,new.store_id,new.qr_code_id,new.created_at)
    is distinct from (old.id,old.shopper_id,old.store_id,old.qr_code_id,old.created_at) then
    raise exception using errcode = '23514', message = 'Planning session identity cannot change';
  end if;
  return new;
end;
$$;
comment on function private.preserve_plan_session_owner() is 'Keeps planning history attached to its original shopper, store and QR source.';
create trigger preserve_session_owner before update on public.plan_sessions
  for each row execute function private.preserve_plan_session_owner();

create function private.record_shopper_consent()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  if tg_op = 'UPDATE' then
    if (new.shopper_id,new.organisation_id,new.created_at)
      is distinct from (old.shopper_id,old.organisation_id,old.created_at) then
      raise exception using errcode = '23514', message = 'Consent identity cannot change';
    end if;
    if (new.visible_to_shop,new.marketing_opt_in,new.consent_text_version)
      is not distinct from (old.visible_to_shop,old.marketing_opt_in,old.consent_text_version) then
      new.consented_at := old.consented_at;
      return new;
    end if;
  end if;
  new.consented_at := now();
  return new;
end;
$$;
comment on function private.record_shopper_consent() is 'Stamps consent choices with database transaction time and preserves the original shopper and organisation identity.';
create trigger record_consent before insert or update on public.follows
  for each row execute function private.record_shopper_consent();

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

-- Append-only visit events and rerunnable UTC rollups for retailer insights.
create table public.events (
  id bigint generated always as identity, occurred_at timestamptz not null default now(),
  type text not null check (type in ('scan','play','watched_to_end','list_add','list_redeem','plan_start','plan_pick','edit','share','follow')),
  organisation_id uuid references public.organisations(id), store_id uuid references public.stores(id),
  qr_code_id uuid references public.qr_codes(id), campaign_id uuid references public.campaigns(id),
  show_id uuid references public.shows(id), product_id uuid references public.products(id),
  plan_session_id uuid references public.plan_sessions(id) on delete set null,
  shopper_id uuid references public.profiles(id) on delete set null,
  session_key text, device text, os text, browser text, country char(2), city text,
  props jsonb not null default '{}' check (jsonb_typeof(props) = 'object'),
  primary key (id,occurred_at)
) partition by range (occurred_at);
create index events_organisation_time_idx on public.events(organisation_id,occurred_at);
create index events_store_idx on public.events(store_id);
create index events_shopper_idx on public.events(shopper_id);
create index events_session_idx on public.events(plan_session_id);

-- Nullable dimensions cannot be a primary key: NULLS NOT DISTINCT supplies one bucket.
create table public.metrics_daily (
  day date not null, organisation_id uuid not null references public.organisations(id),
  store_id uuid references public.stores(id), qr_code_id uuid references public.qr_codes(id),
  show_id uuid references public.shows(id), product_id uuid references public.products(id), campaign_id uuid references public.campaigns(id),
  metric text not null, value bigint not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique nulls not distinct (day,organisation_id,metric,store_id,qr_code_id,show_id,product_id,campaign_id)
);
create table public.metrics_hourly (
  hour timestamptz not null, organisation_id uuid not null references public.organisations(id),
  store_id uuid references public.stores(id), qr_code_id uuid references public.qr_codes(id),
  show_id uuid references public.shows(id), product_id uuid references public.products(id), campaign_id uuid references public.campaigns(id),
  metric text not null, value bigint not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique nulls not distinct (hour,organisation_id,metric,store_id,qr_code_id,show_id,product_id,campaign_id)
);
create index metrics_daily_organisation_idx on public.metrics_daily(organisation_id,day);
create index metrics_daily_store_idx on public.metrics_daily(store_id);
create index metrics_hourly_organisation_idx on public.metrics_hourly(organisation_id,hour);
create index metrics_hourly_store_idx on public.metrics_hourly(store_id);
create table public.saved_reports (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null check (name <> ''), query jsonb not null check (jsonb_typeof(query) = 'object'),
  schedule text, recipients text[], created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index saved_reports_organisation_idx on public.saved_reports(organisation_id);
create trigger metrics_daily_updated before update on public.metrics_daily for each row execute function private.set_updated_at();
create trigger metrics_hourly_updated before update on public.metrics_hourly for each row execute function private.set_updated_at();
create trigger saved_reports_updated before update on public.saved_reports for each row execute function private.set_updated_at();
alter table public.events enable row level security;
alter table public.metrics_daily enable row level security;
alter table public.metrics_hourly enable row level security;
alter table public.saved_reports enable row level security;
create policy events_live_read on public.events for select to authenticated using (
  occurred_at >= now() - interval '1 hour' and private.can_store(organisation_id,store_id,'insights.view'));
comment on policy events_live_read on public.events is 'Retailer live feed is restricted to the last wall-clock hour and permitted stores.';
create policy metrics_daily_read on public.metrics_daily for select to authenticated using (private.can_store(organisation_id,store_id,'insights.view'));
create policy metrics_hourly_read on public.metrics_hourly for select to authenticated using (private.can_store(organisation_id,store_id,'insights.view'));
create policy saved_reports_read on public.saved_reports for select to authenticated using (private.can(organisation_id,'insights.view'));
create policy saved_reports_insert on public.saved_reports for insert to authenticated with check (private.can(organisation_id,'insights.view'));
create policy saved_reports_update on public.saved_reports for update to authenticated using (private.can(organisation_id,'insights.view')) with check (private.can(organisation_id,'insights.view'));
create policy saved_reports_delete on public.saved_reports for delete to authenticated using (private.can(organisation_id,'insights.view'));

create function private.track_event(p_type text,p_store uuid,p_context jsonb,p_session_key text,p_props jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  -- Initial abuse budget: burst of 60 events per shopper, refilling one token per second.
  v_capacity constant numeric := 60;
  v_refill_per_second constant numeric := 1;
  -- Visit keys are bounded opaque random identifiers, never personal data.
  v_session_key_limit constant integer := 128;
  v_organisation uuid;
  v_qr uuid := (p_context->>'qr_code_id')::uuid;
  v_campaign uuid;
  v_show uuid := (p_context->>'show_id')::uuid;
  v_product uuid := (p_context->>'product_id')::uuid;
  v_plan uuid := (p_context->>'plan_session_id')::uuid;
  v_list uuid := (p_props->>'list_id')::uuid;
  v_props jsonb := '{}'::jsonb;
  v_id bigint;
begin
  if not coalesce(private.owns_shopper(private.uid()),false) then
    raise exception using errcode = '42501',message = 'Active shopper required';
  end if;
  if p_type is null or p_type not in ('scan','play','watched_to_end','list_add','list_redeem','plan_start','plan_pick','edit','share','follow')
    or p_context is null or jsonb_typeof(p_context) <> 'object' or p_props is null or jsonb_typeof(p_props) <> 'object'
    or (p_context - array['qr_code_id','show_id','product_id','plan_session_id']) <> '{}'
    or (p_props - 'list_id') <> '{}' or length(p_session_key) > v_session_key_limit then
    raise exception using errcode = '23514',message = 'Known event type and bounded context required';
  end if;
  select store.organisation_id into v_organisation from public.stores as store join public.organisations as organisation on organisation.id = store.organisation_id
    where store.id = p_store and store.status = 'open' and organisation.status not in ('suspended','closed');
  if v_organisation is null then raise exception using errcode = '23514',message = 'Open store required'; end if;
  if v_qr is not null then
    select code.campaign_id into v_campaign from public.qr_codes as code where code.id = v_qr and code.organisation_id = v_organisation
      and (code.store_id is null or code.store_id = p_store) and code.status = 'live';
    if not found then raise exception using errcode = '23514',message = 'Matching live QR code required'; end if;
  end if;
  if v_show is not null and not exists (select from public.shows as show where show.id = v_show and (
    (show.organisation_id = v_organisation and show.status in ('live','stock_issue')) or show.owner_id = private.uid())) then
    raise exception using errcode = '23514',message = 'Visible matching show required';
  end if;
  if v_product is not null and not exists (select from public.store_prices as price where price.store_id = p_store and price.product_id = v_product and not price.hidden) then
    raise exception using errcode = '23514',message = 'Visible store product required';
  end if;
  if v_plan is not null and not exists (select from public.plan_sessions as session where session.id = v_plan and session.store_id = p_store and session.shopper_id = private.uid()) then
    raise exception using errcode = '23514',message = 'Owned matching session required';
  end if;
  if v_list is not null then
    if not exists (select from public.lists as list where list.id = v_list and list.store_id = p_store and list.shopper_id = private.uid()
      and (p_type <> 'list_redeem' or list.status = 'redeemed')) then
      raise exception using errcode = '23514',message = 'Owned matching list required';
    end if;
    select jsonb_build_object('list_id',v_list,'list_value_minor',coalesce(sum(item.quantity * item.unit_price_minor),0)) into v_props
      from public.list_items as item where item.list_id = v_list;
  elsif p_type = 'list_redeem' then
    raise exception using errcode = '23514',message = 'Redeemed list required';
  end if;
  if not private.consume_rate_limit('event:' || private.uid(),v_capacity,v_refill_per_second) then
    raise exception using errcode = 'P0001',message = 'Event rate limit exceeded';
  end if;
  insert into public.events(type,organisation_id,store_id,qr_code_id,campaign_id,show_id,product_id,plan_session_id,shopper_id,session_key,props)
    values (p_type,v_organisation,p_store,v_qr,v_campaign,v_show,v_product,v_plan,private.uid(),p_session_key,v_props) returning id into v_id;
  return v_id;
end;
$$;
comment on function private.track_event(text,uuid,jsonb,text,jsonb) is 'Validates shopper and store references, derives tenancy and list value, consumes the event budget and appends a server-timestamped event; returns its ID.';
create function public.track_event(type text,store uuid,context jsonb default '{}',session_key text default null,props jsonb default '{}')
returns bigint language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  return private.track_event(type,store,context,session_key,props);
end;
$$;
comment on function public.track_event(text,uuid,jsonb,text,jsonb) is 'Appends one validated owned-shopper event; context contains optional QR, show, product and session UUIDs, props only a list UUID. Raw IP and client geo are never accepted.';

-- This projection keeps the event-to-metric mapping shared between both rollups.
create function private.event_metrics(p_from timestamptz,p_until timestamptz)
returns table(occurred_at timestamptz,organisation_id uuid,store_id uuid,qr_code_id uuid,show_id uuid,product_id uuid,campaign_id uuid,metric text,value bigint)
language sql stable set search_path = '' as $$
  select event.occurred_at,event.organisation_id,event.store_id,event.qr_code_id,event.show_id,event.product_id,event.campaign_id,
    mapped.metric,mapped.value from public.events as event cross join lateral (
      select case event.type when 'scan' then 'scans' when 'play' then 'plays' when 'watched_to_end' then 'watched_to_end'
        when 'list_add' then 'list_adds' when 'plan_start' then 'plans' when 'follow' then 'follows' end as metric,1::bigint as value
      union all select 'list_value_minor',(event.props->>'list_value_minor')::bigint where event.type = 'list_redeem'
    ) as mapped where event.occurred_at >= p_from and event.occurred_at < p_until and event.organisation_id is not null and mapped.metric is not null;
$$;
comment on function private.event_metrics(timestamptz,timestamptz) is 'Projects count metrics and snapshotted minor-unit list value from the half-open UTC event interval for trusted rollups.';

create function private.rollup_events(p_from timestamptz,p_until timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_from timestamptz;
  v_until timestamptz;
  -- Stable advisory key serialises replacement of overlapping aggregate buckets.
  v_rollup_lock constant bigint := 800001;
  -- Hourly heatmaps keep 90 days; daily aggregates retain the full history.
  v_hourly_retention constant interval := interval '90 days';
  -- Rebuilding a period whose raw partitions were dropped would erase retained facts.
  v_raw_retention constant interval := interval '25 months';
begin
  if p_from is null or p_until is null or p_from >= p_until then
    raise exception using errcode = '23514',message = 'Increasing rollup interval required';
  end if;
  if p_from < date_trunc('month',now() - v_raw_retention,'UTC') then
    raise exception using errcode = '23514',message = 'Rollup interval exceeds raw event retention';
  end if;
  perform pg_advisory_xact_lock(v_rollup_lock);
  -- Expand to whole UTC days so partial windows cannot overwrite a complete bucket.
  v_from := date_trunc('day',p_from,'UTC');
  v_until := date_trunc('day',p_until,'UTC');
  if v_until < p_until then v_until := v_until + interval '1 day'; end if;
  delete from public.metrics_daily as metric where metric.day >= (v_from at time zone 'UTC')::date and metric.day < (v_until at time zone 'UTC')::date;
  insert into public.metrics_daily(day,organisation_id,store_id,qr_code_id,show_id,product_id,campaign_id,metric,value)
    select (source.occurred_at at time zone 'UTC')::date,source.organisation_id,source.store_id,source.qr_code_id,source.show_id,source.product_id,source.campaign_id,source.metric,sum(source.value)
    from private.event_metrics(v_from,v_until) as source group by 1,2,3,4,5,6,7,8;
  delete from public.metrics_hourly as metric where metric.hour >= v_from and metric.hour < v_until;
  insert into public.metrics_hourly(hour,organisation_id,store_id,qr_code_id,show_id,product_id,campaign_id,metric,value)
    select date_trunc('hour',source.occurred_at,'UTC'),source.organisation_id,source.store_id,source.qr_code_id,source.show_id,source.product_id,source.campaign_id,source.metric,sum(source.value)
    from private.event_metrics(greatest(v_from,date_trunc('hour',now() - v_hourly_retention,'UTC')),v_until) as source group by 1,2,3,4,5,6,7,8;
  delete from public.metrics_hourly as metric where metric.hour < date_trunc('hour',now() - v_hourly_retention,'UTC');
end;
$$;
comment on function private.rollup_events(timestamptz,timestamptz) is 'Atomically rebuilds complete UTC day/hour buckets touching a half-open wall-clock interval; reruns replace counts, and hourly retention is 90 days.';

-- The default is evaluated before the function's empty search path takes effect.
create function private.maintain_event_partitions(p_caller_search_path text default current_setting('search_path'))
returns void language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_partition regclass;
begin
  perform partman.run_maintenance(p_parent_table := 'public.events',p_analyze := false,p_jobmon := false);
  -- Partitions are never API entry points, including ones created during maintenance.
  for v_partition in select child.inhrelid::regclass from pg_catalog.pg_inherits as child where child.inhparent = 'public.events'::regclass loop
    execute format('alter table %s enable row level security',v_partition);
    execute format('revoke all on %s from public, anon, authenticated',v_partition);
  end loop;
  -- pg_partman uses session SET internally; restore the caller path explicitly.
  perform set_config('search_path',p_caller_search_path,false);
exception when others then
  perform set_config('search_path',p_caller_search_path,false);
  raise;
end;
$$;
comment on function private.maintain_event_partitions(text) is 'Premakes monthly event partitions, drops raw data past the configured 25-month retention and seals direct API partition access.';

-- Declarative setup also runs in the diff shadow database, keeping partitions in step.
do $$
#variable_conflict error
declare
  -- Four premade months is pg_partman''s default operational buffer.
  v_premake constant integer := 4;
  -- Raw event retention from the analytics contract; daily rollups are kept separately.
  v_retention constant text := '25 months';
begin
  perform partman.create_parent(p_parent_table := 'public.events',p_control := 'occurred_at',p_interval := '1 month',
    p_premake := v_premake,p_start_partition := date_trunc('month',now() - v_retention::interval)::text,
    p_default_table := false,p_jobmon := false);
  update partman.part_config as configuration set retention = v_retention,retention_keep_table = false,retention_keep_index = false,
    infinite_time_partitions = true where configuration.parent_table = 'public.events';
  perform private.maintain_event_partitions();
end;
$$;

create function private.protect_event_history()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  -- Foreign-key deletion may unlink personal records, leaving aggregate facts intact.
  if tg_op = 'UPDATE' and (new.shopper_id is not distinct from old.shopper_id or new.shopper_id is null)
    and (new.plan_session_id is not distinct from old.plan_session_id or new.plan_session_id is null)
    and (to_jsonb(new) - array['shopper_id','plan_session_id']) = (to_jsonb(old) - array['shopper_id','plan_session_id']) then
    return new;
  end if;
  raise exception using errcode = '23514',message = 'Event history is append-only';
end;
$$;
comment on function private.protect_event_history() is 'Rejects raw event rewrites and deletion; personal foreign keys can be cleared when accounts are deleted. Retention drops whole partitions.';
create trigger events_immutable before update or delete on public.events for each row execute function private.protect_event_history();

-- Retailer entitlements and append-only credits, granted by platform finance staff.
create table public.plans (
  key text primary key, name text not null, max_stores smallint check (max_stores > 0),
  monthly_credits integer not null check (monthly_credits >= 0), stripe_price_ids jsonb not null default '{}',
  features jsonb not null default '{}' check (jsonb_typeof(features) = 'object'), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.billing_accounts (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  stripe_customer_id text unique, plan_key text references public.plans(key), subscription_status text,
  current_period_end timestamptz, store_quantity smallint check (store_quantity > 0),
  monthly_ai_cap_minor bigint check (monthly_ai_cap_minor >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
comment on column public.billing_accounts.monthly_ai_cap_minor is 'Optional spend cap in the organisation billing currency, in minor units.';
create table public.credit_packs (
  key text primary key, credits integer not null check (credits > 0), stripe_price_ids jsonb not null default '{}',
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.credit_prices (
  action text primary key, credits integer not null check (credits >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint plan_session_one_credit check (action <> 'plan_session' or credits = 1)
);
create table public.credit_ledger (
  id bigint generated always as identity primary key,
  organisation_id uuid not null references public.organisations(id), delta integer not null check (delta <> 0),
  reason text not null check (reason in ('plan_allowance','pack','grant','spend','refund','expiry')),
  action text references public.credit_prices(action), ref_type text, ref_id uuid,
  idempotency_key text not null unique check (idempotency_key <> ''), actor_id uuid references public.profiles(id) on delete set null,
  at timestamptz not null default now(),
  check ((reason in ('spend','expiry') and delta < 0) or (reason not in ('spend','expiry') and delta > 0))
);
create index credit_ledger_organisation_idx on public.credit_ledger(organisation_id);
create unique index credit_ledger_session_idx on public.credit_ledger(ref_id) where reason = 'spend' and ref_type = 'plan_session';
create table public.credit_reservations (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id),
  credits integer not null check (credits > 0), action text not null references public.credit_prices(action),
  status text not null check (status in ('held','settled','released')), expires_at timestamptz not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index credit_reservations_organisation_idx on public.credit_reservations(organisation_id);
alter table public.plan_sessions add constraint plan_sessions_credit_reservation_fk
  foreign key (credits_reservation_id) references public.credit_reservations(id);
create unique index plan_sessions_credit_reservation_idx on public.plan_sessions(credits_reservation_id);
create trigger plans_updated before update on public.plans for each row execute function private.set_updated_at();
create trigger billing_accounts_updated before update on public.billing_accounts for each row execute function private.set_updated_at();
create trigger credit_packs_updated before update on public.credit_packs for each row execute function private.set_updated_at();
create trigger credit_prices_updated before update on public.credit_prices for each row execute function private.set_updated_at();
create trigger credit_reservations_updated before update on public.credit_reservations for each row execute function private.set_updated_at();
alter table public.plans enable row level security;
alter table public.billing_accounts enable row level security;
alter table public.credit_packs enable row level security;
alter table public.credit_prices enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.credit_reservations enable row level security;
create policy plans_read on public.plans for select to authenticated using (active or (select private.staff_role()) is not null);
create policy credit_packs_read on public.credit_packs for select to authenticated using (active or (select private.staff_role()) is not null);
create policy credit_prices_read on public.credit_prices for select to authenticated using (true);
create policy billing_accounts_read on public.billing_accounts for select to authenticated
  using ((select private.staff_role()) is not null or organisation_id in (select private.org_ids('staff')));
create policy credit_ledger_read on public.credit_ledger for select to authenticated
  using ((select private.staff_role()) is not null or organisation_id in (select private.org_ids('staff')));
create policy credit_reservations_read on public.credit_reservations for select to authenticated
  using ((select private.staff_role()) is not null or organisation_id in (select private.org_ids('staff')));

create function private.credit_balance(p_organisation uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(entry.delta) from public.credit_ledger as entry where entry.organisation_id = p_organisation),0)
    - coalesce((select sum(reservation.credits) from public.credit_reservations as reservation
      where reservation.organisation_id = p_organisation and reservation.status = 'held' and reservation.expires_at > now()),0);
$$;
comment on function private.credit_balance(uuid) is 'Returns ledger credits less unexpired held credits for a trusted organisation, without mutating the balance.';
create function private.read_credit_balance(p_organisation uuid)
returns bigint language plpgsql stable security definer set search_path = '' as $$
#variable_conflict error
begin
  if not coalesce(private.staff_role() is not null or p_organisation in (select private.org_ids('staff')),false) then
    raise exception using errcode = '42501',message = 'Organisation membership required';
  end if;
  return private.credit_balance(p_organisation);
end;
$$;
comment on function private.read_credit_balance(uuid) is 'Checks the caller organisation or staff access and returns available credits.';
create function public.credit_balance(organisation uuid)
returns bigint language plpgsql stable set search_path = '' as $$
#variable_conflict error
begin
  return private.read_credit_balance(organisation);
end;
$$;
comment on function public.credit_balance(uuid) is 'Returns available credits only for a caller organisation or platform staff.';

create function private.grant_credits(p_organisation uuid,p_credits integer,p_key text)
returns bigint language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_entry public.credit_ledger;
begin
  if not coalesce(private.staff_role() in ('super_admin','finance'),false) then
    raise exception using errcode = '42501',message = 'Finance staff required';
  end if;
  if p_credits is null or p_credits <= 0 or p_key is null or btrim(p_key) = '' then
    raise exception using errcode = '23514',message = 'Positive credits and idempotency key required';
  end if;
  -- A shared organisation lock serialises grants, spending and reservation changes.
  perform organisation.id from public.organisations as organisation where organisation.id = p_organisation for update;
  if not found then raise exception using errcode = '23503',message = 'Organisation required'; end if;
  insert into public.credit_ledger(organisation_id,delta,reason,idempotency_key,actor_id)
    values (p_organisation,p_credits,'grant','grant:' || p_key,private.uid()) on conflict (idempotency_key) do nothing;
  select entry.* into v_entry from public.credit_ledger as entry where entry.idempotency_key = 'grant:' || p_key;
  if v_entry.organisation_id <> p_organisation or v_entry.delta <> p_credits or v_entry.reason <> 'grant' then
    raise exception using errcode = '23514',message = 'Idempotency key already used for a different grant';
  end if;
  return v_entry.id;
end;
$$;
comment on function private.grant_credits(uuid,integer,text) is 'Appends a positive finance-authorised grant once per key; an inconsistent replay fails atomically and a consistent replay returns the original ledger ID.';
create function public.grant_credits(organisation uuid,credits integer,idempotency_key text)
returns bigint language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  return private.grant_credits(organisation,credits,idempotency_key);
end;
$$;
comment on function public.grant_credits(uuid,integer,text) is 'Grants integer credits through the append-only ledger for super admins and finance staff.';

create function private.charge_plan_session(p_session uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  -- A planning session costs one credit; edits and alternative candidates reuse it.
  v_session_credits constant integer := 1;
  v_session public.plan_sessions;
  v_reservation uuid;
  v_organisation uuid;
begin
  select session.* into v_session from public.plan_sessions as session where session.id = p_session for update;
  if v_session.id is null then raise exception using errcode = '23503',message = 'Planning session required'; end if;
  select store.organisation_id into v_organisation from public.stores as store where store.id = v_session.store_id;
  perform organisation.id from public.organisations as organisation where organisation.id = v_organisation for update;
  if v_session.credits_reservation_id is not null then return v_session.credits_reservation_id; end if;
  if not exists (select from public.credit_prices as price where price.action = 'plan_session' and price.credits = v_session_credits) then
    raise exception using errcode = '23514',message = 'Planning credit price required';
  end if;
  if private.credit_balance(v_organisation) < v_session_credits then
    raise exception using errcode = '23514',message = 'Insufficient planning credits';
  end if;
  -- Settlement is immediate: no held charge remains to subtract a second time.
  insert into public.credit_reservations(organisation_id,credits,action,status,expires_at)
    values (v_organisation,v_session_credits,'plan_session','settled',now()) returning id into v_reservation;
  insert into public.credit_ledger(organisation_id,delta,reason,action,ref_type,ref_id,idempotency_key)
    values (v_organisation,-v_session_credits,'spend','plan_session','plan_session',p_session,'plan_session:' || p_session);
  update public.plan_sessions as session set credits_reservation_id = v_reservation where session.id = p_session;
  return v_reservation;
end;
$$;
comment on function private.charge_plan_session(uuid) is 'Settles exactly one integer credit per existing planning session under an organisation lock; returns the reservation UUID and leaves replayed sessions unchanged.';

create function private.release_expired_credit_reservations()
returns bigint language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare v_count bigint;
begin
  update public.credit_reservations as reservation set status = 'released' where reservation.status = 'held' and reservation.expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
comment on function private.release_expired_credit_reservations() is 'Releases wall-clock-expired held reservations and returns the number changed; no ledger mutation is required.';

create function private.protect_credit_ledger()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  -- Auth deletion may clear attribution but cannot rewrite the financial fact.
  if tg_op = 'UPDATE' and old.actor_id is not null and new.actor_id is null
    and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then return new; end if;
  raise exception using errcode = '23514',message = 'Credit ledger is append-only';
end;
$$;
comment on function private.protect_credit_ledger() is 'Rejects ledger rewrites and deletions, permitting only actor anonymisation for account deletion.';
create trigger credit_ledger_immutable before update or delete on public.credit_ledger for each row execute function private.protect_credit_ledger();

create function private.validate_plan_credit_reference()
returns trigger language plpgsql security definer set search_path = '' as $$
#variable_conflict error
begin
  if tg_op = 'UPDATE' and old.credits_reservation_id is not null
    and new.credits_reservation_id is distinct from old.credits_reservation_id then
    raise exception using errcode = '23514',message = 'Planning credit settlement cannot change';
  end if;
  if new.credits_reservation_id is not null and not exists (
    select from public.credit_reservations as reservation join public.stores as store on store.id = new.store_id
      where reservation.id = new.credits_reservation_id and reservation.organisation_id = store.organisation_id
        and reservation.action = 'plan_session' and reservation.credits = 1 and reservation.status = 'settled') then
    raise exception using errcode = '23514',message = 'Matching settled planning credit required';
  end if;
  return new;
end;
$$;
comment on function private.validate_plan_credit_reference() is 'Keeps the one-credit settlement in the session store organisation and prevents replacing recorded financial provenance.';
create trigger plan_credit_reference before insert or update on public.plan_sessions for each row execute function private.validate_plan_credit_reference();

-- Reviewed prompt metadata, system-owned call records and leased background work.
create table public.prompt_versions (
  key text not null, version integer not null check (version > 0), model text not null,
  status text not null check (status in ('live','test','retired')),
  traffic_pct smallint not null default 100 check (traffic_pct between 0 and 100),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (key,version)
);
comment on column public.prompt_versions.traffic_pct is 'Percentage of eligible calls routed to this prompt, from the prompt registry contract.';
create table public.llm_calls (
  id bigint generated always as identity primary key,
  purpose text not null, prompt_key text, prompt_version integer, model text not null, provider text,
  organisation_id uuid references public.organisations(id), plan_session_id uuid references public.plan_sessions(id) on delete set null,
  ref_id uuid, tokens_in integer check (tokens_in >= 0), tokens_out integer check (tokens_out >= 0),
  cost_usd numeric(10,6) check (cost_usd >= 0), latency_ms integer check (latency_ms >= 0),
  ok boolean not null, error text, at timestamptz not null default now(),
  foreign key (prompt_key,prompt_version) references public.prompt_versions(key,version) match full
);
comment on column public.llm_calls.cost_usd is 'Provider usage cost in US dollars, with microdollar precision; not a retailer invoice amount.';
create index llm_calls_organisation_idx on public.llm_calls(organisation_id);
create index llm_calls_session_idx on public.llm_calls(plan_session_id);
alter table public.plan_edits add constraint plan_edits_llm_call_fk foreign key (llm_call_id) references public.llm_calls(id);
create table public.jobs (
  id uuid primary key default gen_random_uuid(), kind text not null check (kind <> ''),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'queued' check (status in ('queued','running','done','failed','dead')),
  priority smallint not null default 0, attempts smallint not null default 0 check (attempts >= 0),
  max_attempts smallint not null default 3 check (max_attempts > 0),
  run_after timestamptz not null default now(), lease_until timestamptz, worker text,
  result jsonb, error text, cost jsonb, organisation_id uuid references public.organisations(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (attempts <= max_attempts),
  check ((status = 'running') = (lease_until is not null and worker is not null))
);
comment on column public.jobs.max_attempts is 'Default three worker attempts per job, the queue contract retry budget.';
create index jobs_claim_idx on public.jobs(kind,status,run_after) where status in ('queued','running','failed');
create index jobs_organisation_idx on public.jobs(organisation_id);
create table public.rate_limit_buckets (
  key text primary key, tokens numeric not null check (tokens >= 0), refilled_at timestamptz not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger prompt_versions_updated before update on public.prompt_versions for each row execute function private.set_updated_at();
create trigger jobs_updated before update on public.jobs for each row execute function private.set_updated_at();
create trigger rate_limit_buckets_updated before update on public.rate_limit_buckets for each row execute function private.set_updated_at();
alter table public.prompt_versions enable row level security;
alter table public.llm_calls enable row level security;
alter table public.jobs enable row level security;
alter table public.rate_limit_buckets enable row level security;
create policy prompt_versions_read on public.prompt_versions for select to authenticated using ((select private.staff_role()) is not null);
create policy llm_calls_read on public.llm_calls for select to authenticated using ((select private.staff_role()) is not null);
create policy jobs_read on public.jobs for select to authenticated using ((select private.staff_role()) is not null);

-- Row locking makes refill and consumption one operation; callers supply a trusted budget.
create function private.consume_rate_limit(p_key text,p_capacity numeric,p_refill_per_second numeric,p_cost numeric default 1)
returns boolean language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_bucket public.rate_limit_buckets;
  v_now timestamptz := clock_timestamp();
  v_tokens numeric;
begin
  if p_key is null or p_key = '' or p_capacity is null or p_capacity <= 0
    or p_refill_per_second is null or p_refill_per_second <= 0 or p_cost is null or p_cost <= 0 or p_cost > p_capacity then
    raise exception using errcode = '23514', message = 'Valid token bucket budget required';
  end if;
  insert into public.rate_limit_buckets(key,tokens,refilled_at) values (p_key,p_capacity,v_now) on conflict (key) do nothing;
  select bucket.* into v_bucket from public.rate_limit_buckets as bucket where bucket.key = p_key for update;
  v_now := clock_timestamp();
  -- Elapsed seconds earn fractional tokens; cap idle accumulation at the burst budget.
  v_tokens := least(p_capacity,v_bucket.tokens + greatest(0,extract(epoch from v_now - v_bucket.refilled_at)) * p_refill_per_second);
  update public.rate_limit_buckets as bucket set tokens = v_tokens - case when v_tokens >= p_cost then p_cost else 0 end,
    refilled_at = v_now where bucket.key = p_key;
  return v_tokens >= p_cost;
end;
$$;
comment on function private.consume_rate_limit(text,numeric,numeric,numeric) is 'Atomically consumes tokens from a trusted keyed budget, refilling in tokens per elapsed wall-clock second; returns false when exhausted.';

create function private.claim_job(p_kinds text[],p_worker text)
returns public.jobs language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  -- Five minutes is the initial queue lease budget; long workers renew before expiry.
  v_lease constant interval := interval '5 minutes';
  v_job public.jobs;
begin
  if p_worker is null or btrim(p_worker) = '' or coalesce(cardinality(p_kinds),0) = 0 then
    raise exception using errcode = '23514', message = 'Worker identity and job kinds required';
  end if;
  -- Exhausted crashed workers are terminal, rather than stranded as running jobs.
  update public.jobs as job set status = 'dead', worker = null, lease_until = null,
    error = coalesce(job.error,'Worker lease expired')
    where job.kind = any(p_kinds) and job.status = 'running' and job.lease_until <= clock_timestamp() and job.attempts >= job.max_attempts;
  select job.* into v_job from public.jobs as job
    where job.kind = any(p_kinds) and job.attempts < job.max_attempts and (
      (job.status in ('queued','failed') and job.run_after <= clock_timestamp())
      or (job.status = 'running' and job.lease_until <= clock_timestamp()))
    order by job.priority desc,job.run_after,job.id for update skip locked limit 1;
  if v_job.id is null then return null; end if;
  update public.jobs as job set status = 'running', attempts = job.attempts + 1,
    worker = p_worker, lease_until = clock_timestamp() + v_lease, error = null
    where job.id = v_job.id returning job.* into v_job;
  return v_job;
end;
$$;
comment on function private.claim_job(text[],text) is 'Claims one due job with SKIP LOCKED, increments attempts and issues a five-minute wall-clock lease; returns null when none is available.';
create function public.claim_job(kinds text[],worker text)
returns public.jobs language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  return private.claim_job(kinds,worker);
end;
$$;
comment on function public.claim_job(text[],text) is 'Returns one exclusively leased job for a trusted worker, or null when no requested kind is due.';

-- Attempt number fences a reclaimed lease even when the worker name is reused.
create function private.finish_job(p_id uuid,p_worker text,p_attempt smallint,p_result jsonb,p_error text,p_cost jsonb)
returns void language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  -- Retry delay starts at 30 seconds and doubles per failed attempt, capped at one hour.
  v_backoff_seconds constant integer := 30;
  v_backoff_cap_seconds constant integer := 3600;
  v_job public.jobs;
begin
  select job.* into v_job from public.jobs as job where job.id = p_id for update;
  if v_job.id is null or v_job.status <> 'running' or v_job.worker is distinct from p_worker
    or v_job.attempts is distinct from p_attempt or v_job.lease_until <= clock_timestamp() then
    raise exception using errcode = '23514', message = 'Current worker lease required';
  end if;
  update public.jobs as job set
    status = case when p_error is null then 'done' when job.attempts >= job.max_attempts then 'dead' else 'failed' end,
    result = p_result,error = p_error,cost = p_cost,worker = null,lease_until = null,
    run_after = case when p_error is null then job.run_after else clock_timestamp()
      + make_interval(secs => least(v_backoff_cap_seconds,v_backoff_seconds * power(2::numeric,job.attempts - 1))::double precision) end
    where job.id = p_id;
end;
$$;
comment on function private.finish_job(uuid,text,smallint,jsonb,text,jsonb) is 'Completes or fails the current fenced lease atomically, scheduling exponential retry delay in seconds or marking the exhausted job dead.';
create function public.complete_job(id uuid,worker text,attempt smallint,result jsonb default null,cost jsonb default null)
returns void language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  perform private.finish_job(id,worker,attempt,result,null,cost);
end;
$$;
comment on function public.complete_job(uuid,text,smallint,jsonb,jsonb) is 'Records a trusted worker result only for its unexpired matching lease and attempt.';
create function public.fail_job(id uuid,worker text,attempt smallint,failure_reason text,cost jsonb default null)
returns void language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  if failure_reason is null or failure_reason = '' then raise exception using errcode = '23514',message = 'Failure reason required'; end if;
  perform private.finish_job(id,worker,attempt,null,failure_reason,cost);
end;
$$;
comment on function public.fail_job(uuid,text,smallint,text,jsonb) is 'Records a non-empty worker failure and retries with backoff until the attempt budget is exhausted.';
create function private.renew_job_lease(p_id uuid,p_worker text,p_attempt smallint)
returns timestamptz language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_until timestamptz;
  -- Same five-minute queue lease budget as initial claim.
  v_lease constant interval := interval '5 minutes';
begin
  update public.jobs as job set lease_until = clock_timestamp() + v_lease
    where job.id = p_id and job.status = 'running' and job.worker = p_worker and job.attempts = p_attempt
      and job.lease_until > clock_timestamp() returning lease_until into v_until;
  if v_until is null then raise exception using errcode = '23514',message = 'Current worker lease required'; end if;
  return v_until;
end;
$$;
comment on function private.renew_job_lease(uuid,text,smallint) is 'Extends an unexpired fenced lease by the five-minute worker budget and returns its wall-clock expiry.';
create function public.renew_job_lease(id uuid,worker text,attempt smallint)
returns timestamptz language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  return private.renew_job_lease(id,worker,attempt);
end;
$$;
comment on function public.renew_job_lease(uuid,text,smallint) is 'Renews the current trusted worker attempt and returns its lease expiry.';

-- One active analysis per shared track prevents duplicate workers and provider fetches.
create unique index music_jobs_active_track_idx on public.jobs (((payload->>'track_id')::uuid))
  where kind = 'music_analyse' and status in ('queued','running','failed');

-- Install audio metadata and shared features under the same fenced queue attempt.
create function private.install_music_result(p_job uuid,p_worker text,p_attempt smallint,
  p_algorithm text,p_analysis jsonb,p_audio_sha256 text,p_bytes bigint,p_mime text,p_waveform jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_job public.jobs;
  v_track uuid;
  v_media uuid;
  v_analysis uuid;
  v_path text;
  -- Stored track durations use integer milliseconds; analysis clocks use seconds.
  v_ms_per_second constant integer := 1000;
  v_duration integer := round((p_analysis->>'duration_seconds')::numeric * v_ms_per_second);
begin
  select job.* into v_job from public.jobs as job where job.id = p_job for update;
  if v_job.id is null or v_job.kind <> 'music_analyse' or v_job.status <> 'running'
    or v_job.worker is distinct from p_worker or v_job.attempts is distinct from p_attempt
    or v_job.lease_until <= clock_timestamp() then
    raise exception using errcode = '23514', message = 'Current music worker lease required';
  end if;
  v_track := (v_job.payload->>'track_id')::uuid;
  perform track.id from public.music_tracks as track where track.id = v_track and track.provider = 'jamendo' for update;
  if not found then raise exception using errcode = '23503', message = 'Jamendo track required'; end if;
  -- A blocked track lock may outlive the lease checked before acquiring it.
  if v_job.lease_until <= clock_timestamp() then
    raise exception using errcode = '23514', message = 'Current music worker lease required';
  end if;
  v_path := v_track::text || '/' || p_audio_sha256;
  insert into public.media(bucket,path,kind,mime,bytes,sha256,duration_ms)
    values ('audio',v_path,'audio',p_mime,p_bytes,p_audio_sha256,v_duration)
    on conflict (bucket,path) do update set duration_ms = excluded.duration_ms
    returning id into v_media;
  v_analysis := private.save_music_analysis(v_track,p_algorithm,p_analysis,p_audio_sha256);
  update public.music_tracks set audio_media_id = v_media,duration_ms = v_duration,
    bpm = (p_analysis->>'tempo_bpm')::numeric,waveform = p_waveform where id = v_track;
  return v_analysis;
end;
$$;
comment on function private.install_music_result(uuid,text,smallint,text,jsonb,text,bigint,text,jsonb) is 'Atomically installs content-addressed audio metadata, immutable shared analysis and track display facts for the current music job attempt; returns the analysis UUID.';
create function public.install_music_result(p_job uuid,p_worker text,p_attempt smallint,
  p_algorithm text,p_analysis jsonb,p_audio_sha256 text,p_bytes bigint,p_mime text,p_waveform jsonb)
returns uuid language plpgsql set search_path = '' as $$
begin
  -- Keep the public privilege boundary explicit rather than using SQL inlining.
  return private.install_music_result(p_job,p_worker,p_attempt,p_algorithm,p_analysis,p_audio_sha256,p_bytes,p_mime,p_waveform);
end;
$$;
comment on function public.install_music_result(uuid,text,smallint,text,jsonb,text,bigint,text,jsonb) is 'Backend-only fenced music result installation; analysis times are seconds and waveform peaks are normalised amplitudes.';

-- One active measurement job per analysis prevents conflicting attempts for the same evidence.
create unique index video_jobs_active_analysis_idx on public.jobs (((payload->>'analysis_id')::uuid))
  where kind = 'video_analyse' and status in ('queued','running','failed');

-- Queue and analysis locks fence status/result installation, including reclaimed attempts.
create function private.save_video_measurement(p_job uuid,p_worker text,p_attempt smallint,
  p_state text,p_extractor text,p_measurements jsonb default null,p_error text default null)
returns public.video_analyses language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_job public.jobs;
  v_analysis public.video_analyses;
begin
  select job.* into v_job from public.jobs as job where job.id = p_job for update;
  if v_job.id is null or v_job.kind <> 'video_analyse' or v_job.status <> 'running'
    or v_job.worker is distinct from p_worker or v_job.attempts is distinct from p_attempt
    or v_job.lease_until <= clock_timestamp() then
    raise exception using errcode = '23514', message = 'Current video worker lease required';
  end if;
  select analysis.* into v_analysis from public.video_analyses as analysis
    where analysis.id = (v_job.payload->>'analysis_id')::uuid
      and analysis.media_id = (v_job.payload->>'media_id')::uuid for update;
  if v_analysis.id is null then
    raise exception using errcode = '23503', message = 'Matching video analysis required';
  end if;
  if v_job.lease_until <= clock_timestamp() then
    raise exception using errcode = '23514', message = 'Current video worker lease required';
  end if;
  if p_state not in ('measuring','interpreting','failed') or p_state is null
    or nullif(btrim(p_extractor),'') is null then
    raise exception using errcode = '23514', message = 'Measurement state and extractor required';
  end if;
  -- A retry after evidence installation must not regress interpretation or reviewed results.
  if v_analysis.status in ('interpreting','fitting','ready') or v_analysis.shots is not null then
    if p_state = 'measuring' and v_analysis.extractor = p_extractor then return v_analysis; end if;
    raise exception using errcode = '23514', message = 'Installed video evidence is immutable to measurement';
  end if;
  if p_state = 'interpreting' then
    if v_analysis.status <> 'measuring'
      or jsonb_typeof(p_measurements->'shots') is distinct from 'array'
      or jsonb_typeof(p_measurements->'features') is distinct from 'array'
      or jsonb_typeof(p_measurements->'keyframes') is distinct from 'array' then
      raise exception using errcode = '23514', message = 'Complete measured evidence required';
    end if;
    if jsonb_array_length(p_measurements->'shots') = 0
      or jsonb_array_length(p_measurements->'shots') <> jsonb_array_length(p_measurements->'features')
      or jsonb_array_length(p_measurements->'shots') <> jsonb_array_length(p_measurements->'keyframes') then
      raise exception using errcode = '23514', message = 'Evidence must cover every shot';
    end if;
  elsif p_state = 'failed' and nullif(btrim(p_error),'') is null then
    raise exception using errcode = '23514', message = 'Safe measurement error required';
  end if;
  update public.video_analyses as analysis set status = p_state, extractor = p_extractor,
    shots = case when p_state = 'interpreting' then p_measurements->'shots' else null end,
    features = case when p_state = 'interpreting' then p_measurements->'features' else null end,
    keyframes = case when p_state = 'interpreting' then p_measurements->'keyframes' else null end,
    error = case when p_state = 'failed' then p_error else null end
    where analysis.id = v_analysis.id returning analysis.* into v_analysis;
  if p_state = 'interpreting' then
    insert into public.jobs(kind,payload,organisation_id)
      values ('video_fit',jsonb_build_object('analysis_id',v_analysis.id,'media_id',v_analysis.media_id),v_job.organisation_id);
  end if;
  return v_analysis;
end;
$$;
comment on function private.save_video_measurement(uuid,text,smallint,text,text,jsonb,text) is 'Fences analysis state and complete shot evidence to the matching unexpired video job attempt. Times are ms from MP4 start; geometry is normalised image space. Returns the analysis row and preserves installed evidence on retries.';
create function public.save_video_measurement(p_job uuid,p_worker text,p_attempt smallint,
  p_state text,p_extractor text,p_measurements jsonb default null,p_error text default null)
returns public.video_analyses language plpgsql set search_path = '' as $$
begin
  return private.save_video_measurement(p_job,p_worker,p_attempt,p_state,p_extractor,p_measurements,p_error);
end;
$$;
comment on function public.save_video_measurement(uuid,text,smallint,text,text,jsonb,text) is 'Backend-only status and result write for one video measurement attempt; returns durable evidence for interpretation without completing the queue job.';

-- One generation per source media, including uncertain calls: retries cannot buy another response.
create unique index video_interpret_once_idx on public.llm_calls(ref_id)
  where purpose = 'video.interpret';
create unique index video_fit_active_analysis_idx on public.jobs (((payload->>'analysis_id')::uuid))
  where kind = 'video_fit' and status in ('queued','running','failed');

-- Queue and analysis locks serialize reservations, usage and immutable candidate installation.
create function private.video_fit_step(p_job uuid,p_worker text,p_attempt smallint,p_action text,p_record jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  -- Owner's per-video interpretation ceiling in USD, independent of changing model tariffs.
  v_cap_usd constant numeric := 0.10;
  v_job public.jobs;
  v_analysis public.video_analyses;
  v_call public.llm_calls;
  v_parent uuid;
  v_candidate public.design_candidates;
  v_source text;
  v_effect record;
  v_design jsonb;
begin
  select job.* into v_job from public.jobs as job where job.id = p_job for update;
  if v_job.id is null or v_job.kind <> 'video_fit' or v_job.status <> 'running'
    or v_job.worker is distinct from p_worker or v_job.attempts is distinct from p_attempt
    or v_job.lease_until <= clock_timestamp() then
    raise exception using errcode = '23514', message = 'Current fitting worker lease required';
  end if;
  select analysis.* into v_analysis from public.video_analyses as analysis
    where analysis.id = (v_job.payload->>'analysis_id')::uuid
      and analysis.media_id = (v_job.payload->>'media_id')::uuid for update;
  if v_analysis.id is null or v_analysis.shots is null or v_analysis.features is null then
    raise exception using errcode = '23514', message = 'Complete measured video required';
  end if;
  if v_job.lease_until <= clock_timestamp() then
    raise exception using errcode = '23514', message = 'Current fitting worker lease required';
  end if;
  select call.* into v_call from public.llm_calls as call
    where call.purpose = 'video.interpret' and call.ref_id = v_analysis.media_id;
  if p_action = 'read' then
    return jsonb_build_object('analysis',to_jsonb(v_analysis),'call',case when v_call.id is null then null else to_jsonb(v_call) end,
      'candidates',coalesce((select jsonb_agg(to_jsonb(candidate) order by candidate.source)
        from public.design_candidates as candidate where candidate.analysis_id = v_analysis.id and candidate.source in ('llm','fit') and candidate.model = v_call.model),'[]'::jsonb));
  elsif p_action = 'reserve' then
    if v_analysis.status not in ('interpreting','failed') or v_call.id is not null
      or (p_record->>'cost_usd')::numeric not between 0 and v_cap_usd
      or p_record->>'cost_usd' is null or nullif(p_record->>'model','') is null then
      raise exception using errcode = '23514', message = 'Unused interpretation budget required';
    end if;
    -- A pending row retains the whole estimate if a response or usage write is lost.
    insert into public.llm_calls(purpose,model,provider,ref_id,cost_usd,ok,error)
      values ('video.interpret',p_record->>'model','google',v_analysis.media_id,(p_record->>'cost_usd')::numeric,false,'reserved')
      returning * into v_call;
    return to_jsonb(v_call);
  elsif p_action = 'usage' then
    if v_call.id is null or v_call.error is distinct from 'reserved'
      or p_record->>'tokens_in' is null or p_record->>'tokens_out' is null
      or p_record->>'cost_usd' is null or p_record->>'latency_ms' is null then
      raise exception using errcode = '23514', message = 'Pending interpretation call required';
    end if;
    update public.llm_calls set tokens_in = (p_record->>'tokens_in')::integer,
      tokens_out = (p_record->>'tokens_out')::integer, cost_usd = (p_record->>'cost_usd')::numeric,
      latency_ms = (p_record->>'latency_ms')::integer,ok = false,error = 'response_received'
      where id = v_call.id returning * into v_call;
    return to_jsonb(v_call);
  elsif p_action in ('interpret','ready') then
    v_source := case when p_action = 'interpret' then 'llm' else 'fit' end;
    select candidate.* into v_candidate from public.design_candidates as candidate
      where candidate.analysis_id = v_analysis.id and candidate.source = v_source and candidate.model = v_call.model;
    if v_candidate.id is not null then return to_jsonb(v_candidate); end if;
    if p_action = 'interpret' and (v_analysis.status not in ('interpreting','failed') or v_call.error is distinct from 'response_received'
      or v_call.cost_usd > v_cap_usd or v_call.tokens_in is null or v_call.tokens_out is null) then
      raise exception using errcode = '23514', message = 'Successful bounded interpretation usage required';
    end if;
    if p_action = 'ready' then
      select candidate.id into v_parent from public.design_candidates as candidate
        where candidate.analysis_id = v_analysis.id and candidate.source = 'llm' and candidate.model = v_call.model;
      if v_analysis.status not in ('fitting','failed') or v_parent is null then
        raise exception using errcode = '23514', message = 'Interpretation parent required';
      end if;
    end if;
    perform private.check_candidate_proposal(p_record->'proposal','cake');
    if jsonb_array_length(p_record#>'{proposal,composition,tubes}') <> jsonb_array_length(v_analysis.shots) then
      raise exception using errcode = '23514', message = 'Candidate must cover all measured shots';
    end if;
    if exists (select from jsonb_array_elements(p_record#>'{proposal,composition,tubes}') with ordinality as tube(value,position)
      where (tube.value->>'i')::integer <> tube.position - 1
      or tube.value->'t_ms' is distinct from v_analysis.shots->(tube.position::integer - 1)->'t_ms') then
      raise exception using errcode = '23514', message = 'Candidate sequence must preserve measured onsets';
    end if;
    for v_effect in select * from jsonb_each(p_record#>'{proposal,effects}') loop
      select private.merge_design_overrides(version.design,coalesce(v_effect.value->'overrides','{}'::jsonb)) into v_design
        from public.effects as effect join public.effect_versions as version on version.id = effect.current_version_id
        where effect.slug = v_effect.value->>'template' and effect.is_template and effect.status = 'published'
          and version.status = 'published' and effect.kind = coalesce(v_effect.value#>>'{overrides,kind}',effect.kind);
      if v_design is null or not extensions.jsonb_matches_schema(private.design_schema(),v_design) then
        raise exception using errcode = '23514', message = 'Canonical template overrides required';
      end if;
    end loop;
    insert into public.design_candidates(analysis_id,source,model,parent_id,proposal,scores,overall,renderer)
      values (v_analysis.id,v_source,v_call.model,v_parent,p_record->'proposal',p_record->'scores',
        (p_record->>'overall')::numeric,p_record->>'renderer') returning * into v_candidate;
    update public.video_analyses set status = case when p_action = 'interpret' then 'fitting' else 'ready' end,
      error = null where id = v_analysis.id;
    if p_action = 'interpret' then
      update public.llm_calls set ok = true,error = null where id = v_call.id;
    end if;
    return to_jsonb(v_candidate);
  elsif p_action = 'failure' then
    if v_analysis.status <> 'ready' then
      update public.video_analyses set status = 'failed',error = p_record->>'error' where id = v_analysis.id;
      update public.llm_calls set ok = false,error = p_record->>'error'
        where id = v_call.id and not ok;
    end if;
    return '{}'::jsonb;
  end if;
  raise exception using errcode = '23514', message = 'Known fitting action required';
end;
$$;
comment on function private.video_fit_step(uuid,text,smallint,text,jsonb) is 'Fenced per-video call reservation, usage and immutable llm/fit candidate writes. Costs are USD; pending calls prevent repeat generation after uncertain failures. Returns durable state or installed rows.';
create function public.video_fit_step(p_job uuid,p_worker text,p_attempt smallint,p_action text,p_record jsonb default '{}')
returns jsonb language plpgsql set search_path = '' as $$
begin
  return private.video_fit_step(p_job,p_worker,p_attempt,p_action,p_record);
end;
$$;
comment on function public.video_fit_step(uuid,text,smallint,text,jsonb) is 'Backend-only fitting lifecycle for an unexpired matching queue attempt; preserves measured evidence and ready results.';

-- Retailer integration metadata; credentials live in Vault and API keys are hashes.
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  provider text not null check (btrim(provider) <> ''),
  status text not null check (status in ('connected','error','paused','disconnected')),
  config jsonb not null default '{}' check (jsonb_typeof(config) = 'object'),
  secret_id uuid,
  last_sync_at timestamptz,
  unique (organisation_id, provider),
  unique (organisation_id, id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.integrations enable row level security;
create trigger set_updated_at before update on public.integrations
  for each row execute function private.set_updated_at();

comment on column public.integrations.secret_id is 'References vault.secrets(id); credentials must never be stored in config.';
create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  integration_id uuid not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  counts jsonb not null default '{}' check (jsonb_typeof(counts) = 'object'),
  error text,
  foreign key (organisation_id, integration_id) references public.integrations(organisation_id, id) on delete cascade,
  check (finished_at is null or finished_at >= started_at),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sync_runs enable row level security;
create trigger set_updated_at before update on public.sync_runs
  for each row execute function private.set_updated_at();

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  url text not null check (url ~ '^https://[^[:space:]]+$'),
  events text[] not null check (cardinality(events) > 0 and array_position(events, null) is null),
  secret_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.webhook_endpoints enable row level security;
create trigger set_updated_at before update on public.webhook_endpoints
  for each row execute function private.set_updated_at();

comment on column public.webhook_endpoints.secret_id is 'References vault.secrets(id); signing secrets remain in Vault.';
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  prefix text not null check (btrim(prefix) <> ''),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null check (cardinality(scopes) > 0 and array_position(scopes, null) is null),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.api_keys enable row level security;
create trigger set_updated_at before update on public.api_keys
  for each row execute function private.set_updated_at();

comment on column public.api_keys.key_hash is 'Lower-case SHA-256 digest of a high-entropy API key; never the original key.';
create index integrations_organisation_idx on public.integrations(organisation_id);
create policy integrations_select on public.integrations for select to authenticated
  using ((select private.staff_role()) is not null or organisation_id in (select private.org_ids('staff')));
create policy integrations_insert on public.integrations for insert to authenticated
  with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'team.manage')));
create policy integrations_update on public.integrations for update to authenticated
  using (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'team.manage'))) with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'team.manage')));
create index sync_runs_organisation_idx on public.sync_runs(organisation_id);
create policy sync_runs_select on public.sync_runs for select to authenticated
  using ((select private.staff_role()) is not null or organisation_id in (select private.org_ids('staff')));
create index webhook_endpoints_organisation_idx on public.webhook_endpoints(organisation_id);
create policy webhook_endpoints_select on public.webhook_endpoints for select to authenticated
  using ((select private.staff_role()) is not null or organisation_id in (select private.org_ids('staff')));
create policy webhook_endpoints_insert on public.webhook_endpoints for insert to authenticated
  with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'team.manage')));
create policy webhook_endpoints_update on public.webhook_endpoints for update to authenticated
  using (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'team.manage'))) with check (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'team.manage')));
create policy webhook_endpoints_delete on public.webhook_endpoints for delete to authenticated
  using (((select private.staff_role()) = 'super_admin' or private.can(organisation_id, 'team.manage')));
create index api_keys_organisation_idx on public.api_keys(organisation_id);
create policy api_keys_select on public.api_keys for select to authenticated
  using ((select private.staff_role()) is not null or organisation_id in (select private.org_ids('staff')));

-- Platform configuration, personal notifications and accountable support records.
create table public.feature_flags (
  key text primary key check (btrim(key) <> ''),
  description text,
  enabled boolean not null default false,
  markets text[],
  rollout_pct smallint not null default 0 check (rollout_pct between 0 and 100),
  check (markets is null or array_position(markets, null) is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.feature_flags enable row level security;
create trigger set_updated_at before update on public.feature_flags
  for each row execute function private.set_updated_at();

comment on column public.feature_flags.rollout_pct is 'Percentage of organisations selected by a deterministic hash bucket, from 0 to 100.';
create table public.flag_overrides (
  flag_key text not null references public.feature_flags(key) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  enabled boolean not null,
  primary key (flag_key, organisation_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.flag_overrides enable row level security;
create trigger set_updated_at before update on public.flag_overrides
  for each row execute function private.set_updated_at();

create index flag_overrides_organisation_idx on public.flag_overrides(organisation_id);
create table public.platform_settings (
  key text primary key check (btrim(key) <> ''),
  value jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
create trigger set_updated_at before update on public.platform_settings
  for each row execute function private.set_updated_at();

create table public.notifications (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organisation_id uuid references public.organisations(id) on delete cascade,
  kind text not null, title text not null, body text, href text,
  tone text check (tone in ('info','good','warn','bad')),
  read_at timestamptz,
  at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create trigger set_updated_at before update on public.notifications
  for each row execute function private.set_updated_at();

create table public.notification_preferences (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  kind text not null,
  channel text not null check (channel in ('in_app','email')),
  enabled boolean not null,
  primary key (profile_id, organisation_id, kind, channel),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
create trigger set_updated_at before update on public.notification_preferences
  for each row execute function private.set_updated_at();

create index notification_preferences_organisation_idx on public.notification_preferences(organisation_id);
create table public.support_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id),
  organisation_id uuid references public.organisations(id),
  target_profile_id uuid references public.profiles(id),
  mode text not null check (mode in ('view','edit')),
  reason text not null check (btrim(reason) <> ''),
  ticket text,
  approved_by uuid references public.profiles(id),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  ended_at timestamptz,
  check (organisation_id is not null or target_profile_id is not null),
  check (ends_at > started_at),
  check (ended_at is null or ended_at >= started_at),
  check (mode <> 'edit' or (approved_by is not null and approved_by <> staff_id)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.support_sessions enable row level security;
create trigger set_updated_at before update on public.support_sessions
  for each row execute function private.set_updated_at();

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  acting_as_support_session uuid references public.support_sessions(id),
  organisation_id uuid,
  action text not null,
  table_name text, row_id text,
  diff jsonb
);
alter table public.audit_log enable row level security;

comment on column public.audit_log.actor_id is 'Historical request identity retained even if the profile is deleted; null for system actions.';
comment on column public.audit_log.organisation_id is 'Historical tenant identity retained even if the organisation is deleted.';
create index notifications_profile_id_idx on public.notifications(profile_id);
create index notifications_organisation_id_idx on public.notifications(organisation_id);
create index support_sessions_organisation_id_idx on public.support_sessions(organisation_id);
create index support_sessions_staff_id_idx on public.support_sessions(staff_id);
create index support_sessions_target_profile_id_idx on public.support_sessions(target_profile_id);
create index audit_log_organisation_id_idx on public.audit_log(organisation_id);
create policy feature_flags_select on public.feature_flags for select to authenticated using ((select private.staff_role()) is not null);
create policy feature_flags_insert on public.feature_flags for insert to authenticated with check ((select private.staff_role()) = 'super_admin');
create policy feature_flags_update on public.feature_flags for update to authenticated using ((select private.staff_role()) = 'super_admin') with check ((select private.staff_role()) = 'super_admin');
create policy feature_flags_delete on public.feature_flags for delete to authenticated using ((select private.staff_role()) = 'super_admin');
create policy platform_settings_select on public.platform_settings for select to authenticated using ((select private.staff_role()) is not null);
create policy platform_settings_insert on public.platform_settings for insert to authenticated with check ((select private.staff_role()) = 'super_admin');
create policy platform_settings_update on public.platform_settings for update to authenticated using ((select private.staff_role()) = 'super_admin') with check ((select private.staff_role()) = 'super_admin');
create policy platform_settings_delete on public.platform_settings for delete to authenticated using ((select private.staff_role()) = 'super_admin');
create policy flag_overrides_select on public.flag_overrides for select to authenticated using ((select private.staff_role()) is not null or organisation_id in (select private.org_ids('staff')));
create policy flag_overrides_insert on public.flag_overrides for insert to authenticated with check ((select private.staff_role()) = 'super_admin');
create policy flag_overrides_update on public.flag_overrides for update to authenticated using ((select private.staff_role()) = 'super_admin') with check ((select private.staff_role()) = 'super_admin');
create policy flag_overrides_delete on public.flag_overrides for delete to authenticated using ((select private.staff_role()) = 'super_admin');

create policy notifications_select on public.notifications for select to authenticated
  using (profile_id = (select private.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (profile_id = (select private.uid())) with check (profile_id = (select private.uid()));
create policy notification_preferences_select on public.notification_preferences for select to authenticated
  using (profile_id = (select private.uid()));
create policy notification_preferences_insert on public.notification_preferences for insert to authenticated
  with check (profile_id = (select private.uid()) and organisation_id in (select private.org_ids('staff')));
create policy notification_preferences_update on public.notification_preferences for update to authenticated
  using (profile_id = (select private.uid()) and organisation_id in (select private.org_ids('staff')))
  with check (profile_id = (select private.uid()) and organisation_id in (select private.org_ids('staff')));
create policy notification_preferences_delete on public.notification_preferences for delete to authenticated
  using (profile_id = (select private.uid()));
create policy audit_log_select on public.audit_log for select to authenticated
  using ((select private.staff_role()) is not null or organisation_id in (select private.org_ids('owner')));
create policy support_sessions_select on public.support_sessions for select to authenticated
  using ((select private.staff_role()) = 'super_admin' or (staff_id = (select private.uid()) and (select private.staff_role()) = 'support'));

-- Computes a tenant flag without exposing configuration or another tenant's override.
create or replace function private.flag_on(flag text, org uuid)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict error
declare
  v_flag public.feature_flags%rowtype;
  v_override boolean;
  -- Percentage buckets follow the schema's hashtext algorithm; bigint avoids abs(int-min) overflow.
  v_percentage_buckets constant integer := 100;
begin
  if not exists (select from public.organisations as organisation where organisation.id = org) then
    return false;
  end if;
  if coalesce(auth.role(), '') <> 'service_role' and private.staff_role() is null
    and org not in (select private.org_ids('staff')) then
    raise exception 'Organisation flag access denied' using errcode = '42501';
  end if;
  select * into v_flag from public.feature_flags as flags where flags.key = flag;
  if not found then return false; end if;
  select overrides.enabled into v_override from public.flag_overrides as overrides
    where overrides.flag_key = flag and overrides.organisation_id = org;
  if found then return v_override; end if;
  return v_flag.enabled and (v_flag.markets is null or exists (
    select from public.organisations as organisation where organisation.id = org
      and organisation.home_market = any(v_flag.markets)))
    and abs(hashtext(org::text || flag)::bigint) % v_percentage_buckets < v_flag.rollout_pct;
end;
$$;
comment on function private.flag_on(text, uuid) is 'Evaluates override, home market and deterministic percentage rollout for an authorised organisation; unknown flags return false.';

-- Returns one evaluated flag for an authorised tenant, without configuration metadata.
create or replace function public.flag_on(key text, org uuid)
returns boolean language sql stable set search_path = ''
as $$ select private.flag_on(key, org); $$;
comment on function public.flag_on(text, uuid) is 'Returns the evaluated organisation feature flag; foreign-tenant requests are refused.';

-- Stamps the real editor rather than trusting a supplied profile UUID.
create or replace function private.stamp_setting_editor()
returns trigger language plpgsql set search_path = ''
as $$
#variable_conflict error
begin
  new.updated_by := private.uid();
  return new;
end;
$$;
comment on function private.stamp_setting_editor() is 'Stamps platform settings with the current request identity on insert or update.';
create trigger stamp_setting_editor before insert or update on public.platform_settings
  for each row execute function private.stamp_setting_editor();

-- Opens a bounded support record; edit approval must be a different super admin's actual request.
create or replace function private.start_support_session(
  staff uuid, org uuid, target uuid, mode text, reason text, ticket text, ends_at timestamptz
)
returns uuid language plpgsql security definer set search_path = ''
as $$
#variable_conflict error
declare
  v_id uuid;
  v_role text := private.staff_role();
  v_staff_role text;
  v_approved_by uuid;
begin
  if v_role is null or v_role not in ('super_admin','support') then
    raise exception 'Support access denied' using errcode = '42501';
  end if;
  select roles.role into v_staff_role from public.staff_roles as roles
    join public.profiles as profile on profile.id = roles.profile_id
    where roles.profile_id = staff and profile.status = 'active' and not profile.is_anonymous;
  if v_staff_role is null or v_staff_role not in ('super_admin','support') then
    raise exception 'Invalid support staff' using errcode = '23514';
  end if;
  if mode = 'edit' then
    if v_role <> 'super_admin' or staff = private.uid() then
      raise exception 'Independent super admin approval required' using errcode = '42501';
    end if;
    v_approved_by := private.uid();
  elsif staff is distinct from private.uid() then
    raise exception 'View sessions must belong to the caller' using errcode = '42501';
  end if;
  if target is not null and org is not null and not exists (
    select from public.memberships as member where member.organisation_id = org and member.profile_id = target
  ) then raise exception 'Target does not belong to organisation' using errcode = '23514'; end if;
  insert into public.support_sessions(staff_id,organisation_id,target_profile_id,mode,reason,ticket,approved_by,ends_at)
    values(staff,org,target,mode,reason,ticket,v_approved_by,ends_at) returning id into v_id;
  return v_id;
end;
$$;
comment on function private.start_support_session(uuid,uuid,uuid,text,text,text,timestamptz) is 'Creates a support record with server-derived approval and start time; ends_at is an absolute expiry, and no impersonation rights are granted.';

-- Exposes support session creation through the checked private boundary.
create or replace function public.start_support_session(staff uuid, org uuid, target uuid, mode text, reason text, ticket text, ends_at timestamptz)
returns uuid language sql set search_path = ''
as $$ select private.start_support_session(staff,org,target,mode,reason,ticket,ends_at); $$;
comment on function public.start_support_session(uuid,uuid,uuid,text,text,text,timestamptz) is 'Creates a view or independently approved edit support record with an absolute expiry timestamp.';

-- Ends an owned support session without permitting approval or identity changes.
create or replace function private.end_support_session(session uuid)
returns void language plpgsql security definer set search_path = ''
as $$
#variable_conflict error
begin
  update public.support_sessions as support set ended_at = coalesce(support.ended_at, now())
    where support.id = session and (private.staff_role() = 'super_admin'
      or (private.staff_role() = 'support' and support.staff_id = private.uid()));
  if not found then raise exception 'Support session access denied' using errcode = '42501'; end if;
end;
$$;
comment on function private.end_support_session(uuid) is 'Idempotently records transaction time as the end of an owned session, or one ended by a super admin.';

-- Ends a session through the checked private boundary.
create or replace function public.end_support_session(session uuid)
returns void language sql set search_path = ''
as $$ select private.end_support_session(session); $$;
comment on function public.end_support_session(uuid) is 'Ends an authorised support session without changing its recorded approval or participants.';

-- Records configuration changes transactionally, omitting credentials and personally sensitive payloads.
create or replace function private.audit_record()
returns trigger language plpgsql security definer set search_path = ''
as $$
#variable_conflict error
declare
  v_before jsonb;
  v_after jsonb;
  v_row jsonb;
  v_changed_fields jsonb;
  -- These fields are confidential or large documents; audit records describe their row's change only.
  v_redacted_fields constant text[] := array['token_hash','key_hash','secret_id','config','design','composition','cues','answers','email'];
begin
  if tg_op <> 'INSERT' then v_before := to_jsonb(old) - v_redacted_fields; end if;
  if tg_op <> 'DELETE' then v_after := to_jsonb(new) - v_redacted_fields; end if;
  v_row := coalesce(v_after, v_before);
  if tg_op = 'UPDATE' then
    select jsonb_agg(entry.key order by entry.key) into v_changed_fields
      from jsonb_each(to_jsonb(new) - 'updated_at') as entry
      where entry.value is distinct from (to_jsonb(old) -> entry.key);
    if v_changed_fields is null then return null; end if;
  end if;
  -- Store prices use a compound row identity; the organisation is recorded separately.
  insert into public.audit_log(actor_id,organisation_id,action,table_name,row_id,diff)
    values(private.uid(), (v_row ->> 'organisation_id')::uuid, lower(tg_op), tg_table_name,
      coalesce(v_row ->> 'id', v_row ->> 'key', v_row ->> 'flag_key', v_row ->> 'profile_id',
        (v_row ->> 'store_id') || '/' || (v_row ->> 'range_item_id')),
      jsonb_build_object('before',v_before,'after',v_after,'changed_fields',v_changed_fields));
  return null;
end;
$$;
comment on function private.audit_record() is 'AFTER row trigger records redacted configuration snapshots and real request identity in the same transaction; client session claims are not trusted.';
create trigger audit_record after insert or update or delete on public.range_items
  for each row execute function private.audit_record();
create trigger audit_record after insert or update or delete on public.store_items
  for each row execute function private.audit_record();
create trigger audit_record after insert or update or delete on public.memberships
  for each row execute function private.audit_record();
create trigger audit_record after insert or update or delete on public.plans
  for each row execute function private.audit_record();
create trigger audit_record after insert or update or delete on public.feature_flags
  for each row execute function private.audit_record();
create trigger audit_record after insert or update or delete on public.flag_overrides
  for each row execute function private.audit_record();
create trigger audit_record after insert or update or delete on public.effect_versions
  for each row execute function private.audit_record();
create trigger audit_record after insert or update or delete on public.product_versions
  for each row execute function private.audit_record();
create trigger audit_record after insert or update or delete on public.show_versions
  for each row execute function private.audit_record();
create trigger audit_record after insert or update or delete on public.qr_codes
  for each row execute function private.audit_record();
create trigger audit_record after insert or update or delete on public.platform_settings
  for each row execute function private.audit_record();
create trigger audit_record after insert or update or delete on public.integrations
  for each row execute function private.audit_record();
create trigger audit_record after insert or update or delete on public.webhook_endpoints
  for each row execute function private.audit_record();
create trigger audit_record after insert or update or delete on public.api_keys
  for each row execute function private.audit_record();
create trigger audit_record after insert or update or delete on public.support_sessions
  for each row execute function private.audit_record();

-- Storage authorisation checks an existing owning identity, never client metadata.
create function private.storage_path_owner(p_name text)
returns uuid language plpgsql immutable set search_path = '' as $$
#variable_conflict error
declare
  v_parts text[] := string_to_array(p_name,'/');
begin
  if cardinality(v_parts) < 2 or v_parts && array['','.','..']
    or v_parts[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v_parts[1]::uuid;
end;
$$;
comment on function private.storage_path_owner(text) is 'Returns the owning UUID from a canonical lower-case UUID folder path; malformed or traversal paths return null.';

create function private.storage_access(p_bucket text,p_name text,p_write boolean)
returns boolean language plpgsql stable security definer set search_path = '' as $$
#variable_conflict error
declare
  v_owner uuid := private.storage_path_owner(p_name);
  v_staff text := private.staff_role();
begin
  if v_owner is null then return false; end if;
  case p_bucket
    when 'posters' then
      return v_staff in ('super_admin','catalogue_editor') and (
        exists (select from public.effect_versions as version where version.id = v_owner)
        or exists (select from public.product_versions as version where version.id = v_owner));
    when 'brand' then
      return v_owner in (select private.org_ids('manager')) and exists (
        select from public.memberships as member where member.organisation_id = v_owner
          and member.profile_id = private.uid() and member.store_ids is null);
    when 'catalogue-media', 'imports' then
      return (v_staff is not null and (
        exists (select from public.suppliers as supplier where supplier.id = v_owner)
        or exists (select from public.organisations as organisation where organisation.id = v_owner)
        or exists (select from public.staff_roles as owner_staff where owner_staff.profile_id = v_owner)))
        or v_owner in (select private.supplier_ids())
        or (not p_write and p_bucket = 'catalogue-media' and v_owner in (select private.org_ids('staff')));
    when 'audio' then
      return v_staff is not null and exists (select from public.music_tracks as track where track.id = v_owner);
    when 'exports' then
      return not p_write and (private.owns_shopper(v_owner) or private.can(v_owner,'billing.manage'));
    else return false;
  end case;
end;
$$;
comment on function private.storage_access(text,text,boolean) is 'Checks existing version, organisation, supplier, track or profile ownership for private reads and client writes; exports are backend-write-only and brand writes require unrestricted managers.';

-- Trusted SQL maintenance for shopper retention and expired lifecycle records.
create function private.expire_lists()
returns bigint language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_changed bigint;
begin
  update public.lists as list set status = 'expired'
    where list.status = 'open' and list.valid_until < (now() at time zone 'UTC')::date;
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;
comment on function private.expire_lists() is 'Expires open lists before today in UTC, preserving redeemed lists and the inclusive validity date; returns rows changed.';

create function private.expire_invitations()
returns bigint language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_changed bigint;
begin
  update public.invitations as invitation set revoked_at = now()
    where invitation.expires_at <= now() and invitation.accepted_at is null and invitation.revoked_at is null;
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;
comment on function private.expire_invitations() is 'Revokes expired unaccepted invitations at transaction time, preserving accepted or previously revoked invitations; returns rows changed.';

-- History foreign keys deliberately retain identities, even when they have no lists.
create function private.profile_has_retained_references(p_profile uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_reference record;
  v_exists boolean;
begin
  for v_reference in
    select constraint_row.conrelid::regclass as relation, attribute.attname as column_name
    from pg_catalog.pg_constraint as constraint_row
    join pg_catalog.pg_attribute as attribute on attribute.attrelid = constraint_row.conrelid
      and attribute.attnum = constraint_row.conkey[1]
    where constraint_row.contype = 'f' and constraint_row.confrelid = 'public.profiles'::regclass
      and constraint_row.confdeltype in ('a','r') and cardinality(constraint_row.conkey) = 1
  loop
    execute format('select exists (select from %s where %I = $1)',v_reference.relation,v_reference.column_name)
      into v_exists using p_profile;
    if v_exists then return true; end if;
  end loop;
  return false;
end;
$$;
comment on function private.profile_has_retained_references(uuid) is 'Checks non-cascading single-column profile foreign keys before anonymous cleanup, preserving history and privacy requests.';

create function private.purge_inactive_anonymous_users()
returns bigint language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  -- Anonymous inactivity retention is 30 days from the storage and schedule contract.
  v_inactivity_retention constant interval := interval '30 days';
  v_changed bigint;
begin
  delete from auth.users as account using public.profiles as profile
    where account.id = profile.id and account.is_anonymous and profile.is_anonymous
      and greatest(account.created_at,account.last_sign_in_at,profile.created_at,profile.last_seen_at) < now() - v_inactivity_retention
      and not exists (select from public.lists as list where list.shopper_id = account.id)
      and not exists (select from public.follows as follow where follow.shopper_id = account.id)
      and not exists (select from public.staff_roles as staff where staff.profile_id = account.id)
      and not exists (select from public.memberships as member where member.profile_id = account.id)
      and not exists (select from public.supplier_members as member where member.profile_id = account.id)
      and not exists (select from storage.objects as object where object.owner_id = account.id::text
        or (storage.foldername(object.name))[1] = account.id::text)
      and not private.profile_has_retained_references(account.id);
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;
comment on function private.purge_inactive_anonymous_users() is 'Deletes anonymous Auth accounts inactive for over 30 wall-clock days with no lists, follows, assets, privileged memberships or retained references; cascades disposable sessions and returns accounts deleted.';
