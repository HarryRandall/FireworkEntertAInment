-- Atomic duplication is fenced by catalogue editor rights and leaves source history intact.
select no_plan();
select tests.create_catalogue_fixture();
select tests.act_as('organisation_owner');
select throws_ok($$select public.duplicate_catalogue_item('effect','40000000-0000-0000-0000-000000000001')$$, '42501', null, 'retailer cannot duplicate effects');
reset role;
select tests.act_as('supplier_member');
select throws_ok($$select public.duplicate_catalogue_item('product','60000000-0000-0000-0000-000000000001')$$, '42501', null, 'supplier cannot duplicate products');
reset role;
select tests.act_as('anonymous_shopper');
select throws_ok($$select public.duplicate_catalogue_item('effect','40000000-0000-0000-0000-000000000001')$$, '42501', null, 'anonymous shopper cannot duplicate');
reset role;
select tests.act_as('platform_staff');
create temporary table copies(kind text, id uuid);
insert into copies values ('effect',public.duplicate_catalogue_item('effect','40000000-0000-0000-0000-000000000001')),
  ('product',public.duplicate_catalogue_item('product','60000000-0000-0000-0000-000000000001')),
  ('pack',public.duplicate_catalogue_item('product','60000000-0000-0000-0000-000000000003'));
select is((select status from public.effects where id = (select id from copies where kind = 'effect')), 'draft', 'effect copy starts as draft');
select is((select design from public.effect_versions where effect_id = (select id from copies where kind = 'effect')), tests.design_fixture(), 'effect document copied exactly');
select is((select count(*) from public.effect_versions where effect_id = (select id from copies where kind = 'effect')), 1::bigint, 'copy starts independent version history');
select is((select count(*) from public.product_version_effects where product_version_id = (select draft_version_id from public.products where id = (select id from copies where kind = 'product'))), 1::bigint, 'product bindings copied atomically');
select is((select composition from public.product_versions where product_id = (select id from copies where kind = 'product')), tests.composition_fixture(), 'composition copied exactly');
select ok((select safety_confirmed_at is null and current_version_id is null and status = 'draft' from public.products where id = (select id from copies where kind = 'product')), 'copy does not inherit publication or safety confirmation');
select is((select quantity from public.pack_items where pack_id = (select id from copies where kind = 'pack')), 2::smallint, 'pack contents and quantity copied');
select is((select status from public.effects where id = '40000000-0000-0000-0000-000000000001'), 'published', 'source effect stays published');
select throws_ok($$select public.duplicate_catalogue_item('unknown','40000000-0000-0000-0000-000000000001')$$,'22023',null,'unknown kind refused');
select throws_ok($$select public.duplicate_catalogue_item('effect','ffffffff-ffff-ffff-ffff-ffffffffffff')$$,'P0002',null,'missing source refused');
select throws_ok($$select public.publish_product_version((select draft_version_id from public.products where id = (select id from copies where kind = 'product')))$$,'23514',null,'duplicate cannot bypass safety confirmation');
select ok(not has_function_privilege('anon', 'public.duplicate_catalogue_item(text,uuid)', 'execute'), 'public callers have no duplication grant');
select public.create_effect_draft('40000000-0000-0000-0000-000000000001','published-effect','Published fixture','peony',jsonb_set(tests.design_fixture(),'{seed}','61'), 'fixture');
insert into copies values ('preferred-draft',public.duplicate_catalogue_item('effect','40000000-0000-0000-0000-000000000001'));
select is((select design->>'seed' from public.effect_versions where effect_id = (select id from copies where kind = 'preferred-draft')), '61', 'duplication prefers an existing draft over the current published version');
select is((select design from public.effect_versions where id = '50000000-0000-0000-0000-000000000001'), tests.design_fixture(), 'duplication and drafting leave published source payload unchanged');
reset role;
update public.staff_roles set role = 'reviewer' where profile_id = tests.get_supabase_uid('platform_staff');
select tests.act_as('platform_staff');
select throws_ok($$select public.duplicate_catalogue_item('effect','40000000-0000-0000-0000-000000000001')$$,'42501',null,'reviewer cannot duplicate');
select * from finish();
