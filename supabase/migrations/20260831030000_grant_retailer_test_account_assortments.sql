-- Grant the retailer test account (liam.maloney2403@gmail.com) the
-- admin.manage_assortments permission as a per-user override, not a role
-- change. A retailer is a plain 'user'-role account with this one
-- permission override — never 'admin.view', so it can never reach
-- /admin/*, unlike a developer/owner 'admin' account (see FIR-166).

insert into public.user_permission_overrides (user_id, permission_id, enabled)
select u.id, p.id, true
from public.users u
cross join public.permissions p
where lower(u.email) = 'liam.maloney2403@gmail.com'
  and p.key = 'admin.manage_assortments'
on conflict (user_id, permission_id) do update
set enabled = true;
