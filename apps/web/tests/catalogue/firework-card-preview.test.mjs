import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const root = process.cwd();
const { parseReconstructionShotVariant } = await import('../../lib/reconstruction-shot.ts');

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function loadPurePreviewModule() {
  const source = read('lib/firework-card-preview.ts');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  Function('exports', 'module', output)(loadedModule.exports, loadedModule);
  return loadedModule.exports;
}

test('card preview payload hydration reuses normalised specifications and fails closed', () => {
  const { hydrateFireworkCardPreviewPayload } = loadPurePreviewModule();
  const specification = { id: 'firework-1', name: 'Blue Sphere' };
  const payload = {
    specifications: [specification],
    durationSeconds: 4,
    cues: [
      {
        id: 'cue-1',
        position: 1,
        timeSeconds: 0.05,
        description: 'Blue Sphere',
        productId: 'product-1',
        launchPositionIndex: 0,
        fireworkId: 'firework-1',
      },
      {
        id: 'cue-2',
        position: 2,
        timeSeconds: 1,
        description: 'Blue Sphere',
        productId: 'product-1',
        launchPositionIndex: 0,
        fireworkId: 'firework-1',
      },
    ],
  };

  const hydrated = hydrateFireworkCardPreviewPayload(payload);
  assert.equal(hydrated.length, 2);
  assert.equal(hydrated[0].firework, specification);
  assert.equal(hydrated[1].firework, specification);
  assert.equal('fireworkId' in hydrated[0], false);

  assert.throws(
    () =>
      hydrateFireworkCardPreviewPayload({
        ...payload,
        cues: [{ ...payload.cues[0], fireworkId: 'missing' }],
      }),
    /references missing firework/,
  );
});

test('the 0.05 second renderer lead-in is exclusive to direct card previews', () => {
  const { FIREWORK_CARD_PREVIEW_CUE_TIME_SECONDS, fireworkCardPreviewShotTimeSeconds } =
    loadPurePreviewModule();

  assert.equal(FIREWORK_CARD_PREVIEW_CUE_TIME_SECONDS, 0.05);
  assert.equal(fireworkCardPreviewShotTimeSeconds('direct', 0), 0.05);
  assert.equal(fireworkCardPreviewShotTimeSeconds('multishot', 0), 0.01);
  assert.equal(fireworkCardPreviewShotTimeSeconds('multishot', 1.25), 1.25);
});

test('reconstruction launch metadata is parsed once for show and card replay', () => {
  const shot = parseReconstructionShotVariant({
    reconstructionShot: {
      panDegrees: -18,
      tiltDegrees: 10,
      position: { x: -20, y: 4, z: -3 },
      launchPositionIndex: 2,
      seedOverride: 303,
    },
  });
  assert.deepEqual(shot, {
    panDegrees: -18,
    tiltDegrees: 10,
    positionOverride: { x: -20, y: 4, z: -3 },
    launchPositionIndex: 2,
    seedOverride: 303,
  });

  const invalid = parseReconstructionShotVariant({
    reconstructionShot: {
      panDegrees: 31,
      tiltDegrees: -51,
      x: 1_001,
      y: 0,
      z: 0,
      launchPositionIndex: 3,
      seedOverride: -1,
    },
  });
  assert.deepEqual(invalid, {
    panDegrees: null,
    tiltDegrees: null,
    positionOverride: null,
    launchPositionIndex: null,
    seedOverride: null,
  });
});

