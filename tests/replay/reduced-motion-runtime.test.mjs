/** Static guards for runtime reduced-motion behaviour outside CSS transitions. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('the shared preference hook is reactive and conservative during server rendering', () => {
  const hook = read('hooks/use-prefers-reduced-motion.ts');

  assert.match(hook, /useSyncExternalStore/);
  assert.match(hook, /\(prefers-reduced-motion: reduce\)/);
  assert.match(hook, /addEventListener\('change', onPreferenceChange\)/);
  assert.match(hook, /removeEventListener\('change', onPreferenceChange\)/);
  assert.match(hook, /function getServerSnapshot\(\) \{[\s\S]*?return true;/);
});

test('hover and focus replay providers do not start WebGL previews for reduced motion', () => {
  const showReplay = read('app/(app)/shows/ShowReplayPreviewContext.tsx');
  const exploreReplay = read('components/explore/ExplorePreviewContext.tsx');

  for (const source of [showReplay, exploreReplay]) {
    assert.match(source, /usePrefersReducedMotion\(\)/);
    assert.match(source, /if \(prefersReducedMotion\) return;/);
    assert.match(source, /if \(!prefersReducedMotion\) return;\s+cancelActivePreview\(\);/);
  }

  assert.match(showReplay, /mountedPreview && !prefersReducedMotion/);
  assert.match(exploreReplay, /mountedPreview && !prefersReducedMotion/);
});

test('legacy shader covers use their stable gradient instead of mounting WebGL', () => {
  const shaderCover = read('components/covers/ShaderCover.tsx');

  assert.match(shaderCover, /const prefersReducedMotion = usePrefersReducedMotion\(\)/);
  assert.match(
    shaderCover,
    /const shouldShowSkeleton = showSkeletonUntilReady && !prefersReducedMotion/,
  );
  assert.match(shaderCover, /\{!prefersReducedMotion \? shader : null\}/);
  assert.match(shaderCover, /\{!animate \|\| prefersReducedMotion \? \(/);
});

test('Explore shelves replace smooth programmatic scrolling for reduced motion', () => {
  const exploreRow = read('components/explore/ExploreRow.tsx');

  assert.match(exploreRow, /behavior: prefersReducedMotion \? 'auto' : 'smooth'/);
  assert.match(exploreRow, /prefersReducedMotion \? 'scroll-auto' : 'scroll-smooth'/);
});
