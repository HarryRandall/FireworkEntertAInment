-- Application suspension is a live authorisation boundary. A still-valid JWT
-- may retain read access, but it must not reach any ordinary user-owned write.

drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users
  for insert to authenticated
  with check (
    (select public.current_user_is_active())
    and (select auth.uid()) = id
  );

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update to authenticated
  using (
    (select public.current_user_is_active())
    and (select auth.uid()) = id
  )
  with check (
    (select public.current_user_is_active())
    and (select auth.uid()) = id
  );

-- Direct like-table writes remain ungranted, but keep the RLS boundary safe if
-- a future migration deliberately restores a command grant.
drop policy if exists show_preset_likes_insert_own on public.show_preset_likes;
create policy show_preset_likes_insert_own on public.show_preset_likes
  for insert to authenticated
  with check (
    (select public.current_user_is_active())
    and (select auth.uid()) = user_id
    and exists (
      select 1
      from public.show_presets preset
      where preset.id = show_preset_id
        and preset.is_published
    )
  );

drop policy if exists show_preset_likes_delete_own on public.show_preset_likes;
create policy show_preset_likes_delete_own on public.show_preset_likes
  for delete to authenticated
  using (
    (select public.current_user_is_active())
    and (select auth.uid()) = user_id
  );

-- Keep the import-admin branch unchanged. Service-role callers continue to
-- bypass RLS, while an ordinary owner must still be active at statement time.
drop policy if exists media_assets_insert_allowed on public.media_assets;
create policy media_assets_insert_allowed on public.media_assets
  for insert to authenticated
  with check (
    (
      (select public.current_user_is_active())
      and owner_id = (select auth.uid())
    )
    or (select public.current_user_has_permission('admin.manage_imports'))
  );

-- The private signup trigger still provisions credit accounts without a JWT.
-- This public wrapper is only for live authenticated users and billing admins.
create or replace function public.ensure_ai_credit_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not coalesce(public.current_user_is_active(), false)
    or (
      auth.uid() <> p_user_id
      and not public.current_user_has_permission('admin.manage_billing')
    ) then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;

  return private.ensure_ai_credit_account(p_user_id);
end;
$$;

-- Preserve the existing engagement contract and response shape while adding
-- the same live-user check used by other public owner-mutation RPCs.
create or replace function public.toggle_show_preset_like(p_show_preset_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  current_count integer := 0;
  is_liked boolean;
begin
  if caller_id is null
    or not coalesce(public.current_user_is_active(), false)
  then
    return jsonb_build_object('ok', false, 'error', 'Not permitted.');
  end if;

  if not exists (
    select 1
    from public.show_presets
    where id = p_show_preset_id
      and is_published
  ) then
    return jsonb_build_object('ok', false, 'error', 'Published show was not found.');
  end if;

  delete from public.show_preset_likes
  where show_preset_id = p_show_preset_id
    and user_id = caller_id;

  if found then
    is_liked := false;
  else
    insert into public.show_preset_likes (show_preset_id, user_id)
    values (p_show_preset_id, caller_id)
    on conflict (show_preset_id, user_id) do nothing;
    is_liked := true;
  end if;

  select like_count into current_count
  from public.show_preset_like_counts
  where show_preset_id = p_show_preset_id;

  return jsonb_build_object(
    'ok', true,
    'liked', is_liked,
    'likeCount', coalesce(current_count, 0)
  );
end;
$$;

-- Keep credit bootstrap available to the same authenticated and service roles.
-- The Explore engagement RPC is intentionally callable only by authenticated
-- user sessions; service jobs can manage the underlying tables directly.
revoke execute on function public.ensure_ai_credit_account(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.ensure_ai_credit_account(uuid)
  to authenticated, service_role;

revoke execute on function public.toggle_show_preset_like(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.toggle_show_preset_like(uuid)
  to authenticated;
