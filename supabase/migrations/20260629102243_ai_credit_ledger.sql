-- AI credit wallet ledger for cost-bearing generation work.

create table if not exists public.ai_credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0,
  reserved integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_credit_accounts_balance_check check (balance >= 0),
  constraint ai_credit_accounts_reserved_check check (reserved >= 0),
  constraint ai_credit_accounts_reserved_balance_check check (reserved <= balance)
);

create table if not exists public.ai_credit_costs (
  key text primary key,
  name text not null,
  description text,
  amount integer not null,
  is_billable boolean not null default true,
  sort_order integer not null default 0,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_credit_costs_amount_check check (amount >= 0),
  constraint ai_credit_costs_key_check check (
    key in (
      'music_analysis',
      'show_generation_fast',
      'show_generation_gpt4o',
      'show_generation_sonnet',
      'show_generation_opus',
      'show_refinement',
      'import_video_reconstruction',
      'import_video_refinement'
    )
  )
);

create table if not exists public.ai_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null,
  status text not null default 'applied',
  action_key text not null,
  amount integer not null default 0,
  balance_after integer,
  reserved_after integer,
  reference_type text,
  reference_id uuid,
  idempotency_key text unique,
  related_transaction_id uuid references public.ai_credit_transactions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ai_credit_transactions_amount_check check (amount >= 0),
  constraint ai_credit_transactions_type_check check (
    transaction_type in ('grant', 'reserve', 'debit', 'refund')
  ),
  constraint ai_credit_transactions_status_check check (
    status in ('applied', 'reserved', 'settled', 'refunded')
  )
);

create index if not exists ai_credit_transactions_user_created_idx
  on public.ai_credit_transactions (user_id, created_at desc);
create index if not exists ai_credit_transactions_user_type_created_idx
  on public.ai_credit_transactions (user_id, transaction_type, created_at desc);
create index if not exists ai_credit_transactions_reference_idx
  on public.ai_credit_transactions (reference_type, reference_id)
  where reference_type is not null and reference_id is not null;
create index if not exists ai_credit_transactions_related_idx
  on public.ai_credit_transactions (related_transaction_id)
  where related_transaction_id is not null;

alter table public.ai_credit_accounts enable row level security;
alter table public.ai_credit_costs enable row level security;
alter table public.ai_credit_transactions enable row level security;

drop policy if exists ai_credit_accounts_select_own_or_billing_admin
  on public.ai_credit_accounts;
create policy ai_credit_accounts_select_own_or_billing_admin
  on public.ai_credit_accounts
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.current_user_has_permission('admin.manage_billing')
  );

drop policy if exists ai_credit_costs_select_authenticated on public.ai_credit_costs;
create policy ai_credit_costs_select_authenticated
  on public.ai_credit_costs
  for select
  to authenticated
  using (true);

drop policy if exists ai_credit_costs_manage_billing_admin on public.ai_credit_costs;
create policy ai_credit_costs_manage_billing_admin
  on public.ai_credit_costs
  for all
  to authenticated
  using (public.current_user_has_permission('admin.manage_billing'))
  with check (public.current_user_has_permission('admin.manage_billing'));

drop policy if exists ai_credit_transactions_select_own_or_billing_admin
  on public.ai_credit_transactions;
create policy ai_credit_transactions_select_own_or_billing_admin
  on public.ai_credit_transactions
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.current_user_has_permission('admin.manage_billing')
  );

drop trigger if exists ai_credit_accounts_set_updated_at on public.ai_credit_accounts;
create trigger ai_credit_accounts_set_updated_at
  before update on public.ai_credit_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists ai_credit_costs_set_updated_at on public.ai_credit_costs;
create trigger ai_credit_costs_set_updated_at
  before update on public.ai_credit_costs
  for each row execute function public.set_updated_at();

insert into public.permissions (key, name, description, category)
values
  (
    'admin.manage_billing',
    'Manage AI credits',
    'View AI credit balances, recent spend, and grant user credits.',
    'admin'
  )
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'admin.manage_billing'
where r.key = 'admin'
on conflict do nothing;

