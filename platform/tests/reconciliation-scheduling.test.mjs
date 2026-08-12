/** Static guards for the two independently scheduled durable work queues. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const analyserRoute = readFileSync(join(root, 'app/api/admin/analyser/reconcile/route.ts'), 'utf8');
const cueRoute = readFileSync(
  join(root, 'app/api/admin/cue-generation/reconcile/route.ts'),
  'utf8',
);
const cueMigration = readFileSync(
  join(root, 'supabase/migrations/20260727103000_backend_lifecycle_operations.sql'),
  'utf8',
);
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));

test('Vercel schedules both reconciliation queues every minute', () => {
  assert.deepEqual(vercel.crons, [
    { path: '/api/admin/analyser/reconcile', schedule: '* * * * *' },
    { path: '/api/admin/cue-generation/reconcile', schedule: '* * * * *' },
  ]);
});

test('a running analysis cannot block an unrelated ready cue job', () => {
  assert.match(analyserRoute, /runMusicAnalysisForUpload\(\{ supabase \}\)/);
  assert.doesNotMatch(analyserRoute, /generateCuesForShow/);
  assert.match(cueRoute, /generateCuesForShow\(\{ supabase \}\)/);
  assert.doesNotMatch(cueRoute, /runMusicAnalysisForUpload/);
});

test('multiple running analyses cannot starve the separately scheduled cue queue', () => {
  assert.equal(analyserRoute.match(/runMusicAnalysisForUpload\(\{ supabase \}\)/g)?.length, 1);
  assert.equal(cueRoute.match(/generateCuesForShow\(\{ supabase \}\)/g)?.length, 1);
  assert.equal(vercel.crons.filter((cron) => cron.path.includes('cue-generation')).length, 1);
});

test('analysis completion makes its show eligible before a cue attempt is consumed', () => {
  const eligibility = cueMigration.indexOf("analysis.status in ('completed', 'failed')");
  const attemptIncrement = cueMigration.indexOf(
    'set generation_attempt_count = show_row.generation_attempt_count + 1',
  );

  assert.ok(eligibility > 0);
  assert.ok(attemptIncrement > eligibility);
  assert.match(cueMigration, /analysis\.status in \('completed', 'failed'\)/);
  assert.doesNotMatch(cueMigration, /analysis\.status in \('queued', 'running'\)/);
});

test('analysis polling remains one bounded control operation per invocation', () => {
  assert.match(analyserRoute, /export const maxDuration = 300/);
  assert.equal(analyserRoute.match(/runMusicAnalysisForUpload\(\{ supabase \}\)/g)?.length, 1);
  assert.doesNotMatch(analyserRoute, /while\s*\(|for\s*\(\s*;;/);
});
