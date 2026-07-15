/** Guards for shared-shell bundle boundaries and independent route reads. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('the shared app shell keeps the interactive home tree out of every route bundle', () => {
  const shell = read('app/components/app/AppShell.tsx');
  const homeLoading = read('app/(app)/home/loading.tsx');

  assert.doesNotMatch(shell, /HomeLoadingSkeleton|HomePageSkeleton/);
  assert.match(shell, /function PendingHomeSkeleton\(\)/);
  assert.match(shell, /Create any firework show you can imagine/);
  assert.match(shell, /aria-label="Loading home"/);
  assert.match(homeLoading, /HomePageSkeleton/);
});

test('admin Explore data starts inside Suspense and loads independent sources together', () => {
  const page = read('app/(admin)/admin/show-presets/page.tsx');

  assert.match(page, /export default function AdminShowPresetsPage/);
  assert.match(page, /<Suspense/);
  assert.match(page, /<ShowPresetsData searchParams=\{searchParams\} \/>/);
  assert.match(
    page,
    /const \[params, presets, importableShows\] = await Promise\.all\(\[[\s\S]*?searchParams,[\s\S]*?listAdminShowPresets\(\),[\s\S]*?listAdminShowPresetImportShows\(\),[\s\S]*?\]\)/,
  );
  assert.doesNotMatch(
    page,
    /export default async function AdminShowPresetsPage[\s\S]*?await listAdminShowPresetImportShows/,
  );
});

test('signed-in browse chrome does not serialise auth before profile reads', () => {
  const layout = read('app/(browse)/layout.tsx');

  assert.match(
    layout,
    /const \[userId, profile, impersonation, cookieStore\] = await Promise\.all\(\[[\s\S]*?getCurrentUserId\(\),[\s\S]*?getCurrentProfile\(\),[\s\S]*?getActiveImpersonation\(\),[\s\S]*?cookies\(\),[\s\S]*?\]\)/,
  );
  assert.doesNotMatch(layout, /const userId = await getCurrentUserId\(\)/);
  assert.match(layout, /if \(!userId\)/);
});
