/** Static guards for audited admin impersonation. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('impersonation migration adds a dedicated permission and audit table', () => {
  const migrationPath = 'supabase/migrations/20260531090000_admin_impersonation.sql';
  assert.equal(existsSync(join(root, migrationPath)), true);
  const migration = read(migrationPath);

  assert.match(migration, /'admin\.impersonate_users'/);
  assert.match(migration, /from public\.roles r[\s\S]*r\.key = 'admin'/);
  assert.match(migration, /create table if not exists public\.impersonation_sessions/);
  assert.match(migration, /return_token_hash text not null unique/);
  assert.match(migration, /admin_user_id uuid not null references auth\.users/);
  assert.match(migration, /target_user_id uuid not null references auth\.users/);
  assert.match(migration, /public\.current_user_has_permission\('admin\.impersonate_users'\)/);
  assert.match(migration, /grant select on public\.impersonation_sessions to authenticated/);

  const types = read('lib/admin.types.ts');
  assert.match(types, /'admin\.impersonate_users'/);
});

test('start impersonation is permission-gated, audited, and switches via Supabase magic link', () => {
  const actions = read('app/actions/impersonation.ts');

  assert.match(actions, /requirePermission\('admin\.impersonate_users'\)/);
  assert.match(actions, /createServiceRoleSupabase\(\)/);
  assert.match(actions, /Configure SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(actions, /You cannot impersonate your own account/);
  assert.match(actions, /target\.status !== 'active'/);
  assert.doesNotMatch(actions, /Admin users cannot be impersonated/);
  assert.doesNotMatch(actions, /target\.roles\.includes\('admin'\)/);
  assert.match(actions, /\.from\('impersonation_sessions'\)[\s\S]*\.insert\(/);
  assert.match(actions, /return_token_hash: hashReturnToken\(returnToken\)/);
  assert.match(actions, /generateLink\(\{\s*type: 'magiclink'/);
  assert.match(actions, /verifyOtp\(\{\s*token_hash: tokenHash,\s*type: 'magiclink'/);
  assert.doesNotMatch(actions, /access_token|refresh_token/);
});

test('stop impersonation restores the admin session and clears the return cookie', () => {
  const actions = read('app/actions/impersonation.ts');

  assert.match(actions, /export async function stopImpersonationAction/);
  assert.match(actions, /cookieStore\.get\(IMPERSONATION_RETURN_COOKIE\)/);
  assert.match(actions, /\.eq\('return_token_hash', hashReturnToken\(returnToken\)\)/);
  assert.match(actions, /requestClient\.auth\.getUser\(\)/);
  assert.match(actions, /currentUser\?\.id !== session\.target_user_id/);
  assert.match(actions, /This impersonation session is no longer active/);
  const stopActionIndex = actions.indexOf('export async function stopImpersonationAction');
  assert.ok(
    actions.indexOf('currentUser?.id !== session.target_user_id') <
      actions.indexOf('restoreAdminSession(', stopActionIndex),
  );
  assert.match(actions, /restoreAdminSession/);
  assert.match(actions, /markImpersonationEnded\(service, session\.id, reason\)/);
  assert.match(actions, /clearReturnCookie\(cookieStore\)/);
  assert.match(actions, /redirect\(`\/admin\/users\/\$\{session\.target_user_id\}`\)/);
});

test('security mutations and UI are guarded while impersonating', () => {
  const account = read('app/actions/account.ts');
  const profilePage = read('app/(app)/settings/profile/page.tsx');
  const securityPage = read('app/(app)/settings/security/page.tsx');
  const signOut = read('app/(app)/settings/SignOutButton.tsx');

  assert.match(account, /hasImpersonationCookie/);
  assert.match(account, /Password changes are disabled while impersonating a user/);
  assert.match(account, /Account deletion is disabled while impersonating a user/);
  assert.match(profilePage, /getActiveImpersonation/);
  assert.match(profilePage, /DeleteAccountSection disabled=\{isImpersonating\}/);
  assert.match(securityPage, /PasswordChangeForm disabled=\{isImpersonating\}/);
  assert.match(signOut, /stopImpersonationAction\('sign_out'\)/);
});

test('admin user detail starts impersonation instead of showing a placeholder', () => {
  const headerActions = read('app/(admin)/admin/users/[id]/UserHeaderActions.tsx');
  const detailPage = read('app/(admin)/admin/users/[id]/page.tsx');

  assert.match(headerActions, /startImpersonationAction/);
  assert.match(headerActions, /Start impersonating/);
  assert.doesNotMatch(headerActions, /Impersonation is not yet available/);
  assert.match(detailPage, /getCurrentProfile/);
  assert.match(detailPage, /user\.status === 'active'/);
  assert.match(detailPage, /user\.id !== currentProfile\.id/);
  assert.doesNotMatch(detailPage, /!user\.roles\.includes\('admin'\)/);
});

test('admin users table exposes row impersonation and quick identity copying', () => {
  const rowActions = read('app/(admin)/admin/users/UserRowActions.tsx');
  const usersPage = read('app/(admin)/admin/users/page.tsx');
  const inlineCopy = read('app/(admin)/admin/users/InlineCopyButton.tsx');

  assert.match(rowActions, /startImpersonationAction/);
  assert.match(rowActions, /label: 'Impersonate'/);
  assert.doesNotMatch(rowActions, /label: 'View'/);
  assert.match(usersPage, /canStartImpersonation/);
  assert.match(usersPage, /user\.id !== currentProfile\?\.id/);
  assert.match(usersPage, /InlineCopyButton/);
  assert.match(usersPage, /hover:underline/);
  assert.match(inlineCopy, /navigator\.clipboard\.writeText\(value\)/);
  assert.match(inlineCopy, /group-hover\/identity:opacity-100/);
});

test('shells render a persistent stop-impersonating control above the profile card', () => {
  const adminLayout = read('app/(admin)/layout.tsx');
  const adminShell = read('app/components/admin/AdminShell.tsx');
  const layout = read('app/(app)/layout.tsx');
  const shell = read('app/components/app/AppShell.tsx');
  const banner = read('app/components/app/ImpersonationBanner.tsx');

  assert.match(layout, /getActiveImpersonation/);
  assert.match(adminLayout, /getActiveImpersonation/);
  assert.match(shell, /ImpersonationBanner/);
  assert.match(shell, /impersonation=\{impersonation\}/);
  assert.match(adminShell, /ImpersonationBanner/);
  assert.match(adminShell, /impersonation=\{impersonation\}/);
  assert.match(banner, /Impersonating/);
  assert.match(banner, /Stop/);
  assert.match(banner, /stopImpersonationAction/);
  assert.match(banner, /collapsed/);
});
