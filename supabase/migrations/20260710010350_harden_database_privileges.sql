-- Harden Data API privileges and keep unrestricted AI-credit helpers outside
-- the exposed public schema. Public RPCs keep their existing signatures so the
-- application contract does not change.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

-- Supabase projects created with the older defaults explicitly granted table
-- and function privileges to API roles. Make future objects least-privilege as
-- well as repairing the objects that already exist below.
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on tables from authenticated;
alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated, service_role;

create or replace function private.ai_credit_usage_payload(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
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

create or replace function private.ensure_ai_credit_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.ai_credit_accounts%rowtype;
  v_grant_amount integer := 150;
  v_grant_key text;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'Missing user id.');
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

  return private.ai_credit_usage_payload(p_user_id);
end;
$$;

revoke execute on function private.ai_credit_usage_payload(uuid)
  from public, anon, authenticated, service_role;
revoke execute on function private.ensure_ai_credit_account(uuid)
  from public, anon, authenticated, service_role;

-- Safe public wrappers: a signed-in user may access only their own account,
-- while billing admins may act for another user.
create or replace function public.ai_credit_usage_payload(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or (
      auth.uid() <> p_user_id
      and not public.current_user_has_permission('admin.manage_billing')
    ) then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;

  return private.ai_credit_usage_payload(p_user_id);
end;
$$;

create or replace function public.ensure_ai_credit_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or (
      auth.uid() <> p_user_id
      and not public.current_user_has_permission('admin.manage_billing')
    ) then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;

  return private.ensure_ai_credit_account(p_user_id);
end;
$$;

-- Signup runs without relying on a user JWT. Keep that path private rather
-- than weakening the public account wrapper.
create or replace function private.ensure_ai_credit_account_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.ensure_ai_credit_account(new.id);
  return new;
end;
$$;

revoke execute on function private.ensure_ai_credit_account_for_user()
  from public, anon, authenticated, service_role;

drop trigger if exists users_ai_credit_account on public.users;
create trigger users_ai_credit_account
  after insert on public.users
  for each row execute function private.ensure_ai_credit_account_for_user();

drop function if exists public.ensure_ai_credit_account_for_user();

-- Choose the bootstrap role before inserting it. The previous trigger inserted
-- `user` first, so the one-role-per-user index silently rejected `admin`.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_role_id uuid;
  assigned_role_key text;
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  assigned_role_key := case
    when lower(coalesce(new.email, '')) = 'randallhazza@gmail.com' then 'admin'
    else 'user'
  end;

  select id into assigned_role_id
  from public.roles
  where key = assigned_role_key;

  if assigned_role_id is null then
    raise exception 'Required signup role % does not exist.', assigned_role_key;
  end if;

  insert into public.user_roles (user_id, role_id)
  values (new.id, assigned_role_id)
  on conflict (user_id) do update
  set role_id = excluded.role_id;

  return new;
end;
$$;

-- Repair the bootstrap account too if it was ever inserted after the one-role
-- constraint was introduced.
insert into public.user_roles (user_id, role_id)
select app_user.id, admin_role.id
from public.users app_user
cross join public.roles admin_role
where lower(coalesce(app_user.email, '')) = 'randallhazza@gmail.com'
  and admin_role.key = 'admin'
on conflict (user_id) do update
set role_id = excluded.role_id;

-- Storage policies must consult the current application user row rather than
-- trusting a still-valid JWT after an account is suspended or deleted.
create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users app_user
    where app_user.id = (select auth.uid())
      and app_user.status = 'active'
  );
$$;

revoke execute on function public.current_user_is_active()
  from public, anon;

-- Remove broad historical Data API grants. Anonymous access is deliberately
-- limited to public browse data; the effect table is required by nested
-- catalogue/replay queries.
revoke all privileges on all tables in schema public from anon;
grant select on table
  public.show_presets,
  public.catalogue_items,
  public.fireworks,
  public.firework_effects,
  public.multishots,
  public.multishot_fireworks
to anon;

revoke all privileges on all tables in schema public from authenticated;

grant select on table
  public.ai_credit_accounts,
  public.ai_credit_costs,
  public.ai_credit_transactions,
  public.permissions,
  public.roles,
  public.supplier_inventory_items
to authenticated;

grant select, update on table
  public.prompt_configs,
  public.users
to authenticated;

grant select, insert on table
  public.firework_editor_versions,
  public.import_outputs,
  public.media_assets
