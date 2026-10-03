-- Shared synthetic catalogue setup. Called only by catalogue suites inside their rollback transaction.
create function tests.create_catalogue_fixture()
returns void language plpgsql set search_path = '' as $$
begin
  perform tests.create_personas();
  perform tests.create_supabase_user('other_supplier_member');
  insert into public.staff_roles(profile_id,role) values (tests.get_supabase_uid('platform_staff'),'catalogue_editor');
  insert into public.markets(code,name,currency,locale,timezone,min_age,units,enabled)
    values ('GB','Fixture market','GBP','en-GB','Europe/London',18,'metric',true);
  insert into public.organisations(id,name,slug,home_market,billing_currency,status) values
    ('10000000-0000-0000-0000-000000000001','First fixture shop','first-fixture','GB','GBP','active'),
    ('10000000-0000-0000-0000-000000000002','Other fixture shop','other-fixture','GB','GBP','active');
  insert into public.memberships(organisation_id,profile_id,role) values
    ('10000000-0000-0000-0000-000000000001',tests.get_supabase_uid('organisation_owner'),'owner'),
    ('10000000-0000-0000-0000-000000000001',tests.get_supabase_uid('organisation_manager'),'manager'),
    ('10000000-0000-0000-0000-000000000002',tests.get_supabase_uid('other_organisation_member'),'owner');
  insert into public.suppliers(id,name,slug) values
    ('20000000-0000-0000-0000-000000000001','First fixture supplier','first-supplier'),
    ('20000000-0000-0000-0000-000000000002','Other fixture supplier','other-supplier');
  insert into public.supplier_members(supplier_id,profile_id,role) values
    ('20000000-0000-0000-0000-000000000001',tests.get_supabase_uid('supplier_member'),'member'),
    ('20000000-0000-0000-0000-000000000002',tests.get_supabase_uid('other_supplier_member'),'member');
  insert into public.media(id,bucket,path,kind,mime,bytes,sha256,organisation_id,supplier_id,uploaded_by) values
    ('30000000-0000-0000-0000-000000000001','catalogue-media','first/video.mp4','video','video/mp4',1,repeat('a',64),null,'20000000-0000-0000-0000-000000000001',tests.get_supabase_uid('supplier_member')),
    ('30000000-0000-0000-0000-000000000002','catalogue-media','other/video.mp4','video','video/mp4',1,repeat('b',64),null,'20000000-0000-0000-0000-000000000002',tests.get_supabase_uid('platform_staff')),
    ('30000000-0000-0000-0000-000000000003','brand','first/logo.png','image','image/png',1,repeat('c',64),'10000000-0000-0000-0000-000000000001',null,tests.get_supabase_uid('organisation_owner')),
    ('30000000-0000-0000-0000-000000000004','brand','other/logo.png','image','image/png',1,repeat('d',64),'10000000-0000-0000-0000-000000000002',null,tests.get_supabase_uid('other_organisation_member'));
  insert into public.effects(id,slug,name,family,kind,status) values
    ('40000000-0000-0000-0000-000000000001','published-effect','Published fixture','peony','shell','published'),
    ('40000000-0000-0000-0000-000000000002','draft-effect','Draft fixture','peony','shell','draft'),
    ('40000000-0000-0000-0000-000000000003','archived-effect','Archived fixture','peony','shell','archived');
  insert into public.effect_versions(id,effect_id,number,design,renderer,status,summary) values
    ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',1,tests.design_fixture(),'fixture','published',private.effect_facts(tests.design_fixture())),
    ('50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002',1,tests.design_fixture(),'fixture','draft','{}'),
    ('50000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000003',1,tests.design_fixture(),'fixture','published','{}'),
    ('50000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000001',2,tests.design_fixture(),'fixture','superseded','{}');
  update public.effects set current_version_id = '50000000-0000-0000-0000-000000000001' where id = '40000000-0000-0000-0000-000000000001';
  update public.effects set draft_version_id = '50000000-0000-0000-0000-000000000002' where id = '40000000-0000-0000-0000-000000000002';
  update public.effects set duration_ms = 5104, apex_m = 82, noise_level = 3,
    colours = array(select jsonb_array_elements_text(private.effect_facts(tests.design_fixture())->'colours')),
    tags = array(select jsonb_array_elements_text(private.effect_facts(tests.design_fixture())->'tags'))
    where id = '40000000-0000-0000-0000-000000000001';
  insert into public.products(id,slug,name,kind,status,min_safety_distance_m,noise_level,safety_supplied_by,safety_confirmed_by,safety_confirmed_at) values
    ('60000000-0000-0000-0000-000000000001','published-product','Published product','cake','published',8,2,tests.get_supabase_uid('platform_staff'),tests.get_supabase_uid('platform_staff'),now()),
    ('60000000-0000-0000-0000-000000000002','draft-product','Draft product','cake','draft',null,null,null,null,null),
    ('60000000-0000-0000-0000-000000000003','published-pack','Published pack','pack','draft',8,2,tests.get_supabase_uid('platform_staff'),tests.get_supabase_uid('platform_staff'),now()),
    ('60000000-0000-0000-0000-000000000004','draft-pack','Draft pack','pack','draft',null,null,null,null,null);
  insert into public.product_versions(id,product_id,number,composition) values
    ('70000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001',1,tests.composition_fixture()),
    ('70000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000002',1,tests.composition_fixture());
  insert into public.product_version_effects(product_version_id,letter,effect_id) values
    ('70000000-0000-0000-0000-000000000001','a','40000000-0000-0000-0000-000000000001'),
    ('70000000-0000-0000-0000-000000000002','a','40000000-0000-0000-0000-000000000002');
  update public.product_versions set status = 'published', summary = private.product_facts(id) where id = '70000000-0000-0000-0000-000000000001';
  update public.products set current_version_id = '70000000-0000-0000-0000-000000000001' where id = '60000000-0000-0000-0000-000000000001';
  update public.products set draft_version_id = '70000000-0000-0000-0000-000000000002' where id = '60000000-0000-0000-0000-000000000002';
  perform private.write_product_facts('60000000-0000-0000-0000-000000000001',private.product_facts('70000000-0000-0000-0000-000000000001'));
  insert into public.pack_items(pack_id,item_id,quantity) values ('60000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000001',2),
    ('60000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000001',1);
  update public.products set status = 'published' where id = '60000000-0000-0000-0000-000000000003';
  insert into public.product_markets(product_id,market,legal_category,supplied_by,confirmed_by,confirmed_at)
    select id,'GB','F2',tests.get_supabase_uid('platform_staff'),tests.get_supabase_uid('platform_staff'),now() from public.products where status = 'published';
  insert into public.product_markets(product_id,market,legal_category) values ('60000000-0000-0000-0000-000000000002','GB','F2');
  perform private.refresh_pack_facts();
  insert into public.product_media(product_id,media_id,role) values
    ('60000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','demo_video'),
    ('60000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','demo_video');
  insert into public.supplier_products(supplier_id,product_id,supplier_code,name_raw,cost_minor,currency)
    values ('20000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','FIXTURE','First listing',1840,'GBP'),
      ('20000000-0000-0000-0000-000000000002',null,'FIXTURE','Other listing',2000,'GBP');
  insert into public.poster_renders(effect_version_id,renderer,framing,width,height,t_ms,path,status) values
    ('50000000-0000-0000-0000-000000000001','fixture','card',400,400,2000,'fixture/current.webp','ready'),
    ('50000000-0000-0000-0000-000000000001','fixture','wide',400,200,2000,'fixture/pending.webp','pending'),
    ('50000000-0000-0000-0000-000000000002','fixture','card',400,400,2000,'fixture/draft.webp','ready');
end;
$$;
