// Producer seconds, planner milliseconds and product impact delays share one show/audio origin.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { plannerInputSchema, solvePlan } from '../src/index.ts';
import { musicAnchors, scheduleProducts } from '../src/solver/schedule.ts';
import { arrangeProducts, targetEnergy } from '../src/solver/pacing.ts';
import { input, product, uuid } from './solver-fixtures.mjs';

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../services/music-analyser/tests/fixtures/analysis.json', import.meta.url),
    'utf8',
  ),
);
export function musicalInput(products) {
  const snapshot = input(products);
  const analysis = structuredClone(fixture);
  analysis.duration_seconds = 60;
  analysis.beat_times = Array.from({ length: 61 }, (_, index) => index);
  analysis.downbeat_times = analysis.beat_times.filter((time) => time % 2 === 0);
  analysis.total_beats = analysis.beat_times.length;
  analysis.sections = [
    { ...analysis.sections[0], start: 0, end: 20, duration: 20, avg_energy: 0.1 },
    { ...analysis.sections[0], start: 20, end: 60, duration: 40, avg_energy: 0.9 },
  ];
  analysis.energy_timeline = [
    { time: 0, energy: 0.1 },
    { time: 20, energy: 0.9 },
  ];
  analysis.derived.section_rank_by_energy = [1, 0];
  snapshot.music = analysis;
  snapshot.answers.soundtrack = uuid(998);
  return snapshot;
}

test('musical cues target beats at impact rather than at ignition, honouring stock and duration', () => {
  const snapshot = musicalInput([
    product(1, { duration_ms: 10000, impact_delay_ms: 1500, energy: 0.1 }),
    product(2, { duration_ms: 10000, impact_delay_ms: 2500, energy: 0.9 }),
  ]);
  const result = solvePlan(snapshot, { candidate_count: 3 });
  assert.equal(result.status, 'ok');
  let snapped = 0;
  for (const candidate of result.candidates) {
    let end = 0;
    for (const cue of candidate.cues) {
      const unit = snapshot.products.find((p) => p.product_id === cue.product_id);
      if (cue.beat !== null) {
        assert.equal(cue.t_ms + unit.impact_delay_ms, snapshot.music.beat_times[cue.beat] * 1000);
        snapped++;
      }
      end = Math.max(end, cue.t_ms + unit.duration_ms);
    }
    assert.equal(candidate.duration_ms, end);
  }
  assert.ok(snapped > 0);
});

test('section starts and downbeats receive precedence within the structural snap window', () => {
  const snapshot = plannerInputSchema.parse(
    musicalInput([
      product(1, { duration_ms: 21000, impact_delay_ms: 0 }),
      product(2, { impact_delay_ms: 1000 }),
    ]),
  );
  const schedule = scheduleProducts(snapshot.products, 'gentle', musicAnchors(snapshot));
  assert.equal(schedule.cues[0].t_ms, 0);
  assert.equal(schedule.cues[1].t_ms + 1000, 20000);
});

test('audio energy is interpolated and section energy fills an empty energy timeline', () => {
  const snapshot = plannerInputSchema.parse(musicalInput());
  snapshot.answers.length_min = 1;
  assert.equal(targetEnergy(snapshot, 'balanced', 0), 0.1);
  assert.ok(Math.abs(targetEnergy(snapshot, 'balanced', 1 / 6) - 0.5) < 1e-12);
  snapshot.music.energy_timeline = [];
  assert.equal(targetEnergy(snapshot, 'balanced', 0.5), 0.9);
  snapshot.music = null;
  assert.equal(targetEnergy(snapshot, 'gentle', 0), 0.15);
  assert.equal(targetEnergy(snapshot, 'big_finale', 1), 1);
});

test('sparse or absent beat grids use the deterministic default clock without invalid negative launches', () => {
  const snapshot = plannerInputSchema.parse(
    musicalInput([product(1, { duration_ms: 5000, impact_delay_ms: 4000 })]),
  );
  snapshot.music.beat_times = [];
  snapshot.music.downbeat_times = [];
  snapshot.music.total_beats = 0;
  const schedule = scheduleProducts(snapshot.products, 'gentle', musicAnchors(snapshot));
  assert.equal(schedule.cues[0].t_ms, 0);
  assert.equal(schedule.cues[0].beat, null);
  assert.equal(schedule.duration_ms, 5000);
});

test('changing valid analysis changes the cache identity and corrupt music is rejected', () => {
  const snapshot = musicalInput();
  const original = solvePlan(snapshot);
  snapshot.music.energy_timeline[0].energy = 0.4;
  const changed = solvePlan(snapshot);
  assert.equal(original.status, 'ok');
  assert.equal(changed.status, 'ok');
  assert.notEqual(original.input_hash, changed.input_hash);
  snapshot.music.total_beats++;
  assert.equal(solvePlan(snapshot).status, 'invalid_input');
});

test('a complete unit longer than the track cannot produce a partial soundtrack plan', () => {
  const snapshot = musicalInput([product(1, { duration_ms: 60001, impact_delay_ms: 0 })]);
  assert.equal(solvePlan(snapshot).status, 'infeasible');
});

test('falling musical energy can place the louder product before a quiet ending', () => {
  const snapshot = plannerInputSchema.parse(
    musicalInput([product(1, { energy: 0.1 }), product(2, { energy: 0.9 })]),
  );
  snapshot.music.energy_timeline = [
    { time: 0, energy: 0.9 },
    { time: 60, energy: 0.1 },
  ];
  const arranged = arrangeProducts(snapshot.products, snapshot, 'balanced');
  assert.deepEqual(
    arranged.map((unit) => unit.energy),
    [0.9, 0.1],
  );
});
