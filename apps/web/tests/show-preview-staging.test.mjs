/** Show staging keeps cake hardware independent of authored tube offsets. */
import test from 'node:test';
import assert from 'node:assert/strict';
await import('../../../scripts/renderer/register-typescript.mjs');
const { buildShowRendererShots, SHOW_OUTER_LEAN_DEGREES } =
  await import('../lib/shows/renderer-shots.ts');
const { effectTemplates } = await import('@showcrafter/renderer');

const design = effectTemplates.find((entry) => entry.key === 'peony').design;
const positions = [
  { x: -1219.2, y: 0, z: 0 },
  { x: 0, y: 0, z: 0 },
  { x: 1219.2, y: 0, z: 0 },
];
const cue = (id, overrides = {}) => ({
  id,
  timeSeconds: 0,
  launchPositionIndex: 1,
  firework: { name: 'Test shell', design },
  ...overrides,
});
function shots(cues, staging = true) {
  const result = buildShowRendererShots(cues, positions, staging);
  assert.equal(result.ok, true);
  return result.shots;
}
test('cakes persist at distinct slots near their assigned rack, with local tube offsets', () => {
  const result = shots([
    cue('a', {
      cakeId: 'cake-a',
      cakeLaunchPositionIndex: 0,
      shotPositionOverride: { x: 20, y: 0, z: -30 },
    }),
    cue('b', { cakeId: 'cake-a', cakeLaunchPositionIndex: 0 }),
    cue('c', { cakeId: 'cake-b', cakeLaunchPositionIndex: 0 }),
  ]);
  assert.equal(result[0].hardware, 'cake');
  assert.deepEqual(result[0].hardwarePosition, result[1].hardwarePosition);
  assert.notDeepEqual(result[0].hardwarePosition, result[2].hardwarePosition);
  assert.equal(result[0].hardwarePosition[0], -12.192);
  assert.equal(result[0].position[0], result[0].hardwarePosition[0] + 0.2);
  assert.equal(result[0].position[1], result[0].hardwarePosition[1] - 0.3);
  assert.equal(result[0].muzzle_m, 1.17);
  // The second cake sits beside the first in the same row rather than further forward.
  assert.equal(result[2].hardwarePosition[1], result[0].hardwarePosition[1]);
  assert.ok(Math.abs(result[2].hardwarePosition[0] - result[0].hardwarePosition[0]) >= 2.8);
});
test('default aerial lean follows outer racks, preserving explicit zero and authored design angles', () => {
  const result = shots([
    cue('left', { launchPositionIndex: 0 }),
    cue('centre'),
    cue('right', { launchPositionIndex: 2 }),
    cue('authored', { launchPositionIndex: 0, shotPanDegrees: 0 }),
    cue('cake', { cakeId: 'cake', launchPositionIndex: 0, shotPanDegrees: 12 }),
  ]);
  assert.deepEqual(
    result.map((shot) => shot.design.launch.tilt_deg),
    [-SHOW_OUTER_LEAN_DEGREES, 0, SHOW_OUTER_LEAN_DEGREES, 0, 12],
  );
  assert.equal(
    shots([cue('editor', { launchPositionIndex: 0 })], false)[0].design.launch.tilt_deg,
    0,
  );
  assert.equal(design.launch.tilt_deg, 0);
});
test('old cached cues do not infer cakes from ids and still convert centimetres once', () => {
  const [shot] = shots([cue('old-shot-0', { launchPositionIndex: 2 })]);
  assert.equal(shot.hardware, 'mortar');
  assert.deepEqual(shot.position, [12.192, 0]);
});

test('stored design angles and explicit forward lean suppress default rack fanning', () => {
  const authored = structuredClone(design);
  authored.launch.tilt_deg = 5;
  const result = shots([
    cue('authored-design', {
      launchPositionIndex: 0,
      firework: { name: 'Angled shell', design: authored },
    }),
    cue('forward-zero', { launchPositionIndex: 2, shotTiltDegrees: 0 }),
    cue('rocket', {
      launchPositionIndex: 2,
      firework: { name: 'Rocket', design: { ...design, kind: 'rocket' } },
    }),
  ]);
  assert.deepEqual(
    result.map((shot) => shot.design.launch.tilt_deg),
    [5, 0, SHOW_OUTER_LEAN_DEGREES],
  );
  assert.equal(authored.launch.tilt_deg, 5);
});
