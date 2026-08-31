-- A stale authenticated JWT must not retain owner write access after the
-- application user is suspended. Reads remain unchanged so this migration is
-- limited to mutation boundaries.

drop policy if exists shows_insert_own on public.shows;
create policy shows_insert_own on public.shows
  for insert to authenticated
  with check (
    (select public.current_user_is_active())
    and (select auth.uid()) = user_id
  );

drop policy if exists shows_update_own on public.shows;
create policy shows_update_own on public.shows
  for update to authenticated
  using (
    (select public.current_user_is_active())
    and (select auth.uid()) = user_id
  )
  with check (
    (select public.current_user_is_active())
    and (select auth.uid()) = user_id
  );

drop policy if exists shows_delete_own on public.shows;
create policy shows_delete_own on public.shows
  for delete to authenticated
  using (
    (select public.current_user_is_active())
    and (select auth.uid()) = user_id
  );

drop policy if exists song_analyses_insert_own on public.song_analyses;
create policy song_analyses_insert_own on public.song_analyses
  for insert to authenticated
  with check (
    (select public.current_user_is_active())
    and user_id = (select auth.uid())
  );

drop policy if exists song_analyses_update_own on public.song_analyses;
create policy song_analyses_update_own on public.song_analyses
  for update to authenticated
  using (
    (select public.current_user_is_active())
    and user_id = (select auth.uid())
  )
  with check (
    (select public.current_user_is_active())
    and user_id = (select auth.uid())
  );

drop policy if exists song_analyses_delete_own on public.song_analyses;
create policy song_analyses_delete_own on public.song_analyses
  for delete to authenticated
  using (
    (select public.current_user_is_active())
    and user_id = (select auth.uid())
  );

drop policy if exists show_generation_runs_insert_own on public.show_generation_runs;
create policy show_generation_runs_insert_own on public.show_generation_runs
  for insert to authenticated
  with check (
    (select public.current_user_is_active())
    and (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.shows show_row
      where show_row.id = show_generation_runs.show_id
        and show_row.user_id = (select auth.uid())
    )
  );

drop policy if exists show_generation_runs_update_own on public.show_generation_runs;
create policy show_generation_runs_update_own on public.show_generation_runs
  for update to authenticated
  using (
    (select public.current_user_is_active())
    and (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.shows show_row
      where show_row.id = show_generation_runs.show_id
        and show_row.user_id = (select auth.uid())
    )
  )
  with check (
    (select public.current_user_is_active())
    and (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.shows show_row
      where show_row.id = show_generation_runs.show_id
        and show_row.user_id = (select auth.uid())
    )
  );

drop policy if exists show_generation_runs_delete_own on public.show_generation_runs;
create policy show_generation_runs_delete_own on public.show_generation_runs
  for delete to authenticated
  using (
    (select public.current_user_is_active())
    and (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.shows show_row
      where show_row.id = show_generation_runs.show_id
        and show_row.user_id = (select auth.uid())
    )
  );

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
set search_path = ''
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
    or not coalesce(public.current_user_is_active(), false)
    or (
      auth.uid() <> p_user_id
      and not public.current_user_has_permission('admin.manage_billing')
    )
  then
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
set search_path = ''
as $$
declare
  v_account public.ai_credit_accounts%rowtype;
  v_existing public.ai_credit_transactions%rowtype;
  v_reservation public.ai_credit_transactions%rowtype;
  v_tx public.ai_credit_transactions%rowtype;
  v_usage jsonb;
begin
  if auth.uid() is null
    or not coalesce(public.current_user_is_active(), false)
    or (
      auth.uid() <> p_user_id
      and not public.current_user_has_permission('admin.manage_billing')
    )
  then
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
set search_path = ''
as $$
declare
  v_account public.ai_credit_accounts%rowtype;
  v_existing public.ai_credit_transactions%rowtype;
  v_reservation public.ai_credit_transactions%rowtype;
  v_tx public.ai_credit_transactions%rowtype;
  v_usage jsonb;
