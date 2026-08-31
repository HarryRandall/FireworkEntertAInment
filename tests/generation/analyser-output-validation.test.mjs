import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';
import {
  AnalyserOutputValidationError,
  parseAnalyserResponse,
  parseAnalyserResult,
  parseStoredAnalyserResult,
} from '../../lib/show-analysis-validation.ts';

const root = process.cwd();
const sharedSchemaMutations = JSON.parse(
  readFileSync(join(root, 'services/music-analyser/tests/fixtures/schema-mutations.json'), 'utf8'),
);

const styleVector = {
  boldness: 0.6,
  elegance: 0.5,
  playfulness: 0.4,
  warmth: 0.5,
  brightness: 0.5,
  grandeur: 0.7,
  tension: 0.4,
  precision: 0.6,
};

const descriptors = {
  energy: 0.5,
  drive: 0.6,
  brightness: 0.5,
  warmth: 0.5,
  tension: 0.4,
  grandeur: 0.7,
  playfulness: 0.4,
  precision: 0.6,
  dynamic_range: 0.5,
  bass_impact: 0.5,
  section_contrast: 0.2,
};

function makeValidAnalysis() {
  return {
    schema_version: '1.4.0',
    file: 'fixture.mp3',
    analysis_meta: {
      mode: 'fast',
      runner_version: 'test-librosa',
      timings_ms: {
        download_ms: 0,
        decode_ms: 1,
        beat_ms: 2,
        energy_ms: 3,
        onset_ms: 4,
        section_ms: 5,
        profile_ms: 6,
        validation_ms: 7,
        total_ms: 28,
      },
    },
    duration_seconds: 12,
    tempo_bpm: 120,
    total_beats: 4,
    beat_times: [0, 1, 2, 3],
    onset_times: [0.5, 1.5],
    energy_timeline: [
      { time: 0, energy: 0.1 },
      { time: 6, energy: 0.7 },
    ],
    sections: [
      {
        start: 0,
        end: 12,
        duration: 12,
        avg_energy: 0.5,
        peak_energy: 0.9,
        intensity: 'medium',
        cluster_id: 0,
        label: 'chorus',
      },
    ],
    key_moments: [{ time: 6, energy: 0.8, prominence: 0.4, type: 'climax' }],
    buildups: [{ start: 4, peak: 6, duration: 2, energy_rise: 0.4 }],
    music_profile: {
      genre_hint: 'cinematic',
      key_signature: { root: 'C', mode: 'major', confidence: 0.7 },
      descriptors,
      style_vector: styleVector,
      dominant_traits: ['grandeur', 'boldness'],
      raw_metrics: {
        tempo_bpm: 120,
        onset_density_per_sec: 0.4,
        key_moments_per_min: 5,
        buildups_per_min: 5,
        beat_stability: 0.8,
        section_contrast: 0.2,
        bass_ratio: 1,
      },
    },
    show_personality: {
      preset: 'balanced',
      blend_weights: { user: 0.55, music: 0.45 },
      dimensions: styleVector,
      dominant_traits: ['grandeur', 'boldness'],
      palette_direction: {
        primary: 'gold',
        secondary: 'silver',
        accent: 'emerald',
      },
      density_level: 'medium',
      genre_hint: 'cinematic',
    },
    firework_cues: [
      {
        time: 6,
        effect: 'barrage',
        reason: 'climax',
        energy: 0.8,
        section: 'chorus',
        palette: 'gold/silver',
        shape: 'chrysanthemum',
        height: 'high',
        spread: 'wide',
        density: 'dense',
        style_tags: ['grandeur', 'boldness'],
        genre_hint: 'cinematic',
      },
    ],
    downbeat_times: [0, 2],
    beats_per_bar: 2,
    derived: {
      finale_window: { start: 8, end: 12 },
      quietest_section_index: 0,
      highest_energy_section_index: 0,
      repeated_chorus_count: 1,
      section_rank_by_energy: [0],
      anchor_windows: [
        {
          type: 'climax',
          anchor_time: 6,
          start: 3,
          end: 10,
          energy: 0.8,
        },
      ],
    },
  };
}

