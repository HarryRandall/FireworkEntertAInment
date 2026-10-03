-- Shared callable and trigger stock reconciliation.
select no_plan();
select tests.create_range_fixture();
-- Break and repair cached stock status without the show-status trigger masking the test.
alter table public.shows disable trigger refresh_show_stock;
update public.shows set status = 'stock_issue' where id = '93000000-0000-0000-0000-000000000001';
alter table public.shows enable trigger refresh_show_stock;
select lives_ok('select private.recalculate_show_stock()','callable stock reconciliation succeeds');
select is((select status from public.shows where id = '93000000-0000-0000-0000-000000000001'),'live','callable reconciliation repairs stale stock issue');
update public.store_items set hidden = true where store_id = '90000000-0000-0000-0000-000000000001';
select is((select status from public.shows where id = '93000000-0000-0000-0000-000000000001'),'stock_issue','statement trigger delegates to the shared calculation');
select lives_ok('select private.recalculate_show_stock()','stock reconciliation rerun succeeds');
select is((select status from public.shows where id = '93000000-0000-0000-0000-000000000001'),'stock_issue','callable calculation agrees with the trigger');
update public.store_items set hidden = false where store_id = '90000000-0000-0000-0000-000000000001';
select is((select status from public.shows where id = '93000000-0000-0000-0000-000000000001'),'live','trigger restores live status on replenishment');
select is((select status from public.shows where id = '93000000-0000-0000-0000-000000000003'),'live','private shopper show untouched');

select finish();
