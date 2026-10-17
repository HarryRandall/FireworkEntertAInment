/**
 * Musical density of sustained layers: cakes of different products share one
 * ledger, start on phrase boundaries, stay within what each passage can carry
 * and leave shells free to accent the beat while they run.
 */

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

await import('../../../../scripts/renderer/register-typescript.mjs');
const root = process.cwd();

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return nextResolve('data:text/javascript,export {};', context);
    }
    let unresolvedPath = null;
    if (specifier.startsWith('@/')) {
      unresolvedPath = join(root, specifier.slice(2));
    } else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      unresolvedPath = join(dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (unresolvedPath) {
      for (const candidate of [
        unresolvedPath,
        `${unresolvedPath}.ts`,
        join(unresolvedPath, 'index.ts'),
      ]) {
        if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const [
  layers,
  plan,
  { realiseShowPlan },
  { planCuesOnBeats },
  { planCuesFast },
  { buildCueSlots },
  { spreadMultishotPositions },
  { parseCreativeDirection },
  { parsePromptConstraints },
  { buildProductTimingProfile },
  { evaluateFinalChoreography },
  { DEFAULT_DESIGN },
  { DEFAULT_FIREWORK_SPEC },
] = await Promise.all([
  import('../../lib/cue-generation/sustained-layers.ts'),
  import('../../lib/cue-generation/show-plan.ts'),
  import('../../lib/cue-generation/plan-realiser.ts'),
  import('../../lib/cue-generation/beat-sync-planner.ts'),
  import('../../lib/cue-generation/fast-planner.ts'),
  import('../../lib/beat-grid.server.ts'),
  import('../../lib/cue-generation/multishot-spread.ts'),
  import('../../lib/cue-generation/creative-direction.ts'),
  import('../../lib/cue-generation/prompt-constraints.ts'),
  import('../../lib/fireworks/timing-profile.ts'),
  import('../../lib/cue-generation/quality.ts'),
  import('@showcrafter/renderer').then(({ effectTemplates }) => ({
    DEFAULT_DESIGN: effectTemplates.find((entry) => entry.key === 'peony').design,
  })),
  import('@showcrafter/fireworks/spec'),
]);

const { SustainedLayerLedger, PHASE_LIMITS } = layers;

// A 150 second pop structure at 120 BPM: a near-silent intro, a verse, a
// chorus, a second verse, a build and a final chorus that closes the song.
const SONG = 150;
const SECTIONS = [
  { start: 0, end: 16, label: 'intro', energy: 0.05 },
  { start: 16, end: 48, label: 'verse', energy: 0.3 },
  { start: 48, end: 80, label: 'chorus', energy: 0.7 },
  { start: 80, end: 104, label: 'verse', energy: 0.35 },
  { start: 104, end: 120, label: 'buildup', energy: 0.5 },
  { start: 120, end: SONG, label: 'chorus', energy: 0.85 },
];

function syntheticAnalysis() {
  const beat_times = [];
  for (let t = 0.5; t < SONG; t += 0.5) beat_times.push(Number(t.toFixed(3)));
  const downbeat_times = beat_times.filter((_, index) => index % 4 === 0);
  const energyAt = (time) =>
    SECTIONS.find((section) => time >= section.start && time < section.end)?.energy ?? 0.85;
  return {
    schema_version: '1.4.0',
    file: 'synthetic',
    duration_seconds: SONG,
    tempo_bpm: 120,
    total_beats: beat_times.length,
    beats_per_bar: 4,
    beat_times,
    downbeat_times,
    energy_timeline: Array.from({ length: SONG + 1 }, (_, time) => ({
      time,
      energy: energyAt(time),
    })),
    sections: SECTIONS.map((section, index) => ({
      start: section.start,
      end: section.end,
      duration: section.end - section.start,
      avg_energy: section.energy,
      peak_energy: Math.min(1, section.energy + 0.1),
      intensity: section.energy < 0.3 ? 'low' : section.energy < 0.6 ? 'medium' : 'high',
      cluster_id: index,
      label: section.label,
    })),
    key_moments: [{ time: 120, energy: 0.9, prominence: 0.8, type: 'climax' }],
    buildups: [{ start: 112, peak: 120, duration: 8, energy_rise: 0.4 }],
  };
}

const analysis = syntheticAnalysis();

function shell(id, { colour, calibre, price }) {
  return {
    id,
    slug: id,
    name: `${colour} ${calibre}mm shell`,
    description: 'Aerial shell',
    sortOrder: 0,
    durationSeconds: 1.6,
    occupancyDurationSeconds: 1.6,
    minPriceCents: price,
    heightMeters: 20 + calibre / 2,
    caliber: `${calibre}mm`,
    shotCount: 1,
    manufacturer: 'Test',
    previewImagePath: null,
    previewImageRevision: null,
    spec: { ...DEFAULT_FIREWORK_SPEC, color: colour },
    rawSpec: null,
    renderDesign: null,
    design: DEFAULT_DESIGN,
    kind: DEFAULT_DESIGN.kind,
    baseEffect: null,
    variant: null,
  };
}

/** A cake with evenly spaced children, like a real catalogue multishot. */
function cake(id, { shotCount, durationSeconds, price, colour = '#ffd166' }) {
  return {
    ...shell(id, { colour, calibre: 30, price }),
    name: `${id} cake`,
    description: `${shotCount} shot cake`,
    durationSeconds,
    occupancyDurationSeconds: durationSeconds,
    shotCount,
  };
}

function childrenFor(product) {
  const shots = product.shotCount ?? 1;
  if (shots <= 1) return undefined;
  const single = { ...product, shotCount: 1 };
  const span = Math.max(0, product.durationSeconds - 2.5);
  return Array.from({ length: shots }, (_, index) => ({
    firework: single,
    timeOffsetSeconds: Number(((span * index) / Math.max(1, shots - 1)).toFixed(3)),
  }));
}

function profilesFor(items) {
  return new Map(
    items.map((item) => [
      item.id,
      Object.fromEntries(
        ['normal', 'accent', 'peak'].map((emphasis) => [
          emphasis,
          buildProductTimingProfile({ product: item, emphasis, children: childrenFor(item) }),
        ]),
      ),
    ]),
  );
}

const shells = [
  shell('red-30', { colour: '#e63946', calibre: 30, price: 1500 }),
  shell('red-50', { colour: '#e63946', calibre: 50, price: 2500 }),
  shell('gold-30', { colour: '#ffd166', calibre: 30, price: 1500 }),
  shell('gold-75', { colour: '#ffd166', calibre: 75, price: 4000 }),
  shell('green-50', { colour: '#2a9d8f', calibre: 50, price: 2500 }),
  shell('blue-75', { colour: '#1d4ed8', calibre: 75, price: 4000 }),
  shell('white-100', { colour: '#ffffff', calibre: 100, price: 6000 }),
  shell('purple-50', { colour: '#7c3aed', calibre: 50, price: 2500 }),
];
// Five long cakes with distinct ids, shot counts and run lengths.
const cakes = [
  cake('cake-a', { shotCount: 16, durationSeconds: 20, price: 12000 }),
  cake('cake-b', { shotCount: 25, durationSeconds: 28, price: 18000, colour: '#2a9d8f' }),
  cake('cake-c', { shotCount: 36, durationSeconds: 32, price: 24000, colour: '#e63946' }),
  cake('cake-d', { shotCount: 20, durationSeconds: 36, price: 20000, colour: '#1d4ed8' }),
  cake('cake-e', { shotCount: 30, durationSeconds: 40, price: 30000, colour: '#ffffff' }),
];
const products = [...shells, ...cakes];
const timingProfiles = profilesFor(products);
const byId = new Map(products.map((item) => [item.id, item]));
const BUDGET = 600000;

const isCake = (cue) => (byId.get(cue.productId)?.shotCount ?? 1) > 1;
const runOf = (cue) => ({
  start: cue.timeSeconds,
  end:
    cue.timeSeconds +
    (timingProfiles.get(cue.productId)?.[cue.emphasis]?.totalDurationSeconds ??
      byId.get(cue.productId).durationSeconds),
});

/** Maximum simultaneously running cakes, overall and per launch position. */
function cakeConcurrency(cues, { from = 0, to = SONG } = {}) {
  const runs = cues.filter(isCake).map((cue) => ({ ...runOf(cue), tube: cue.tube }));
  let overall = 0;
  const perTube = [0, 0, 0];
  for (const run of runs) {
    if (run.start < from || run.start >= to) continue;
    const active = runs.filter((other) => other.start <= run.start && run.start < other.end);
    overall = Math.max(overall, active.length);
    for (const tube of [0, 1, 2]) {
      perTube[tube] = Math.max(perTube[tube], active.filter((other) => other.tube === tube).length);
    }
  }
  return { overall, perTube };
}

function spendBetween(cues, from, to) {
  return cues
    .filter((cue) => cue.timeSeconds >= from && cue.timeSeconds < to)
    .reduce((sum, cue) => sum + (byId.get(cue.productId)?.minPriceCents ?? 0), 0);
}

function realise({ brief = '', items = products, budgetCents = BUDGET, densityShift = 0 } = {}) {
  const direction = parseCreativeDirection(brief, 'signature');
  const constraints = parsePromptConstraints(brief, items);
  const sections = plan.buildPlanSections(analysis, SONG);
  const palette = plan.describeCataloguePalette(items);
  const base = plan.buildDefaultShowPlan({ sections, direction, constraints, palette });
  const showPlan = densityShift
    ? {
        ...base,
        sections: base.sections.map((section) => ({
          ...section,
          density: Math.max(0, Math.min(4, section.density + densityShift)),
        })),
      }
    : base;
  const realised = realiseShowPlan({
    plan: showPlan,
    sections,
    analysis,
    songDuration: SONG,
    products: items,
    timingProfiles: profilesFor(items),
    maxTubes: 3,
    constraints,
    budgetCents,
  });
  return { ...realised, sections, showPlan };
}

test('the ledger keeps one running cake per position and a site-wide cap across product ids', () => {
  const ledger = new SustainedLayerLedger();
  const limits = { activeLimit: 2, shotRateLimit: 6 };
  const layer = (productId, tube, start, end, shotRate = 1) => ({
    productId,
    tube,
    start,
    end,
    shotRate,
  });
  assert.equal(ledger.canStart(layer('a', 0, 10, 40), limits), true);
  ledger.add(layer('a', 0, 10, 40));
  // A different product cannot share the position while the first still runs.
  assert.equal(ledger.canStart(layer('b', 0, 20, 50), limits), false);
  assert.equal(ledger.canStart(layer('b', 1, 20, 50), limits), true);
  ledger.add(layer('b', 1, 20, 50));
  // Two layers are already active, so a third position is still refused.
  assert.equal(ledger.canStart(layer('c', 2, 30, 45), limits), false);
  // Starting before both but overlapping a later start is also refused.
  assert.equal(ledger.canStart(layer('c', 2, 5, 25), limits), false);
  assert.equal(ledger.canStart(layer('c', 2, 5, 15), limits), true);
  // After the first finishes a new layer may start, unless its shot rate overflows.
  assert.equal(ledger.canStart(layer('c', 0, 41, 60, 5), limits), true);
  assert.equal(ledger.canStart(layer('c', 0, 41, 60, 5.5), limits), false);
  assert.equal(
    ledger.canStart(layer('c', 0, 41, 60, 5.5), { ...limits, shotRateLimit: null }),
    true,
  );
  assert.equal(
    ledger.canStart(layer('c', 0, 41, 60), { activeLimit: 1, shotRateLimit: null }),
    false,
  );
  assert.equal(
    ledger.canStart(layer('c', 0, 51, 60), { activeLimit: 1, shotRateLimit: null }),
    true,
  );
  // Rollback in step with a planner's own bookkeeping.
  ledger.truncate(1);
  assert.equal(ledger.size, 1);
  assert.equal(ledger.canStart(layer('c', 2, 30, 45), limits), true);
});

test('phases follow role, energy and analysed vibe, and never exceed the launch positions', () => {
  assert.equal(
    layers.sectionDensityPhase({ role: 'opener', density: 3 }, { energy: 0.05 }, 0),
    'quiet',
  );
  assert.equal(
    layers.sectionDensityPhase({ role: 'opener', density: 2 }, { energy: 0.4 }, 0),
    'moderate',
  );
  assert.equal(
    layers.sectionDensityPhase({ role: 'body', density: 1 }, { energy: 0.4 }, 0.5),
    'sparse',
  );
  assert.equal(
    layers.sectionDensityPhase({ role: 'build', density: 2 }, { energy: 0.5 }, 0.9),
    'busy',
  );
  assert.equal(
    layers.sectionDensityPhase({ role: 'peak', density: 3 }, { energy: 0.8 }, 0.5),
    'peak',
  );
  assert.equal(
    layers.sectionDensityPhase({ role: 'finale', density: 2 }, { energy: 0.8 }, 0.5),
    'peak',
  );
  assert.equal(
    layers.sectionDensityPhase({ role: 'outro', density: 0 }, { energy: 0.5 }, 0.5),
    'quiet',
  );
  assert.equal(
    layers.slotDensityPhase({ vibe: 'intro', intensity: 0.2, nearClimax: false, finale: false }),
    'quiet',
  );
  assert.equal(
    layers.slotDensityPhase({ vibe: 'verse', intensity: 0.5, nearClimax: false, finale: false }),
    'sparse',
  );
  assert.equal(
    layers.slotDensityPhase({ vibe: 'chorus', intensity: 0.9, nearClimax: false, finale: false }),
    'busy',
  );
  assert.equal(
    layers.slotDensityPhase({ vibe: 'verse', intensity: 0.5, nearClimax: true, finale: false }),
    'peak',
  );
  assert.equal(layers.sustainedLayerLimit('peak', 3), PHASE_LIMITS.peak.activeLayers);
  assert.equal(layers.sustainedLayerLimit('peak', 1), 1);
  assert.equal(layers.sustainedLayerLimit('quiet', 3), 1);
  assert.deepEqual([0.05, 0.2, 0.6].map(layers.energyDensityCeiling), [1, 2, 4]);
});

test('short volleys stay accents while long cakes and fountains count as layers', () => {
  const fountain = {
    ...cake('fountain', { shotCount: 1, durationSeconds: 12, price: 1 }),
    kind: 'fountain',
  };
  assert.equal(layers.isSustainedProduct(cakes[0], timingProfiles.get('cake-a').normal), true);
  assert.equal(
    layers.isSustainedProduct({ shotCount: 3, kind: 'shell', durationSeconds: 1.5 }),
    false,
  );
  assert.equal(
    layers.isSustainedProduct({ shotCount: 12, kind: 'shell', durationSeconds: null }),
    true,
  );
  assert.equal(layers.isSustainedProduct(fountain), true);
  assert.equal(layers.isSustainedProduct(shells[0], timingProfiles.get('red-30').normal), false);
  assert.ok(
    Math.abs(layers.sustainedLayerSeconds(cakes[4], timingProfiles.get('cake-e').normal) - 40) < 3,
  );
  assert.ok(layers.sustainedShotRate(cakes[2], timingProfiles.get('cake-c').normal) > 1);
  // A light volley whose shells linger is still an accent: the firing span,
  // not the last shell's fade, decides whether it is a bed.
  const lingering = buildProductTimingProfile({
    product: cake('lingering', { shotCount: 3, durationSeconds: 1 }),
    emphasis: 'normal',
    children: [0, 0.4, 0.8].map((timeOffsetSeconds) => ({
      firework: shells[3],
      timeOffsetSeconds,
    })),
  });
  assert.ok(lingering.totalDurationSeconds >= 4, 'the fixture shells outlive the firing');
  assert.equal(
    layers.isSustainedProduct({ shotCount: 3, kind: 'shell', durationSeconds: 1 }, lingering),
    false,
  );
});

test('a dense short cake consumes layer and rate capacity instead of slipping past the caps', () => {
  const dense = cake('dense', { shotCount: 60, durationSeconds: 2, price: 9000 });
  const profile = profilesFor([dense]).get('dense').normal;
  assert.equal(layers.isSustainedProduct(dense, profile), true);
  assert.equal(
    layers.isSustainedProduct({ shotCount: 8, kind: 'shell', durationSeconds: 1 }),
    true,
  );
  assert.equal(
    layers.isSustainedProduct({ shotCount: 6, kind: 'shell', durationSeconds: 1 }),
    false,
  );
  const rate = layers.sustainedShotRate(dense, profile);
  assert.ok(rate > PHASE_LIMITS.peak.shotRate, `a two-second sixty-shot cake fires ${rate}/s`);

  const ledger = new SustainedLayerLedger();
  const denseLayer = { productId: 'dense', tube: 0, start: 30, end: 34, shotRate: rate };
  const slow = { productId: 'cake-a', tube: 1, start: 31, end: 50, shotRate: 1 };
  const peak = { activeLimit: 3, shotRateLimit: PHASE_LIMITS.peak.shotRate };
  // Alone it is admissible, so a catalogue of dense cakes can still fill a show...
  assert.equal(ledger.canStart(denseLayer, peak), true);
  ledger.add(denseLayer);
  // ...but while it runs nothing else may stack on the site, even at a peak,
  // and a slow cake already running blocks it the same way.
  assert.equal(ledger.canStart(slow, peak), false);
  assert.equal(ledger.canStart({ ...slow, start: 34 }, peak), true);
  ledger.truncate(0);
  ledger.add(slow);
  assert.equal(ledger.canStart(denseLayer, peak), false);

  // In a show, the realiser never lets it fire while another cake runs, and
  // keeps it out of the quiet intro, where even one would overrun the passage.
  const items = [...shells, cakes[0], cakes[1], dense];
  const { cues } = realise({ items, budgetCents: null });
  const denseCues = cues.filter((cue) => cue.productId === 'dense');
  assert.ok(denseCues.length >= 1, 'the dense cake is still used');
  assert.equal(
    denseCues.some((cue) => cue.timeSeconds < 16),
    false,
  );
  const runs = cues
    .filter((cue) => isCake(cue) || cue.productId === 'dense')
    .map((cue) => ({
      ...cue,
      end:
        cue.timeSeconds +
        (profilesFor(items).get(cue.productId)?.[cue.emphasis]?.totalDurationSeconds ?? 2),
    }));
  // The final hit may use the whole site at once; everywhere else the dense
  // cake runs alone.
  for (const cue of runs.filter(
    (run) => run.productId === 'dense' && run.impactTimeSeconds < 149,
  )) {
    const overlapping = runs.filter(
      (other) =>
        other.productId !== cue.productId &&
        other.timeSeconds < cue.end &&
        cue.timeSeconds < other.end,
    );
    assert.equal(
      overlapping.length,
      0,
      `dense cake at ${cue.timeSeconds} shared the sky with ${overlapping.map((o) => o.productId)}`,
    );
  }
});

test('the realiser lets a quiet intro breathe and keeps cakes to beds that never stack', () => {
  const { cues, slots, sections } = realise();
  const cakeCues = cues.filter(isCake);
  assert.ok(cakeCues.length >= 4, `expected several beds, got ${cakeCues.length}`);
  assert.ok(new Set(cakeCues.map((cue) => cue.productId)).size >= 3);

  const intro = cakeConcurrency(cues, { from: 0, to: 16 });
  assert.ok(intro.overall <= 1, `quiet intro carried ${intro.overall} cakes at once`);
  assert.ok(cues.filter((cue) => cue.timeSeconds < 10).length <= 8);

  const overall = cakeConcurrency(cues);
  assert.ok(overall.overall <= 3, `peak carried ${overall.overall} cakes at once`);
  assert.deepEqual(
    overall.perTube.map((count) => Math.min(count, 1)),
    overall.perTube,
    `a launch position held two running cakes: ${overall.perTube.join(',')}`,
  );

  // Cakes open phrases: section starts, hits or downbeats, never off-beats.
  for (const cue of cakeCues) {
    const slot = slots[cue.slotIndex];
    const sectionStart = sections.some((section) => Math.abs(section.start - slot.time) <= 0.6);
    assert.ok(
      slot.isDownbeat || slot.emphasis === 'peak' || sectionStart,
      `${cue.productId} started mid-phrase at ${slot.time}`,
    );
  }

  // Shells still accent the beat while a cake runs.
  const accentsDuringCakes = cues.filter(
    (cue) =>
      !isCake(cue) &&
      cakeCues.some((bed) => {
        const run = runOf(bed);
        return cue.timeSeconds > run.start + 1 && cue.timeSeconds < run.end - 1;
      }),
  );
  assert.ok(accentsDuringCakes.length > 10);

  // Existing safety: one ignition per position per interval.
  for (const cue of cues) {
    assert.equal(
      cues.some(
        (other) =>
          other !== cue &&
          other.tube === cue.tube &&
          Math.abs(other.timeSeconds - cue.timeSeconds) < 0.5,
      ),
      false,
    );
  }
});

test('the budget is paced through the track and the final hit still lands', () => {
  const { cues } = realise();
  const total = spendBetween(cues, 0, SONG + 10);
  assert.ok(total <= BUDGET);
  assert.ok(total > BUDGET * 0.7, `spent only ${total}`);
  const firstThird = spendBetween(cues, 0, 50);
  assert.ok(firstThird < BUDGET * 0.4, `front-loaded ${firstThird} of ${BUDGET} before 50s`);
  const closing = spendBetween(cues, 120, SONG + 10);
  assert.ok(closing > BUDGET * 0.2, `closing chorus only spent ${closing}`);

  const finalHit = cues.filter((cue) => Math.abs(cue.impactTimeSeconds - 149.5) <= 0.05);
  assert.ok(finalHit.length >= 1);
  assert.ok(finalHit.every((cue) => cue.emphasis === 'peak'));
  const quality = evaluateFinalChoreography({
    cues,
    slots: realise().slots,
    promptViolations: [],
    maxTubes: 3,
    sparse: false,
  });
  assert.equal(
    quality.issues.some((issue) => issue.kind === 'missing_final_hit'),
    false,
  );
  // The out-of-order protected hit at the build peak is realised across the site.
  assert.ok(cues.filter((cue) => Math.abs(cue.impactTimeSeconds - 120) <= 0.05).length >= 2);
});

test('an over-ambitious plan is clamped to the music so the intro stays sparse and peaks stay bounded', () => {
  const { cues } = realise({ densityShift: 2, budgetCents: null });
  const intro = cakeConcurrency(cues, { from: 0, to: 16 });
  assert.ok(intro.overall <= 1);
  assert.ok(cues.filter((cue) => cue.timeSeconds < 16).length <= 12);
  const overall = cakeConcurrency(cues);
  assert.ok(overall.overall <= 3);
  assert.deepEqual(
    overall.perTube.map((count) => Math.min(count, 1)),
    overall.perTube,
  );
  const busy = cues.filter((cue) => cue.timeSeconds >= 120).length;
  const quiet = cues.filter((cue) => cue.timeSeconds < 16).length;
  assert.ok(busy > quiet * 3);
});

test('explicit multishot requirements and bans are honoured through the density rules', () => {
  const onlyCakes = realise({ brief: 'multishots only please' });
  assert.ok(onlyCakes.cues.length > 0);
  assert.ok(onlyCakes.cues.every(isCake));
  const concurrency = cakeConcurrency(onlyCakes.cues);
  assert.deepEqual(
    concurrency.perTube.map((count) => Math.min(count, 1)),
    concurrency.perTube,
  );
  assert.ok(concurrency.overall <= 3);

  const noCakes = realise({ brief: 'single shots only' });
  assert.ok(noCakes.cues.length > 50);
  assert.equal(noCakes.cues.some(isCake), false);

  const named = realise({ brief: 'feature the cake-e cake' });
  assert.ok(named.cues.some((cue) => cue.productId === 'cake-e'));
});

test('the realiser replays deterministically', () => {
  assert.deepEqual(realise().cues, realise().cues);
});

test('the beat and fast planners share the ledger, including their cake-only fallbacks', () => {
  const slots = buildCueSlots(analysis, SONG, 3);
  const brief = {
    id: 'show',
    slug: 'show',
    title: 'Density',
    description: '',
    mood_tags: [],
    show_style: 'beat_test',
    site_width_feet: 80,
    budget_cents: BUDGET,
    duration_seconds: SONG,
  };
  const beat = planCuesOnBeats({
    analysis,
    slots,
    products,
    songDuration: SONG,
    brief,
    maxTubes: 3,
    timingProfiles,
  });
  const fast = planCuesFast({
    brief,
    analysis,
    slots,
    products,
    songDuration: SONG,
    timingProfiles,
  });
  for (const [label, result] of [
    ['beat', beat],
    ['fast', fast],
  ]) {
    assert.ok(result.cues.length > 40, `${label} planner produced ${result.cues.length} cues`);
    const concurrency = cakeConcurrency(result.cues);
    assert.ok(concurrency.overall <= 3, `${label} planner stacked ${concurrency.overall} cakes`);
    assert.deepEqual(
      concurrency.perTube.map((count) => Math.min(count, 1)),
      concurrency.perTube,
      `${label} planner stacked cakes on one position`,
    );
    const intro = cakeConcurrency(result.cues, { from: 0, to: 16 });
    assert.ok(intro.overall <= 1, `${label} planner opened with ${intro.overall} cakes`);
  }

  const cakeProfiles = profilesFor(cakes);
  const beatCakes = planCuesOnBeats({
    analysis,
    slots,
    products: cakes,
    songDuration: SONG,
    brief,
    maxTubes: 3,
    timingProfiles: cakeProfiles,
  });
  const fastCakes = planCuesFast({
    brief,
    analysis,
    slots,
    products: cakes,
    songDuration: SONG,
    timingProfiles: cakeProfiles,
  });
  for (const [label, result] of [
    ['beat', beatCakes],
    ['fast', fastCakes],
  ]) {
    assert.ok(result.cues.length >= 3, `${label} planner placed ${result.cues.length} cakes`);
    const concurrency = cakeConcurrency(result.cues);
    assert.deepEqual(
      concurrency.perTube.map((count) => Math.min(count, 1)),
      concurrency.perTube,
      `${label} planner stacked cakes on one position`,
    );
  }
});

test('only an exact physical pack may fall back to stacking cakes; ordinary generation never does', () => {
  const slots = buildCueSlots(analysis, SONG, 3);
  const brief = {
    id: 'show',
    slug: 'show',
    title: 'Pack',
    description: '',
    mood_tags: [],
    show_style: 'beat_test',
    site_width_feet: 80,
    budget_cents: null,
    duration_seconds: SONG,
  };
  // Nine forty-second cakes cannot each have a free position between the
  // chorus hits; ordinary generation simply uses fewer of them.
  const bigCakes = Array.from({ length: 9 }, (_, index) =>
    cake(`big-${index}`, { shotCount: 30, durationSeconds: 40, price: 20000 }),
  );
  const items = [...shells, ...bigCakes];
  const profiles = profilesFor(items);
  const ordinary = planCuesOnBeats({
    analysis,
    slots,
    products: items,
    songDuration: SONG,
    brief,
    maxTubes: 3,
    timingProfiles: profiles,
  });
  const ordinaryRuns = ordinary.cues
    .filter((cue) => cue.productId.startsWith('big-'))
    .map((cue) => ({ ...cue, end: cue.timeSeconds + 40 }));
  // Only the first chorus has room for a forty-second cake. The final
  // chorus must not start another one that keeps firing after the music.
  assert.ok(ordinaryRuns.length >= 1);
  for (const run of ordinaryRuns) {
    const profile = profiles.get(run.productId)[run.emphasis];
    assert.ok(run.timeSeconds + profile.lastImpactOffsetSeconds <= SONG);
  }
  for (const run of ordinaryRuns) {
    assert.equal(
      ordinaryRuns.some(
        (other) =>
          other !== run &&
          other.tube === run.tube &&
          other.timeSeconds < run.end &&
          run.timeSeconds < other.end,
      ),
      false,
      `ordinary generation stacked two cakes on position ${run.tube}`,
    );
  }
  assert.ok(
    ordinaryRuns.every((run) => run.timeSeconds >= 16),
    'the quiet intro stays clear',
  );

  // The same products as an exact pack must all be placed, so the deliberate
  // overflow pass may stack the ones that do not fit.
  const availability = new Map(items.map((item) => [item.id, item.id.startsWith('big-') ? 1 : 0]));
  const pack = planCuesOnBeats({
    analysis,
    slots,
    products: bigCakes,
    songDuration: SONG,
    brief,
    maxTubes: 3,
    timingProfiles: profiles,
    availabilityByProductId: availability,
  });
  assert.equal(pack.cues.length, bigCakes.length, 'every cake in the pack is placed');
});

test('spreading multishots never moves a cake onto a position where another is still firing', () => {
  const spreadProducts = new Map([
    ['long', { shotCount: 20, durationSeconds: 30 }],
    ['short', { shotCount: 16, durationSeconds: 8 }],
  ]);
  const cue = (timeSeconds, tube, productId) => ({ timeSeconds, tube, productId });
  const spread = spreadMultishotPositions(
    [cue(10, 0, 'long'), cue(12, 1, 'short'), cue(20, 1, 'short'), cue(30, 1, 'short')],
    spreadProducts,
    3,
  );
  // Position 0 is busy with the long cake until 40s, so the short cakes
  // alternate between the remaining positions instead.
  assert.deepEqual(
    spread.map((entry) => entry.tube),
    [0, 1, 2, 1],
  );
});

test('a short chorus opens with its cake and beat accents instead of an empty gap', () => {
  const sections = [
    { start: 0, end: 40, label: 'intro', avg_energy: 0.3 },
    { start: 40, end: 56, label: 'verse', avg_energy: 0.5 },
    { start: 56, end: 72, label: 'pre-chorus', avg_energy: 0.6 },
    { start: 72, end: 86, label: 'chorus', avg_energy: 0.75 },
    { start: 86, end: 104, label: 'verse', avg_energy: 0.6 },
    { start: 104, end: 120, label: 'buildup', avg_energy: 0.5 },
    { start: 120, end: SONG, label: 'chorus', avg_energy: 0.85 },
  ];
  const shapedAnalysis = {
    ...analysis,
    sections,
    energy_timeline: Array.from({ length: SONG + 1 }, (_, time) => ({
      time,
      energy:
        sections.find((section) => time >= section.start && time < section.end)?.avg_energy ?? 0.85,
    })),
    key_moments: [
      { time: 84.5, type: 'climax' },
      { time: 140.5, type: 'climax' },
    ],
  };
  const items = [
    ...shells,
    cake('short-chorus-bed', { shotCount: 12, durationSeconds: 12, price: 5000 }),
    cake('long-bed', { shotCount: 60, durationSeconds: 40, price: 10000 }),
  ];
  const profiles = profilesFor(items);
  const result = planCuesOnBeats({
    analysis: shapedAnalysis,
    slots: buildCueSlots(shapedAnalysis, SONG, 3),
    products: items,
    songDuration: SONG,
    maxTubes: 3,
    timingProfiles: profiles,
    brief: {
      title: 'Beat show',
      description: 'Keep intro and verses sparse. Make choruses fuller and energetic.',
      mood_tags: [],
      show_style: 'beat_test',
    },
  });
  const hits = result.cues.flatMap((cue) =>
    profiles.get(cue.productId)[cue.emphasis].shots.map((shot) => ({
      time: cue.timeSeconds + shot.impactOffsetSeconds,
      cake: cue.productId === 'short-chorus-bed' || cue.productId === 'long-bed',
    })),
  );
  const chorus = hits
    .filter((hit) => hit.time >= 72 && hit.time < 86)
    .sort((a, b) => a.time - b.time);
  const verse = hits.filter((hit) => hit.time >= 40 && hit.time < 56);
  assert.ok(
    chorus.some((hit) => hit.cake && hit.time <= 72.51),
    'the cake opens on the first chorus beat',
  );
  assert.ok(
    chorus.length / 14 > verse.length / 16,
    'the chorus has more visible bursts per second than the verse',
  );
  const boundaries = [72, ...chorus.map((hit) => hit.time), 86];
  assert.ok(Math.max(...boundaries.slice(1).map((time, index) => time - boundaries[index])) <= 3);
  assert.ok(
    hits.every((hit) => hit.time <= SONG),
    'no cake keeps firing after the music',
  );
});
