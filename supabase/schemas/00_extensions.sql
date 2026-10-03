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
