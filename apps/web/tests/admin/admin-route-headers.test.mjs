/** Static guard for admin routes that should not render old page header bands. */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join, relative } from 'node:path';

const root = process.cwd();

function tsxFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.isFile() && path.endsWith('.tsx') ? [path] : [];
  });
}

test('admin route pages do not render page header bands', () => {
  const adminFiles = tsxFiles(join(root, 'app/(admin)'));
  const offenders = adminFiles
    .filter((file) => /AppPageHeader|AdminRouteHeaderSkeleton/.test(readFileSync(file, 'utf8')))
    .map((file) => relative(root, file));

  assert.deepEqual(offenders, []);
});

test('shared loading skeletons do not include the old admin route header band', () => {
  const source = readFileSync(join(root, 'components/shell/RouteSkeletons.tsx'), 'utf8');

  assert.doesNotMatch(source, /function AdminRouteHeaderSkeleton/);
  assert.doesNotMatch(source, /<AdminRouteHeaderSkeleton/);
});
