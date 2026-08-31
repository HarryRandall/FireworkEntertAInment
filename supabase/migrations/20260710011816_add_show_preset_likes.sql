-- Replace decorative, client-only like totals with authenticated likes and a
-- public aggregate that does not expose user identities.
create table if not exists public.show_preset_likes (
  show_preset_id uuid not null
    references public.show_presets(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (show_preset_id, user_id)
);

create index if not exists show_preset_likes_user_id_idx
  on public.show_preset_likes (user_id);

create table if not exists public.show_preset_like_counts (
  show_preset_id uuid primary key
    references public.show_presets(id) on delete cascade,
  like_count integer not null default 0
    check (like_count >= 0)
);

alter table public.show_preset_likes enable row level security;
alter table public.show_preset_like_counts enable row level security;

drop policy if exists show_preset_likes_select_own on public.show_preset_likes;
create policy show_preset_likes_select_own on public.show_preset_likes
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists show_preset_likes_insert_own on public.show_preset_likes;
create policy show_preset_likes_insert_own on public.show_preset_likes
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
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
  using ((select auth.uid()) = user_id);

drop policy if exists show_preset_like_counts_read_anyone
  on public.show_preset_like_counts;
create policy show_preset_like_counts_read_anyone
  on public.show_preset_like_counts
  for select to anon, authenticated
  using (true);

create or replace function public.sync_show_preset_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.show_preset_like_counts (show_preset_id, like_count)
    values (new.show_preset_id, 1)
    on conflict (show_preset_id) do update
    set like_count = public.show_preset_like_counts.like_count + 1;
    return new;
  end if;

  update public.show_preset_like_counts
  set like_count = greatest(like_count - 1, 0)
  where show_preset_id = old.show_preset_id;
  return old;
end;
$$;

revoke execute on function public.sync_show_preset_like_count()
  from public, anon, authenticated;

drop trigger if exists show_preset_likes_sync_count on public.show_preset_likes;
create trigger show_preset_likes_sync_count
  after insert or delete on public.show_preset_likes
  for each row execute function public.sync_show_preset_like_count();

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
  if caller_id is null then
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

revoke execute on function public.toggle_show_preset_like(uuid)
  from public, anon;
grant execute on function public.toggle_show_preset_like(uuid)
  to authenticated, service_role;

revoke all privileges on table public.show_preset_likes from anon;
revoke all privileges on table public.show_preset_likes from authenticated;
-- Mutations go through the guarded toggle_show_preset_like RPC so callers
-- cannot write another user's identity directly.
grant select on table public.show_preset_likes to authenticated;

revoke insert, update, delete, truncate, references, trigger
  on table public.show_preset_like_counts from anon, authenticated;
grant select on table public.show_preset_like_counts to anon, authenticated;
grant all privileges on table
  public.show_preset_likes,
  public.show_preset_like_counts
to service_role;
