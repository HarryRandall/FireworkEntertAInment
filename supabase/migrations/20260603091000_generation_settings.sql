-- Admin-controlled generation settings.

create table if not exists public.generation_settings (
  key text primary key,
  generation_mode text not null default 'fast',
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint generation_settings_key_check check (key in ('show_cue_generation')),
  constraint generation_settings_mode_check check (generation_mode in ('fast', 'llm'))
);

alter table public.generation_settings enable row level security;

drop policy if exists "generation_settings_admin_manage" on public.generation_settings;
create policy "generation_settings_admin_manage" on public.generation_settings
  for all using (public.current_user_has_permission('admin.manage_prompts'))
  with check (public.current_user_has_permission('admin.manage_prompts'));

drop trigger if exists generation_settings_set_updated_at on public.generation_settings;
create trigger generation_settings_set_updated_at before update on public.generation_settings
  for each row execute function public.set_updated_at();

insert into public.generation_settings (key, generation_mode)
values ('show_cue_generation', 'fast')
on conflict (key) do nothing;

