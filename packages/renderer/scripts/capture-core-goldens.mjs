/** Captures deterministic reference-frame fixtures from the read-only prototype renderer. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { sprayCases } from '../tests/spray-cases.mjs';
import { kindCases } from '../tests/kind-cases.mjs';

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
vm.runInContext(
  'this.fullSpray = spray; this.fullStyles = JSON.parse(JSON.stringify(LAUNCH_STYLES));',
  context,
);
// Isolate the existing core regressions. Capture heads and discrete modifier events only.
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
function legacyTrail(t) {
  return {
    ...t,
    length: t.length_s,
    spread: t.spread_m_s,
    gravity: t.gravity_m_s2,
    drag: t.drag_per_s,
    glitterDelay: t.glitter_delay_s,
  };
}
function legacyLayer(l, b) {
  const first = l.colour.stops[0][1];
  const values = typeof first === 'string' ? [first] : first;
  const ghostAt = l.colour.stops.find((s, i, stops) => i > 0 && s[0] === stops[i - 1][0])?.[0];
  const change = l.colour.reignition ?? (ghostAt !== undefined ? { at: ghostAt } : null);
  const target = change
    ? l.colour.stops.find((s) => s[0] >= change.at && s[1] !== first)?.[1]
    : null;
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
    twist: fx?.kind === 'twist' ? fx.angular_speed_rad_s : 0,
    colours: values,
    colourMode: l.colour.mode,
    changeTo: target,
    changeAt: change?.at,
    head: { ...l.head, brightness: l.brightness[0][1] },
    trail: {
      ...legacyTrail(l.trail),
      glitter:
        fx?.kind === 'glitter'
          ? Math.max(0, Math.min(1, l.trail.glitter + fx.amount))
          : l.trail.glitter,
      glitterDelay: fx?.kind === 'glitter' ? fx.at * l.life_s : l.trail.glitter_delay_s,
    },
    effect: fx
      ? {
          ...fx,
          kind:
            fx.kind === 'split'
              ? 'crossette'
              : ['twist', 'glitter', 'whistle'].includes(fx.kind)
                ? 'none'
                : fx.kind,
          rate: fx.kind === 'fish' ? fx.rate_rad_s : fx.rate_hz,
        }
      : { kind: 'none' },
    __core: core(b.core),
    __fade: fade(b.fade),
  };
}
function legacy(doc) {
  if (doc.kind === 'comet' || doc.kind === 'candle') {
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
        colours: Array.isArray(original) ? original : undefined,
        colour: Array.isArray(original) ? original[0] : original,
        changeTo: c.colour.stops.find((s) => s[1] !== original)?.[1],
        changeAt: c.colour.reignition?.at ?? c.colour.stops[1]?.[0],
        split: c.split
          ? { count: c.split.count, distance: c.split.distance_m, life: c.split.life_s }
          : null,
        trail: c.trail === 'house' ? null : c.trail,
        tailLife: c.tail_life_s,
        spin: c.spin_rad_s,
        spinR: c.spin_radius_m,
      },
    };
  }
  if (doc.launch === null) {
    const v = doc.ground[doc.kind];
    return {
      kind: doc.kind,
      [doc.kind]: {
        ...v,
        height: v.height_m,
        time: v.time_s,
        duration: v.duration_s,
        radius: v.radius_m,
        spin: v.spin_rad_s ?? v.spin_hz,
        wander: v.wander_m,
        rate: v.rate_per_s,
        speed: v.speed_m_s,
        life: v.life_s,
        spacing: v.spacing_m,
        dir: v.direction,
        gravity: v.gravity_m_s2,
        drag: v.drag_per_s,
        glowAlpha: v.glow_alpha,
      },
    };
  }
  return {
    kind: doc.kind === 'rocket' ? 'shell' : doc.kind,
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
  const smokeIndices = [...new Set([0, Math.floor(buffer.sm / 2), buffer.sm - 1])].filter(
    (i) => i >= 0 && i < buffer.sm,
  );
  return {
    time_s: t,
    count,
    samples: indices.map((index) => ({ index, values: rows[index] })),
    smoke: {
      count: buffer.sm,
      samples: smokeIndices.map((index) => ({
        index,
        values: [
          ...buffer.spos.slice(index * 3, index * 3 + 3),
          ...buffer.scol.slice(index * 3, index * 3 + 3),
          buffer.ssize[index],
          buffer.salpha[index],
          ...buffer.sseed.slice(index * 2, index * 2 + 2),
        ],
      })),
    },
  };
}
const fixtures = {};
for (const name of ['peony', 'multi-break', 'comet']) {
  const doc = JSON.parse(
    readFileSync(new URL(`../src/fixtures/${name}.json`, import.meta.url), 'utf8'),
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
        ? 'reference capture for the ground-kind path'
        : 'core without modifiers, sprays or smoke',
    frames: [0.5, 1.7, T + 0.03, T + 0.3, T + 0.83, T + 2.3, duration_s].map((t) =>
      frame(d, doc.seed, t),
    ),
  };
}
const cases = [];
const peony = JSON.parse(
  readFileSync(new URL('../src/fixtures/peony.json', import.meta.url), 'utf8'),
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
  // Capture the launch-head path without its embellishment particles.
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
    'Sprays and smoke disabled; original core cases remove modifiers after duration capture, kinds cases retain modifiers. Per-break core/fade lookups use v1 values. Glitter affects sprays only, whistle affects sound only. Launch embellishments disabled.',
  kinds: kindCases().map((c) => ({
    name: c.name,
    frames: c.times.map((t) => frame(legacy(c.design), c.design.seed, t)),
  })),
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
// Restore the unmodified reference maths and launch tuning for full spray and smoke frames.
vm.runInContext(
  'spray = this.fullSpray; SETTINGS.smoke = true; for (const key of Object.keys(LAUNCH_STYLES)) Object.assign(LAUNCH_STYLES[key], this.fullStyles[key]);',
  context,
);
result.sprays = sprayCases().map((c) => ({
  name: c.name,
  frames: c.times.map((t) => frame(legacy(c.design), c.design.seed, t)),
}));
result.scope +=
  ' Full sprays cases retain sprays, smoke and launch embellishments, with stored trail units mapped at the reference boundary.';
writeFileSync(
  new URL('../tests/fixtures/core-goldens.json', import.meta.url),
  `${JSON.stringify(result, null, 2)}\n`,
);