insert into public.ai_credit_costs (key, name, description, amount, sort_order)
values
  (
    'music_analysis',
    'Music analysis',
    'Upload-scoped soundtrack analysis that prepares beat and structure data.',
    1,
    10
  ),
  (
    'show_generation_fast',
    'Fast show generation',
    'Default deterministic cue planning for a show.',
    1,
    20
  ),
  (
    'show_generation_gpt4o',
    'GPT-4o show generation',
    'Lower-cost OpenAI cue planning through OpenRouter.',
    1,
    30
  ),
  (
    'show_generation_sonnet',
    'Claude Sonnet show generation',
    'Premium balanced cue planning through OpenRouter.',
    3,
    40
  ),
  (
    'show_generation_opus',
    'Claude Opus 4 show generation',
    'Highest-cost reasoning model cue planning through OpenRouter.',
    5,
    50
  ),
  (
    'show_refinement',
    'Show refinement',
    'Prompted changes to an existing show timeline.',
    2,
    60
  ),
  (
    'import_video_reconstruction',
    'Import video reconstruction',
    'Admin OpenRouter reconstruction of uploaded firework product video.',
    25,
    70
  ),
  (
    'import_video_refinement',
    'Import video refinement',
    'Admin prompted reconstruction pass for an import job.',
    15,
    80
  )
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    amount = excluded.amount,
    sort_order = excluded.sort_order;

create or replace function public.ai_credit_usage_payload(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_account public.ai_credit_accounts%rowtype;
  v_hourly_limit integer := 20;
  v_weekly_limit integer := 150;
  v_hourly_used integer := 0;
  v_weekly_used integer := 0;
  v_hourly_remaining integer := 0;
  v_weekly_remaining integer := 0;
  v_total_granted integer := 0;
  v_total_spent integer := 0;
  v_wallet_available integer := 0;
begin
  select * into v_account
  from public.ai_credit_accounts
  where user_id = p_user_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'AI credit account was not found.');
  end if;

  select coalesce(sum(amount), 0)::integer into v_total_granted
  from public.ai_credit_transactions
  where user_id = p_user_id
    and transaction_type = 'grant'
    and status = 'applied';

  select coalesce(sum(amount), 0)::integer into v_total_spent
  from public.ai_credit_transactions
  where user_id = p_user_id
    and transaction_type = 'debit'
    and status = 'applied';

  select coalesce(sum(amount), 0)::integer into v_hourly_used
  from public.ai_credit_transactions
  where user_id = p_user_id
    and transaction_type = 'debit'
    and status = 'applied'
    and created_at >= date_trunc('hour', now());

  select coalesce(sum(amount), 0)::integer into v_weekly_used
  from public.ai_credit_transactions
  where user_id = p_user_id
    and transaction_type = 'debit'
    and status = 'applied'
    and created_at >= date_trunc('week', now());

  v_wallet_available := greatest(v_account.balance - v_account.reserved, 0);
  v_hourly_remaining := greatest(v_hourly_limit - v_hourly_used - v_account.reserved, 0);
  v_weekly_remaining := greatest(v_weekly_limit - v_weekly_used - v_account.reserved, 0);

  return jsonb_build_object(
    'ok', true,
    'balance', v_account.balance,
    'reserved', v_account.reserved,
    'available', least(v_wallet_available, v_hourly_remaining, v_weekly_remaining),
    'includedCredits', 150,
    'hourlyLimit', v_hourly_limit,
    'weeklyLimit', v_weekly_limit,
    'hourlyUsed', v_hourly_used,
    'weeklyUsed', v_weekly_used,
    'hourlyRemaining', v_hourly_remaining,
    'weeklyRemaining', v_weekly_remaining,
    'hourlyResetAt', date_trunc('hour', now()) + interval '1 hour',
    'weeklyResetAt', date_trunc('week', now()) + interval '1 week',
    'totalGranted', v_total_granted,
    'totalSpent', v_total_spent
  );
end;
$$;

