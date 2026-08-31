-- Catalogue completeness + sync triggers for the firework / multishot rework.

delete from public.catalogue_items c
where c.firework_id is null
  and c.multishot_id is null
  and not exists (select 1 from public.show_timeline_items t where t.catalogue_item_id = c.id)
  and not exists (select 1 from public.supplier_inventory_items s where s.catalogue_item_id = c.id);

insert into public.catalogue_items (
  part_number, name, description, catalogue_item_kind, firework_id, duration_seconds, metadata
)
select
  coalesce(nullif(f.slug, ''), 'fw-' || left(replace(f.id::text, '-', ''), 8)),
  f.name, f.description, 'firework', f.id, f.duration_seconds, '{}'::jsonb
from public.fireworks f
where not exists (select 1 from public.catalogue_items c where c.firework_id = f.id)
on conflict (part_number) do nothing;

insert into public.catalogue_items (
  part_number, name, description, catalogue_item_kind, multishot_id, duration_seconds, metadata
)
select
  coalesce(nullif(m.slug, ''), 'ms-' || left(replace(m.id::text, '-', ''), 8)),
  m.name, m.description, 'multishot', m.id, m.duration_seconds, '{}'::jsonb
from public.multishots m
where not exists (select 1 from public.catalogue_items c where c.multishot_id = m.id)
on conflict (part_number) do nothing;

create or replace function public.ensure_catalogue_item_for_firework()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.catalogue_items (
    part_number, name, description, catalogue_item_kind, firework_id, duration_seconds
  )
  values (
    coalesce(nullif(new.slug, ''), 'fw-' || left(replace(new.id::text, '-', ''), 8)),
    new.name, new.description, 'firework', new.id, new.duration_seconds
  )
  on conflict do nothing;
  return new;
end;
$$;

create or replace function public.ensure_catalogue_item_for_multishot()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.catalogue_items (
    part_number, name, description, catalogue_item_kind, multishot_id, duration_seconds
  )
  values (
    coalesce(nullif(new.slug, ''), 'ms-' || left(replace(new.id::text, '-', ''), 8)),
    new.name, new.description, 'multishot', new.id, new.duration_seconds
  )
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists fireworks_ensure_catalogue_item on public.fireworks;
create trigger fireworks_ensure_catalogue_item
  after insert on public.fireworks
  for each row execute function public.ensure_catalogue_item_for_firework();

drop trigger if exists multishots_ensure_catalogue_item on public.multishots;
create trigger multishots_ensure_catalogue_item
  after insert on public.multishots
  for each row execute function public.ensure_catalogue_item_for_multishot();

create or replace function public.block_linked_catalogue_item_delete()
returns trigger language plpgsql as $$
begin
  if old.firework_id is not null or old.multishot_id is not null then
    raise exception 'Catalogue item % is linked to a firework or multishot and cannot be deleted.', old.id
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists catalogue_items_block_linked_delete on public.catalogue_items;
create trigger catalogue_items_block_linked_delete
  before delete on public.catalogue_items
  for each row execute function public.block_linked_catalogue_item_delete();;
