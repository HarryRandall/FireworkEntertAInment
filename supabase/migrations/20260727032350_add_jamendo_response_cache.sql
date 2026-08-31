-- Durable cache of Jamendo search and browse responses.
--
-- Popular tracks and query results change slowly, so persisting them lets the
-- server serve repeat queries from Postgres instead of spending the shared
-- Jamendo API allowance on every request. Rows are global, provider-derived
-- content keyed by a normalised query; they are never user data.

create table if not exists public.jamendo_response_cache (
  cache_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists jamendo_response_cache_expires_at_idx
  on public.jamendo_response_cache (expires_at);

comment on table public.jamendo_response_cache is
  'Durable server-side cache of Jamendo search/browse responses keyed by normalised query. Service-role only; not user data.';

-- Read and written exclusively by trusted server code through the service role,
-- which bypasses RLS. No table privileges are granted to anon or authenticated,
-- and this belt-and-braces policy denies all row access to those roles even if a
-- privilege is granted by mistake, so the table fails closed.
alter table public.jamendo_response_cache enable row level security;

drop policy if exists jamendo_response_cache_no_client_access on public.jamendo_response_cache;
create policy jamendo_response_cache_no_client_access
  on public.jamendo_response_cache
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on public.jamendo_response_cache from anon, authenticated;
