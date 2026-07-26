/** Static guards for the confidence-aware downbeat beat/slot grid. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('CueSlot carries downbeat, bar, emphasis and finale metadata', () => {
  const beatGrid = read('lib/beat-grid.server.ts');

  assert.match(beatGrid, /export type SlotEmphasis = 'normal' \| 'accent' \| 'peak';/);
  assert.match(beatGrid, /export type CueSlot = \{/);
  assert.match(beatGrid, /isDownbeat: boolean;/);
  assert.match(beatGrid, /barPosition: number;/);
  assert.match(beatGrid, /emphasis: SlotEmphasis;/);
  assert.match(beatGrid, /finale: boolean;/);
});

test('buildCueSlots consumes downbeats and the derived finale window', () => {
  const beatGrid = read('lib/beat-grid.server.ts');

  assert.match(beatGrid, /analysis\?\.downbeat_times/);
  assert.match(beatGrid, /analysis\?\.bar_grid_confidence/);
  assert.match(beatGrid, /analysis\?\.derived\?\.finale_window/);
  // Downbeats lock sparse sections to one fire per bar; older 1.3.0 analyses
  // keep the original every-beat windowed fill so nothing regresses.
  assert.match(beatGrid, /barGridConfidence == null \|\| barGridConfidence >= 0\.3/);
  assert.match(beatGrid, /downbeatTimes\.length > 0 && !needsSynth && hasReliableBarGrid/);
  assert.match(beatGrid, /hasDownbeats && b\.isDownbeat/);
  assert.match(beatGrid, /if \(!hasDownbeats\) return true; \/\/ 1\.3\.0/);
});

test('the hosted analyser boundary requires the schema 1.5 bar-grid contract', () => {
  const runner = read('lib/show-analysis-runner.server.ts');
  const route = read('app/api/music-analysis/route.ts');

  assert.match(runner, /const ANALYSER_SCHEMA_VERSION = '1\.5\.0';/);
  assert.match(runner, /typeof result\.bar_grid_confidence !== 'number'/);
  assert.match(runner, /!\[2, 3, 4\]\.includes\(Number\(result\.beats_per_bar\)\)/);
  assert.match(route, /schema_version: '1\.5\.0'/);
});

test('chorus and drop beats always saturate all three tubes', () => {
  const beatGrid = read('lib/beat-grid.server.ts');

  assert.match(
    beatGrid,
    /function tubeCountForBeat\(beat: \{ intensity: number; nearClimax: boolean; vibe: SlotVibe \}\) \{/,
  );
  assert.match(
    beatGrid,
    /if \(beat\.intensity >= 0\.62 \|\| beat\.nearClimax \|\| beat\.vibe === 'chorus' \|\| beat\.vibe === 'drop'\) \{[\s\S]*?return 3;/,
  );
});

test('emphasis migration adds the validated emphasis column', () => {
  const migrationPath = 'supabase/migrations/20260628130000_show_timeline_items_emphasis.sql';
  assert.equal(existsSync(join(root, migrationPath)), true);

  const migration = read(migrationPath);
  assert.match(migration, /add column if not exists emphasis text not null default 'normal'/);
  assert.match(migration, /check \(emphasis in \('normal', 'accent', 'peak'\)\)/);
});
