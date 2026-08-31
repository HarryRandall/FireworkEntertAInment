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
  const helper = read('components/shell/sign-out.client.ts');

  assert.match(helper, /const \{ error \} = await createClient\(\)\.auth\.signOut\(\)/);
  assert.match(helper, /if \(error\)/);
  assert.match(helper, /catch \(error\)/);
  assert.match(helper, /return \{ ok: false, error:/);
  assert.match(helper, /return \{ ok: true \}/);
});

test('app and admin shells redirect only after confirmed sign-out', () => {
  for (const path of ['components/shell/AppShell.tsx', 'components/admin/AdminShell.tsx']) {
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

test('account deletion reports partial session cleanup instead of claiming full sign-out', () => {
  const account = read('app/actions/account.ts');
  const login = read('app/(auth)/login/page.tsx');
  const deletion = account.slice(account.indexOf('export async function deleteAccountAction'));

  assert.match(deletion, /const \{ error: signOutError \} = await supabase\.auth\.signOut\(\)/);
  assert.match(deletion, /if \(signOutError\)/);
  assert.match(deletion, /catch \(signOutError\)/);
  assert.match(deletion, /clearLocalSupabaseAuthCookies\(cookieStore\)/);
  assert.match(deletion, /redirect\('\/login\?deleted=1&session_cleanup=partial'\)/);
  assert.ok(
    deletion.indexOf('admin.auth.admin.deleteUser(user.id)') <
      deletion.indexOf('await supabase.auth.signOut()'),
  );
  assert.match(login, /accountSessionCleanupPartial/);
  assert.match(login, /complete session cleanup could not be confirmed/);
  assert.match(login, /Other access tokens may remain valid until they expire/);
});
