-- Shopper event vocabulary and consent checked at the final write boundary.
select no_plan();
select tests.create_operations_fixture();
select tests.act_as('signed_in_shopper');
select lives_ok(format('select public.track_event(%L,%L)',kind,'90000000-0000-0000-0000-000000000001'),kind || ' accepted')
from unnest(array['store_view','product_view','something_different','list_saved','till_code_shown']) as kind;
reset role;
select is((select count(*) from public.events where type in ('store_view','product_view','something_different','list_saved','till_code_shown')),5::bigint,'all additional shopper types appended');
select private.rollup_events(now() - interval '1 hour',now() + interval '1 second');
select is((select count(*) from public.metrics_daily where metric in ('store_views','product_views','alternatives','list_saves','till_code_views')),5::bigint,'new event kinds reach retailer rollups');
update public.follows set visible_to_shop = false, marketing_opt_in = true
where shopper_id = tests.get_supabase_uid('signed_in_shopper');
select tests.act_as('signed_in_shopper');
select is(public.track_event('store_view','90000000-0000-0000-0000-000000000001','{}','opt-out'),null::bigint,'explicit activity refusal drops event despite marketing opt-in');
reset role;
select is((select count(*) from public.events where session_key = 'opt-out'),0::bigint,'no raw opted-out event');
update public.follows set visible_to_shop = true, marketing_opt_in = false
where shopper_id = tests.get_supabase_uid('signed_in_shopper');
select tests.act_as('signed_in_shopper');
select lives_ok($$select public.track_event('store_view','90000000-0000-0000-0000-000000000001','{}','opt-in')$$,'activity sharing does not require marketing');
reset role;
select is((select count(*) from public.events where session_key = 'opt-in'),1::bigint,'activity tracking resumes after opt-in');
select tests.act_as_public();
select ok(not has_function_privilege(current_user,'public.track_event(text,uuid,jsonb,text,jsonb)','execute'),'public callers cannot append events');
select ok(not has_function_privilege(current_user,'private.track_event(text,uuid,jsonb,text,jsonb)','execute'),'public callers cannot bypass wrapper');
reset role;
select * from finish();
