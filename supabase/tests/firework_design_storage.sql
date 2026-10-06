begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- This complete renderer fixture checks stored values without applying defaults.
create function pg_temp.valid_design() returns jsonb language sql as $function$
  select $design${
  "kind": "comet",
  "launch": null,
  "breaks": [],
  "ground": {
    "kind": "comet",
    "comets": {
      "count": 1,
      "pattern": "straight",
      "spread_deg": 0,
      "height_m": 50,
      "time_s": 2.2,
      "colour": {
        "mode": "solid",
        "stops": [
          [
            0,
            "#ff3048"
          ],
          [
            0.55,
            "#ff3048"
          ],
          [
            0.65,
            "#ffffff"
          ],
          [
            1,
            "#ffffff"
          ]
        ],
        "reignition": {
          "at": 0.55,
          "duration": 0.1,
          "amount": 0
        }
      },
      "trail": "house",
      "size": 2.2,
      "sparks": 200,
      "tail_life_s": 1.4,
      "glitter": 0,
      "gap_s": 0.5,
      "spin_rad_s": 0,
      "spin_radius_m": 2.2,
      "pop": false,
      "split": null,
      "halo": 1,
      "whistle": false
    }
  },
  "sound": {
    "lift": 0.7,
    "break": 0,
    "crackle": 0,
    "whistle": 0
  },
  "seed": 11
}$design$::jsonb;
$function$;
grant execute on function pg_temp.valid_design() to anon, authenticated;

select is((select count(*) from public.catalogue_items where manufacturer is not null), 51::bigint, '51 supplier products');
select is((select count(*) from public.catalogue_items where manufacturer is null), 93::bigint, '93 generated catalogue entries');
select ok(not exists(select 1 from public.catalogue_items where
  finale_product_id is distinct from case when manufacturer is not null then part_number end), 'Finale backfill matches supplier rule');
select ok(not exists(select 1 from public.catalogue_items where finale_effect_name is not null), 'Effect names remain unspecified');

insert into auth.users(id,email,email_confirmed_at) values
('94000000-0000-4000-8000-000000000001','design-admin@example.test',now()),
('94000000-0000-4000-8000-000000000002','design-member@example.test',now());
insert into public.user_roles(user_id,role_id)
select '94000000-0000-4000-8000-000000000001',id from public.roles where key='admin'
on conflict(user_id) do update set role_id=excluded.role_id;

insert into public.firework_effects(id,slug,name,pattern_key,model_json)
values ('94000000-0000-4000-8000-000000000011','design-test-effect','Design effect','sphere','{}'),
       ('94000000-0000-4000-8000-000000000012','design-test-other','Other effect','sphere','{}');
insert into public.fireworks(id,slug,name,firework_effect_id,render_overrides_json)
values ('94000000-0000-4000-8000-000000000013','design-test-firework','Design firework',
'94000000-0000-4000-8000-000000000011','{"geometry":"sphere","stars":{"outer":{"head":{}}},"launch":{"shell":{}}}');
update public.catalogue_items set is_listed=false where firework_id='94000000-0000-4000-8000-000000000013';
create temporary table design_read_rows as
select 'firework_effects'::text as relation,id,true as listed from public.firework_effects
union all select 'fireworks',id,true from public.fireworks
union all select 'catalogue_items',id,is_listed from public.catalogue_items;
grant select on design_read_rows to anon,authenticated;
create temporary table legacy_render as select render_overrides_json,render_snapshot_json from public.fireworks
where id='94000000-0000-4000-8000-000000000013';

