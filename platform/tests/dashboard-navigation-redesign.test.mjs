/** Static guards for the focused V1 dashboard and navigation redesign. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('dashboard uses the redesigned summary layout instead of paginated show cards', () => {
  const dashboard = read('app/(app)/dashboard/page.tsx');

  assert.match(dashboard, /getDashboardSummary/);
  assert.match(dashboard, /JumpBackInHero/);
  assert.match(dashboard, /ShowSummaryRow/);
  assert.match(dashboard, /TemplateSummaryCardView/);
  assert.match(dashboard, /EmptyShowsPanel/);
  assert.doesNotMatch(dashboard, /TablePagination/);
  assert.doesNotMatch(dashboard, /PAGE_SIZE/);
  assert.doesNotMatch(dashboard, /Draft/);
});

test('app shell exposes only shipped V1 navigation routes', () => {
  const shell = read('app/components/app/AppShell.tsx');

  assert.match(shell, /href: '\/dashboard', label: 'Dashboard'/);
  assert.match(shell, /href: '\/shows', label: 'My shows'/);
  assert.match(shell, /href: '\/library', label: 'Explore'/);
  assert.match(shell, /badge: 'New'/);
  assert.match(shell, /href: '\/catalogue', label: 'Catalogue'/);
  assert.match(shell, /href: '\/exports', label: 'Exports'/);
  assert.match(shell, /href: '\/safety', label: 'Safety'/);
  assert.match(shell, /href: '\/admin', label: 'Admin'/);
  assert.match(shell, /href="\/shows\/new"/);
  assert.match(shell, /SidebarRecentShows/);
  assert.match(shell, /SidebarFeaturedTemplate/);
  assert.doesNotMatch(shell, /Shopping lists/);
});

test('supporting app routes and workspace summary API are shipped', () => {
  assert.equal(existsSync(join(root, 'app/(app)/shows/page.tsx')), true);
  assert.equal(existsSync(join(root, 'app/(app)/catalogue/page.tsx')), true);
  assert.equal(existsSync(join(root, 'app/(app)/exports/page.tsx')), true);
  assert.equal(existsSync(join(root, 'app/api/me/summary/route.ts')), true);

  const showsPage = read('app/(app)/shows/page.tsx');
  assert.match(showsPage, /<table/);
  assert.match(showsPage, /Search shows or songs/);
  assert.match(showsPage, /sortShows/);
  assert.match(showsPage, /filterShows/);

  assert.match(read('app/(app)/catalogue/page.tsx'), /listFireworkProducts/);
  assert.match(read('app/(app)/exports/page.tsx'), /No exported files yet/);

  const summaryRoute = read('app/api/me/summary/route.ts');
  assert.match(summaryRoute, /getWorkspaceSummary/);
  assert.match(summaryRoute, /status: 401/);
});
