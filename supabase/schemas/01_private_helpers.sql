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
