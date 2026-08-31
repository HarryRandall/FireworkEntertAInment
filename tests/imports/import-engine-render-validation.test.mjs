import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith('@/')) {
        return nextResolve(
          pathToFileURL(`${join(process.cwd(), specifier.slice(2))}.ts`).href,
          context,
        );
      }
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const { buildImportRenderSignature, deriveImportRenderSigningKey, verifyImportRenderClaims } =
  await import('../../lib/import-render-auth-core.ts');
const {
  IMPORT_RENDER_METRICS_SCHEMA_VERSION,
  analyseImportRenderPixels,
  buildImportTemporalForegroundFrames,
  buildImportRenderMetrics,
  compareImportRenderPixels,
} = await import('../../lib/import-render-metrics.ts');
const {
  FIREWORKS_ENGINE_FIXED_STEP_SECONDS,
  FIREWORKS_ENGINE_IMPORT_RENDERER_SOURCE_FILES,
  FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION,
  quantiseFireworksEngineTimeSeconds,
} = await import('../../lib/fireworks/import-renderer-contract.ts');

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

const redPalette = [{ hex: '#ff0033', weight: 1 }];
const bluePalette = [{ hex: '#1166ff', weight: 1 }];

test('import renderer contract fingerprints every capture-affecting source', () => {
  const fingerprint = createHash('sha256');
  for (const path of [...FIREWORKS_ENGINE_IMPORT_RENDERER_SOURCE_FILES].sort()) {
    fingerprint.update(path);
    fingerprint.update('\0');
    fingerprint.update(read(path).replaceAll('\r\n', '\n'));
    fingerprint.update('\0');
  }
  const sourceHash = fingerprint.digest('hex');
  assert.equal(
    FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION,
    `showcrafter.fireworks-engine.import-renderer.v1+sha256.${sourceHash}`,
  );
});

test('import renderer contract stays aligned across the app, worker and database', () => {
  const worker = read('services/firework-import-worker/engine_validation.py');
  const workerVersion = worker.match(/^RENDERER_VERSION = "([^"]+)"$/m)?.[1];
  assert.equal(workerVersion, FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION);

  const migrationDirectory = join(root, 'supabase/migrations');
  const contractMigrations = readdirSync(migrationDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .filter((file) =>
      readFileSync(join(migrationDirectory, file), 'utf8').includes(
        'create or replace function public.current_firework_import_renderer_contract_version()',
      ),
    );
  const latestMigration = contractMigrations.at(-1);
  assert.ok(latestMigration, 'Expected a renderer contract migration');
  const databaseVersion = readFileSync(join(migrationDirectory, latestMigration), 'utf8').match(
    /select '([^']+)'::text;/,
  )?.[1];
  assert.equal(databaseVersion, FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION);
});

function frame(timeSeconds, activity, options = {}) {
  return {
    timeSeconds,
    meanBrightness: activity * 0.4,
    flashIntensity: activity * 0.1,
    brightCoverage: activity * 0.08,
    centroid: Object.hasOwn(options, 'centroid')
      ? options.centroid
      : { x: 0.5, y: 0.5 - activity * 0.2 },
    spread: activity * 0.12,
    palette: options.palette ?? redPalette,
  };
}

test('import render HMAC is scoped, short-lived and timing-safe', () => {
  const secret = 's'.repeat(48);
  const claims = {
    runId: '019f6471-87ef-7dc1-a23b-9cf086945401',
    expiresAt: 1_300,
    nonce: 'aBcD0123_-aBcD0123_-',
  };
  const signature = buildImportRenderSignature(secret, claims);
  const directSignature = createHmac('sha256', secret)
    .update(`showcrafter.import-render.v1\n${claims.runId}\n${claims.expiresAt}\n${claims.nonce}`)
    .digest('base64url');
  assert.equal(signature.length, 43);
  assert.equal(deriveImportRenderSigningKey(secret).length, 32);
  assert.notEqual(signature, directSignature);
  assert.equal(verifyImportRenderClaims({ secret, claims, signature, nowSeconds: 1_000 }), true);
  assert.equal(
    verifyImportRenderClaims({
      secret,
      claims: { ...claims, runId: '019f6471-87ef-7dc1-a23b-9cf086945402' },
      signature,
      nowSeconds: 1_000,
    }),
    false,
  );
  assert.equal(verifyImportRenderClaims({ secret, claims, signature, nowSeconds: 1_301 }), false);
  assert.equal(
    verifyImportRenderClaims({
      secret,
      claims: { ...claims, expiresAt: 1_301 },
      signature: buildImportRenderSignature(secret, { ...claims, expiresAt: 1_301 }),
      nowSeconds: 1_000,
    }),
    false,
  );
});

