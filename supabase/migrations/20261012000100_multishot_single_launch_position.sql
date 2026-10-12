-- A multishot is one cake at its cue's launch position. Its shots vary only by
-- tube, pan and tilt within the cake, so a stored per-shot launchPositionIndex
-- no longer reserves other positions. The signature is unchanged, so grants,
-- ownership and the cue triggers that call it stay as they are.
CREATE OR REPLACE FUNCTION "private"."catalogue_item_occupied_launch_positions"("p_catalogue_item_id" "uuid", "p_parent_launch_position_index" integer) RETURNS integer[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
  select case
    when p_parent_launch_position_index between 0 and 2
      then array[p_parent_launch_position_index]
    else array[]::integer[]
  end;
$_$;
