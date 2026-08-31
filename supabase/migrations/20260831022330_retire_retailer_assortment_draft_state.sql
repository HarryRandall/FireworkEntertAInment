-- Retire the live/draft concept from the retailer-owned assortment flow
-- (FIR-166). Discoverability is entirely physical: the QR code lives on the
-- product itself, so "is this assortment reachable" is answered by whether
-- the product is still on the shelf, not by a database flag. A retailer
-- assortment is now always active from creation (the column default already
-- handles this — `assortments.is_active boolean not null default true`).
--
-- The shared `is_active` column itself is untouched: it still backs the
-- admin-wide assortments feature from the separate, still-unmerged FIR-178
-- work, which may have its own reasons to draft/publish admin-created rows.
-- This migration only changes what the retailer-owned RPC does.

drop function if exists public.save_retailer_assortment(
  uuid, text, text, integer, boolean, jsonb
);

create or replace function public.save_retailer_assortment(
  p_assortment_id uuid,
  p_name text,
  p_description text,
  p_price_cents integer,
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

    -- is_active is left to its column default (true): retailer-created
    -- assortments have no draft state, see migration header.
    insert into public.assortments (
      slug, name, description, price_cents, created_by
    )
    values (
      v_slug,
      trim(p_name),
      nullif(trim(coalesce(p_description, '')), ''),
      p_price_cents,
      v_user_id
    )
    returning id into v_assortment_id;
  else
    update public.assortments
    set name = trim(p_name),
        description = nullif(trim(coalesce(p_description, '')), ''),
        price_cents = p_price_cents,
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
  uuid, text, text, integer, jsonb
) is
  'Atomically creates or updates a retailer-owned assortment and replaces its full item list. Always active — retailer assortments have no draft state. Caller must own the row (or be creating a new one) and hold retailer.manage_assortments.';

revoke all on function public.save_retailer_assortment(
  uuid, text, text, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.save_retailer_assortment(
  uuid, text, text, integer, jsonb
) to authenticated;
;
