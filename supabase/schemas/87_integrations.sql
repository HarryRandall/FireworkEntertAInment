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
