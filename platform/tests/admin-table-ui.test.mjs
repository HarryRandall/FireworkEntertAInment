/** Static guard for the shadcn-style admin table shell and pagination. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

// Fireworks, multishots, and effects use visual card grids. This list only
// covers routes that retain the dense admin table treatment.
const adminListPages = [
  'app/(admin)/admin/catalogue/page.tsx',
  'app/(admin)/admin/suppliers/page.tsx',
  'app/(admin)/admin/users/page.tsx',
];

const adminPreviewGridPages = [
  {
    page: 'app/(admin)/admin/fireworks/page.tsx',
    loading: 'app/(admin)/admin/fireworks/loading.tsx',
    previewKind: 'firework',
  },
  {
    page: 'app/(admin)/admin/multishots/page.tsx',
    loading: 'app/(admin)/admin/multishots/loading.tsx',
    previewKind: 'multishot',
  },
];

test('shared data table uses the reference table chrome', () => {
  const source = readFileSync(join(root, 'app/components/ui/DataTable.tsx'), 'utf8');
  const stickyViewport = readFileSync(
    join(root, 'app/components/ui/StickyTableViewport.tsx'),
    'utf8',
  );

  assert.match(
    source,
    /border-border bg-background relative overflow-hidden rounded-lg border shadow-xs/,
  );
  assert.match(source, /isolate overflow-x-auto overscroll-x-contain/);
  assert.match(source, /StickyTableViewport/);
  assert.match(
    stickyViewport,
    /md:min-h-0 md:flex-1 md:overflow-x-auto md:overflow-y-auto md:overscroll-none/,
  );
  assert.match(stickyViewport, /header\.scrollLeft = scroll\.scrollLeft/);
  assert.match(stickyViewport, /hideRealHead\(\)/);
  assert.doesNotMatch(source, /md:overflow-auto/);
  assert.doesNotMatch(source, /absolute top-0 right-0 z-30/);
  assert.match(source, /caption-bottom border-separate border-spacing-0 text-left text-sm/);
  assert.match(
    source,
    /bg-background \[&_th\]:sticky \[&_th\]:top-0 \[&_th\]:z-20 \[&_th\]:border-b \[&_th\]:border-border\/50 \[&_th\]:bg-background/,
  );
  assert.match(source, /h-11 px-4 py-3 text-left align-middle text-sm font-medium/);
  assert.match(
    source,
    /transition-colors last:\[&>\*\]:border-b-0 \[&>\*\]:border-b \[&>\*\]:border-border\/50/,
  );
  assert.match(source, /px-4 py-3 align-middle text-sm whitespace-nowrap text-foreground/);
  assert.doesNotMatch(source, /uppercase tracking-wide/);
  assert.doesNotMatch(source, /hover:bg-\[color:var\(--color-bg-muted\)\]/);
});

test('table pagination follows the reference count and ellipsis behaviour', () => {
  const source = readFileSync(join(root, 'app/components/ui/TablePagination.tsx'), 'utf8');

  assert.match(source, /export const TABLE_PAGE_SIZE = 25/);
  assert.match(source, /MoreHorizontal/);
  assert.match(source, /Viewing \$\{\(visibleItems \?\? totalItems\)\.toLocaleString\(\)\} out of/);
  assert.match(source, /if \(currentPage <= 2\) return \[1, 2, 3\]/);
  assert.match(source, /if \(currentPage >= totalPages - 1\)/);
  assert.match(source, /aria-label="Go to previous page"/);
  assert.match(source, /aria-label="Go to next page"/);
  assert.match(source, /currentPage === 1 \? \(\s*<span/);
  assert.match(source, /currentPage === totalPages \? \(\s*<span/);
  assert.doesNotMatch(source, /<Link[\s\S]{0,220}aria-disabled=/);
  assert.match(source, /hidden sm:inline/);
  assert.match(source, /sr-only">More pages/);
  assert.doesNotMatch(source, /rounded-full/);
});

test('admin list pages render pagination inside the table footer with item counts', () => {
  for (const page of adminListPages) {
    const source = readFileSync(join(root, page), 'utf8');

    assert.match(source, /TABLE_PAGE_SIZE/, page);
    assert.match(source, /footer=\{\s*<TablePagination/s, page);
    assert.match(source, /visibleItems=\{paginated\.length\}/, page);
    assert.match(source, /totalItems=\{filtered\.length\}/, page);
    assert.match(source, /itemLabel="/, page);
    assert.doesNotMatch(source, /px-5 py-4/, page);
    assert.doesNotMatch(source, /px-5 py-3/, page);
  }

  const effectsSource = readFileSync(join(root, 'app/(admin)/admin/effects/page.tsx'), 'utf8');
  assert.doesNotMatch(effectsSource, /BASE_EFFECT_PAGE_SIZE/);
});

test('firework admin lists use paginated hover-preview card grids', () => {
  for (const { page, loading, previewKind } of adminPreviewGridPages) {
    const source = readFileSync(join(root, page), 'utf8');
    const loadingSource = readFileSync(join(root, loading), 'utf8');

    assert.match(source, /FireworkBrowsePreviewProvider/, page);
    assert.match(source, /<FireworkBrowseCard/, page);
    assert.match(source, /grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4/, page);
    assert.match(source, new RegExp(`/api/admin/firework-previews/${previewKind}/`), page);
    assert.match(source, /withFireworkPreviewRevision\(/, page);
    assert.match(source, /previewImageRevision/, page);
    assert.match(source, /persistedPosterUrl=\{fireworkPreviewImageUrl\(/, page);
    assert.match(source, /previewImagePath/, page);
    assert.match(source, /\bpersistPoster\b/, page);
    assert.match(source, /posterBackfillTargets/, page);
    assert.match(
      source,
      /<FireworkBrowsePreviewProvider posterBackfillTargets=\{posterBackfillTargets\}>/,
      page,
    );
    assert.match(source, /<TablePagination/, page);
    assert.match(source, /visibleItems=\{paginated\.length\}/, page);
    assert.match(source, /totalItems=\{filtered\.length\}/, page);
    assert.doesNotMatch(source, /<DataTableShell/, page);
    assert.doesNotMatch(source, /preview=\{/, page);
    assert.doesNotMatch(source, /AdminEffectPreview/, page);
    assert.doesNotMatch(source, /style=\{\{\s*backgroundColor/, page);
    assert.match(loadingSource, /FireworkBrowseGridSkeleton/, loading);
  }

  const fireworks = readFileSync(join(root, adminPreviewGridPages[0].page), 'utf8');
  assert.match(fireworks, /firework\.effectName \?\? 'No base effect'/);
  assert.match(fireworks, /formatDuration\(firework\.durationSeconds\)/);
  assert.doesNotMatch(fireworks, /\{firework\.description\s*\?\?/);
  assert.doesNotMatch(fireworks, /firework\.colorPalette\.slice/);

  const multishots = readFileSync(join(root, adminPreviewGridPages[1].page), 'utf8');
  assert.match(multishots, /multishot\.shotCount\.toLocaleString\(\)/);
  assert.match(multishots, /formatDuration\(multishot\.durationSeconds\)/);
  assert.doesNotMatch(multishots, /\{multishot\.description\s*\?\?/);
});

test('effects use preview cards while style defaults retain the admin table', () => {
  const source = readFileSync(join(root, 'app/(admin)/admin/effects/EffectsBrowser.tsx'), 'utf8');
  const loading = readFileSync(join(root, 'app/(admin)/admin/effects/loading.tsx'), 'utf8');

  assert.match(
    source,
    /<FireworkBrowsePreviewProvider posterBackfillTargets=\{posterBackfillTargets\}>/,
  );
  assert.match(source, /<FireworkBrowseCard/);
  assert.match(source, /\/api\/admin\/firework-previews\/effect\//);
  assert.match(source, /withFireworkPreviewRevision\(/);
  assert.match(source, /effect\.previewImageRevision/);
  assert.match(
    source,
    /persistedPosterUrl=\{fireworkPreviewImageUrl\(effect\.previewImagePath\)\}/,
  );
  assert.match(source, /\bpersistPoster\b/);
  assert.match(source, /posterBackfillTargets/);
  assert.match(source, /effectsActive \? \(/);
  assert.match(source, /<DataTableShell/);
  assert.match(source, /filteredDefaults\.map/);
  assert.match(source, /effect\.patternKey/);
  assert.match(source, /effect\.variantCount\.toLocaleString\(\)/);
  assert.doesNotMatch(source, /preview=\{/);
  assert.doesNotMatch(source, /\{effect\.description\s*\?\?/);
  assert.doesNotMatch(source, /formatStableDateTime\(effect\.updatedAt\)/);
  assert.match(loading, /Effects/);
  assert.match(loading, /Style defaults/);
  assert.match(loading, /FireworkBrowseGridSkeleton/);
});

test('admin table loading footer mirrors the compact pagination controls', () => {
  const source = readFileSync(join(root, 'app/components/app/RouteSkeletons.tsx'), 'utf8');
  const start = source.indexOf('function AdminTablePaginationSkeleton()');
  const end = source.indexOf('function getTableSkeletonCellClass', start);
  const paginationSkeleton = source.slice(start, end);

  assert.match(paginationSkeleton, /<Skeleton className="h-4 w-44 max-w-full" \/>/);
  assert.match(paginationSkeleton, /<Skeleton className="h-8 w-8 rounded-lg" \/>/);
  assert.match(paginationSkeleton, /<Skeleton className="h-8 w-16 rounded-lg" \/>/);
  assert.doesNotMatch(paginationSkeleton, /h-9 w-24 rounded-full/);
});
