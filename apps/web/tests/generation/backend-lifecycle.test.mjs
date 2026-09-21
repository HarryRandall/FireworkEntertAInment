/** Static guards for durable cue work, dead letters, and audio retention. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const runner = readFileSync(join(root, 'lib/cue-generation/runner.server.ts'), 'utf8');
const reconcile = readFileSync(join(root, 'app/api/admin/analyser/reconcile/route.ts'), 'utf8');
const healthRoute = readFileSync(join(root, 'app/api/admin/backend-lifecycle/route.ts'), 'utf8');

test('cue generation has bounded token-fenced attempts', () => {
  assert.match(runner, /const MAX_CUE_GENERATION_ATTEMPTS = 3/);
  assert.match(runner, /const CUE_RETRY_DELAYS_SECONDS = \[30, 120\]/);
  assert.match(runner, /claim_cue_generation_attempt/);
  assert.match(runner, /schedule_cue_generation_retry/);
});

test('cue terminal state and credits resolve in one guarded transaction', () => {
  assert.match(runner, /complete_cue_generation_attempt/);
  assert.match(runner, /fail_cue_generation_attempt/);
  assert.doesNotMatch(runner, /settleAiCreditReservation|refundAiCreditReservation/);
});

test('exhausted work is observable through least-privilege dead letters', () => {
  assert.match(healthRoute, /process\.env\.CRON_SECRET/);
  assert.match(healthRoute, /get_backend_lifecycle_health/);
  assert.match(healthRoute, /resolve_backend_dead_letter/);
});

test('audio retention preserves referenced work and removes aged private objects', () => {
  assert.match(reconcile, /supabase\.storage\.from\('audio'\)\.remove\(audioPaths\)/);
  assert.match(reconcile, /record_backend_dead_letter/);
  assert.match(reconcile, /Private audio object was removed by retention reconciliation/);
});

test('reconciliation runs at most one long analysis or cue job per invocation', () => {
  assert.match(reconcile, /analysisDidWork = Boolean\(analysisResult\.analysisId\)/);
  assert.match(reconcile, /if \(!analysisDidWork\) \{/);
  assert.match(reconcile, /generateCuesForShow\(\{ supabase \}\)/);
  assert.match(reconcile, /expire_exhausted_cue_generations/);
  assert.match(reconcile, /get_backend_lifecycle_health/);
});
