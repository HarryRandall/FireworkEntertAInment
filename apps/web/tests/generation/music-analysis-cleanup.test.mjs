import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const route = readFileSync(join(root, 'app/api/music-analysis/route.ts'), 'utf8');
const page = readFileSync(
  join(root, 'app/(app)/shows/new/_components/NewShowPageClient.tsx'),
  'utf8',
);
const runner = readFileSync(join(root, 'lib/show-analysis-runner.server.ts'), 'utf8');
const starter = readFileSync(join(root, 'lib/start-music-analysis.server.ts'), 'utf8');

test('music analysis DELETE is authenticated, ownership-scoped, and idempotent', () => {
  assert.match(route, /export async function DELETE\(request: Request\)/);
  assert.match(route, /musicAnalysisId: z\.string\(\)\.uuid\(\)/);
  assert.match(route, /!isUserAudioPath\(parsed\.data\.audioPath, user\.id\)/);
  assert.match(route, /supabase\.rpc\('discard_unused_song_analysis'/);
  assert.match(route, /p_analysis_id: parsed\.data\.musicAnalysisId/);
  assert.match(route, /p_audio_path: parsed\.data\.audioPath/);
  assert.match(route, /supabase\.storage\.from\('audio'\)\.remove\(\[audioPath\]\)/);
  assert.match(route, /result\?\.code === 'in_use'/);
});

test('the analyser cannot settle or restore a row discarded during an in-flight run', () => {
  const uploadRunner = runner.slice(
    runner.indexOf('export async function runMusicAnalysisForUpload'),
    runner.indexOf('export async function runShowAnalysisForShow'),
  );
  assert.match(uploadRunner, /claim_song_analysis_attempt/);
  assert.match(uploadRunner, /complete_song_analysis_attempt/);
  assert.match(uploadRunner, /p_lease_token: typedRow\.lease_token/);
  assert.match(uploadRunner, /classifyUnclaimedMusicAnalysis/);
  assert.match(runner, /if \(!row\) \{[\s\S]*cancelled: true/);
  assert.match(starter, /if \(result\.cancelled\) \{[\s\S]*refundAiCreditReservation/);
});

test('replacing or clearing ready audio and stale POST responses trigger cleanup', () => {
  assert.match(page, /async function cleanupUnusedMusicAnalysis/);
  assert.match(page, /if \(uploaded\.reusedAnalysis\) return/);
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

  const uploadStart = page.indexOf('const uploadAudioAndStartAnalysis');
  const successfulPost = page.slice(
    page.indexOf('const uploaded = {', uploadStart),
    page.indexOf('return uploaded;', uploadStart),
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
