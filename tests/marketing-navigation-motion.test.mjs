/** Static guards for accessible, dependency-free marketing navigation motion. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('the mobile navigation is an accessible disclosure', () => {
  const navigation = read('app/components/marketing/NavBar.tsx');

  assert.match(navigation, /const mobileMenuId = useId\(\)/);
  assert.match(navigation, /aria-controls=\{mobileMenuId\}/);
  assert.match(navigation, /aria-expanded=\{open\}/);
  assert.match(navigation, /aria-hidden=\{!open\}/);
  assert.match(navigation, /inert=\{!open\}/);
  assert.match(navigation, /data-state=\{open \? 'open' : 'closed'\}/);
  assert.match(navigation, /event\.key !== 'Escape'/);
  assert.match(navigation, /mobileMenuTriggerRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(navigation, /role="menu(?:item)?"/);
});

test('marketing navigation motion uses transform and opacity with a reduced-motion fallback', () => {
  const navigation = read('app/components/marketing/NavBar.tsx');
  const css = read('app/globals.css');
  const mobileMenuStart = css.indexOf('.lp-mobile-menu {');
  const mobileMenuEnd = css.indexOf('/* New-show wizard', mobileMenuStart);
  const mobileMenuStyles = css.slice(mobileMenuStart, mobileMenuEnd);
  const reducedMotionStart = css.indexOf('@media (prefers-reduced-motion: reduce)');
  const reducedMotionEnd = css.indexOf('/*\n ---break---', reducedMotionStart);
  const reducedMotionStyles = css.slice(reducedMotionStart, reducedMotionEnd);

  assert.notEqual(mobileMenuStart, -1);
  assert.match(mobileMenuStyles, /opacity 0\.18s ease/);
  assert.match(mobileMenuStyles, /transform 0\.18s cubic-bezier/);
  assert.doesNotMatch(mobileMenuStyles, /^\s*height\s*:/m);
  assert.doesNotMatch(mobileMenuStyles, /visibility/);
  assert.match(reducedMotionStyles, /\.lp-mobile-menu[\s\S]*transition: none !important/);
  assert.match(css, /\.lp-menu:focus-within \.lp-menu-panel/);
  assert.doesNotMatch(navigation, /AnimatePresence|<motion\.|height: 'auto'/);
});

test('Framer Motion is absent from the marketing navigation and dependency manifests', () => {
  const navigation = read('app/components/marketing/NavBar.tsx');
  const pkg = JSON.parse(read('package.json'));
  const lockfile = read('package-lock.json');

  assert.doesNotMatch(navigation, /framer-motion/);
  assert.equal(pkg.dependencies?.['framer-motion'], undefined);
  assert.doesNotMatch(lockfile, /node_modules\/framer-motion/);
});
