/** Source guards for repeated-navigation access and conservative safety copy. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

test('public, app and admin chrome expose a working skip link target', () => {
  const skipLink = read('components/design-system/SkipLink.tsx');
  assert.match(skipLink, /href = '#main-content'/);
  assert.match(skipLink, /Skip to main content/);
  assert.match(skipLink, /focus:translate-y-0/);

  for (const path of [
    'app/(marketing)/layout.tsx',
    'app/(browse)/layout.tsx',
    'components/shell/AppShell.tsx',
    'components/admin/AdminShell.tsx',
  ]) {
    const source = read(path);
    assert.match(source, /<SkipLink \/>/, path);
    assert.match(source, /id="main-content"/, path);
    assert.match(source, /tabIndex=\{-1\}/, path);
  }
});

test('standalone and marketing pages keep one main content landmark', () => {
  const notFound = read('app/not-found.tsx');
  const accountUnavailable = read('app/(marketing)/account-unavailable/page.tsx');

  assert.match(notFound, /<main[\s\S]*id="main-content"/);
  assert.doesNotMatch(accountUnavailable, /<main/);
  assert.match(accountUnavailable, /aria-labelledby="account-unavailable-title"/);
});

test('safety guidance states product limits and points to official sources', () => {
  const safety = read('app/(app)/safety/page.tsx');
  const navigation = read('components/shell/app-shell-navigation.ts');
  const rootLayout = read('app/layout.tsx');

  assert.match(safety, /Safety and legal checks happen outside ShowCrafter/);
  assert.match(safety, /does not determine whether fireworks may\s+be purchased or used/);
  assert.match(safety, /Queensland Explosives Inspectorate/);
  assert.match(safety, /www\.rshq\.qld\.gov\.au/);
  assert.match(safety, /Do not use this page as an operational firing guide/);
  assert.doesNotMatch(safety, /30 km\/h|Wait at least fifteen minutes|sealed water bucket/);
  assert.match(navigation, /href: '\/safety', label: 'Safety', icon: TriangleAlert \}/);
  assert.doesNotMatch(navigation, /href: '\/safety'[^\n]*permission:/);
  assert.doesNotMatch(rootLayout, /local store|let AI choreograph/);
});
