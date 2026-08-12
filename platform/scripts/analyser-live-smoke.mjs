import assert from 'node:assert/strict';
import { readResponseTextWithLimit } from '../lib/bounded-response.ts';
import { parseAnalyserResponse } from '../lib/show-analysis-validation.ts';

const analyserUrl = process.env.ANALYSER_URL;
const analyserSecret = process.env.ANALYSER_SHARED_SECRET;
const audioUrl = process.env.ANALYSER_TEST_AUDIO_URL;
if (!analyserUrl || !analyserSecret || !audioUrl) {
  throw new Error(
    'Set ANALYSER_URL, ANALYSER_SHARED_SECRET, and ANALYSER_TEST_AUDIO_URL for the live smoke test.',
  );
}

const startedAt = performance.now();
const response = await fetch(analyserUrl, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${analyserSecret}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    analysis_id: `live-smoke-${Date.now()}`,
    audio_url: audioUrl,
    personality: 'balanced',
  }),
  signal: AbortSignal.timeout(11 * 60 * 1000),
});
const body = await readResponseTextWithLimit(response, 8 * 1024 * 1024);
assert.equal(response.ok, true, `Analyser returned HTTP ${response.status}: ${body.slice(0, 500)}`);
const analysis = parseAnalyserResponse(body);
process.stdout.write(
  `${JSON.stringify({
    event: 'analyser_live_smoke_completed',
    schemaVersion: analysis.schema_version,
    durationSeconds: analysis.duration_seconds,
    beatCount: analysis.total_beats,
    sectionCount: analysis.sections.length,
    runtimeMs: Math.round(performance.now() - startedAt),
  })}\n`,
);
