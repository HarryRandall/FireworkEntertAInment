-- Shopper planning snapshots, till lists and explicit retailer consent.
create function private.owns_shopper(p_shopper uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_shopper = private.uid() and exists (select from public.profiles as profile
    where profile.id = p_shopper and profile.status = 'active');
$$;
comment on function private.owns_shopper(uuid) is 'Checks active account ownership, including Supabase anonymous shoppers.';

create table public.plan_sessions (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id),
  qr_code_id uuid references public.qr_codes(id),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  age_confirmed_at timestamptz,
  solver text not null check (length(solver) > 0),
  input_hash text not null check (length(input_hash) > 0),
  status text not null default 'open' check (status in ('open','listed','abandoned')),
  credits_reservation_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
comment on column public.plan_sessions.credits_reservation_id is 'Nullable UUID reference to public.credit_reservations(id).';
create table public.plan_candidates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.plan_sessions(id) on delete cascade,
  rank smallint not null check (rank > 0),
  revision int not null default 0 check (revision >= 0),
  mood text, name text, blurb text,
  cues jsonb not null check (extensions.jsonb_matches_schema(private.cues_schema(),cues)),
  total_minor bigint not null check (total_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  duration_ms int not null check (duration_ms >= 0),
  scores jsonb not null default '{}' check (jsonb_typeof(scores) = 'object'),
  picked_at timestamptz,
  unique (session_id,rank), unique (session_id,id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.plan_edits (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.plan_sessions(id) on delete cascade,
  candidate_id uuid not null,
  seq int not null check (seq > 0),
  message text check (char_length(message) <= 300),
  source text not null check (source in ('chip','rule','llm')),
  ops jsonb not null check (jsonb_typeof(ops) = 'array'),
  diff jsonb check (jsonb_typeof(diff) = 'object'),
  outcome text not null check (outcome in ('applied','clarify','refused','infeasible')),
  reply text, llm_call_id bigint,
  foreign key (session_id,candidate_id) references public.plan_candidates(session_id,id) on delete cascade,
  unique (session_id,seq),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
comment on column public.plan_edits.message is 'Shopper edit text, limited to 300 characters by the planner contract.';
comment on column public.plan_edits.llm_call_id is 'Nullable bigint reference to public.llm_calls(id).';
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id),
  plan_candidate_id uuid references public.plan_candidates(id),
  till_code text not null unique check (till_code ~ '^[0-9]{16}$'),
  status text not null default 'open' check (status in ('open','redeemed','expired')),
  valid_until date not null,
  redeemed_at timestamptz, redeemed_by uuid references public.profiles(id),
  check ((status = 'redeemed') = (redeemed_at is not null)),
  check (status = 'redeemed' or redeemed_by is null),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
comment on column public.lists.till_code is 'Sixteen decimal digits for the shopper till barcode; uniqueness is enforced across stores.';
create table public.list_items (
  list_id uuid not null references public.lists(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity smallint not null default 1 check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  primary key (list_id,product_id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.follows (
  shopper_id uuid not null references public.profiles(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  visible_to_shop boolean not null default false,
  marketing_opt_in boolean not null default false,
  consent_text_version text not null check (length(consent_text_version) > 0),
  consented_at timestamptz not null default now(),
  primary key (shopper_id,organisation_id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('export','delete')),
  status text not null default 'pending' check (status in ('pending','done','failed')),
  result_media_id uuid references public.media(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.plan_sessions enable row level security;
create trigger set_updated_at before update on public.plan_sessions
  for each row execute function private.set_updated_at();
alter table public.plan_candidates enable row level security;
create trigger set_updated_at before update on public.plan_candidates
  for each row execute function private.set_updated_at();
alter table public.plan_edits enable row level security;
create trigger set_updated_at before update on public.plan_edits
  for each row execute function private.set_updated_at();
alter table public.lists enable row level security;
create trigger set_updated_at before update on public.lists
  for each row execute function private.set_updated_at();
alter table public.list_items enable row level security;
create trigger set_updated_at before update on public.list_items
  for each row execute function private.set_updated_at();
alter table public.follows enable row level security;
create trigger set_updated_at before update on public.follows
  for each row execute function private.set_updated_at();
alter table public.privacy_requests enable row level security;
create trigger set_updated_at before update on public.privacy_requests
  for each row execute function private.set_updated_at();
create index plan_sessions_shopper_id_idx on public.plan_sessions(shopper_id);
create index plan_sessions_store_id_idx on public.plan_sessions(store_id);
create index lists_shopper_id_idx on public.lists(shopper_id);
create index lists_store_id_idx on public.lists(store_id);
create index follows_organisation_id_idx on public.follows(organisation_id);
create index privacy_requests_shopper_id_idx on public.privacy_requests(shopper_id);

create function private.owns_plan(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select from public.plan_sessions as session
    where session.id = p_session and private.owns_shopper(session.shopper_id));
$$;
comment on function private.owns_plan(uuid) is 'Checks the session owner without exposing another shopper''s session.';
create function private.can_read_list(p_list uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select from public.lists as list join public.stores as store on store.id = list.store_id
    where list.id = p_list and (private.owns_shopper(list.shopper_id)
      or (list.status = 'redeemed' and private.store_access(store.organisation_id,store.id))));
$$;
comment on function private.can_read_list(uuid) is 'Allows the active shopper or scoped retailer members to read a redeemed list.';
create policy plan_sessions_read on public.plan_sessions for select to authenticated using (private.owns_shopper(shopper_id));
create policy plan_candidates_read on public.plan_candidates for select to authenticated using (private.owns_plan(session_id));
create policy plan_edits_read on public.plan_edits for select to authenticated using (private.owns_plan(session_id));
create policy lists_read on public.lists for select to authenticated using (private.can_read_list(id));
create policy list_items_read on public.list_items for select to authenticated using (private.can_read_list(list_id));
create policy follows_read on public.follows for select to authenticated
  using (private.owns_shopper(shopper_id) or (visible_to_shop and private.can(organisation_id,'customers.view')));
create policy follows_insert on public.follows for insert to authenticated with check (private.owns_shopper(shopper_id));
create policy follows_update on public.follows for update to authenticated
  using (private.owns_shopper(shopper_id)) with check (private.owns_shopper(shopper_id));
create policy follows_delete on public.follows for delete to authenticated using (private.owns_shopper(shopper_id));
create policy privacy_requests_read on public.privacy_requests for select to authenticated using (private.owns_shopper(shopper_id));
create policy privacy_requests_insert on public.privacy_requests for insert to authenticated
  with check (private.owns_shopper(shopper_id) and status = 'pending' and result_media_id is null);

-- Session creation and its credit settlement share a transaction.
create function private.start_plan_session(p_store uuid,p_answers jsonb,p_solver text,p_input_hash text,p_qr_code uuid,p_age_confirmed_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_session uuid;
  v_organisation uuid;
begin
  if not coalesce(private.owns_shopper(private.uid()),false) then
    raise exception using errcode = '42501', message = 'Active shopper required';
  end if;
  select store.organisation_id into v_organisation from public.stores as store
    join public.organisations as organisation on organisation.id = store.organisation_id
    where store.id = p_store and store.status = 'open' and organisation.status not in ('suspended','closed');
  if v_organisation is null or (p_qr_code is not null and not exists (
    select from public.qr_codes as code where code.id = p_qr_code and code.organisation_id = v_organisation
      and (code.store_id is null or code.store_id = p_store) and code.status = 'live')) then
    raise exception using errcode = '23514', message = 'Open store and matching live QR code required';
  end if;
  if p_age_confirmed_at is null or p_age_confirmed_at > now() then
    raise exception using errcode = '23514', message = 'Age confirmation required';
  end if;
  insert into public.plan_sessions(shopper_id,store_id,qr_code_id,answers,solver,input_hash,age_confirmed_at)
    values (private.uid(),p_store,p_qr_code,p_answers,p_solver,p_input_hash,p_age_confirmed_at) returning id into v_session;
  perform private.charge_plan_session(v_session);
  return v_session;
end;
$$;
comment on function private.start_plan_session(uuid,jsonb,text,text,uuid,timestamptz) is 'Starts an owned planning session atomically after store, QR and age confirmation checks; returns its UUID. Includes one credit settlement.';
create function public.start_plan_session(p_store uuid,p_answers jsonb,p_solver text,p_input_hash text,
  p_qr_code uuid default null,p_age_confirmed_at timestamptz default null)
returns uuid language sql set search_path = '' as $$
  select private.start_plan_session(p_store,p_answers,p_solver,p_input_hash,p_qr_code,p_age_confirmed_at);
$$;
comment on function public.start_plan_session(uuid,jsonb,text,text,uuid,timestamptz) is 'Starts the caller''s planning session; answers and input hash describe the solver snapshot. Returns a session UUID.';

-- Snapshots are backend-authored; clients cannot claim prices, outcomes or redemption.
create function private.validate_shopper_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_session public.plan_sessions;
begin
  if tg_table_name = 'plan_candidates' then
    if tg_op = 'UPDATE' and new.session_id <> old.session_id then
      raise exception using errcode = '23514', message = 'Candidate session cannot change';
    end if;
    if exists (select from jsonb_array_elements(new.cues) as cue(document)
      where (cue.document->>'t_ms')::bigint > new.duration_ms) then
      raise exception using errcode = '23514', message = 'Candidate cues exceed duration';
    end if;
  else
    if new.plan_candidate_id is not null then
      select session.* into v_session from public.plan_candidates as candidate
        join public.plan_sessions as session on session.id = candidate.session_id where candidate.id = new.plan_candidate_id;
      if v_session.shopper_id is distinct from new.shopper_id or v_session.store_id is distinct from new.store_id then
        raise exception using errcode = '23514', message = 'List candidate must match shopper and store';
      end if;
    end if;
    if tg_op = 'UPDATE' and (new.shopper_id,new.store_id,new.plan_candidate_id,new.till_code)
      is distinct from (old.shopper_id,old.store_id,old.plan_candidate_id,old.till_code) then
      raise exception using errcode = '23514', message = 'List ownership and barcode cannot change';
    end if;
  end if;
  return new;
end;
$$;
comment on function private.validate_shopper_snapshot() is 'Enforces candidate cue duration and stable list ownership with a matching candidate session.';
create trigger validate_snapshot before insert or update on public.plan_candidates
  for each row execute function private.validate_shopper_snapshot();
create trigger validate_snapshot before insert or update on public.lists
  for each row execute function private.validate_shopper_snapshot();

-- A narrow customer reader avoids extending general profile visibility with consent.
create function private.shop_customers(p_organisation uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
#variable_conflict error
begin
  if not coalesce(private.can(p_organisation,'customers.view'),false) then
    raise exception using errcode = '42501', message = 'Customer viewing permission required';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('shopper_id',profile.id,
    'display_name',profile.display_name,'email',profile.email,'marketing_opt_in',follow.marketing_opt_in,
    'lists',coalesce((select jsonb_agg(jsonb_build_object('id',list.id,'store_id',list.store_id,'status',list.status))
      from public.lists as list join public.stores as store on store.id = list.store_id
      where list.shopper_id = profile.id and store.organisation_id = p_organisation),'[]'::jsonb)))
    from public.follows as follow join public.profiles as profile on profile.id = follow.shopper_id
    where follow.organisation_id = p_organisation and follow.visible_to_shop and profile.status = 'active'),'[]'::jsonb);
end;
$$;
comment on function private.shop_customers(uuid) is 'Reads consenting active shoppers and their list summaries for an organisation with customer viewing permission.';
create function public.shop_customers(p_organisation uuid)
returns jsonb language sql stable set search_path = '' as $$ select private.shop_customers(p_organisation); $$;
comment on function public.shop_customers(uuid) is 'Returns consenting customers and list summaries; requires organisation-wide customer viewing permission.';

alter table public.show_versions add constraint show_versions_plan_session_fk
  foreign key (plan_session_id) references public.plan_sessions(id);

-- Caller supplies product quantities; store facts supply the immutable price snapshot.
create function private.create_list(p_store uuid,p_items jsonb,p_till_code text,p_valid_until date,p_candidate uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
#variable_conflict error
declare
  v_list uuid;
  v_item jsonb;
  v_product uuid;
  v_quantity smallint;
  v_price bigint;
  v_currency char(3);
begin
  if not coalesce(private.owns_shopper(private.uid()),false) then
    raise exception using errcode = '42501', message = 'Active shopper required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0
    or p_valid_until is null or p_valid_until < current_date then
    raise exception using errcode = '23514', message = 'Non-empty items and unexpired validity required';
  end if;
  if p_candidate is not null and not exists (
    select from public.plan_candidates as candidate join public.plan_sessions as session on session.id = candidate.session_id
    where candidate.id = p_candidate and session.store_id = p_store and private.owns_shopper(session.shopper_id)) then
    raise exception using errcode = '42501', message = 'Own candidate at matching store required';
  end if;
  insert into public.lists(shopper_id,store_id,plan_candidate_id,till_code,valid_until)
    values (private.uid(),p_store,p_candidate,p_till_code,p_valid_until) returning id into v_list;
  for v_item in select item.document from jsonb_array_elements(p_items) as item(document) loop
    if jsonb_typeof(v_item) <> 'object' or not (v_item ? 'product_id' and v_item ? 'quantity')
      or (select count(*) from jsonb_object_keys(v_item) as key) <> 2
      or jsonb_typeof(v_item->'quantity') <> 'number' or (v_item->>'quantity') !~ '^[1-9][0-9]*$' then
      raise exception using errcode = '23514', message = 'Items require only product_id and positive integer quantity';
    end if;
    v_product := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::smallint;
    select product.price_minor,product.currency into v_price,v_currency
      from private.shopper_store_products(p_store) as product
      where product.product_id = v_product and product.stock_qty >= v_quantity;
    if v_price is null then
      raise exception using errcode = '23514', message = 'List product unavailable at store';
    end if;
    insert into public.list_items(list_id,product_id,quantity,unit_price_minor,currency)
      values (v_list,v_product,v_quantity,v_price,v_currency);
  end loop;
  if p_candidate is not null then
    update public.plan_sessions as session set status = 'listed'
      from public.plan_candidates as candidate where candidate.id = p_candidate and session.id = candidate.session_id;
    update public.plan_candidates set picked_at = now() where id = p_candidate;
  end if;
  return v_list;
end;
$$;
comment on function private.create_list(uuid,jsonb,text,date,uuid) is 'Atomically snapshots positive product quantities and current store prices in minor units, optionally picking an owned candidate; never reserves stock. Returns the list UUID.';
create function public.create_list(p_store uuid,p_items jsonb,p_till_code text,p_valid_until date,p_candidate uuid default null)
returns uuid language sql set search_path = '' as $$ select private.create_list(p_store,p_items,p_till_code,p_valid_until,p_candidate); $$;
comment on function public.create_list(uuid,jsonb,text,date,uuid) is 'Creates a till list from product UUIDs and positive quantities, using current store prices; validity is the caller-supplied sale-period end date. Returns its UUID.';

create function private.preserve_plan_session_owner()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  if (new.id,new.shopper_id,new.store_id,new.qr_code_id,new.created_at)
    is distinct from (old.id,old.shopper_id,old.store_id,old.qr_code_id,old.created_at) then
    raise exception using errcode = '23514', message = 'Planning session identity cannot change';
  end if;
  return new;
end;
$$;
comment on function private.preserve_plan_session_owner() is 'Keeps planning history attached to its original shopper, store and QR source.';
create trigger preserve_session_owner before update on public.plan_sessions
  for each row execute function private.preserve_plan_session_owner();

create function private.record_shopper_consent()
returns trigger language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  if tg_op = 'UPDATE' then
    if (new.shopper_id,new.organisation_id,new.created_at)
      is distinct from (old.shopper_id,old.organisation_id,old.created_at) then
      raise exception using errcode = '23514', message = 'Consent identity cannot change';
    end if;
    if (new.visible_to_shop,new.marketing_opt_in,new.consent_text_version)
      is not distinct from (old.visible_to_shop,old.marketing_opt_in,old.consent_text_version) then
      new.consented_at := old.consented_at;
      return new;
    end if;
  end if;
  new.consented_at := now();
  return new;
end;
$$;
comment on function private.record_shopper_consent() is 'Stamps consent choices with database transaction time and preserves the original shopper and organisation identity.';
create trigger record_consent before insert or update on public.follows
  for each row execute function private.record_shopper_consent();
