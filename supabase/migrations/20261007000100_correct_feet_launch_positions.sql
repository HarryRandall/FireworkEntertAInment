-- Older site layouts stored feet where replay expects centimetres. Match only
-- the exact half-width footprint so modern layouts and custom staging stay intact.
update public.shows as show
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
