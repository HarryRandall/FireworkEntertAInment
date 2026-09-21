/** Static-analysis "grep the source" test guarding RBAC performance invariants. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

test('current profile prefers one RPC call with fallback queries', () => {
  const server = readFileSync(join(root, 'lib/admin/current-user.server.ts'), 'utf8');
  assert.match(server, /\.rpc\(\s*['"]current_user_access['"]/);
  assert.match(server, /parseAccessRpc/);
  assert.match(server, /accessError/);
});
