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
