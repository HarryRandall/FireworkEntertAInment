import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  ANALYSER_ARRAY_LIMITS,
  AnalyserOutputValidationError,
  LegacyAnalyserUpgradeError,
  parseAnalyserResponse,
  parseAnalyserResult,
  parseStoredAnalyserResult,
} from '../lib/show-analysis-validation.ts';
import { makeAnalysisFixture } from './helpers/music-analysis-fixture.mjs';

const root = process.cwd();
const profiles = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/music-analysis-profiles.json'), 'utf8'),
);
const historicalV12 = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/analyser-schema-1.2-example-3.json'), 'utf8'),
);

test('valid current schema 1.4 output is accepted', () => {
  for (const profile of profiles) {
    const payload = makeAnalysisFixture(profile);
    assert.deepEqual(parseAnalyserResponse(JSON.stringify(payload)), payload, profile.name);
  }
});

test('runtime boundary rejects malformed and inconsistent output', () => {
  const payload = makeAnalysisFixture(profiles[0]);
  assert.throws(() => parseAnalyserResponse('{"schema_version":'), AnalyserOutputValidationError);
  assert.throws(
    () => parseAnalyserResult({ ...payload, total_beats: payload.total_beats + 1 }),
    /total_beats/,
  );
  assert.throws(() => parseAnalyserResult({ ...payload, beat_times: [2, 1] }), /beat_times/);
});

test('stored schema 1.3 output is upgraded before cue generation', () => {
  const legacy = makeAnalysisFixture(profiles[0]);
  legacy.schema_version = '1.3.0';
  delete legacy.downbeat_times;
  delete legacy.beats_per_bar;
  delete legacy.derived;

  const parsed = parseStoredAnalyserResult(legacy);
  assert.equal(parsed.schema_version, '1.4.0');
  assert.deepEqual(parsed.downbeat_times, []);
  assert.equal(parsed.beats_per_bar, 4);
});

test('genuine stored schema 1.2 output gains explicit legacy metadata and 1.4 defaults', () => {
  const parsed = parseStoredAnalyserResult(historicalV12);
  assert.equal(parsed.schema_version, '1.4.0');
  assert.equal(parsed.analysis_meta.runner_version, 'legacy-schema-1.2');
  assert.equal(parsed.analysis_meta.timings_ms.total_ms, 0);
  assert.deepEqual(parsed.downbeat_times, []);
  assert.equal(parsed.beats_per_bar, 4);
});

test('failed schema 1.2 upgrade requests intentional re-analysis', () => {
  const invalidLegacy = structuredClone(historicalV12);
  invalidLegacy.total_beats += 1;

  assert.throws(
    () => parseStoredAnalyserResult(invalidLegacy),
    (error) => {
      assert.ok(error instanceof LegacyAnalyserUpgradeError);
      assert.equal(error.schemaVersion, '1.2.0');
      assert.match(error.message, /requires re-analysis/);
      return true;
    },
  );
});

test('unsupported future stored schema is rejected explicitly', () => {
  const payload = makeAnalysisFixture(profiles[0]);
  assert.throws(
    () => parseStoredAnalyserResult({ ...payload, schema_version: '1.5.0' }),
    /invalid schema 1\.4\.0 output: schema_version/,
  );
});

test('dense 15-minute output fits the 8 MiB transport budget and schema caps', () => {
  const payload = makeAnalysisFixture({
    ...profiles[0],
    name: 'dense-fifteen-minute',
    duration: 900,
    tempo: 300,
    sections: [{ start: 0, end: 900, label: 'chorus', energy: 0.9, intensity: 'high' }],
    climax: 890,
    finaleStart: 870,
  });
  payload.onset_times = Array.from({ length: 18_000 }, (_, index) => index * 0.05);
  payload.energy_timeline = Array.from({ length: 1_800 }, (_, index) => ({
    time: index * 0.5,
    energy: 0.9,
  }));
  const cue = {
    effect: 'accent',
    reason: 'dense contract budget',
    energy: 0.9,
    section: 'chorus',
    palette: 'gold',
    shape: 'peony',
    height: 'high',
    spread: 'wide',
    density: 'high',
    style_tags: ['bright', 'precise'],
    genre_hint: 'pop',
  };
  payload.firework_cues = Array.from(
    { length: ANALYSER_ARRAY_LIMITS.fireworkCues },
    (_, index) => ({ ...cue, time: index * (900 / ANALYSER_ARRAY_LIMITS.fireworkCues) }),
  );

  const body = JSON.stringify(payload);
  assert.ok(Buffer.byteLength(body) < 8 * 1024 * 1024);
  assert.equal(parseAnalyserResponse(body).duration_seconds, 900);
});
