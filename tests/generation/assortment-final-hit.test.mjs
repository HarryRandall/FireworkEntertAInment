import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

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
        `${unresolvedPath}.tsx`,
        join(unresolvedPath, 'index.ts'),
      ]) {
        if (existsSync(candidate)) {
          return nextResolve(pathToFileURL(candidate).href, context);
        }
      }
    }

    return nextResolve(specifier, context);
  },
});

const [
  { buildBeatMoments },
  { planCuesOnBeats },
  { planCuesFast },
  { evaluateFinalChoreography },
  { DEFAULT_DESIGN },
  { DEFAULT_FIREWORK_SPEC },
] = await Promise.all([
  import('../../lib/cue-generation/beat-sync-moments.ts'),
  import('../../lib/cue-generation/beat-sync-planner.ts'),
  import('../../lib/cue-generation/fast-planner.ts'),
  import('../../lib/cue-generation/quality.ts'),
  import('../../lib/fireworks/design.ts'),
  import('../../lib/fireworks/spec.ts'),
]);

const brief = {
  assortment_id: 'assortment',
  creation_source: 'assortment_qr',
  id: 'show',
  slug: 'show',
  title: 'Exact assortment show',
  description: 'Build to a strong final hit.',
  duration_seconds: 122,
  budget_cents: null,
  time_of_day: null,
  location: null,
  mood_tags: [],
  music_analysis_id: null,
  show_style: 'signature',
  site_width_feet: 80,
  selected_cue_model: null,
  firework_types: null,
};

function product(id, { shotCount = 1, durationSeconds = 1.6 } = {}) {
  return {
    id,
    slug: id,
    name: id,
    description: 'Gold firework',
    sortOrder: 0,
    durationSeconds,
    occupancyDurationSeconds: durationSeconds,
    minPriceCents: 1000,
    heightMeters: 60,
    caliber: '30mm',
    shotCount,
    manufacturer: 'Test',
    previewImagePath: null,
    previewImageRevision: null,
    hasLaunchPositionOverrides: false,
    launchPositionOverrideIndices: [],
    spec: { ...DEFAULT_FIREWORK_SPEC, color: '#ffd166' },
    rawSpec: null,
    renderDesign: DEFAULT_DESIGN,
    baseEffect: null,
    variant: null,
  };
}

function slotsAt(time, indexStart, overrides = {}) {
  return [0, 1, 2].map((tube) => ({
    index: indexStart + tube,
    time,
    tube,
    intensity: 0.9,
    sectionLabel: overrides.finale ? 'Finale' : 'Chorus',
    vibe: 'chorus',
    nearClimax: false,
    isDownbeat: true,
    barPosition: 0,
    emphasis: overrides.finale ? 'peak' : 'accent',
    finale: false,
    ...overrides,
  }));
}

function sevenItemPack() {
  return [
    product('direct-shell'),
    ...Array.from({ length: 6 }, (_, index) =>
      product(`cake-${index + 1}`, { shotCount: 20, durationSeconds: 30 + index * 0.2 }),
    ),
  ];
}

function sevenItemSlots() {
  return [
    ...slotsAt(70, 0, { nearClimax: true, emphasis: 'peak' }),
    ...slotsAt(76, 3, { finale: true }),
    ...slotsAt(82, 6, { finale: true }),
    ...slotsAt(88, 9, { finale: true }),
    ...slotsAt(94, 12, { finale: true }),
    ...slotsAt(100, 15, { finale: true }),
    ...slotsAt(116.68, 18, { finale: true }),
  ];
}

