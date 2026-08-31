/** Static guards for keeping cue display names tied to catalogue products. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('show preview cue table displays the catalogue firework name', () => {
  const viewer = read('app/components/app/FireworkReplayViewer.tsx');

  assert.match(viewer, /new Map\(specifications\.map\(\(spec\) => \[spec\.id, spec\.name\]\)\)/);
  assert.match(
    viewer,
    /const fireworkName =\s*productNameById\.get\(cue\.productId\) \?\? cue\.firework\.name;/,
  );
  assert.match(viewer, /<TruncatedCell text=\{fireworkName\} \/>/);
  assert.doesNotMatch(
    viewer,
    /<TruncatedCell text=\{cue\.description \|\| cue\.firework\.name\} \/>/,
  );
});

test('manual and generated cues store catalogue names instead of custom labels', () => {
  const viewer = read('app/components/app/FireworkReplayViewer.tsx');
  const action = read('app/actions/preview-cues.ts');
  const runner = read('lib/cue-generation/runner.server.ts');

  assert.match(viewer, /formData\.set\('description', product\.name\);/);
  assert.match(viewer, /description: bestProduct\.name,/);
  assert.match(action, /\.from\('catalogue_items'\)\s*\.select\('name'\)/);
  assert.match(action, /const cueDescription = productRow\.name\.trim\(\);/);
  assert.match(action, /description: cueDescription,/);
  assert.match(
    runner,
    /const productNameById = new Map\(products\.map\(\(product\) => \[product\.id, product\.name\]\)\);/,
  );
  assert.match(
    runner,
    /description: productNameById\.get\(cue\.productId\) \?\? cue\.description,/,
  );
});
