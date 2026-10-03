-- Unchecked example market rules from the prototype kit, for testing only.
begin;
insert into public.markets(code,name,currency,locale,timezone,min_age,units,regions,licence_note,enabled) values
('GB','United Kingdom','GBP','en-GB','Europe/London',18,'metric',array['England','Scotland','Wales','Northern Ireland'],'Unchecked: All-year licence needed outside sale periods',true),
('US','United States','USD','en-US','America/New_York',16,'imperial',array['Texas','Missouri','Pennsylvania','Ohio','Florida','Indiana'],'Unchecked: Rules and age limits vary by state and county',true),
('DE','Germany','EUR','de-DE','Europe/Berlin',18,'metric',array['Bayern','Berlin','Hamburg','Nordrhein-Westfalen'],'Unchecked: Category F2 sales only in the last three working days of the year',true),
('AU','Australia','AUD','en-AU','Australia/Sydney',18,'metric',array['Tasmania','Northern Territory'],'Unchecked: Consumer sales are very limited; most states allow licensed displays only',true);
insert into public.sale_periods(market,region,name,rule) values
('GB',null,'Bonfire Night','{"type":"fixed","from":"10-15","to":"11-10"}'),
('GB',null,'New Year','{"type":"fixed","from":"12-26","to":"12-31"}'),
('GB',null,'Diwali','{"type":"before_feast","feast":"diwali","days":3}'),
('GB',null,'Chinese New Year','{"type":"before_feast","feast":"chinese_new_year","days":3}'),
('US',null,'Independence Day','{"type":"fixed","from":"06-20","to":"07-06"}'),
('US',null,'New Year','{"type":"fixed","from":"12-20","to":"01-01"}'),
('DE',null,'Silvester','{"type":"fixed","from":"12-29","to":"12-31","unchecked":true}'),
('AU','Northern Territory','Territory Day','{"type":"fixed","from":"07-01","to":"07-01"}');
-- Garden distances in metres from the prototype planner; categories outside GB are illustrative.
insert into public.safety_bands(market,band,max_distance_m,allowed_categories)
select market.code, band.name, band.distance, band.categories
from public.markets as market cross join (values
('small',8,array['F2']),('medium',15,array['F2']),('large',25,array['F2','F3'])
) as band(name,distance,categories);
-- Prototype retailer entitlements, not commercial billing prices.
insert into public.plans(key,name,max_stores,monthly_credits) values
('starter','Starter',1,20),('store','Store',3,500),('chain','Chain',null,2000);
-- Owner contract: one credit per session; edits and naming are included.
insert into public.credit_prices(action,credits) values
('plan_session',1),('chat_edit',0),('show_naming',0);
commit;