begin
  if auth.uid() is null
    or not coalesce(public.current_user_is_active(), false)
    or (
      auth.uid() <> p_user_id
      and not public.current_user_has_permission('admin.manage_billing')
    )
  then
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

create or replace function public.discard_unused_song_analysis(
  p_analysis_id uuid,
  p_audio_path text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_analysis public.song_analyses%rowtype;
  v_reservation_status text;
  v_credit_result jsonb;
  v_refunded boolean := false;
  v_settled boolean := false;
begin
  if v_user_id is null
    or not coalesce(public.current_user_is_active(), false)
  then
    return jsonb_build_object('ok', false, 'code', 'not_permitted');
  end if;

  if p_analysis_id is null
    or coalesce(trim(p_audio_path), '') = ''
    or p_audio_path not like v_user_id::text || '/%'
    or position('..' in p_audio_path) > 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  select * into v_analysis
  from public.song_analyses
  where id = p_analysis_id
    and user_id = v_user_id
  for update;

  if not found then
    -- The database half of an earlier request may already have succeeded while
    -- its Storage API call failed. Returning the caller-owned path lets the API
    -- retry that final deletion without applying another ledger transaction.
    return jsonb_build_object(
      'ok', true,
      'alreadyDeleted', true,
      'audioPath', p_audio_path,
      'refunded', false,
      'settled', false
    );
  end if;

  if v_analysis.audio_path <> p_audio_path then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  if exists (
    select 1
    from public.shows
    where music_analysis_id = v_analysis.id
  ) then
    return jsonb_build_object('ok', false, 'code', 'in_use');
  end if;

  select status into v_reservation_status
  from public.ai_credit_transactions
  where user_id = v_user_id
    and idempotency_key = 'music-analysis:' || v_analysis.id::text || ':reserve'
    and transaction_type = 'reserve';

  if v_reservation_status = 'reserved' then
    if v_analysis.status = 'completed' then
      -- Completed analyser work is chargeable even if cleanup wins the small
      -- race before the background callback settles its reservation.
      v_credit_result := public.settle_ai_credit_reservation(
        v_user_id,
        'music-analysis:' || v_analysis.id::text || ':reserve',
        'music-analysis:' || v_analysis.id::text || ':reserve:debit',
        jsonb_build_object('reason', 'Discarded after analysis completed')
      );
      v_settled := coalesce((v_credit_result->>'ok')::boolean, false);
      if not v_settled then
        return jsonb_build_object('ok', false, 'code', 'credit_race');
      end if;
    else
      v_credit_result := public.refund_ai_credit_reservation(
        v_user_id,
        'music-analysis:' || v_analysis.id::text || ':reserve',
        'music-analysis:' || v_analysis.id::text || ':reserve:refund',
        jsonb_build_object('reason', 'Unused music analysis discarded')
      );
      v_refunded := coalesce((v_credit_result->>'ok')::boolean, false);
      if not v_refunded then
        return jsonb_build_object('ok', false, 'code', 'credit_race');
      end if;
    end if;
  end if;

  delete from public.song_analyses
  where id = v_analysis.id
    and user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'alreadyDeleted', false,
    'audioPath', v_analysis.audio_path,
    'refunded', v_refunded,
    'settled', v_settled
  );
end;
$$;

comment on function public.discard_unused_song_analysis(uuid, text) is
  'Deletes an owned, unreferenced song analysis and resolves its active credit reservation atomically.';

revoke execute on function public.reserve_ai_credits(
  uuid,
  text,
  integer,
  text,
  uuid,
  text,
  jsonb
) from public, anon, authenticated, service_role;
revoke execute on function public.settle_ai_credit_reservation(uuid, text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.refund_ai_credit_reservation(uuid, text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.discard_unused_song_analysis(uuid, text)
  from public, anon, authenticated, service_role;

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
grant execute on function public.discard_unused_song_analysis(uuid, text)
  to authenticated;
