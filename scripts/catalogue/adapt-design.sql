-- Adapt generated per-firework snapshot designs to current colours and heights.
-- Unchanged palettes retain authored opening/closing curves and inner-star contrast.
create function pg_temp.catalogue_design(template jsonb, palette text[], primary_colour text, height_m numeric, exported_palette jsonb, exported_primary text)
returns jsonb language plpgsql as $adapt$
declare
  result jsonb := template;
  colours jsonb;
  colour jsonb;
  part record;
  burst_index integer;
  layer_index integer;
  reference_height_m numeric;
begin
  if cardinality(palette) >= 2 then colours := to_jsonb(palette);
  elsif primary_colour is not null then colours := jsonb_build_array(primary_colour);
  end if;
  if colours is not null and (to_jsonb(palette) is distinct from exported_palette or primary_colour is distinct from exported_primary) then
    colour := jsonb_build_object('mode', case when jsonb_array_length(colours) >= 2 then 'alternate' else 'solid' end,
      'stops', jsonb_build_array(jsonb_build_array(0, colours), jsonb_build_array(1, colours)));
    for burst_index in 0..jsonb_array_length(result -> 'breaks') - 1 loop
      for layer_index in 0..jsonb_array_length(result #> array['breaks', burst_index::text, 'layers']) - 1 loop
        if result #>> array['breaks', burst_index::text, 'layers', layer_index::text, 'name'] <> 'Inner stars' then
          result := jsonb_set(result, array['breaks', burst_index::text, 'layers', layer_index::text, 'colour'], colour);
        end if;
      end loop;
    end loop;
    if jsonb_typeof(result -> 'ground') = 'object' then
      for part in select key, value from jsonb_each(result -> 'ground') loop
        if jsonb_typeof(part.value) = 'object' and part.value ? 'colour' then
          result := jsonb_set(result, array['ground', part.key, 'colour'],
            case when jsonb_typeof(part.value -> 'colour') = 'string'
              then to_jsonb(coalesce(primary_colour, colours ->> 0)) else colour end);
        end if;
      end loop;
    end if;
  end if;
  if result ->> 'kind' = 'shell' and height_m is not null then
    reference_height_m := (result #>> '{launch,height_m}')::numeric;
    result := jsonb_set(result, '{launch,time_s}', to_jsonb(greatest(0.001,
      (result #>> '{launch,time_s}')::double precision * sqrt(height_m::double precision / reference_height_m::double precision))));
    result := jsonb_set(result, '{launch,height_m}', to_jsonb(height_m));
  end if;
  return result;
end;
$adapt$;
