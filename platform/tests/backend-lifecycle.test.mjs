/** Static guards for durable cue work, dead letters, and audio retention. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const migration = readFileSync(
  join(root, 'supabase/migrations/20260727103000_backend_lifecycle_operations.sql'),
  'utf8',
);
const runner = readFileSync(join(root, 'lib/cue-generation/runner.server.ts'), 'utf8');
const reconcile = readFileSync(join(root, 'app/api/admin/analyser/reconcile/route.ts'), 'utf8');
const healthRoute = readFileSync(join(root, 'app/api/admin/backend-lifecycle/route.ts'), 'utf8');

test('cue generation has bounded token-fenced attempts', () => {
  assert.match(migration, /generation_attempt_count integer not null default 0/);
  assert.match(migration, /generation_lease_token uuid/);
  assert.match(migration, /generation_lease_expires_at timestamptz/);
  assert.match(migration, /generation_next_retry_at timestamptz/);
  assert.match(migration, /check \(generation_attempt_count between 0 and 3\)/);
  assert.match(migration, /create or replace function public\.claim_cue_generation_attempt/);
  assert.match(migration, /for update skip locked/);
  assert.match(migration, /reservation\.reference_type = 'shows'/);
  assert.match(migration, /analysis\.status in \('completed', 'failed'\)/);
  assert.match(migration, /generation_lease_token = p_lease_token/);
  assert.match(runner, /const MAX_CUE_GENERATION_ATTEMPTS = 3/);
  assert.match(runner, /const CUE_RETRY_DELAYS_SECONDS = \[30, 120\]/);
  assert.match(runner, /claim_cue_generation_attempt/);
  assert.match(runner, /schedule_cue_generation_retry/);
});

test('cue terminal state and credits resolve in one guarded transaction', () => {
  assert.match(migration, /create or replace function public\.complete_cue_generation_attempt/);
  assert.match(migration, /stored_cue_count <> p_cue_count/);
  assert.match(
    migration,
    /update public\.shows[\s\S]*generation_status = 'completed'[\s\S]*private\.resolve_known_ai_credit/,
  );
  assert.match(migration, /create or replace function public\.fail_cue_generation_attempt/);
  assert.match(
    migration,
    /generation_status = 'failed'[\s\S]*private\.resolve_known_ai_credit[\s\S]*'refunded'/,
  );
  assert.match(runner, /complete_cue_generation_attempt/);
  assert.match(runner, /fail_cue_generation_attempt/);
  assert.doesNotMatch(runner, /settleAiCreditReservation|refundAiCreditReservation/);
});

test('exhausted work is observable through least-privilege dead letters', () => {
  assert.match(migration, /create table if not exists public\.backend_dead_letters/);
  assert.match(migration, /alter table public\.backend_dead_letters enable row level security/);
  assert.match(migration, /create policy backend_dead_letters_service_role_manage/);
  assert.match(
    migration,
    /revoke all on public\.backend_dead_letters from public, anon, authenticated/,
  );
  assert.match(migration, /private\.upsert_backend_dead_letter/);
  assert.match(migration, /private\.record_exhausted_song_analysis_dead_letter/);
  assert.match(migration, /after update of status on public\.song_analyses/);
  assert.match(migration, /create or replace function public\.expire_exhausted_cue_generations/);
  assert.match(migration, /'stale_lease_exhausted'/);
  assert.match(migration, /create or replace function public\.get_backend_lifecycle_health/);
  assert.match(healthRoute, /process\.env\.CRON_SECRET/);
  assert.match(healthRoute, /get_backend_lifecycle_health/);
  assert.match(healthRoute, /resolve_backend_dead_letter/);
});

test('audio retention preserves referenced work and removes aged private objects', () => {
  assert.match(migration, /create or replace function public\.purge_expired_song_analyses/);
  assert.match(migration, /p_retention_days integer default 7/);
  assert.match(migration, /show_record\.music_analysis_id = analysis\.id/);
  assert.match(migration, /show_record\.audio_path = analysis\.audio_path/);
  assert.match(migration, /reservation\.status = 'settled'/);
  assert.match(migration, /reservation\.status = 'refunded'/);
  assert.match(migration, /create or replace function public\.list_orphan_audio_objects/);
  assert.match(migration, /p_grace_hours integer default 24/);
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

test('worker-only operations explicitly revoke customer execution', () => {
  for (const functionName of [
    'expire_exhausted_cue_generations',
    'purge_expired_song_analyses',
    'list_orphan_audio_objects',
    'get_backend_lifecycle_health',
    'resolve_backend_dead_letter',
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke execute on function public\\.${functionName}\\([\\s\\S]*?from public, anon, authenticated`,
      ),
    );
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${functionName}\\([\\s\\S]*?to service_role`),
    );
  }
});
