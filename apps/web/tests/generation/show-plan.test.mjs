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
  { evaluateMusicSync },
  { evaluateShowMetrics },
  { parseCreativeDirection },
  { parsePromptConstraints, productColourFamilies, productEffectFamilies },
  { buildProductTimingProfile },
  { scheduleProductForCueSlot },
  { buildSystemPrompt, productAliases },
  { DEFAULT_DESIGN },
  { DEFAULT_FIREWORK_SPEC },
] = await Promise.all([
  import('../../lib/cue-generation/show-plan.ts'),
  import('../../lib/cue-generation/plan-realiser.ts'),
  import('../../lib/cue-generation/music-sync-quality.ts'),
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

let printedEvaluation = false;

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
  if (
    process.env.EVALUATE_SHOW_GENERATION === '1' &&
    brief === '' &&
    input === analysis &&
    !printedEvaluation
  ) {
    printedEvaluation = true;
    console.log(
      JSON.stringify({
        ...metrics,
        syncScore: evaluateMusicSync({
          cues: realised.cues,
          slots: realised.slots,
          analysis: input,
          timingProfiles,
        }).score,
        sectionCount: sections.length,
        positionUsage: [0, 1, 2].map(
          (tube) => realised.cues.filter((cue) => cue.tube === tube).length,
        ),
        cuesPerSection: sections.map(
          (section) =>
            realised.cues.filter(
              (cue) =>
                cue.impactTimeSeconds >= section.start && cue.impactTimeSeconds < section.end,
            ).length,
        ),
      }),
    );
  }
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

test('fragmented legacy analyses become full musical phrases without moving peaks', () => {
  const duration = 346.88;
  const fragmented = {
    ...analysis,
    sections: Array.from({ length: 51 }, (_, index) => ({
      start: (index * duration) / 51,
      end: ((index + 1) * duration) / 51,
      label: index < 5 ? 'intro' : index > 46 ? 'outro' : index % 12 < 6 ? 'verse' : 'chorus',
      avg_energy: index % 12 < 6 ? 0.3 : 0.8,
    })),
    key_moments: [50, 120, 190, 240, 290, 330].map((time) => ({ time, type: 'climax' })),
  };
  const sections = plan.buildPlanSections(fragmented, duration);
  if (process.env.EVALUATE_SHOW_GENERATION === '1')
    console.log(
      JSON.stringify({
        fixture: '51 fragmented sections',
        rawSections: 51,
        planSections: sections.length,
      }),
    );
  assert.ok(sections.length >= 8 && sections.length <= 15);
  for (const [index, section] of sections.entries()) {
    if (index !== 0 && index !== sections.length - 1) assert.ok(section.end - section.start >= 16);
    assert.equal(
      section.containsClimax,
      fragmented.key_moments.some((peak) => peak.time >= section.start && peak.time < section.end),
    );
  }
  assert.equal(sections.at(-1).end, duration);
});

test('all motifs use every available position over a section', () => {
  for (const maxTubes of [1, 2, 3]) {
    for (const motif of plan.MOTIFS) {
      const section = {
        index: 0,
        start: 0,
        end: songDuration,
        label: 'verse',
        vibe: 'verse',
        energy: 0.5,
        energyRank: 0.5,
        containsClimax: false,
        inFinaleWindow: false,
      };
      const realised = realiseShowPlan({
        plan: {
          source: 'default',
          narrative: '',
          sections: [
            { role: 'body', density: 1, palette: [], effects: [], motif, heroProductIds: [] },
          ],
        },
        sections: [section],
        analysis,
        songDuration,
        products,
        timingProfiles,
        maxTubes,
        constraints: parsePromptConstraints(''),
      });
      assert.equal(new Set(realised.cues.map((cue) => cue.tube)).size, maxTubes, motif);
    }
  }
});

test('named products and exclusive families override variety defaults', () => {
  const selected = products[0];
  const constraints = parsePromptConstraints(`Only ${selected.name}`, products);
  assert.equal(constraints.varietyExempt, true);
  const { sections, showPlan } = generate();
  const realised = realiseShowPlan({
    plan: showPlan,
    sections,
    analysis,
    songDuration,
    products,
    timingProfiles,
    maxTubes: 3,
    constraints,
  });
  assert.ok(realised.cues.length > 20);
  assert.ok(realised.cues.every((cue) => cue.productId === selected.id));
  const family = realiseShowPlan({
    plan: showPlan,
    sections,
    analysis,
    songDuration,
    products,
    timingProfiles,
    maxTubes: 3,
    constraints: parsePromptConstraints('Only crackle'),
  });
  assert.ok(family.cues.length > 20);
  assert.ok(
    family.cues.every((cue) =>
      products.find((item) => item.id === cue.productId).name.includes('crackle'),
    ),
  );
});

test('realiser honours a finite budget and ends impacts with the song', () => {
  const { sections, showPlan } = generate();
  const realised = realiseShowPlan({
    plan: showPlan,
    sections,
    analysis,
    songDuration,
    products,
    timingProfiles,
    maxTubes: 3,
    constraints: parsePromptConstraints(''),
    budgetCents: 100000,
  });
  assert.ok(realised.cues.length > 0);
  assert.ok(
    realised.cues.reduce(
      (sum, cue) => sum + products.find((item) => item.id === cue.productId).minPriceCents,
      0,
    ) <= 100000,
  );
  assert.ok(
    realised.cues.every(
      (cue) => cue.impactTimeSeconds <= songDuration && cue.timeSeconds <= songDuration,
    ),
  );
});

test('declared length follows the analysed music rather than an estimate or replay fade', async () => {
  const { generationDurationSeconds, declaredShowLengthSeconds } =
    await import('../../lib/cue-generation/show-duration.ts');
  const duration = Math.round(generationDurationSeconds(346.88, 380));
  assert.equal(duration, 347);
  assert.equal(declaredShowLengthSeconds(duration, 380), 347);
  assert.equal(generationDurationSeconds(null, 180), 180);
  assert.equal(generationDurationSeconds(346.88, 180, true), 180);
  assert.equal(declaredShowLengthSeconds(null, 30), 30);
});

test('near-identical palms share a soft family target rather than dominating the show', () => {
  const palms = Array.from({ length: 5 }, (_, index) => ({
    ...product(`palm-${index}`, { colour: 'gold', calibre: 50 }),
    name: `Gold palm ${index}`,
    minPriceCents: 2200,
  }));
  const cakes = ['gold', 'white', 'green'].map((colour, index) => ({
    ...product(`cake-${index}`, {
      colour,
      calibre: 30 + index * 25,
      effect: ['ring', 'crossette', 'strobe'][index],
      shotCount: 3,
    }),
    minPriceCents: 6500,
  }));
  const items = [...palms, ...cakes];
  const timing = profiles(palms);
  for (const cake of cakes) {
    timing.set(
      cake.id,
      Object.fromEntries(
        ['normal', 'accent', 'peak'].map((emphasis) => [
          emphasis,
          buildProductTimingProfile({
            product: cake,
            emphasis,
            children: [0, 60 / 129, 120 / 129].map((timeOffsetSeconds) => ({
              firework: products[0],
              timeOffsetSeconds,
            })),
          }),
        ]),
      ),
    );
  }
  const constraints = parsePromptConstraints('gold and white with emerald');
  const sections = plan.buildPlanSections(analysis, songDuration);
  const showPlan = plan.buildDefaultShowPlan({
    sections,
    direction: parseCreativeDirection('', 'signature'),
    constraints,
    palette: plan.describeCataloguePalette(items),
  });
  const realised = realiseShowPlan({
    plan: showPlan,
    sections,
    analysis,
    songDuration,
    products: items,
    timingProfiles: timing,
    maxTubes: 3,
    constraints,
    budgetCents: 1100000,
  });
  const metrics = evaluateShowMetrics({
    cues: realised.cues,
    analysis,
    songDuration,
    finaleStartSeconds: sections.at(-1).start,
    timingProfiles: timing,
  });
  const familyShare =
    realised.cues.filter((cue) =>
      productEffectFamilies(items.find((item) => item.id === cue.productId)).has('palm'),
    ).length / realised.cues.length;
  if (process.env.EVALUATE_SHOW_GENERATION === '1')
    console.log(
      JSON.stringify({
        fixture: 'five palms and three cakes',
        ...metrics,
        palmShare: Number(familyShare.toFixed(3)),
        positions: [0, 1, 2].map((tube) => realised.cues.filter((cue) => cue.tube === tube).length),
        syncScore: evaluateMusicSync({
          cues: realised.cues,
          slots: realised.slots,
          analysis,
          timingProfiles: timing,
        }).score,
      }),
    );
  assert.ok(realised.cues.length > 100);
  assert.ok(familyShare < 0.65);
  assert.equal(new Set(realised.cues.map((cue) => cue.productId)).size, items.length);
});

test('the cue ceiling preserves activity across a long dense track', () => {
  const duration = 360;
  const constraints = parsePromptConstraints('');
  const sections = plan.buildPlanSections(null, duration);
  const showPlan = plan.buildDefaultShowPlan({
    sections,
    direction: parseCreativeDirection('relentless high energy', 'signature'),
    constraints,
    palette: plan.describeCataloguePalette(products),
  });
  const realised = realiseShowPlan({
    plan: showPlan,
    sections,
    analysis: null,
    songDuration: duration,
    products,
    timingProfiles,
    maxTubes: 3,
    constraints,
  });
  assert.ok(realised.cues.length <= 500);
  assert.ok(realised.cues.length > 400);
  for (const section of sections)
    assert.ok(
      realised.cues.some(
        (cue) => cue.impactTimeSeconds >= section.start && cue.impactTimeSeconds < section.end,
      ),
    );
});

test('late multishots cannot continue bursting after the music', () => {
  const cake = product('long-cake', { colour: 'gold', calibre: 30, shotCount: 3 });
  const cakeProfiles = new Map(
    ['normal', 'accent', 'peak'].map((emphasis) => [
      emphasis,
      buildProductTimingProfile({
        product: cake,
        emphasis,
        children: [0, 10, 20].map((timeOffsetSeconds) => ({
          firework: products[0],
          timeOffsetSeconds,
        })),
      }),
    ]),
  );
  const timing = new Map(timingProfiles);
  timing.set(cake.id, Object.fromEntries(cakeProfiles));
  const { sections, showPlan } = generate();
  const realised = realiseShowPlan({
    plan: showPlan,
    sections,
    analysis,
    songDuration,
    products: [...products, cake],
    timingProfiles: timing,
    maxTubes: 3,
    constraints: parsePromptConstraints(''),
  });
  const cakes = realised.cues.filter((cue) => cue.productId === cake.id);
  assert.ok(cakes.length > 0);
  for (const cue of cakes)
    assert.ok(
      cue.timeSeconds + cakeProfiles.get(cue.emphasis).lastImpactOffsetSeconds <= songDuration,
    );
});

test('a named inclusion keeps other products available and large prompts retain variety', async () => {
  const { productMatchesPromptConstraints } =
    await import('../../lib/cue-generation/prompt-constraints.ts');
  const constraints = parsePromptConstraints(`Include ${products[0].name}`, products);
  assert.equal(constraints.exclusiveProducts, false);
  assert.equal(productMatchesPromptConstraints(products[1], constraints), true);
  const duplicates = Array.from({ length: 125 }, (_, index) => ({
    ...products[0],
    id: `duplicate-${index}`,
  }));
  const cake = product('late-cake', { colour: 'gold', calibre: 50, shotCount: 3 });
  const aliases = productAliases([...duplicates, cake]);
  assert.equal(aliases.shown.length, 120);
  assert.ok(aliases.shown.some((item) => item.id === cake.id));
});