to authenticated;

grant select, insert, update on table
  public.catalogue_items,
  public.firework_effects,
  public.firework_style_defaults,
  public.fireworks,
  public.generation_settings,
  public.multishots,
  public.show_generation_runs,
  public.show_presets,
  public.song_analyses,
  public.user_roles
to authenticated;

grant select, insert, delete on table
  public.show_timeline_items
to authenticated;

grant select, insert, update, delete on table
  public.import_jobs,
  public.multishot_fireworks,
  public.role_permissions,
  public.shows,
  public.supplier_profiles,
  public.user_permission_overrides
to authenticated;

grant all privileges on all tables in schema public to service_role;
grant usage on schema public to anon, authenticated, service_role;

-- The delete guard only inspects OLD, so it does not need a mutable lookup
-- path. Public cover objects remain readable through the public bucket URL.
alter function public.block_linked_catalogue_item_delete() set search_path = '';

drop policy if exists audio_read_own on storage.objects;
create policy audio_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'audio'
    and (select public.current_user_is_active())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists audio_insert_own on storage.objects;
create policy audio_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'audio'
    and (select public.current_user_is_active())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists audio_update_own on storage.objects;
create policy audio_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'audio'
    and (select public.current_user_is_active())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'audio'
    and (select public.current_user_is_active())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists audio_delete_own on storage.objects;
create policy audio_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'audio'
    and (select public.current_user_is_active())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists covers_select_anyone on storage.objects;
drop policy if exists covers_select_own on storage.objects;
create policy covers_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'covers'
    and (select public.current_user_is_active())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists covers_insert_own on storage.objects;
create policy covers_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'covers'
    and (select public.current_user_is_active())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists covers_update_own on storage.objects;
create policy covers_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'covers'
    and (select public.current_user_is_active())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'covers'
    and (select public.current_user_is_active())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists covers_delete_own on storage.objects;
create policy covers_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'covers'
    and (select public.current_user_is_active())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Public browse policies are role-specific so anonymous reads never evaluate
-- privileged helper functions.
drop policy if exists show_presets_read_published_or_admin on public.show_presets;
drop policy if exists show_presets_read_published_anon on public.show_presets;
create policy show_presets_read_published_anon on public.show_presets
  for select to anon
  using (is_published);
create policy show_presets_read_published_or_admin on public.show_presets
  for select to authenticated
  using (
    is_published
    or (select public.current_user_has_permission('admin.manage_catalogue'))
  );

drop policy if exists show_presets_admin_modify on public.show_presets;
drop policy if exists show_presets_admin_insert on public.show_presets;
drop policy if exists show_presets_admin_update on public.show_presets;
drop policy if exists show_presets_admin_delete on public.show_presets;
create policy show_presets_admin_insert on public.show_presets
  for insert to authenticated
  with check ((select public.current_user_has_permission('admin.manage_catalogue')));
create policy show_presets_admin_update on public.show_presets
  for update to authenticated
  using ((select public.current_user_has_permission('admin.manage_catalogue')))
  with check ((select public.current_user_has_permission('admin.manage_catalogue')));
create policy show_presets_admin_delete on public.show_presets
  for delete to authenticated
  using ((select public.current_user_has_permission('admin.manage_catalogue')));

drop policy if exists catalogue_items_select_anyone on public.catalogue_items;
create policy catalogue_items_select_anyone on public.catalogue_items
  for select to anon, authenticated
  using (true);
drop policy if exists catalogue_items_admin_modify on public.catalogue_items;
drop policy if exists catalogue_items_admin_insert on public.catalogue_items;
drop policy if exists catalogue_items_admin_update on public.catalogue_items;
drop policy if exists catalogue_items_admin_delete on public.catalogue_items;
create policy catalogue_items_admin_insert on public.catalogue_items
  for insert to authenticated
  with check ((select public.current_user_has_permission('admin.manage_catalogue')));
create policy catalogue_items_admin_update on public.catalogue_items
  for update to authenticated
  using ((select public.current_user_has_permission('admin.manage_catalogue')))
  with check ((select public.current_user_has_permission('admin.manage_catalogue')));
create policy catalogue_items_admin_delete on public.catalogue_items
  for delete to authenticated
  using ((select public.current_user_has_permission('admin.manage_catalogue')));

drop policy if exists fireworks_select_anyone on public.fireworks;
create policy fireworks_select_anyone on public.fireworks
  for select to anon, authenticated
  using (true);
