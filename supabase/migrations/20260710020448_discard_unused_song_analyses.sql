-- Atomically discard an upload-scoped analysis that has not been attached to
-- a show. The row lock serialises cleanup with the analyser's final status
-- write and with foreign-key checks from concurrent show creation.
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
  if v_user_id is null then
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

revoke execute on function public.discard_unused_song_analysis(uuid, text)
  from public, anon;
grant execute on function public.discard_unused_song_analysis(uuid, text)
  to authenticated;
