-- Allow platform admins to edit role default permissions from the admin UI.

drop policy if exists "role_permissions_admin_modify" on public.role_permissions;
create policy "role_permissions_admin_modify" on public.role_permissions
  for all using (public.current_user_has_permission('admin.manage_users'))
  with check (public.current_user_has_permission('admin.manage_users'));
