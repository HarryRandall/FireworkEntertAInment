-- Public page contracts must retain store, publication and market visibility fences.
select no_plan();
select tests.create_range_fixture();
insert into public.branding(organisation_id,accent,welcome,footer) values
('10000000-0000-0000-0000-000000000001','#0f7a52','Organisation greeting','Read the box instructions');
insert into public.branding(organisation_id,store_id,accent,welcome) values
('10000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','#123456','Store greeting');
insert into public.poster_renders(product_version_id,renderer,framing,width,height,t_ms,path,status) values
('70000000-0000-0000-0000-000000000001','fixture','card',320,200,1000,'70000000-0000-0000-0000-000000000001/card.png','ready');
select tests.act_as_public();
select is(public.store_page_by_slug('fixture-1')#>>'{branding,welcome}','Store greeting','store branding overrides organisation branding');
select is(public.store_page_by_slug('missing'),null::jsonb,'unknown store slug is unavailable');
select is(public.product_for_store('fixture-1','60000000-0000-0000-0000-000000000001')#>>'{playback,effects,0,renderer}','fixture','public product reader includes published renderer version');
select is(public.product_for_store('fixture-1','60000000-0000-0000-0000-000000000001')#>>'{playback,poster,path}','70000000-0000-0000-0000-000000000001/card.png','product reader exposes only a ready card poster reference');
select ok(public.store_page_by_slug('fixture-1')#>'{products,0,playback,composition}' is not null,'store products include their composition');
select is(public.product_for_store('missing','60000000-0000-0000-0000-000000000001'),null::jsonb,'product reader refuses unknown store');
select is(public.product_for_store('fixture-1','60000000-0000-0000-0000-000000000002'),null::jsonb,'product reader refuses unpublished or unlisted product');
select ok(not has_function_privilege(current_user,'private.product_playback(uuid)','execute'),'internal playback remains inaccessible');
select ok(not (public.product_for_store('fixture-1','60000000-0000-0000-0000-000000000001') ? 'organisation_id'),'product contract omits tenancy and wholesale data');
select is(public.resolve_qr('fixture-1')->>'store_slug','fixture-1','resolver exposes the safe destination slug');
reset role;
select tests.act_as('anonymous_shopper');
select ok(public.product_for_store('fixture-1','60000000-0000-0000-0000-000000000001') is not null,'anonymous shopper can play visible store products');
reset role;
update public.store_items set hidden = true where store_id = '90000000-0000-0000-0000-000000000001';
select tests.act_as('anonymous_shopper');
select is(public.product_for_store('fixture-1','60000000-0000-0000-0000-000000000001'),null::jsonb,'anonymous shopper cannot play hidden products');
reset role;
update public.store_items set hidden = false where store_id = '90000000-0000-0000-0000-000000000001';
update public.product_markets set allowed = false where product_id = '60000000-0000-0000-0000-000000000001';
select tests.act_as_public();
select is(public.product_for_store('fixture-1','60000000-0000-0000-0000-000000000001'),null::jsonb,'disallowed market hides playback');
select is(jsonb_array_length(public.store_page_by_slug('fixture-1')->'products'),0,'store range omits disallowed market products');
reset role;
update public.product_markets set allowed = true where product_id = '60000000-0000-0000-0000-000000000001';
update public.product_markets set confirmed_at = null where product_id = '60000000-0000-0000-0000-000000000001';
select tests.act_as_public();
select is(public.product_for_store('fixture-1','60000000-0000-0000-0000-000000000001'),null::jsonb,'unconfirmed market listing hides playback');
reset role;
update public.stores set status = 'closed' where slug = 'fixture-1';
select tests.act_as_public();
select is(public.store_page_by_slug('fixture-1'),null::jsonb,'closed store hides branding and documents');
select is(public.product_for_store('fixture-1','60000000-0000-0000-0000-000000000001'),null::jsonb,'closed store hides product playback');
select finish();
