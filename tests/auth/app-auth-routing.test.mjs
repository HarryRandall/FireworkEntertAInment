/** Static guards for app auth routing. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('proxy gates private app prefixes to /login?next=', () => {
  assert.equal(existsSync(join(root, 'middleware.ts')), false);
  assert.equal(existsSync(join(root, 'proxy.ts')), true);

  const proxy = read('proxy.ts');
  const routes = read('lib/auth/proxy-routes.ts');
  assert.match(routes, /PROTECTED_PREFIXES/);
  assert.doesNotMatch(routes, /APP_SURFACE_PREFIXES/);

  const protectedMatch = routes.match(/PROTECTED_PREFIXES = (\[[\s\S]*?\]) as const;/);
  assert.ok(protectedMatch, 'PROTECTED_PREFIXES array is declared');
  const protectedArray = protectedMatch[1];
  for (const prefix of [
    "'/shows'",
    "'/exports'",
    "'/settings'",
    "'/recommendations'",
    "'/admin'",
    "'/home'",
    "'/dashboard'",
  ]) {
    assert.match(protectedArray, new RegExp(prefix));
  }
  assert.doesNotMatch(protectedArray, /'\/library'/);
  assert.doesNotMatch(protectedArray, /'\/catalogue'/);

  // Protected routes honour the login ?next= round-trip and resolve the user
  // from signed claims.
  assert.match(proxy, /url\.pathname = '\/login'/);
  assert.match(proxy, /searchParams\.set\('next'/);
  assert.doesNotMatch(proxy, /isAppSurface/);
  assert.match(proxy, /new AuthClient/);
  assert.match(proxy, /auth\.getClaims\(\)/);
  assert.match(proxy, /matcher:/);

  const nextConfig = read('next.config.ts');
  assert.doesNotMatch(nextConfig, /supabase-example/);
});

test('developer-only routes are not shipped with the app', () => {
  assert.equal(existsSync(join(root, 'app/(dev)')), false);

  const proxy = read('proxy.ts');
  assert.doesNotMatch(proxy, /pathname === '\/dev'/);
});

test('proxy clears stale Supabase auth cookies instead of looping refresh errors', () => {
  const proxy = read('proxy.ts');
  const cookies = read('lib/auth/proxy-cookies.ts');
  const errors = read('lib/auth/proxy-errors.ts');

  assert.match(errors, /STALE_AUTH_ERROR_CODES/);
  assert.match(errors, /refresh_token_not_found/);
  assert.match(errors, /refresh_token_already_used/);
  assert.match(proxy, /clearSupabaseAuthCookies/);
  assert.match(proxy, /getSupabaseRelatedAuthCookieNames/);
  assert.match(proxy, /initialAuthCookieNames/);
  assert.match(cookies, /response\.cookies\.set\(name, '', EXPIRED_COOKIE_OPTIONS\)/);
  assert.match(proxy, /isStaleSupabaseAuthError\(error\)/);
  assert.match(errors, /refresh token is not valid/);
  assert.match(proxy, /skipAutoInitialize: true/);
  assert.match(cookies, /syncRequestCookieHeader\(request, requestHeaders\)/);
});

test('proxy does not call Supabase Auth for plain guest requests', () => {
  const proxy = read('proxy.ts');

  assert.match(proxy, /hasSupabaseSessionCookie/);
  assert.match(proxy, /if \(hasSupabaseSessionCookie\(request, env\.url\)\)/);
  assert.match(proxy, /new AuthClient/);
});

test('(app) layout requires an authenticated user before rendering the app shell', () => {
  const layout = read('app/(app)/layout.tsx');
  assert.match(layout, /import \{ redirect \} from 'next\/navigation'/);
  assert.match(layout, /if \(!userId\)/);
  assert.match(layout, /redirect\('\/login'\)/);
  assert.match(layout, /!profile \|\| profile\.status !== 'active'/);
  assert.match(layout, /redirect\('\/account-unavailable'\)/);
  assert.equal(existsSync(join(root, 'app/(marketing)/account-unavailable/page.tsx')), true);
  assert.doesNotMatch(layout, /isAuthenticated=/);
});

test('suspended profiles fail closed and access mutations invalidate authorisation caches', () => {
  const currentUser = read('lib/admin/current-user.server.ts');
  const actions = read('app/actions/admin-users.ts');

  assert.match(currentUser, /profile\.status !== 'active'/);
  assert.match(currentUser, /profile\.status !== 'active' \|\| !profile\.permissions\.includes/);
  assert.match(actions, /invalidateUserProfileCache/);
  assert.ok(actions.match(/invalidateUserProfileCache\(parsed\.data\.userId\)/g)?.length >= 4);
});

test('browse routes allow guests and retain the app shell for signed-in users', () => {
  for (const path of [
    'app/(browse)/layout.tsx',
    'app/(browse)/library/page.tsx',
    'app/(browse)/library/[id]/page.tsx',
    'app/(browse)/catalogue/page.tsx',
  ]) {
    assert.equal(existsSync(join(root, path)), true, `${path} exists`);
  }

  const layout = read('app/(browse)/layout.tsx');
  assert.match(layout, /getCurrentUserId/);
  assert.match(layout, /if \(!userId\)/);
  assert.match(layout, /<MarketingNavBar \/>/);
  assert.match(layout, /<MarketingFooter \/>/);
  assert.match(layout, /<AppShell/);
  assert.doesNotMatch(layout, /redirect\('\/login'/);
});

test('show detail layout requires a session before rendering tabs or children', () => {
  const layout = read('app/(app)/shows/[id]/layout.tsx');
  const chrome = read('app/(app)/shows/[id]/ShowDetailChrome.tsx');
  assert.match(layout, /getCurrentUserId/);
  assert.match(layout, /if \(!userId\)/);
  assert.match(
    layout,
    /redirect\(`\/login\?next=\$\{encodeURIComponent\(`\/shows\/\$\{id\}`\)\}`\)/,
  );
  assert.match(layout, /getShowBySlug/);
  assert.match(layout, /<ShowDetailChrome/);
  assert.match(layout, /forceContentOnly=\{show\.generationStatus === 'running'\}/);
  assert.match(chrome, /useSelectedLayoutSegment/);
  assert.match(chrome, /segment === 'generating'/);
});

test('AppShell is authenticated-only and keeps shipped navigation links', () => {
  const shell = read('components/shell/AppShell.tsx');
  const navigation = read('components/shell/app-shell-navigation.ts');

  assert.match(navigation, /href: '\/home', label: 'Home'/);
  assert.match(navigation, /href: '\/shows', label: 'My shows'/);
  assert.match(navigation, /href: '\/library', label: 'Explore'/);
  assert.match(navigation, /href: '\/catalogue', label: 'Catalogue'/);

  assert.doesNotMatch(shell, /isAuthenticated/);
  assert.doesNotMatch(shell, /isGuest/);
  assert.doesNotMatch(shell, /GUEST_NAV_HREFS/);
  assert.doesNotMatch(shell, /SidebarGuestFooter/);
});

test('clone template action sends unauthenticated users to /login and back to the template', () => {
  const action = read('app/actions/show-templates.ts');
  assert.match(
    action,
    /redirect\(`\/login\?next=\$\{encodeURIComponent\(`\/library\/\$\{slug\}`\)\}`\)/,
  );
});

test('RLS migration opens the browse tables to anon', () => {
  assert.equal(existsSync(join(root, 'supabase/migrations')), true);

  const migration = read('supabase/migrations/20260629153000_public_browse_anon_select.sql');
  assert.match(migration, /grant select on public\.show_presets to anon/);
  for (const table of [
    'show_presets',
    'fireworks',
    'catalogue_items',
    'multishots',
    'multishot_fireworks',
  ]) {
    assert.match(migration, new RegExp(`drop policy if exists .* on public\\.${table}`));
    assert.match(
      migration,
      new RegExp(`create policy .* on public\\.${table}[\\s\\S]*?for select using \\(true\\)`),
    );
  }
});
