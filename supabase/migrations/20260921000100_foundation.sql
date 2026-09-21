-- Fresh-install baseline captured from the production schema on 21 September 2026.
-- The retired migration history is retained in Git before this baseline.
create schema if not exists extensions;
create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
-- PostgreSQL grants function execution globally by default; a schema-only revoke cannot remove it.
alter default privileges for role postgres revoke execute on functions from public;
-- New tables start private; the explicit grants below define their API surface.
alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema private revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated, service_role;
-- ShowCrafter baseline: foundation.
set check_function_bodies = false;

CREATE SCHEMA IF NOT EXISTS "private";

ALTER SCHEMA "private" OWNER TO "postgres";

CREATE SCHEMA IF NOT EXISTS "public";

ALTER SCHEMA "public" OWNER TO "pg_database_owner";

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE OR REPLACE FUNCTION "public"."show_preset_composition_signature"("p_preview_cues" "jsonb") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select coalesce(string_agg(cue_key, '|' order by cue_key), 'no-resolved-cues')
  from (
    select distinct coalesce(
      nullif(cue.value ->> 'catalogueItemId', ''),
      nullif(cue.value ->> 'catalogueItemSlug', ''),
      nullif(cue.value ->> 'fireworkSlug', ''),
      'unresolved-cue'
    ) as cue_key
    from jsonb_array_elements(
      case
        when jsonb_typeof(p_preview_cues) = 'array' then p_preview_cues
        else '[]'::jsonb
      end
    ) as cue(value)
  ) as cue_keys;
$$;

ALTER FUNCTION "public"."show_preset_composition_signature"("p_preview_cues" "jsonb") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."show_preset_composition_signature"("p_preview_cues" "jsonb") IS 'Returns the stable set of catalogue references used by a preset cue timeline.';
