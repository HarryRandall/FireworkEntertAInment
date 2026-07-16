/** Focused guards for the shared single-canvas firework browse preview. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('browse previews share one ready-gated and abort-safe canvas', () => {
  const source = read('app/components/app/FireworkBrowsePreviewContext.tsx');

  assert.match(source, /const HOVER_INTENT_MS = 500/);
  assert.match(source, /const previewCache = new Map<string, CachedPreview>/);
  assert.match(source, /hydrateFireworkCardPreviewPayload/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /requestSerialRef\.current !== serial/);
  assert.match(source, /controller\.signal\.aborted/);
  assert.match(source, /readyRef\.current \? '1' : '0'/);
  assert.match(source, /failedId/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /window\.addEventListener\('wheel'/);
  assert.match(source, /window\.addEventListener\('scroll'/);
  assert.match(source, /window\.addEventListener\('touchmove'/);
  assert.equal(source.match(/<LazyFireworkReplayCanvas/g)?.length, 1);
});

test('browse previews capture representative renderer frames into a bounded Blob URL cache', () => {
  const source = read('app/components/app/FireworkBrowsePreviewContext.tsx');

  assert.match(source, /const POSTER_WIDTH = 640/);
  assert.match(source, /const POSTER_HEIGHT = 400/);
  assert.match(source, /const POSTER_WEBP_QUALITY = 0\.82/);
  assert.match(source, /const MAX_PREVIEW_CACHE_ENTRIES = 64/);
  assert.match(source, /const MAX_POSTER_CACHE_ENTRIES = 48/);
  assert.match(source, /while \(previewCache\.size > MAX_PREVIEW_CACHE_ENTRIES\)/);
  assert.match(source, /posterUrls: ReadonlyMap<string, string>/);
  assert.match(source, /const posterUrlCache = new Map<string, string>/);
  assert.match(source, /function copyCanvasToPoster\(source: HTMLCanvasElement\)/);
  assert.match(source, /context\.drawImage\(/);
  assert.match(source, /function posterHasVisualDetail\(poster: HTMLCanvasElement\)/);
  assert.match(source, /context\.getImageData\(/);
  assert.match(source, /highlightedSamples >= 12 && brightest - darkest >= 55/);
  assert.match(source, /poster\.toBlob\(/);
  assert.match(source, /'image\/webp',\s*POSTER_WEBP_QUALITY/);
  assert.match(source, /URL\.createObjectURL\(blob\)/);
  assert.match(source, /while \(posterUrlCache\.size > MAX_POSTER_CACHE_ENTRIES\)/);
  assert.match(source, /URL\.revokeObjectURL\(oldestUrl\)/);
  assert.doesNotMatch(source, /persistedPosterCaptures\.delete/);
  assert.match(source, /estimateFireworkDesignTiming/);
  assert.match(source, /isGroundFireworkEffect/);
  assert.match(source, /function cueVisualWindow\(cue: ReplayCue\)/);
  assert.match(source, /function staticPreviewTime\(preview: CachedPreview\)/);
  assert.match(source, /onReady=\{handleCanvasReady\}/);
  assert.match(source, /completePreviewFrame\(current, mounted, requestSerialRef\.current\)/);
  assert.match(source, /const capture = capturePoster\(target, preview\)/);
  assert.match(source, /markPreviewReady\(target, serial\)/);
  assert.match(source, /function scheduleMountedCanvasReady|const scheduleMountedCanvasReady/);
  assert.match(source, /SAME_PREVIEW_SEEK_EPSILON_SECONDS/);
  assert.equal(source.match(/<LazyFireworkReplayCanvas/g)?.length, 1);
});

test('missing admin posters are backfilled sequentially through the shared canvas', () => {
  const source = read('app/components/app/FireworkBrowsePreviewContext.tsx');

  assert.match(source, /const MAX_BACKGROUND_CAPTURE_ATTEMPTS = 2/);
  assert.match(source, /const BACKGROUND_CAPTURE_DELAY_MS = 350/);
  assert.match(source, /posterQueueRef = useRef\(new Map<string, PreviewTarget>\(\)\)/);
  assert.match(source, /posterBackfillTargets\?: readonly PosterBackfillTarget\[\]/);
  assert.match(source, /backgroundTargetRef = useRef<HTMLDivElement \| null>\(null\)/);
  assert.match(source, /for \(const target of targets\)/);
  assert.match(source, /queuePosterCapture:/);
  assert.match(source, /unqueuePosterCapture:/);
  assert.match(source, /persist: true,\s*background: true/);
  assert.match(source, /displayPoster: false/);
  assert.match(source, /if \(target\.displayPoster && providerMountedRef\.current\)/);
  assert.match(
    source,
    /if \(active \|\| pending \|\| posterQueueRef\.current\.size === 0\) return/,
  );
  assert.match(source, /for \(const \[id, target\] of posterQueueRef\.current\)/);
  assert.match(source, /nextTarget = target;\s*break/);
  assert.match(source, /void activatePreview\(nextTarget\)/);
  assert.match(source, /void capture\.then\(\(success\) => finishBackgroundCapture/);
  assert.match(source, /Direct interaction always takes priority over sequential backfill/);
  assert.equal(source.match(/<LazyFireworkReplayCanvas/g)?.length, 1);
});

test('renderer captures post exact revision metadata as a WebP', () => {
  const source = read('app/components/app/FireworkBrowsePreviewContext.tsx');

  assert.match(source, /method: 'POST'/);
  assert.match(source, /credentials: 'same-origin'/);
  assert.match(source, /'Content-Type': 'image\/webp'/);
  const metadataHeaders = [
    'X-Firework-Preview-Kind',
    'X-Firework-Preview-Source-Id',
    'X-Firework-Preview-Source-Revision',
    'X-Firework-Preview-Source-Signature',
    'X-Firework-Preview-Expected-Path',
    'X-Firework-Preview-Width',
    'X-Firework-Preview-Height',
  ];
  for (const header of metadataHeaders) {
    assert.match(source, new RegExp(`'${header}'`), header);
  }
  assert.match(source, /body: blob/);
});

test('browse cards provide link and button activation without nesting their body in a control', () => {
  const source = read('app/components/app/FireworkBrowseCard.tsx');

  assert.match(source, /aspect-\[16\/10\]/);
  assert.match(
    source,
    /const sessionPosterUrl = browsePreview\?\.posterUrls\.get\(previewUrl\) \?\? null/,
  );
  assert.match(source, /const posterUrl = sessionPosterUrl \?\? persistedPosterUrl/);
  assert.match(source, /posterRef = useRef<HTMLImageElement \| null>\(null\)/);
  assert.match(source, /if \(!posterUrl \|\| !image\?\.complete\) return/);
  assert.match(source, /image\.naturalWidth > 0/);
  assert.match(
    source,
    /const posterLoaded = Boolean\(posterUrl && loadedPosterUrl === posterUrl\)/,
  );
  assert.match(source, /!posterLoaded \? \(/);
  assert.match(source, /<img/);
  assert.match(source, /ref=\{posterRef\}/);
  assert.match(source, /src=\{posterUrl\}/);
  assert.match(source, /onLoad=\{\(\) => \{/);
  assert.match(source, /setLoadedPosterUrl\(posterUrl\)/);
  assert.match(source, /onError=\{\(\) => \{/);
  assert.match(source, /setFailedPosterUrl\(posterUrl\)/);
  assert.match(source, /posterUrl && failedPosterUrl !== posterUrl/);
  assert.match(source, /const shouldPersistPoster =/);
  assert.match(
    source,
    /persistPoster && \(!persistedPosterUrl \|\| failedPosterUrl === persistedPosterUrl\)/,
  );
  assert.match(source, /if \(!shouldPersistPoster \|\| !mediaRef\.current\) return/);
  assert.doesNotMatch(source, /!persistPoster \|\| sessionPosterUrl/);
  assert.equal(source.match(/persist: shouldPersistPoster/g)?.length, 2);
  assert.match(source, /<Skeleton className="absolute inset-0 h-full w-full rounded-none"/);
  assert.doesNotMatch(source, /radial-gradient/);
  assert.doesNotMatch(source, /AdminEffectPreview/);
  assert.doesNotMatch(source, /previewStyle/);
  assert.match(source, /if \(href\)/);
  assert.match(source, /<Link/);
  assert.match(source, /<article/);
  assert.match(source, /<button/);
  assert.match(source, /browsePreview\?\.togglePreview/);
  assert.match(source, /Preview unavailable/);
  assert.match(source, /Loading preview/);
  assert.match(source, /focus-visible:ring-2/);
  assert.match(source, /\{children\}\s*<\/article>/);
  assert.match(source, /FireworkBrowseGridSkeleton/);
});
