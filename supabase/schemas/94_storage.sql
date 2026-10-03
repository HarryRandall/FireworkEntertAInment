-- Storage authorisation checks an existing owning identity, never client metadata.
create function private.storage_path_owner(p_name text)
returns uuid language plpgsql immutable set search_path = '' as $$
#variable_conflict error
declare
  v_parts text[] := string_to_array(p_name,'/');
begin
  if cardinality(v_parts) < 2 or v_parts && array['','.','..']
    or v_parts[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v_parts[1]::uuid;
end;
$$;
comment on function private.storage_path_owner(text) is 'Returns the owning UUID from a canonical lower-case UUID folder path; malformed or traversal paths return null.';

create function private.storage_access(p_bucket text,p_name text,p_write boolean)
returns boolean language plpgsql stable security definer set search_path = '' as $$
#variable_conflict error
declare
  v_owner uuid := private.storage_path_owner(p_name);
  v_staff text := private.staff_role();
begin
  if v_owner is null then return false; end if;
  case p_bucket
    when 'posters' then
      return v_staff in ('super_admin','catalogue_editor') and (
        exists (select from public.effect_versions as version where version.id = v_owner)
        or exists (select from public.product_versions as version where version.id = v_owner));
    when 'brand' then
      return v_owner in (select private.org_ids('manager')) and exists (
        select from public.memberships as member where member.organisation_id = v_owner
          and member.profile_id = private.uid() and member.store_ids is null);
    when 'catalogue-media', 'imports' then
      return (v_staff is not null and (
        exists (select from public.suppliers as supplier where supplier.id = v_owner)
        or exists (select from public.organisations as organisation where organisation.id = v_owner)
        or exists (select from public.staff_roles as owner_staff where owner_staff.profile_id = v_owner)))
        or v_owner in (select private.supplier_ids())
        or (not p_write and p_bucket = 'catalogue-media' and v_owner in (select private.org_ids('staff')));
    when 'audio' then
      return v_staff is not null and exists (select from public.music_tracks as track where track.id = v_owner);
    when 'exports' then
      return not p_write and (private.owns_shopper(v_owner) or private.can(v_owner,'billing.manage'));
    else return false;
  end case;
end;
$$;
comment on function private.storage_access(text,text,boolean) is 'Checks existing version, organisation, supplier, track or profile ownership for private reads and client writes; exports are backend-write-only and brand writes require unrestricted managers.';
