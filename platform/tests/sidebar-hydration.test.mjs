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
    assert.match(source, /SIDEBAR_HEADER_TRIGGER_CLASS/);
    assert.match(source, /hover:bg-sidebar-accent/);
    assert.match(source, /group-data-\[collapsible=icon\]:opacity-0/);
    assert.match(source, /group-data-\[collapsible=icon\]:group-hover:opacity-100/);
    assert.match(source, /group-data-\[collapsible=icon\]:group-hover:opacity-0/);
    assert.match(source, /<SidebarTrigger className=\{SIDEBAR_HEADER_TRIGGER_CLASS\} \/>/);
    assert.doesNotMatch(source, /<SidebarTrigger className="-ml-1" \/>/);
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
  assert.match(
    appSource,
    /normalisedPath === '\/home'\) return \[\{ label: 'Home', icon: Home \}\]/,
  );
  assert.match(appSource, /icon\?: LucideIcon/);
  assert.match(appSource, /icon: staticLink\?\.icon/);
  assert.doesNotMatch(appSource, /label: 'Workspace'/);
  assert.doesNotMatch(appSource, /<SidebarGroupLabel>Workspace<\/SidebarGroupLabel>/);
  assert.match(appSource, /SidebarPrimaryAction/);
  assert.match(appSource, /label: 'My shows'/);
  assert.match(appSource, /label: 'Explore'/);
  assert.match(appSource, /label: 'Catalogue'/);
  assert.match(appSource, /label: 'Exports'/);
  assert.match(appSource, /label: 'Safety'/);
  assert.match(appSource, /label: 'Admin'/);
  assert.doesNotMatch(appSource, /label: 'Library'/);
  assert.match(appSource, /\/api\/me\/summary/);
  assert.match(appSource, /WORKSPACE_SUMMARY_CACHE_KEY_PREFIX = 'sc:workspace-summary:v2'/);
  assert.match(appSource, /workspaceSummaryCacheKey\(profileId\)/);
  assert.match(appSource, /readCachedWorkspaceSummary\(profileId\)/);
  assert.match(appSource, /writeCachedWorkspaceSummary\(profileId, nextSummary\)/);
  assert.doesNotMatch(appSource, /sc:workspace-summary:v1/);
  assert.match(appSource, /aria-label="Breadcrumb"/);
  assert.match(appSource, /<ShellTopBar pathname=\{effectivePath\} \/>/);

  assert.match(adminSource, /getAdminBreadcrumbs/);
  assert.match(adminSource, /aria-label="Breadcrumb"/);
});

test('app profile theme picker stays compact and border-only', () => {
  const source = readFileSync(join(root, 'app/components/app/AppShell.tsx'), 'utf8');
  const start = source.indexOf('function ProfileThemeMenu()');
  const end = source.indexOf('function SidebarAiUsageMeter', start);
  const themeBlock = source.slice(start, end);

  assert.match(themeBlock, /aria-label="Interface theme"/);
  assert.match(themeBlock, /hover:bg-\[color:var\(--accent\)\]/);
  assert.match(themeBlock, /flex h-8 items-center gap-2 rounded-sm px-2/);
  assert.match(
    themeBlock,
    /bg-muted ml-auto flex shrink-0 items-center gap-0\.5 rounded-full p-0\.5/,
  );
  assert.match(themeBlock, /flex h-6 w-6 items-center justify-center rounded-full/);
  assert.match(themeBlock, /bg-background text-foreground shadow-xs/);
  assert.doesNotMatch(themeBlock, /before:right-\[/);
  assert.doesNotMatch(themeBlock, /ring-border\/80/);
  assert.doesNotMatch(themeBlock, /w-\[6\.75rem\]/);

  assert.match(source, /<ProfileMenuButton profile=\{profile\} onSignOut=\{onSignOut\} \/>/);
  assert.doesNotMatch(source, /!\s*inSettings\s*\? <ProfileMenuButton/);
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
