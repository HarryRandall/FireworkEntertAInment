/** Focused guards for retryable My Shows preview loading and overlay positioning. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8').replaceAll('\r\n', '\n');
}

test('failed cue requests remain retryable and only successful responses are cached', () => {
  const source = read('app/(app)/shows/ShowReplayPreviewContext.tsx');
  const start = source.indexOf('const confirmPreview = useCallback');
  const end = source.indexOf('const requestPreview = useCallback', start);
  const confirmPreview = source.slice(start, end);

  assert.match(
    confirmPreview,
    /cues = await getShowReplayPreviewCues\(show\.id\);\s+cueCacheRef\.current\.set\(show\.id, cues\);/,
  );
  assert.doesNotMatch(confirmPreview, /catch \(error\) \{[\s\S]*?cues = \[\]/);
  assert.doesNotMatch(confirmPreview, /catch \(error\) \{[\s\S]*?cueCacheRef\.current\.set/);
  assert.match(
    confirmPreview,
    /catch \(error\) \{[\s\S]*?requestSerialRef\.current !== serial[\s\S]*?setPending[\s\S]*?parkOverlay\(\);\s+return;/,
  );
});

test('the fixed overlay is measured on demand instead of on every animation frame', () => {
  const source = read('app/(app)/shows/ShowReplayPreviewContext.tsx');
  const start = source.indexOf('useEffect(() => {\n    const overlay = overlayRef.current;');
  const end = source.indexOf('\n\n  return (', start);
  const positioningEffect = source.slice(start, end);

  assert.match(positioningEffect, /const positionOverlay = \(\) =>/);
  assert.match(positioningEffect, /const schedulePosition = \(\) =>/);
  assert.match(positioningEffect, /requestAnimationFrame\(positionOverlay\)/);
  assert.match(positioningEffect, /window\.addEventListener\('resize', schedulePosition\)/);
  assert.match(positioningEffect, /new ResizeObserver\(schedulePosition\)/);
  assert.match(positioningEffect, /resizeObserver\?\.observe\(active\.element\)/);
  assert.doesNotMatch(positioningEffect, /requestAnimationFrame\(follow\)/);
  assert.doesNotMatch(positioningEffect, /const follow =/);
});

test('reduced motion and ready-gated poster behaviour remain intact', () => {
  const provider = read('app/(app)/shows/ShowReplayPreviewContext.tsx');
  const card = read('app/(app)/shows/ShowReplayCoverCard.tsx');

  assert.match(provider, /if \(prefersReducedMotion\) return;/);
  assert.match(provider, /mountedPreview && !prefersReducedMotion/);
  assert.match(provider, /readyId: ready \? \(active\?\.id \?\? null\) : null/);
  assert.match(card, /const isPreviewRevealed = preview\?\.readyId === show\.id/);
  assert.match(card, /isPreviewRevealed \? 'opacity-0' : 'opacity-100'/);
});
