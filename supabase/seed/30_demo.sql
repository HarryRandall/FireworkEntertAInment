-- Synthetic Hartley retailer data, with prototype names and illustrative safety facts.
begin;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);
insert into public.organisations(id,name,slug,kind,home_market,billing_currency,status) values
('30000000-0000-4000-8000-000000000001','Hartley Fireworks','hartley-fireworks','shop','GB','GBP','active'),
('30000000-0000-4000-8000-000000000002','Other Demo Shop','other-demo-shop','shop','GB','GBP','active');
insert into public.stores(id,organisation_id,name,slug,market,region,timezone,licence) values
('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Leeds, Kirkstall','leeds','GB','England','Europe/London','all_year'),
('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','York, Clifton Moor','york','GB','England','Europe/London','all_year'),
('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000002','Other Demo Store','other-store','GB','England','Europe/London','all_year');
insert into public.memberships(organisation_id,profile_id,role,store_ids) values
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','owner',null),
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','manager',array['40000000-0000-4000-8000-000000000001']::uuid[]),
('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000005','owner',null);
insert into public.branding(organisation_id,accent,welcome) values
('30000000-0000-4000-8000-000000000001','#0f7a52','Welcome to Hartley Fireworks');
insert into public.billing_accounts(organisation_id,plan_key,subscription_status,store_quantity) values
('30000000-0000-4000-8000-000000000001','store','active',2);
insert into public.credit_ledger(organisation_id,delta,reason,idempotency_key,actor_id) values
('30000000-0000-4000-8000-000000000001',340,'grant','demo-opening-credit','10000000-0000-4000-8000-000000000001');

-- Distances (metres) and noise ordinals are unchecked test facts, not supplier evidence.
do $$
#variable_conflict error
declare
  v_item record;
  v_version uuid;
  v_product uuid;
  v_range uuid;
  v_store record;
begin
  for v_item in select * from (values
    ('heart','Heart Burst','single',1999,22),
    ('waterfall','Golden Waterfall','single',4999,6),
    ('silverFountain','Silver Fountain','fountain',1199,55),
    ('wheel','Spinning Wheel','wheel',1450,18)
  ) as fixture(key,name,kind,price_minor,stock_units) loop
    v_version := public.create_product_draft(null,'demo-' || v_item.key,v_item.name,v_item.kind,
      '{"tubes":[{"i":0,"letter":"a","t_ms":0,"angle_deg":0}]}',
      jsonb_build_object('a',(select effect.id from public.effects as effect where effect.slug = v_item.key)));
    select version.product_id into v_product from public.product_versions as version where version.id = v_version;
    update public.products set min_safety_distance_m = 8, noise_level = 1,
      safety_supplied_by = '10000000-0000-4000-8000-000000000004',
      safety_supplier_id = '20000000-0000-4000-8000-000000000001',
      safety_confirmed_by = '10000000-0000-4000-8000-000000000001', safety_confirmed_at = now(),
      description = 'Synthetic demonstration product; safety facts are unchecked.' where id = v_product;
    insert into public.product_markets(product_id,market,legal_category,min_age,supplied_by,confirmed_by,confirmed_at)
    values (v_product,'GB','F2',18,'10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001',now());
    perform public.publish_product_version(v_version);
    insert into public.range_items(organisation_id,product_id,price_minor,currency,added_via)
    values ('30000000-0000-4000-8000-000000000001',v_product,v_item.price_minor,'GBP','catalogue') returning id into v_range;
    for v_store in select store.id from public.stores as store where store.organisation_id = '30000000-0000-4000-8000-000000000001' loop
      insert into public.store_items(store_id,range_item_id,organisation_id) values
      (v_store.id,v_range,'30000000-0000-4000-8000-000000000001');
      perform public.record_stock(v_store.id,v_range,v_item.stock_units,'manual','demo-opening-stock');
    end loop;
  end loop;
end;
$$;
insert into public.collections(id,organisation_id,name,slug,kind) values
('50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Garden favourites','garden-favourites','manual');
insert into public.collection_items(collection_id,organisation_id,product_id,sort)
select '50000000-0000-4000-8000-000000000001',item.organisation_id,item.product_id,
  row_number() over (order by item.price_minor) from public.range_items as item;
insert into public.shows(id,organisation_id,name,origin) values
('60000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Family Garden Show','manual'),
('60000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','Backyard Finale','manual');
-- Demo launch spacing is 30 seconds, in milliseconds; it is illustrative rather than a solved plan.
select public.save_show(show.id,
  (select jsonb_agg(jsonb_build_object('t_ms',cue.ordinal * 30000,'product_id',cue.id,'position',0,'angle_deg',0) order by cue.ordinal)
   from (select product.id,row_number() over (order by product.slug) - 1 as ordinal from public.products as product) as cue),
  130000) from public.shows as show;
update public.shows set status = 'live';
insert into public.qr_codes(organisation_id,store_id,slug,target_type,target_id,placement,label_text) values
('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','hartley-leeds','store',null,'counter_card','Hartley Leeds'),
('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','hartley-york','planner',null,'counter_card','Plan your show'),
('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','hartley-family','show','60000000-0000-4000-8000-000000000001','till','Family Garden Show'),
('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','hartley-garden','collection','50000000-0000-4000-8000-000000000001','end_cap','Garden favourites');
commit;
