import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

// One-off capture from the owner's read-only reference, never from the port.
const path = process.argv[2];
if (!path) throw new Error('Pass the absolute path to the reference fireworks3d.js');
const source = readFileSync(path, 'utf8');
const context = vm.createContext({
  THREE: {},
  window: {},
  document: { addEventListener() {} },
  localStorage: {
    getItem() {
      return null;
    },
  },
});
// Browser imports are unused here. All simulation maths remains the reference's code.
const executable = source.replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
vm.runInContext(
  `${executable}\nthis.reference = { Buffer, fillShot, shotDuration, hash, rgb, directions, starPos };`,
  context,
);
const ref = context.reference;
// PR 2.4 supplies sprays/smoke. PR 2.3 supplies layer modifiers. Capture the core only.
vm.runInContext('spray = () => {}; SETTINGS.smoke = false;', context);
// The prototype has one core/fade; v1 has one per break. Only the lookup changes.
vm.runInContext(
  `fillShot = ${ref.fillShot.toString().replaceAll('d.core', '(L.__core || d.core)').replaceAll('d.fade', '(L.__fade || d.fade)')}; this.reference.fillShot = fillShot;`,
  context,
);

function core(c) {
  return { ...c, flashOn: c.flash_on };
}
function fade(f) {
  return { whiteHot: f.white_hot, emberAt: f.ember_at, fadeAt: f.fade_at, prime: f.prime_s };
}
function legacyLayer(l, b) {
  const first = l.colour.stops[0][1];
  const values = typeof first === 'string' ? [first] : first;
  const change = l.colour.reignition;
  const target = change ? l.colour.stops.find((s) => s[0] > change.at)?.[1] : null;
  if (Array.isArray(target)) throw new Error('Capture expects a scalar colour change');
  const fx = l.modifiers[0];
  return {
    name: l.name,
    pattern: l.pattern,
    count: l.count,
    radius: l.radius_m,
    tilt: l.tilt,
    speedVar: l.speed_var,
    drag: l.drag_per_s,
    gravity: l.gravity_m_s2,
    life: l.life_s,
    lifeVar: l.life_var,
    delay: b.at_s + l.delay_s,
    offset: l.offset_m,
    flash: l.flash,
    hidden: l.hidden,
    twist: 0,
    colours: values,
    colourMode: l.colour.mode,
    changeTo: target,
    changeAt: change?.at,
    head: { ...l.head, brightness: l.brightness[0][1] },
    trail: { ...l.trail, length: l.trail.length_s },
    effect: fx ? { ...fx, rate: fx.rate_hz } : { kind: 'none' },
    __core: core(b.core),
    __fade: fade(b.fade),
  };
}
function legacy(doc) {
  if (doc.kind === 'comet') {
    const c = doc.ground.comets;
    const original = c.colour.stops[0][1];
    return {
      kind: 'comet',
      comets: {
        ...c,
        time: c.time_s,
        height: c.height_m,
        spread: c.spread_deg,
        gap: c.gap_s,
        colour: original,
        changeTo: '#ffffff',
        changeAt: c.colour.reignition.at,
        trail: null,
        tailLife: c.tail_life_s,
        spin: c.spin_rad_s,
        spinR: c.spin_radius_m,
      },
    };
  }
  return {
    kind: doc.kind,
    launch: {
      ...doc.launch,
      height: doc.launch.height_m,
      time: doc.launch.time_s,
      tilt: doc.launch.tilt_deg,
      style: doc.launch.tail,
    },
    core: core(doc.breaks[0].core),
    fade: fade(doc.breaks[0].fade),
    layers: doc.breaks.flatMap((b) => b.layers.map((l) => legacyLayer(l, b))),
  };
}
function frame(d, seed, t) {
  const buffer = new ref.Buffer();
  ref.fillShot(buffer, { design: d, seed }, t);
  const count = buffer.n + buffer.q;
  const rows = [];
  for (let i = 0; i < buffer.n; i++)
    rows.push([
      0,
      ...buffer.pos.slice(i * 3, i * 3 + 3),
      ...buffer.col.slice(i * 3, i * 3 + 3),
      buffer.size[i],
      buffer.alpha[i],
    ]);
  for (let i = 0; i < buffer.q; i++)
    rows.push([
      buffer.qshape[i] === 0 ? 3 : buffer.qshape[i],
      ...buffer.qpos.slice(i * 3, i * 3 + 3),
      ...buffer.qcol.slice(i * 3, i * 3 + 3),
      buffer.qsize[i],
      buffer.qalpha[i],
    ]);
  const indices = [
    ...new Set([0, 1, Math.floor(count / 3), Math.floor(count / 2), count - 2, count - 1]),
  ].filter((i) => i >= 0 && i < count);
  return { time_s: t, count, samples: indices.map((index) => ({ index, values: rows[index] })) };
}
const fixtures = {};
for (const name of ['peony', 'multi-break', 'comet']) {
  const doc = JSON.parse(
    readFileSync(new URL(`../tests/fixtures/${name}.json`, import.meta.url), 'utf8'),
  );
  const d = legacy(doc);
  const duration_s = ref.shotDuration(d);
  if (d.layers)
    d.layers.forEach((l) => {
      l.effect = { kind: 'none' };
    });
  const T = doc.launch?.time_s ?? doc.ground.comets.time_s;
  fixtures[name] = {
    duration_s,
    simulation:
      name === 'comet'
        ? 'reference-only: kind deferred to PR 2.3'
        : 'core without modifiers, sprays or smoke',
    frames: [0.5, 1.7, T + 0.03, T + 0.3, T + 0.83, T + 2.3, duration_s].map((t) =>
      frame(d, doc.seed, t),
    ),
  };
}
const cases = [];
const peony = JSON.parse(
  readFileSync(new URL('../tests/fixtures/peony.json', import.meta.url), 'utf8'),
);
for (const tail of [
  'gold',
  'silver',
  'glitter',
  'comet',
  'crackle',
  'whistle',
  'heli',
  'rocket',
  'tiger',
  'willow',
  'strobe',
  'brocade',
  'dark',
  'flowers',
]) {
  const doc = structuredClone(peony);
  doc.launch.tail = tail;
  doc.launch.tilt_deg = 14;
  const d = legacy(doc);
  // Launch embellishment particles are deferred with sprays/modifiers, but keep the head path.
  const st = vm.runInContext(`LAUNCH_STYLES['${tail}']`, context);
  delete st.flame;
  delete st.blossoms;
  delete st.crackle;
  cases.push({
    name: `launch-${tail}`,
    launch: { tail, tilt_deg: 14 },
    frame: frame(d, doc.seed, 0.53),
  });
}
const ring = structuredClone(peony);
ring.breaks[0].core.ring = true;
ring.breaks[0].core.flash_on = false;
cases.push({
  name: 'core-ring',
  core: { ring: true, flash_on: false },
  frame: frame(legacy(ring), ring.seed, ring.launch.time_s + 0.17),
});
const random = structuredClone(peony);
random.breaks[0].layers[0].pattern = 'random';
cases.push({
  name: 'random-directions',
  layer: { pattern: 'random' },
  frame: frame(legacy(random), random.seed, random.launch.time_s + 0.45),
});
const result = {
  source: 'prototype/fireworks3d.js',
  source_sha256: createHash('sha256').update(source).digest('hex'),
  scope:
    'Core only: sprays and smoke disabled, layer modifiers removed after duration capture; per-break core/fade lookups use v1 values. Comet positions retained for PR 2.3, only duration checked in PR 2.2.',
  helpers: {
    hashes: [
      [0, 0, 0],
      [11, 12, 13],
      [-1, 2147483647, 5],
    ].map((args) => ({ args, value: ref.hash(...args) })),
    colours: ['#ff3048', '#2fe06a', '#ffe2a8'].map((hex) => ({ hex, value: ref.rgb(hex) })),
  },
  fixtures,
  cases,
};
writeFileSync(
  new URL('../tests/fixtures/core-goldens.json', import.meta.url),
  `${JSON.stringify(result, null, 2)}\n`,
);