test('preview loaders compile real designs and bound normalised sequence payloads', () => {
  const preview = read('lib/firework-card-preview.server.ts');
  const shows = read('lib/shows/queries.server.ts');

  assert.match(preview, /FIREWORK_CARD_PREVIEW_MAX_CUES = 80/);
  assert.match(preview, /FIREWORK_CARD_PREVIEW_CUE_TIME_SECONDS/);
  assert.match(preview, /SHOW_CARD_PREVIEW_WINDOW_SECONDS/);
  assert.match(preview, /ordered\[0\]!\.timeSeconds - PREVIEW_LEAD_SECONDS/);
  assert.match(preview, /\.slice\(0, FIREWORK_CARD_PREVIEW_MAX_CUES\)/);
  assert.match(preview, /new Map<string, FireworkSpecification>/);
  assert.match(preview, /fireworkId: firework\.id/);
  assert.match(preview, /\.select\('source_revision, storage_path'\)/);
  assert.match(preview, /expectedStoragePath: manifestAfterRead\.storagePath/);

  assert.match(preview, /getAdminEffectById/);
  assert.match(preview, /canonicaliseEffectModelJson/);
  assert.match(
    preview,
    /const effectStyleDefaults = linkedStyleDefaults\(effect\.styleDefaultLinks\)/,
  );
  assert.match(
    preview,
    /\[baseModel, \.\.\.effectStyleDefaults\]\.some\(hasConcreteRendererColour\)/,
  );
  assert.match(preview, /primaryColor: hasConcreteColour \? null : PREVIEW_COLOR/);

  assert.match(preview, /getAdminFireworkById/);
  assert.match(
    preview,
    /fireworkStyleDefaults: linkedStyleDefaults\(firework\.fireworkStyleDefaultLinks\)/,
  );
  assert.match(preview, /variantOverrides: firework\.renderOverridesJson/);

  assert.match(preview, /getMultishotById/);
  assert.match(preview, /listFireworkSpecifications/);
  assert.match(preview, /launchPositionIndex: shot\.launchPositionIndex/);
  assert.match(preview, /shotPanDegrees: shot\.panDegrees/);
  assert.match(preview, /shotTiltDegrees: shot\.tiltDegrees/);
  assert.match(preview, /parseReconstructionShotVariant\(data\.variant_json\)/);
  assert.match(preview, /seedOverride: reconstructionShot\?\.seedOverride \?\? null/);
  assert.match(preview, /shotPositionOverride: reconstructionShot\?\.positionOverride \?\? null/);
  assert.match(preview, /seedOverride: shot\.seedOverride/);

  assert.match(preview, /getCatalogueReadClient/);
  assert.match(preview, /fetchShotsByCatalogueItem/);
  assert.match(preview, /\{\s*failOnError: true,?\s*\}/);
  assert.match(shows, /export async function fetchShotsByCatalogueItem/);
  assert.match(shows, /options\.failOnError \|\| isSupabaseTransientNetworkError/);
  assert.match(shows, /kind: 'direct'/);
  assert.match(shows, /timeOffsetSeconds: DIRECT_SHOW_REPLAY_SHOT_OFFSET_SECONDS/);
  assert.match(
    preview,
    /fireworkCardPreviewShotTimeSeconds\(shot\.kind, shot\.timeOffsetSeconds\)/,
  );
  assert.match(shows, /parseReconstructionShotVariant/);
});

test('preview APIs enforce their distinct access boundaries and no-store responses', () => {
  const adminRoute = read('app/api/admin/firework-previews/[kind]/[id]/route.ts');
  const publicRoute = read('app/api/catalogue/[id]/preview/route.ts');

  assert.match(adminRoute, /requirePermission\('admin\.manage_catalogue'\)/);
  assert.match(adminRoute, /'effect',[\s\S]*'firework',[\s\S]*'multishot'/);
  assert.doesNotMatch(adminRoute, /ADMIN_PREVIEW_KINDS[\s\S]*'catalogue'/);
  assert.match(adminRoute, /error: 'forbidden'[\s\S]*403/);
  assert.match(adminRoute, /error: 'not_found'[\s\S]*404/);
  assert.match(adminRoute, /error: 'temporarily_unavailable'[\s\S]*503/);
  assert.match(adminRoute, /private, no-store/);
  assert.match(adminRoute, /export async function POST/);
  assert.match(adminRoute, /contentType !== 'image\/webp'/);

  assert.doesNotMatch(publicRoute, /requirePermission/);
  assert.doesNotMatch(publicRoute, /export async function POST/);
  assert.match(publicRoute, /loadCatalogueFireworkCardPreview/);
  assert.match(publicRoute, /error: 'not_found'[\s\S]*404/);
  assert.match(publicRoute, /error: 'temporarily_unavailable'[\s\S]*503/);
  assert.match(publicRoute, /Cache-Control': 'no-store/);
});
