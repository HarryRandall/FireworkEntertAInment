/** Static guards for cue generation waiting on upload-scoped music analysis. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

test('cue generation waits for running music analysis before prompting the LLM', () => {
  const loaders = readFileSync(join(root, 'lib/cue-generation/loaders.server.ts'), 'utf8');
  const runner = readFileSync(join(root, 'lib/cue-generation/runner.server.ts'), 'utf8');

  assert.match(loaders, /ANALYSIS_WAIT_TIMEOUT_MS = 20_000/);
  assert.match(loaders, /ANALYSIS_WAIT_INTERVAL_MS = 1_000/);
  assert.match(loaders, /export async function waitForAnalysisJson/);
  assert.match(loaders, /result\.status !== 'running'/);
  assert.match(loaders, /return \{ status: 'timeout', analysis: null \}/);
  assert.match(runner, /waitForAnalysisJson\(supabase, musicAnalysisId\)/);
  assert.match(runner, /analysisResult\.status === 'completed'/);
  assert.match(runner, /Music analysis is still finishing/);
});

test('synthetic beat fallback is only used when no music analysis id exists', () => {
  const runner = readFileSync(join(root, 'lib/cue-generation/runner.server.ts'), 'utf8');
  const prompt = readFileSync(join(root, 'lib/cue-generation/prompt.ts'), 'utf8');

  assert.match(runner, /musicAnalysisId\s*\?\s*waitForAnalysisJson/);
  assert.match(runner, /status: 'absent', analysis: null/);
  assert.match(runner, /Music analysis completed without usable output/);
  assert.match(prompt, /No AI song analysis was available/);
});
