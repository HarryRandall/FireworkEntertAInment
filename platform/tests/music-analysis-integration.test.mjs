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
  assert.match(runner, /buildAiContextMarkdown/);
  assert.match(runner, /analysis_json: analysis as unknown as Json/);
  assert.match(runner, /llm_payload: null/);
  assert.match(runner, /markdown: contextMarkdown/);
  assert.match(runner, /# AI Song Context/);
  assert.match(runner, /"--no-json-file"/);
  assert.match(runner, /"--json"/);
  assert.doesNotMatch(route, /compact_payload/);
  assert.doesNotMatch(route, /analysis_storage_path/);
  assert.doesNotMatch(runner, /"--llm-out"/);
  assert.doesNotMatch(runner, /payload_type: "numeric_song_analysis"/);
  assert.doesNotMatch(runner, /firework_cue_samples/);
  assert.doesNotMatch(runner, /firework_cue_summary/);
});

test('music upload starts analysis before final show creation', () => {
  const action = readFileSync(join(root, 'app/(app)/shows/new/actions.ts'), 'utf8');

  assert.match(action, /startMusicAnalysisAction/);
  assert.match(action, /after\(async \(\) =>/);
  assert.match(action, /runMusicAnalysisForUpload/);
  assert.match(action, /music_analysis_id: musicAnalysisId/);
  assert.doesNotMatch(action, /generateCuesForShow/);
  assert.equal(action.includes('redirect(`/shows/${slug}/preview`)'), false);
});

test('music analyses migration creates upload-scoped analysis rows', () => {
  const migration = readFileSync(
    join(root, 'supabase/migrations/20260525090000_music_analyses_show_generation.sql'),
    'utf8',
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.music_analyses/);
  assert.match(migration, /analysis_json jsonb/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS music_analysis_id uuid/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS generation_status text/);
  assert.match(migration, /music_analyses_select_own/);
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

test('show timeline exposes stored context and manual show generation', () => {
  const page = readFileSync(join(root, 'app/(app)/shows/[id]/page.tsx'), 'utf8');
  const timeline = readFileSync(join(root, 'app/components/app/AudioAnalysisTimeline.tsx'), 'utf8');
  const panelPath = join(root, 'app/components/app/ShowGenerationPanel.tsx');
  const actionPath = join(root, 'app/actions/show-generation.ts');
  const plannerPath = join(root, 'lib/music-cue-planner.ts');
  assert.equal(existsSync(panelPath), false);
  assert.equal(existsSync(actionPath), false);
  assert.equal(existsSync(plannerPath), false);

  assert.match(page, /Stored song context/);
  assert.match(page, /GenerateShowPanel/);
  assert.match(page, /latestAnalysis\?\.contextMarkdown/);
  assert.match(timeline, /Song context/);
  assert.match(timeline, /window\.setInterval\(\(\) => router\.refresh\(\), 5000\)/);
  assert.doesNotMatch(timeline, /Run analysis/);
  assert.doesNotMatch(timeline, /Re-run/);
  assert.doesNotMatch(page, /latestAnalysis\?\.llmPayload/);
});
