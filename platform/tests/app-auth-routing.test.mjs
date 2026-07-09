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
  assert.match(proxy, /PROTECTED_PREFIXES/);
  assert.doesNotMatch(proxy, /APP_SURFACE_PREFIXES/);

  const protectedMatch = proxy.match(/PROTECTED_PREFIXES = (\[[\s\S]*?\]);/);
  assert.ok(protectedMatch, 'PROTECTED_PREFIXES array is declared');
  const protectedArray = protectedMatch[1];
  for (const prefix of [
    "'/shows'",
    "'/exports'",
    "'/settings'",
    "'/recommendations'",
    "'/admin'",
    "'/home'",
    "'/library'",
    "'/catalogue'",
    "'/dashboard'",
  ]) {
    assert.match(protectedArray, new RegExp(prefix));
  }

  // Protected routes honour the login ?next= round-trip and resolve the user
  // from signed claims.
  assert.match(proxy, /url\.pathname = '\/login'/);
  assert.match(proxy, /searchParams\.set\('next'/);
  assert.doesNotMatch(proxy, /isAppSurface/);
  assert.match(proxy, /new AuthClient/);
  assert.match(proxy, /auth\.getClaims\(\)/);
  assert.match(proxy, /matcher:/);

  // Dev diagnostics must not be public in production.
  const nextConfig = read('next.config.ts');
  assert.match(proxy, /pathname === '\/dev'/);
  assert.match(proxy, /process\.env\.NODE_ENV === 'development'/);
  assert.match(proxy, /NextResponse\.rewrite\(new URL\('\/404'/);
  assert.doesNotMatch(nextConfig, /supabase-example/);
});

test('proxy clears stale Supabase auth cookies instead of looping refresh errors', () => {
  const proxy = read('proxy.ts');

  assert.match(proxy, /STALE_AUTH_ERROR_CODES/);
  assert.match(proxy, /refresh_token_not_found/);
  assert.match(proxy, /refresh_token_already_used/);
  assert.match(proxy, /clearSupabaseAuthCookies/);
  assert.match(proxy, /getSupabaseRelatedAuthCookieNames/);
  assert.match(proxy, /initialAuthCookieNames/);
  assert.match(proxy, /response\.cookies\.set\(name, '', EXPIRED_COOKIE_OPTIONS\)/);
  assert.match(proxy, /isStaleSupabaseAuthError\(error\)/);
  assert.match(proxy, /refresh token is not valid/);
  assert.match(proxy, /skipAutoInitialize: true/);
  assert.match(proxy, /syncRequestCookieHeader\(request, requestHeaders\)/);
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
  assert.doesNotMatch(layout, /isAuthenticated=/);
});

test('show detail layout requires a session before rendering tabs or children', () => {
  const layout = read('app/(app)/shows/[id]/layout.tsx');
  assert.match(layout, /getCurrentUserId/);
  assert.match(layout, /if \(!userId\)/);
  assert.match(
    layout,
    /redirect\(`\/login\?next=\$\{encodeURIComponent\(`\/shows\/\$\{id\}`\)\}`\)/,
  );
  assert.match(layout, /getShowBySlug/);
});

test('AppShell is authenticated-only and keeps shipped navigation links', () => {
  const shell = read('app/components/app/AppShell.tsx');

  assert.match(shell, /href: '\/home', label: 'Home'/);
  assert.match(shell, /href: '\/shows', label: 'My shows'/);
  assert.match(shell, /href: '\/library', label: 'Explore'/);
  assert.match(shell, /href: '\/catalogue', label: 'Catalogue'/);

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