drop policy if exists fireworks_admin_modify on public.fireworks;
drop policy if exists fireworks_admin_insert on public.fireworks;
drop policy if exists fireworks_admin_update on public.fireworks;
drop policy if exists fireworks_admin_delete on public.fireworks;
create policy fireworks_admin_insert on public.fireworks
  for insert to authenticated
  with check ((select public.current_user_has_permission('admin.manage_catalogue')));
create policy fireworks_admin_update on public.fireworks
  for update to authenticated
  using ((select public.current_user_has_permission('admin.manage_catalogue')))
  with check ((select public.current_user_has_permission('admin.manage_catalogue')));
create policy fireworks_admin_delete on public.fireworks
  for delete to authenticated
  using ((select public.current_user_has_permission('admin.manage_catalogue')));

drop policy if exists firework_effects_select_authenticated on public.firework_effects;
drop policy if exists firework_effects_select_anyone on public.firework_effects;
create policy firework_effects_select_anyone on public.firework_effects
  for select to anon, authenticated
  using (true);
drop policy if exists firework_effects_admin_modify on public.firework_effects;
drop policy if exists firework_effects_admin_insert on public.firework_effects;
drop policy if exists firework_effects_admin_update on public.firework_effects;
drop policy if exists firework_effects_admin_delete on public.firework_effects;
create policy firework_effects_admin_insert on public.firework_effects
  for insert to authenticated
  with check ((select public.current_user_has_permission('admin.manage_catalogue')));
create policy firework_effects_admin_update on public.firework_effects
  for update to authenticated
  using ((select public.current_user_has_permission('admin.manage_catalogue')))
  with check ((select public.current_user_has_permission('admin.manage_catalogue')));
create policy firework_effects_admin_delete on public.firework_effects
  for delete to authenticated
  using ((select public.current_user_has_permission('admin.manage_catalogue')));

drop policy if exists multishots_select_anyone on public.multishots;
create policy multishots_select_anyone on public.multishots
  for select to anon, authenticated
  using (true);
drop policy if exists multishots_admin_modify on public.multishots;
drop policy if exists multishots_admin_insert on public.multishots;
drop policy if exists multishots_admin_update on public.multishots;
drop policy if exists multishots_admin_delete on public.multishots;
create policy multishots_admin_insert on public.multishots
  for insert to authenticated
  with check ((select public.current_user_has_permission('admin.manage_catalogue')));
create policy multishots_admin_update on public.multishots
  for update to authenticated
  using ((select public.current_user_has_permission('admin.manage_catalogue')))
  with check ((select public.current_user_has_permission('admin.manage_catalogue')));
create policy multishots_admin_delete on public.multishots
  for delete to authenticated
  using ((select public.current_user_has_permission('admin.manage_catalogue')));

drop policy if exists multishot_fireworks_select_anyone on public.multishot_fireworks;
create policy multishot_fireworks_select_anyone on public.multishot_fireworks
  for select to anon, authenticated
  using (true);
drop policy if exists multishot_fireworks_admin_modify on public.multishot_fireworks;
drop policy if exists multishot_fireworks_admin_insert on public.multishot_fireworks;
drop policy if exists multishot_fireworks_admin_update on public.multishot_fireworks;
drop policy if exists multishot_fireworks_admin_delete on public.multishot_fireworks;
create policy multishot_fireworks_admin_insert on public.multishot_fireworks
  for insert to authenticated
  with check ((select public.current_user_has_permission('admin.manage_catalogue')));
create policy multishot_fireworks_admin_update on public.multishot_fireworks
  for update to authenticated
  using ((select public.current_user_has_permission('admin.manage_catalogue')))
  with check ((select public.current_user_has_permission('admin.manage_catalogue')));
create policy multishot_fireworks_admin_delete on public.multishot_fireworks
  for delete to authenticated
  using ((select public.current_user_has_permission('admin.manage_catalogue')));

