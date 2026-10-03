/** Golden and behavioural tests for the DOM-free core shell simulation. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  simulate as simulateAll,
  shotDuration,
  ParticleKind,
  launchPos,
  starPos,
  directions,
  hash,
  rgb,
  colourAt,
  brightnessAt,
  upgradeDesign,
} from '../src/index.ts';
import { fillCore } from '../src/sim/core.ts';
import { ParticleWriter } from '../src/sim/particles.ts';
import { fadeAlpha } from '../src/sim/fade.ts';

const fixture = (name) =>
  upgradeDesign(JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url))), 1);
const simulate = (d, t, options = {}) =>
  simulateAll(d, t, { ...options, sprays: false, smoke: false, launchEffects: false });
const golden = JSON.parse(readFileSync(new URL('./fixtures/core-goldens.json', import.meta.url)));
const close = (actual, expected, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
function row(p, i) {
  return [
    p.kinds[i],
    ...p.positions.slice(i * 3, i * 3 + 3),
    ...p.colours.slice(i * 3, i * 3 + 3),
    p.sizes[i],
    p.alphas[i],
  ];
}

for (const name of ['peony', 'multi-break']) {
  test(`${name}: core positions, colours, sizes, alphas and kinds match the prototype`, () => {
    const d = fixture(name);
    close(shotDuration(d), golden.fixtures[name].duration_s);
    d.breaks.forEach((b) =>
      b.layers.forEach((l) => {
        l.modifiers = [];
      }),
    );
    for (const frame of golden.fixtures[name].frames) {
      const p = simulate(d, frame.time_s);
      assert.equal(p.kinds.length, frame.count);
      for (const sample of frame.samples)
        row(p, sample.index).forEach((v, i) => close(v, sample.values[i]));
    }
  });
  test(`${name}: direct evaluation equals scrubbing and never mutates the design`, () => {
    const d = fixture(name),
      before = structuredClone(d);
    const direct = simulate(d, 3);
    simulate(d, 0.5);
    simulate(d, 1.7);
    assert.deepEqual(simulate(d, 3), direct);
    assert.deepEqual(simulate(d, 3), direct);
    assert.deepEqual(d, before);
    const other = simulate(d, 3, { seed: 33 });
    assert.notDeepEqual(other.positions, direct.positions);
    direct.positions.fill(0);
    assert.notDeepEqual(simulate(d, 3).positions, direct.positions);
  });
}
test('comet duration and heads match reference', () => {
  const d = fixture('comet');
  close(shotDuration(d), golden.fixtures.comet.duration_s);
  for (const frame of golden.fixtures.comet.frames) {
    const p = simulate(d, frame.time_s);
    assert.equal(p.kinds.length, frame.count);
    for (const sample of frame.samples)
      row(p, sample.index).forEach((v, i) => close(v, sample.values[i]));
  }
});
test('murmur3 and linear RGB match independently captured reference values', () => {
  for (const h of golden.helpers.hashes) assert.equal(hash(...h.args), h.value);
  for (const c of golden.helpers.colours) rgb(c.hex).forEach((v, i) => close(v, c.value[i], 1e-14));
});
test('star height follows closed-form drag/gravity at several ages', () => {
  const l = fixture('peony').breaks[0].layers[0];
  const q = directions(l.count, l.pattern, 11 * 13)[12];
  for (const age of [0, 0.07, 0.5, 1.7, 3]) {
    const k = l.drag_per_s,
      e = 1 - Math.exp(-k * age);
    const expected =
      56 +
      q.y * l.radius_m * (1 - l.speed_var + l.speed_var * q.h) * e -
      (l.gravity_m_s2 / k) * (age - e / k);
    close(starPos(l, q, age, [0, 56, 0])[1], expected, 1e-12);
  }
});
test('launch starts at muzzle and reaches designed apex at the launch time', () => {
  const d = fixture('peony'),
    launch = { ...d.launch, tilt_deg: 12 };
  const options = { position: [10, -5], muzzle_m: 3 };
  close(launchPos(launch, 11, 0, options)[1], 3);
  close(launchPos(launch, 11, launch.time_s, options)[1], launch.height_m);
  close(launchPos(launch, 11, launch.time_s / 2, options)[1], 3 + (launch.height_m - 3) * 0.75);
  const atApex = simulate({ ...d, launch }, launch.time_s, options);
  // Stars are still below their visibility threshold at age zero; core sparks mark the break.
  close(atApex.positions[0], 10 + Math.tan((12 * Math.PI) / 180) * launch.height_m, 1e-5);
  close(atApex.positions[1], launch.height_m);
  close(atApex.positions[2], -5);
  assert.ok([...simulate(d, launch.time_s - 0.001).kinds].every((k) => k !== ParticleKind.Spark));
});
test('break/layer delay, offsets and hidden layers retain their global random index', () => {
  const d = fixture('multi-break');
  d.breaks[0].layers[0].hidden = true;
  const l = d.breaks[1].layers[0];
  l.delay_s = 0.2;
  d.breaks[1].core.enabled = false;
  const start = d.launch.time_s + d.breaks[1].at_s + l.delay_s;
  assert.equal(simulate(d, start - 0.01).kinds.length, 0);
  const p = simulate(d, start + 0.4);
  const q = directions(l.count, l.pattern, d.seed * 13 + 1)[0];
  const expected = starPos(l, q, 0.4, [0, d.launch.height_m + 8, 0]);
  [...p.positions.slice(0, 3)].forEach((v, i) => close(v, expected[i], 1e-5));
});
test('fades, ignition, white-hot, warm shift and wink-out behave at boundaries', () => {
  const d = fixture('peony'),
    l = d.breaks[0].layers[0],
    fade = d.breaks[0].fade;
  assert.equal(fadeAlpha(fade, 0, 2), 0);
  assert.equal(fadeAlpha(fade, 0.2, 2), 1);
  close(fadeAlpha(fade, 1.96, 2), ((1 - 0.98) / (1 - 0.72)) * ((1 - 0.98) / 0.08));
  assert.equal(fadeAlpha(fade, 2, 2), 0);
  assert.equal(simulate(d, -1).kinds.length, 0);
  assert.equal(simulate(d, shotDuration(d)).kinds.length, 0);
  assert.throws(() => simulate(d, NaN), /finite/);
  assert.throws(() => simulate(d, Infinity), /finite/);
  const noPrime = structuredClone(d);
  noPrime.breaks[0].fade.prime_s = 0;
  const early = simulate(noPrime, d.launch.time_s + 0.001);
  const head = [...early.kinds].indexOf(ParticleKind.Head);
  assert.ok(early.colours[head * 3 + 1] > rgb('#ff3048')[1]);
  // One star with exact life lets late cooling be checked without random burn variation.
  l.count = 1;
  l.life_var = 0;
  d.breaks[0].core.enabled = false;
  const late = simulate(d, d.launch.time_s + l.life_s * 0.9);
  const h = [...late.kinds].indexOf(ParticleKind.Head);
  assert.ok(late.colours[h * 3 + 1] > rgb('#ff3048')[1]);
});
test('colour stops interpolate in linear RGB, step at equal times, and select palettes', () => {
  const c = {
    mode: 'solid',
    stops: [
      [0, '#000000'],
      [0.5, '#000000'],
      [0.5, '#ffffff'],
      [1, '#ffffff'],
    ],
  };
  assert.deepEqual(colourAt(c, 0.49, 0, 0), [0, 0, 0]);
  assert.deepEqual(colourAt(c, 0.5, 0, 0), [1, 1, 1]);
  c.stops = [
    [0, '#000000'],
    [1, '#ffffff'],
  ];
  assert.deepEqual(colourAt(c, 0.5, 0, 0), [0.5, 0.5, 0.5]);
  const pal = {
    stops: [
      [0, ['#ff0000', '#00ff00']],
      [1, ['#ff0000', '#00ff00']],
    ],
  };
  for (const [mode, index, h, expected] of [
    ['solid', 1, 0.8, [1, 0, 0]],
    ['alternate', 3, 0, [0, 1, 0]],
    ['random', 0, 0.8, [0, 1, 0]],
    ['per_star', 1, 0, [0, 1, 0]],
  ])
    assert.deepEqual(colourAt({ ...pal, mode }, 0.5, index, h), expected);
  assert.equal(
    brightnessAt(
      [
        [0, 0],
        [0.5, 2],
        [1, 0],
      ],
      0.25,
    ),
    1,
  );
  assert.equal(
    brightnessAt(
      [
        [0, 0],
        [1, 2],
      ],
      2,
    ),
    2,
  );
});
test('core flags, head visibility and halo shape control emitted particle kinds', () => {
  const d = fixture('peony'),
    b = d.breaks[0],
    l = b.layers[0];
  l.hidden = true;
  assert.equal(simulate(d, d.launch.time_s + 0.03).kinds.length, 0);
  l.hidden = false;
  l.head.visible = false;
  assert.ok([...simulate(d, d.launch.time_s + 0.03).kinds].includes(ParticleKind.Flash));
  b.core.flash_on = false;
  assert.equal(simulate(d, d.launch.time_s + 0.03).kinds.length, 0);
  b.core.ring = true;
  assert.ok([...simulate(d, d.launch.time_s + 0.1).kinds].every((k) => k === ParticleKind.Spark));
  assert.ok(simulate(d, d.launch.time_s + 0.1).kinds.length > 0);
  b.core.enabled = false;
  l.head.visible = true;
  l.head.halo = 0;
  assert.ok([...simulate(d, d.launch.time_s + 0.4).kinds].every((k) => k === ParticleKind.Head));
});

for (const c of golden.cases)
  test(`${c.name}: captured core matches the prototype`, () => {
    const d = fixture('peony');
    Object.assign(d.launch, c.launch);
    Object.assign(d.breaks[0].core, c.core);
    Object.assign(d.breaks[0].layers[0], c.layer);
    const p = simulate(d, c.frame.time_s);
    assert.equal(p.kinds.length, c.frame.count);
    for (const sample of c.frame.samples)
      row(p, sample.index).forEach((v, i) => close(v, sample.values[i]));
  });

test('zero seed follows the reference fallback and override takes precedence', () => {
  const d = fixture('peony');
  d.seed = 0;
  assert.deepEqual(simulate(d, 3), simulate(d, 3, { seed: 1 }));
  d.seed = 12;
  assert.deepEqual(simulate(d, 3, { seed: 0 }), simulate(d, 3, { seed: 1 }));
});

// Sample before, at and after the 40 ms growth boundary to cover both flash envelopes.
const CORE_FLASH_SAMPLE_TIMES_S = [0.02, 0.04, 0.1];
// Prototype main flash size for peony: capped radius 14 times authored flash 1.
const CORE_FLASH_BASE_SIZE = 14;
// Prototype growth rises from 0.6 to 1.0 over 40 ms, distinct from the early glow.
const CORE_FLASH_MIN_FACTOR = 0.6;
const CORE_FLASH_GROWTH_FACTOR = 0.4;
const CORE_FLASH_GROWTH_S = 0.04;
// Float32 particle-size comparison tolerance in renderer units.
const CORE_FLASH_SIZE_TOLERANCE = 1e-6;
test('main core flash retains its own growth envelope beside the early glow', () => {
  const d = fixture('peony');
  const b = d.breaks[0];
  for (const age of CORE_FLASH_SAMPLE_TIMES_S) {
    const writer = new ParticleWriter(false, false, false);
    fillCore(writer, b.core, b.layers[0], d.seed, 0, age, [0, 0, 0]);
    const frame = writer.finish();
    const flash = frame.kinds.findIndex((kind) => kind === ParticleKind.Flash);
    assert.ok(flash >= 0);
    close(
      frame.sizes[flash],
      CORE_FLASH_BASE_SIZE *
        (CORE_FLASH_MIN_FACTOR + CORE_FLASH_GROWTH_FACTOR * Math.min(1, age / CORE_FLASH_GROWTH_S)),
      CORE_FLASH_SIZE_TOLERANCE,
    );
  }
});
