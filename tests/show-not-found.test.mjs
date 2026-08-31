/** Focused guards for the authenticated show not-found recovery state. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('missing shows keep workspace chrome and offer relevant recovery actions', () => {
  const layout = read('app/(app)/shows/[id]/layout.tsx');
  const notFound = read('app/(app)/shows/[id]/not-found.tsx');

  assert.match(layout, /if \(!show\)[\s\S]*?\{children\}/);
  assert.match(notFound, /<h1[^>]*>[\s\S]*?We could not open this show\./);
  assert.match(notFound, /href="\/shows"/);
  assert.match(notFound, /href="\/shows\/new"/);
  assert.doesNotMatch(notFound, /getCurrentUserId|min-h-screen/);
});