create or replace function public.ensure_ai_credit_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_account public.ai_credit_accounts%rowtype;
  v_grant_amount integer := 150;
  v_grant_key text;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'Missing user id.');
  end if;

  if auth.uid() is not null
    and auth.uid() <> p_user_id
    and not public.current_user_has_permission('admin.manage_billing') then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ai-credit-account:' || p_user_id::text, 0));

  insert into public.ai_credit_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  v_grant_key := 'default-preview-credit-grant:' || p_user_id::text;

  if not exists (
    select 1
    from public.ai_credit_transactions
    where idempotency_key = v_grant_key
  ) then
    update public.ai_credit_accounts
    set balance = balance + v_grant_amount
    where user_id = p_user_id
    returning * into v_account;

    insert into public.ai_credit_transactions (
      user_id,
      transaction_type,
      status,
      action_key,
      amount,
      balance_after,
      reserved_after,
      idempotency_key,
      metadata,
      created_by
    )
    values (
      p_user_id,
      'grant',
      'applied',
      'default_preview_grant',
      v_grant_amount,
      v_account.balance,
      v_account.reserved,
      v_grant_key,
      jsonb_build_object('reason', 'Default preview credits'),
      auth.uid()
    );
  end if;

  return public.ai_credit_usage_payload(p_user_id);
end;
$$;

