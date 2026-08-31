/** Source guards for app navigation and security activity semantics. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('show tabs identify the current page and preserve keyboard focus', () => {
  const tabs = read('app/(app)/shows/[id]/ShowTabs.tsx');

  assert.match(tabs, /aria-label="Show sections"/);
  assert.match(tabs, /aria-current=\{active \? 'page' : undefined\}/);
  assert.match(tabs, /focus-visible:ring-3/);
  assert.match(tabs, /bg-\[color:var\(--accent\)\]/);
  assert.doesNotMatch(tabs, /border-b-2/);
});

test('show guide copy stays planner-neutral and operator-aware', () => {
  const guide = read('components/shows/ShowGuideList.tsx');

  assert.match(guide, /cue-by-cue plan/);
  assert.match(guide, /review with your operator/);
  assert.match(guide, /once show generation finishes/);
  assert.doesNotMatch(guide, /AI has choreographed|firing instructions/i);
});

test('security activity fails closed and formats semantic times on the client', () => {
  const activity = read('app/(app)/settings/security/RecentSecurityActivity.tsx');
  const localTime = read('app/(app)/settings/security/LocalSecurityEventTime.tsx');

  assert.match(activity, /error,[\s\S]*supabase\.auth\.getUser/);
  assert.match(activity, /if \(error\)[\s\S]*throw new Error/);
  assert.match(activity, /LocalSecurityEventTime/);
  assert.match(activity, /device&apos;s time zone/);
  assert.match(localTime, /useSyncExternalStore/);
  assert.match(localTime, /<time dateTime=\{value\}/);
  assert.match(localTime, /timeZoneName: 'short'/);
});
