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
  const dashboard = read('app/(app)/home/page.tsx');

  assert.match(dashboard, /getDashboardSummary/);
  assert.match(dashboard, /HomeFeaturedShows/);
  assert.match(dashboard, /HomeCollectionsSection/);
  assert.match(dashboard, /ExplorePreviewProvider/);
  assert.match(dashboard, /ExploreRow title="Explore"/);
  assert.match(dashboard, /getDashboardSummaryWithTemplates/);
  assert.match(dashboard, /featuredShowTemplates = exploreTemplates\.slice\(0, 2\)/);
  // Featured pair is excluded from the explore row to dedupe prefetches.
  assert.match(dashboard, /explorePreviewTemplates = exploreTemplates\.slice\(2, 12\)/);
  assert.match(dashboard, /EmptyShowsPanel/);
  assert.doesNotMatch(dashboard, /Recent shows/);
  assert.doesNotMatch(dashboard, /ShowSummaryRow/);
  assert.doesNotMatch(dashboard, /TemplateSummaryCardView/);
  assert.doesNotMatch(dashboard, /communityPreviewTemplates/);
  assert.doesNotMatch(dashboard, /From the community/);
  assert.doesNotMatch(dashboard, /JumpBackInHero/);
  assert.doesNotMatch(dashboard, /TablePagination/);
  assert.doesNotMatch(dashboard, /PAGE_SIZE/);
  assert.doesNotMatch(dashboard, /Draft/);

  const summaryCards = read('app/components/app/ShowSummaryCards.tsx');
  assert.doesNotMatch(summaryCards, /Jump back in/);
  assert.doesNotMatch(summaryCards, /JumpBackInHero/);
  assert.match(summaryCards, /min-h-\[10rem\]/);
  assert.match(summaryCards, /top-2 right-2/);
  assert.match(summaryCards, /fill-current text-\[color:var\(--destructive\)\]/);
  assert.doesNotMatch(summaryCards, /values={template\.energySeries}/);
  assert.doesNotMatch(summaryCards, /formatDuration\(template\.lengthSeconds\)/);
  assert.doesNotMatch(summaryCards, /mt-auto space-y-2 pt-5/);

  const homeDiscovery = read('app/components/app/HomeDiscoverySections.tsx');
  assert.match(homeDiscovery, /Watch real shows/);
  assert.match(homeDiscovery, /Curated collections/);
  assert.match(homeDiscovery, /FeaturedShowCard/);
  assert.match(homeDiscovery, /COLLECTIONS/);
  assert.match(homeDiscovery, /Finale moments/);
  assert.match(homeDiscovery, /Crowd favourites/);
  assert.match(homeDiscovery, /Watch replay/);
  assert.match(homeDiscovery, /CoverPoster/);
  assert.match(homeDiscovery, /shaderCoverFromSeed/);
  assert.match(homeDiscovery, /shaderCoverGradient/);
  assert.match(homeDiscovery, /absolute top-4 left-4/);
  assert.match(homeDiscovery, /h-6 items-center rounded-full/);
  assert.match(homeDiscovery, /bg-white\/14/);
  assert.match(homeDiscovery, /text-\[11px\]/);
});

test('app shell exposes only shipped V1 navigation routes', () => {
  const shell = read('app/components/app/AppShell.tsx');

  assert.match(shell, /href: '\/home', label: 'Home'/);
  assert.match(shell, /href: '\/shows', label: 'My shows'/);
  assert.match(shell, /href: '\/library', label: 'Explore'/);
  assert.match(shell, /badge: 'New'/);
  assert.match(shell, /href: '\/catalogue', label: 'Catalogue'/);
  assert.match(shell, /href: '\/exports', label: 'Exports'/);
  assert.match(shell, /href: '\/safety', label: 'Safety'/);
  assert.match(shell, /href: '\/admin', label: 'Admin'/);
  assert.match(shell, /href="\/shows\/new"/);
  assert.match(shell, /SidebarRecentShows/);
  assert.doesNotMatch(shell, /SidebarFeaturedTemplate/);
  assert.doesNotMatch(shell, /getFeaturedTemplateAccentStyle/);
  assert.doesNotMatch(shell, /Show of the week/);
  assert.match(shell, /text-\[11px\]/);
  assert.doesNotMatch(shell, /orientation="horizontal"/);
  assert.doesNotMatch(shell, /Shopping lists/);
});

