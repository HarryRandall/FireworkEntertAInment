-- Mirror Auth identities, including anonymous accounts, and keep upgrades on the same UUID.
create trigger sync_auth_profile after insert or update of email, is_anonymous on auth.users
  for each row execute function private.sync_auth_profile();

-- Existing Auth identities also get their canonical profile when the schema is installed.
insert into public.profiles (id, email, is_anonymous)
select id, email, coalesce(is_anonymous, false) from auth.users
on conflict (id) do update
  set email = excluded.email, is_anonymous = excluded.is_anonymous;
