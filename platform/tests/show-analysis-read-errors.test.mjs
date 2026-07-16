/** Static guards for fail-closed song analysis reads. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const source = readFileSync(join(process.cwd(), 'lib/show-analyses.server.ts'), 'utf8');

test('song analysis database failures do not become absent analysis state', () => {
  assert.match(source, /function failAnalysisRead\(operation: string, error: unknown\): never/);
  assert.match(
    source,
    /throw new Error\('Show analysis could not be loaded\.', \{ cause: error \}\)/,
  );

  for (const operation of [
    'status lookup',
    'show lookup',
    'music analysis lookup',
    'legacy analysis lookup',
  ]) {
    assert.match(source, new RegExp(`failAnalysisRead\\('${operation}',`));
  }

  assert.doesNotMatch(source, /lookup failed:', [^\n]+\);\s*return null/);
});
