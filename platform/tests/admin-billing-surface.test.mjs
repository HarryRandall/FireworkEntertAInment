/** Source guards for the removed admin AI billing tab. Credit review and
 * grants now live on the user detail page only. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

test('the standalone admin AI billing route and nav entry are removed', () => {
  const shell = read('app/components/admin/AdminShell.tsx');

  assert.doesNotMatch(shell, /href: '\/admin\/billing'/);
  assert.doesNotMatch(shell, /label: 'AI billing'/);
  assert.equal(existsSync(join(root, 'app/(admin)/admin/billing')), false);
});

test('credit balances and grant controls survive on the user detail page', () => {
  const userDetail = read('app/(admin)/admin/users/[id]/page.tsx');
  const userHeaderActions = read('app/(admin)/admin/users/[id]/UserHeaderActions.tsx');
  const actions = read('app/actions/admin-users.ts');

  assert.match(userDetail, /AdminUserAiCreditsCard/);
  assert.match(userHeaderActions, /canManageBilling/);
  assert.match(actions, /requirePermission\('admin\.manage_billing'\)/);
});
