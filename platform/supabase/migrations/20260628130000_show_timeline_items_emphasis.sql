-- Per-cue render emphasis (schema 1.4.0) so climaxes, drops and finale beats
-- can render visibly bigger and brighter without changing the underlying
-- product. Generators write one of 'normal' | 'accent' | 'peak'; the renderer
-- scales star count, burst speed, lift velocity and flash accordingly.
--
-- 'normal' is the default so existing rows and any cue the generators leave
-- unmarked keep rendering exactly as before.

alter table public.show_timeline_items
  add column if not exists emphasis text not null default 'normal';

alter table public.show_timeline_items
  drop constraint if exists show_timeline_items_emphasis_check;

alter table public.show_timeline_items
  add constraint show_timeline_items_emphasis_check
  check (emphasis in ('normal', 'accent', 'peak'));
