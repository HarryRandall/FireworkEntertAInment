-- RBAC, organisations, supplier inventory, and import foundation.
-- Existing shows remain user-scoped in this migration.

alter table public.profiles
  add column if not exists phone text,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'suspended')),
  add column if not exists last_seen_at timestamptz;

-- ─── RBAC ─────────────────────────────────────────────────────────
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  category text not null default 'general',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table if not exists public.user_permission_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  enabled boolean not null default true,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, permission_id)
);

create index if not exists user_roles_user_id_idx on public.user_roles (user_id);
create index if not exists user_permission_overrides_user_id_idx
  on public.user_permission_overrides (user_id);

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_permission_overrides enable row level security;

create or replace function public.has_permission(target_user_id uuid, permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_permission_overrides upo
    join public.permissions p on p.id = upo.permission_id
    where upo.user_id = target_user_id
      and p.key = permission_key
      and upo.enabled = true
  )
  or (
    exists (
      select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions p on p.id = rp.permission_id
      where ur.user_id = target_user_id
        and p.key = permission_key
    )
    and not exists (
      select 1
      from public.user_permission_overrides upo
      join public.permissions p on p.id = upo.permission_id
      where upo.user_id = target_user_id
        and p.key = permission_key
        and upo.enabled = false
    )
  );
$$;

create or replace function public.current_user_has_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.has_permission(auth.uid(), permission_key);
$$;

insert into public.roles (key, name, description, sort_order)
values
  ('admin', 'Admin', 'Can manage the platform, users, suppliers, imports, and catalogue data.', 10),
  ('supplier', 'Supplier', 'Can manage supplier stock and catalogue availability.', 20),
  ('user', 'User', 'Can create and manage personal firework shows.', 30)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order;

insert into public.permissions (key, name, description, category)
values
  ('shows.create', 'Create shows', 'Create and manage personal show designs.', 'shows'),
  ('admin.view', 'View admin dashboard', 'Open the admin area.', 'admin'),
  ('admin.manage_users', 'Manage users', 'Edit app profiles, roles, and permission overrides.', 'admin'),
  ('admin.manage_organisations', 'Manage organisations', 'View and edit organisation records and memberships.', 'admin'),
  ('admin.manage_suppliers', 'Manage suppliers', 'View and edit supplier records and locations.', 'admin'),
  ('admin.manage_catalogue', 'Manage catalogue', 'View and edit catalogue and firework specification records.', 'admin'),
  ('admin.manage_imports', 'Manage imports', 'View and manage VDL/video import jobs.', 'admin'),
  ('supplier.view', 'View supplier dashboard', 'Open the supplier area.', 'supplier'),
  ('supplier.manage_stock', 'Manage supplier stock', 'Create and update supplier stock records.', 'supplier')
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'shows.create',
  'admin.view',
  'admin.manage_users',
  'admin.manage_organisations',
  'admin.manage_suppliers',
  'admin.manage_catalogue',
  'admin.manage_imports',
  'supplier.view',
  'supplier.manage_stock'
)
where r.key = 'admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('shows.create')
where r.key = 'user'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('shows.create', 'supplier.view', 'supplier.manage_stock')
where r.key = 'supplier'
on conflict do nothing;

insert into public.user_roles (user_id, role_id)
select p.id, r.id
from public.profiles p
join public.roles r on r.key = 'user'
where not exists (
  select 1 from public.user_roles ur where ur.user_id = p.id
)
on conflict do nothing;

insert into public.user_roles (user_id, role_id)
select p.id, r.id
from public.profiles p
join public.roles r on r.key = 'admin'
where lower(p.email) = 'randallhazza@gmail.com'
on conflict do nothing;

-- Keep signup materialisation responsible for default roles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_role_id uuid;
  admin_role_id uuid;
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  select id into default_role_id from public.roles where key = 'user';
  if default_role_id is not null then
    insert into public.user_roles (user_id, role_id)
    values (new.id, default_role_id)
    on conflict do nothing;
  end if;

  if lower(coalesce(new.email, '')) = 'randallhazza@gmail.com' then
    select id into admin_role_id from public.roles where key = 'admin';
    if admin_role_id is not null then
      insert into public.user_roles (user_id, role_id)
      values (new.id, admin_role_id)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