-- Cache the authenticated user ID once per statement on the core show flow.
-- Splitting the old timeline FOR ALL policy also stops it overlapping SELECT.
drop policy if exists shows_select_own on public.shows;
create policy shows_select_own on public.shows
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists shows_insert_own on public.shows;
create policy shows_insert_own on public.shows
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists shows_update_own on public.shows;
create policy shows_update_own on public.shows
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists shows_delete_own on public.shows;
create policy shows_delete_own on public.shows
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists song_analyses_select_own on public.song_analyses;
create policy song_analyses_select_own on public.song_analyses
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists song_analyses_insert_own on public.song_analyses;
create policy song_analyses_insert_own on public.song_analyses
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists song_analyses_update_own on public.song_analyses;
create policy song_analyses_update_own on public.song_analyses
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists song_analyses_delete_own on public.song_analyses;
create policy song_analyses_delete_own on public.song_analyses
  for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists show_generation_runs_select_own on public.show_generation_runs;
create policy show_generation_runs_select_own on public.show_generation_runs
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.shows show_row
      where show_row.id = show_generation_runs.show_id
        and show_row.user_id = (select auth.uid())
    )
  );

drop policy if exists show_generation_runs_insert_own on public.show_generation_runs;
create policy show_generation_runs_insert_own on public.show_generation_runs
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
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
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.shows show_row
      where show_row.id = show_generation_runs.show_id
        and show_row.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) is not null
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
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.shows show_row
      where show_row.id = show_generation_runs.show_id
        and show_row.user_id = (select auth.uid())
    )
  );

drop policy if exists show_timeline_items_select_via_show on public.show_timeline_items;
create policy show_timeline_items_select_via_show on public.show_timeline_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.shows show_row
      where show_row.id = show_timeline_items.show_id
        and show_row.user_id = (select auth.uid())
    )
  );

drop policy if exists show_timeline_items_modify_via_show on public.show_timeline_items;
drop policy if exists show_timeline_items_insert_via_show on public.show_timeline_items;
drop policy if exists show_timeline_items_update_via_show on public.show_timeline_items;
drop policy if exists show_timeline_items_delete_via_show on public.show_timeline_items;
create policy show_timeline_items_insert_via_show on public.show_timeline_items
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.shows show_row
      where show_row.id = show_timeline_items.show_id
        and show_row.user_id = (select auth.uid())
    )
  );
create policy show_timeline_items_update_via_show on public.show_timeline_items
  for update to authenticated
  using (
    exists (
      select 1
      from public.shows show_row
      where show_row.id = show_timeline_items.show_id
        and show_row.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.shows show_row
      where show_row.id = show_timeline_items.show_id
        and show_row.user_id = (select auth.uid())
    )
  );
create policy show_timeline_items_delete_via_show on public.show_timeline_items
  for delete to authenticated
  using (
    exists (
      select 1
      from public.shows show_row
      where show_row.id = show_timeline_items.show_id
        and show_row.user_id = (select auth.uid())
    )
  );

-- Import storage policies also use the permission helper, so exclude anon from
-- them before removing anonymous function execution.
drop policy if exists import_videos_admin_read on storage.objects;
create policy import_videos_admin_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'import-videos'
    and (select public.current_user_has_permission('admin.manage_imports'))
  );

drop policy if exists import_videos_admin_insert on storage.objects;
create policy import_videos_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'import-videos'
    and (select public.current_user_has_permission('admin.manage_imports'))
  );

drop policy if exists import_videos_admin_update on storage.objects;
create policy import_videos_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'import-videos'
    and (select public.current_user_has_permission('admin.manage_imports'))
  )
  with check (
    bucket_id = 'import-videos'
    and (select public.current_user_has_permission('admin.manage_imports'))
  );

drop policy if exists import_videos_admin_delete on storage.objects;
create policy import_videos_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'import-videos'
    and (select public.current_user_has_permission('admin.manage_imports'))
  );

-- Start from no executable public functions, then grant only the intended API.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.current_user_access() to authenticated;
grant execute on function public.current_user_has_permission(text) to authenticated;
grant execute on function public.current_user_is_active() to authenticated;
grant execute on function public.ai_credit_usage_payload(uuid) to authenticated;
grant execute on function public.ensure_ai_credit_account(uuid) to authenticated;
grant execute on function public.reserve_ai_credits(uuid, text, integer, text, uuid, text, jsonb)
  to authenticated;
grant execute on function public.settle_ai_credit_reservation(uuid, text, text, jsonb)
  to authenticated;
grant execute on function public.refund_ai_credit_reservation(uuid, text, text, jsonb)
  to authenticated;
grant execute on function public.grant_ai_credits(uuid, integer, text, text)
  to authenticated;
grant execute on function public.replace_show_timeline_items(uuid, uuid, jsonb)
  to authenticated;

grant execute on all functions in schema public to service_role;
