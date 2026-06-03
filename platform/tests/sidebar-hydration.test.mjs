/** Static guard for sidebar collapse hydration safety. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

for (const path of ['app/components/app/AppShell.tsx', 'app/components/admin/AdminShell.tsx']) {
  test(`${path} delegates persisted sidebar hydration to the shared hook`, () => {
    const source = readFileSync(join(root, path), 'utf8');
    assert.match(source, /useSidebarPreference/);
    assert.match(source, /initialSidebarCollapsed = false/);
    assert.match(source, /hasInitialSidebarCollapsedCookie = false/);
    assert.match(source, /sidebarCollapsed, sidebarTransitionReady, toggleSidebar/);
    assert.doesNotMatch(source, /useState\(readSidebarCollapsedPreference\)/);
    assert.doesNotMatch(source, /window\.localStorage/);
  });
}

test('shared sidebar hook reads storage after hydration and writes the cookie fallback', () => {
  const source = readFileSync(join(root, 'app/components/app/useSidebarPreference.ts'), 'utf8');
  assert.match(source, /useHydrationLayoutEffect/);
  assert.match(source, /window\.localStorage\.getItem\(sidebarCollapsedStorageKey\)/);
  assert.match(source, /window\.localStorage\.setItem\(sidebarCollapsedStorageKey/);
  assert.match(source, /document\.cookie = `\$\{sidebarCollapsedCookieName\}=/);
  assert.match(source, /setSidebarCollapsed\(resolvedPreference\)/);
});
