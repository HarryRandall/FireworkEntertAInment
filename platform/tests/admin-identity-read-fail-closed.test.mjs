/** Focused source guards for fail-closed admin identity reads. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function functionBody(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  assert.ok(start >= 0, `${name} exists`);
  const nextExport = source.indexOf('\nexport async function ', start + 1);
  return source.slice(start, nextExport >= 0 ? nextExport : undefined);
}

test('admin user list and detail reads check every joined query before mapping', () => {
  const source = read('lib/admin/users.server.ts');

  for (const [name, results] of [
    [
      'listAdminUsers',
      ['usersResult', 'userRolesResult', 'rolesResult', 'overridesResult', 'permissionsResult'],
    ],
    [
      'getAdminUserById',
      ['profileResult', 'userRolesResult', 'rolesResult', 'overridesResult', 'permissionsResult'],
    ],
  ]) {
    const body = functionBody(source, name);
    const throwIndex = body.indexOf(`throwAdminUserReadError('${name}'`);
    const mapIndex = body.indexOf('mapAdminUsersFromRows');

    assert.ok(throwIndex >= 0, `${name} throws through the safe read-error helper`);
    assert.ok(mapIndex > throwIndex, `${name} checks errors before mapping data`);
    for (const result of results) {
      assert.match(body, new RegExp(`${result}\\.error`));
    }
  }

  const detailBody = functionBody(source, 'getAdminUserById');
  assert.match(detailBody, /if \(!profile\) return null/);
  assert.ok(
    detailBody.indexOf('throwAdminUserReadError') < detailBody.indexOf('if (!profile) return null'),
    'a genuine missing profile remains distinct from a failed profile read',
  );

  assert.match(functionBody(source, 'listAdminUsers'), /if \(!admin\) return \[\]/);
  assert.match(
    detailBody,
    /if \(!\(await requirePermission\('admin\.manage_users'\)\)\) return null/,
  );
});

test('admin user activity checks show and Auth Admin failures', () => {
  const source = read('lib/admin/users.server.ts');
  const body = functionBody(source, 'getUserActivity');

  assert.match(body, /showsAllResult\.error/);
  assert.match(body, /showsRecentResult\.error/);
  assert.match(body, /throwAdminUserReadError\('getUserActivity shows'/);
  assert.match(body, /error: authUserError/);
  assert.match(body, /throwAdminUserReadError\('getUserActivity auth user'/);
  assert.doesNotMatch(body, /\{ data: authUser \} = await/);
  assert.match(body, /if \(!\(await requirePermission\('admin\.manage_users'\)\)\) return null/);
});

test('role and permission reads throw instead of substituting empty data', () => {
  const source = read('lib/admin/roles.server.ts');

  for (const name of ['listRoles', 'listRolePermissionMatrix', 'listPermissions']) {
    const body = functionBody(source, name);
    assert.match(body, /throwAdminRoleReadError/);
  }

  const matrixBody = functionBody(source, 'listRolePermissionMatrix');
  const throwIndex = matrixBody.indexOf('throwAdminRoleReadError');
  const mapIndex = matrixBody.indexOf('const mapped: RolePermissionMatrix');
  for (const errorName of ['rolesError', 'permissionsError', 'grantsError']) {
    assert.match(matrixBody, new RegExp(`error: ${errorName}`));
  }
  assert.ok(throwIndex >= 0, 'the matrix throws through the safe read-error helper');
  assert.ok(mapIndex > throwIndex, 'the matrix checks every error before mapping partial data');

  assert.match(
    matrixBody,
    /if \(!\(await requirePermission\('admin\.manage_users'\)\)\) return null/,
  );
  assert.doesNotMatch(source, /listRoles failed:[\s\S]*?return \[\]/);
  assert.doesNotMatch(source, /listPermissions failed:[\s\S]*?return \[\]/);
  assert.doesNotMatch(matrixBody, /return \{ roles: \[\], permissions: \[\], grants: \[\] \}/);
});