test('identical engine and source observations score as a complete match', () => {
  const sourceFrames = [frame(0, 0), frame(0.5, 0.45), frame(1, 1), frame(1.5, 0.4), frame(2, 0)];
  const perceptualFrames = sourceFrames.map((source) => ({
    timeSeconds: source.timeSeconds,
    foregroundSsim: 1,
    lumaMae: 0,
    chromaMae: 0,
    foregroundCoverage: source.brightCoverage,
  }));
  const metrics = buildImportRenderMetrics({
    sourceFrames,
    renderedFrames: structuredClone(sourceFrames),
    perceptualFrames,
    frameWidth: 960,
    frameHeight: 540,
  });
  assert.equal(metrics.schemaVersion, IMPORT_RENDER_METRICS_SCHEMA_VERSION);
  assert.equal(metrics.overallScore, 1);
  assert.equal(metrics.priorityIssues.length, 0);
  assert.equal(metrics.engine.renderer, 'FireworksEngine');
  assert.equal(metrics.engine.rendererVersion, FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION);
  assert.equal(metrics.engine.camera, 'FireworkReplayCanvas.default');
  assert.equal(metrics.engine.fixedStepSeconds, 1 / 60);
});

test('import capture timestamps share one explicit 60 Hz lattice', () => {
  assert.equal(FIREWORKS_ENGINE_FIXED_STEP_SECONDS, 1 / 60);
  assert.equal(quantiseFireworksEngineTimeSeconds(0.251), 0.25);
  assert.equal(quantiseFireworksEngineTimeSeconds(0.251, 'floor'), 0.25);
  assert.equal(quantiseFireworksEngineTimeSeconds(0.251, 'ceil'), 16 / 60);
  assert.equal(quantiseFireworksEngineTimeSeconds(1.2) / FIREWORKS_ENGINE_FIXED_STEP_SECONDS, 72);
});

test('empty frames cannot dilute a bad active burst in foreground-weighted metrics v2', () => {
  const activeTime = 5;
  const emptyFrames = Array.from({ length: 100 }, (_, index) =>
    frame(index * 0.1, index === 50 ? 1 : 0, {
      centroid: index === 50 ? { x: 0.5, y: 0.4 } : null,
      palette: index === 50 ? redPalette : [],
    }),
  );
  const activeComparison = {
    timeSeconds: activeTime,
    foregroundSsim: 0.1,
    lumaMae: 0.5,
    chromaMae: 0.45,
    foregroundCoverage: 0.08,
  };
  const perceptualFrames = emptyFrames.map((source) =>
    source.timeSeconds === activeTime
      ? activeComparison
      : {
          timeSeconds: source.timeSeconds,
          foregroundSsim: 1,
          lumaMae: 0,
          chromaMae: 0,
          foregroundCoverage: 0,
        },
  );
  const metrics = buildImportRenderMetrics({
    sourceFrames: emptyFrames,
    renderedFrames: structuredClone(emptyFrames),
    perceptualFrames,
    frameWidth: 960,
    frameHeight: 540,
  });

  assert.equal(metrics.schemaVersion, 'showcrafter.engine-render-metrics.v2');
  assert.equal(metrics.perceptual.activeFrameCount, 1);
  assert.equal(metrics.perceptual.meanForegroundSsim, activeComparison.foregroundSsim);
  assert.ok(metrics.perceptual.score < 0.2);
  assert.ok(metrics.priorityIssues.some((issue) => issue.field === 'perceptual'));
});

