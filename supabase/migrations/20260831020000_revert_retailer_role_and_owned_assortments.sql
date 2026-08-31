-- Revert FIR-166's retailer role / owner-scoped assortments experiment.
-- Superseded: the team is standardizing on FIR-178/FIR-168's already-shipped
-- model — assortments live entirely in /admin/assortments under
-- admin.manage_assortments, funded via assortment_public_links.fundingUserId,
-- no separate retailer role. This removes only what FIR-166 added; it does
-- not touch admin.manage_assortments, assortments/assortment_items schema,
-- or anything FIR-178/FIR-168 shipped.

-- Test assortments seeded for the (now-abandoned) retailer console.
delete from public.assortments
where slug in ('backyard-sparkler-pack', 'neighbourhood-show', 'grand-finale-bundle');
-- assortment_items rows cascade automatically (ON DELETE CASCADE).

-- Reassign the retailer test account back to its original 'user' role.
update public.user_roles
set role_id = (select id from public.roles where key = 'user')
where role_id = (select id from public.roles where key = 'retailer');

drop function if exists public.save_retailer_assortment(
  uuid, text, text, integer, jsonb
);

drop policy if exists assortments_select_own on public.assortments;
drop policy if exists assortments_retailer_delete on public.assortments;
drop policy if exists assortment_items_select_own on public.assortment_items;
drop policy if exists assortment_items_retailer_delete on public.assortment_items;

delete from public.role_permissions
where permission_id in (
  select id from public.permissions where key in ('retailer.view', 'retailer.manage_assortments')
);
delete from public.permissions where key in ('retailer.view', 'retailer.manage_assortments');
delete from public.roles where key = 'retailer';
