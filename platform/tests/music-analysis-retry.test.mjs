/** Static guards for durable song-analysis retry and stale worker recovery. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const migration = readFileSync(
  join(root, 'supabase/migrations/20260727090000_song_analysis_retry_leases.sql'),
  'utf8',
);
const runner = readFileSync(join(root, 'lib/show-analysis-runner.server.ts'), 'utf8');
const route = readFileSync(join(root, 'app/api/admin/analyser/reconcile/route.ts'), 'utf8');
const starter = readFileSync(join(root, 'lib/start-music-analysis.server.ts'), 'utf8');
const lifecycle = readFileSync(join(root, 'lib/music-analysis-lifecycle.server.ts'), 'utf8');

test('song analyses store bounded attempts, retry timing, and paired leases', () => {
  assert.match(migration, /add column if not exists attempt_count integer not null default 0/);
  assert.match(migration, /add column if not exists lease_token uuid/);
  assert.match(migration, /add column if not exists lease_expires_at timestamptz/);
  assert.match(migration, /add column if not exists next_retry_at timestamptz/);
  assert.match(migration, /check \(attempt_count between 0 and 3\)/);
  assert.match(migration, /check \(\(lease_token is null\) = \(lease_expires_at is null\)\)/);
  assert.match(migration, /song_analyses_retry_claim_idx/);
  assert.match(migration, /revoke update, delete on public\.song_analyses from authenticated/);
});

test('claiming is owner or worker scoped and fences stale workers', () => {
  assert.match(migration, /create or replace function public\.claim_song_analysis_attempt/);
  assert.match(migration, /caller_role <> 'service_role'/);
  assert.match(migration, /analysis\.user_id = caller_id/);
  assert.match(migration, /for update skip locked/);
  assert.match(
    migration,
    /analysis\.lease_expires_at is null or analysis\.lease_expires_at <= now\(\)/,
  );
  assert.match(migration, /lease_token = claimed_token/);
  assert.match(migration, /attempt_count = analysis_row\.attempt_count \+ 1/);
  assert.match(migration, /reservation\.reference_type = 'song_analyses'/);
  assert.match(migration, /'music-analysis:' \|\| analysis\.id::text \|\| ':reserve'/);

  for (const functionName of [
    'schedule_song_analysis_retry',
    'complete_song_analysis_attempt',
    'fail_song_analysis_attempt',
  ]) {
    const start = migration.indexOf(`create or replace function public.${functionName}`);
    const end = migration.indexOf('create or replace function', start + 1);
    const body = migration.slice(start, end === -1 ? migration.length : end);
    assert.match(body, /analysis\.lease_token = p_lease_token/);
    assert.match(body, /analysis\.lease_expires_at > now\(\)/);
  }
});

test('analysis state and credit resolution commit through narrow RPCs', () => {
  assert.match(migration, /private\.resolve_known_ai_credit/);
  assert.match(migration, /private\.resolve_song_analysis_credit/);
  assert.match(
    migration,
    /revoke execute on function private\.resolve_known_ai_credit\([\s\S]*from public, anon, authenticated, service_role/,
  );
  assert.match(migration, /perform private\.resolve_song_analysis_credit\([\s\S]*'settled'/);
  assert.match(migration, /perform private\.resolve_song_analysis_credit\([\s\S]*'refunded'/);
  assert.match(
    migration,
    /grant execute on function public\.resolve_reconciled_show_generation_credit[\s\S]*to service_role/,
  );
  assert.match(
    migration,
    /revoke execute on function public\.resolve_reconciled_show_generation_credit[\s\S]*from public, anon, authenticated/,
  );
});

test('runner retries only transient failures and leaves pending work reserved', () => {
  assert.match(runner, /const MAX_ANALYSIS_ATTEMPTS = 3/);
  assert.match(runner, /const RETRY_DELAYS_SECONDS = \[30, 120\]/);
  assert.match(runner, /response\.status === 408/);
  assert.match(runner, /response\.status === 425/);
  assert.match(runner, /response\.status === 429/);
  assert.match(runner, /response\.status >= 500/);
  assert.match(runner, /claim_song_analysis_attempt/);
  assert.match(runner, /schedule_song_analysis_retry/);
  assert.match(runner, /complete_song_analysis_attempt/);
  assert.match(runner, /fail_song_analysis_attempt/);
  assert.match(runner, /p_lease_token: typedRow\.lease_token/);
  assert.match(starter, /if \(result\.pending\) return/);
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

test('reconciliation RPC grants are least privilege', () => {
  assert.match(
    migration,
    /revoke execute on function public\.expire_exhausted_song_analyses[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.expire_exhausted_song_analyses[\s\S]*to service_role/,
  );
  assert.match(
    migration,
    /revoke execute on function public\.claim_song_analysis_attempt[\s\S]*from public, anon/,
  );
  assert.match(
    migration,
    /grant execute on function public\.claim_song_analysis_attempt[\s\S]*to authenticated, service_role/,
  );
});