test('timing, trajectory, palette, fade and perceptual drift remain explicit', () => {
  const sourceFrames = [frame(0, 0), frame(0.5, 0.6), frame(1, 1), frame(1.5, 0.4), frame(2, 0)];
  const renderedFrames = [
    frame(0, 0, { centroid: null, palette: bluePalette }),
    frame(0.5, 0, { centroid: null, palette: bluePalette }),
    frame(1, 0.25, { centroid: { x: 0.8, y: 0.8 }, palette: bluePalette }),
    frame(1.5, 1, { centroid: { x: 0.85, y: 0.75 }, palette: bluePalette }),
    frame(2, 0.8, { centroid: { x: 0.9, y: 0.72 }, palette: bluePalette }),
  ];
  const metrics = buildImportRenderMetrics({
    sourceFrames,
    renderedFrames,
    perceptualFrames: sourceFrames.map((source) => ({
      timeSeconds: source.timeSeconds,
      foregroundSsim: 0.2,
      lumaMae: 0.5,
      chromaMae: 0.45,
      foregroundCoverage: 0.08,
    })),
    frameWidth: 640,
    frameHeight: 360,
  });
  assert.ok(metrics.overallScore < 0.6);
  assert.ok(metrics.timing.peakDeltaSeconds > 0);
  assert.ok(metrics.trajectory.centroidRmseNormalised > 0);
  assert.ok(metrics.palette.perceptualDistance > 0);
  assert.ok(metrics.fade.normalisedCurveMae > 0);
  assert.ok(metrics.perceptual.meanForegroundSsim < 0.5);
  assert.deepEqual(
    new Set(metrics.priorityIssues.map((issue) => issue.field)),
    new Set(['timing', 'trajectory', 'palette', 'fade', 'perceptual']),
  );
});

test('empty sky frames cannot dilute a poor active firework-frame match', () => {
  const sourceFrames = Array.from({ length: 41 }, (_, index) =>
    frame(index * 0.1, index === 20 ? 1 : 0),
  );
  const perceptualFrames = sourceFrames.map((source, index) =>
    index === 20
      ? {
          timeSeconds: source.timeSeconds,
          foregroundSsim: 0.08,
          lumaMae: 0.62,
          chromaMae: 0.58,
          foregroundCoverage: 0.025,
        }
      : {
          timeSeconds: source.timeSeconds,
          foregroundSsim: 1,
          lumaMae: 0,
          chromaMae: 0,
          foregroundCoverage: 0,
        },
  );
  const metrics = buildImportRenderMetrics({
    sourceFrames,
    renderedFrames: structuredClone(sourceFrames),
    perceptualFrames,
    frameWidth: 960,
    frameHeight: 540,
  });
  assert.equal(metrics.perceptual.activeFrameCount, 1);
  assert.ok(metrics.perceptual.score < 0.78);
  assert.equal(
    metrics.priorityIssues.some((issue) => issue.field === 'perceptual'),
    true,
  );
});

test('pixel analysis compares actual foreground pixels without a black-sky shortcut', () => {
  const source = new Uint8ClampedArray(4 * 4 * 4);
  const rendered = new Uint8ClampedArray(4 * 4 * 4);
  for (let pixel = 0; pixel < 16; pixel += 1) {
    source[pixel * 4 + 3] = 255;
    rendered[pixel * 4 + 3] = 255;
  }
  source.set([255, 0, 32, 255], 5 * 4);
  rendered.set([0, 96, 255, 255], 10 * 4);
  const observation = analyseImportRenderPixels(source, 4, 4, 1.25);
  const comparison = compareImportRenderPixels(source, rendered, 1.25);
  assert.equal(observation.timeSeconds, 1.25);
  assert.ok(observation.brightCoverage > 0);
  assert.ok(observation.centroid);
  assert.ok(comparison.foregroundCoverage > 0);
  assert.ok(comparison.foregroundSsim < 1);
  assert.ok(comparison.chromaMae > 0);
});

