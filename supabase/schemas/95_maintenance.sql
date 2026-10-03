-- Trusted SQL maintenance for shopper retention and expired lifecycle records.
create function private.expire_lists()
returns bigint language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_changed bigint;
begin
  update public.lists as list set status = 'expired'
    from public.stores as store
    where store.id = list.store_id and list.status = 'open'
      and list.valid_until < (now() at time zone store.timezone)::date;
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;
comment on function private.expire_lists() is 'Expires open lists before today in store time, preserving redeemed lists and the inclusive validity date; returns rows changed.';

create function private.expire_invitations()
returns bigint language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_changed bigint;
begin
  update public.invitations as invitation set revoked_at = now()
    where invitation.expires_at <= now() and invitation.accepted_at is null and invitation.revoked_at is null;
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;
comment on function private.expire_invitations() is 'Revokes expired unaccepted invitations at transaction time, preserving accepted or previously revoked invitations; returns rows changed.';

-- History foreign keys deliberately retain identities, even when they have no lists.
create function private.profile_has_retained_references(p_profile uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_reference record;
  v_exists boolean;
begin
  for v_reference in
    select constraint_row.conrelid::regclass as relation, attribute.attname as column_name
    from pg_catalog.pg_constraint as constraint_row
    join pg_catalog.pg_attribute as attribute on attribute.attrelid = constraint_row.conrelid
      and attribute.attnum = constraint_row.conkey[1]
    where constraint_row.contype = 'f' and constraint_row.confrelid = 'public.profiles'::regclass
      and constraint_row.confdeltype in ('a','r') and cardinality(constraint_row.conkey) = 1
  loop
    execute format('select exists (select from %s where %I = $1)',v_reference.relation,v_reference.column_name)
      into v_exists using p_profile;
    if v_exists then return true; end if;
  end loop;
  return false;
end;
$$;
comment on function private.profile_has_retained_references(uuid) is 'Checks non-cascading single-column profile foreign keys before anonymous cleanup, preserving history and privacy requests.';

create function private.purge_inactive_anonymous_users()
returns bigint language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  -- Anonymous inactivity retention is 30 days from the storage and schedule contract.
  v_inactivity_retention constant interval := interval '30 days';
  v_changed bigint;
begin
  delete from auth.users as account using public.profiles as profile
    where account.id = profile.id and account.is_anonymous and profile.is_anonymous
      and greatest(account.created_at,account.last_sign_in_at,profile.created_at,profile.last_seen_at) < now() - v_inactivity_retention
      and not exists (select from public.lists as list where list.shopper_id = account.id)
      and not exists (select from public.follows as follow where follow.shopper_id = account.id)
      and not exists (select from public.staff_roles as staff where staff.profile_id = account.id)
      and not exists (select from public.memberships as member where member.profile_id = account.id)
      and not exists (select from public.supplier_members as member where member.profile_id = account.id)
      and not exists (select from storage.objects as object where object.owner_id = account.id::text
        or (storage.foldername(object.name))[1] = account.id::text)
      and not private.profile_has_retained_references(account.id);
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;
comment on function private.purge_inactive_anonymous_users() is 'Deletes anonymous Auth accounts inactive for over 30 wall-clock days with no lists, follows, assets, privileged memberships or retained references; cascades disposable sessions and returns accounts deleted.';
