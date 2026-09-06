import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return nextResolve('data:text/javascript,export {};', context);
    const unresolved = specifier.startsWith('@/')
      ? join(process.cwd(), specifier.slice(2))
      : specifier.startsWith('.') && context.parentURL?.startsWith('file:')
        ? join(dirname(fileURLToPath(context.parentURL)), specifier)
        : null;
    if (unresolved) {
      for (const candidate of [unresolved, `${unresolved}.ts`, `${unresolved}.tsx`]) {
        if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const [
  { planCuesFast },
  { planCuesOnBeats },
  { buildProductTimingProfile },
  { DEFAULT_DESIGN },
  { DEFAULT_FIREWORK_SPEC },
  { projectCatalogue, buildSystemPrompt },
] = await Promise.all([
  import('../../lib/cue-generation/fast-planner.ts'),
  import('../../lib/cue-generation/beat-sync-planner.ts'),
  import('../../lib/fireworks/timing-profile.ts'),
  import('../../lib/fireworks/design.ts'),
  import('../../lib/fireworks/spec.ts'),
  import('../../lib/cue-generation/prompt.ts'),
]);

function product(id, shotCount = 1) {
  return {
    id,
    slug: id,
    name: id,
    description: 'Gold firework',
    sortOrder: 0,
    durationSeconds: shotCount > 1 ? 10 : 1.6,
    occupancyDurationSeconds: shotCount > 1 ? 10 : 1.6,
    minPriceCents: 1000,
    heightMeters: 60,
    caliber: '30mm',
    shotCount,
    spec: { ...DEFAULT_FIREWORK_SPEC, color: '#ffd166' },
    rawSpec: null,
    renderDesign: DEFAULT_DESIGN,
    baseEffect: null,
    variant: null,
  };
}

const products = [product('direct'), product('a-unmatched', 4), product('z-matched', 4)];
const brief = {
  id: 'show',
  title: 'Show',
  description: '',
  mood_tags: [],
  show_style: 'signature',
};
const slots = [4, 16, 28, 40, 52].map((time, index) => ({
  time,
  index,
  tube: 0,
  intensity: 0.8,
  sectionLabel: ['Verse', 'Chorus', 'Climax', 'Build', 'Finale'][index],
  vibe: ['verse', 'chorus', 'chorus', 'buildup', 'outro'][index],
  nearClimax: index === 2,
  isDownbeat: true,
  barPosition: 0,
  emphasis: index === 2 || index === 4 ? 'peak' : 'normal',
  finale: index === 4,
}));
const analysis = {
  tempo_bpm: 120,
  beat_times: Array.from({ length: 121 }, (_, index) => index * 0.5),
};
const timingProfiles = new Map(
  products.map((item) => {
    const interval = item.id === 'z-matched' ? 0.5 : 0.73;
    const children =
      item.shotCount > 1
        ? Array.from({ length: 4 }, (_, index) => ({
            firework: product(`child-${index}`),
            timeOffsetSeconds: index * interval,
          }))
        : undefined;
    return [
      item.id,
      Object.fromEntries(
        ['normal', 'accent', 'peak'].map((emphasis) => [
          emphasis,
          buildProductTimingProfile({ product: item, emphasis, children }),
        ]),
      ),
    ];
  }),
);
const common = {
  brief,
  analysis,
  slots,
  products,
  songDuration: 60,
  maxTubes: 1,
  availabilityByProductId: new Map(products.map(({ id }) => [id, 1])),
};

for (const [name, planner] of [
  ['fast', planCuesFast],
  ['beat', planCuesOnBeats],
]) {
  test(`${name} chooses a cadence-matched cake at the climax and preserves exact final inventory`, (t) => {
    const before = planner(common);
    const after = planner({ ...common, timingProfiles });
    assert.equal(after.cues.find((cue) => cue.impactTimeSeconds === 28)?.productId, 'z-matched');
    assert.deepEqual(
      after.cues.map((cue) => cue.productId).sort(),
      products.map(({ id }) => id).sort(),
    );
    assert.equal(after.cues.find((cue) => cue.impactTimeSeconds === 52)?.productId, 'direct');
    assert.deepEqual(after, planner({ ...common, timingProfiles }));
    const compact = (plan) =>
      plan.cues.map(({ productId, impactTimeSeconds }) => ({ productId, impactTimeSeconds }));
    t.diagnostic(JSON.stringify({ before: compact(before), after: compact(after) }));
  });

  test(`${name} retains legacy behaviour when all timing profiles are unknown`, () => {
    const unknown = new Map(
      [...timingProfiles].map(([id, profiles]) => [
        id,
        Object.fromEntries(
          Object.entries(profiles).map(([emphasis, profile]) => [
            emphasis,
            { ...profile, completeness: 'unknown' },
          ]),
        ),
      ]),
    );
    assert.deepEqual(planner({ ...common, timingProfiles: unknown }), planner(common));
  });

  test(`${name} keeps repeated quantities exact and ordinary generation schedulable`, () => {
    const ledger = new Map([
      ['direct', 2],
      ['a-unmatched', 1],
      ['z-matched', 1],
    ]);
    const exact = planner({ ...common, timingProfiles, availabilityByProductId: ledger });
    for (const [id, quantity] of ledger) {
      assert.equal(exact.cues.filter((cue) => cue.productId === id).length, quantity);
    }
    const ordinary = planner({ ...common, timingProfiles, availabilityByProductId: null });
    assert.ok(ordinary.cues.length > 0);
    assert.ok(ordinary.cues.every((cue) => products.some(({ id }) => cue.productId === id)));
    for (const plan of [exact, ordinary]) {
      for (let index = 1; index < plan.cues.length; index += 1) {
        assert.ok(plan.cues[index].timeSeconds >= plan.cues[index - 1].timeSeconds);
      }
    }
  });
}

test('LLM catalogue includes compact deterministic estimates even with custom field selection', () => {
  const projected = projectCatalogue(products, ['name'], timingProfiles);
  assert.equal(projected[2].timing.intervals.medianSeconds, 0.5);
  assert.equal(projected[2].timing.source, 'renderer_estimate');
  assert.equal(projected[2].timing.referenceEmphasis, 'normal');
  assert.equal(projected[2].timing.shots, undefined);
  assert.equal(projectCatalogue(products, ['name'])[2].timing, undefined);
  assert.match(buildSystemPrompt({ systemPromptText: 'Custom' }), /never invent child offsets/);
});

test('the existing beat planner repairs a weak fast plan without changing the physical pack', async (t) => {
  const [
    { selectChoreographyCandidate },
    { evaluateFinalChoreography },
    { evaluateMusicSync },
    { requireExactProductQuantityLedger },
  ] = await Promise.all([
    import('../../lib/cue-generation/choreography-repair.ts'),
    import('../../lib/cue-generation/quality.ts'),
    import('../../lib/cue-generation/music-sync-quality.ts'),
    import('../../lib/assortments/constraints.ts'),
  ]);
  const initial = planCuesFast({ ...common, timingProfiles });
  const result = selectChoreographyCandidate({
    initialCues: initial.cues,
    initialPlanner: 'fast',
    createRepair: () => planCuesOnBeats({ ...common, timingProfiles }).cues,
    inspect: (candidate) => {
      const cues = requireExactProductQuantityLedger(
        candidate,
        common.availabilityByProductId,
        'test',
      );
      return {
        cues,
        quality: evaluateFinalChoreography({
          cues,
          slots,
          maxTubes: 1,
          sparse: false,
          promptViolations: [],
          musicSync: evaluateMusicSync({ cues, slots, analysis, timingProfiles }),
          activityWindows: cues.flatMap((cue) =>
            timingProfiles.get(cue.productId)[cue.emphasis].shots.map((shot) => ({
              start: cue.timeSeconds + shot.impactOffsetSeconds,
              end: cue.timeSeconds + shot.endOffsetSeconds,
            })),
          ),
        }),
      };
    },
  });
  assert.equal(result.report.repairAttempted, true);
  assert.equal(result.report.repairApplied, true);
  assert.ok(result.report.repairScore > result.report.initialScore);
  assert.equal(
    result.selected.cues.find((cue) => cue.impactTimeSeconds === 52).productId,
    'direct',
  );
  assert.deepEqual(
    result.selected.cues.map((cue) => cue.productId).sort(),
    products.map(({ id }) => id).sort(),
  );
  t.diagnostic(JSON.stringify(result.report));
});
