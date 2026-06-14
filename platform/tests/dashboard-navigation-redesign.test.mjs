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
  assert.match(dashboard, /communityPreviewTemplates = summary\.communityTemplates\.slice\(0, 3\)/);
  assert.match(dashboard, /sm:grid-cols-3/);
  assert.match(dashboard, /View all/);
  assert.match(dashboard, /EmptyShowsPanel/);
  assert.doesNotMatch(dashboard, /TablePagination/);
  assert.doesNotMatch(dashboard, /PAGE_SIZE/);
  assert.doesNotMatch(dashboard, /Draft/);

  const summaryCards = read('app/components/app/ShowSummaryCards.tsx');
  assert.match(summaryCards, /min-h-\[10rem\]/);
  assert.match(summaryCards, /top-2 right-2/);
  assert.match(summaryCards, /fill-current text-\[color:var\(--destructive\)\]/);
  assert.doesNotMatch(summaryCards, /values={template\.energySeries}/);
  assert.doesNotMatch(summaryCards, /formatDuration\(template\.lengthSeconds\)/);
  assert.doesNotMatch(summaryCards, /mt-auto space-y-2 pt-5/);
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
  assert.match(shell, /getFeaturedTemplateAccentStyle/);
  assert.match(shell, /var\(--sidebar-primary-foreground\)/);
  assert.match(shell, /text-\[11px\]/);
  assert.match(shell, /w-full rounded-full/);
  assert.doesNotMatch(shell, /orientation="horizontal"/);
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
  assert.match(showsPage, /SHOWS_PAGE_SIZE = 10/);
  assert.match(showsPage, /shouldPaginate = shows\.length > SHOWS_PAGE_SIZE/);
  assert.match(showsPage, /paginatedShows/);
  assert.match(showsPage, /<TablePagination/);
  assert.doesNotMatch(showsPage, /<h1[^>]*>\s*My shows\s*<\/h1>/);
  const showLayout = read('app/(app)/shows/[id]/layout.tsx');
  assert.match(showLayout, /ShowTabs/);
  assert.doesNotMatch(showLayout, /AppPageHeader/);

  const cataloguePage = read('app/(app)/catalogue/page.tsx');
  assert.match(cataloguePage, /listFireworkProducts/);
  assert.doesNotMatch(cataloguePage, /Browse firework products available for show planning/);
  assert.doesNotMatch(cataloguePage, /<h1[^>]*>\s*Catalogue\s*<\/h1>/);

  const exportsPage = read('app/(app)/exports/page.tsx');
  assert.match(exportsPage, /No exported files yet/);
  assert.doesNotMatch(exportsPage, /Export history will appear here once files are generated/);
  assert.doesNotMatch(exportsPage, /<h1[^>]*>\s*Exports\s*<\/h1>/);

  const libraryPage = read('app/(app)/library/page.tsx');
  assert.doesNotMatch(libraryPage, /AppPageHeader/);
  assert.doesNotMatch(libraryPage, /<h1[^>]*>\s*Explore\s*<\/h1>/);
  assert.doesNotMatch(libraryPage, /Browse ready-made pyromusical templates/);
  const libraryDetailPage = read('app/(app)/library/[id]/page.tsx');
  assert.doesNotMatch(libraryDetailPage, /Back to show library/);

  const templatePreview = read('app/components/app/TemplateReplayPreview.tsx');
  assert.match(templatePreview, /absolute right-4 bottom-4 left-4/);
  assert.match(templatePreview, /bg-black\/60/);
  assert.match(templatePreview, /relative h-44 overflow-hidden/);
  assert.doesNotMatch(templatePreview, /relative h-64 overflow-hidden/);
  assert.match(templatePreview, /top-3 right-3/);
  assert.match(templatePreview, /fill-current text-\[color:var\(--destructive\)\]/);
  assert.match(templatePreview, /formatBudget\(template\.totalCents\)/);
  assert.match(templatePreview, /translate-y-full/);
  assert.match(templatePreview, /opacity-0 transition-all/);
  assert.match(templatePreview, /duration-\[1800ms\]/);
  assert.match(templatePreview, /\[transition-timing-function:cubic-bezier\(\.16,1,\.3,1\)\]/);
  assert.match(templatePreview, /duration-500 ease-in-out/);
  assert.match(templatePreview, /h-\[15%\]/);
  assert.match(templatePreview, /linear-gradient\(90deg,var\(--template-accent-start\)/);
  assert.match(templatePreview, /mask-image:linear-gradient\(to_top/);
  assert.doesNotMatch(templatePreview, /border-t p-4/);

  const showTemplatePreview = read('app/components/app/ShowTemplatePreview.tsx');
  assert.match(showTemplatePreview, /buildVisualPalette/);
  assert.match(showTemplatePreview, /--template-accent-start/);
  assert.match(showTemplatePreview, /linear-gradient\(90deg,var\(--template-accent-start\)/);
  assert.match(showTemplatePreview, /relative -mt-px grid flex-1/);
  assert.match(
    showTemplatePreview,
    /h-\[5px\] bg-\[linear-gradient\(90deg,var\(--template-accent-start\)/,
  );
  assert.match(showTemplatePreview, /CardBorderTrace/);
  assert.match(showTemplatePreview, /active=\{isHovered\}/);
  assert.match(showTemplatePreview, /radius=\{10\}/);
  assert.match(
    showTemplatePreview,
    /colors=\{\[palette\.hex\[0\], palette\.hex\[1\], palette\.hex\[2\]\]\}/,
  );
  assert.match(showTemplatePreview, /h-32 overflow-hidden/);
  assert.match(showTemplatePreview, /origin-top -translate-y-6 scale-y-50/);
  assert.match(showTemplatePreview, /blur-lg/);
  assert.match(showTemplatePreview, /duration-\[1800ms\]/);
  assert.match(showTemplatePreview, /group-hover:opacity-40/);
  assert.doesNotMatch(showTemplatePreview, /group-hover:-translate-y-1/);
  assert.doesNotMatch(showTemplatePreview, /group-hover:opacity-0 group-focus-visible:opacity-0/);
  assert.doesNotMatch(showTemplatePreview, /top-0 left-0 z-20 h-\[2px\] w-1\/2/);
  assert.doesNotMatch(showTemplatePreview, /origin-top scale-y-0/);
  assert.doesNotMatch(showTemplatePreview, /pathLength=\{1\}/);
  assert.doesNotMatch(showTemplatePreview, /blur-2xl/);
  assert.doesNotMatch(showTemplatePreview, /group-hover:opacity-20/);
  assert.doesNotMatch(showTemplatePreview, /origin-left -translate-y-10 scale-x-0/);
  assert.doesNotMatch(showTemplatePreview, /origin-right -translate-y-10 scale-x-0/);
  assert.doesNotMatch(showTemplatePreview, /conic-gradient/);
  assert.doesNotMatch(showTemplatePreview, /h-1\.5 w-1\.5 rounded-full/);
  assert.doesNotMatch(showTemplatePreview, /formatBudget\(template\.totalCents\)/);
  assert.doesNotMatch(showTemplatePreview, /bg-\[linear-gradient\(135deg/);

  const globals = read('app/globals.css');
  assert.doesNotMatch(globals, /show-card-border-orbit/);

  const summaryRoute = read('app/api/me/summary/route.ts');
  assert.match(summaryRoute, /getWorkspaceSummary/);
  assert.match(summaryRoute, /status: 401/);
});
