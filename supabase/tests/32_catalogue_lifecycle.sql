-- Version integrity, document validation and atomic publication, using synthetic catalogue data.
select no_plan();
select tests.create_catalogue_fixture();
select is(private.effect_facts($document${"kind":"wheel","launch":null,"breaks":[],"ground":{"kind":"wheel","wheel":{"radius_m":3,"height_m":6,"spin_hz":2,"drivers":6,"duration_s":7,"colour":"#ffffff","sparks":240,"glitter":0}},"sound":{"lift":0.7,"break":0.85,"crackle":0.6,"whistle":0},"seed":11}$document$::jsonb)->'colours','["silver"]'::jsonb,'ground colour extraction ignores non-colour strings');

-- Writes performed by a trusted backend still obey document checks and history guards.
set local role service_role;
select throws_ok($query$update public.effect_versions set design = '{}' where id = '50000000-0000-0000-0000-000000000002'$query$, '23514', null, 'service role cannot save an invalid design');
select throws_ok($query$update public.effect_versions set design_schema = 2 where id = '50000000-0000-0000-0000-000000000002'$query$, '23514', null, 'unknown design schema version is rejected');
select throws_ok($query$update public.effect_versions set design = tests.design_fixture() where id = '50000000-0000-0000-0000-000000000001'$query$, '23514', null, 'service role cannot update published effect history');
select throws_ok($query$delete from public.effect_versions where id = '50000000-0000-0000-0000-000000000004'$query$, '23514', null, 'service role cannot delete superseded effect history');
select throws_ok($query$update public.effect_versions set status = 'published' where id = '50000000-0000-0000-0000-000000000002'$query$, '23514', null, 'service role cannot bypass the publish transition');
select throws_ok($query$update public.effect_versions set number = 8 where id = '50000000-0000-0000-0000-000000000002'$query$, '23514', null, 'draft version numbering cannot be rewritten');
select throws_ok($query$update public.product_versions set composition = '{}' where id = '70000000-0000-0000-0000-000000000002'$query$, '23514', null, 'service role cannot save an invalid composition');
select throws_ok($query$update public.product_versions set composition = tests.composition_fixture() where id = '70000000-0000-0000-0000-000000000001'$query$, '23514', null, 'published product payload is immutable');
select throws_ok($query$update public.product_version_effects set effect_id = '40000000-0000-0000-0000-000000000002' where product_version_id = '70000000-0000-0000-0000-000000000001'$query$, '23514', null, 'published product bindings are immutable');
select throws_ok($query$delete from public.product_version_effects where product_version_id = '70000000-0000-0000-0000-000000000001'$query$, '23514', null, 'published product bindings cannot be deleted');
select throws_ok($query$insert into public.product_version_effects(product_version_id,letter,effect_id) values ('70000000-0000-0000-0000-000000000001','b','40000000-0000-0000-0000-000000000001')$query$, '23514', null, 'published product bindings cannot be extended');
select throws_ok($query$delete from public.pack_items where pack_id = '60000000-0000-0000-0000-000000000003'$query$, '23514', null, 'published pack contents cannot be deleted');
select throws_ok($query$insert into public.pack_items(pack_id,item_id,quantity) values ('60000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000004',1)$query$, '23514', null, 'packs cannot contain themselves');
-- Insert a row to exercise the logo foreign key rather than updating an absent fixture.
reset role;
insert into public.branding(organisation_id,logo_media_id) values ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003');
set local role service_role;
select throws_ok($query$update public.branding set logo_media_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'$query$, '23503', null, 'branding foreign key rejects an unknown logo');
select lives_ok($query$update public.branding set logo_media_id = '30000000-0000-0000-0000-000000000001'$query$, 'branding foreign key accepts existing media');
reset role;
select tests.act_as('platform_staff');
select throws_ok($query$update public.effects set colours = array['invented'] where id = '40000000-0000-0000-0000-000000000001'$query$, '42501', null, 'clients cannot edit derived effect facts directly');
select throws_ok($query$update public.products set current_version_id = null where id = '60000000-0000-0000-0000-000000000001'$query$, '42501', null, 'clients cannot bypass version pointer publication');
select throws_ok($query$select public.save_effect_draft('50000000-0000-0000-0000-000000000001',tests.design_fixture(),'next')$query$, '23514', null, 'autosave rejects published effects');
select throws_ok($query$select public.save_product_draft('70000000-0000-0000-0000-000000000001',tests.composition_fixture(),'{"a":"40000000-0000-0000-0000-000000000001"}')$query$, '23514', null, 'autosave rejects published products');
select lives_ok($query$select public.save_effect_draft('50000000-0000-0000-0000-000000000002',tests.design_fixture(),'next','Saved fixture')$query$, 'staff autosaves a valid draft');
select lives_ok($query$select public.save_effect_draft('50000000-0000-0000-0000-000000000002',tests.design_fixture(),'next',null,'{"budget_ok":true}','30000000-0000-0000-0000-000000000001')$query$,'staff saves checks and reference media with the draft');
select is((select checks from public.effect_versions where id = '50000000-0000-0000-0000-000000000002'),'{"budget_ok":true}'::jsonb,'draft saves retain submitted simulation checks');
select throws_ok($query$select public.save_effect_draft('50000000-0000-0000-0000-000000000002',tests.design_fixture(),'next',null,'[]')$query$,'23514',null,'draft simulation checks must be an object');
select lives_ok($query$select public.publish_effect_version('50000000-0000-0000-0000-000000000002')$query$, 'staff publishes a valid effect draft');
select is((select status from public.effects where id = '40000000-0000-0000-0000-000000000002'), 'published', 'publication changes parent lifecycle');
select is((select draft_version_id from public.effects where id = '40000000-0000-0000-0000-000000000002'), null::uuid, 'publication clears the draft pointer');
select is((select duration_ms from public.effects where id = '40000000-0000-0000-0000-000000000002'), 5104, 'published duration matches renderer shotDuration in milliseconds');
select is((select apex_m from public.effects where id = '40000000-0000-0000-0000-000000000002'), 82.0::numeric, 'published apex includes launch height plus radius');
select ok(not (select summary->'tags' ? 'crackle' from public.effect_versions where id = '50000000-0000-0000-0000-000000000002'),'a sound gain does not invent a crackle effect tag');
select throws_ok($query$select public.publish_effect_version('50000000-0000-0000-0000-000000000002')$query$, '23514', null, 'publishing the same effect twice is refused');

-- A new draft restores the source document into a new number, preserving the old published row.
select lives_ok($query$select public.create_effect_draft('40000000-0000-0000-0000-000000000002','draft-effect','Restored fixture','peony',tests.design_fixture(),'next','50000000-0000-0000-0000-000000000002')$query$, 'staff restores a historical effect into a new draft');
select is((select number from public.effect_versions where effect_id = '40000000-0000-0000-0000-000000000002' and status = 'draft'), 2, 'restored draft uses the next version number');
select throws_ok($query$select public.create_effect_draft('40000000-0000-0000-0000-000000000002','draft-effect','Duplicate fixture','peony',tests.design_fixture(),'next')$query$, '23505', null, 'only one open draft per effect');
select lives_ok($query$select public.publish_effect_version((select draft_version_id from public.effects where id = '40000000-0000-0000-0000-000000000002'))$query$, 'a replacement publishes');
select is((select status from public.effect_versions where id = '50000000-0000-0000-0000-000000000002'), 'superseded', 'previous effect version is superseded');
select is((select design from public.effect_versions where id = '50000000-0000-0000-0000-000000000002'), tests.design_fixture(), 'supersession preserves the old design');
select throws_ok($query$select public.create_effect_draft('40000000-0000-0000-0000-000000000002','draft-effect','Foreign parent','peony',tests.design_fixture(),'next','50000000-0000-0000-0000-000000000001')$query$, '23503', null, 'restore source cannot belong to another effect');

select throws_ok($query$select public.publish_product_version('70000000-0000-0000-0000-000000000002')$query$, '23514', null, 'product publication requires confirmed safety');
select is((select status from public.product_versions where id = '70000000-0000-0000-0000-000000000002'), 'draft', 'failed publication rolls back version lifecycle');
select lives_ok($query$select public.confirm_product_safety('60000000-0000-0000-0000-000000000002',8::smallint,2::smallint,'[{"market":"GB","legal_category":"F2"}]','20000000-0000-0000-0000-000000000001',tests.get_supabase_uid('supplier_member'))$query$, 'staff confirms supplier safety and market facts');
select is((select safety_supplied_by from public.products where id = '60000000-0000-0000-0000-000000000002'), tests.get_supabase_uid('supplier_member'), 'safety stores who supplied it');
select is((select safety_confirmed_by from public.products where id = '60000000-0000-0000-0000-000000000002'), tests.get_supabase_uid('platform_staff'), 'safety stores who confirmed it');
select is((select confirmed_by from public.product_markets where product_id = '60000000-0000-0000-0000-000000000002'), tests.get_supabase_uid('platform_staff'), 'legal category stores who confirmed it');
select throws_ok($query$select public.confirm_product_safety('60000000-0000-0000-0000-000000000002',8::smallint,2::smallint,'[{"market":"GB","legal_category":"F2"}]','20000000-0000-0000-0000-000000000002',tests.get_supabase_uid('supplier_member'))$query$, '23514', null, 'safety source cannot claim another supplier');
select throws_ok($query$select public.save_product_draft('70000000-0000-0000-0000-000000000002',tests.composition_fixture(),'{"a":"ffffffff-ffff-ffff-ffff-ffffffffffff"}')$query$, '23503', null, 'composition cannot bind a nonexistent effect');
select is((select effect_id from public.product_version_effects where product_version_id = '70000000-0000-0000-0000-000000000002'), '40000000-0000-0000-0000-000000000002'::uuid, 'failed binding replacement rolls back deletion');
select lives_ok($query$select public.publish_product_version('70000000-0000-0000-0000-000000000002')$query$, 'confirmed composed product publishes');
select is((select shot_count from public.products where id = '60000000-0000-0000-0000-000000000002'), 1::smallint, 'shot count derives from the composition');
select is((select duration_ms from public.products where id = '60000000-0000-0000-0000-000000000002'), 5104, 'product duration uses the current effect');
select is((select noise_level from public.products where id = '60000000-0000-0000-0000-000000000002'), 2::smallint, 'publish preserves confirmed physical noise override');

-- Changing a current effect refreshes composed products and selection packs, preserving their saved summaries.
select lives_ok($query$select public.create_effect_draft('40000000-0000-0000-0000-000000000001','published-effect','Changed fixture','peony',jsonb_set(tests.design_fixture(),'{launch,height_m}','100'),'next')$query$, 'existing published effect gets a new numbered draft');
select is((select number from public.effect_versions where id = (select draft_version_id from public.effects where id = '40000000-0000-0000-0000-000000000001')),3,'effect numbering includes its superseded history');
select lives_ok($query$select public.publish_effect_version((select draft_version_id from public.effects where id = '40000000-0000-0000-0000-000000000001'))$query$, 'new current effect publishes');
select is((select apex_m from public.products where id = '60000000-0000-0000-0000-000000000001'),126::numeric,'current product search apex follows the latest effect');
select is((select apex_m from public.products where id = '60000000-0000-0000-0000-000000000003'),126::numeric,'published pack facts refresh after an effect changes');
select is((select (summary->>'apex_m')::numeric from public.product_versions where id = '70000000-0000-0000-0000-000000000001'),82::numeric,'historical product summary stays unchanged');
select is((select status from public.effect_versions where id = '50000000-0000-0000-0000-000000000001'),'superseded','old public effect version is superseded');
select lives_ok($query$select public.create_product_draft('60000000-0000-0000-0000-000000000001','published-product','Changed product','cake',tests.composition_fixture(),'{"a":"40000000-0000-0000-0000-000000000001"}')$query$,'staff creates a replacement product draft');
select is((select number from public.product_versions where id = (select draft_version_id from public.products where id = '60000000-0000-0000-0000-000000000001')),2,'replacement product draft uses its next version number');
select throws_ok($query$select public.create_product_draft('60000000-0000-0000-0000-000000000001','published-product','Duplicate product','cake',tests.composition_fixture(),'{"a":"40000000-0000-0000-0000-000000000001"}')$query$,'23505',null,'only one draft per product');
select lives_ok($query$select public.publish_product_version((select draft_version_id from public.products where id = '60000000-0000-0000-0000-000000000001'))$query$,'replacement product version publishes');
select is((select status from public.product_versions where id = '70000000-0000-0000-0000-000000000001'),'superseded','previous product version is superseded');
select is((select composition from public.product_versions where id = '70000000-0000-0000-0000-000000000001'),tests.composition_fixture(),'product supersession preserves the old composition');
select lives_ok($query$select public.save_product_details('60000000-0000-0000-0000-000000000001','Fixture brand','Fixture description','123')$query$,'staff saves canonical product metadata');
select lives_ok($query$select public.save_effect_details('40000000-0000-0000-0000-000000000001','Fixture name','peony',true)$query$,'staff saves effect library metadata');

-- Invalid semantic compositions may be drafted but cannot publish or expose search facts.
select lives_ok($query$select public.create_product_draft(null,'invalid-composition','Invalid composition','cake',tests.composition_fixture(),'{"a":"40000000-0000-0000-0000-000000000001"}')$query$,'staff creates a new composed product and binding atomically');
select is((select number from public.product_versions where id = (select draft_version_id from public.products where slug = 'invalid-composition')),1,'new product numbering is independent of existing products');
select lives_ok($query$select public.confirm_product_safety((select id from public.products where slug = 'invalid-composition'),8::smallint,2::smallint,'[{"market":"GB","legal_category":"F2"}]')$query$,'admin-entered safety also carries confirmation');
select lives_ok($query$select public.save_product_draft((select draft_version_id from public.products where slug = 'invalid-composition'),'{"tubes":[{"i":0,"letter":"b","t_ms":0,"angle_deg":0}]}','{"a":"40000000-0000-0000-0000-000000000001"}')$query$,'missing letter binding can be saved as an incomplete draft');
select throws_ok($query$select public.publish_product_version((select draft_version_id from public.products where slug = 'invalid-composition'))$query$,'23514',null,'publication rejects missing and unused effect bindings');
select lives_ok($query$select public.save_product_draft((select draft_version_id from public.products where slug = 'invalid-composition'),'{"tubes":[{"i":0,"letter":"a","t_ms":0,"angle_deg":0},{"i":0,"letter":"a","t_ms":10,"angle_deg":0}]}','{"a":"40000000-0000-0000-0000-000000000001"}')$query$,'duplicate tube indices remain private draft data');
select throws_ok($query$select public.publish_product_version((select draft_version_id from public.products where slug = 'invalid-composition'))$query$,'23514',null,'publication rejects duplicate tube indices');
select lives_ok($query$select public.save_product_draft((select draft_version_id from public.products where slug = 'invalid-composition'),'{"box":{"rows":1,"cols":1,"pitch_mm":40},"tubes":[{"i":1,"letter":"a","t_ms":0,"angle_deg":0,"pos":[0,1]}]}','{"a":"40000000-0000-0000-0000-000000000001"}')$query$,'incomplete grid can be kept as a draft');
select throws_ok($query$select public.publish_product_version((select draft_version_id from public.products where slug = 'invalid-composition'))$query$,'23514',null,'publication rejects indices and positions outside the tube grid');
select lives_ok($query$select public.save_product_draft((select draft_version_id from public.products where slug = 'invalid-composition'),'{"tubes":[{"i":0,"letter":"a","t_ms":null,"angle_deg":0}]}','{"a":"40000000-0000-0000-0000-000000000001"}')$query$,'untimed tubes can be drafted');
select throws_ok($query$select public.publish_product_version((select draft_version_id from public.products where slug = 'invalid-composition'))$query$,'23514',null,'cake publication requires fixed firing times');

select lives_ok($query$select public.confirm_product_safety('60000000-0000-0000-0000-000000000004',8::smallint,2::smallint,'[{"market":"GB","legal_category":"F2"}]')$query$,'staff confirms pack safety');
select lives_ok($query$select public.save_pack_items('60000000-0000-0000-0000-000000000004','[{"item_id":"60000000-0000-0000-0000-000000000001","quantity":3}]')$query$,'pack content replacement is atomic');
select lives_ok($query$select public.publish_pack('60000000-0000-0000-0000-000000000004')$query$,'confirmed pack containing published products publishes');
select is((select shot_count from public.products where id = '60000000-0000-0000-0000-000000000004'),3::smallint,'pack shot count includes item quantities');
select throws_ok($query$select public.save_pack_items('60000000-0000-0000-0000-000000000004','[]')$query$,'23514',null,'published pack contents cannot be rewritten');
select lives_ok($query$select public.create_pack('empty-pack','Empty pack')$query$,'staff creates an empty draft pack');
select lives_ok($query$select public.confirm_product_safety((select id from public.products where slug = 'empty-pack'),8::smallint,2::smallint,'[{"market":"GB","legal_category":"F2"}]')$query$,'empty draft pack can have confirmed safety');
select throws_ok($query$select public.publish_pack((select id from public.products where slug = 'empty-pack'))$query$,'23514',null,'an empty pack cannot publish');
select throws_ok($query$select public.save_pack_items((select id from public.products where slug = 'empty-pack'),'[{"item_id":"60000000-0000-0000-0000-000000000002","quantity":0}]')$query$,'23514',null,'pack quantities must be positive');
select is((select count(*) from public.pack_items where pack_id = (select id from public.products where slug = 'empty-pack')),0::bigint,'invalid pack replacement rolls back');
select throws_ok($query$select public.archive_effect('40000000-0000-0000-0000-000000000002')$query$, '23514', null, 'archive cannot break a published composition');
select throws_ok($query$select public.archive_product('60000000-0000-0000-0000-000000000001')$query$, '23514', null, 'archive cannot break published pack contents');
select lives_ok($query$select public.archive_product('60000000-0000-0000-0000-000000000002')$query$, 'unreferenced product archives');
select lives_ok($query$select public.archive_effect('40000000-0000-0000-0000-000000000002')$query$, 'effect archives after its dependent product archives');
reset role;
select tests.act_as_public();
select is((select count(*) from public.products where id = '60000000-0000-0000-0000-000000000002'), 0::bigint, 'archived product disappears from public catalogue');
select is((select count(*) from public.effect_versions where effect_id = '40000000-0000-0000-0000-000000000002'), 0::bigint, 'archived effect history is hidden publicly');
select is((select count(*) from public.effect_versions where id = '50000000-0000-0000-0000-000000000001'),0::bigint,'public cannot read the superseded effect version');
select is((select count(*) from public.poster_renders where effect_version_id = '50000000-0000-0000-0000-000000000001'),0::bigint,'public cannot read posters of superseded effect history');
select is((select count(*) from public.product_versions where id = '70000000-0000-0000-0000-000000000001'),0::bigint,'public cannot read superseded product history');
select is((select count(*) from public.product_version_effects where product_version_id = '70000000-0000-0000-0000-000000000001'),0::bigint,'public cannot read superseded letter bindings');
reset role;
select * from finish();
