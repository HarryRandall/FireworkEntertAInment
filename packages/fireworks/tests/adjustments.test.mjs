/** Integration checks for pure stored-design adjustment resolution. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADJUSTMENT_REGISTRY, designSchema, resolveDesign, simulate } from '../src/index.ts';
import { reviewFixtureDesign } from '../src/fixtures/index.ts';

const fixture = reviewFixtureDesign;
const shell = fixture('peony');

test('quick adjustment levels are stored, bounded and reject unknown keys', () => {
  const valid = { ...shell, adjustments: { 'launch.height': 3, 'layer.l1.trail.glitter': -3 } };
  assert.equal(designSchema.safeParse(valid).success, true);
  for (const level of [-4, 4, 1.5])
    assert.equal(
      designSchema.safeParse({ ...shell, adjustments: { 'launch.height': level } }).success,
      false,
    );
  assert.equal(
    designSchema.safeParse({ ...shell, adjustments: { 'launch.unicorn': 1 } }).success,
    false,
  );
});

test('launch and break adjustments retain the prototype scaling and clamps', () => {
  const resolved = resolveDesign({
    ...shell,
    adjustments: {
      'launch.height': 1,
      'launch.tail': 1,
      'launch.climb': 1,
      'break.flash': 1,
      'break.core_ring': 1,
    },
  });
  assert.equal(resolved.launch.height_m, shell.launch.height_m * 1.12);
  assert.equal(resolved.launch.time_s, shell.launch.time_s * Math.sqrt(1.12) * 0.85);
  assert.equal(resolved.launch.sparks, Math.round(shell.launch.sparks * 1.35));
  assert.equal(resolved.launch.spread, shell.launch.spread * 1.15);
  assert.equal(resolved.breaks[0].core.flash, shell.breaks[0].core.flash * 1.3);
  assert.equal(resolved.breaks[0].core.radius, shell.breaks[0].core.radius * 1.15);

  const clamped = resolveDesign({
    ...shell,
    launch: { ...shell.launch, height_m: 1000, time_s: 120, sparks: 10000, spread: 20 },
    adjustments: { 'launch.height': 3, 'launch.tail': 3 },
  });
  assert.deepEqual(clamped.launch, {
    ...shell.launch,
    height_m: 1000,
    time_s: 120,
    sparks: 10000,
    spread: 20,
  });
});

test('every layer adjustment resolves the documented target without mutating the authored design', () => {
  const fields = Object.keys(ADJUSTMENT_REGISTRY).filter((key) => key.startsWith('layer.{id}.'));
  for (const template of fields) {
    const source = template.includes('modifier') ? fixture('multi-break') : shell;
    const layer = template.includes('modifier')
      ? source.breaks
          .flatMap((break_) => break_.layers)
          .find((candidate) => candidate.modifiers.length)
      : source.breaks[0].layers[0];
    const key = template.replace('{id}', layer.id);
    const before = structuredClone(source);
    const resolved = resolveDesign({ ...source, adjustments: { [key]: 1 } });
    assert.deepEqual(source, before, `${key} mutated the authored design`);
    const resolvedLayer = resolved.breaks
      .flatMap((break_) => break_.layers)
      .find((candidate) => candidate.id === layer.id);
    assert.notDeepEqual(resolvedLayer, layer, key);
  }
});

test('ground adjustments apply to each compatible stored kind', () => {
  const comet = fixture('comet');
  const cometResolved = resolveDesign({
    ...comet,
    adjustments: {
      'ground.height': 1,
      'ground.count': 1,
      'ground.fan': 1,
      'ground.climb': 1,
      'ground.star_size': 1,
      'ground.spin': 1,
    },
  });
  assert.ok(cometResolved.ground.comets.height_m > comet.ground.comets.height_m);
  assert.ok(cometResolved.ground.comets.count > comet.ground.comets.count);
  assert.ok(cometResolved.ground.comets.spread_deg > comet.ground.comets.spread_deg);
  assert.ok(cometResolved.ground.comets.size > comet.ground.comets.size);
  assert.equal(cometResolved.ground.comets.spin_rad_s, comet.ground.comets.spin_rad_s + 4);

  const fountain = {
    kind: 'fountain',
    launch: null,
    breaks: [],
    sound: comet.sound,
    seed: comet.seed,
    ground: {
      kind: 'fountain',
      fountain: {
        duration_s: 7,
        rate_per_s: 100,
        speed_m_s: 20,
        cone: 1,
        colour: '#ffffff',
        life_s: 1,
        emitters: 1,
        spacing_m: 1,
        height_m: 0,
        direction: [0, 1, 0],
        streak: 0,
        gravity_m_s2: 1,
        drag_per_s: 1,
        size: 1,
        flicker: 0,
        glitter: 0,
        fork: 0,
        glow: 1,
        glow_alpha: 1,
      },
    },
    adjustments: {
      'ground.height': 1,
      'ground.duration': 1,
      'ground.density': 1,
      'ground.spray': 1,
    },
  };
  const resolved = resolveDesign(designSchema.parse(fountain));
  assert.deepEqual(
    [
      resolved.ground.fountain.speed_m_s,
      resolved.ground.fountain.duration_s,
      resolved.ground.fountain.rate_per_s,
      resolved.ground.fountain.cone,
    ],
    [22, 8.4, 125, 1.25],
  );
});

test('an empty adjustment map is a simulation no-op and stored adjustments are resolved by the simulation', () => {
  assert.deepEqual(resolveDesign({ ...shell, adjustments: {} }), { ...shell, adjustments: {} });
  const adjusted = { ...shell, adjustments: { 'launch.height': 1 } };
  assert.deepEqual(simulate(adjusted, 1), simulate(resolveDesign(adjusted), 1));
});
