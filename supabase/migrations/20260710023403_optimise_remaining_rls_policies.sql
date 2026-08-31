-- Remove the remaining per-row auth initialisation and overlapping permissive
-- policy plans without changing table grants or effective owner/admin access.

-- Users retain own read/write access, while user admins retain the same read
-- and update access through one policy per command.
drop policy if exists users_select_own on public.users;
drop policy if exists users_admin_select_all on public.users;
drop policy if exists users_insert_own on public.users;
drop policy if exists users_update_own on public.users;
drop policy if exists users_admin_update_all on public.users;

create policy users_select_own_or_admin on public.users
  for select to authenticated
  using (
    (select auth.uid()) = id
    or (select public.current_user_has_permission('admin.manage_users'))
  );

create policy users_insert_own on public.users
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy users_update_own_or_admin on public.users
  for update to authenticated
  using (
    (select auth.uid()) = id
    or (select public.current_user_has_permission('admin.manage_users'))
  )
  with check (
    (select auth.uid()) = id
    or (select public.current_user_has_permission('admin.manage_users'))
  );

-- RBAC reference reads remain available to every signed-in user. Admin writes
-- are command-specific so they do not add a second SELECT policy.
drop policy if exists roles_read_authenticated on public.roles;
create policy roles_read_authenticated on public.roles
  for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists permissions_read_authenticated on public.permissions;
create policy permissions_read_authenticated on public.permissions
  for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists role_permissions_read_authenticated on public.role_permissions;
drop policy if exists role_permissions_admin_modify on public.role_permissions;

create policy role_permissions_read_authenticated on public.role_permissions
  for select to authenticated
  using ((select auth.uid()) is not null);

create policy role_permissions_admin_insert on public.role_permissions
  for insert to authenticated
  with check ((select public.current_user_has_permission('admin.manage_users')));

create policy role_permissions_admin_update on public.role_permissions
  for update to authenticated
  using ((select public.current_user_has_permission('admin.manage_users')))
  with check ((select public.current_user_has_permission('admin.manage_users')));

create policy role_permissions_admin_delete on public.role_permissions
  for delete to authenticated
  using ((select public.current_user_has_permission('admin.manage_users')));

drop policy if exists user_roles_select_own_or_admin on public.user_roles;
drop policy if exists user_roles_admin_modify on public.user_roles;

create policy user_roles_select_own_or_admin on public.user_roles
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or (select public.current_user_has_permission('admin.manage_users'))
  );

create policy user_roles_admin_insert on public.user_roles
  for insert to authenticated
  with check ((select public.current_user_has_permission('admin.manage_users')));

create policy user_roles_admin_update on public.user_roles
  for update to authenticated
  using ((select public.current_user_has_permission('admin.manage_users')))
  with check ((select public.current_user_has_permission('admin.manage_users')));

create policy user_roles_admin_delete on public.user_roles
  for delete to authenticated
  using ((select public.current_user_has_permission('admin.manage_users')));

drop policy if exists user_permission_overrides_select_own_or_admin
  on public.user_permission_overrides;
drop policy if exists user_permission_overrides_admin_modify
  on public.user_permission_overrides;

create policy user_permission_overrides_select_own_or_admin
  on public.user_permission_overrides
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or (select public.current_user_has_permission('admin.manage_users'))
  );

create policy user_permission_overrides_admin_insert
  on public.user_permission_overrides
  for insert to authenticated
  with check ((select public.current_user_has_permission('admin.manage_users')));

create policy user_permission_overrides_admin_update
  on public.user_permission_overrides
  for update to authenticated
  using ((select public.current_user_has_permission('admin.manage_users')))
  with check ((select public.current_user_has_permission('admin.manage_users')));

create policy user_permission_overrides_admin_delete
  on public.user_permission_overrides
  for delete to authenticated
  using ((select public.current_user_has_permission('admin.manage_users')));

-- Owner media reads and inserts remain available. Import admins keep the same
-- union of SELECT/INSERT access plus admin-only UPDATE/DELETE access.
drop policy if exists media_assets_select_allowed on public.media_assets;
drop policy if exists media_assets_insert_own on public.media_assets;
drop policy if exists media_assets_admin_modify on public.media_assets;

