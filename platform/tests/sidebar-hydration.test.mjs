/** Static guard for sidebar collapse hydration safety. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

for (const path of ['app/components/app/AppShell.tsx', 'app/components/admin/AdminShell.tsx']) {
  test(`${path} does not read localStorage during the initial render`, () => {
    const source = readFileSync(join(root, path), 'utf8');
    assert.match(source, /const \[sidebarCollapsed, setSidebarCollapsed\] = useState\(false\)/);
    assert.match(source, /setSidebarCollapsed\(readSidebarCollapsedPreference\(\)\)/);
    assert.doesNotMatch(source, /useState\(readSidebarCollapsedPreference\)/);
  });
}
