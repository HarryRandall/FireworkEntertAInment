-- Simplify admin access: one role per user and no organisation model.

-- Keep the highest-privilege existing role before enforcing one role per user.
with ranked_roles as (
  select
    ur.user_id,
    ur.role_id,
    row_number() over (
      partition by ur.user_id
      order by
        case r.key
          when 'admin' then 1
          when 'supplier' then 2
          else 3
        end,
        ur.created_at
    ) as role_rank
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
)
delete from public.user_roles ur
using ranked_roles ranked
where ur.user_id = ranked.user_id
  and ur.role_id = ranked.role_id
  and ranked.role_rank > 1;

create unique index if not exists user_roles_one_role_per_user_idx
  on public.user_roles (user_id);

-- Remove organisation-specific permissions and policies.
delete from public.role_permissions rp
using public.permissions p
where rp.permission_id = p.id
  and p.key = 'admin.manage_organisations';

delete from public.user_permission_overrides upo
using public.permissions p
where upo.permission_id = p.id
  and p.key = 'admin.manage_organisations';

delete from public.permissions
where key = 'admin.manage_organisations';

drop policy if exists "organisations_admin_select" on public.organisations;
drop policy if exists "organisations_admin_modify" on public.organisations;
drop policy if exists "organisation_memberships_admin_select" on public.organisation_memberships;
drop policy if exists "organisation_memberships_admin_modify" on public.organisation_memberships;

drop trigger if exists organisations_set_updated_at on public.organisations;

alter table if exists public.supplier_profiles
  drop column if exists organisation_id;

drop table if exists public.organisation_memberships;
drop table if exists public.organisations;