select set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$update public.firework_effects set design=pg_temp.valid_design(), template_key='test-comet'
where id='94000000-0000-4000-8000-000000000011'$$, 'Admin stores valid effect design');
select lives_ok($$update public.fireworks set design=pg_temp.valid_design()
where id='94000000-0000-4000-8000-000000000013'$$, 'Admin stores valid firework design');
select throws_ok($$update public.firework_effects set design=jsonb_set(pg_temp.valid_design(),'{kind}','"invalid"') where id='94000000-0000-4000-8000-000000000011'$$, '23514', null, 'firework_effects rejects invalid kind');
select throws_ok($$update public.firework_effects set design=pg_temp.valid_design() || '{"unexpected":true}'::jsonb where id='94000000-0000-4000-8000-000000000011'$$, '23514', null, 'firework_effects rejects unknown property');
select throws_ok($$update public.firework_effects set design=jsonb_set(pg_temp.valid_design(),'{seed}','4294967296') where id='94000000-0000-4000-8000-000000000011'$$, '23514', null, 'firework_effects rejects out-of-range seed');
select throws_ok($$update public.firework_effects set design=pg_temp.valid_design() - 'seed' where id='94000000-0000-4000-8000-000000000011'$$, '23514', null, 'firework_effects rejects missing required field');
select throws_ok($$update public.firework_effects set design='null'::jsonb where id='94000000-0000-4000-8000-000000000011'$$, '23514', null, 'firework_effects rejects JSON null');
select throws_ok($$update public.firework_effects set design_schema=2 where id='94000000-0000-4000-8000-000000000011'$$, '23514', null, 'firework_effects rejects unsupported version');
select throws_ok($$update public.fireworks set design=jsonb_set(pg_temp.valid_design(),'{kind}','"invalid"') where id='94000000-0000-4000-8000-000000000013'$$, '23514', null, 'fireworks rejects invalid kind');
select throws_ok($$update public.fireworks set design=pg_temp.valid_design() || '{"unexpected":true}'::jsonb where id='94000000-0000-4000-8000-000000000013'$$, '23514', null, 'fireworks rejects unknown property');
select throws_ok($$update public.fireworks set design=jsonb_set(pg_temp.valid_design(),'{seed}','4294967296') where id='94000000-0000-4000-8000-000000000013'$$, '23514', null, 'fireworks rejects out-of-range seed');
select throws_ok($$update public.fireworks set design=pg_temp.valid_design() - 'seed' where id='94000000-0000-4000-8000-000000000013'$$, '23514', null, 'fireworks rejects missing required field');
select throws_ok($$update public.fireworks set design='null'::jsonb where id='94000000-0000-4000-8000-000000000013'$$, '23514', null, 'fireworks rejects JSON null');
select throws_ok($$update public.fireworks set design_schema=2 where id='94000000-0000-4000-8000-000000000013'$$, '23514', null, 'fireworks rejects unsupported version');
select lives_ok($$select public.save_firework_editor('effect',
  '94000000-0000-4000-8000-000000000011',
  (select updated_at from public.firework_effects where id='94000000-0000-4000-8000-000000000011'),
  '{"name":"Saved legacy effect"}',gen_random_uuid())$$, 'Legacy effect RPC still saves');
select lives_ok($$select public.save_firework_editor('firework',
  '94000000-0000-4000-8000-000000000013',
  (select updated_at from public.fireworks where id='94000000-0000-4000-8000-000000000013'),
  '{"name":"Saved legacy firework"}',gen_random_uuid())$$, 'Legacy firework RPC still saves');
select throws_ok($$select public.save_firework_editor('effect',
  '94000000-0000-4000-8000-000000000011',
  (select updated_at from public.firework_effects where id='94000000-0000-4000-8000-000000000011'),
  '{"design":null}',gen_random_uuid())$$, '22023', 'Unsupported editor field.', 'Editor design allowlist remains unchanged');