test('runtime boundary accepts and preserves a valid schema 1.4.0 payload', () => {
  const payload = makeValidAnalysis();
  payload.onset_times = [0.5, 0.5, 1.5];
  const parsed = parseAnalyserResponse(JSON.stringify(payload));

  assert.deepEqual(parsed, payload);
  assert.deepEqual(parsed.downbeat_times, [0, 2]);
  assert.equal(parsed.derived?.finale_window?.start, 8);
});

test('runtime boundary accepts beatless analysis with an explicit zero tempo', () => {
  const payload = makeValidAnalysis();
  payload.tempo_bpm = 0;
  payload.total_beats = 0;
  payload.beat_times = [];
  payload.downbeat_times = [];

  assert.equal(parseAnalyserResult(payload).tempo_bpm, 0);
});

test('shared Python and TypeScript mutation fixtures fail the live schema', () => {
  for (const mutation of sharedSchemaMutations) {
    const payload = makeValidAnalysis();
    let target = payload;
    for (const segment of mutation.path.slice(0, -1)) {
      target = target[segment];
    }
    target[mutation.path.at(-1)] = mutation.value;
    assert.throws(() => parseAnalyserResult(payload), AnalyserOutputValidationError, mutation.name);
  }
});

test('stored schema 1.3.0 analysis is safely upgraded with bar-grid defaults', () => {
  const payload = makeValidAnalysis();
  payload.schema_version = '1.3.0';
  delete payload.downbeat_times;
  delete payload.beats_per_bar;
  delete payload.derived;

  const parsed = parseStoredAnalyserResult(payload);

  assert.equal(parsed.schema_version, '1.4.0');
  assert.deepEqual(parsed.downbeat_times, []);
  assert.equal(parsed.beats_per_bar, 4);
  assert.deepEqual(parsed.derived.section_rank_by_energy, [0]);
});

test('stored future analyser schema remains fail-closed', () => {
  const payload = makeValidAnalysis();
  payload.schema_version = '1.5.0';

  assert.throws(() => parseStoredAnalyserResult(payload), AnalyserOutputValidationError);
});

const invalidSamples = [
  {
    name: 'non-object payload',
    mutate: () => null,
    expected: /invalid schema 1\.4\.0 output/,
  },
  {
    name: 'wrong schema version',
    mutate: (payload) => ({ ...payload, schema_version: '1.5.0' }),
    expected: /schema_version/,
  },
  {
    name: 'missing required sections',
    mutate: (payload) => {
      delete payload.sections;
      return payload;
    },
    expected: /sections/,
  },
  {
    name: 'non-finite tempo',
    mutate: (payload) => ({ ...payload, tempo_bpm: Number.NaN }),
    expected: /tempo_bpm/,
  },
  {
    name: 'energy outside the unit range',
    mutate: (payload) => {
      payload.energy_timeline[0].energy = 1.1;
      return payload;
    },
    expected: /energy_timeline/,
  },
  {
    name: 'reported beat count mismatch',
    mutate: (payload) => ({ ...payload, total_beats: 5 }),
    expected: /total_beats/,
  },
  {
    name: 'unsorted beats',
    mutate: (payload) => ({ ...payload, beat_times: [0, 2, 1, 3] }),
    expected: /beat_times/,
  },
  {
    name: 'downbeat outside the beat grid',
    mutate: (payload) => ({ ...payload, downbeat_times: [0, 1.4] }),
    expected: /downbeat_times/,
  },
  {
    name: 'overlapping sections',
    mutate: (payload) => {
      payload.sections = [
        { ...payload.sections[0], end: 8, duration: 8 },
        {
          ...payload.sections[0],
          start: 7,
          end: 12,
          duration: 5,
          cluster_id: 1,
          label: 'outro',
        },
      ];
      payload.derived.section_rank_by_energy = [0, 1];
      return payload;
    },
    expected: /sections/,
  },
  {
    name: 'timed value beyond song duration',
    mutate: (payload) => ({ ...payload, onset_times: [0.5, 13] }),
    expected: /song duration/,
  },
  {
    name: 'unsupported beats per bar',
    mutate: (payload) => ({ ...payload, beats_per_bar: 5 }),
    expected: /beats_per_bar/,
  },
  {
    name: 'finale beyond song duration',
    mutate: (payload) => {
      payload.derived.finale_window.end = 20;
      return payload;
    },
    expected: /finale_window/,
  },
  {
    name: 'derived section index out of range',
    mutate: (payload) => {
      payload.derived.quietest_section_index = 2;
      return payload;
    },
    expected: /quietest_section_index/,
  },
  {
    name: 'incomplete section energy ranking',
    mutate: (payload) => {
      payload.derived.section_rank_by_energy = [];
      return payload;
    },
    expected: /section_rank_by_energy/,
  },
  {
    name: 'buildup duration mismatch',
    mutate: (payload) => {
      payload.buildups[0].duration = 5;
      return payload;
    },
    expected: /buildups/,
  },
  {
    name: 'cue ending before it starts',
    mutate: (payload) => {
      payload.firework_cues[0].end = 5;
      return payload;
    },
    expected: /firework_cues/,
  },
  {
    name: 'unexpected top-level field',
    mutate: (payload) => ({ ...payload, trusted: true }),
    expected: /Unrecognized key/,
  },
];

