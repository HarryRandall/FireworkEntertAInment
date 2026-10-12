import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseCreativeDirection } from '../../lib/cue-generation/creative-direction.ts';
import { scheduleImpactWithLift } from '../../lib/cue-generation/impact-clock.ts';
import {
  DIRECT_SHOW_REPLAY_SHOT_OFFSET_SECONDS,
  showReplayShotTimeSeconds,
} from '../../lib/replay-shot-timing.ts';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('impact clock launches early so the burst lands on the musical target', () => {
  const timing = scheduleImpactWithLift(12.345, 2.137);

  assert.deepEqual(timing, {
    impactTimeSeconds: 12.345,
    launchTimeSeconds: 10.208,
    liftTimeSeconds: 2.137,
  });
  assert.equal(timing.launchTimeSeconds + timing.liftTimeSeconds, timing.impactTimeSeconds);
});

test('show replay preserves an exact generated direct-firework impact', () => {
  const targetImpactSeconds = 12.345;
  const liftTimeSeconds = 2.137;
  const generated = scheduleImpactWithLift(targetImpactSeconds, liftTimeSeconds);
  assert.ok(generated);

  const replayLaunchSeconds = showReplayShotTimeSeconds(
    generated.launchTimeSeconds,
    DIRECT_SHOW_REPLAY_SHOT_OFFSET_SECONDS,
  );

  assert.equal(replayLaunchSeconds, generated.launchTimeSeconds);
  assert.equal(replayLaunchSeconds + liftTimeSeconds, targetImpactSeconds);
});

test('ground effects launch on impact and impossible opening aerial hits are skipped', () => {
  assert.deepEqual(scheduleImpactWithLift(4.25, 0), {
    impactTimeSeconds: 4.25,
    launchTimeSeconds: 4.25,
    liftTimeSeconds: 0,
  });
  assert.equal(scheduleImpactWithLift(1, 1.5), null);
  assert.equal(scheduleImpactWithLift(Number.NaN, 1), null);
});