select throws_ok($$update public.firework_effects set template_key='test-comet'
where id='94000000-0000-4000-8000-000000000012'$$, '23505', null, 'Duplicate template keys rejected');
select lives_ok($$update public.catalogue_items set finale_product_id='CS642401 D',finale_effect_name='Silver Chrysanthemum Crackle'
where firework_id='94000000-0000-4000-8000-000000000013'$$, 'Admin writes Finale mappings on unlisted products');
select throws_ok($$update public.catalogue_items set finale_product_id='' where firework_id='94000000-0000-4000-8000-000000000013'$$, '23514', null, 'finale_product_id format case 1 rejected');
select throws_ok($$update public.catalogue_items set finale_product_id=' leading' where firework_id='94000000-0000-4000-8000-000000000013'$$, '23514', null, 'finale_product_id format case 2 rejected');
select throws_ok($$update public.catalogue_items set finale_product_id=repeat('x',129) where firework_id='94000000-0000-4000-8000-000000000013'$$, '23514', null, 'finale_product_id format case 3 rejected');
select throws_ok($$update public.catalogue_items set finale_product_id=E'line\nfeed' where firework_id='94000000-0000-4000-8000-000000000013'$$, '23514', null, 'finale_product_id format case 4 rejected');
select throws_ok($$update public.catalogue_items set finale_effect_name='' where firework_id='94000000-0000-4000-8000-000000000013'$$, '23514', null, 'finale_effect_name format case 1 rejected');
select throws_ok($$update public.catalogue_items set finale_effect_name='trailing ' where firework_id='94000000-0000-4000-8000-000000000013'$$, '23514', null, 'finale_effect_name format case 2 rejected');
select throws_ok($$update public.catalogue_items set finale_effect_name=repeat('x',257) where firework_id='94000000-0000-4000-8000-000000000013'$$, '23514', null, 'finale_effect_name format case 3 rejected');
select throws_ok($$update public.catalogue_items set finale_effect_name=E'tab\tname' where firework_id='94000000-0000-4000-8000-000000000013'$$, '23514', null, 'finale_effect_name format case 4 rejected');
select results_eq('select id from public.catalogue_items order by id',
  'select id from design_read_rows where relation=''catalogue_items'' order by id', 'Admin sees unlisted catalogue rows');
reset role;
select results_eq('select render_overrides_json,render_snapshot_json from public.fireworks where id=''94000000-0000-4000-8000-000000000013''',
  'select * from legacy_render', 'Design writes preserve the legacy render snapshot');

select set_config('request.jwt.claim.sub','',true);
set local role anon;
select is((select design from public.firework_effects where id='94000000-0000-4000-8000-000000000011'),
  pg_temp.valid_design(), 'anon reads populated effect designs after legacy RPC save');
select is((select design from public.fireworks where id='94000000-0000-4000-8000-000000000013'),
  pg_temp.valid_design(), 'anon reads populated firework designs after legacy RPC save');
select is((select template_key from public.firework_effects where id='94000000-0000-4000-8000-000000000011'),
  'test-comet', 'anon reads template keys');
select ok(exists(select 1 from public.catalogue_items where manufacturer is not null
  and finale_product_id=part_number), 'anon reads populated Finale mappings');
select results_eq('select id from (select id,name,design,design_schema,template_key from public.firework_effects) t order by id', 'select id from design_read_rows where relation=''firework_effects'' and listed order by id', 'anon new and old firework_effects columns expose the same rows');
select ok(has_column_privilege('anon','public.firework_effects','design','SELECT') = has_column_privilege('anon','public.firework_effects','name','SELECT'), 'anon firework_effects.design read grant matches');
select ok(has_column_privilege('anon','public.firework_effects','design_schema','SELECT') = has_column_privilege('anon','public.firework_effects','name','SELECT'), 'anon firework_effects.design_schema read grant matches');
select ok(has_column_privilege('anon','public.firework_effects','template_key','SELECT') = has_column_privilege('anon','public.firework_effects','name','SELECT'), 'anon firework_effects.template_key read grant matches');
select results_eq('select id from (select id,name,design,design_schema from public.fireworks) t order by id', 'select id from design_read_rows where relation=''fireworks'' and listed order by id', 'anon new and old fireworks columns expose the same rows');
select ok(has_column_privilege('anon','public.fireworks','design','SELECT') = has_column_privilege('anon','public.fireworks','name','SELECT'), 'anon fireworks.design read grant matches');
select ok(has_column_privilege('anon','public.fireworks','design_schema','SELECT') = has_column_privilege('anon','public.fireworks','name','SELECT'), 'anon fireworks.design_schema read grant matches');
select results_eq('select id from (select id,name,finale_product_id,finale_effect_name from public.catalogue_items) t order by id', 'select id from design_read_rows where relation=''catalogue_items'' and listed order by id', 'anon new and old catalogue_items columns expose the same rows');
select ok(has_column_privilege('anon','public.catalogue_items','finale_product_id','SELECT') = has_column_privilege('anon','public.catalogue_items','name','SELECT'), 'anon catalogue_items.finale_product_id read grant matches');
select ok(has_column_privilege('anon','public.catalogue_items','finale_effect_name','SELECT') = has_column_privilege('anon','public.catalogue_items','name','SELECT'), 'anon catalogue_items.finale_effect_name read grant matches');
select throws_ok($$update public.firework_effects set design=null$$, '42501', null, 'Anonymous firework_effects writes denied');
select throws_ok($$update public.fireworks set design=null$$, '42501', null, 'Anonymous fireworks writes denied');
select throws_ok($$update public.catalogue_items set finale_product_id=null$$, '42501', null, 'Anonymous catalogue_items writes denied');
reset role;
select set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is((select design from public.firework_effects where id='94000000-0000-4000-8000-000000000011'),
  pg_temp.valid_design(), 'authenticated reads populated effect designs after legacy RPC save');
