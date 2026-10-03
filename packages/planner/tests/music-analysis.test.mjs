// The planner and Python producer share accepted features and rejected mutations.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { musicAnalysisSchema } from '@showcrafter/planner/music';

const fixtureRoot = new URL('../../../services/music-analyser/tests/fixtures/', import.meta.url);
const fixture = JSON.parse(readFileSync(new URL('analysis.json', fixtureRoot), 'utf8'));
const mutations = JSON.parse(readFileSync(new URL('schema-mutations.json', fixtureRoot), 'utf8'));
test('shared music fixture retains its beat and downbeat clock', () => {
  const analysis = musicAnalysisSchema.parse(fixture);
  assert.equal(analysis.schema_version, '1.4.0');
  assert.deepEqual(analysis.beat_times, [0, 1, 2, 3]);
  assert.deepEqual(analysis.downbeat_times, [0, 2]);
});
for (const mutation of mutations) {
  test(`music input rejects ${mutation.name}`, () => {
    const payload = structuredClone(fixture);
    let target = payload;
    for (const segment of mutation.path.slice(0, -1)) target = target[segment];
    target[mutation.path.at(-1)] = mutation.value;
    assert.equal(musicAnalysisSchema.safeParse(payload).success, false);
  });
}
test('music input rejects overlapping sections and detached downbeats', () => {
  const overlap = structuredClone(fixture);
  overlap.sections.push({ ...overlap.sections[0], start: 7, end: 12, duration: 5 });
  overlap.derived.section_rank_by_energy = [0, 1];
  assert.equal(musicAnalysisSchema.safeParse(overlap).success, false);
  const detached = structuredClone(fixture);
  detached.downbeat_times = [0.5];
  assert.equal(musicAnalysisSchema.safeParse(detached).success, false);
});

test('music input rejects non-finite timing metadata', () => {
  const payload = structuredClone(fixture);
  payload.analysis_meta.timings_ms.total_ms = Infinity;
  assert.equal(musicAnalysisSchema.safeParse(payload).success, false);
});
