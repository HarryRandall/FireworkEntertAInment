-- Prune schema objects that were left behind by earlier product directions.
-- Current shopping lists are derived from show_timeline_items and
-- supplier_inventory_items, current supplier stock is not location-scoped, and
-- current music analysis uses song_analyses plus the canonical columns on
-- show_generation_runs.

drop table if exists public.shopping_list_items;

alter table if exists public.supplier_inventory_items
  drop column if exists location_id;

drop table if exists public.supplier_locations;

alter table if exists public.users
  drop column if exists last_seen_at;

alter table if exists public.ai_credit_costs
  drop column if exists is_billable;

alter table if exists public.show_generation_runs
  drop column if exists analysis_storage_path,
  drop column if exists markdown_storage_path,
  drop column if exists compact_payload,
  drop column if exists source_audio_path,
  drop column if exists personality_preset;
