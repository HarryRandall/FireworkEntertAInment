/** Source guards for stable settings chrome while account data loads. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('profile loading keeps headings, field labels and account actions visible', () => {
  const loading = read('app/(app)/settings/profile/loading.tsx');

  for (const text of [
    'Profile',
    'Full name',
    'Phone',
    'Email',
    'Interface theme',
    'Account',
    'Delete account',
  ]) {
    assert.match(loading, new RegExp(text));
  }
  assert.match(loading, /aria-busy="true"/);
  assert.doesNotMatch(loading, /<CardHeader>\s*<Skeleton/);
});

test('security loading keeps password and activity labels visible', () => {
  const loading = read('app/(app)/settings/security/loading.tsx');

  for (const text of [
    'Password',
    'Current password',
    'New password',
    'Confirm new password',
    'Recent activity',
    'Last sign-in',
    'Email confirmed',
    'Account created',
  ]) {
    assert.match(loading, new RegExp(text));
  }
  assert.match(loading, /aria-busy="true"/);
  assert.doesNotMatch(loading, /<CardHeader>\s*<Skeleton/);
});
