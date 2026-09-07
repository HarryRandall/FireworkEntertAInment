/** Static guards for shared URL-backed filtering behaviour. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();
const source = readFileSync(join(root, 'components/design-system/FilterBar.tsx'), 'utf8');

test('filter changes reset pagination and preserve the latest URL state', () => {
  assert.match(source, /searchParamsRef = useRef\(searchParams\.toString\(\)\)/);
  assert.match(source, /new URLSearchParams\(searchParamsRef\.current\)/);
  assert.match(source, /params\.delete\('page'\)/);
  assert.match(source, /searchParamsRef\.current = query/);
});

test('filter search cleans up debounce work and exposes pending feedback', () => {
  assert.match(source, /if \(debounceRef\.current\) clearTimeout\(debounceRef\.current\)/);
  assert.match(source, /aria-busy=\{isPending\}/);
  assert.match(source, /Updating results…/);
  assert.match(source, /type="search"/);
  assert.match(source, /name=\{searchKey\}/);
  assert.match(source, /spellCheck=\{false\}/);
});

test('search-only state still exposes Clear all', () => {
  assert.match(source, /\{hasAnyActive \? \(/);
  assert.doesNotMatch(source, /activeFilters\.length \+ \(searchParams\.get/);
});
