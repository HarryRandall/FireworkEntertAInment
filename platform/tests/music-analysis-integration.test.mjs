/** Static-analysis "grep the source" test guarding the music-analysis (analyser) integration invariants (do not modify test bodies). */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

test('audio analysis runner stores rich local song analysis JSON', () => {
  const route = readFileSync(join(root, 'app/api/analyse/route.ts'), 'utf8');
  const runner = readFileSync(join(root, 'lib/show-analysis-runner.server.ts'), 'utf8');

  assert.match(route, /runShowAnalysisForShow/);
  assert.match(runner, /runMusicAnalysisForUpload/);
  assert.match(runner, /audio_path: typedShow\.audio_path/);
  assert.match(runner, /runner_version: ANALYSER_RUNNER_VERSION/);
  assert.match(runner, /runHostedAnalyser/);
  assert.match(runner, /ANALYSER_URL/);
  assert.match(runner, /ANALYSER_SHARED_SECRET/);
  assert.match(runner, /buildAiContextMarkdown/);
  assert.match(runner, /analysis_json: analysis as unknown as Json/);
  assert.match(runner, /llm_payload: null/);
  assert.match(runner, /markdown: contextMarkdown/);
  assert.match(runner, /# AI Song Context/);
  assert.doesNotMatch(route, /compact_payload/);
  assert.doesNotMatch(route, /analysis_storage_path/);
  assert.doesNotMatch(runner, /['"]--no-json-file['"]/);
  assert.doesNotMatch(runner, /['"]--json['"]/);
  assert.doesNotMatch(runner, /['"]--llm-out['"]/);
  assert.doesNotMatch(runner, /payload_type: ['"]numeric_song_analysis['"]/);
  assert.doesNotMatch(runner, /firework_cue_samples/);
  assert.doesNotMatch(runner, /firework_cue_summary/);
});

test('show analysis succeeds only after the completed row is confirmed', () => {
  const runner = readFileSync(join(root, 'lib/show-analysis-runner.server.ts'), 'utf8');
  const showRunner = runner.slice(runner.indexOf('export async function runShowAnalysisForShow'));

  assert.match(
    showRunner,
    /\.eq\('id', analysisId\)\s+\.eq\('user_id', params\.userId\)\s+\.eq\('status', 'running'\)\s+\.select\('id'\)\s+\.maybeSingle\(\)/,
  );
  assert.match(showRunner, /if \(!completed\) \{[\s\S]*analysis record was not updated/);
  assert.ok(showRunner.indexOf('if (!completed)') < showRunner.indexOf('return { ok: true'));
});

test('analyser warm-up is opt-in from the admin dashboard', () => {
  const modalApp = readFileSync(join(root, 'analyser/modal_app.py'), 'utf8');
  const adminPage = readFileSync(join(root, 'app/(admin)/admin/page.tsx'), 'utf8');
  const warmControl = readFileSync(
    join(root, 'app/(admin)/admin/AnalyserWarmthControl.tsx'),
    'utf8',
  );
  const warmLib = readFileSync(join(root, 'lib/analyser-warmth.server.ts'), 'utf8');
  const warmRoute = readFileSync(join(root, 'app/api/admin/analyser/warm/route.ts'), 'utf8');

  assert.match(modalApp, /payload\.get\("warmup"\) is True/);
  assert.doesNotMatch(modalApp, /min_containers=1/);
  assert.doesNotMatch(modalApp, /buffer_containers=1/);
  assert.doesNotMatch(modalApp, /scaledown_window=/);
  assert.match(adminPage, /AnalyserWarmthControl/);
  assert.match(warmControl, /Keep warm 30 min/);
  assert.match(warmControl, /Keep the analyser warm for 30 minutes/);
  assert.match(warmControl, /pingAnalyserWarmthAction/);
  assert.match(warmControl, /BROWSER_WARMUP_INTERVAL_MS = 45 \* 1000/);
  assert.match(warmLib, /WARM_WINDOW_MS = 30 \* 60 \* 1000/);
  assert.match(warmLib, /JSON\.stringify\(\{ warmup: true \}\)/);
  assert.match(warmRoute, /refreshAnalyserWarmth/);
  assert.equal(existsSync(join(root, 'vercel.json')), false);
});

test('Modal audio downloads are bounded and cannot redirect across hosts', () => {
  const modalApp = readFileSync(join(root, 'analyser/modal_app.py'), 'utf8');
  const audioDownload = readFileSync(join(root, 'analyser/audio_download.py'), 'utf8');

  assert.match(audioDownload, /MAX_AUDIO_BYTES = 50 \* 1024 \* 1024/);
  assert.match(audioDownload, /DOWNLOAD_TOTAL_TIMEOUT_SECONDS = 30/);
  assert.match(audioDownload, /deadline = monotonic\(\) \+ DOWNLOAD_TOTAL_TIMEOUT_SECONDS/);
  assert.match(audioDownload, /parsed\.scheme != "https"/);
  assert.match(audioDownload, /class SameHostRedirectHandler/);
  assert.match(audioDownload, /audio_url redirected to a different host/);
  assert.match(audioDownload, /downloaded > MAX_AUDIO_BYTES/);
  assert.match(audioDownload, /downloaded != content_length/);
  assert.match(audioDownload, /error_code="audio_response_truncated"/);
  assert.match(modalApp, /add_local_python_source\("showcrafter", "audio_download"\)/);
  assert.match(modalApp, /except AudioInputError as exc/);
  assert.match(modalApp, /detail=exc\.as_http_detail\(\)/);
  assert.doesNotMatch(modalApp, /urlretrieve\(/);
});

test('show creation attaches analysed music and starts cue generation', () => {
  const action = readFileSync(join(root, 'app/(app)/shows/new/actions.ts'), 'utf8');

  assert.match(action, /musicAnalysisId: z\.string\(\)\.uuid\(\)\.optional\(\)/);
  assert.match(action, /\.from\('song_analyses'\)/);
  assert.match(action, /music_analysis_id: musicAnalysisId/);
  assert.match(action, /generation_status: 'running'/);
  assert.match(action, /after\(async \(\) =>/);
  assert.match(action, /generateCuesForShow/);
  assert.equal(action.includes('redirect(`/shows/${slug}/preview`)'), false);
  assert.match(action, /return \{ ok: true, slug: show\.slug \}/);
});

test('music analyses migration creates upload-scoped analysis rows', () => {
  const migration = readFileSync(
    join(root, 'supabase/migrations/20260525090000_music_analyses_show_generation.sql'),
    'utf8',
  );
  const renameMigration = readFileSync(
    join(root, 'supabase/migrations/20260614132007_schema_firework_catalogue_rework.sql'),
    'utf8',
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.music_analyses/);
  assert.match(migration, /analysis_json jsonb/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS music_analysis_id uuid/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS generation_status text/);
  assert.match(migration, /music_analyses_select_own/);
  assert.match(
    renameMigration,
    /alter table if exists public\.music_analyses rename to song_analyses/,
  );
  assert.doesNotMatch(renameMigration, /create view public\.music_analyses/);
  assert.match(renameMigration, /drop view if exists public\.music_analyses/);
});

test('show analyses migration matches the current database contract', () => {
  const migration = readFileSync(
    join(root, 'supabase/migrations/20260512090000_show_analyses.sql'),
    'utf8',
  );

  assert.match(migration, /audio_path text NOT NULL/);
  assert.match(migration, /personality text NOT NULL DEFAULT 'balanced'/);
  assert.match(migration, /runner_version text/);
  assert.match(migration, /llm_payload jsonb/);
  assert.match(migration, /completed_at timestamptz/);
  assert.doesNotMatch(migration, /personality_preset/);
  assert.doesNotMatch(migration, /source_audio_path/);
  assert.doesNotMatch(migration, /compact_payload/);
  assert.doesNotMatch(migration, /analysis_storage_path/);
});

test('show analyses repair migration relaxes legacy not-null columns', () => {
  const migration = readFileSync(
    join(root, 'supabase/migrations/20260518071112_repair_show_analyses_legacy_columns.sql'),
    'utf8',
  );

  assert.match(migration, /ADD COLUMN IF NOT EXISTS audio_path text/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS llm_payload jsonb/);
  assert.match(migration, /source_audio_path DROP NOT NULL/);
  assert.match(migration, /personality_preset DROP NOT NULL/);
});

test('show song context exposes stored analysis context', () => {
  const page = readFileSync(join(root, 'app/(app)/shows/[id]/timeline/page.tsx'), 'utf8');
  const indexPage = readFileSync(join(root, 'app/(app)/shows/[id]/page.tsx'), 'utf8');
  const timeline = readFileSync(join(root, 'app/components/app/AudioAnalysisTimeline.tsx'), 'utf8');
  const splashPath = join(root, 'app/components/app/GeneratingShowAnimation.tsx');
  const generatorPath = join(root, 'lib/cue-generation.server.ts');
  assert.equal(existsSync(splashPath), true);
  assert.equal(existsSync(generatorPath), true);

  assert.match(indexPage, /import \{ redirect \} from 'next\/navigation'/);
  assert.match(indexPage, /redirect\(`\/shows\/\$\{encodeURIComponent\(id\)\}\/preview`\)/);
  assert.doesNotMatch(indexPage, /ReplayPanelSkeleton/);
  assert.doesNotMatch(indexPage, /ShowPreviewRedirect/);
  assert.match(page, /ShowSongContextPage/);
  assert.match(page, /getLatestAnalysisForShow\(show\.id\)/);
  assert.match(page, /getSoundtrackAttribution\(show\.musicAnalysisId\)/);
  assert.match(page, /Promise\.all/);
  assert.match(page, /generationStatus === 'running'/);
  assert.match(page, /<AudioAnalysisTimeline/);
  assert.match(page, /hasAudio=\{Boolean\(show\.audioPath\)\}/);
  assert.match(page, /initialAnalysis=\{latestAnalysis\}/);
  assert.match(page, /soundtrackAttribution=\{soundtrackAttribution\}/);
  assert.match(timeline, /Song context/);
  assert.match(timeline, /SoundtrackProfile/);
  assert.match(timeline, /contextMarkdown/);
  assert.match(timeline, /buildKpis/);
  assert.match(timeline, /\/api\/shows\/\$\{encodeURIComponent\(showId\)\}\/analysis/);
  assert.doesNotMatch(timeline, /router\.refresh/);
  assert.doesNotMatch(timeline, /Run analysis/);
  assert.doesNotMatch(timeline, /Re-run/);
  assert.doesNotMatch(page, /GenerateShowPanel/);
});