test('supporting app routes and workspace summary API are shipped', () => {
  assert.equal(existsSync(join(root, 'app/(app)/shows/page.tsx')), true);
  assert.equal(existsSync(join(root, 'app/(app)/catalogue/page.tsx')), true);
  assert.equal(existsSync(join(root, 'app/(app)/exports/page.tsx')), true);
  assert.equal(existsSync(join(root, 'app/api/me/summary/route.ts')), true);

  const showsPage = read('app/(app)/shows/page.tsx');
  assert.match(showsPage, /ShowReplayCoverCard/);
  // Cues load lazily on hover (via the card's server action), not pre-fetched in
  // the page, so the grid can stream in without waiting on per-show cues.
  assert.doesNotMatch(showsPage, /listReplayCuesForShows/);
  assert.match(showsPage, /grid grid-cols-2/);
  assert.match(showsPage, /ShowsToolbar/);
  assert.match(showsPage, /sortShows/);
  assert.match(showsPage, /filterShows/);
  assert.match(showsPage, /SHOWS_PAGE_SIZE = 24/);
  assert.match(showsPage, /shouldPaginate = shows\.length > SHOWS_PAGE_SIZE/);
  assert.match(showsPage, /paginatedShows/);
  assert.match(showsPage, /<TablePagination/);
  assert.doesNotMatch(showsPage, /All shows/);
  assert.doesNotMatch(showsPage, /Search results/);
  assert.doesNotMatch(showsPage, /<select/);
  assert.doesNotMatch(showsPage, /<table/);
  assert.doesNotMatch(showsPage, /<h1[^>]*>\s*My shows\s*<\/h1>/);

  const showReplayCard = read('app/(app)/shows/ShowReplayCoverCard.tsx');
  assert.match(showReplayCard, /CoverPoster/);
  assert.match(showReplayCard, /show\.coverShader \?\? shaderCoverFromSeed/);
  assert.match(showReplayCard, /onPointerEnter/);
  assert.match(showReplayCard, /imagePath=\{show\.coverImagePath\}/);
  assert.match(showReplayCard, /ReplayCanvasSkeleton/);
  assert.match(showReplayCard, /loadingBarPosition="center"/);
  assert.match(showReplayCard, /loadingBarVariant="compact"/);
  assert.doesNotMatch(showReplayCard, /rgba\(0,0,0,0\.48\)_100%/);

  const showReplayProvider = read('app/(app)/shows/ShowReplayPreviewContext.tsx');
  assert.match(showReplayProvider, /FireworkReplayCanvas/);
  assert.match(showReplayProvider, /getShowReplayPreviewCues/);
  assert.match(showReplayProvider, /SHOW_CARD_PREVIEW_WINDOW_SECONDS/);
  assert.match(showReplayProvider, /const previewStart = 0/);
  assert.match(showReplayProvider, /showLoadingBar=\{false\}/);
  assert.match(showReplayProvider, /formatEditedAt\(mountedPreview\.show\.lastEditedAt\)/);
  assert.match(showReplayProvider, /<Play size=\{16\} fill="currentColor" \/>/);

  const showReplayAction = read('app/actions/show-replay-cues.ts');
  assert.match(showReplayAction, /listReplayPreviewCuesForShow/);
  assert.match(showReplayAction, /SHOW_CARD_PREVIEW_WINDOW_SECONDS/);

  const showsQueries = read('lib/shows/queries.server.ts');
  assert.match(showsQueries, /listReplayPreviewCuesForShow/);
  assert.match(showsQueries, /const previewEnd = previewWindowSeconds/);
  assert.match(showsQueries, /\.lte\('time_seconds', previewEnd\)/);
  assert.match(showsQueries, /cue\.timeSeconds <= previewEnd \+ 0\.001/);
  assert.doesNotMatch(showsQueries, /firstData/);

  const showsToolbar = read('app/(app)/shows/ShowsToolbar.tsx');
  assert.match(showsToolbar, /Search shows or songs/);
  assert.match(showsToolbar, /PopoverTrigger/);
  assert.match(showsToolbar, /CommandItem/);
  assert.match(showsToolbar, /open=\{sortOpen\}/);
  assert.match(showsToolbar, /setSortOpen\(false\)/);
  // The "New show" button and the "N shows" count were removed; search is now
  // instant (debounced URL updates) with no separate Search button.
  assert.doesNotMatch(showsToolbar, /New show/);
  assert.doesNotMatch(showsToolbar, /resultLabel/);
  assert.match(showsToolbar, /SEARCH_DEBOUNCE_MS/);
  assert.doesNotMatch(showsToolbar, /type="submit"/);
  assert.doesNotMatch(showsToolbar, /All shows/);
  assert.doesNotMatch(showsToolbar, /Search results/);
  assert.doesNotMatch(showsToolbar, /<select/);

  const safetyPage = read('app/(app)/safety/page.tsx');
  assert.doesNotMatch(safetyPage, /Operational safety/);
  assert.doesNotMatch(safetyPage, /Safety checks before firing/);

  const showLayout = read('app/(app)/shows/[id]/layout.tsx');
  assert.match(showLayout, /ShowTabs/);
  assert.doesNotMatch(showLayout, /AppPageHeader/);

  const cataloguePage = read('app/(app)/catalogue/page.tsx');
  assert.match(cataloguePage, /listFireworkProducts/);
  assert.doesNotMatch(cataloguePage, /Browse firework products available for show planning/);
  assert.doesNotMatch(cataloguePage, /Firework products/);
  assert.doesNotMatch(cataloguePage, /Search by product name/);
  assert.doesNotMatch(cataloguePage, /<h1[^>]*>\s*Catalogue\s*<\/h1>/);

  const exportsPage = read('app/(app)/exports/page.tsx');
  assert.match(exportsPage, /No exported files yet/);
  assert.doesNotMatch(exportsPage, /Export history will appear here once files are generated/);
  assert.doesNotMatch(exportsPage, /<h1[^>]*>\s*Exports\s*<\/h1>/);

  const libraryPage = read('app/(app)/library/page.tsx');
  assert.doesNotMatch(libraryPage, /AppPageHeader/);
  assert.doesNotMatch(libraryPage, /<h1[^>]*>\s*Explore\s*<\/h1>/);
  assert.doesNotMatch(libraryPage, /Hover any cover to preview the show/);
  assert.match(libraryPage, /<ExploreShelves sort=\{sort\} \/>/);
  assert.match(libraryPage, /SHOWS_PER_SHELF = 30/);
  assert.match(libraryPage, /const usedTemplateIds = new Set<string>\(\)/);
  assert.match(libraryPage, /templateMatchesShelf/);
  assert.match(libraryPage, /moodTags\.includes\(shelfLabel\)/);
  assert.match(libraryPage, /preferredTemplates/);
  assert.match(libraryPage, /fallbackTemplates/);
  assert.match(libraryPage, /takeUniqueShelfTemplates/);
  assert.match(libraryPage, /usedTemplateIds\.has\(template\.id\)/);
  assert.match(libraryPage, /activeShelf\.templates\.length\.toLocaleString\(\)/);
  assert.match(libraryPage, /activeShelf\.templates\.map/);
  assert.match(libraryPage, /href="\/library"/);
  assert.match(libraryPage, /Back to shelves/);
  assert.doesNotMatch(libraryPage, /Browse ready-made pyromusical templates/);
  const libraryDetailPage = read('app/(app)/library/[id]/page.tsx');
  assert.doesNotMatch(libraryDetailPage, /Back to show library/);

  const templatePreview = read('app/components/app/TemplateReplayPreview.tsx');
  assert.match(templatePreview, /absolute inset-x-0 bottom-0/);
  assert.match(templatePreview, /bg-black\/45/);
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

test('explore seed data supports thirty unique templates per library shelf', () => {
  const seedPath = 'supabase/migrations/20260629171000_seed_library_explore_shelves.sql';
  assert.equal(existsSync(join(root, seedPath)), true);

  const seed = read(seedPath);
  const seedTemplates = read('lib/library-seed-templates.ts');
  const templateReads = read('lib/admin/templates.server.ts');

  for (const section of ['featured', 'popular', 'hot', 'recent', 'shortest']) {
    assert.match(seed, new RegExp(`'${section}'`));
    assert.match(seedTemplates, new RegExp(`key: '${section}'`));
  }
  assert.match(seed, /CROSS JOIN generate_series\(1, 30\) AS item\(item_order\)/);
  assert.match(seed, /sort_base \+ item_order/);
  assert.match(seed, /jsonb_build_object\('kind', cover_kind, 'colors', to_jsonb\(colors\)\)/);
  assert.match(seed, /ON CONFLICT \(slug\) DO UPDATE SET/);
  assert.match(seedTemplates, /SEEDED_LIBRARY_TEMPLATES/);
  assert.match(seedTemplates, /Array\.from\(\{ length: 30 \}/);
  assert.match(seedTemplates, /mergeSeededLibraryTemplates/);
  assert.match(seedTemplates, /existingSlugs/);
  assert.match(templateReads, /mergeSeededLibraryTemplates\(cached\)/);
  assert.match(templateReads, /mergeSeededLibraryTemplates\(\[\]\)/);
  assert.match(templateReads, /const mapped = mergeSeededLibraryTemplates\(/);
  assert.match(templateReads, /map\(mapShowTemplate\)/);
});

test('shader-heavy app routes use neutral loading skeletons', () => {
  const showsLoading = read('app/(app)/shows/loading.tsx');
  assert.doesNotMatch(showsLoading, /All shows/);
  assert.match(showsLoading, /aspect-\[4\/5\]/);
  assert.doesNotMatch(showsLoading, /ShaderCover|shaderCoverGradient|shaderCoverFromSeed/);

  const libraryLoading = read('app/(app)/library/loading.tsx');
  assert.doesNotMatch(libraryLoading, /Explore/);
  assert.doesNotMatch(libraryLoading, /Hover any cover to preview the show/);
  assert.match(libraryLoading, /LibraryCardsSkeleton/);
  assert.doesNotMatch(libraryLoading, /ShaderCover|shaderCoverGradient|shaderCoverFromSeed/);

  const routeSkeletons = read('app/components/app/RouteSkeletons.tsx');
  const start = routeSkeletons.indexOf('export function LibraryCardsSkeleton()');
  const end = routeSkeletons.indexOf('/** Skeleton for the `/admin`', start);
  const librarySkeleton = routeSkeletons.slice(start, end);

  assert.match(librarySkeleton, /EXPLORE_SKELETON_SHELVES/);
  assert.match(librarySkeleton, /aspect-\[4\/5\]/);
  assert.doesNotMatch(librarySkeleton, /ShaderCover|shaderCoverGradient|shaderCoverFromSeed/);
});
