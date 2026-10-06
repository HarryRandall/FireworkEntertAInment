/** Behaviour of section-plan generation on a real analysed song. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
  plan,
  { realiseShowPlan },
  { evaluateShowMetrics },
  { parseCreativeDirection },
  { parsePromptConstraints, productColourFamilies },
  { buildProductTimingProfile },
  { scheduleProductForCueSlot },
  { buildSystemPrompt, productAliases },
  { DEFAULT_DESIGN },
  { DEFAULT_FIREWORK_SPEC },
] = await Promise.all([
  import('../../lib/cue-generation/show-plan.ts'),
  import('../../lib/cue-generation/plan-realiser.ts'),
  import('../../lib/cue-generation/show-metrics.ts'),
  import('../../lib/cue-generation/creative-direction.ts'),
  import('../../lib/cue-generation/prompt-constraints.ts'),
  import('../../lib/fireworks/timing-profile.ts'),
  import('../../lib/cue-generation/impact-timing.ts'),
  import('../../lib/cue-generation/prompt.ts'),
  import('@showcrafter/renderer').then(({ effectTemplates }) => ({
    DEFAULT_DESIGN: effectTemplates.find((entry) => entry.key === 'peony').design,
  })),
  import('@showcrafter/fireworks/spec'),
]);

// Contrapunctus No 2 by CHASMA (CC BY 3.0), analysed with schema 1.4.0.
const analysis = JSON.parse(
  readFileSync(join(root, 'tests/generation/fixtures/analysis-jamendo-1930003.json'), 'utf8'),
);
const songDuration = analysis.duration_seconds;

const COLOURS = {
  red: '#e63946',
  green: '#2a9d8f',
  blue: '#1d4ed8',
  purple: '#7c3aed',
  gold: '#ffd166',
  white: '#ffffff',
};
const EFFECTS = ['crackle', 'strobe', 'ring', 'crossette', 'willow', 'glitter', 'horsetail', null];

function product(id, { colour, calibre, effect = null, shotCount = 1 }) {
  const spec = { ...DEFAULT_FIREWORK_SPEC, color: COLOURS[colour] };
  if (effect === 'glitter') spec.glitter = 'gold';
  else if (effect && effect !== 'willow') spec[effect] = true;
  return {
    id,
    slug: id,
    name: `${colour} ${calibre}mm ${effect ?? 'peony'}`,
    description: effect === 'willow' ? 'Gold willow' : 'Aerial shell',
    sortOrder: 0,
    durationSeconds: 1.6,
    occupancyDurationSeconds: 1.6,
    minPriceCents: 1000,
    heightMeters: 20 + calibre / 2,
    caliber: `${calibre}mm`,
    shotCount,
    manufacturer: 'Test',
    previewImagePath: null,
    previewImageRevision: null,
    hasLaunchPositionOverrides: false,
    launchPositionOverrideIndices: [],
    spec,
    rawSpec: null,
    renderDesign: null,
    design: DEFAULT_DESIGN,
    kind: DEFAULT_DESIGN.kind,
    baseEffect: null,
    variant: null,
  };
}

const products = Object.keys(COLOURS).flatMap((colour, c) =>
  [30, 50, 75, 100].map((calibre, i) =>
    product(`${colour}-${calibre}`, { colour, calibre, effect: EFFECTS[(c + i) % EFFECTS.length] }),
  ),
);
const profiles = (items) =>
  new Map(
    items.map((item) => [
      item.id,
      Object.fromEntries(
        ['normal', 'accent', 'peak'].map((emphasis) => [
          emphasis,
          buildProductTimingProfile({ product: item, emphasis }),
        ]),
      ),
    ]),
  );
const timingProfiles = profiles(products);

function generate({ brief = '', style = 'signature', maxTubes = 3, input = analysis } = {}) {
  const direction = parseCreativeDirection(brief, style);
  const constraints = parsePromptConstraints(brief);
  const sections = plan.buildPlanSections(input, songDuration);
  const palette = plan.describeCataloguePalette(products);
  const showPlan = plan.buildDefaultShowPlan({ sections, direction, constraints, palette });
  const realised = realiseShowPlan({
    plan: showPlan,
    sections,
    analysis: input,
    songDuration,
    products,
    timingProfiles,
    maxTubes,
    constraints,
  });
  const finaleIndex = showPlan.sections.findIndex((section) => section.role === 'finale');
  const metrics = evaluateShowMetrics({
    cues: realised.cues,
    analysis: input,
    songDuration,
    finaleStartSeconds: finaleIndex >= 0 ? sections[finaleIndex].start : null,
    timingProfiles,
  });
  return { sections, showPlan, realised, metrics };
}

test('sections cover the whole song and rank their energy', () => {
  const sections = plan.buildPlanSections(analysis, songDuration);
  assert.ok(sections.length >= 6);
  assert.equal(sections[0].start, 0);
  assert.equal(sections.at(-1).end, songDuration);
  for (let i = 1; i < sections.length; i += 1) {
    assert.equal(sections[i].start, sections[i - 1].end);
  }
  assert.ok(sections.some((section) => section.energyRank === 0));
  assert.ok(sections.some((section) => section.energyRank === 1));
});

test('the default plan has real lulls, repeated palettes and a closing finale', () => {
  const { sections, showPlan } = generate();
  const roles = showPlan.sections.map((section) => section.role);
  assert.ok(roles.filter((role) => role === 'lull').length >= 2, roles.join(','));
  assert.equal(roles.at(-1), 'finale');
  const finaleDensity = Math.max(
    ...showPlan.sections.filter((s) => s.role === 'finale').map((s) => s.density),
  );
  assert.ok(showPlan.sections.every((section) => section.density <= finaleDensity));
  // Returning choruses in the same role reuse their palette.
  const choruses = sections
    .map((section, index) => ({ section, direction: showPlan.sections[index] }))
    .filter(({ section, direction }) => section.label === 'chorus' && direction.role === 'peak');
  assert.ok(choruses.length >= 2);
  for (const { direction } of choruses) {
    assert.deepEqual(direction.palette, choruses[0].direction.palette);
  }
});

test('realised shows follow the music, vary products and build to the finale', () => {
  const { realised, metrics } = generate();
  assert.ok(metrics.cueCount >= 150 && metrics.cueCount <= 320, `${metrics.cueCount} cues`);
  assert.ok(metrics.dynamicRange >= 3, `dynamic range ${metrics.dynamicRange}`);
  assert.ok(metrics.finaleRateRatio >= 1.5, `finale ratio ${metrics.finaleRateRatio}`);
  assert.ok(metrics.energyCorrelation >= 0.45, `energy correlation ${metrics.energyCorrelation}`);
  assert.ok(metrics.maxProductShare <= 0.15, `max share ${metrics.maxProductShare}`);
  assert.ok(metrics.distinctProducts >= 16);
  assert.equal(metrics.syncErrorP95Ms, 0);
  // The final analysed beat is a full-width hit.
  const lastBeat = analysis.beat_times.at(-1);
  const finalHit = realised.cues.filter(
    (cue) => Math.abs(cue.impactTimeSeconds - lastBeat) < 0.002,
  );
  assert.equal(finalHit.length, 3);
});

test('every burst lands on the beat grid and each position keeps its ignition interval', () => {
  const { realised } = generate({ brief: 'relentless high energy' });
  const beats = analysis.beat_times;
  const onGrid = (time) =>
    beats.some((beat, i) => {
      if (Math.abs(beat - time) < 0.002) return true;
      const next = beats[i + 1];
      return next != null && Math.abs((beat + next) / 2 - time) < 0.002;
    });
  for (const cue of realised.cues) {
    assert.ok(onGrid(cue.impactTimeSeconds), `off-grid impact ${cue.impactTimeSeconds}`);
    assert.ok(cue.timeSeconds >= 0);
  }
  for (const tube of [0, 1, 2]) {
    const launches = realised.cues
      .filter((cue) => cue.tube === tube)
      .map((cue) => cue.timeSeconds)
      .sort((a, b) => a - b);
    for (let i = 1; i < launches.length; i += 1) {
      assert.ok(launches[i] - launches[i - 1] >= 0.5 - 1e-9, `tube ${tube} at ${launches[i]}`);
    }
  }
});

test('style and brief density change the show without breaking its shape', () => {
  const balanced = generate().metrics;
  const minimal = generate({ brief: 'minimalist and restrained', style: 'minimalist' }).metrics;
  const dense = generate({ brief: 'relentless high energy' }).metrics;
  assert.ok(minimal.cueCount < balanced.cueCount * 0.8);
  assert.ok(dense.cueCount > balanced.cueCount * 1.2);
  assert.ok(minimal.finaleRateRatio > 1.5);
});

test('narrow sites fire from their only position and requested colours always appear', () => {
  const { realised } = generate({ maxTubes: 1, brief: 'purple highlights' });
  assert.ok(realised.cues.length > 0);
  assert.ok(realised.cues.every((cue) => cue.tube === 0));
  const used = realised.cues.map((cue) => products.find((item) => item.id === cue.productId));
  assert.ok(used.some((item) => productColourFamilies(item).has('purple')));
});

test('without analysis the show still has shape and a final hit', () => {
  const { realised, metrics } = generate({ input: null });
  assert.ok(realised.cues.length > 40);
  assert.ok(metrics.finaleRateRatio > 1);
});

test('model plans are merged safely with the default', () => {
  const sections = plan.buildPlanSections(analysis, songDuration);
  const palette = plan.describeCataloguePalette(products);
  const constraints = parsePromptConstraints('must include gold');
  const fallback = plan.buildDefaultShowPlan({
    sections,
    direction: parseCreativeDirection('', 'signature'),
    constraints,
    palette,
  });
  const { idByAlias } = productAliases(products);
  const resolved = plan.resolveShowPlan({
    llmPlan: plan.LlmShowPlanSchema.parse({
      narrative: 'A slow burn.',
      sections: [
        {
          s: 0,
          role: 'lull',
          density: 0,
          palette: ['Blue', 'turquoise'],
          effects: ['willow', 'lasers'],
          motif: 'chase',
          heroes: ['p2', 'p999'],
        },
      ],
    }),
    fallback,
    aliases: idByAlias,
    palette,
    constraints,
  });
  assert.equal(resolved.source, 'llm');
  assert.equal(resolved.narrative, 'A slow burn.');
  assert.equal(resolved.sections[0].role, 'lull');
  assert.deepEqual(resolved.sections[0].palette, ['gold', 'blue']);
  assert.deepEqual(resolved.sections[0].effects, ['willow']);
  assert.deepEqual(resolved.sections[0].heroProductIds, [products[1].id]);
  assert.deepEqual(resolved.sections[1], fallback.sections[1]);
});

test('multishots launch early so their first burst lands on the target', () => {
  const cake = product('cake', { colour: 'gold', calibre: 30, shotCount: 3 });
  const children = [0, 0.4, 0.8].map((timeOffsetSeconds) => ({
    firework: products[0],
    timeOffsetSeconds,
  }));
  const profile = buildProductTimingProfile({ product: cake, emphasis: 'normal', children });
  assert.equal(profile.completeness, 'complete');
  const timing = scheduleProductForCueSlot({
    product: cake,
    emphasis: 'normal',
    targetTimeSeconds: 10,
    timingProfile: profile,
  });
  assert.ok(profile.firstImpactOffsetSeconds > 0.5);
  assert.equal(
    timing.launchTimeSeconds,
    Number((10 - profile.firstImpactOffsetSeconds).toFixed(3)),
  );
  // Without a resolved profile the sequence can only start on the target.
  assert.equal(
    scheduleProductForCueSlot({ product: cake, emphasis: 'normal', targetTimeSeconds: 10 })
      .launchTimeSeconds,
    10,
  );
});

test('saved prompts shape the voice but never replace the output contract', () => {
  const custom = buildSystemPrompt({ systemPromptText: 'Favour gold everywhere.' });
  assert.equal(custom.ignoredLegacyPrompt, false);
  assert.match(custom.prompt, /^Favour gold everywhere\./);
  assert.match(custom.prompt, /Output contract[\s\S]*$/);
  const legacy = buildSystemPrompt({ systemPromptText: 'Return { cues: [{ slotIndex }] }' });
  assert.equal(legacy.ignoredLegacyPrompt, true);
  assert.doesNotMatch(legacy.prompt, /slotIndex/);
});

test('the renderer-based generated timeline matches its deterministic summary snapshot', () => {
  const { realised, metrics, showPlan } = generate();
  const cueSummary = (cue) => ({
    productId: cue.productId,
    launchSeconds: cue.timeSeconds,
    impactSeconds: cue.impactTimeSeconds,
    tube: cue.tube,
    emphasis: cue.emphasis,
  });
  const snapshot = {
    cueCount: metrics.cueCount,
    distinctProducts: metrics.distinctProducts,
    syncErrorP95Ms: metrics.syncErrorP95Ms,
    roles: showPlan.sections.map((section) => section.role),
    opening: realised.cues.slice(0, 8).map(cueSummary),
    finale: realised.cues.slice(-8).map(cueSummary),
  };
  const path = join(root, 'tests/generation/fixtures/show-plan-renderer-v1.json');
  if (process.env.UPDATE_SHOW_GENERATION_SNAPSHOTS === '1')
    writeFileSync(path, JSON.stringify(snapshot, null, 2) + '\n');
  assert.deepEqual(snapshot, JSON.parse(readFileSync(path, 'utf8')));
});
