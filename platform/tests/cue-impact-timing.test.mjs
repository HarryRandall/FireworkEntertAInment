import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseCreativeDirection } from '../lib/cue-generation/creative-direction.ts';
import { scheduleImpactWithLift } from '../lib/cue-generation/impact-clock.ts';
import {
  occupiedLaunchPositions,
  productFitsLaunchPositions,
} from '../lib/cue-generation/show-options.ts';
import { Scheduler } from '../lib/fireworks/Scheduler.ts';

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

test('ground effects launch on impact and impossible opening aerial hits are skipped', () => {
  assert.deepEqual(scheduleImpactWithLift(4.25, 0), {
    impactTimeSeconds: 4.25,
    launchTimeSeconds: 4.25,
    liftTimeSeconds: 0,
  });
  assert.equal(scheduleImpactWithLift(1, 1.5), null);
  assert.equal(scheduleImpactWithLift(Number.NaN, 1), null);
});

test('direct shells use renderer-matched impacts while multishots anchor their sequence', () => {
  const timing = read('lib/cue-generation/impact-timing.ts');
  const fast = read('lib/cue-generation/fast-planner.ts');
  const beat = read('lib/cue-generation/beat-sync-planner.ts');
  const runner = read('lib/cue-generation/runner.server.ts');
  const prompt = read('lib/cue-generation/prompt.ts');

  assert.match(timing, /scaleDesignForCaliber\(compiled, product\.caliber\)/);
  assert.match(timing, /scaleDesignForEmphasis/);
  assert.match(timing, /estimateFireworkLiftTimeSeconds/);
  assert.match(fast, /scheduleProductForCueSlot/);
  assert.match(beat, /scheduleProductForImpact/);
  assert.match(runner, /scheduleProductForCueSlot/);
  assert.match(prompt, /For a direct single shot, t is its visible burst/);
  assert.match(prompt, /For a multishot, t is the start of its sustained sequence/);
  assert.doesNotMatch(prompt, /fires it exactly on that beat/);
});

test('database-backed LLM prompt uses the same impact-time contract', () => {
  const migration = read('supabase/migrations/20260711050142_improve_show_cue_impact_prompt.sql');

  assert.match(migration, /For a direct single shot, t is its visible burst/);
  assert.match(migration, /For a multishot, t is the start of its sustained sequence/);
  assert.match(migration, /server subtracts their renderer-matched lift time/);
  assert.match(migration, /product_context_text =/);
  assert.match(migration, /slot t is the desired burst, not launch/);
  assert.doesNotMatch(migration, /"description": "<string/);
});

test('multishot child positions participate in site and overlap safety', () => {
  const domain = read('lib/show-domain.ts');
  const queries = read('lib/shows/queries.server.ts');
  const options = read('lib/cue-generation/show-options.ts');
  const fast = read('lib/cue-generation/fast-planner.ts');
  const runner = read('lib/cue-generation/runner.server.ts');
  const showTypes = read('lib/shows/types.ts');

  assert.match(domain, /launchPositionOverrideIndices\?: number\[\];/);
  assert.match(domain, /occupancyDurationSeconds\?: number \| null;/);
  assert.match(domain, /export function fireworkOccupancyDurationSeconds/);
  assert.match(queries, /position_override_json,/);
  assert.match(queries, /launchPositionOverrideIndices/);
  assert.match(options, /export function occupiedLaunchPositions/);
  assert.match(fast, /occupiedLaunchPositions\(product\.product, tube, maxTubes\)/);
  assert.match(runner, /occupiedLaunchPositions\(product, cue\.tube, maxTubes\)/);
  assert.match(runner, /acceptedWindows\.push\(\.\.\.windows\)/);
  assert.match(showTypes, /CACHE_PREFIX = 'shows:v13'/);
  assert.match(
    queries,
    /occupancyDurationSeconds: conservativeProductDuration\(\s*row\.duration_seconds,\s*base\.durationSeconds,\s*\)/,
  );
  assert.match(fast, /fireworkOccupancyDurationSeconds\(product\)/);
  assert.match(runner, /fireworkOccupancyDurationSeconds\(product\)/);
});

test('multishot position reservation includes parent and child tubes', () => {
  const product = { launchPositionOverrideIndices: [0, 2] };

  assert.deepEqual(occupiedLaunchPositions(product, 1, 3), [0, 1, 2]);
  assert.equal(productFitsLaunchPositions(product, 2), false);
  assert.equal(occupiedLaunchPositions(product, 1, 2), null);
  assert.deepEqual(occupiedLaunchPositions({}, 1, 2), [1]);
});

test('preset-style scheduling sees an absolute multishot child-position conflict', () => {
  const occupied = occupiedLaunchPositions({ launchPositionOverrideIndices: [2] }, 0, 3);

  assert.deepEqual(occupied, [0, 2]);
  assert.equal(occupied?.includes(2), true, 'a direct cue on position 3 conflicts');
  assert.equal(occupied?.includes(1), false, 'a direct cue on position 2 remains independent');
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
  assert.match(fast, /signature:[\s\S]*cinematic:[\s\S]*minimalist:/);
});

test('beat precision honours sparse pacing, palette and requested structural moments', () => {
  const beat = read('lib/cue-generation/beat-sync-planner.ts');

  assert.match(beat, /parseCreativeDirection/);
  assert.match(beat, /direction\.density === 'sparse'/);
  assert.match(beat, /direction\.quietMiddle/);
  assert.match(beat, /direction\.softEnding/);
  assert.match(beat, /direction\.bigEnding/);
  assert.match(beat, /direction\.surprise/);
  assert.match(beat, /requestedColourFamilies/);
  assert.match(beat, /productDuration\(product\) <= shortest \+ 1\.5/);
  assert.match(beat, /spectacle: \[\.\.\.palettePool\]/);
  assert.match(beat, /return pools\.spectacle/);
});

test('LLM generation falls back when validation leaves a visibly thin show', () => {
  const runner = read('lib/cue-generation/runner.server.ts');

  assert.match(runner, /const targetFillRatio = sparseGeneration \? 0\.5 : 0\.75/);
  assert.match(runner, /estimateAchievableCueCount/);
  assert.match(runner, /slot\.nearClimax \|\| slot\.emphasis === 'peak'/);
  assert.match(
    runner,
    /accepted\.length < minimumViableCount \|\| missingProtectedSlots\.length > 0/,
  );
  assert.match(runner, /LLM did not meet viable show requirements after validation/);
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

test('scheduler includes a launch at the exact start of the timeline', () => {
  const scheduler = new Scheduler();
  const cue = { id: 'opening', timeSeconds: 0 };
  scheduler.setCues([cue]);

  assert.deepEqual(scheduler.pop(0, 0.016), [cue]);
  assert.deepEqual(scheduler.pop(0.016, 0.032), []);
});

test('scheduler materialises an unfired cue at any exact replay boundary', () => {
  const scheduler = new Scheduler();
  const cue = { id: 'boundary', timeSeconds: 0.25 };
  scheduler.setCues([cue]);

  assert.deepEqual(scheduler.pop(0.25, 0.25), [cue]);
  assert.deepEqual(scheduler.pop(0.25, 0.266667), []);
});

test('soundtrack playback is the replay clock while audio is active', () => {
  const viewer = read('app/components/app/FireworkReplayViewer.tsx');

  assert.match(viewer, /audio\.currentTime/);
  assert.match(viewer, /audioTime \?\? playheadStart\.current \+ dtFromStart/);
  assert.match(viewer, /soundtrack audio exists it is the playback clock/);
});