function assertExactFinale(result, products) {
  assert.equal(result.cues.length, products.length);
  assert.deepEqual(
    [...new Set(result.cues.map((cue) => cue.productId))].sort(),
    products.map((item) => item.id).sort(),
  );
  const finalCues = result.cues.filter((cue) => Math.abs(cue.impactTimeSeconds - 116.68) <= 0.001);
  assert.equal(finalCues.length, 1);
  assert.equal(finalCues[0].productId, 'direct-shell');
  assert.equal(finalCues[0].tube, 1);
  const quality = evaluateFinalChoreography({
    cues: result.cues,
    slots: sevenItemSlots(),
    promptViolations: [],
    maxTubes: 3,
    sparse: false,
  });
  assert.equal(
    quality.issues.some((issue) => issue.kind === 'missing_final_hit'),
    false,
  );
}

test('fast planner reserves the direct firework for the final beat of an exact pack', () => {
  const products = sevenItemPack();
  const availabilityByProductId = new Map(products.map((item) => [item.id, 1]));
  const result = planCuesFast({
    brief,
    analysis: null,
    slots: sevenItemSlots(),
    products,
    songDuration: 122,
    availabilityByProductId,
  });

  assertExactFinale(result, products);
});

test('beat planner reserves the direct firework for the final beat of an exact pack', () => {
  const products = sevenItemPack();
  const availabilityByProductId = new Map(products.map((item) => [item.id, 1]));
  const result = planCuesOnBeats({
    analysis: null,
    slots: sevenItemSlots(),
    products,
    songDuration: 122,
    brief,
    maxTubes: 3,
    availabilityByProductId,
  });

  assertExactFinale(result, products);
});

test('beat planner keeps exact quantities when the remaining pack cannot fill a group', () => {
  const products = [product('direct')];
  const availabilityByProductId = new Map([['direct', 2]]);
  const slots = [
    ...slotsAt(10, 0, { nearClimax: true, emphasis: 'peak' }),
    ...slotsAt(20, 3, { finale: true }),
  ];
  const result = planCuesOnBeats({
    analysis: null,
    slots,
    products,
    songDuration: 22,
    brief,
    maxTubes: 3,
    availabilityByProductId,
  });

  assert.equal(result.cues.length, 2);
  assert.equal(
    result.cues.every((cue) => cue.productId === 'direct'),
    true,
  );
  assert.equal(
    result.cues.some((cue) => cue.impactTimeSeconds === 20),
    true,
  );
});

test('beat planner retains all available positions after reserving the final hit', () => {
  const products = [product('direct-a'), product('direct-b'), product('direct-c')];
  const availabilityByProductId = new Map(products.map((item) => [item.id, 1]));
  const slots = slotsAt(20, 0, { finale: true });
  const result = planCuesOnBeats({
    analysis: null,
    slots,
    products,
    songDuration: 22,
    brief,
    maxTubes: 3,
    availabilityByProductId,
  });

  assert.equal(result.cues.length, 3);
  assert.deepEqual(result.cues.map((cue) => cue.tube).sort(), [0, 1, 2]);
  assert.equal(
    result.cues.every((cue) => cue.impactTimeSeconds === 20),
    true,
  );
});

test('soft-ending filtering keeps the final musical hit even when it is not a downbeat', () => {
  const slots = [
    ...slotsAt(10, 0),
    {
      ...slotsAt(20, 3, { finale: true })[0],
      isDownbeat: false,
      emphasis: 'normal',
    },
  ];
  const moments = buildBeatMoments({
    slots,
    songDuration: 22,
    direction: {
      style: 'signature',
      density: 'sparse',
      precise: false,
      surprise: false,
      quietMiddle: false,
      softEnding: true,
      bigEnding: false,
    },
  });

  assert.equal(moments.at(-1)?.time, 20);
});

test('hard assortment quality failures can invoke deterministic repair', () => {
  const runner = readFileSync(join(root, 'lib/cue-generation/runner.server.ts'), 'utf8');

  assert.match(runner, /quality\.issues\.some\(\(issue\) => issue\.hard\)/);
  assert.match(runner, /if \(needsDeterministicRepair\) \{/);
  assert.match(runner, /Final cue validation after deterministic repair/);
});
