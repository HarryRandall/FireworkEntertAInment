-- Acceptance checks against installed local seeds, without clearing the demo data.
select no_plan();
select is((select count(*) from public.markets where enabled),4::bigint,'all four example markets are enabled');
select is((select count(*) from public.sale_periods),8::bigint,'prototype sale windows are installed');
select is((select count(*) from public.safety_bands),12::bigint,'each market has three garden bands');
select is((select count(*) from public.plans where active),3::bigint,'prototype plans are active');
select is((select credits from public.credit_prices where action = 'plan_session'),1,'a session costs one credit');
select is((select count(*) from public.effects where status = 'published'),99::bigint,'all canonical templates are published');
select is((select count(*) from public.effect_versions where status = 'published'),99::bigint,'each template has a published version');
select ok(not exists(select from public.effects as effect join public.effect_versions as version on version.id = effect.current_version_id
 where not extensions.jsonb_matches_schema(private.design_schema(),version.design)), 'all stored templates satisfy the design contract');
select is((select count(*) from public.stores where organisation_id = '30000000-0000-4000-8000-000000000001'),2::bigint,'Hartley has Leeds and York stores');
select is((select count(*) from public.products where status = 'published'),4::bigint,'demo range products are published');
select is((select count(*) from public.shows where status = 'live'),2::bigint,'both demo shows have available stock');
select is((select count(*) from public.qr_codes where status = 'live'),4::bigint,'demo QR targets are installed');
select is(private.credit_balance('30000000-0000-4000-8000-000000000001'),340::bigint,'demo retailer starts with prototype credit balance');
select is((select count(*) from auth.users where email like '%@showcrafter.test'),6::bigint,'six synthetic email personas exist');
select is((select count(*) from public.profiles where id = '10000000-0000-4000-8000-000000000007' and is_anonymous),1::bigint,'anonymous persona has a mirrored profile');
select tests.create_personas();
select tests.act_as_public();
select is((select count(*) from public.effects),99::bigint,'public clients can load every published template');
select ok(public.store_page('40000000-0000-4000-8000-000000000001') is not null,'Leeds store page resolves');
select ok(public.resolve_qr('hartley-family') is not null,'show QR resolves');
select ok(public.show_for_store('60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001') is not null,'seeded show playback resolves');
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
select is((select count(*) from public.range_items),4::bigint,'Hartley owner reads their range');
select is((select count(*) from public.organisations),1::bigint,'Hartley owner cannot read the other organisation');
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
select is((select count(*) from public.range_items),0::bigint,'other organisation cannot read Hartley range');
reset role;
-- Execute installed scheduler commands with the real demo catalogue still present.
set local timezone = 'UTC';
insert into public.events(type,organisation_id,store_id,occurred_at)
select 'scan','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
  now() - interval '1 day' from generate_series(1,2);
insert into public.events(type,organisation_id,store_id,occurred_at)
select 'scan','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
  now() from generate_series(1,3);
insert into public.lists(shopper_id,store_id,till_code,valid_until) values
  ('10000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000001','9100000000000001',current_date - 1),
  ('10000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000001','9100000000000002',current_date);
insert into public.invitations(organisation_id,email,role,token_hash,expires_at) values
  ('30000000-0000-4000-8000-000000000001','cron@showcrafter.test','staff','seeded-cron-expired',now() - interval '1 second');
insert into public.credit_reservations(organisation_id,credits,action,status,expires_at) values
  ('30000000-0000-4000-8000-000000000001',1,'plan_session','held',now() - interval '1 second');
-- The disposable anonymous seed has no retained history; signed-in identities stay.
update auth.users set created_at = now() - interval '31 days',last_sign_in_at = now() - interval '31 days'
  where id = '10000000-0000-4000-8000-000000000007';
update public.profiles set created_at = now() - interval '31 days',last_seen_at = now() - interval '31 days'
  where id = '10000000-0000-4000-8000-000000000007';
select lives_ok(job.command,job.jobname || ' executes on seeded data') from cron.job as job;
select is((select sum(value) from public.metrics_daily where metric = 'scans'),5::numeric,'daily scheduled rollups include both UTC dates');
select is((select sum(value) from public.metrics_hourly where metric = 'scans'),5::numeric,'hourly rollups preserve scans across daily and lookback commands');
select is((select status from public.lists where till_code = '9100000000000001'),'expired','scheduled cleanup expires yesterday list');
select is((select status from public.lists where till_code = '9100000000000002'),'open','scheduled cleanup preserves today list');
select ok((select revoked_at is not null from public.invitations where token_hash = 'seeded-cron-expired'),'scheduled cleanup revokes expired invitation');
select is((select status from public.credit_reservations where status = 'released'),'released','scheduled cleanup releases expired hold');
select ok(not exists(select from auth.users where id = '10000000-0000-4000-8000-000000000007'),'scheduled cleanup removes inactive disposable anonymous seed');
select lives_ok(job.command,job.jobname || ' reruns on seeded data') from cron.job as job;
select is((select sum(value) from public.metrics_daily where metric = 'scans'),5::numeric,'seeded daily rollups are idempotent');
select is((select sum(value) from public.metrics_hourly where metric = 'scans'),5::numeric,'seeded hourly rollups are idempotent');
select is((select count(*) from public.effects where status = 'published'),99::bigint,'maintenance preserves published templates');
select is((select count(*) from public.shows where status = 'live'),2::bigint,'stock reconciliation preserves available demo shows');
select is(private.credit_balance('30000000-0000-4000-8000-000000000001'),340::bigint,'maintenance preserves the demo ledger balance');
select is((select count(*) from auth.users where email like '%@showcrafter.test'),6::bigint,'maintenance preserves all signed-in seed accounts');
select * from finish();
