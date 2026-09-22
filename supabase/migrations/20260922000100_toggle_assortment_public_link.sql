-- Allow an assortment administrator to suspend or restore a reusable QR capability.
-- Keep public_token and funding_user_id outside the mutation surface.

create or replace function public.set_assortment_public_link_enabled(
  p_assortment_id uuid,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  enabled_value boolean;
begin
  if actor_id is null
    or not coalesce(public.current_user_is_active(), false)
    or not public.current_user_has_permission('admin.manage_assortments')
  then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;

  if p_assortment_id is null or p_enabled is null then
    raise exception 'Invalid assortment QR link request.' using errcode = '22023';
  end if;

  update public.assortment_public_links
  set is_enabled = p_enabled
  where assortment_id = p_assortment_id
  returning is_enabled into enabled_value;

  if not found then
    raise exception 'Reusable QR link not found.' using errcode = 'P0002';
  end if;

  return enabled_value;
end;
$$;

alter function public.set_assortment_public_link_enabled(uuid, boolean) owner to postgres;

revoke all on function public.set_assortment_public_link_enabled(uuid, boolean) from public;
grant execute on function public.set_assortment_public_link_enabled(uuid, boolean) to authenticated;
