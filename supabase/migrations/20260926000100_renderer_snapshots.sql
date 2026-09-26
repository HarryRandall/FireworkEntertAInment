begin;

alter table public.fireworks add column render_snapshot_json jsonb;
alter table public.fireworks add constraint fireworks_render_snapshot_object
  check (render_snapshot_json is null or jsonb_typeof(render_snapshot_json) = 'object');
comment on column public.fireworks.render_snapshot_json is
  'Resolved renderer settings copied at save time. Effect and preset changes do not propagate.';

alter table public.firework_style_defaults drop constraint firework_style_defaults_kind_check;
alter table public.firework_style_defaults add constraint firework_style_defaults_kind_check
  check (kind = any(array['geometry','star','innerStar','trail','innerTrail','launch','smoke','strobe','crackle','split','sound']));

-- Existing RPCs and import materialisation already write the complete design.
-- Capture it in the same transaction as the record and its related writes.
create function public.capture_firework_render_snapshot() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.render_overrides_json is distinct from old.render_overrides_json then
    if new.render_overrides_json ? 'geometry'
       and new.render_overrides_json #> '{stars,outer,head}' is not null
       and new.render_overrides_json #> '{launch,shell}' is not null then
      new.render_snapshot_json := new.render_overrides_json;
    elsif tg_op = 'UPDATE' then
      raise exception 'Firework writes require complete resolved renderer settings';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.capture_firework_render_snapshot() from public, anon, authenticated;
create trigger capture_firework_render_snapshot
before insert or update of render_overrides_json on public.fireworks
for each row execute function public.capture_firework_render_snapshot();

commit;