create policy media_assets_select_allowed on public.media_assets
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (select public.current_user_has_permission('admin.manage_imports'))
  );

create policy media_assets_insert_allowed on public.media_assets
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    or (select public.current_user_has_permission('admin.manage_imports'))
  );

create policy media_assets_admin_update on public.media_assets
  for update to authenticated
  using ((select public.current_user_has_permission('admin.manage_imports')))
  with check ((select public.current_user_has_permission('admin.manage_imports')));

create policy media_assets_admin_delete on public.media_assets
  for delete to authenticated
  using ((select public.current_user_has_permission('admin.manage_imports')));

-- Style defaults stay readable by signed-in users and writable by catalogue
-- admins. Splitting writes removes the redundant admin SELECT policy.
drop policy if exists firework_style_defaults_select_authenticated
  on public.firework_style_defaults;
drop policy if exists firework_style_defaults_admin_modify
  on public.firework_style_defaults;

create policy firework_style_defaults_select_authenticated
  on public.firework_style_defaults
  for select to authenticated
  using ((select auth.uid()) is not null);

create policy firework_style_defaults_admin_insert
  on public.firework_style_defaults
  for insert to authenticated
  with check ((select public.current_user_has_permission('admin.manage_catalogue')));

create policy firework_style_defaults_admin_update
  on public.firework_style_defaults
  for update to authenticated
  using ((select public.current_user_has_permission('admin.manage_catalogue')))
  with check ((select public.current_user_has_permission('admin.manage_catalogue')));

create policy firework_style_defaults_admin_delete
  on public.firework_style_defaults
  for delete to authenticated
  using ((select public.current_user_has_permission('admin.manage_catalogue')));

-- Import jobs and outputs remain import-admin-only. Worker service-role access
-- is unchanged because this migration does not alter grants or service access.
drop policy if exists import_jobs_admin_select on public.import_jobs;
drop policy if exists import_jobs_admin_modify on public.import_jobs;

create policy import_jobs_admin_select on public.import_jobs
  for select to authenticated
  using ((select public.current_user_has_permission('admin.manage_imports')));

create policy import_jobs_admin_insert on public.import_jobs
  for insert to authenticated
  with check ((select public.current_user_has_permission('admin.manage_imports')));

create policy import_jobs_admin_update on public.import_jobs
  for update to authenticated
  using ((select public.current_user_has_permission('admin.manage_imports')))
  with check ((select public.current_user_has_permission('admin.manage_imports')));

create policy import_jobs_admin_delete on public.import_jobs
  for delete to authenticated
  using ((select public.current_user_has_permission('admin.manage_imports')));

drop policy if exists import_outputs_admin_select on public.import_outputs;
drop policy if exists import_outputs_admin_modify on public.import_outputs;

create policy import_outputs_admin_select on public.import_outputs
  for select to authenticated
  using ((select public.current_user_has_permission('admin.manage_imports')));

create policy import_outputs_admin_insert on public.import_outputs
  for insert to authenticated
  with check ((select public.current_user_has_permission('admin.manage_imports')));

create policy import_outputs_admin_update on public.import_outputs
  for update to authenticated
  using ((select public.current_user_has_permission('admin.manage_imports')))
  with check ((select public.current_user_has_permission('admin.manage_imports')));

create policy import_outputs_admin_delete on public.import_outputs
  for delete to authenticated
  using ((select public.current_user_has_permission('admin.manage_imports')));

-- Supplier stock managers previously gained SELECT through the FOR ALL policy,
-- even without supplier.view. Keep that exact union in the consolidated read
-- policy, then retain the original write predicate per command.
drop policy if exists supplier_profiles_select_allowed on public.supplier_profiles;
drop policy if exists supplier_profiles_modify_allowed on public.supplier_profiles;

create policy supplier_profiles_select_allowed on public.supplier_profiles
  for select to authenticated
  using (
    (select public.current_user_has_permission('admin.manage_suppliers'))
    or (select public.current_user_has_permission('supplier.view'))
    or (select public.current_user_has_permission('supplier.manage_stock'))
  );

create policy supplier_profiles_insert_allowed on public.supplier_profiles
  for insert to authenticated
  with check (
    (select public.current_user_has_permission('admin.manage_suppliers'))
    or (select public.current_user_has_permission('supplier.manage_stock'))
  );