create or replace function public.reserve_ai_credits(
  p_user_id uuid,
  p_action_key text,
  p_amount integer,
  p_reference_type text,
  p_reference_id uuid,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_account public.ai_credit_accounts%rowtype;
  v_existing public.ai_credit_transactions%rowtype;
  v_tx public.ai_credit_transactions%rowtype;
  v_usage jsonb;
  v_available integer;
  v_amount integer;
begin
  if auth.uid() is null
    or (auth.uid() <> p_user_id and not public.current_user_has_permission('admin.manage_billing')) then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;

  if coalesce(trim(p_idempotency_key), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Missing idempotency key.');
  end if;

  select amount into v_amount
  from public.ai_credit_costs
  where key = p_action_key;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Unknown AI credit action.');
  end if;

  if v_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Credit amount must be positive.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

  select * into v_existing
  from public.ai_credit_transactions
  where idempotency_key = p_idempotency_key;

  if found then
    v_usage := public.ai_credit_usage_payload(v_existing.user_id);
    return v_usage || jsonb_build_object(
      'transactionId', v_existing.id,
      'alreadyApplied', true
    );
  end if;

  perform public.ensure_ai_credit_account(p_user_id);

  select * into v_account
  from public.ai_credit_accounts
  where user_id = p_user_id
  for update;

  v_usage := public.ai_credit_usage_payload(p_user_id);
  v_available := coalesce((v_usage->>'available')::integer, 0);

  if v_amount > v_available then
    return public.ai_credit_usage_payload(p_user_id) || jsonb_build_object(
      'ok', false,
      'error', format(
        'Not enough AI credits or usage limit remaining. This needs %s credits and %s are available.',
        v_amount,
        v_available
      )
    );
  end if;

  update public.ai_credit_accounts
  set reserved = reserved + v_amount
  where user_id = p_user_id
  returning * into v_account;

  insert into public.ai_credit_transactions (
    user_id,
    transaction_type,
    status,
    action_key,
    amount,
    balance_after,
    reserved_after,
    reference_type,
    reference_id,
    idempotency_key,
    metadata,
    created_by
  )
  values (
    p_user_id,
    'reserve',
    'reserved',
    p_action_key,
    v_amount,
    v_account.balance,
    v_account.reserved,
    p_reference_type,
    p_reference_id,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb),
    auth.uid()
  )
  returning * into v_tx;

  v_usage := public.ai_credit_usage_payload(p_user_id);

  return v_usage || jsonb_build_object(
    'transactionId', v_tx.id,
    'alreadyApplied', false
  );
end;
$$;

create or replace function public.settle_ai_credit_reservation(
  p_user_id uuid,
  p_reservation_key text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_account public.ai_credit_accounts%rowtype;
  v_existing public.ai_credit_transactions%rowtype;
  v_reservation public.ai_credit_transactions%rowtype;
  v_tx public.ai_credit_transactions%rowtype;
  v_usage jsonb;
begin
  if auth.uid() is null
    or (auth.uid() <> p_user_id and not public.current_user_has_permission('admin.manage_billing')) then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;

  if coalesce(trim(p_reservation_key), '') = ''
    or coalesce(trim(p_idempotency_key), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Missing idempotency key.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

  select * into v_existing
  from public.ai_credit_transactions
  where idempotency_key = p_idempotency_key;

  if found then
    v_usage := public.ai_credit_usage_payload(v_existing.user_id);
    return v_usage || jsonb_build_object(
      'transactionId', v_existing.id,
      'alreadyApplied', true
    );
  end if;

  select * into v_reservation
  from public.ai_credit_transactions
  where idempotency_key = p_reservation_key
    and user_id = p_user_id
    and transaction_type = 'reserve'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'AI credit reservation was not found.');
  end if;

  if v_reservation.status = 'settled' then
    v_usage := public.ai_credit_usage_payload(p_user_id);
    return v_usage || jsonb_build_object('ok', true, 'alreadyApplied', true);
  end if;

  if v_reservation.status <> 'reserved' then
    return jsonb_build_object('ok', false, 'error', 'AI credit reservation is not active.');
  end if;

  select * into v_account
  from public.ai_credit_accounts
  where user_id = p_user_id
  for update;

  update public.ai_credit_accounts
  set reserved = reserved - v_reservation.amount,
      balance = balance - v_reservation.amount
  where user_id = p_user_id
    and reserved >= v_reservation.amount
    and balance >= v_reservation.amount
  returning * into v_account;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'AI credit reservation could not be settled.');
  end if;

  update public.ai_credit_transactions
  set status = 'settled',
      balance_after = v_account.balance,
      reserved_after = v_account.reserved
  where id = v_reservation.id;

  insert into public.ai_credit_transactions (
    user_id,
    transaction_type,
    status,
    action_key,
    amount,
    balance_after,
    reserved_after,
    reference_type,
    reference_id,
    idempotency_key,
    related_transaction_id,
    metadata,
    created_by
  )
  values (
    p_user_id,
    'debit',
    'applied',
    v_reservation.action_key,
    v_reservation.amount,
    v_account.balance,
    v_account.reserved,
    v_reservation.reference_type,
    v_reservation.reference_id,
    p_idempotency_key,
    v_reservation.id,
    coalesce(p_metadata, '{}'::jsonb),
    auth.uid()
  )
  returning * into v_tx;

  v_usage := public.ai_credit_usage_payload(p_user_id);

  return v_usage || jsonb_build_object('transactionId', v_tx.id);
end;
$$;

create or replace function public.refund_ai_credit_reservation(
  p_user_id uuid,
  p_reservation_key text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_account public.ai_credit_accounts%rowtype;
  v_existing public.ai_credit_transactions%rowtype;
  v_reservation public.ai_credit_transactions%rowtype;
  v_tx public.ai_credit_transactions%rowtype;
  v_usage jsonb;
begin
  if auth.uid() is null
    or (auth.uid() <> p_user_id and not public.current_user_has_permission('admin.manage_billing')) then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;

  if coalesce(trim(p_reservation_key), '') = ''
    or coalesce(trim(p_idempotency_key), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Missing idempotency key.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

  select * into v_existing
  from public.ai_credit_transactions
  where idempotency_key = p_idempotency_key;

  if found then
    v_usage := public.ai_credit_usage_payload(v_existing.user_id);
    return v_usage || jsonb_build_object(
      'transactionId', v_existing.id,
      'alreadyApplied', true
    );
  end if;

  select * into v_reservation
  from public.ai_credit_transactions
  where idempotency_key = p_reservation_key
    and user_id = p_user_id
    and transaction_type = 'reserve'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'AI credit reservation was not found.');
  end if;

  if v_reservation.status = 'refunded' then
    v_usage := public.ai_credit_usage_payload(p_user_id);
    return v_usage || jsonb_build_object('ok', true, 'alreadyApplied', true);
  end if;

  if v_reservation.status <> 'reserved' then
    return jsonb_build_object('ok', false, 'error', 'AI credit reservation is not active.');
  end if;

  select * into v_account
  from public.ai_credit_accounts
  where user_id = p_user_id
  for update;

  update public.ai_credit_accounts
  set reserved = reserved - v_reservation.amount
  where user_id = p_user_id
    and reserved >= v_reservation.amount
  returning * into v_account;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'AI credit reservation could not be refunded.');
  end if;

  update public.ai_credit_transactions
  set status = 'refunded',
      balance_after = v_account.balance,
      reserved_after = v_account.reserved
  where id = v_reservation.id;

  insert into public.ai_credit_transactions (
    user_id,
    transaction_type,
    status,
    action_key,
    amount,
    balance_after,
    reserved_after,
    reference_type,
    reference_id,
    idempotency_key,
    related_transaction_id,
    metadata,
    created_by
  )
  values (
    p_user_id,
    'refund',
    'applied',
    v_reservation.action_key,
    v_reservation.amount,
    v_account.balance,
    v_account.reserved,
    v_reservation.reference_type,
    v_reservation.reference_id,
    p_idempotency_key,
    v_reservation.id,
    coalesce(p_metadata, '{}'::jsonb),
    auth.uid()
  )
  returning * into v_tx;

  v_usage := public.ai_credit_usage_payload(p_user_id);

  return v_usage || jsonb_build_object('transactionId', v_tx.id);
end;
$$;

create or replace function public.grant_ai_credits(
  p_user_id uuid,
  p_amount integer,
  p_note text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_account public.ai_credit_accounts%rowtype;
  v_existing public.ai_credit_transactions%rowtype;
  v_tx public.ai_credit_transactions%rowtype;
  v_usage jsonb;
begin
  if not public.current_user_has_permission('admin.manage_billing') then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;

  if p_amount is null or p_amount < 1 or p_amount > 100000 then
    return jsonb_build_object('ok', false, 'error', 'Grant amount must be between 1 and 100000.');
  end if;

  if coalesce(trim(p_idempotency_key), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Missing idempotency key.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

  select * into v_existing
  from public.ai_credit_transactions
  where idempotency_key = p_idempotency_key;

  if found then
    v_usage := public.ai_credit_usage_payload(v_existing.user_id);
    return v_usage || jsonb_build_object(
      'transactionId', v_existing.id,
      'alreadyApplied', true
    );
  end if;

  perform public.ensure_ai_credit_account(p_user_id);

  select * into v_account
  from public.ai_credit_accounts
  where user_id = p_user_id
  for update;

  update public.ai_credit_accounts
  set balance = balance + p_amount
  where user_id = p_user_id
  returning * into v_account;

  insert into public.ai_credit_transactions (
    user_id,
    transaction_type,
    status,
    action_key,
    amount,
    balance_after,
    reserved_after,
    idempotency_key,
    metadata,
    created_by
  )
  values (
    p_user_id,
    'grant',
    'applied',
    'admin_credit_grant',
    p_amount,
    v_account.balance,
    v_account.reserved,
    p_idempotency_key,
    jsonb_build_object('note', nullif(trim(coalesce(p_note, '')), '')),
    auth.uid()
  )
  returning * into v_tx;

  v_usage := public.ai_credit_usage_payload(p_user_id);

  return v_usage || jsonb_build_object('transactionId', v_tx.id);
end;
$$;

create or replace function public.ensure_ai_credit_account_for_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.ensure_ai_credit_account(new.id);
  return new;
end;
$$;

drop trigger if exists users_ai_credit_account on public.users;
create trigger users_ai_credit_account
  after insert on public.users
  for each row execute function public.ensure_ai_credit_account_for_user();

select public.ensure_ai_credit_account(id)
from public.users;

revoke execute on function public.ai_credit_usage_payload(uuid) from public;
revoke execute on function public.ensure_ai_credit_account(uuid) from public;
revoke execute on function public.reserve_ai_credits(
  uuid,
  text,
  integer,
  text,
  uuid,
  text,
  jsonb
) from public;
revoke execute on function public.settle_ai_credit_reservation(uuid, text, text, jsonb) from public;
revoke execute on function public.refund_ai_credit_reservation(uuid, text, text, jsonb) from public;
revoke execute on function public.grant_ai_credits(uuid, integer, text, text) from public;

grant execute on function public.ensure_ai_credit_account(uuid) to authenticated;
grant execute on function public.reserve_ai_credits(
  uuid,
  text,
  integer,
  text,
  uuid,
  text,
  jsonb
) to authenticated;
grant execute on function public.settle_ai_credit_reservation(uuid, text, text, jsonb)
  to authenticated;
grant execute on function public.refund_ai_credit_reservation(uuid, text, text, jsonb)
  to authenticated;
grant execute on function public.grant_ai_credits(uuid, integer, text, text)
  to authenticated;

grant select on public.ai_credit_accounts to authenticated;
grant select on public.ai_credit_costs to authenticated;
grant select on public.ai_credit_transactions to authenticated;
