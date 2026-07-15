/** Guards for truthful sign-out feedback across app and admin entry points. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('the shared sign-out helper treats returned and thrown failures as errors', () => {
  const helper = read('app/components/app/sign-out.client.ts');

  assert.match(helper, /const \{ error \} = await createClient\(\)\.auth\.signOut\(\)/);
  assert.match(helper, /if \(error\)/);
  assert.match(helper, /catch \(error\)/);
  assert.match(helper, /return \{ ok: false, error:/);
  assert.match(helper, /return \{ ok: true \}/);
});

test('app and admin shells redirect only after confirmed sign-out', () => {
  for (const path of ['app/components/app/AppShell.tsx', 'app/components/admin/AdminShell.tsx']) {
    const shell = read(path);

    assert.match(shell, /signOutCurrentSession/);
    assert.match(
      shell,
      /const result = await signOutCurrentSession\(\);[\s\S]*?if \(!result\.ok\) \{[\s\S]*?toast\.error\(result\.error\);[\s\S]*?return;[\s\S]*?router\.replace\('\/login'\)/,
    );
    assert.doesNotMatch(shell, /auth\.signOut\(/);
    assert.match(shell, /disabled=\{isSigningOut\}/);
    assert.match(shell, /aria-busy=\{isSigningOut\}/);
    assert.match(shell, /isSigningOut \? 'Signing out\.\.\.' : 'Log out'/);
  }
});

test('the settings sign-out button stays on the page and becomes retryable after failure', () => {
  const button = read('app/(app)/settings/SignOutButton.tsx');

  assert.match(button, /signOutCurrentSession/);
  assert.match(
    button,
    /if \(!result\.ok\) \{[\s\S]*?toast\.error\(result\.error\);[\s\S]*?setPending\(false\);[\s\S]*?return;/,
  );
  assert.match(button, /router\.replace\('\/login'\)/);
  assert.doesNotMatch(button, /auth\.signOut\(/);
  assert.match(button, /loading=\{pending\}/);
});
