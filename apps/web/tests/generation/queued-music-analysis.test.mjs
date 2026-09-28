import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks, createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const appRoot = fileURLToPath(new URL('../../', import.meta.url));
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only')
      return { url: 'data:text/javascript,export {};', shortCircuit: true };
    if (specifier === 'next/cache')
      return { url: 'data:text/javascript,export function revalidatePath(){}', shortCircuit: true };
    if (specifier.startsWith('@/'))
      specifier = pathToFileURL(resolve(appRoot, specifier.slice(2))).href;
    if (specifier.startsWith('file:') && !existsSync(new URL(specifier))) specifier += '.ts';
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.ts'))
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
        }).outputText,
      };
    return next(url, context);
  },
});
const { finishQueuedMusicAnalysis, runMusicAnalysisForUpload } =
  await import('../../lib/show-analysis-runner.server.ts');
const { authoriseAnalyserCallback } = await import('../../lib/analyser-callback-auth.ts');
const { generationDelayLabel } = await import('../../ui/shows/generation-delay.ts');
const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/analysis-jamendo-1930003.json', import.meta.url)),
);
const row = {
  id: 'c87acebd-4a96-4770-8825-1b2aebc84365',
  user_id: 'user',
  audio_path: 'user/audio.mp3',
  personality: 'balanced',
  attempt_count: 1,
  lease_token: 'lease',
  status: 'running',
};
function database(current = { ...row }, rpcResult = true) {
  const calls = [];
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle: async () => ({ data: current, error: null }),
  };
  const db = {
    calls,
    from: () => query,
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          data: { signedUrl: 'https://project.supabase.co/audio' },
          error: null,
        }),
      }),
    },
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === 'claim_song_analysis_attempt')
        return { data: [{ ...current, analysis_id: current.id }], error: null };
      if (name === 'complete_song_analysis_attempt' && rpcResult) current.status = 'completed';
      return { data: rpcResult, error: null };
    },
  };
  return db;
}
const callback = (supabase, outcome = { ok: true, analysis: fixture }) =>
  finishQueuedMusicAnalysis({
    supabase,
    analysisId: row.id,
    leaseToken: row.lease_token,
    runtimeMs: 15000,
    outcome,
  });

test('callback completes with the original lease and duplicate delivery performs no second write', async () => {
  const db = database();
  assert.equal((await callback(db)).ok, true);
  assert.equal((await callback(db)).cancelled, true);
  assert.equal(db.calls.length, 1);
  assert.equal(db.calls[0].name, 'complete_song_analysis_attempt');
  assert.equal(db.calls[0].args.p_lease_token, 'lease');
  assert.equal(db.calls[0].args.p_runtime_ms, 15000);
});
test('a callback from an older lease cannot persist or settle credits', async () => {
  const db = database({ ...row, lease_token: 'new-lease' });
  assert.equal((await callback(db)).cancelled, true);
  assert.deepEqual(db.calls, []);
});
test('transient callback errors retain the reservation and schedule the existing attempt for retry', async () => {
  const db = database();
  const result = await callback(db, { ok: false, error: 'Unavailable', status: 503 });
  assert.equal(result.retryScheduled, true);
  assert.equal(db.calls[0].name, 'schedule_song_analysis_retry');
  assert.equal(db.calls[0].args.p_retry_delay_seconds, 30);
});
test('damaged audio and exhausted retries fail through the atomic refund RPC', async () => {
  for (const [current, status] of [
    [{ ...row }, 422],
    [{ ...row, attempt_count: 3 }, 503],
  ]) {
    const db = database(current);
    assert.equal((await callback(db, { ok: false, error: 'Failed', status })).pending, undefined);
    assert.equal(db.calls[0].name, 'fail_song_analysis_attempt');
  }
});
test('completion rejected by the database remains pending, without an unguarded write', async () => {
  const db = database({ ...row }, false);
  assert.equal((await callback(db)).pending, true);
  assert.equal(db.calls.length, 1);
});
test('dispatch returns pending immediately and never attempts to save its acknowledgement as analysis', async () => {
  const saved = { ...process.env };
  const fetchBefore = globalThis.fetch;
  try {
    process.env.ANALYSER_URL = 'https://analyser.modal.run';
    process.env.ANALYSER_DISPATCH_URL = 'https://dispatch.modal.run/runs';
    process.env.ANALYSER_SHARED_SECRET = 'test-secret';
    process.env.APP_ORIGIN = 'https://showcrafter.example';
    let body;
    globalThis.fetch = async (url, options) => {
      assert.equal(url, process.env.ANALYSER_DISPATCH_URL);
      body = JSON.parse(options.body);
      return Response.json({ analysis_id: row.id, status: 'accepted' }, { status: 202 });
    };
    const db = database();
    assert.equal(
      (await runMusicAnalysisForUpload({ supabase: db, analysisId: row.id })).pending,
      true,
    );
    assert.equal(body.lease_token, row.lease_token);
    assert.equal(
      body.callback_url,
      'https://showcrafter.example/api/internal/music-analysis/callback',
    );
    assert.deepEqual(
      db.calls.map((x) => x.name),
      ['claim_song_analysis_attempt'],
    );
  } finally {
    globalThis.fetch = fetchBefore;
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
test('callback authentication denies absent or incorrect secrets', () => {
  assert.equal(authoriseAnalyserCallback(null, 'secret'), false);
  assert.equal(authoriseAnalyserCallback('Bearer secret', undefined), false);
  assert.equal(authoriseAnalyserCallback('Bearer wrong', 'secret'), false);
  assert.equal(authoriseAnalyserCallback('Bearer secret', 'secret'), true);
});
test('overdue analysis replaces the countdown with delay and recovery messages', () => {
  assert.equal(generationDelayLabel('analysing', 100, 110), null);
  assert.match(generationDelayLabel('analysing', 180, 110), /longer than expected/);
  assert.match(generationDelayLabel('analysing', 300, 110), /retry automatically/);
  assert.match(generationDelayLabel('generating', 90, 45), /longer than expected/);
});
