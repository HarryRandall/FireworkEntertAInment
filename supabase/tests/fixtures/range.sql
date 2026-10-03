-- Synthetic retailer ranges and shopper shows; every suite rolls back its own fixtures.
create function tests.show_cues(p_product uuid default '60000000-0000-0000-0000-000000000001')
returns jsonb language sql set search_path = '' as $$
  select jsonb_build_array(jsonb_build_object('t_ms',0,'product_id',p_product,'position',0,'angle_deg',0));
$$;
comment on function tests.show_cues(uuid) is 'Returns one valid synthetic cue at show start with a position in metres and angle in degrees.';
create function tests.create_range_fixture()
returns void language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  perform tests.create_catalogue_fixture();
  perform tests.create_supabase_user('retailer_staff');
  update public.staff_roles set role = 'super_admin' where profile_id = tests.get_supabase_uid('platform_staff');
  insert into public.stores(id,organisation_id,name,slug,market,timezone,licence)
    values ('90000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Fixture store 1','fixture-1','GB','Europe/London','all_year');
  insert into public.range_items(id,organisation_id,product_id,price_minor,currency)
    values ('91000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001',2500,'GBP');
  insert into public.store_items(organisation_id,store_id,range_item_id)
    values ('10000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001');
  insert into public.stock_movements(organisation_id,store_id,range_item_id,delta,qty_after,source)
    values ('10000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001',10,999,'manual');
  insert into public.collections(id,organisation_id,name,slug,kind)
    values ('92000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Fixture collection 1','fixture-1','manual');
  insert into public.collection_items(organisation_id,collection_id,product_id)
    values ('10000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001');
  insert into public.shows(id,organisation_id,name,origin)
    values ('93000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Fixture show 1','manual');
  insert into public.show_versions(show_id,organisation_id,number,cues,duration_ms)
    values ('93000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1,tests.show_cues(),6000);
  update public.shows set current_version_id = (select id from public.show_versions where show_id = '93000000-0000-0000-0000-000000000001'),status = 'live' where id = '93000000-0000-0000-0000-000000000001';
  insert into public.campaigns(id,organisation_id,name)
    values ('94000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Fixture campaign 1');
  insert into public.qr_codes(id,organisation_id,store_id,slug,target_type,target_id,campaign_id)
    values ('95000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','fixture-1','show','93000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000001');
  insert into public.label_batches(id,organisation_id,qr_code_ids,size)
    values ('96000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',array['95000000-0000-0000-0000-000000000001'::uuid],'a6_card');
  insert into public.stores(id,organisation_id,name,slug,market,timezone,licence)
    values ('90000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Fixture store 2','fixture-2','GB','Europe/London','all_year');
  insert into public.range_items(id,organisation_id,product_id,price_minor,currency)
    values ('91000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000001',2500,'GBP');
  insert into public.store_items(organisation_id,store_id,range_item_id)
    values ('10000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000002');
  insert into public.stock_movements(organisation_id,store_id,range_item_id,delta,qty_after,source)
    values ('10000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000002',10,999,'manual');
  insert into public.collections(id,organisation_id,name,slug,kind)
    values ('92000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Fixture collection 2','fixture-2','manual');
  insert into public.collection_items(organisation_id,collection_id,product_id)
    values ('10000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000001');
  insert into public.shows(id,organisation_id,name,origin)
    values ('93000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Fixture show 2','manual');
  insert into public.show_versions(show_id,organisation_id,number,cues,duration_ms)
    values ('93000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',1,tests.show_cues(),6000);
  update public.shows set current_version_id = (select id from public.show_versions where show_id = '93000000-0000-0000-0000-000000000002'),status = 'live' where id = '93000000-0000-0000-0000-000000000002';
  insert into public.campaigns(id,organisation_id,name)
    values ('94000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Fixture campaign 2');
  insert into public.qr_codes(id,organisation_id,store_id,slug,target_type,target_id,campaign_id)
    values ('95000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','fixture-2','show','93000000-0000-0000-0000-000000000002','94000000-0000-0000-0000-000000000002');
  insert into public.label_batches(id,organisation_id,qr_code_ids,size)
    values ('96000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',array['95000000-0000-0000-0000-000000000002'::uuid],'a6_card');
  insert into public.memberships(organisation_id,profile_id,role,store_ids)
    values ('10000000-0000-0000-0000-000000000001',tests.get_supabase_uid('retailer_staff'),'staff',
      array['90000000-0000-0000-0000-000000000001'::uuid]);
  insert into public.shows(id,owner_id,name,origin)
    values ('93000000-0000-0000-0000-000000000003',tests.get_supabase_uid('signed_in_shopper'),'Private shopper show','manual');
  insert into public.show_versions(show_id,owner_id,number,cues,duration_ms)
    values ('93000000-0000-0000-0000-000000000003',tests.get_supabase_uid('signed_in_shopper'),1,tests.show_cues(),6000);
  update public.shows set current_version_id = (select id from public.show_versions where show_id = '93000000-0000-0000-0000-000000000003'),status = 'live' where id = '93000000-0000-0000-0000-000000000003';
end;
$$;
comment on function tests.create_range_fixture() is 'Creates ranges, movement history, collections, retailer shows and QR labels for two organisations plus a private shopper show.';
