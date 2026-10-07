-- Isolated fixtures exercise the forward-only data repair without touching saved shows.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(5);
create temporary table launch_spacing_fixture (
  id integer primary key, site_width_feet integer, launch_positions_json jsonb
);
insert into launch_spacing_fixture values
  (1,80,'[{"x":-40,"y":2,"z":3,"label":"left"},{"x":0,"y":0,"z":0},{"x":40,"y":0,"z":0}]'),
  (2,80,'[{"x":-1219.2,"y":0,"z":0},{"x":1219.2,"y":0,"z":0}]'),
  (3,null,'[{"x":-40,"y":2,"z":3}]'),
  (4,80,'[{"x":-30,"y":2,"z":3}]'),
  (5,80,'[]');
create temporary table original_spacing as select * from launch_spacing_fixture;
-- Older site layouts stored feet where replay expects centimetres. Match only
-- the exact half-width footprint so modern layouts and custom staging stay intact.
update launch_spacing_fixture as show
set launch_positions_json = (
  select jsonb_agg(
    position || jsonb_build_object(
      'x', (position ->> 'x')::numeric * 30.48,
      'y', (position ->> 'y')::numeric * 30.48,
      'z', (position ->> 'z')::numeric * 30.48
    ) order by ordinal
  )
  from jsonb_array_elements(show.launch_positions_json) with ordinality as entries(position, ordinal)
)
where show.site_width_feet is not null
  and show.site_width_feet > 0
  and jsonb_typeof(show.launch_positions_json) = 'array'
  and (
    select max(abs((position ->> 'x')::numeric))
    from jsonb_array_elements(show.launch_positions_json) as entries(position)
  ) = show.site_width_feet::numeric / 2;

select is((select launch_positions_json from launch_spacing_fixture where id=1),
  '[{"x":-1219.20,"y":60.96,"z":91.44,"label":"left"},{"x":0,"y":0,"z":0},{"x":1219.20,"y":0,"z":0}]'::jsonb,
  'Feet footprint converts every axis, preserves order and metadata');
select is((select launch_positions_json from launch_spacing_fixture where id=2),
  (select launch_positions_json from original_spacing where id=2),'Modern centimetre layout stays intact');
select is((select launch_positions_json from launch_spacing_fixture where id=3),
  (select launch_positions_json from original_spacing where id=3),'Missing width stays intact');
select is((select launch_positions_json from launch_spacing_fixture where id=4),
  (select launch_positions_json from original_spacing where id=4),'Custom footprint stays intact');
select is((select launch_positions_json from launch_spacing_fixture where id=5), '[]'::jsonb,'Empty layout stays intact');
select * from finish();
rollback;
