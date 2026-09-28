begin;

insert into auth.users (id, email, email_confirmed_at)
values ('94000000-0000-4000-8000-000000000001', 'cue-owner@example.test', now()),
       ('94000000-0000-4000-8000-000000000002', 'cue-other@example.test', now());
insert into public.shows (id, user_id, slug, title, generation_status, generation_lease_token, generation_lease_expires_at)
values ('94000000-0000-4000-8000-000000000003', '94000000-0000-4000-8000-000000000001', 'leased-cue-test', 'Lease test', 'running', '94000000-0000-4000-8000-000000000004', now() + interval '10 minutes');

set local role service_role;
set local request.jwt.claim.role = 'service_role';
do $$
declare
  cue jsonb;
  show_id uuid := '94000000-0000-4000-8000-000000000003';
  owner_id uuid := '94000000-0000-4000-8000-000000000001';
  token uuid := '94000000-0000-4000-8000-000000000004';
begin
  select jsonb_build_array(jsonb_build_object('position', 1, 'time_seconds', 0,
    'description', 'Lease test', 'catalogue_item_id', id, 'launch_position_index', 0,
    'emphasis', 'normal')) into cue from public.catalogue_items where is_listed and catalogue_item_kind = 'firework' order by id limit 1;
  if cue is null then raise exception 'Catalogue fixture missing'; end if;
  begin
    perform public.replace_show_timeline_items(show_id, owner_id, cue);
    raise exception 'Unleased service worker wrote a normal show';
  exception when insufficient_privilege then null; end;
  begin
    perform public.replace_generated_show_timeline_items(show_id, owner_id, cue, gen_random_uuid());
    raise exception 'Stale lease wrote cues';
  exception when object_not_in_prerequisite_state then null; end;
  begin
    perform public.replace_generated_show_timeline_items(show_id, '94000000-0000-4000-8000-000000000002', cue, token);
    raise exception 'Worker wrote another owner';
  exception when no_data_found then null; end;
  if public.replace_generated_show_timeline_items(show_id, owner_id, cue, token) <> 1 then
    raise exception 'Leased service worker could not persist a normal show';
  end if;
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000002', true);
  begin
    perform public.replace_generated_show_timeline_items(show_id, owner_id, cue, token);
    raise exception 'Another user wrote cues';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  if public.replace_generated_show_timeline_items(show_id, owner_id, cue, token) <> 1 then
    raise exception 'Owner could not persist their leased generation';
  end if;
end $$;
reset role;
set local request.jwt.claim.role = 'service_role';
select set_config('showcrafter.cue_lifecycle_write', '1', true);
update public.shows set generation_lease_expires_at = now() - interval '1 second'
where id = '94000000-0000-4000-8000-000000000003';
set local role service_role;
do $$
begin
  begin
    perform public.replace_generated_show_timeline_items(
      '94000000-0000-4000-8000-000000000003', '94000000-0000-4000-8000-000000000001',
      '[{"position":1,"time_seconds":1}]', '94000000-0000-4000-8000-000000000004');
    raise exception 'Expired lease wrote cues';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
reset role;
do $$
begin
  if (select count(*) from public.show_timeline_items where show_id = '94000000-0000-4000-8000-000000000003') <> 1 then
    raise exception 'Rejected lease changed the existing timeline';
  end if;
  if has_function_privilege('anon', 'public.replace_generated_show_timeline_items(uuid,uuid,jsonb,uuid)', 'execute') then
    raise exception 'Anonymous caller received generated timeline write access';
  end if;
end $$;
rollback;
