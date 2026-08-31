-- Add a 'retailer' role and 'retailer.view' permission for the retailer-admin
-- console (FIR-166). Retailers are not granted any 'admin.*' permission —
-- the /admin route group stays gated on 'admin.view', which retailer
-- accounts never hold, so this role cannot reach platform admin regardless
-- of which retailer-scoped permissions it accumulates later.

insert into public.roles (key, name, description, sort_order)
values (
  'retailer',
  'Retailer',
  'Runs the retailer admin console: catalogue view, assortments, usage, and credits.',
  25
)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order;

insert into public.permissions (key, name, description, category)
values (
  'retailer.view',
  'View retailer admin',
  'Open the retailer admin console.',
  'retailer'
)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category;

-- Admins keep the ability to open the retailer console from the main admin
-- nav; retailers get it as their only granted permission for now.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'retailer.view'
where r.key in ('admin', 'retailer')
on conflict do nothing;
