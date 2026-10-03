-- Policy mutations run as the caller, so row counts prove RLS rather than owner access.
select no_plan();
select tests.create_personas();

-- Executes fixture SQL without elevating the caller and returns the affected row count.
create function tests.affected_rows(statement text)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  affected bigint;
begin
  execute statement;
  get diagnostics affected = row_count;
  return affected;
end;
$$;
insert into public.markets (code, name, currency, locale, timezone, min_age, units, enabled)
values ('GB', 'United Kingdom', 'GBP', 'en-GB', 'Europe/London', 18, 'metric', true),
       ('US', 'United States', 'USD', 'en-US', 'America/New_York', 18, 'imperial', false),
       ('DE', 'Germany', 'EUR', 'de-DE', 'Europe/Berlin', 18, 'metric', true),
       ('AU', 'Australia', 'AUD', 'en-AU', 'Australia/Sydney', 18, 'metric', true);
insert into public.staff_roles (profile_id, role) values (tests.get_supabase_uid('platform_staff'), 'super_admin');
insert into public.sale_periods (id, market, name, rule)
values ('30000000-0000-0000-0000-000000000001', 'GB', 'Example sale', '{"type":"fixed","from":"10-15","to":"11-10"}'),
       ('30000000-0000-0000-0000-000000000002', 'US', 'Disabled market sale', '{}');
