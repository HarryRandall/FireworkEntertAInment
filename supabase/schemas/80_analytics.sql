-- Append-only visit events and rerunnable UTC rollups for retailer insights.
create table public.events (
  id bigint generated always as identity, occurred_at timestamptz not null default now(),
  type text not null check (type in ('scan','play','watched_to_end','list_add','list_redeem','plan_start','plan_pick','edit','share','follow')),
  organisation_id uuid references public.organisations(id), store_id uuid references public.stores(id),
  qr_code_id uuid references public.qr_codes(id), campaign_id uuid references public.campaigns(id),
  show_id uuid references public.shows(id), product_id uuid references public.products(id),
  plan_session_id uuid references public.plan_sessions(id) on delete set null,
  shopper_id uuid references public.profiles(id) on delete set null,
  session_key text, device text, os text, browser text, country char(2), city text,
  props jsonb not null default '{}' check (jsonb_typeof(props) = 'object'),
  primary key (id,occurred_at)
) partition by range (occurred_at);
create index events_organisation_time_idx on public.events(organisation_id,occurred_at);
create index events_store_idx on public.events(store_id);
create index events_shopper_idx on public.events(shopper_id);
create index events_session_idx on public.events(plan_session_id);

-- Nullable dimensions cannot be a primary key: NULLS NOT DISTINCT supplies one bucket.
create table public.metrics_daily (
  day date not null, organisation_id uuid not null references public.organisations(id),
  store_id uuid references public.stores(id), qr_code_id uuid references public.qr_codes(id),
  show_id uuid references public.shows(id), product_id uuid references public.products(id), campaign_id uuid references public.campaigns(id),
  metric text not null, value bigint not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique nulls not distinct (day,organisation_id,metric,store_id,qr_code_id,show_id,product_id,campaign_id)
);
create table public.metrics_hourly (
  hour timestamptz not null, organisation_id uuid not null references public.organisations(id),
  store_id uuid references public.stores(id), qr_code_id uuid references public.qr_codes(id),
  show_id uuid references public.shows(id), product_id uuid references public.products(id), campaign_id uuid references public.campaigns(id),
  metric text not null, value bigint not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique nulls not distinct (hour,organisation_id,metric,store_id,qr_code_id,show_id,product_id,campaign_id)
);
create index metrics_daily_organisation_idx on public.metrics_daily(organisation_id,day);
create index metrics_daily_store_idx on public.metrics_daily(store_id);
create index metrics_hourly_organisation_idx on public.metrics_hourly(organisation_id,hour);
create index metrics_hourly_store_idx on public.metrics_hourly(store_id);
create table public.saved_reports (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null check (name <> ''), query jsonb not null check (jsonb_typeof(query) = 'object'),
  schedule text, recipients text[], created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index saved_reports_organisation_idx on public.saved_reports(organisation_id);
create trigger metrics_daily_updated before update on public.metrics_daily for each row execute function private.set_updated_at();
create trigger metrics_hourly_updated before update on public.metrics_hourly for each row execute function private.set_updated_at();
create trigger saved_reports_updated before update on public.saved_reports for each row execute function private.set_updated_at();
alter table public.events enable row level security;
alter table public.metrics_daily enable row level security;
alter table public.metrics_hourly enable row level security;
alter table public.saved_reports enable row level security;
create policy events_live_read on public.events for select to authenticated using (
  occurred_at >= now() - interval '1 hour' and private.can_store(organisation_id,store_id,'insights.view'));
comment on policy events_live_read on public.events is 'Retailer live feed is restricted to the last wall-clock hour and permitted stores.';
create policy metrics_daily_read on public.metrics_daily for select to authenticated using (private.can_store(organisation_id,store_id,'insights.view'));
create policy metrics_hourly_read on public.metrics_hourly for select to authenticated using (private.can_store(organisation_id,store_id,'insights.view'));
create policy saved_reports_read on public.saved_reports for select to authenticated using (private.can(organisation_id,'insights.view'));
create policy saved_reports_insert on public.saved_reports for insert to authenticated with check (private.can(organisation_id,'insights.view'));
create policy saved_reports_update on public.saved_reports for update to authenticated using (private.can(organisation_id,'insights.view')) with check (private.can(organisation_id,'insights.view'));
create policy saved_reports_delete on public.saved_reports for delete to authenticated using (private.can(organisation_id,'insights.view'));

create function private.track_event(p_type text,p_store uuid,p_context jsonb,p_session_key text,p_props jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  -- Initial abuse budget: burst of 60 events per shopper, refilling one token per second.
  v_capacity constant numeric := 60;
  v_refill_per_second constant numeric := 1;
  -- Visit keys are bounded opaque random identifiers, never personal data.
  v_session_key_limit constant integer := 128;
  v_organisation uuid;
  v_qr uuid := (p_context->>'qr_code_id')::uuid;
  v_campaign uuid;
  v_show uuid := (p_context->>'show_id')::uuid;
  v_product uuid := (p_context->>'product_id')::uuid;
  v_plan uuid := (p_context->>'plan_session_id')::uuid;
  v_list uuid := (p_props->>'list_id')::uuid;
  v_props jsonb := '{}'::jsonb;
  v_id bigint;
begin
  if not coalesce(private.owns_shopper(private.uid()),false) then
    raise exception using errcode = '42501',message = 'Active shopper required';
  end if;
  if p_type is null or p_type not in ('scan','play','watched_to_end','list_add','list_redeem','plan_start','plan_pick','edit','share','follow')
    or p_context is null or jsonb_typeof(p_context) <> 'object' or p_props is null or jsonb_typeof(p_props) <> 'object'
    or (p_context - array['qr_code_id','show_id','product_id','plan_session_id']) <> '{}'
    or (p_props - 'list_id') <> '{}' or length(p_session_key) > v_session_key_limit then
    raise exception using errcode = '23514',message = 'Known event type and bounded context required';
  end if;
  select store.organisation_id into v_organisation from public.stores as store join public.organisations as organisation on organisation.id = store.organisation_id
    where store.id = p_store and store.status = 'open' and organisation.status not in ('suspended','closed');
  if v_organisation is null then raise exception using errcode = '23514',message = 'Open store required'; end if;
  if v_qr is not null then
    select code.campaign_id into v_campaign from public.qr_codes as code where code.id = v_qr and code.organisation_id = v_organisation
      and (code.store_id is null or code.store_id = p_store) and code.status = 'live';
    if not found then raise exception using errcode = '23514',message = 'Matching live QR code required'; end if;
  end if;
  if v_show is not null and not exists (select from public.shows as show where show.id = v_show and (
    (show.organisation_id = v_organisation and show.status in ('live','stock_issue')) or show.owner_id = private.uid())) then
    raise exception using errcode = '23514',message = 'Visible matching show required';
  end if;
  if v_product is not null and not exists (select from public.store_prices as price where price.store_id = p_store and price.product_id = v_product and not price.hidden) then
    raise exception using errcode = '23514',message = 'Visible store product required';
  end if;
  if v_plan is not null and not exists (select from public.plan_sessions as session where session.id = v_plan and session.store_id = p_store and session.shopper_id = private.uid()) then
    raise exception using errcode = '23514',message = 'Owned matching session required';
  end if;
  if v_list is not null then
    if not exists (select from public.lists as list where list.id = v_list and list.store_id = p_store and list.shopper_id = private.uid()
      and (p_type <> 'list_redeem' or list.status = 'redeemed')) then
      raise exception using errcode = '23514',message = 'Owned matching list required';
    end if;
    select jsonb_build_object('list_id',v_list,'list_value_minor',coalesce(sum(item.quantity * item.unit_price_minor),0)) into v_props
      from public.list_items as item where item.list_id = v_list;
  elsif p_type = 'list_redeem' then
    raise exception using errcode = '23514',message = 'Redeemed list required';
  end if;
  if not private.consume_rate_limit('event:' || private.uid(),v_capacity,v_refill_per_second) then
    raise exception using errcode = 'P0001',message = 'Event rate limit exceeded';
  end if;
  insert into public.events(type,organisation_id,store_id,qr_code_id,campaign_id,show_id,product_id,plan_session_id,shopper_id,session_key,props)
    values (p_type,v_organisation,p_store,v_qr,v_campaign,v_show,v_product,v_plan,private.uid(),p_session_key,v_props) returning id into v_id;
  return v_id;
end;
$$;
comment on function private.track_event(text,uuid,jsonb,text,jsonb) is 'Validates shopper and store references, derives tenancy and list value, consumes the event budget and appends a server-timestamped event; returns its ID.';
create function public.track_event(type text,store uuid,context jsonb default '{}',session_key text default null,props jsonb default '{}')
returns bigint language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  return private.track_event(type,store,context,session_key,props);
end;
$$;
comment on function public.track_event(text,uuid,jsonb,text,jsonb) is 'Appends one validated owned-shopper event; context contains optional QR, show, product and session UUIDs, props only a list UUID. Raw IP and client geo are never accepted.';

-- This projection keeps the event-to-metric mapping shared between both rollups.
create function private.event_metrics(p_from timestamptz,p_until timestamptz)
returns table(occurred_at timestamptz,organisation_id uuid,store_id uuid,qr_code_id uuid,show_id uuid,product_id uuid,campaign_id uuid,metric text,value bigint)
language sql stable set search_path = '' as $$
  select event.occurred_at,event.organisation_id,event.store_id,event.qr_code_id,event.show_id,event.product_id,event.campaign_id,
    mapped.metric,mapped.value from public.events as event cross join lateral (
      select case event.type when 'scan' then 'scans' when 'play' then 'plays' when 'watched_to_end' then 'watched_to_end'
        when 'list_add' then 'list_adds' when 'plan_start' then 'plans' when 'follow' then 'follows' end as metric,1::bigint as value
      union all select 'list_value_minor',(event.props->>'list_value_minor')::bigint where event.type = 'list_redeem'
    ) as mapped where event.occurred_at >= p_from and event.occurred_at < p_until and event.organisation_id is not null and mapped.metric is not null;
$$;
comment on function private.event_metrics(timestamptz,timestamptz) is 'Projects count metrics and snapshotted minor-unit list value from the half-open UTC event interval for trusted rollups.';

create function private.rollup_events(p_from timestamptz,p_until timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_from timestamptz;
  v_until timestamptz;
  -- Stable advisory key serialises replacement of overlapping aggregate buckets.
  v_rollup_lock constant bigint := 800001;
  -- Hourly heatmaps keep 90 days; daily aggregates retain the full history.
  v_hourly_retention constant interval := interval '90 days';
  -- Rebuilding a period whose raw partitions were dropped would erase retained facts.
  v_raw_retention constant interval := interval '25 months';
begin
  if p_from is null or p_until is null or p_from >= p_until then
    raise exception using errcode = '23514',message = 'Increasing rollup interval required';
  end if;
  if p_from < date_trunc('month',now() - v_raw_retention,'UTC') then
    raise exception using errcode = '23514',message = 'Rollup interval exceeds raw event retention';
  end if;
  perform pg_advisory_xact_lock(v_rollup_lock);
  -- Expand to whole UTC days so partial windows cannot overwrite a complete bucket.
  v_from := date_trunc('day',p_from,'UTC');
  v_until := date_trunc('day',p_until,'UTC');
  if v_until < p_until then v_until := v_until + interval '1 day'; end if;
  delete from public.metrics_daily as metric where metric.day >= (v_from at time zone 'UTC')::date and metric.day < (v_until at time zone 'UTC')::date;
  insert into public.metrics_daily(day,organisation_id,store_id,qr_code_id,show_id,product_id,campaign_id,metric,value)
    select (source.occurred_at at time zone 'UTC')::date,source.organisation_id,source.store_id,source.qr_code_id,source.show_id,source.product_id,source.campaign_id,source.metric,sum(source.value)
    from private.event_metrics(v_from,v_until) as source group by 1,2,3,4,5,6,7,8;
  delete from public.metrics_hourly as metric where metric.hour >= v_from and metric.hour < v_until;
  insert into public.metrics_hourly(hour,organisation_id,store_id,qr_code_id,show_id,product_id,campaign_id,metric,value)
    select date_trunc('hour',source.occurred_at,'UTC'),source.organisation_id,source.store_id,source.qr_code_id,source.show_id,source.product_id,source.campaign_id,source.metric,sum(source.value)
    from private.event_metrics(greatest(v_from,date_trunc('hour',now() - v_hourly_retention,'UTC')),v_until) as source group by 1,2,3,4,5,6,7,8;
  delete from public.metrics_hourly as metric where metric.hour < date_trunc('hour',now() - v_hourly_retention,'UTC');
end;
$$;
comment on function private.rollup_events(timestamptz,timestamptz) is 'Atomically rebuilds complete UTC day/hour buckets touching a half-open wall-clock interval; reruns replace counts, and hourly retention is 90 days.';

-- The default is evaluated before the function's empty search path takes effect.
create function private.maintain_event_partitions(p_caller_search_path text default current_setting('search_path'))
returns void language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_partition regclass;
begin
  perform partman.run_maintenance(p_parent_table := 'public.events',p_analyze := false,p_jobmon := false);
  -- Partitions are never API entry points, including ones created during maintenance.
  for v_partition in select child.inhrelid::regclass from pg_catalog.pg_inherits as child where child.inhparent = 'public.events'::regclass loop
    execute format('alter table %s enable row level security',v_partition);
    execute format('revoke all on %s from public, anon, authenticated',v_partition);
  end loop;
  -- pg_partman uses session SET internally; restore the caller path explicitly.
  perform set_config('search_path',p_caller_search_path,false);
exception when others then
  perform set_config('search_path',p_caller_search_path,false);
  raise;
end;
$$;
comment on function private.maintain_event_partitions(text) is 'Premakes monthly event partitions, drops raw data past the configured 25-month retention and seals direct API partition access.';

-- Declarative setup also runs in the diff shadow database, keeping partitions in step.
do $$
#variable_conflict error
declare
  -- Four premade months is pg_partman''s default operational buffer.
  v_premake constant integer := 4;
  -- Raw event retention from the analytics contract; daily rollups are kept separately.
  v_retention constant text := '25 months';
begin
  perform partman.create_parent(p_parent_table := 'public.events',p_control := 'occurred_at',p_interval := '1 month',
    p_premake := v_premake,p_start_partition := date_trunc('month',now() - v_retention::interval)::text,
    p_default_table := false,p_jobmon := false);
  update partman.part_config as configuration set retention = v_retention,retention_keep_table = false,retention_keep_index = false,
    infinite_time_partitions = true where configuration.parent_table = 'public.events';
  perform private.maintain_event_partitions();
end;
$$;

create function private.protect_event_history()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  -- Foreign-key deletion may unlink personal records, leaving aggregate facts intact.
  if tg_op = 'UPDATE' and (new.shopper_id is not distinct from old.shopper_id or new.shopper_id is null)
    and (new.plan_session_id is not distinct from old.plan_session_id or new.plan_session_id is null)
    and (to_jsonb(new) - array['shopper_id','plan_session_id']) = (to_jsonb(old) - array['shopper_id','plan_session_id']) then
    return new;
  end if;
  raise exception using errcode = '23514',message = 'Event history is append-only';
end;
$$;
comment on function private.protect_event_history() is 'Rejects raw event rewrites and deletion; personal foreign keys can be cleared when accounts are deleted. Retention drops whole partitions.';
create trigger events_immutable before update or delete on public.events for each row execute function private.protect_event_history();
