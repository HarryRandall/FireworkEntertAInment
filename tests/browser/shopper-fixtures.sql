-- Repeatable synthetic QR journey fixtures, confined to the local demo shop.
begin;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);
do $$
declare
  v_product uuid;
  v_pack uuid;
  v_range uuid;
begin
  select id into strict v_product from public.products where slug = 'demo-heart';
  select id into v_pack from public.products where slug = 'browser-selection-pack';
  if v_pack is null then
    v_pack := public.create_pack('browser-selection-pack','Garden selection pack');
    perform public.save_pack_items(v_pack,jsonb_build_array(jsonb_build_object('item_id',v_product,'quantity',2)));
    perform public.confirm_product_safety(v_pack,8::smallint,1::smallint,'[{"market":"GB","legal_category":"F2","min_age":18}]');
    perform public.publish_pack(v_pack);
    insert into public.range_items(organisation_id,product_id,price_minor,currency)
      values ('30000000-0000-4000-8000-000000000001',v_pack,3998,'GBP') returning id into v_range;
    insert into public.store_items(organisation_id,store_id,range_item_id)
      values ('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',v_range);
    perform public.record_stock('40000000-0000-4000-8000-000000000001',v_range,10,'manual','browser-fixture');
  end if;
  insert into public.qr_codes(organisation_id,store_id,slug,target_type,target_id,status) values
    ('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','browser-product','product',v_product,'live'),
    ('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','browser-pack','pack',v_pack,'live'),
    ('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','browser-retired','product',v_product,'archived'),
    ('30000000-0000-4000-8000-000000000001',null,'browser-organisation','product',v_product,'live')
    on conflict (slug) do nothing;
end;
$$;
commit;
