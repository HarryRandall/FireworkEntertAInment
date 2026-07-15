/** Focused source guard for permission-scoped admin route layouts. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

const guardedSubtrees = new Map([
  ['users', 'admin.manage_users'],
  ['catalogue', 'admin.manage_catalogue'],
  ['suppliers', 'admin.manage_suppliers'],
  ['imports', 'admin.manage_imports'],
  ['show-presets', 'admin.manage_catalogue'],
]);

test('admin management subtrees guard their index and nested routes', () => {
  for (const [segment, permission] of guardedSubtrees) {
    const layoutPath = join(root, 'app/(admin)/admin', segment, 'layout.tsx');
    assert.equal(existsSync(layoutPath), true, `${segment} has a nested route layout`);

    const layout = readFileSync(layoutPath, 'utf8');
    assert.match(layout, /from '@\/lib\/admin\/current-user\.server'/);
    assert.match(layout, new RegExp(`await requirePermission\\('${permission}'\\)`));
    assert.match(layout, /if \(!profile\) redirect\('\/admin'\)/);
    assert.match(layout, /return children/);
  }

  for (const segment of ['users', 'imports', 'show-presets']) {
    assert.equal(
      existsSync(join(root, 'app/(admin)/admin', segment, '[id]/page.tsx')),
      true,
      `${segment} detail route is covered by its parent layout`,
    );
  }
});
