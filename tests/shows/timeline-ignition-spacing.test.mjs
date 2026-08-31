import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

const migration = read(
  'supabase/migrations/20260831040939_separate_launch_spacing_from_visual_duration.sql',
);

test('database timeline safety separates ignition spacing from visual duration', () => {
  assert.match(migration, /create or replace function private\.show_launch_interval_seconds\(\)/);
  assert.match(migration, /select 0\.5::numeric/);
  assert.match(migration, /security invoker/);
  assert.match(
    migration,
    /first_item\.time_seconds[\s\S]*?second_item\.time_seconds \+ private\.show_launch_interval_seconds\(\)/,
  );
  assert.match(
    migration,
    /new\.time_seconds[\s\S]*?existing_item\.time_seconds \+ private\.show_launch_interval_seconds\(\)/,
  );
  assert.doesNotMatch(migration, /catalogue_item_safe_duration/);
});

test('the revised guards retain locking, occupied-position and privilege boundaries', () => {
  assert.match(migration, /^begin;/m);
  assert.match(migration, /lock table public\.show_timeline_items in share row exclusive mode/);
  assert.match(
    migration,
    /create or replace function private\.assert_show_timeline_non_overlapping\(\s*p_show_ids uuid\[\] default null::uuid\[\]\s*\)/,
  );
  assert.match(migration, /p_show_ids is null or first_item\.show_id = any\(p_show_ids\)/);
  assert.match(
    migration,
    /select private\.assert_show_timeline_non_overlapping\(null::uuid\[\]\);/,
  );
  assert.match(
    migration,
    /revoke execute on function private\.assert_show_timeline_non_overlapping\(uuid\[\]\)[\s\S]*?from public, anon, authenticated, service_role/,
  );
  assert.match(
    migration,
    /create or replace function private\.reject_overlapping_show_timeline_item\(\)[\s\S]*?security definer[\s\S]*?set search_path = ''/,
  );
  assert.match(migration, /for update;/);
  assert.match(migration, /private\.catalogue_item_occupied_launch_positions/);
  assert.match(migration, /using errcode = '23514'/);
  assert.match(
    migration,
    /revoke execute on function private\.reject_overlapping_show_timeline_item\(\)[\s\S]*?from public, anon, authenticated, service_role/,
  );
  assert.match(migration, /^commit;$/m);
});

test('all cue planners and final safety use the shared 0.5 second ignition interval', () => {
  const spacing = read('lib/cue-generation/launch-spacing.ts');
  const beat = read('lib/cue-generation/beat-sync-planner.ts');
  const fast = read('lib/cue-generation/fast-planner.ts');
  const runner = read('lib/cue-generation/runner.server.ts');

  assert.match(spacing, /GENERATED_LAUNCH_INTERVAL_SECONDS = 0\.5/);
  for (const source of [beat, fast, runner]) {
    assert.match(source, /GENERATED_LAUNCH_INTERVAL_SECONDS/);
  }
});
