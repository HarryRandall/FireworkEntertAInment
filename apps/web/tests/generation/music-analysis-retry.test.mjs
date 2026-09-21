/** Static guards for durable song-analysis retry and stale worker recovery. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { isRetryableAnalyserStatus } from '../../lib/analyser-http-status.ts';

const root = process.cwd();
const runner = readFileSync(join(root, 'lib/show-analysis-runner.server.ts'), 'utf8');
const route = readFileSync(join(root, 'app/api/admin/analyser/reconcile/route.ts'), 'utf8');
const starter = readFileSync(join(root, 'lib/start-music-analysis.server.ts'), 'utf8');
const lifecycle = readFileSync(join(root, 'lib/music-analysis-lifecycle.server.ts'), 'utf8');

test('runner retries only transient failures and leaves pending work reserved', () => {
  assert.match(runner, /const MAX_ANALYSIS_ATTEMPTS = 3/);
  assert.match(runner, /const RETRY_DELAYS_SECONDS = \[30, 120\]/);
  assert.match(runner, /isRetryableAnalyserStatus\(response\.status\)/);
  assert.match(runner, /claim_song_analysis_attempt/);
  assert.match(runner, /schedule_song_analysis_retry/);
  assert.match(runner, /complete_song_analysis_attempt/);
  assert.match(runner, /fail_song_analysis_attempt/);
  assert.match(runner, /p_lease_token: typedRow\.lease_token/);
  assert.match(starter, /if \(result\.pending\) return/);
});

test('oversized, damaged and insufficient-rhythm audio errors are terminal', () => {
  assert.equal(isRetryableAnalyserStatus(413), false);
  assert.equal(isRetryableAnalyserStatus(415), false);
  assert.equal(isRetryableAnalyserStatus(422), false);
  assert.equal(isRetryableAnalyserStatus(408), true);
  assert.equal(isRetryableAnalyserStatus(429), true);
  assert.equal(isRetryableAnalyserStatus(502), true);
});

test('protected reconciliation repairs stale analyses, cues, retention, and credits', () => {
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /Authorization|authorization/);
  assert.match(route, /createServiceRoleSupabase/);
  assert.match(route, /expire_exhausted_song_analyses/);
  assert.match(route, /expire_exhausted_cue_generations/);
  assert.match(route, /runMusicAnalysisForUpload\(\{ supabase \}\)/);
  assert.match(route, /generateCuesForShow\(\{ supabase \}\)/);
  assert.match(route, /markLinkedShowGenerationFailed/);
  assert.match(route, /resolve_reconciled_show_generation_credit/);
  assert.match(route, /purge_expired_song_analyses/);
  assert.match(route, /list_orphan_audio_objects/);
  assert.match(route, /const EXPIRED_BATCH_SIZE = 10/);
  assert.match(route, /const AUDIO_RETENTION_DAYS = 7/);
  assert.match(lifecycle, /fail_waiting_show_generation/);
});
