import { databaseTarget, executeSql } from './runtime.mjs';

try {
  const args = process.argv.slice(2);
  const index = args.indexOf('--user-id');
  if (index < 0 || index !== args.length - 2) {
    throw new Error(
      'Specify --local or --project-ref <ref>, then --user-id <verified-account-uuid>.',
    );
  }
  const target = databaseTarget(args.slice(0, index));
  const userId = args[index + 1];
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(userId)) {
    throw new Error('Supply the exact UUID of the account that should become administrator.');
  }
  executeSql(
    target,
    `begin;
    do $$ begin
      if not exists (select 1 from auth.users a join public.users u on u.id = a.id
        where a.id = '${userId}' and a.email_confirmed_at is not null
          and a.deleted_at is null and u.status = 'active') then
        raise exception 'Administrator setup requires an existing, verified, active account';
      end if;
      if not exists (select 1 from public.roles where key = 'admin') then
        raise exception 'Install the catalogue and role seed before setting up an administrator';
      end if;
    end $$;
    insert into public.user_roles (user_id, role_id)
    select '${userId}', id from public.roles where key = 'admin'
    on conflict (user_id) do update set role_id = excluded.role_id;
    commit;`,
  );
  console.log('Administrator role assigned to the specified verified account.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