select is((select design from public.fireworks where id='94000000-0000-4000-8000-000000000013'),
  pg_temp.valid_design(), 'authenticated reads populated firework designs after legacy RPC save');
select is((select template_key from public.firework_effects where id='94000000-0000-4000-8000-000000000011'),
  'test-comet', 'authenticated reads template keys');
select ok(exists(select 1 from public.catalogue_items where manufacturer is not null
  and finale_product_id=part_number), 'authenticated reads populated Finale mappings');
select results_eq('select id from (select id,name,design,design_schema,template_key from public.firework_effects) t order by id', 'select id from design_read_rows where relation=''firework_effects'' and listed order by id', 'authenticated new and old firework_effects columns expose the same rows');
select ok(has_column_privilege('authenticated','public.firework_effects','design','SELECT') = has_column_privilege('authenticated','public.firework_effects','name','SELECT'), 'authenticated firework_effects.design read grant matches');
select ok(has_column_privilege('authenticated','public.firework_effects','design_schema','SELECT') = has_column_privilege('authenticated','public.firework_effects','name','SELECT'), 'authenticated firework_effects.design_schema read grant matches');
select ok(has_column_privilege('authenticated','public.firework_effects','template_key','SELECT') = has_column_privilege('authenticated','public.firework_effects','name','SELECT'), 'authenticated firework_effects.template_key read grant matches');
select results_eq('select id from (select id,name,design,design_schema from public.fireworks) t order by id', 'select id from design_read_rows where relation=''fireworks'' and listed order by id', 'authenticated new and old fireworks columns expose the same rows');
select ok(has_column_privilege('authenticated','public.fireworks','design','SELECT') = has_column_privilege('authenticated','public.fireworks','name','SELECT'), 'authenticated fireworks.design read grant matches');
select ok(has_column_privilege('authenticated','public.fireworks','design_schema','SELECT') = has_column_privilege('authenticated','public.fireworks','name','SELECT'), 'authenticated fireworks.design_schema read grant matches');
select results_eq('select id from (select id,name,finale_product_id,finale_effect_name from public.catalogue_items) t order by id', 'select id from design_read_rows where relation=''catalogue_items'' and listed order by id', 'authenticated new and old catalogue_items columns expose the same rows');
select ok(has_column_privilege('authenticated','public.catalogue_items','finale_product_id','SELECT') = has_column_privilege('authenticated','public.catalogue_items','name','SELECT'), 'authenticated catalogue_items.finale_product_id read grant matches');
select ok(has_column_privilege('authenticated','public.catalogue_items','finale_effect_name','SELECT') = has_column_privilege('authenticated','public.catalogue_items','name','SELECT'), 'authenticated catalogue_items.finale_effect_name read grant matches');
select is_empty($$update public.firework_effects set design=null returning id$$, 'Ordinary member firework_effects writes affect no rows');
select is_empty($$update public.fireworks set design=null returning id$$, 'Ordinary member fireworks writes affect no rows');
select is_empty($$update public.catalogue_items set finale_product_id=null returning id$$, 'Ordinary member catalogue_items writes affect no rows');
reset role;
select lives_ok($$update public.firework_effects set design=null,template_key=null$$, 'SQL null design and multiple null template keys remain valid');
select lives_ok($$update public.fireworks set design=null$$, 'SQL null firework designs remain valid');
select * from finish();
rollback;
