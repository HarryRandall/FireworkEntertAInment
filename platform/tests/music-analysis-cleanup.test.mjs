import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const route = readFileSync(join(root, 'app/api/music-analysis/route.ts'), 'utf8');
const page = readFileSync(join(root, 'app/(app)/shows/new/page.tsx'), 'utf8');
const runner = readFileSync(join(root, 'lib/show-analysis-runner.server.ts'), 'utf8');
const migration = readFileSync(
  join(root, 'supabase/migrations/20260710020448_discard_unused_song_analyses.sql'),
  'utf8',
);

test('music analysis DELETE is authenticated, ownership-scoped, and idempotent', () => {
  assert.match(route, /export async function DELETE\(request: Request\)/);
  assert.match(route, /musicAnalysisId: z\.string\(\)\.uuid\(\)/);
  assert.match(route, /!isUserAudioPath\(parsed\.data\.audioPath, user\.id\)/);
  assert.match(route, /supabase\.rpc\('discard_unused_song_analysis'/);
  assert.match(route, /p_analysis_id: parsed\.data\.musicAnalysisId/);
  assert.match(route, /p_audio_path: parsed\.data\.audioPath/);
  assert.match(route, /supabase\.storage\.from\('audio'\)\.remove\(\[audioPath\]\)/);
  assert.match(route, /result\?\.code === 'in_use'/);
  assert.match(migration, /if not found then[\s\S]*'alreadyDeleted', true/);
});

test('discard RPC serialises ownership, show references, and credit state', () => {
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/);
  assert.match(migration, /where id = p_analysis_id\s+and user_id = v_user_id\s+for update/);
  assert.match(migration, /if v_analysis\.audio_path <> p_audio_path/);
  assert.match(
    migration,
    /if exists \([\s\S]*from public\.shows[\s\S]*music_analysis_id = v_analysis\.id/,
  );
  assert.match(migration, /if v_reservation_status = 'reserved'/);
  assert.match(migration, /if v_analysis\.status = 'completed'/);
  assert.match(migration, /public\.settle_ai_credit_reservation/);
  assert.match(migration, /public\.refund_ai_credit_reservation/);
  assert.match(migration, /delete from public\.song_analyses/);
  assert.match(
    migration,
    /revoke execute on function public\.discard_unused_song_analysis\(uuid, text\)\s+from public, anon/,
  );
  assert.match(
    migration,
    /grant execute on function public\.discard_unused_song_analysis\(uuid, text\)\s+to authenticated/,
  );
});

test('the analyser cannot settle or restore a row discarded during an in-flight run', () => {
  const uploadRunner = runner.slice(
    runner.indexOf('export async function runMusicAnalysisForUpload'),
    runner.indexOf('export async function runShowAnalysisForShow'),
  );
  assert.match(uploadRunner, /\.eq\('status', 'running'\)\s+\.select\('id'\)\s+\.maybeSingle\(\)/);
  assert.match(uploadRunner, /if \(!completed\) \{[\s\S]*cancelled: true/);
  assert.match(uploadRunner, /if \(failureState === 'missing'\) \{[\s\S]*cancelled: true/);
  assert.match(route, /if \(result\.cancelled\) \{[\s\S]*refundAiCreditReservation/);
});

test('replacing or clearing ready audio and stale POST responses trigger cleanup', () => {
  assert.match(page, /async function cleanupUnusedMusicAnalysis/);
  assert.match(page, /method: 'DELETE'/);
  assert.match(page, /musicAnalysisId: uploaded\.musicAnalysisId/);
  assert.match(page, /audioPath: uploaded\.audioPath/);

  const fileHandler = page.slice(
    page.indexOf('const onFilePicked'),
    page.indexOf('const clearAudio'),
  );
  assert.match(fileHandler, /if \(uploadedAudio\) discardUploadedAudio\(uploadedAudio\)/);

  const clearHandler = page.slice(
    page.indexOf('const clearAudio'),
    page.indexOf('const chooseNoSoundtrack'),
  );
  assert.match(clearHandler, /if \(uploadedAudio\) discardUploadedAudio\(uploadedAudio\)/);

  const noSoundtrackHandler = page.slice(
    page.indexOf('const chooseNoSoundtrack'),
    page.indexOf('const uploadAudioAndStartAnalysis'),
  );
  assert.match(noSoundtrackHandler, /clearAudio\(\)/);

  const successfulPost = page.slice(
    page.indexOf('const uploaded = {\n      audioPath'),
    page.indexOf('return uploaded;'),
  );
  assert.match(successfulPost, /if \(uploadTokenRef\.current !== token\)/);
  assert.match(successfulPost, /await cleanupUnusedMusicAnalysis\(uploaded\)/);

  const failedGenerate = page.slice(
    page.indexOf('const result = await createShowAction(data)'),
    page.indexOf('// Collision:', page.indexOf('const result = await createShowAction(data)')),
  );
  assert.match(failedGenerate, /if \(!result\.ok\)/);
  assert.match(failedGenerate, /await cleanupUnusedMusicAnalysis\(finalUploadedAudio\)/);
});
