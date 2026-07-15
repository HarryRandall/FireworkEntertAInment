/** Focused guards for keyboard, pending, empty, and reduced-motion UI states. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

function read(path) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

test('show creation keeps file focus visible without forcing mobile keyboard focus', () => {
  const upload = read('app/(app)/shows/new/_components/AudioUpload.tsx');
  const wizard = read('app/(app)/shows/new/page.tsx');

  assert.match(upload, /has-\[input:focus-visible\]:ring-3/);
  assert.match(upload, /has-\[input:focus-visible\]:ring-offset-2/);
  assert.doesNotMatch(wizard, /\bautoFocus\b/);
});

test('privileged user row actions lock and report pending work', () => {
  const actions = read('app/(admin)/admin/users/UserRowActions.tsx');
  const menu = read('app/components/ui/RowActionsMenu.tsx');

  assert.match(actions, /const \[isPending, startTransition\] = useTransition\(\)/);
  assert.match(actions, /<RowActionsMenu\s+busy=\{isPending\}/);
  assert.match(actions, /disabled=\{isPending\}/);
  assert.match(actions, /aria-busy=\{isPending \|\| undefined\}/);
  assert.match(actions, /isPending \? 'Starting…' : 'Start impersonating'/);
  assert.match(actions, /isPending \? 'Deleting…' : 'Delete'/);
  assert.match(menu, /disabled=\{busy\}/);
  assert.match(menu, /aria-busy=\{busy \|\| undefined\}/);
});

test('admin users explain empty results and replay controls respect reduced motion', () => {
  const users = read('app/(admin)/admin/users/page.tsx');
  const replay = read('app/components/app/FireworkReplayViewer.tsx');

  assert.match(users, /paginated\.length === 0/);
  assert.match(users, /No users match the current filters\./);
  assert.match(users, /No users have been added yet\./);
  assert.match(replay, /transition-opacity duration-300 motion-reduce:transition-none/);
  assert.doesNotMatch(replay, /bottom-6 z-20 transition-all/);
});
