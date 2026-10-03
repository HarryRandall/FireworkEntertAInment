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