create policy supplier_profiles_update_allowed on public.supplier_profiles
  for update to authenticated
  using (
    (select public.current_user_has_permission('admin.manage_suppliers'))
    or (select public.current_user_has_permission('supplier.manage_stock'))
  )
  with check (
    (select public.current_user_has_permission('admin.manage_suppliers'))
    or (select public.current_user_has_permission('supplier.manage_stock'))
  );

create policy supplier_profiles_delete_allowed on public.supplier_profiles
  for delete to authenticated
  using (
    (select public.current_user_has_permission('admin.manage_suppliers'))
    or (select public.current_user_has_permission('supplier.manage_stock'))
  );

drop policy if exists supplier_inventory_select_allowed
  on public.supplier_inventory_items;
drop policy if exists supplier_inventory_modify_allowed
  on public.supplier_inventory_items;

create policy supplier_inventory_select_allowed
  on public.supplier_inventory_items
  for select to authenticated
  using (
    (select public.current_user_has_permission('admin.manage_suppliers'))
    or (select public.current_user_has_permission('supplier.view'))
    or (select public.current_user_has_permission('supplier.manage_stock'))
  );

create policy supplier_inventory_insert_allowed
  on public.supplier_inventory_items
  for insert to authenticated
  with check (
    (select public.current_user_has_permission('admin.manage_suppliers'))
    or (select public.current_user_has_permission('supplier.manage_stock'))
  );

create policy supplier_inventory_update_allowed
  on public.supplier_inventory_items
  for update to authenticated
  using (
    (select public.current_user_has_permission('admin.manage_suppliers'))
    or (select public.current_user_has_permission('supplier.manage_stock'))
  )
  with check (
    (select public.current_user_has_permission('admin.manage_suppliers'))
    or (select public.current_user_has_permission('supplier.manage_stock'))
  );

create policy supplier_inventory_delete_allowed
  on public.supplier_inventory_items
  for delete to authenticated
  using (
    (select public.current_user_has_permission('admin.manage_suppliers'))
    or (select public.current_user_has_permission('supplier.manage_stock'))
  );

-- Billing costs remain readable to authenticated callers. The old FOR ALL
-- policy added only a redundant admin read because table grants are SELECT-only;
-- retain its intended write predicate as command-specific policies.
drop policy if exists ai_credit_costs_manage_billing_admin
  on public.ai_credit_costs;

create policy ai_credit_costs_billing_admin_insert on public.ai_credit_costs
  for insert to authenticated
  with check ((select public.current_user_has_permission('admin.manage_billing')));

create policy ai_credit_costs_billing_admin_update on public.ai_credit_costs
  for update to authenticated
  using ((select public.current_user_has_permission('admin.manage_billing')))
  with check ((select public.current_user_has_permission('admin.manage_billing')));

create policy ai_credit_costs_billing_admin_delete on public.ai_credit_costs
  for delete to authenticated
  using ((select public.current_user_has_permission('admin.manage_billing')));

-- Migration-time regression guard: these policies must target the app role
-- explicitly and expose at most one permissive policy per command.
do $$
declare
  duplicate_policy record;
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'ai_credit_costs',
        'firework_style_defaults',
        'import_jobs',
        'import_outputs',
        'media_assets',
        'permissions',
        'role_permissions',
        'roles',
        'supplier_inventory_items',
        'supplier_profiles',
        'user_permission_overrides',
        'user_roles',
        'users'
      )
      and 'public' = any(roles)
  ) then
    raise exception 'A targeted policy still applies to PUBLIC.';
  end if;

  for duplicate_policy in
    select tablename, cmd, count(*) as policy_count
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'ai_credit_costs',
        'firework_style_defaults',
        'import_jobs',
        'import_outputs',
        'media_assets',
        'permissions',
        'role_permissions',
        'roles',
        'supplier_inventory_items',
        'supplier_profiles',
        'user_permission_overrides',
        'user_roles',
        'users'
      )
      and 'authenticated' = any(roles)
    group by tablename, cmd
    having count(*) > 1
  loop
    raise exception 'Table % retains % authenticated % policies.',
      duplicate_policy.tablename,
      duplicate_policy.policy_count,
      duplicate_policy.cmd;
  end loop;
end;
$$;
