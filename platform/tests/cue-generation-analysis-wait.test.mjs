/** Static guards for cue generation resuming after upload-scoped music analysis. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

test('cue generation leaves running music analysis pending instead of failing', () => {
  const loaders = readFileSync(join(root, 'lib/cue-generation/loaders.server.ts'), 'utf8');
  const runner = readFileSync(join(root, 'lib/cue-generation/runner.server.ts'), 'utf8');
  const schemas = readFileSync(join(root, 'lib/cue-generation/schemas.ts'), 'utf8');

  assert.match(loaders, /export async function loadAnalysisState/);
  assert.match(loaders, /without imposing a wall-clock cutoff/);
  assert.doesNotMatch(loaders, /ANALYSIS_WAIT_TIMEOUT_MS/);
  assert.doesNotMatch(loaders, /status: 'timeout'/);
  assert.match(runner, /loadAnalysisState\(supabase, musicAnalysisId\)/);
  assert.match(runner, /analysisResult\.status === 'completed'/);
  assert.match(runner, /analysisResult\.status === 'running'/);
  assert.match(runner, /reason: 'music_analysis_running'/);
  assert.match(schemas, /pending: true; reason: 'music_analysis_running'/);
  assert.doesNotMatch(runner, /Music analysis is still finishing/);
});

test('music analysis completion resumes linked running show generation', () => {
  const route = readFileSync(join(root, 'app/api/music-analysis/route.ts'), 'utf8');

  assert.match(route, /listRunningShowsForAnalysis/);
  assert.match(route, /resumeCueGenerationForCompletedAnalysis/);
  assert.match(route, /generateCuesForShow/);
  assert.match(route, /\.eq\('music_analysis_id', params\.musicAnalysisId\)/);
  assert.match(route, /\.eq\('generation_status', 'running'\)/);
  assert.match(route, /\.is\('generation_completed_at', null\)/);
  assert.match(route, /await resumeCueGenerationForCompletedAnalysis/);
  assert.match(route, /selected_cue_model, show_style/);
  assert.match(route, /\.from\('ai_credit_transactions'\)/);
  assert.match(route, /reservationAction === 'show_generation_fast'/);
  assert.match(route, /show\.show_style === 'beat_test'\s+\? 'beat'/);
  assert.match(route, /show\.selected_cue_model\s+\? 'llm'\s+: 'fast'/s);
});

test('show creation pins its effective generation mode for the runner', () => {
  const action = readFileSync(join(root, 'app/(app)/shows/new/actions.ts'), 'utf8');
  const runner = readFileSync(join(root, 'lib/cue-generation/runner.server.ts'), 'utf8');

  assert.match(action, /generationMode,/);
  assert.match(runner, /generationMode\?: GenerationMode \| 'beat'/);
  assert.match(runner, /params\.generationMode \?\? generationSettings\.generationMode/);
});

test('resumed generation preserves a configured model that is not in the wizard list', () => {
  const models = readFileSync(join(root, 'lib/cue-models.ts'), 'utf8');
  const openrouter = readFileSync(join(root, 'lib/openrouter.server.ts'), 'utf8');
  const runner = readFileSync(join(root, 'lib/cue-generation/runner.server.ts'), 'utf8');

  assert.match(models, /export function normalisePersistedCueModel/);
  assert.match(models, /trimmed\.length > 120/);
  assert.match(runner, /normalisePersistedCueModel/);
  assert.match(runner, /brief\.selected_cue_model \?\? selectedCueModel/);
  assert.doesNotMatch(runner, /normaliseCueModel\(/);
  assert.match(openrouter, /normalisePersistedCueModel/);
});

test('failed generation uses a safe, recoverable customer error state', () => {
  const page = readFileSync(join(root, 'app/(app)/shows/[id]/generating/page.tsx'), 'utf8');

  assert.match(page, /console\.error\('\[shows\/generating\] generation failed:'/);
  assert.doesNotMatch(page, /\{show\.generationError \?\?/);
  assert.match(page, /\(show\.generatedCueCount \?\? 0\) > 0/);
  assert.match(page, /Review show/);
  assert.match(page, /Back to My Shows/);
  assert.match(page, /Start another show/);
  assert.doesNotMatch(page, /Open preview/);
  assert.doesNotMatch(page, /bg-error|text-on-surface|text-primary/);
});

test('music analysis failure marks linked running show generation failed', () => {
  const route = readFileSync(join(root, 'app/api/music-analysis/route.ts'), 'utf8');

  assert.match(route, /markLinkedShowGenerationFailed/);
  assert.match(route, /markGenerationStatus/);
  assert.match(route, /Music analysis failed: \$\{params\.error\}/);
  assert.match(route, /generation_status: 'failed'/);
  assert.match(route, /generation_completed_at: new Date\(\)\.toISOString\(\)/);
});

test('synthetic beat fallback is only used when no music analysis id exists', () => {
  const runner = readFileSync(join(root, 'lib/cue-generation/runner.server.ts'), 'utf8');
  const prompt = readFileSync(join(root, 'lib/cue-generation/prompt.ts'), 'utf8');

  assert.match(runner, /musicAnalysisId\s*\?\s*loadAnalysisState/);
  assert.match(runner, /status: 'absent', analysis: null/);
  assert.match(runner, /Music analysis completed without usable output/);
  assert.match(prompt, /No AI song analysis was available/);
});
