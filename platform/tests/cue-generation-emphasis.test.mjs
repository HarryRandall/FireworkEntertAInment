/** Static guards for the per-cue emphasis field end to end (schema 1.4.0). */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('LLM assignment schema allows an optional emphasis override', () => {
  const schemas = read('lib/cue-generation/schemas.ts');

  assert.match(
    schemas,
    /export const CUE_EMPHASIS_VALUES = \['normal', 'accent', 'peak'\] as const;/,
  );
  assert.match(schemas, /emphasis: z\.enum\(CUE_EMPHASIS_VALUES\)\.optional\(\),/);
});

test('cue runner replaces show_timeline_items transactionally with emphasis', () => {
  const runner = read('lib/cue-generation/runner.server.ts');
  const fastPlanner = read('lib/cue-generation/fast-planner.ts');
  const beatSync = read('lib/cue-generation/beat-sync-planner.ts');
  const migration = read('supabase/migrations/20260629092959_replace_show_timeline_items_rpc.sql');
  const types = read('lib/database.types.ts');

  // Reconstructed cue carries emphasis, defaulting to the slot's computed value.
  assert.match(runner, /emphasis: CueEmphasis;/);
  assert.match(runner, /const emphasis = a\.emphasis \?\? slot\.emphasis;/);
  assert.match(runner, /impactTimeSeconds: timing\.impactTimeSeconds,[\s\S]*?emphasis,/);
  // Both planner paths produce emphasis-bearing cues.
  assert.match(fastPlanner, /emphasis: CueEmphasis;/);
  assert.match(fastPlanner, /const emphasis: CueEmphasis = isSurprise/);
  assert.match(fastPlanner, /direction\.softEnding && slot\.finale/);
  assert.match(fastPlanner, /emphasis,\s+\};/);
  assert.match(beatSync, /const emphasis = emphasisForTarget/);
  // The DB replacement row includes emphasis and goes through one RPC.
  assert.match(
    runner,
    /launch_position_index: cue\.tube,[\s\S]*?emphasis: cue\.emphasis,[\s\S]*?\}\)\);/,
  );
  assert.match(runner, /rpc\(\s*'replace_show_timeline_items'/);
  assert.doesNotMatch(runner, /\.from\('show_timeline_items'\)[\s\S]*?\.delete\(\)/);
  assert.match(migration, /create or replace function public\.replace_show_timeline_items/);
  assert.match(migration, /delete from public\.show_timeline_items/);
  assert.match(migration, /insert into public\.show_timeline_items/);
  assert.match(migration, /emphasis text/);
  assert.match(types, /replace_show_timeline_items: \{/);
});

test('show cue projection, select and mapper thread emphasis through to replay', () => {
  const showTypes = read('lib/shows/types.ts');
  const showMappers = read('lib/shows/mappers.ts');
  const showDomain = read('lib/show-domain.ts');

  assert.match(showTypes, /\| 'emphasis'/);
  assert.match(showTypes, /launch_position_index, emphasis'/);
  assert.match(showDomain, /emphasis\?: 'normal' \| 'accent' \| 'peak';/);
  assert.match(showMappers, /emphasis: normaliseEmphasis\(row\.emphasis\),/);
  assert.match(
    showMappers,
    /function normaliseEmphasis\(value: string \| null \| undefined\): 'normal' \| 'accent' \| 'peak'/,
  );
});

test('renderer scales the design by per-cue emphasis in fireCue', () => {
  const design = read('lib/fireworks/design.ts');
  const engine = read('lib/fireworks/FireworksEngine.ts');

  assert.match(design, /export function scaleDesignForEmphasis\(/);
  assert.match(design, /const EMPHASIS_SCALE: Record<'normal' \| 'accent' \| 'peak', number> = \{/);
  assert.match(design, /normal: 1\.0,/);
  assert.match(design, /accent: 1\.2,/);
  assert.match(design, /peak: 1\.5,/);
  assert.match(engine, /scaleDesignForEmphasis,/);
  assert.match(engine, /const design = scaleDesignForEmphasis\(baseDesign, cue\.emphasis\);/);
});

test('manual cue add accepts an optional emphasis, defaulting to normal', () => {
  const action = read('app/actions/preview-cues.ts');

  assert.match(action, /emphasis: z\.enum\(\['normal', 'accent', 'peak'\]\)\.default\('normal'\),/);
  assert.match(action, /emphasis: formData\.get\('emphasis'\) \?\? 'normal',/);
  assert.match(action, /emphasis: parsed\.data\.emphasis,/);
});
