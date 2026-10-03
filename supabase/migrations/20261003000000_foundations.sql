-- Local database foundations: extensions and shared private helpers.

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