-- ─── Organisations ───────────────────────────────────────────────
create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  type text not null default 'customer'
    check (type in ('customer', 'supplier', 'internal')),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organisation_memberships (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organisation_id, user_id)
);

create index if not exists organisation_memberships_user_id_idx
  on public.organisation_memberships (user_id);

alter table public.organisations enable row level security;
alter table public.organisation_memberships enable row level security;

-- ─── Suppliers and stock ─────────────────────────────────────────
create table if not exists public.supplier_profiles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete set null,
  name text not null,
  slug text not null unique,
  contact_email text,
  phone text,
  website_url text,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_locations (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier_profiles(id) on delete cascade,
  name text not null,
  address text,
  region text,
  country text,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalogue_products (
  id uuid primary key default gen_random_uuid(),
  part_number text not null unique,
  name text not null,
  manufacturer text,
  category text,
  firework_type text,
  duration_seconds numeric(8,2),
  description text,
  source_table text,
  source_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_inventory_items (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier_profiles(id) on delete cascade,
  location_id uuid references public.supplier_locations(id) on delete set null,
  product_id uuid references public.catalogue_products(id) on delete set null,
  supplier_sku text,
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  price_cents integer check (price_cents is null or price_cents >= 0),
  currency text not null default 'AUD',
  available boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supplier_inventory_supplier_id_idx
  on public.supplier_inventory_items (supplier_id, available);
create index if not exists catalogue_products_search_idx
  on public.catalogue_products (part_number, name);

alter table public.supplier_profiles enable row level security;
alter table public.supplier_locations enable row level security;
alter table public.catalogue_products enable row level security;
alter table public.supplier_inventory_items enable row level security;

-- ─── VDL/video import foundation ─────────────────────────────────
create table if not exists public.vdl_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  description text,
  video_url text,
  example_vdl_phrase text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  source_type text not null check (source_type in ('upload', 'loom', 'external_url')),
  url text,
  storage_path text,
  mime_type text,
  duration_seconds numeric(8,2),
  width integer,
  height integer,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('vdl_glossary', 'firework_video', 'supplier_stock')),
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'processing', 'needs_review', 'complete', 'failed')),
  source_name text not null,
  source_url text,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  row_count integer,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_outputs (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.import_jobs(id) on delete cascade,
  output_type text not null check (output_type in ('raw_rows', 'model_output', 'review_notes')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.firework_specifications
  add column if not exists source_import_job_id uuid references public.import_jobs(id) on delete set null,
  add column if not exists source_media_asset_id uuid references public.media_assets(id) on delete set null,
  add column if not exists vdl_phrase text,
  add column if not exists review_status text not null default 'approved'
    check (review_status in ('draft', 'needs_review', 'approved', 'archived'));

create index if not exists import_jobs_status_idx on public.import_jobs (status, created_at desc);
create index if not exists vdl_terms_term_idx on public.vdl_terms (term);

alter table public.vdl_terms enable row level security;
alter table public.media_assets enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_outputs enable row level security;

-- ─── RLS policies ────────────────────────────────────────────────
drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all" on public.profiles
  for select using (public.current_user_has_permission('admin.manage_users'));

drop policy if exists "profiles_admin_update_all" on public.profiles;
create policy "profiles_admin_update_all" on public.profiles
  for update using (public.current_user_has_permission('admin.manage_users'))
  with check (public.current_user_has_permission('admin.manage_users'));

drop policy if exists "roles_read_authenticated" on public.roles;
create policy "roles_read_authenticated" on public.roles
  for select using (auth.uid() is not null);

drop policy if exists "permissions_read_authenticated" on public.permissions;
create policy "permissions_read_authenticated" on public.permissions
  for select using (auth.uid() is not null);

drop policy if exists "role_permissions_read_authenticated" on public.role_permissions;
create policy "role_permissions_read_authenticated" on public.role_permissions
  for select using (auth.uid() is not null);

drop policy if exists "user_roles_select_own_or_admin" on public.user_roles;
create policy "user_roles_select_own_or_admin" on public.user_roles
  for select using (
    auth.uid() = user_id or public.current_user_has_permission('admin.manage_users')
  );

drop policy if exists "user_roles_admin_modify" on public.user_roles;
create policy "user_roles_admin_modify" on public.user_roles
  for all using (public.current_user_has_permission('admin.manage_users'))
  with check (public.current_user_has_permission('admin.manage_users'));

drop policy if exists "user_permission_overrides_select_own_or_admin" on public.user_permission_overrides;
create policy "user_permission_overrides_select_own_or_admin" on public.user_permission_overrides
  for select using (
    auth.uid() = user_id or public.current_user_has_permission('admin.manage_users')
  );

drop policy if exists "user_permission_overrides_admin_modify" on public.user_permission_overrides;
create policy "user_permission_overrides_admin_modify" on public.user_permission_overrides
  for all using (public.current_user_has_permission('admin.manage_users'))
  with check (public.current_user_has_permission('admin.manage_users'));

drop policy if exists "organisations_admin_select" on public.organisations;
create policy "organisations_admin_select" on public.organisations
  for select using (public.current_user_has_permission('admin.manage_organisations'));

drop policy if exists "organisations_admin_modify" on public.organisations;
create policy "organisations_admin_modify" on public.organisations
  for all using (public.current_user_has_permission('admin.manage_organisations'))
  with check (public.current_user_has_permission('admin.manage_organisations'));

drop policy if exists "organisation_memberships_admin_select" on public.organisation_memberships;
create policy "organisation_memberships_admin_select" on public.organisation_memberships
  for select using (
    user_id = auth.uid() or public.current_user_has_permission('admin.manage_organisations')
  );

drop policy if exists "organisation_memberships_admin_modify" on public.organisation_memberships;
create policy "organisation_memberships_admin_modify" on public.organisation_memberships
  for all using (public.current_user_has_permission('admin.manage_organisations'))
  with check (public.current_user_has_permission('admin.manage_organisations'));

drop policy if exists "supplier_profiles_select_allowed" on public.supplier_profiles;
create policy "supplier_profiles_select_allowed" on public.supplier_profiles
  for select using (
    public.current_user_has_permission('admin.manage_suppliers')
    or public.current_user_has_permission('supplier.view')
  );

drop policy if exists "supplier_profiles_modify_allowed" on public.supplier_profiles;
create policy "supplier_profiles_modify_allowed" on public.supplier_profiles
  for all using (
    public.current_user_has_permission('admin.manage_suppliers')
    or public.current_user_has_permission('supplier.manage_stock')
  ) with check (
    public.current_user_has_permission('admin.manage_suppliers')
    or public.current_user_has_permission('supplier.manage_stock')
  );

drop policy if exists "supplier_locations_select_allowed" on public.supplier_locations;
create policy "supplier_locations_select_allowed" on public.supplier_locations
  for select using (
    public.current_user_has_permission('admin.manage_suppliers')
    or public.current_user_has_permission('supplier.view')
  );

drop policy if exists "supplier_locations_modify_allowed" on public.supplier_locations;
create policy "supplier_locations_modify_allowed" on public.supplier_locations
  for all using (
    public.current_user_has_permission('admin.manage_suppliers')
    or public.current_user_has_permission('supplier.manage_stock')
  ) with check (
    public.current_user_has_permission('admin.manage_suppliers')
    or public.current_user_has_permission('supplier.manage_stock')
  );

drop policy if exists "catalogue_products_select_authenticated" on public.catalogue_products;
create policy "catalogue_products_select_authenticated" on public.catalogue_products
  for select using (auth.uid() is not null);

drop policy if exists "catalogue_products_admin_modify" on public.catalogue_products;
create policy "catalogue_products_admin_modify" on public.catalogue_products
  for all using (public.current_user_has_permission('admin.manage_catalogue'))
  with check (public.current_user_has_permission('admin.manage_catalogue'));

drop policy if exists "supplier_inventory_select_allowed" on public.supplier_inventory_items;
create policy "supplier_inventory_select_allowed" on public.supplier_inventory_items
  for select using (
    public.current_user_has_permission('admin.manage_suppliers')
    or public.current_user_has_permission('supplier.view')
  );

drop policy if exists "supplier_inventory_modify_allowed" on public.supplier_inventory_items;
create policy "supplier_inventory_modify_allowed" on public.supplier_inventory_items
  for all using (
    public.current_user_has_permission('admin.manage_suppliers')
    or public.current_user_has_permission('supplier.manage_stock')
  ) with check (
    public.current_user_has_permission('admin.manage_suppliers')
    or public.current_user_has_permission('supplier.manage_stock')
  );

drop policy if exists "vdl_terms_select_authenticated" on public.vdl_terms;
create policy "vdl_terms_select_authenticated" on public.vdl_terms
  for select using (auth.uid() is not null);

drop policy if exists "vdl_terms_admin_modify" on public.vdl_terms;
create policy "vdl_terms_admin_modify" on public.vdl_terms
  for all using (public.current_user_has_permission('admin.manage_catalogue'))
  with check (public.current_user_has_permission('admin.manage_catalogue'));

drop policy if exists "media_assets_select_allowed" on public.media_assets;
create policy "media_assets_select_allowed" on public.media_assets
  for select using (
    owner_id = auth.uid()
    or public.current_user_has_permission('admin.manage_imports')
  );

drop policy if exists "media_assets_insert_own" on public.media_assets;
create policy "media_assets_insert_own" on public.media_assets
  for insert with check (owner_id = auth.uid());

drop policy if exists "media_assets_admin_modify" on public.media_assets;
create policy "media_assets_admin_modify" on public.media_assets
  for all using (public.current_user_has_permission('admin.manage_imports'))
  with check (public.current_user_has_permission('admin.manage_imports'));

drop policy if exists "import_jobs_admin_select" on public.import_jobs;
create policy "import_jobs_admin_select" on public.import_jobs
  for select using (public.current_user_has_permission('admin.manage_imports'));

drop policy if exists "import_jobs_admin_modify" on public.import_jobs;
create policy "import_jobs_admin_modify" on public.import_jobs
  for all using (public.current_user_has_permission('admin.manage_imports'))
  with check (public.current_user_has_permission('admin.manage_imports'));

drop policy if exists "import_outputs_admin_select" on public.import_outputs;
create policy "import_outputs_admin_select" on public.import_outputs
  for select using (public.current_user_has_permission('admin.manage_imports'));

drop policy if exists "import_outputs_admin_modify" on public.import_outputs;
create policy "import_outputs_admin_modify" on public.import_outputs
  for all using (public.current_user_has_permission('admin.manage_imports'))
  with check (public.current_user_has_permission('admin.manage_imports'));

-- ─── Triggers ────────────────────────────────────────────────────
drop trigger if exists roles_set_updated_at on public.roles;
create trigger roles_set_updated_at before update on public.roles
  for each row execute function public.set_updated_at();

drop trigger if exists permissions_set_updated_at on public.permissions;
create trigger permissions_set_updated_at before update on public.permissions
  for each row execute function public.set_updated_at();

drop trigger if exists user_permission_overrides_set_updated_at on public.user_permission_overrides;
create trigger user_permission_overrides_set_updated_at before update on public.user_permission_overrides
  for each row execute function public.set_updated_at();

drop trigger if exists organisations_set_updated_at on public.organisations;
create trigger organisations_set_updated_at before update on public.organisations
  for each row execute function public.set_updated_at();

drop trigger if exists supplier_profiles_set_updated_at on public.supplier_profiles;
create trigger supplier_profiles_set_updated_at before update on public.supplier_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists supplier_locations_set_updated_at on public.supplier_locations;
create trigger supplier_locations_set_updated_at before update on public.supplier_locations
  for each row execute function public.set_updated_at();

drop trigger if exists catalogue_products_set_updated_at on public.catalogue_products;
create trigger catalogue_products_set_updated_at before update on public.catalogue_products
  for each row execute function public.set_updated_at();

drop trigger if exists supplier_inventory_items_set_updated_at on public.supplier_inventory_items;
create trigger supplier_inventory_items_set_updated_at before update on public.supplier_inventory_items
  for each row execute function public.set_updated_at();

drop trigger if exists vdl_terms_set_updated_at on public.vdl_terms;
create trigger vdl_terms_set_updated_at before update on public.vdl_terms
  for each row execute function public.set_updated_at();

drop trigger if exists import_jobs_set_updated_at on public.import_jobs;
create trigger import_jobs_set_updated_at before update on public.import_jobs
  for each row execute function public.set_updated_at();

revoke execute on function public.has_permission(uuid, text) from public;
revoke execute on function public.current_user_has_permission(text) from public;
grant execute on function public.has_permission(uuid, text) to authenticated;
grant execute on function public.current_user_has_permission(text) to authenticated;
