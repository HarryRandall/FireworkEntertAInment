-- Theme preference and semi-static library performance improvements.

alter table public.profiles
  add column if not exists theme_preference text not null default 'dark'
  check (theme_preference in ('dark', 'light', 'system'));

create or replace function public.current_user_access()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with current_profile as (
    select id, email, full_name, phone, status, theme_preference
    from public.profiles
    where id = auth.uid()
  ),
  assigned_roles as (
    select r.id, r.key, r.name
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
  ),
  role_grants as (
    select distinct p.key
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
  ),
  overrides as (
    select p.key, upo.enabled
    from public.user_permission_overrides upo
    join public.permissions p on p.id = upo.permission_id
    where upo.user_id = auth.uid()
  ),
  final_permissions as (
    select key from role_grants
    where key not in (select key from overrides where enabled = false)
    union
    select key from overrides where enabled = true
  )
  select jsonb_build_object(
    'profile', coalesce((select to_jsonb(current_profile) from current_profile), '{}'::jsonb),
    'roles', coalesce((select jsonb_agg(key order by key) from assigned_roles), '[]'::jsonb),
    'permissions', coalesce((select jsonb_agg(key order by key) from final_permissions), '[]'::jsonb)
  );
$$;

create index if not exists show_templates_updated_idx
  on public.show_templates (updated_at desc);

update public.firework_specifications
set spec = jsonb_set(spec, '{colors}', '["#00E5FF", "#8B5CF6", "#FF3DF2"]'::jsonb, true)
where slug in ('peony', 'chrysanthemum');

update public.firework_specifications
set spec = jsonb_set(spec, '{colors}', '["#00E5FF", "#B9F7FF", "#3B82F6"]'::jsonb, true)
where slug = 'comet';

update public.firework_specifications
set spec = jsonb_set(spec, '{colors}', '["#8B5CF6", "#FF3DF2", "#00E5FF"]'::jsonb, true)
where slug = 'willow';

update public.firework_specifications
set spec = jsonb_set(spec, '{colors}', '["#00E5FF", "#3B82F6", "#8B5CF6", "#FFD166"]'::jsonb, true)
where slug = 'finale_barrage';
