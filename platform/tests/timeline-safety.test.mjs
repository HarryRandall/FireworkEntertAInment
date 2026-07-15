/** Static guards for database-owned show timeline safety. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

const migration = read('supabase/migrations/20260715100857_enforce_show_timeline_safety.sql');

test('timeline overlap is a conservative database invariant', () => {
  assert.match(migration, /private\.catalogue_item_safe_duration/);
  assert.match(
    migration,
    /create or replace function private\.reject_overlapping_show_timeline_item\(\)[\s\S]*?security definer[\s\S]*?set search_path = ''/,
  );
  assert.match(migration, /existing_item\.launch_position_index = new\.launch_position_index/);
  assert.match(
    migration,
    /new\.time_seconds[\s\S]*?< existing_item\.time_seconds[\s\S]*?existing_item\.time_seconds[\s\S]*?< new\.time_seconds \+ candidate_duration/,
  );
  assert.match(
    migration,
    /create trigger show_timeline_items_reject_overlap[\s\S]*?before insert or update/,
  );
  assert.match(migration, /using errcode = '23514'/);
});

test('timeline mutations use active-owner security definer RPCs', () => {
  for (const functionName of [
    'replace_show_timeline_items',
    'add_show_timeline_item',
    'delete_show_timeline_item',
    'add_refinement_cue_and_settle_credits',
  ]) {
    assert.match(
      migration,
      new RegExp(
        `create or replace function public\\.${functionName}\\([\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`,
      ),
    );
  }
  assert.match(migration, /not coalesce\(public\.current_user_is_active\(\), false\)/);
  assert.match(migration, /p_user_id is distinct from actor_id/);
  assert.ok((migration.match(/for update;/g) ?? []).length >= 4);
  assert.ok(
    (migration.match(/select coalesce\(max\(timeline_item\.position\), 0\) \+ 1/g) ?? []).length >=
      2,
  );
  assert.match(
    migration,
    /revoke all privileges on table public\.show_timeline_items[\s\S]*?from authenticated;[\s\S]*?grant select on table public\.show_timeline_items/,
  );
  for (const operation of ['insert', 'update', 'delete']) {
    assert.match(
      migration,
      new RegExp(`drop policy if exists show_timeline_items_${operation}_via_show`),
    );
  }
});

test('application timeline writes use the guarded RPC surface', () => {
  const previewActions = read('app/actions/preview-cues.ts');
  const templateActions = read('app/actions/show-templates.ts');
  const adapter = read('lib/show-timeline-mutations.server.ts');

  assert.match(previewActions, /addShowTimelineItem/);
  assert.match(previewActions, /deleteShowTimelineItem/);
  assert.match(previewActions, /error\?\.code === '23514'/);
  assert.match(previewActions, /That launch position became busy\./);
  assert.doesNotMatch(
    previewActions,
    /\.from\('show_timeline_items'\)\s*\.(?:insert|update|delete)\(/,
  );

  assert.match(templateActions, /rpc\(\s*'replace_show_timeline_items'/);
  assert.match(templateActions, /replacedCount !== timelineItems\.length/);
  assert.doesNotMatch(templateActions, /\.from\('show_timeline_items'\)\s*\.insert\(/);

  assert.match(adapter, /functionName: 'add_show_timeline_item'/);
  assert.match(adapter, /functionName: 'delete_show_timeline_item'/);
  assert.match(adapter, /client as unknown as TimelineMutationRpcClient/);
  assert.doesNotMatch(adapter, /p_position/);
  assert.doesNotMatch(previewActions, /lastCueError/);
});
