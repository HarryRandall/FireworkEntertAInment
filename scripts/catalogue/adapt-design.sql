-- Substitute authored colour identities without altering template structure or tuning.
create function pg_temp.catalogue_design(template jsonb, palette text[], primary_colour text, secondary_colour text, seed bigint)
returns jsonb language plpgsql as $adapt$
declare
  result jsonb := template || jsonb_build_object('seed', seed);
  colours text[] := '{}';
  identities text[] := '{}';
  colour text;
  part record;
  control record;
  stop record;
  slot record;
  path text[];
  replacement text;
begin
  foreach colour in array array[primary_colour] || coalesce(palette, '{}') || array[secondary_colour] loop
    if colour is not null and not colour = any(colours) then colours := array_append(colours, colour); end if;
  end loop;
  if cardinality(colours) = 0 then return result; end if;
  for control in
    select array['breaks', (b.ordinality - 1)::text, 'layers', (l.ordinality - 1)::text, 'colour'] as path, l.value -> 'colour' as value
    from jsonb_array_elements(result -> 'breaks') with ordinality b,
    lateral jsonb_array_elements(b.value -> 'layers') with ordinality l
    union all
    select array['ground', g.key, 'colour'], g.value -> 'colour'
    from jsonb_each(coalesce(nullif(result -> 'ground', 'null'::jsonb), '{}'::jsonb)) g
    where jsonb_typeof(g.value) = 'object' and g.value ? 'colour'
  loop
    if jsonb_typeof(control.value) = 'string' then
      colour := control.value #>> '{}';
      if not colour = any(identities) then identities := array_append(identities, colour); end if;
      replacement := colours[1 + (array_position(identities, colour) - 1) % cardinality(colours)];
      result := jsonb_set(result, control.path, to_jsonb(replacement));
    else
      for stop in select value, ordinality from jsonb_array_elements(control.value -> 'stops') with ordinality loop
        for slot in select value, ordinality from jsonb_array_elements_text(case when jsonb_typeof(stop.value -> 1) = 'array' then stop.value -> 1 else jsonb_build_array(stop.value -> 1) end) with ordinality loop
          colour := slot.value;
          if not colour = any(identities) then identities := array_append(identities, colour); end if;
          replacement := colours[1 + (array_position(identities, colour) - 1) % cardinality(colours)];
          path := control.path || array['stops', (stop.ordinality - 1)::text, '1'];
          if jsonb_typeof(stop.value -> 1) = 'array' then path := path || (slot.ordinality - 1)::text; end if;
          result := jsonb_set(result, path, to_jsonb(replacement));
        end loop;
      end loop;
    end if;
  end loop;
  return result;
end;
$adapt$;
