import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateFinalChoreography } from '../../lib/cue-generation/quality.ts';

function slot(index, time, tube, sectionLabel, vibe, extra = {}) {
  return {
    index,
    time,
    tube,
    intensity: vibe === 'chorus' ? 0.9 : 0.4,
    sectionLabel,
    vibe,
    nearClimax: false,
    isDownbeat: true,
    barPosition: 0,
    emphasis: vibe === 'chorus' ? 'peak' : 'accent',
    finale: false,
    ...extra,
  };
}

test('a final safety-filtered show scores section coverage, grouped choruses and final impact', () => {
  const slots = [
    slot(0, 4, 0, 'Verse 1', 'verse'),
    slot(1, 8, 0, 'Chorus 1', 'chorus'),
    slot(2, 8, 1, 'Chorus 1', 'chorus'),
    slot(3, 12, 0, 'Chorus 1', 'chorus', { finale: true }),
    slot(4, 12, 1, 'Chorus 1', 'chorus', { finale: true }),
  ];
  const cues = slots.map((item) => ({
    impactTimeSeconds: item.time,
    productId: item.index % 2 === 0 ? 'blue' : 'gold',
    slotIndex: item.index,
    tube: item.tube,
  }));

  const score = evaluateFinalChoreography({
    cues,
    slots,
    promptViolations: [],
    maxTubes: 2,
    sparse: false,
  });

  assert.deepEqual(score.issues, []);
  assert.equal(score.sectionCoverageRatio, 1);
  assert.equal(score.coordinatedStrongMomentRatio, 1);
  assert.equal(score.maximumGapSeconds, 4);
});

test('quality is evaluated after pruning and reports structural and hard prompt failures', () => {
  const slots = [
    slot(0, 2, 0, 'Verse 1', 'verse'),
    slot(1, 20, 0, 'Chorus 1', 'chorus'),
    slot(2, 20, 1, 'Chorus 1', 'chorus'),
    slot(3, 24, 0, 'Finale', 'chorus', { finale: true }),
    slot(4, 24, 1, 'Finale', 'chorus', { finale: true }),
  ];
  const score = evaluateFinalChoreography({
    cues: [{ impactTimeSeconds: 2, productId: 'blue', slotIndex: 0, tube: 0 }],
    slots,
    promptViolations: [{ kind: 'missing_colour', value: 'gold' }],
    maxTubes: 2,
    sparse: false,
  });

  assert.equal(
    score.issues.some((issue) => issue.kind === 'missing_section'),
    true,
  );
  assert.equal(
    score.issues.some((issue) => issue.kind === 'missing_final_hit' && issue.hard),
    true,
  );
  assert.equal(
    score.issues.some((issue) => issue.kind === 'prompt_constraint' && issue.hard),
    true,
  );
  assert.equal(
    score.issues.some((issue) => issue.kind === 'unused_launch_position'),
    true,
  );
});
