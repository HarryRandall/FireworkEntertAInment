/** Static guards for guest browsing with auth-gated creation. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('proxy gates private route prefixes, leaves browse routes public, and redirects to /login?next=', () => {
  assert.equal(existsSync(join(root, 'middleware.ts')), false);
  assert.equal(existsSync(join(root, 'proxy.ts')), true);

  const proxy = read('proxy.ts');
  assert.match(proxy, /PROTECTED_PREFIXES/);

  // The protected list must keep the private prefixes and drop the browse ones.
  const protectedMatch = proxy.match(/PROTECTED_PREFIXES = (\[[\s\S]*?\]);/);
  assert.ok(protectedMatch, 'PROTECTED_PREFIXES array is declared');
  const protectedArray = protectedMatch[1];
  for (const prefix of [
    "'/shows'",
    "'/exports'",
    "'/settings'",
    "'/recommendations'",
    "'/admin'",
  ]) {
    assert.match(protectedArray, new RegExp(prefix));
  }
  for (const browse of ["'/home'", "'/catalogue'", "'/library'", "'/dashboard'"]) {
    assert.doesNotMatch(protectedArray, new RegExp(browse));
  }

  // Must honour the login ?next= round-trip and resolve the user from claims.
  assert.match(proxy, /url\.pathname = '\/login'/);
  assert.match(proxy, /searchParams\.set\('next'/);
  assert.match(proxy, /supabase\.auth\.getClaims\(\)/);
  assert.match(proxy, /matcher:/);

  // Dev diagnostics must not be public in production.
  const nextConfig = read('next.config.ts');
  assert.match(proxy, /pathname === '\/dev'/);
  assert.match(proxy, /process\.env\.NODE_ENV === 'development'/);
  assert.match(proxy, /NextResponse\.rewrite\(new URL\('\/404'/);
  assert.doesNotMatch(nextConfig, /supabase-example/);
});

test('(app) layout no longer hard-redirects guests to /login', () => {
  const layout = read('app/(app)/layout.tsx');
  assert.doesNotMatch(layout, /redirect\('\/login'\)/);
  assert.doesNotMatch(layout, /import \{ redirect \} from 'next\/navigation'/);
});

test('AppShell renders a guest-aware nav and sign-in footer without removing shipped links', () => {
  const shell = read('app/components/app/AppShell.tsx');

  // Guest filtering is runtime; the full link set stays for authenticated users.
  assert.match(shell, /href: '\/home', label: 'Home'/);
  assert.match(shell, /href: '\/shows', label: 'My shows'/);
  assert.match(shell, /href: '\/library', label: 'Explore'/);
  assert.match(shell, /href: '\/catalogue', label: 'Catalogue'/);

  // Guest nav allow-list and sign-in / create-account footer.
  assert.match(shell, /GUEST_NAV_HREFS/);
  assert.match(shell, /isGuest && !GUEST_NAV_HREFS\.has\(link\.href\)/);
  assert.match(shell, /SidebarGuestFooter/);
  assert.match(shell, /href="\/login"/);
  assert.match(shell, /href="\/signup"/);
  assert.match(shell, /isGuest \? \(/);
});

test('clone template action sends guests to /login and back to the template', () => {
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
