/** Static-analysis guard for the admin roles and permission override UX. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

test('admin roles page edits role permission defaults with lockout guards', () => {
  const rolesPagePath = join(root, 'app/(admin)/admin/roles/page.tsx');
  const rolesPage = readFileSync(rolesPagePath, 'utf8');
  const roleMatrix = readFileSync(
    join(root, 'app/(admin)/admin/roles/RolePermissionMatrix.tsx'),
    'utf8',
  );
  const roleToggle = readFileSync(
    join(root, 'app/(admin)/admin/roles/RolePermissionToggle.tsx'),
    'utf8',
  );
  const roleAction = readFileSync(join(root, 'app/actions/admin-roles.ts'), 'utf8');
  const userAction = readFileSync(join(root, 'app/actions/admin-users.ts'), 'utf8');
  const shell = readFileSync(join(root, 'app/components/admin/AdminShell.tsx'), 'utf8');
  const migration = readFileSync(
    join(root, 'supabase/migrations/20260531091000_admin_role_permissions_modify.sql'),
    'utf8',
  );

  assert.equal(existsSync(rolesPagePath), true);
  assert.match(shell, /ShieldCheck/);
  assert.match(shell, /\/admin\/roles/);
  assert.match(rolesPage, /listRolePermissionMatrix/);
  assert.match(rolesPage, /RolePermissionMatrix/);
  assert.match(rolesPage, /filters=/);
  assert.match(rolesPage, /Platform access/);
  assert.match(roleMatrix, /RolePermissionToggle/);
  assert.match(roleMatrix, /InfoTooltip/);
  assert.match(roleMatrix, /Show builder/);
  assert.match(roleMatrix, /overflow-auto/);
  assert.match(roleMatrix, /max-h-\[/);
  assert.match(roleMatrix, /sticky top-0/);
  assert.match(roleToggle, /Disabled/);
  assert.match(roleToggle, /Disable/);
  assert.match(roleToggle, /cursor-pointer/);
  assert.match(roleToggle, /backdrop-blur/);
  assert.match(roleToggle, /color-status-danger/);
  assert.doesNotMatch(rolesPage, /<table/);
  assert.doesNotMatch(rolesPage, /DataTableShell/);
  assert.match(roleAction, /role_permissions/);
  assert.match(roleAction, /admin\.manage_users/);
  assert.match(roleAction, /isLockedRolePermission/);
  assert.match(roleAction, /createServiceRoleSupabase/);
  assert.match(userAction, /You cannot change your own role/);
  assert.match(userAction, /You cannot deny your own admin access/);
  assert.match(migration, /role_permissions_admin_modify/);
});

test('user detail renders permission exceptions instead of every permission row', () => {
  const detailPage = readFileSync(join(root, 'app/(admin)/admin/users/[id]/page.tsx'), 'utf8');
  const addDialog = readFileSync(
    join(root, 'app/(admin)/admin/users/[id]/AddPermissionOverrideDialog.tsx'),
    'utf8',
  );
  const exceptionsPanel = readFileSync(
    join(root, 'app/(admin)/admin/users/[id]/PermissionExceptionsPanel.tsx'),
    'utf8',
  );
  const exceptionRow = readFileSync(
    join(root, 'app/(admin)/admin/users/[id]/PermissionExceptionRow.tsx'),
    'utf8',
  );

  assert.match(detailPage, /PermissionExceptionsPanel/);
  assert.match(exceptionsPanel, /Permission exceptions/);
  assert.match(exceptionsPanel, /Permission overrides are listed only when customised/);
  assert.match(exceptionsPanel, /AddPermissionOverrideDialog/);
  assert.match(exceptionsPanel, /PermissionExceptionRow/);
  assert.match(exceptionsPanel, /onSaved/);
  assert.match(exceptionsPanel, /onFailed/);
  assert.match(exceptionsPanel, /setExceptions/);
  assert.match(exceptionsPanel, /onCleared/);
  assert.match(exceptionsPanel, /onClearFailed/);
  assert.doesNotMatch(detailPage, /border-dashed/);
  assert.doesNotMatch(detailPage, /<PermissionOverrideRow/);
  assert.match(addDialog, /setUserPermissionOverrideAction/);
  assert.match(addDialog, /overflow-y-auto/);
  assert.match(addDialog, /Record<string, Mode>/);
  assert.match(addDialog, /selectedOverrides/);
  assert.match(addDialog, /Save \{selectedOverrides\.length > 1/);
  assert.match(addDialog, /toast\.loading/);
  assert.match(addDialog, /onFailed/);
  assert.match(addDialog, /Default/);
  assert.match(addDialog, /On/);
  assert.match(addDialog, /Off/);
  assert.match(exceptionRow, /Default/);
  assert.doesNotMatch(exceptionRow, /font-mono/);
  assert.doesNotMatch(addDialog, /flex h-4 w-4/);
  assert.doesNotMatch(addDialog, /font-mono/);
  assert.doesNotMatch(addDialog, /formatCategory/);
});
