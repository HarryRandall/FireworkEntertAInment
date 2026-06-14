/** Static guard for sidebar layout and scroll behaviour. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

for (const path of ['app/components/app/AppShell.tsx', 'app/components/admin/AdminShell.tsx']) {
  test(`${path} persists sidebar collapse and scrolls inside the content panel`, () => {
    const source = readFileSync(join(root, path), 'utf8');
    assert.match(source, /<SidebarProvider/);
    assert.match(source, /useSidebarPreference/);
    assert.match(source, /open=\{!sidebarCollapsed\}/);
    assert.match(source, /onOpenChange=\{\(open\) => setSidebarCollapsedPreference\(!open\)\}/);
    assert.match(source, /<SidebarTrigger className="-ml-1" \/>/);
    assert.match(source, /overflow-hidden/);
    assert.match(source, /overflow-y-auto/);
    assert.doesNotMatch(source, /<SidebarRail/);
    assert.doesNotMatch(source, /useState\(readSidebarCollapsedPreference\)/);
    assert.doesNotMatch(source, /window\.localStorage/);
  });
}

test('app shell keeps workspace navigation, summary fetch, and route breadcrumbs', () => {
  const appSource = readFileSync(join(root, 'app/components/app/AppShell.tsx'), 'utf8');
  const adminSource = readFileSync(join(root, 'app/components/admin/AdminShell.tsx'), 'utf8');

  assert.match(appSource, /getAppBreadcrumbs/);
  assert.match(appSource, /formatPathSegment/);
  assert.match(appSource, /normalisedPath === '\/dashboard'\) return \[\{ label: 'Dashboard' \}\]/);
  assert.doesNotMatch(appSource, /label: 'Workspace'/);
  assert.match(appSource, /SidebarPrimaryAction/);
  assert.match(appSource, /label: 'My shows'/);
  assert.match(appSource, /label: 'Explore'/);
  assert.match(appSource, /label: 'Catalogue'/);
  assert.match(appSource, /label: 'Exports'/);
  assert.match(appSource, /label: 'Safety'/);
  assert.match(appSource, /label: 'Admin'/);
  assert.doesNotMatch(appSource, /label: 'Library'/);
  assert.match(appSource, /\/api\/me\/summary/);
  assert.match(appSource, /aria-label="Breadcrumb"/);
  assert.match(appSource, /<ShellTopBar pathname=\{effectivePath\} \/>/);

  assert.match(adminSource, /getAdminBreadcrumbs/);
  assert.match(adminSource, /aria-label="Breadcrumb"/);
});

test('shared sidebar hook reads storage after hydration and writes the cookie fallback', () => {
  const source = readFileSync(join(root, 'app/components/app/useSidebarPreference.ts'), 'utf8');
  assert.match(source, /useHydrationLayoutEffect/);
  assert.match(source, /window\.localStorage\.getItem\(sidebarCollapsedStorageKey\)/);
  assert.match(source, /window\.localStorage\.setItem\(sidebarCollapsedStorageKey/);
  assert.match(source, /document\.cookie = `\$\{sidebarCollapsedCookieName\}=/);
  assert.match(source, /setSidebarCollapsed\(resolvedPreference\)/);
});

test('sidebar primitive leaves persistence to the ShowCrafter preference hook', () => {
  const source = readFileSync(join(root, 'components/ui/sidebar.tsx'), 'utf8');
  assert.doesNotMatch(source, /sidebar_state/);
  assert.doesNotMatch(source, /document\.cookie/);
});

test('sidebar primitive clips horizontal overflow while keeping vertical scrolling', () => {
  const source = readFileSync(join(root, 'components/ui/sidebar.tsx'), 'utf8');
  assert.match(source, /overflow-x-hidden overflow-y-auto/);
  assert.match(source, /data-slot="sidebar-inner"/);
  assert.match(source, /size-full min-w-0 flex-col overflow-x-hidden/);
  assert.match(source, /flex w-full min-w-0 items-center/);
});
