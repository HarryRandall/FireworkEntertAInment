import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('all cue planners and final safety use the shared 0.5 second ignition interval', () => {
  const spacing = read('lib/cue-generation/launch-spacing.ts');
  const beat = read('lib/cue-generation/beat-sync-planner.ts');
  const fast = read('lib/cue-generation/fast-planner.ts');
  const runner = read('lib/cue-generation/runner.server.ts');

  assert.match(spacing, /GENERATED_LAUNCH_INTERVAL_SECONDS = 0\.5/);
  for (const source of [beat, fast, runner]) {
    assert.match(source, /GENERATED_LAUNCH_INTERVAL_SECONDS/);
  }
});
