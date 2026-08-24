-- Retailer-owned assortments (FIR-166). A retailer builds and manages
-- assortments scoped to their own account via `assortments.created_by`,
-- distinct from 'admin.manage_assortments' (global, admin-wide, added by
-- FIR-178). A retailer account never holds 'admin.manage_assortments', so it
-- can only ever reach its own rows through the ownership-checked policies
-- and RPC below, never the full admin-wide surface.

insert into public.permissions (key, name, description, category)
values (
  'retailer.manage_assortments',
  'Manage own assortments',
  'Create and edit the priced in-store assortments this retailer account owns.',
  'retailer'
)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'retailer.manage_assortments'
where r.key = 'retailer'
on conflict do nothing;

-- Retailers read their own assortments, including drafts (the existing
-- 'assortments_select_public' policy already covers everyone reading active
-- assortments, and 'assortments_select_admin' covers admin-wide read).
create policy assortments_select_own
  on public.assortments
  for select
  to authenticated
  using (
    created_by = (select auth.uid())
    and (select public.current_user_has_permission('retailer.manage_assortments'))
  );

create policy assortment_items_select_own
  on public.assortment_items
  for select
  to authenticated
  using (
    (select public.current_user_has_permission('retailer.manage_assortments'))
    and exists (
      select 1
      from public.assortments a
      where a.id = assortment_items.assortment_id
        and a.created_by = (select auth.uid())
    )
  );

-- Delete is a single cascading statement, safe as a plain owner-scoped
-- policy. Create/update go through save_retailer_assortment() below so the
-- assortment row and its full item list stay in sync in one transaction.
-- The FK cascade from assortment_items still runs under RLS, so it needs its
-- own owner-scoped delete policy or the cascade is silently blocked.
create policy assortments_retailer_delete
  on public.assortments
  for delete
  to authenticated
  using (
    created_by = (select auth.uid())
    and (select public.current_user_has_permission('retailer.manage_assortments'))
  );

create policy assortment_items_retailer_delete
  on public.assortment_items
  for delete
  to authenticated
  using (
    (select public.current_user_has_permission('retailer.manage_assortments'))
    and exists (
      select 1
      from public.assortments a
      where a.id = assortment_items.assortment_id
        and a.created_by = (select auth.uid())
    )
  );

create or replace function public.save_retailer_assortment(
  p_assortment_id uuid,
  p_name text,
  p_description text,
  p_price_cents integer,
  p_is_active boolean,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_assortment_id uuid;
  v_slug text;
  v_item jsonb;
begin
  if v_user_id is null
    or not (select public.current_user_is_active())
    or not coalesce(public.current_user_has_permission('retailer.manage_assortments'), false) then
    raise exception using
      errcode = '42501',
      message = 'Not permitted.';
  end if;

  if coalesce(trim(p_name), '') = ''
    or p_price_cents is null
    or p_price_cents < 0
    or p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0 then
    raise exception using
      errcode = '22023',
      message = 'Invalid assortment request.';
  end if;

  if p_assortment_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'))
      || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

    insert into public.assortments (
      slug, name, description, price_cents, is_active, created_by
    )
    values (
      v_slug,
      trim(p_name),
      nullif(trim(coalesce(p_description, '')), ''),
      p_price_cents,
      coalesce(p_is_active, false),
      v_user_id
    )
    returning id into v_assortment_id;
  else
    update public.assortments
    set name = trim(p_name),
        description = nullif(trim(coalesce(p_description, '')), ''),
        price_cents = p_price_cents,
        is_active = coalesce(p_is_active, is_active),
        updated_at = now()
    where id = p_assortment_id
      and created_by = v_user_id
    returning id into v_assortment_id;

    if v_assortment_id is null then
      raise exception using
        errcode = '42501',
        message = 'Assortment not found or not owned by the current user.';
    end if;

    delete from public.assortment_items where assortment_id = v_assortment_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.assortment_items (
      assortment_id, catalogue_item_id, quantity, sort_order
    )
    values (
      v_assortment_id,
      (v_item ->> 'catalogueItemId')::uuid,
      greatest(1, coalesce((v_item ->> 'quantity')::integer, 1)),
      coalesce((v_item ->> 'sortOrder')::integer, 0)
    );
  end loop;

  return v_assortment_id;
end;
$$;

comment on function public.save_retailer_assortment(
  uuid, text, text, integer, boolean, jsonb
) is
  'Atomically creates or updates a retailer-owned assortment and replaces its full item list. Caller must own the row (or be creating a new one) and hold retailer.manage_assortments.';

revoke all on function public.save_retailer_assortment(
  uuid, text, text, integer, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.save_retailer_assortment(
  uuid, text, text, integer, boolean, jsonb
) to authenticated;
