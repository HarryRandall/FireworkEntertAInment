-- Grant admin.manage_assortments to the base 'user' role. Consumers never
-- get an account at all in this product (they only reach the QR entry
-- route), so every signed-up account is, in practice, a retailer — there's
-- no need to gate retailer-console access per account. Retailers still
-- never hold 'admin.view', so /admin/* stays exclusive to developer/owner
-- 'admin' accounts (see FIR-166).

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'admin.manage_assortments'
where r.key = 'user'
on conflict do nothing;
