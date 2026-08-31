-- Public assortment requests run with the service role but no authenticated
-- user id. Keep the reservation inside the existing private security boundary
-- so the user-facing wrappers do not incorrectly report zero availability.
create or replace function private.reserve_assortment_ai_credit(
  p_user_id uuid,
  p_action_key text,
  p_reference_type text,
  p_reference_id uuid,
  p_idempotency_key text,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_row public.ai_credit_accounts%rowtype;
  existing_row public.ai_credit_transactions%rowtype;
  usage_row jsonb;
  available_credits integer;
  credit_cost integer;
begin
  select cost.amount into credit_cost
  from public.ai_credit_costs cost
  where cost.key = p_action_key;
  if not found or credit_cost <= 0 then
    raise exception 'Unknown or invalid AI credit action.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  select * into existing_row
  from public.ai_credit_transactions transaction_row
  where transaction_row.idempotency_key = p_idempotency_key;
  if found then
    if existing_row.user_id <> p_user_id
      or existing_row.action_key <> p_action_key
      or existing_row.reference_type <> p_reference_type
      or existing_row.reference_id <> p_reference_id
      or existing_row.transaction_type <> 'reserve'
    then
      raise exception 'AI credit idempotency key is already in use.' using errcode = '23505';
    end if;
    return;
  end if;

  perform private.ensure_ai_credit_account(p_user_id);
  select * into account_row
  from public.ai_credit_accounts account
  where account.user_id = p_user_id
  for update;
  if not found then
    raise exception 'Retailer AI credit account was not found.' using errcode = 'P0002';
  end if;

  usage_row := private.ai_credit_usage_payload(p_user_id);
  available_credits := coalesce((usage_row ->> 'available')::integer, 0);
  if credit_cost > available_credits then
    raise exception 'The retailer does not have enough AI credits.' using errcode = 'P0001';
  end if;

  update public.ai_credit_accounts
  set reserved = reserved + credit_cost
  where user_id = p_user_id
  returning * into account_row;

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
  ) values (
    p_user_id,
    'reserve',
    'reserved',
    p_action_key,
    credit_cost,
    account_row.balance,
    account_row.reserved,
    p_reference_type,
    p_reference_id,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb),
    null
  );
end;
$$;

revoke execute on function private.reserve_assortment_ai_credit(
  uuid, text, text, uuid, text, jsonb
) from public, anon, authenticated, service_role;
