/** Static guard for the shadcn-style admin table shell and pagination. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

const adminListPages = [
  'app/(admin)/admin/catalogue/page.tsx',
  'app/(admin)/admin/effects/page.tsx',
  'app/(admin)/admin/fireworks/page.tsx',
  'app/(admin)/admin/suppliers/page.tsx',
  'app/(admin)/admin/users/page.tsx',
];

test('shared data table uses the reference table chrome', () => {
  const source = readFileSync(join(root, 'app/components/ui/DataTable.tsx'), 'utf8');

  assert.match(source, /border-border bg-background overflow-hidden rounded-lg border shadow-xs/);
  assert.match(source, /isolate overflow-x-auto overscroll-x-contain/);
  assert.match(source, /md:overflow-x-auto md:overflow-y-auto md:overscroll-none/);
  assert.doesNotMatch(source, /md:overflow-auto/);
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
