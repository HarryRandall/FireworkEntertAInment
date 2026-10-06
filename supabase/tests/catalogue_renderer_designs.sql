begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select is((select count(*)::integer from public.firework_effects where design is not null), 102,
  'all catalogue effects have renderer designs');
select is((select count(*)::integer from public.fireworks where design is not null), 166,
  'all catalogue fireworks have renderer designs');
select is((select count(*)::integer from public.catalogue_items where part_number like 'renderer-%' and not is_listed), 76,
  'library products stay unlisted');
select is((select count(*)::integer from public.firework_preview_images), 307,
  'effects and fireworks retain one preview manifest each');
select is((select count(*)::integer from public.catalogue_items where part_number like 'renderer-%' and finale_product_id is not null), 0,
  'library products do not invent supplier product identifiers');

set local role anon;
select is((select count(*)::integer from public.catalogue_items where part_number like 'renderer-%'), 0,
  'anonymous catalogue reads cannot see library products');
reset role;
set local role authenticated;
select is((select count(*)::integer from public.catalogue_items where part_number like 'renderer-%'), 0,
  'ordinary authenticated catalogue reads cannot see library products');
reset role;

select * from finish();
rollback;
