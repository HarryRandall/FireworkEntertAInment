/** Show staging keeps cake hardware independent of authored tube offsets. */
import test from 'node:test';
import assert from 'node:assert/strict';
await import('../../../scripts/renderer/register-typescript.mjs');
const { buildShowRendererShots, MIN_LAUNCH_POSITION_GAP_M, SHOW_OUTER_LEAN_DEGREES } =
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
function shots(cues, staging = true, layout = positions) {
  const result = buildShowRendererShots(cues, layout, staging);
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
  // An 80 ft site is narrower than the minimum drawn gap, so its racks spread to it.
  assert.equal(result[0].hardwarePosition[0], -MIN_LAUNCH_POSITION_GAP_M);
  assert.equal(result[0].position[0], result[0].hardwarePosition[0] + 0.2);
  assert.equal(result[0].position[1], result[0].hardwarePosition[1] - 0.3);
  assert.equal(result[0].muzzle_m, 1.17);
  // The second cake sits beside the first in the same row rather than further forward.
  assert.equal(result[2].hardwarePosition[1], result[0].hardwarePosition[1]);
  assert.ok(Math.abs(result[2].hardwarePosition[0] - result[0].hardwarePosition[0]) >= 6);
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
  // A single firing position is drawn where it was saved, so previews stay centred.
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

test('close launch positions spread to the minimum gap around their centre, wide layouts stay measured', () => {
  const xs = (layout) =>
    shots(
      layout.map((_, index) =>
        cue(`p${index}`, { launchPositionIndex: index, shotTiltDegrees: 0 }),
      ),
      true,
      layout,
    ).map((shot) => shot.position[0]);
  const gap = MIN_LAUNCH_POSITION_GAP_M;
  // The old ±2 m default and an off-centre pair both spread evenly, keeping their centre.
  assert.deepEqual(
    xs([
      { x: -200, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 200, y: 0, z: 0 },
    ]),
    [-gap, 0, gap],
  );
  assert.deepEqual(
    xs([
      { x: 1000, y: 0, z: 0 },
      { x: 1200, y: 0, z: 0 },
    ]),
    [11 - gap / 2, 11 + gap / 2],
  );
  // Index order is kept even when saved positions are not sorted by x.
  assert.deepEqual(
    xs([
      { x: 200, y: 0, z: 0 },
      { x: -200, y: 0, z: 0 },
    ]),
    [gap / 2, -gap / 2],
  );
  assert.deepEqual(
    xs([
      { x: -3000, y: 0, z: 0 },
      { x: 3000, y: 0, z: 0 },
    ]),
    [-30, 30],
  );
});

test('each rack keeps its cakes in its own lane instead of sharing one row', () => {
  const tight = [
    { x: -200, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 200, y: 0, z: 0 },
  ];
  // Cakes alternate between racks, so every rack stays equally full and keeps its own cakes.
  const cakes = Array.from({ length: 6 }, (_, i) =>
    [0, 1, 2].map((rack) =>
      cue(`r${rack}-c${i}`, { cakeId: `r${rack}-c${i}`, cakeLaunchPositionIndex: rack }),
    ),
  ).flat();
  const result = shots(cakes, true, tight);
  const halfLane = MIN_LAUNCH_POSITION_GAP_M / 2;
  for (const [index, shot] of result.entries()) {
    const rackX = ((index % 3) - 1) * MIN_LAUNCH_POSITION_GAP_M;
    assert.ok(
      Math.abs(shot.hardwarePosition[0] - rackX) + 1.1 <= halfLane,
      `cake ${index} stays inside its rack's lane`,
    );
    assert.ok(shot.hardwarePosition[1] >= 6, 'cakes sit in front of their rack');
  }
  // Five cakes fit across a lane, so each rack's sixth steps forward a row.
  assert.equal(result[12].hardwarePosition[1], result[0].hardwarePosition[1]);
  assert.ok(result[15].hardwarePosition[1] > result[0].hardwarePosition[1]);
});

test('authored shot offsets stay close to their own position', () => {
  const [mortar, far] = shots([
    cue('offset', { launchPositionIndex: 2, shotPositionOverride: { x: 50, y: 0, z: -40 } }),
    cue('far', { launchPositionIndex: 2, shotPositionOverride: { x: 5000, y: 0, z: 0 } }),
    cue('anchor', { launchPositionIndex: 0 }),
  ]);
  // Offsets are relative to the launch position rather than the scene origin.
  assert.deepEqual(mortar.position, [MIN_LAUNCH_POSITION_GAP_M + 0.5, -0.4]);
  assert.deepEqual(far.position, [MIN_LAUNCH_POSITION_GAP_M + 1.1, 0]);
  const [cakeShot] = shots([
    cue('cake-far', {
      cakeId: 'cake',
      cakeLaunchPositionIndex: 0,
      shotPositionOverride: { x: -5000, y: 0, z: 0 },
    }),
  ]);
  assert.equal(cakeShot.position[0], cakeShot.hardwarePosition[0] - 1.1);
});

test('cakes cued on one position spill into neighbouring lanes instead of bunching', () => {
  const cakes = Array.from({ length: 4 }, (_, i) =>
    cue(`c${i}`, { cakeId: `c${i}`, cakeLaunchPositionIndex: 1 }),
  );
  const result = shots(cakes);
  const lanes = result.map((shot) =>
    Math.round(shot.hardwarePosition[0] / MIN_LAUNCH_POSITION_GAP_M),
  );
  assert.deepEqual(lanes, [0, -1, 1, 0]);
  // A lone cake preview is not spread or moved.
  const [single] = shots([cue('only', { cakeId: 'only', cakeLaunchPositionIndex: 1 })]);
  assert.equal(single.hardwarePosition[0], 0);
});
