/** Static guards for keeping cue generation on the faster path. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();
const openrouter = readFileSync(join(root, 'lib/openrouter.server.ts'), 'utf8');
const beatGrid = readFileSync(join(root, 'lib/beat-grid.server.ts'), 'utf8');
const prompt = readFileSync(join(root, 'lib/cue-generation/prompt.ts'), 'utf8');
const fastPlanner = readFileSync(join(root, 'lib/cue-generation/fast-planner.ts'), 'utf8');
const runner = readFileSync(join(root, 'lib/cue-generation/runner.server.ts'), 'utf8');
const schemas = readFileSync(join(root, 'lib/cue-generation/schemas.ts'), 'utf8');
const envExample = readFileSync(join(root, '.env.example'), 'utf8');

test('cue generation defaults to the faster OpenRouter model while keeping env override', () => {
  assert.match(
    openrouter,
    /DEFAULT_CUE_MODEL = process\.env\.OPENROUTER_CUE_MODEL \?\? 'openai\/gpt-4\.1-mini'/,
  );
  assert.match(envExample, /defaults to openai\/gpt-4\.1-mini/);
});

test('cue generation defaults to local fast planning instead of waiting on OpenRouter', () => {
  assert.match(
    runner,
    /generationMode = process\.env\.CUE_GENERATION_MODE === 'llm' \? 'llm' : 'fast'/,
  );
  assert.match(runner, /if \(generationMode === 'fast'\)/);
  assert.match(runner, /planCuesFast\(/);
  assert.match(fastPlanner, /export function planCuesFast/);
  assert.match(fastPlanner, /MAX_FAST_CUES = 110/);
  assert.match(envExample, /default fast local planner/);
});

test('cue slot target and response cap stay reduced', () => {
  assert.match(beatGrid, /const TARGET_SLOTS = 160;/);
  assert.match(beatGrid, /const MAX_TARGET_SLOTS = 220;/);
  assert.match(prompt, /Constraints: cues\.length 1–360/);
  assert.match(schemas, /z\.array\(AssignmentSchema\)\.min\(1\)\.max\(360\)/);
  assert.doesNotMatch(beatGrid, /const TARGET_SLOTS = 240;/);
  assert.doesNotMatch(schemas, /\.max\(640\)/);
});

test('catalogue prompt projection is compact', () => {
  assert.match(prompt, /compactText\(product\.description, 140\)/);
  assert.match(prompt, /Object\.keys\(effects\)\.length/);
  assert.doesNotMatch(prompt, /description: product\.description/);
  assert.doesNotMatch(prompt, /crackle: spec\?\.crackle \?\? false/);
});

test('cue generation emits server timing logs for the critical stages', () => {
  assert.match(runner, /console\.info\('\[cue-generation\] timings'/);
  assert.match(runner, /model,/);
  assert.match(runner, /slotCount,/);
  assert.match(runner, /catalogueCount,/);
  assert.match(runner, /acceptedCount,/);
  assert.match(runner, /droppedCount,/);
  assert.match(runner, /promptBytes,/);
  assert.match(runner, /fastPlanMs:/);
  assert.match(runner, /llmMs:/);
  assert.match(runner, /totalMs:/);
  assert.match(runner, /max_tokens: 5000/);
});