test('every planner lands the first visible burst on the musical time', () => {
  const timing = read('lib/cue-generation/impact-timing.ts');
  const fast = read('lib/cue-generation/fast-planner.ts');
  const beat = read('lib/cue-generation/beat-sync-planner.ts');
  const realiser = read('lib/cue-generation/plan-realiser.ts');
  const prompt = read('lib/cue-generation/prompt.ts');

  assert.match(timing, /resolvedShowDesign\(product, emphasis\)/);
  assert.match(timing, /showLiftTimeSeconds/);
  // Multishots launch early by their first child's impact offset.
  assert.match(timing, /timingProfile\.firstImpactOffsetSeconds/);
  for (const planner of [fast, beat, realiser]) {
    assert.match(planner, /scheduleProductForCueSlot\(\{[\s\S]*?timingProfile:/);
  }
  // The model never places times; the engine compensates lift.
  assert.match(prompt, /You do not choose beats, times or launch positions/);
});

test('the card-preview lead-in cannot leak into full show replay timing', () => {
  const queries = read('lib/shows/queries.server.ts');
  const preview = read('lib/firework-card-preview.server.ts');

  assert.doesNotMatch(queries, /FIREWORK_CARD_PREVIEW_CUE_TIME_SECONDS/);
  assert.match(queries, /kind: 'direct',[\s\S]*?DIRECT_SHOW_REPLAY_SHOT_OFFSET_SECONDS/);
  assert.match(
    preview,
    /fireworkCardPreviewShotTimeSeconds\(shot\.kind, shot\.timeOffsetSeconds\)/,
  );
});

test('multishot child positions participate in site and overlap safety', () => {
  const domain = read('lib/show-domain.ts');
  const queries = read('lib/shows/queries.server.ts');
  const options = read('lib/cue-generation/show-options.ts');
  const fast = read('lib/cue-generation/fast-planner.ts');
  const beat = read('lib/cue-generation/beat-sync-planner.ts');
  const runner = read('lib/cue-generation/runner.server.ts');
  const spacing = read('lib/cue-generation/launch-spacing.ts');
  const showTypes = read('lib/shows/types.ts');

  assert.doesNotMatch(domain, /launchPositionOverrideIndices|hasLaunchPositionOverrides/);
  assert.match(domain, /occupancyDurationSeconds\?: number \| null;/);
  assert.match(domain, /export function fireworkOccupancyDurationSeconds/);
  // A multishot is one cake at its cue's position, so a cue only reserves its own tube.
  assert.match(queries, /launchPositionIndex: baseCue\.launchPositionIndex,/);
  assert.doesNotMatch(queries, /parseShotLaunchPositionIndex/);
  assert.doesNotMatch(options, /occupiedLaunchPositions|productFitsLaunchPositions/);
  assert.match(fast, /if \(tube >= maxTubes\) continue;/);
  assert.match(runner, /launchPositionIndex: cue\.tube,/);
  assert.match(runner, /acceptedWindows\.push\(window\)/);
  assert.match(showTypes, /CACHE_PREFIX = 'shows:v16'/);
  assert.match(queries, /occupancyDurationSeconds: occupancy/);
  assert.match(fast, /fireworkOccupancyDurationSeconds\(product\)/);
  assert.match(spacing, /GENERATED_LAUNCH_INTERVAL_SECONDS = 0\.5/);
  assert.match(fast, /timing\.launchTimeSeconds \+ GENERATED_LAUNCH_INTERVAL_SECONDS/);
  assert.match(beat, /timing\.launchTimeSeconds \+ GENERATED_LAUNCH_INTERVAL_SECONDS/);
  assert.match(runner, /durationSeconds: GENERATED_LAUNCH_INTERVAL_SECONDS/);
});

test('fast planner raises safe density and honours style, surprise and recent-use variety', () => {
  const fast = read('lib/cue-generation/fast-planner.ts');

  assert.match(fast, /MAX_FAST_CUES = 220/);
  assert.match(fast, /asShowStyleKey\(brief\.show_style\)/);
  assert.match(fast, /findPreFinaleSurpriseImpact/);
  assert.match(fast, /recentPenalty/);
  assert.match(fast, /unusedBonus/);
  assert.match(fast, /durationPenalty/);
  assert.match(fast, /slotProtectionPriority/);
  assert.match(fast, /hardExcluded/);
  assert.match(fast, /preferGentle: softFinale/);
  assert.match(fast, /direction\.softEnding && slot\.finale && !slot\.nearClimax/);
  assert.match(fast, /const tubeOrder =/);
  assert.match(fast, /launchPositionCountForSlots\(slots\)/);
  assert.match(fast, /signature:[\s\S]*cinematic:[\s\S]*minimalist:/);
});

test('beat precision honours sparse pacing, palette and requested structural moments', () => {
  const beat = read('lib/cue-generation/beat-sync-planner.ts');
  const moments = read('lib/cue-generation/beat-sync-moments.ts');
  const beatPlanning = `${beat}\n${moments}`;

  assert.match(beatPlanning, /parseCreativeDirection/);
  assert.match(beatPlanning, /direction\.density === 'sparse'/);
  assert.match(beatPlanning, /direction\.quietMiddle/);
  assert.match(beatPlanning, /direction\.softEnding/);
  assert.match(beatPlanning, /direction\.bigEnding/);
  assert.match(beatPlanning, /direction\.surprise/);
  assert.match(beat, /requestedColourFamilies/);
  assert.match(beat, /productDuration\(product\) <= shortest \+ 1\.5/);
  assert.match(beat, /spectacle: \[\.\.\.palettePool\]/);
  assert.match(beat, /sustained: \[\.\.\.sustainedShots\]/);
  assert.match(beat, /shouldStartSustainedLayer/);
  assert.match(beat, /target\.tubes/);
  assert.match(beat, /occupied\.push\(\.\.\.accepted\.windows\)/);
});

test('plan shows fall back to the beat planner only on hard failures', () => {
  const runner = read('lib/cue-generation/runner.server.ts');

  // Deliberate lulls are soft issues; only hard ones reject the plan.
  assert.match(runner, /!checked\.quality\.issues\.some\(\(issue\) => issue\.hard\)/);
  assert.match(runner, /inspectCandidate\(buildBeatPlan\(\)\.cues, slots\)/);
  assert.doesNotMatch(runner, /targetFillRatio/);
});

test('the example minimalist brief produces precise sparse planning with a surprise', () => {
  const direction = parseCreativeDirection(
    'Cool blues and whites, minimalist and precise, with one big surprise before the finale.',
    'minimalist',
  );

  assert.equal(direction.style, 'minimalist');
  assert.equal(direction.density, 'sparse');
  assert.equal(direction.precise, true);
  assert.equal(direction.surprise, true);
  assert.equal(direction.bigEnding, false);
});

test('dice brief wording maps to the promised timing and pacing controls', () => {
  const beatSynced = parseCreativeDirection(
    'Warm reds building to a dense, beat-synced crescendo.',
    'signature',
  );
  const quietMoment = parseCreativeDirection(
    'Quick bursts, a quiet moment, then a crackling finish.',
    'signature',
  );
  const exactBeat = parseCreativeDirection(
    'Emerald and white with clean comet lines, exact on the beat.',
    'signature',
  );

  assert.equal(beatSynced.precise, true);
  assert.equal(beatSynced.density, 'dense');
  assert.equal(quietMoment.quietMiddle, true);
  assert.equal(exactBeat.precise, true);
});

test('soundtrack playback is the replay clock while audio is active', () => {
  const viewer = read('ui/replay/FireworkReplayViewer.tsx');

  assert.match(viewer, /audio\.currentTime/);
  assert.match(viewer, /audioTime \?\? playheadStart\.current \+ dtFromStart/);
  assert.match(viewer, /soundtrack audio exists it is the playback clock/);
});
