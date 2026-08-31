/** Focused guards for the URL-backed effects sidebar and preview gallery. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('effects navigation expands in the global sidebar and derives every default kind', () => {
  const shell = read('components/admin/AdminShell.tsx');
  const navigation = read('lib/admin-effects-navigation.ts');

  assert.match(navigation, /\.\.\.FIREWORK_STYLE_DEFAULT_KINDS/);
  assert.match(navigation, /ADMIN_EFFECTS_BASE_VIEW/);
  assert.match(navigation, /adminEffectsViewHref/);
  assert.match(navigation, /styleDefaultKindLabel/);
  assert.match(shell, /function AdminEffectsNavItem/);
  assert.match(shell, /const submenuVisible = expanded/);
  assert.match(shell, /<SidebarMenuButton[\s\S]*aria-expanded=\{submenuVisible\}/);
  assert.match(shell, /aria-controls="admin-effects-navigation"/);
  assert.match(shell, /<SidebarMenuSub id="admin-effects-navigation">/);
  assert.match(shell, /<SidebarMenuSubItem/);
  assert.match(shell, /<SidebarMenuSubButton/);
  assert.match(shell, /ADMIN_EFFECTS_VIEWS\.map/);
  assert.match(shell, /aria-current=\{selected \? 'page' : undefined\}/);
  assert.match(shell, /setOpen\(true\)/);
  assert.match(shell, /if \(isMobile\) setOpenMobile\(false\)/);
  assert.match(shell, /className="h-11 md:h-7"/);
  assert.match(shell, /link\.href === '\/admin\/effects'/);
  assert.match(shell, /href: '\/admin\/effects',[\s\S]*permission: 'admin\.manage_catalogue'/);
});

test('effects category selection is URL-backed with a safe legacy fallback', () => {
  const page = read('app/(admin)/admin/effects/page.tsx');
  const browser = read('app/(admin)/admin/effects/EffectsBrowser.tsx');
  const shell = read('components/admin/AdminShell.tsx');
  const navigation = read('lib/admin-effects-navigation.ts');
  const styleActions = read('app/actions/admin-style-defaults.ts');
  const effectActions = read('app/actions/admin-effects.ts');

  assert.match(page, /searchParams: Promise<\{ view\?: string; tab\?: string \}>/);
  assert.match(page, /parseAdminEffectsView\(params\.view, params\.tab\)/);
  assert.match(page, /key=\{initialView\}/);
  assert.match(page, /initialView=\{initialView\}/);
  assert.match(navigation, /isFireworkStyleDefaultKind\(view\)/);
  assert.match(navigation, /legacyTab === 'defaults' \? 'star' : ADMIN_EFFECTS_BASE_VIEW/);
  assert.match(browser, /initialView: AdminEffectsView/);
  assert.match(browser, /styleDefault\.kind === activeKind/);
  assert.match(browser, /defaults\/\$\{item\.id\}\?view=\$\{item\.kind\}/);
  assert.match(shell, /\[currentSearch, pathname\]/);
  assert.match(shell, /isAdminEffectsView\(requestedEffectsView\)/);
  assert.match(shell, /adminEffectsViewHref\(effectsView\)/);
  assert.match(styleActions, /defaults\/\$\{result\.id\}\?view=\$\{parsedKind\}/);
  assert.doesNotMatch(browser, /EffectsTab|initialTab|function Tabs\(|role="tablist"/);
  assert.doesNotMatch(styleActions, /tab=defaults/);
  assert.doesNotMatch(effectActions, /tab=defaults/);
});

test('style defaults use real non-persisted renderer previews and visual cards', () => {
  const browser = read('app/(admin)/admin/effects/EffectsBrowser.tsx');
  const previewServer = read('lib/firework-card-preview.server.ts');
  const previewRoute = read('app/api/admin/firework-previews/[kind]/[id]/route.ts');
  const styleDefaults = read('lib/fireworks/style-defaults.ts');
  const styleDefaultsServer = read('lib/admin/style-defaults.server.ts');

  assert.match(browser, /<FireworkBrowseCard/);
  assert.match(browser, /filteredDefaults\.map/);
  assert.match(browser, /\/api\/admin\/firework-previews\/style-default\//);
  assert.match(browser, /persist: false/);
  assert.match(browser, /displayPoster: true/);
  assert.doesNotMatch(browser, /<DataTableShell|<table/);
  assert.match(styleDefaults, /export function compileStyleDefaultPreviewDesign/);
  assert.match(styleDefaults, /kind === 'launch' \|\| kind === 'smoke'/);
  assert.match(previewServer, /getAdminStyleDefaultPreviewSourceById/);
  assert.match(previewServer, /compileStyleDefaultPreviewDesign/);
  assert.match(previewServer, /styleDefault\.kind === 'trail' \? makeTrailPreviewStarDefaults\(\)/);
  assert.match(previewServer, /if \(kind === 'style-default'\)/);
  assert.match(styleDefaultsServer, /getAdminStyleDefaultPreviewSourceById/);
  assert.match(
    styleDefaultsServer,
    /if \(result\.error\)[\s\S]*throw new Error\('Could not load the style default preview source\.'/,
  );
  assert.match(previewRoute, /ADMIN_PREVIEW_KINDS[\s\S]*'style-default'/);
  assert.match(previewRoute, /kind === 'style-default'[\s\S]*loadAdminFireworkCardPreview/);
  assert.doesNotMatch(
    previewRoute.match(/const PERSISTABLE_ADMIN_PREVIEW_KINDS[\s\S]*?\]\);/)?.[0] ?? '',
    /style-default/,
  );
});
