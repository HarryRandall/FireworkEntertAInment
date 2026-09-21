/** Static guards for database-owned show timeline safety. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}
const overlapHelper = read('lib/cue-overlap.server.ts');

test('application duration checks use the same conservative sources as the database', () => {
  assert.match(overlapHelper, /greatestPositiveDuration\(itemDuration, directDuration\)/);
  assert.match(overlapHelper, /greatestPositiveDuration\(directSafeDuration, multishotDuration\)/);
  assert.match(overlapHelper, /catalogue_items\(duration_seconds\)/);
  assert.match(overlapHelper, /Math\.ceil\(/);
  assert.doesNotMatch(overlapHelper, /if \(itemDuration != null\) return itemDuration/);
});

test('application timeline writes use the guarded RPC surface', () => {
  const previewActions = read('lib/shows/cue-actions.server.ts');
  const templateActions = read('lib/show-templates/clone-actions.server.ts');
  const adapter = read('lib/show-timeline-mutations.server.ts');

  assert.match(previewActions, /addShowTimelineItem/);
  assert.match(previewActions, /deleteShowTimelineItem/);
  assert.match(previewActions, /error\?\.code === '23514'/);
  assert.match(previewActions, /That launch position became busy\./);
  assert.doesNotMatch(previewActions, /getProductDurationSeconds|findTubeOverlap/);
  assert.doesNotMatch(previewActions, /existingCues|schedule validation failed/);
  assert.doesNotMatch(
    previewActions,
    /\.select\('id, time_seconds, catalogue_item_id, description'\)/,
  );
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
