/** Static database-contract guards for public.users write privileges. */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const adminUsersAction = readFileSync(join(root, 'app/(admin)/admin/users/actions.ts'), 'utf8');
const profileActions = readFileSync(join(root, 'lib/access/profile-actions.server.ts'), 'utf8');

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
  const directUserUpdates = [join(root, 'app'), join(root, 'lib')]
    .flatMap(sourceFiles)
    .filter((path) =>
      /\.from\((['"])users\1\)[\s\S]{0,600}?\.update\(/.test(readFileSync(path, 'utf8')),
    )
    .map((path) => relative(root, path));

  assert.deepEqual(directUserUpdates, ['lib/access/profile-actions.server.ts']);

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
