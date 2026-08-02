/** Static database-contract guards for public.users write privileges. */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const migration = readFileSync(
  join(root, 'supabase/migrations/20260715053008_restrict_user_profile_updates.sql'),
  'utf8',
);
const adminUsersAction = readFileSync(join(root, 'app/actions/admin-users.ts'), 'utf8');
const profileActions = readFileSync(join(root, 'app/actions/platform-admin.ts'), 'utf8');

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  });
}

function functionBody(source, name) {
  const marker = `export async function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing`);
  const next = source.indexOf('\nexport async function ', start + marker.length);
  return source.slice(start, next === -1 ? source.length : next);
}

test('authenticated users receive only self-profile column updates', () => {
  assert.match(migration, /revoke update on table public\.users from authenticated/);
  assert.match(
    migration,
    /revoke update \(id, email, full_name, phone, status, theme_preference, created_at, updated_at\)[\s\S]*?on table public\.users from authenticated/,
  );
  assert.match(
    migration,
    /grant update \(full_name, phone, theme_preference\) on table public\.users to authenticated/,
  );
  assert.doesNotMatch(
    migration,
    /grant update \([^)]*(?:status|email|id|created_at|updated_at)[^)]*\) on table public\.users/,
  );
  assert.match(migration, /drop policy if exists users_update_own_or_admin/);
  assert.match(
    migration,
    /create policy users_update_own on public\.users[\s\S]*?for update to authenticated[\s\S]*?using \(\(select auth\.uid\(\)\) = id\)[\s\S]*?with check \(\(select auth\.uid\(\)\) = id\)/,
  );
});

test('the status RPC rechecks live caller state and admin permission', () => {
  assert.match(
    migration,
    /create or replace function public\.set_user_status\(p_user_id uuid, p_status text\)[\s\S]*?security definer[\s\S]*?set search_path = ''/,
  );
  assert.match(migration, /v_caller_id uuid := auth\.uid\(\)/);
  assert.match(migration, /caller\.status = 'active'/);
  assert.match(migration, /public\.current_user_has_permission\('admin\.manage_users'\)/);
  assert.match(
    migration,
    /p_user_id is null or p_status is null or p_status not in \('active', 'suspended'\)/,
  );
  assert.match(migration, /p_user_id = v_caller_id and p_status = 'suspended'/);
  assert.match(migration, /update public\.users[\s\S]*?set status = p_status/);
  assert.match(
    migration,
    /revoke execute on function public\.set_user_status\(uuid, text\)[\s\S]*?from public, anon, service_role/,
  );
  assert.match(
    migration,
    /grant execute on function public\.set_user_status\(uuid, text\) to authenticated/,
  );
  assert.match(migration, /has_table_privilege\('authenticated', 'public\.users', 'UPDATE'\)/);
  assert.match(
    migration,
    /has_column_privilege\([\s\S]*?'authenticated',[\s\S]*?'public\.users',[\s\S]*?v_column_name,[\s\S]*?'UPDATE'/,
  );
  assert.match(
    migration,
    /from pg_policies[\s\S]*?tablename = 'users'[\s\S]*?cmd in \('UPDATE', 'ALL'\)[\s\S]*?policyname = 'users_update_own'/,
  );
  assert.match(
    migration,
    /has_function_privilege\([\s\S]*?'authenticated'[\s\S]*?'public\.set_user_status\(uuid,text\)'[\s\S]*?'EXECUTE'/,
  );
});

test('the admin action uses only the narrowly typed status RPC', () => {
  assert.match(
    adminUsersAction,
    /const SetStatusSchema = z\.object\([\s\S]*?\.uuid\(\)[\s\S]*?\.transform\(\(value\) => value\.toLowerCase\(\)\)/,
  );
  assert.match(
    adminUsersAction,
    /type UserStatusRpcClient = \{[\s\S]*?functionName: 'set_user_status'[\s\S]*?p_status: 'active' \| 'suspended'/,
  );
  assert.match(
    adminUsersAction,
    /requirePermission\('admin\.manage_users'\)[\s\S]*?statusRpc\.rpc\('set_user_status'/,
  );
  assert.doesNotMatch(adminUsersAction, /\.from\('users'\)[\s\S]{0,120}?\.update\(\{ status:/);
  assert.match(adminUsersAction, /updatedUserId !== parsed\.data\.userId/);
});

test('the only direct application update matches the profile column grant', () => {
  const directUserUpdates = [join(root, 'app'), join(root, 'lib'), join(root, 'utils')]
    .flatMap(sourceFiles)
    .filter((path) =>
      /\.from\((['"])users\1\)[\s\S]{0,600}?\.update\(/.test(readFileSync(path, 'utf8')),
    )
    .map((path) => relative(root, path).replaceAll('\\', '/'));

  assert.deepEqual(directUserUpdates, ['app/actions/platform-admin.ts']);

  const updateProfileAction = functionBody(profileActions, 'updateProfileAction');
  assert.match(updateProfileAction, /patch\.full_name =/);
  assert.match(updateProfileAction, /patch\.phone =/);
  assert.match(updateProfileAction, /patch\.theme_preference =/);
  assert.match(
    updateProfileAction,
    /\.from\('users'\)[\s\S]*?\.update\(patch\)[\s\S]*?\.eq\('id', userId\)/,
  );
  assert.doesNotMatch(updateProfileAction, /patch\.(?:id|email|status|created_at|updated_at)\s*=/);
});