test('temporal foreground extraction removes static lights but preserves moving fireworks', () => {
  const frames = Array.from({ length: 3 }, () => new Uint8ClampedArray(4 * 4 * 4));
  frames.forEach((pixels) => {
    for (let pixel = 0; pixel < 16; pixel += 1) pixels[pixel * 4 + 3] = 255;
    pixels.set([180, 180, 180, 255], 0);
  });
  frames[0].set([255, 32, 16, 255], 5 * 4);
  frames[1].set([255, 32, 16, 255], 6 * 4);
  frames[2].set([255, 32, 16, 255], 10 * 4);

  const foreground = buildImportTemporalForegroundFrames(frames, 4, 4);
  assert.deepEqual([...foreground[1].slice(0, 3)], [0, 0, 0]);
  assert.ok(foreground[1][6 * 4] > 200);
});

test('protected page and harness keep credentials server-side and use exact replay capture', () => {
  const page = read('app/internal/import-render/page.tsx');
  const harness = read('app/internal/import-render/ImportRenderHarness.tsx');
  const replay = read('components/replay/FireworkReplayCanvas.tsx');
  const auth = read('lib/import-render-auth.server.ts');
  const nextConfig = read('next.config.ts');
  const proxy = read('proxy.ts');
  const contentSecurityPolicy = read('lib/security/import-render-csp.ts');
  const themeProvider = read('components/theme/ThemeProvider.tsx');
  const worker = read('services/firework-import-worker/worker.py');
  const engine = read('lib/fireworks/FireworksEngine.ts');

  assert.match(page, /isAuthorisedImportRenderRequest/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /force-dynamic/);
  assert.doesNotMatch(page + harness, /SUPABASE_SERVICE_ROLE_KEY|createServiceRole/);
  assert.match(auth, /FIREWORK_IMPORT_SHARED_SECRET/);
  assert.match(nextConfig, /source: '\/internal\/import-render'/);
  assert.match(nextConfig, /private, no-store/);
  assert.match(nextConfig, /Referrer-Policy.*no-referrer/);
  assert.match(nextConfig, /X-Frame-Options.*DENY/);
  assert.match(proxy, /importRenderContentSecurityPolicy\(nonce\)/);
  assert.match(contentSecurityPolicy, /frame-ancestors 'none'/);
  assert.match(contentSecurityPolicy, /script-src 'self' 'nonce-\$\{nonce\}' 'strict-dynamic'/);
  assert.match(themeProvider, /pathname === '\/internal\/import-render'/);
  assert.match(harness, /__SHOWCRAFTER_IMPORT_RENDER__/);
  assert.match(harness, /data-testid="import-render-source-video"/);
  assert.match(harness, /reconstructionToReplayCues/);
  assert.match(harness, /type: 'engine-ready'/);
  assert.match(harness, /type: 'elapsed-rendered'/);
  assert.match(
    harness,
    /controller\.captureAt\(timeSeconds, \{ includePng: includeRenderedFrames \}\)/,
  );
  assert.match(harness, /buildImportTemporalForegroundFrames/);
  assert.match(harness, /showStarfield=\{false\}/);
  assert.match(harness, /MAX_EXPORTED_FRAME_BYTES/);
  assert.match(harness, /ENGINE_READY_TIMEOUT_MS/);
  assert.match(harness, /requiredProductDurationSeconds/);
  assert.match(harness, /rendererVersion: FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION/);
  assert.match(engine, /FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION/);
  assert.match(replay, /engine\.setElapsed\(next\)/);
  assert.match(replay, /const nextFrame = Math\.min\(targetFrame, capturedFrame \+ 15\)/);
  assert.match(replay, /quantiseFireworksEngineTimeSeconds\(requestedElapsed\)/);
  assert.doesNotMatch(replay, /Math\.min\(target, capturedElapsed \+ 0\.25\)/);
  assert.match(
    engine,
    /this\.tickPhysics\(next - cursor\);\s*cursor = next;\s*for \(const cue of due\) this\.fireCue/,
  );
  assert.match(
    engine,
    /this\.tickPhysics\(next - this\.primingCursor\);\s*this\.primingCursor = next;\s*for \(const cue of due\) this\.fireCue/,
  );
  assert.match(engine, /settleCurrentBoundary\(\): void/);
  assert.match(replay, /composer\.render\(0\)/);
  assert.match(replay, /captureCanvas\.toDataURL\('image\/png'\)/);
  assert.match(worker, /append_firework_import_run_output/);
  assert.match(worker, /renderedVideoPath/);
});
