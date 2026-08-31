import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  buildLaunchPositionsForWidth,
  DEFAULT_SITE_WIDTH_FEET,
} from '../../lib/cue-generation/show-options.ts';
import {
  DEFAULT_LAUNCH_POSITIONS,
  parseLaunchPositions,
} from '../../lib/fireworks/launch-positions.ts';

const root = process.cwd();

test('site width creates centred and symmetric active launch positions', () => {
  assert.deepEqual(buildLaunchPositionsForWidth(25), [{ x: 0, y: 0, z: 0 }]);
  assert.deepEqual(buildLaunchPositionsForWidth(45), [
    { x: -22.5, y: 0, z: 0 },
    { x: 22.5, y: 0, z: 0 },
  ]);
  assert.deepEqual(buildLaunchPositionsForWidth(80), [
    { x: -40, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 40, y: 0, z: 0 },
  ]);
});

test('launch geometry scales with measured width and uses a stable default', () => {
  assert.equal(DEFAULT_SITE_WIDTH_FEET, 80);
  assert.deepEqual(buildLaunchPositionsForWidth(undefined), buildLaunchPositionsForWidth(80));
  assert.deepEqual(buildLaunchPositionsForWidth(60), [
    { x: -30, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 30, y: 0, z: 0 },
  ]);
  assert.deepEqual(buildLaunchPositionsForWidth(120), [
    { x: -60, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 60, y: 0, z: 0 },
  ]);
});

test('stored active positions keep their one, two or three position topology', () => {
  for (const width of [25, 45, 80]) {
    const layout = buildLaunchPositionsForWidth(width);
    assert.deepEqual(parseLaunchPositions(layout), layout);
  }
  assert.deepEqual(parseLaunchPositions([]), DEFAULT_LAUNCH_POSITIONS);
  assert.deepEqual(parseLaunchPositions(null), DEFAULT_LAUNCH_POSITIONS);
});

test('new show creation persists the derived launch geometry', () => {
  const action = readFileSync(join(root, 'app/(app)/shows/new/actions.ts'), 'utf8');
  assert.match(
    action,
    /launch_positions_json: buildLaunchPositionsForWidth\(parsed\.data\.siteWidthFeet\)/,
  );
});
