/** Source guards for truthful, planning-first Explore language. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('Explore presents published templates as planning starting points', () => {
  const page = read('app/(browse)/library/page.tsx');
  const loading = read('app/(browse)/library/loading.tsx');
  const detail = read('app/(browse)/library/[id]/page.tsx');
  const detailLoading = read('app/(browse)/library/[id]/loading.tsx');

  for (const source of [page, loading]) {
    assert.match(source, /Preview published show templates/);
    assert.doesNotMatch(source, /complete, ready-to-use/i);
  }

  for (const source of [detail, detailLoading]) {
    assert.match(source, /Create from template/);
    assert.doesNotMatch(source, /Use this show/);
  }

  assert.match(page, /length === 1 \? 'template' : 'templates'/);
  assert.match(page, /No templates match this collection yet/);
});
