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
