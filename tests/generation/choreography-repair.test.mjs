import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectChoreographyCandidate } from '../../lib/cue-generation/choreography-repair.ts';
import { evaluateFinalChoreography } from '../../lib/cue-generation/quality.ts';
import { requireExactProductQuantityLedger } from '../../lib/assortments/constraints.ts';

const slots = [2, 4, 6, 10].map((time, index) => ({
  time,
  index,
  tube: 0,
  intensity: 0.8,
  sectionLabel: index === 0 ? 'Verse' : 'Chorus',
  vibe: index === 0 ? 'verse' : 'chorus',
  isDownbeat: true,
  nearClimax: index === 1,
  barPosition: 0,
  emphasis: 'normal',
  finale: index === 3,
}));
const cue = (index) => ({
  productId: 'p',
  slotIndex: index,
  impactTimeSeconds: slots[index].time,
  tube: 0,
});
const weak = [cue(0), cue(3)];
const strong = slots.map((_, index) => cue(index));
function inspect(cues) {
  return {
    cues,
    quality: evaluateFinalChoreography({
      cues,
      slots,
      maxTubes: 1,
      sparse: false,
      promptViolations: [],
    }),
  };
}
function run(overrides = {}) {
  let attempts = 0;
  const result = selectChoreographyCandidate({
    initialCues: weak,
    initialPlanner: 'llm',
    inspect,
    createRepair: () => {
      attempts += 1;
      return strong;
    },
    ...overrides,
  });
  return { ...result, attempts };
}

test('weak LLM output invokes one repair and a stronger valid candidate replaces it', (t) => {
  const result = run();
  assert.equal(result.attempts, 1);
  assert.equal(result.report.repairApplied, true);
  assert.ok(result.report.repairScore > result.report.initialScore);
  assert.deepEqual(result.selected.cues, strong);
  t.diagnostic(JSON.stringify(result.report));
});

test('a strong initial result does not invoke the repair planner', () => {
  const result = run({ initialCues: strong });
  assert.equal(result.attempts, 0);
  assert.equal(result.report.repairAttempted, false);
});

test('worse, tied and throwing repairs preserve the original valid candidate', () => {
  for (const createRepair of [
    () => [cue(3)],
    () => weak,
    () => {
      throw Error('planner failed');
    },
  ]) {
    const result = run({ createRepair });
    assert.equal(result.report.repairAttempted, true);
    assert.equal(result.report.repairApplied, false);
    assert.deepEqual(result.selected.cues, weak);
  }
});

test('exact QR ledger does not bypass soft-warning repair and cannot be weakened by a higher score', () => {
  const ledger = new Map([['p', 2]]);
  const exactInspect = (cues) => inspect(requireExactProductQuantityLedger(cues, ledger, 'test'));
  const result = run({ inspect: exactInspect });
  assert.equal(result.report.repairAttempted, true);
  assert.equal(result.report.repairFailure, 'constraint_validation_failed');
  assert.deepEqual(result.selected.cues, weak);
  assert.equal(result.selected.cues.length, 2);
});

test('hard final-hit and prompt failures cannot win on comparison score', () => {
  for (const promptViolations of [[], [{ kind: 'missing_colour', value: 'gold' }]]) {
    const result = run({
      createRepair: () => strong.slice(0, 3),
      inspect: (cues) => ({
        cues,
        quality: evaluateFinalChoreography({
          cues,
          slots,
          maxTubes: 1,
          sparse: false,
          promptViolations: cues.length === 3 ? promptViolations : [],
        }),
      }),
    });
    assert.equal(result.report.repairApplied, false);
    assert.ok(result.report.repairIssues.includes('missing_final_hit'));
  }
});

test('a repair with the final hit but a hard prompt violation is rejected', () => {
  const result = run({
    inspect: (cues) => ({
      cues,
      quality: evaluateFinalChoreography({
        cues,
        slots,
        maxTubes: 1,
        sparse: false,
        promptViolations: cues.length === 4 ? [{ kind: 'missing_colour', value: 'gold' }] : [],
      }),
    }),
  });
  assert.ok(result.report.repairScore > result.report.initialScore);
  assert.deepEqual(result.report.repairIssues, ['prompt_constraint']);
  assert.equal(result.report.repairApplied, false);
});

test('an unknown repair product cannot satisfy an exact ledger', () => {
  const result = run({
    createRepair: () => [{ ...cue(1), productId: 'unknown' }, cue(3)],
    inspect: (cues) =>
      inspect(requireExactProductQuantityLedger(cues, new Map([['p', 2]]), 'test')),
  });
  assert.equal(result.report.repairFailure, 'constraint_validation_failed');
  assert.deepEqual(result.selected.cues, weak);
});

test('an invalid initial candidate can be rescued, and no valid candidates gives an explicit null result', () => {
  const rescued = run({ initialCues: [cue(0)] });
  assert.equal(rescued.report.repairApplied, true);
  const failed = run({ initialCues: [cue(0)], createRepair: () => [cue(1)] });
  assert.equal(failed.selected, null);
  assert.equal(failed.report.initialFailure, 'hard_quality_issue');
  assert.equal(failed.report.repairFailure, 'hard_quality_issue');
});

test('an actual beat result never recursively invokes the same deterministic repair', () => {
  const result = run({ initialPlanner: 'beat' });
  assert.equal(result.attempts, 0);
  assert.equal(result.report.repairAttempted, false);
});

test('timing evidence triggers repair even when structural issues are empty', () => {
  const result = run({
    initialCues: strong,
    inspect: (cues) => {
      const checked = inspect(cues);
      return {
        ...checked,
        quality: {
          ...checked.quality,
          musicSync: {
            score: 60,
            anchorAccuracy: 0.5,
            cadenceScore: null,
            assessedCueCount: 4,
            totalCueCount: 4,
          },
        },
      };
    },
  });
  assert.equal(result.attempts, 1);
});

test('candidate validation cannot mutate the saved initial cues', () => {
  const original = structuredClone(weak);
  run({
    inspect: (cues) => {
      cues[0].productId = 'changed';
      return inspect(cues);
    },
  });
  assert.deepEqual(weak, original);
});

test('known effect windows prevent a sustained effect from becoming a false long-gap warning', () => {
  const longSlots = [slots[0], { ...slots[3], time: 30 }];
  const cues = [cue(0), { ...cue(3), impactTimeSeconds: 30 }];
  const base = { cues, slots: longSlots, maxTubes: 1, sparse: false, promptViolations: [] };
  assert.ok(evaluateFinalChoreography(base).issues.some((issue) => issue.kind === 'long_gap'));
  const score = evaluateFinalChoreography({
    ...base,
    activityWindows: [
      { start: 2, end: 29 },
      { start: 30, end: 32 },
    ],
  });
  assert.equal(score.maximumGapSeconds, 1);
  assert.ok(!score.issues.some((issue) => issue.kind === 'long_gap'));
});
