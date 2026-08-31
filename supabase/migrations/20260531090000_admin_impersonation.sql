-- Audited admin impersonation sessions.

insert into public.permissions (key, name, description, category)
values (
  'admin.impersonate_users',
  'Impersonate users',
  'Start audited support sessions as active users.',
  'admin'
)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    updated_at = now();

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'admin'
  and p.key = 'admin.impersonate_users'
on conflict do nothing;

create table if not exists public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  return_token_hash text not null unique,
  user_agent text,
  ip_address text,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  ended_at timestamptz,
  end_reason text check (end_reason in ('stopped', 'expired', 'sign_out', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (admin_user_id <> target_user_id),
  check (ended_at is null or ended_at >= started_at)
);

create index if not exists impersonation_sessions_admin_started_idx
  on public.impersonation_sessions (admin_user_id, started_at desc);

create index if not exists impersonation_sessions_target_started_idx
  on public.impersonation_sessions (target_user_id, started_at desc);

create index if not exists impersonation_sessions_active_token_idx
  on public.impersonation_sessions (return_token_hash)
  where ended_at is null;

alter table public.impersonation_sessions enable row level security;

drop policy if exists "impersonation_sessions_admin_select" on public.impersonation_sessions;
create policy "impersonation_sessions_admin_select" on public.impersonation_sessions
  for select using (public.current_user_has_permission('admin.impersonate_users'));

grant select on public.impersonation_sessions to authenticated;

drop trigger if exists impersonation_sessions_set_updated_at on public.impersonation_sessions;
create trigger impersonation_sessions_set_updated_at
  before update on public.impersonation_sessions
  for each row execute function public.set_updated_at();
