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