insert into public.safety_bands (market, band, max_distance_m, allowed_categories)
values ('GB', 'small', 8, '{F2}'), ('US', 'small', 8, '{F2}');
reset role;
select tests.act_as_public();
select is((select count(*) from public.markets where code = 'GB'), 1::bigint, 'markets select allows enabled market reference data');
select is((select count(*) from public.markets where code = 'US'), 0::bigint, 'markets select hides disabled market data from public');
select is((select count(*) from public.sale_periods where market = 'GB'), 1::bigint, 'sale_periods select allows enabled market reference data');
select is((select count(*) from public.sale_periods where market = 'US'), 0::bigint, 'sale_periods select hides disabled market data from public');
select is((select count(*) from public.safety_bands where market = 'GB'), 1::bigint, 'safety_bands select allows enabled market reference data');
select is((select count(*) from public.safety_bands where market = 'US'), 0::bigint, 'safety_bands select hides disabled market data from public');
reset role;
select tests.act_as('platform_staff');
select is((select count(*) from public.markets where code = 'US'), 1::bigint, 'staff can review disabled markets');
select is((select count(*) from public.sale_periods where market = 'US'), 1::bigint, 'staff can review disabled sale_periods');
select is((select count(*) from public.safety_bands where market = 'US'), 1::bigint, 'staff can review disabled safety_bands');
reset role;
select tests.act_as('organisation_owner');
select throws_ok($query$insert into public.markets (code, name, currency, locale, timezone, min_age, units) values ('ZZ', 'Test market', 'GBP', 'en-GB', 'Europe/London', 18, 'metric')$query$, '42501', null, 'markets insert denies retailer');
reset role;
select tests.act_as('platform_staff');
select is((select tests.affected_rows($query$insert into public.markets (code, name, currency, locale, timezone, min_age, units) values ('ZZ', 'Test market', 'GBP', 'en-GB', 'Europe/London', 18, 'metric')$query$)), 1::bigint, 'markets insert allows administrator');
reset role;
select tests.act_as('organisation_owner');
select is((select tests.affected_rows($query$update public.markets set name = 'Edited market' where code = 'GB'$query$)), 0::bigint, 'markets update denies retailer');
reset role;
select tests.act_as('platform_staff');
select is((select tests.affected_rows($query$update public.markets set name = 'Edited market' where code = 'GB'$query$)), 1::bigint, 'markets update allows administrator');
reset role;
select tests.act_as('organisation_owner');
select is((select tests.affected_rows($query$delete from public.markets where code = 'ZZ'$query$)), 0::bigint, 'markets delete denies retailer');
reset role;
select tests.act_as('platform_staff');
select is((select tests.affected_rows($query$delete from public.markets where code = 'ZZ'$query$)), 1::bigint, 'markets delete allows administrator');
reset role;
select tests.act_as('organisation_owner');
select throws_ok($query$insert into public.sale_periods (id, market, name, rule) values ('30000000-0000-0000-0000-000000000003', 'GB', 'New sale', '{}')$query$, '42501', null, 'sale_periods insert denies retailer');
reset role;
select tests.act_as('platform_staff');
select is((select tests.affected_rows($query$insert into public.sale_periods (id, market, name, rule) values ('30000000-0000-0000-0000-000000000003', 'GB', 'New sale', '{}')$query$)), 1::bigint, 'sale_periods insert allows administrator');
reset role;
select tests.act_as('organisation_owner');
select is((select tests.affected_rows($query$update public.sale_periods set name = 'Edited sale' where id = '30000000-0000-0000-0000-000000000001'$query$)), 0::bigint, 'sale_periods update denies retailer');
reset role;
select tests.act_as('platform_staff');
select is((select tests.affected_rows($query$update public.sale_periods set name = 'Edited sale' where id = '30000000-0000-0000-0000-000000000001'$query$)), 1::bigint, 'sale_periods update allows administrator');
reset role;
select tests.act_as('organisation_owner');
select is((select tests.affected_rows($query$delete from public.sale_periods where id = '30000000-0000-0000-0000-000000000003'$query$)), 0::bigint, 'sale_periods delete denies retailer');
reset role;
select tests.act_as('platform_staff');
select is((select tests.affected_rows($query$delete from public.sale_periods where id = '30000000-0000-0000-0000-000000000003'$query$)), 1::bigint, 'sale_periods delete allows administrator');
reset role;
select tests.act_as('organisation_owner');
select throws_ok($query$insert into public.safety_bands (market, band, max_distance_m, allowed_categories) values ('GB', 'large', 25, '{F2}')$query$, '42501', null, 'safety_bands insert denies retailer');
reset role;
select tests.act_as('platform_staff');
select is((select tests.affected_rows($query$insert into public.safety_bands (market, band, max_distance_m, allowed_categories) values ('GB', 'large', 25, '{F2}')$query$)), 1::bigint, 'safety_bands insert allows administrator');
reset role;
select tests.act_as('organisation_owner');
select is((select tests.affected_rows($query$update public.safety_bands set max_distance_m = 10 where market = 'GB' and band = 'small'$query$)), 0::bigint, 'safety_bands update denies retailer');
reset role;
select tests.act_as('platform_staff');
select is((select tests.affected_rows($query$update public.safety_bands set max_distance_m = 10 where market = 'GB' and band = 'small'$query$)), 1::bigint, 'safety_bands update allows administrator');
reset role;
select tests.act_as('organisation_owner');
select is((select tests.affected_rows($query$delete from public.safety_bands where market = 'GB' and band = 'large'$query$)), 0::bigint, 'safety_bands delete denies retailer');
reset role;
select tests.act_as('platform_staff');
select is((select tests.affected_rows($query$delete from public.safety_bands where market = 'GB' and band = 'large'$query$)), 1::bigint, 'safety_bands delete allows administrator');
reset role;
update public.staff_roles set role = 'catalogue_editor' where profile_id = tests.get_supabase_uid('platform_staff');
reset role;
select tests.act_as('platform_staff');
select is((select tests.affected_rows($query$update public.markets set name = 'Edited market' where code = 'GB'$query$)), 1::bigint, 'catalogue editors can maintain market rules');
reset role;
update public.staff_roles set role = 'reviewer' where profile_id = tests.get_supabase_uid('platform_staff');
reset role;
select tests.act_as('platform_staff');
select is((select tests.affected_rows($query$update public.markets set name = 'Edited market' where code = 'GB'$query$)), 0::bigint, 'review staff cannot edit market rules');
reset role;
select * from finish();