for (const sample of invalidSamples) {
  test(`runtime boundary rejects ${sample.name}`, () => {
    const payload = sample.mutate(structuredClone(makeValidAnalysis()));

    assert.throws(
      () => parseAnalyserResult(payload),
      (error) =>
        error instanceof AnalyserOutputValidationError && sample.expected.test(error.message),
    );
  });
}

test('runtime boundary rejects malformed JSON', () => {
  assert.throws(
    () => parseAnalyserResponse('{"schema_version":'),
    (error) =>
      error instanceof AnalyserOutputValidationError &&
      error.message === 'The analyser did not return JSON output.',
  );
});

test('hosted analyser validates before persistence and maps failures to non-retryable 422', () => {
  const runner = readFileSync(join(root, 'lib/show-analysis-runner.server.ts'), 'utf8');
  const parseIndex = runner.indexOf('parseAnalyserResponse(bodyText)');
  const completionIndex = runner.indexOf("'complete_song_analysis_attempt'");

  assert.ok(parseIndex >= 0);
  assert.ok(completionIndex > parseIndex);
  assert.match(runner, /error instanceof AnalyserOutputValidationError/);
  assert.match(runner, /throw new AnalyseError\(message, 422\)/);
  assert.doesNotMatch(runner, /JSON\.parse\(bodyText\) as AnalyserResult/);
});

test('hosted analyser bounds response bytes before parsing JSON', () => {
  const runner = readFileSync(join(root, 'lib/show-analysis-runner.server.ts'), 'utf8');

  assert.match(runner, /MAX_ANALYSER_RESPONSE_BYTES = 8 \* 1024 \* 1024/);
  assert.match(runner, /readResponseTextWithLimit\(response, MAX_ANALYSER_RESPONSE_BYTES\)/);
  assert.match(runner, /error instanceof ResponseBodyTooLargeError/);
  assert.match(runner, /const status = response\.ok \? 422 : response\.status/);
  assert.doesNotMatch(runner, /bodyText = await response\.text\(\)/);
});

test('hosted analyser request expires before its database lease', () => {
  const runner = readFileSync(join(root, 'lib/show-analysis-runner.server.ts'), 'utf8');

  assert.match(runner, /ANALYSER_REQUEST_TIMEOUT_MS = 11 \* 60 \* 1000/);
  assert.match(runner, /signal: AbortSignal\.timeout\(ANALYSER_REQUEST_TIMEOUT_MS\)/);
});

test('cue generation revalidates stored analyser JSON before use', () => {
  const loader = readFileSync(join(root, 'lib/cue-generation/loaders.server.ts'), 'utf8');

  assert.match(loader, /parseStoredAnalyserResult\(data\.analysis_json\)/);
  assert.match(loader, /status: 'invalid'/);
  assert.doesNotMatch(loader, /data\.analysis_json as unknown as AnalyserResult/);
});
