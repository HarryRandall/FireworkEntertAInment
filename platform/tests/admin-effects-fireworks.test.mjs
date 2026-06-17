/** Static-analysis guards for the admin effects/fireworks browser. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} not found`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(brace + 1, i);
  }
  throw new Error(`${name} body was not closed`);
}

test('admin effects and fireworks routes are first-class admin pages', () => {
  for (const path of [
    'app/(admin)/admin/effects/page.tsx',
    'app/(admin)/admin/effects/loading.tsx',
    'app/(admin)/admin/effects/[id]/page.tsx',
    'app/(admin)/admin/effects/[id]/loading.tsx',
    'app/(admin)/admin/fireworks/page.tsx',
    'app/(admin)/admin/fireworks/loading.tsx',
  ]) {
    assert.equal(existsSync(join(root, path)), true, `${path} exists`);
  }

  const shell = read('app/components/admin/AdminShell.tsx');
  const overview = read('app/(admin)/admin/page.tsx');
  assert.match(shell, /\/admin\/effects/);
  assert.match(shell, /\/admin\/fireworks/);
  assert.match(overview, /listAdminEffects/);
  assert.match(overview, /listAdminFireworks/);
});

test('effects and fireworks helpers are catalogue-admin gated and cached', () => {
  const cacheKeys = read('lib/admin/cache-keys.ts');
  const effectsServer = read('lib/admin/effects.server.ts');
  const fireworksServer = read('lib/admin/fireworks.server.ts');
  const index = read('lib/admin/index.ts');

  assert.match(cacheKeys, /getAdminEffectsCacheKey/);
  assert.match(cacheKeys, /getAdminEffectCacheKey/);
  assert.match(cacheKeys, /getAdminFireworksCacheKey/);
  assert.match(cacheKeys, /invalidateAdminEffectsCache/);
  assert.match(cacheKeys, /invalidateAdminFireworksCache/);
  assert.match(effectsServer, /requirePermission\('admin\.manage_catalogue'\)/);
  assert.match(effectsServer, /setCachedJson\(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS\)/);
  assert.match(effectsServer, /\.from\('firework_effects'\)/);
  assert.match(effectsServer, /fireworks\(id\)/);
  assert.doesNotMatch(effectsServer, /\.from\('effect_specs'\)/);
  assert.match(fireworksServer, /requirePermission\('admin\.manage_catalogue'\)/);
  assert.match(fireworksServer, /setCachedJson\(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS\)/);
  assert.match(index, /listAdminEffects/);
  assert.match(index, /listAdminFireworks/);
});

test('base effect edits validate model JSON and use conflict detection', () => {
  const actions = read('app/actions/admin-effects.ts');
  const updateBody = functionBody(actions, 'updateEffect');

  assert.match(actions, /Model JSON must be an object/);
  assert.match(updateBody, /\.from\('firework_effects'\)/);
  assert.match(updateBody, /\.eq\('updated_at', parsed\.data\.expectedUpdatedAt\)/);
  assert.match(updateBody, /model_json: model\.value/);
  assert.match(updateBody, /pattern_key: parsed\.data\.patternKey/);
  assert.match(updateBody, /invalidateAdminEffectsCache\(parsed\.data\.id\)/);
  assert.match(updateBody, /invalidateAdminFireworksCache\(\)/);
  assert.match(updateBody, /invalidateFireworkCatalogueCaches\(\)/);
  assert.doesNotMatch(updateBody, /effect_specs|spec_json|FireworkSpecSchema/);
});

test('admin effects UI is wired to base effect fields', () => {
  const page = read('app/(admin)/admin/effects/page.tsx');
  const editor = read('app/(admin)/admin/effects/[id]/EffectEditor.tsx');
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/FireworkEditor.tsx');
  const design = read('lib/fireworks/design.ts');

  assert.match(page, /effect\.family/);
  assert.match(page, /effect\.patternKey/);
  assert.match(page, /effect\.variantCount/);
  assert.doesNotMatch(page, /effect\.durationSeconds|effect\.heightMeters|effect\.productCount/);
  assert.match(editor, /modelJson/);
  assert.match(editor, /patternKey/);
  assert.match(editor, /FireworkReplayCanvas/);
  assert.match(editor, /compileFireworkDesign/);
  assert.match(editor, /renderDefaults/);
  assert.match(editor, /FireworkRenderControls/);
  assert.match(editor, /canonicaliseEffectModelJson/);
  assert.match(design, /FIREWORK_RENDER_DEFAULT_KEYS/);
  assert.doesNotMatch(editor, /Math\.random/);
  assert.doesNotMatch(fireworkEditor, /Math\.random/);
  assert.match(fireworkEditor, /initial-main/);
  assert.match(fireworkEditor, /nextColourStopIdRef/);
  assert.match(
    fireworkEditor,
    /<PanelSection title="Details" collapsible defaultExpanded=\{false\}>/,
  );
  assert.match(fireworkEditor, /type StarColourMode = 'solid' \| 'random' \| 'bands' \| 'stripes'/);
  assert.match(fireworkEditor, /type StarColourAxis = 'vertical' \| 'horizontal'/);
  assert.match(fireworkEditor, /const MAX_STAR_COLOURS = 6/);
  assert.match(fireworkEditor, /const STAR_PATTERN_COUNT_MAX = 6/);
  assert.match(fireworkEditor, /const STAR_COLOUR_MODE_OPTIONS = \[/);
  assert.match(fireworkEditor, /const STAR_COLOUR_AXIS_OPTIONS = \[/);
  assert.match(fireworkEditor, /label: 'Bottom to top'/);
  assert.match(fireworkEditor, /function buildInitialColourStops/);
  assert.match(fireworkEditor, /function initialColourAxis/);
  assert.match(fireworkEditor, /function colourPatternQuestion/);
  assert.match(fireworkEditor, /function ColourPatternBar/);
  assert.match(fireworkEditor, /function normaliseColourShares/);
  assert.match(fireworkEditor, /function rebalanceColourShare/);
  assert.match(fireworkEditor, /function CompactColourInput/);
  assert.match(fireworkEditor, /const starColourControls = \(/);
  assert.match(fireworkEditor, /<SubSection[\s\S]*title="Colour"[\s\S]*action=\{/);
  assert.match(fireworkEditor, /ariaLabel="Star colour pattern"/);
  assert.match(fireworkEditor, /ariaLabel=\{colourPatternQuestion\(colourMode\)\}/);
  assert.match(fireworkEditor, /value=\{colourAxis\}/);
  assert.match(fireworkEditor, /<Plus size=\{16\} \/>/);
  assert.doesNotMatch(fireworkEditor, /\{colourStops\.length\}\/\{MAX_STAR_COLOURS\}/);
  assert.doesNotMatch(fireworkEditor, /> Add colour</);
  assert.match(fireworkEditor, /<ColourPatternBar/);
  assert.match(fireworkEditor, /Move colour split/);
  assert.match(fireworkEditor, /const \[draftColourStops, setDraftColourStops\]/);
  assert.match(fireworkEditor, /setPointerCapture\(event\.pointerId\)/);
  assert.match(fireworkEditor, /onPointerMove=\{\(event\) => continueHandleDrag\(index, event\)\}/);
  assert.match(fireworkEditor, /onChange\(latestStops\)/);
  assert.doesNotMatch(fireworkEditor, /document\.addEventListener\('pointermove'/);
  assert.match(fireworkEditor, /label=\{index === 1 \? 'Accent share' : 'Share'\}/);
  assert.match(fireworkEditor, /aria-label="Colour"[\s\S]*checked=\{colourEnabled\}/);
  assert.match(fireworkEditor, /const outer = ensureRecord\(stars, 'outer'\)/);
  assert.match(fireworkEditor, /outer\.color = hexToRgbObject\(mainColor\)/);
  assert.match(fireworkEditor, /outer\.colourPattern = \{/);
  assert.match(fireworkEditor, /mode: colourMode/);
  assert.match(fireworkEditor, /axis: colourAxis/);
  assert.match(fireworkEditor, /count: clampStarPatternCount\(validColourStops\.length\)/);
  assert.match(fireworkEditor, /weight: stop\.share/);
  assert.match(fireworkEditor, /delete core\.color/);
  assert.match(fireworkEditor, /delete core\.colourPattern/);
  assert.match(fireworkEditor, /starControls=\{starColourControls\}/);
  assert.doesNotMatch(
    fireworkEditor,
    /ROLE_HINT|ColorRole|ColorSlot|core: 'Star Inner'|initial-core/,
  );
  assert.doesNotMatch(fireworkEditor, /afterBurst=\{colourSection\}/);
  assert.match(editor, /PREVIEW_COLOR/);
  assert.doesNotMatch(editor, /refineEffectDraft|specJson|linkedProducts/);
});

test('admin replay previews opt into FPS diagnostics', () => {
  const canvas = read('app/components/app/FireworkReplayCanvas.tsx');
  const effectEditor = read('app/(admin)/admin/effects/[id]/EffectEditor.tsx');
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/FireworkEditor.tsx');
  const importPreview = read('app/(admin)/admin/imports/[id]/FireworkImportPreview.tsx');
  const appReplayViewer = read('app/components/app/FireworkReplayViewer.tsx');
  const templatePreview = read('app/components/app/TemplateReplayPreview.tsx');

  assert.match(canvas, /showFps\?: boolean/);
  assert.match(canvas, /trailWidthGuideDesign\?: FireworkDesign \| null/);
  assert.match(canvas, /FPS_SAMPLE_WINDOW_MS = 100/);
  assert.match(canvas, /FPS_HISTORY_SIZE = 80/);
  assert.match(canvas, /FPS_GRAPH_WIDTH = 184/);
  assert.match(canvas, /FPS_GRAPH_HEIGHT = 40/);
  assert.match(canvas, /FPS_GRAPH_MAX = 120/);
  assert.match(canvas, /FPS_CURVE_TENSION = 0\.22/);
  assert.match(canvas, /FPS_SMOOTHING_FACTOR = 0\.16/);
  assert.match(canvas, /Activity/);
  assert.match(canvas, /X/);
  assert.match(canvas, /import \{ Button \} from '@\/app\/components\/ui\/Button'/);
  assert.match(canvas, /showFpsRef/);
  assert.match(canvas, /showFpsOverlay/);
  assert.match(
    canvas,
    /const targetElapsed = playbackRef \? playbackRef\.current : internalElapsedRef\.current/,
  );
  assert.match(
    canvas,
    /engine\.clear\(\)[\s\S]*engine\.setCues\(cues\)[\s\S]*engine\.setElapsed\(0\)/,
  );
  assert.match(canvas, /setShowFpsOverlay\(showFps\)/);
  assert.match(canvas, /setShowFpsOverlay\(\(visible\) => !visible\)/);
  assert.match(canvas, /setShowFpsOverlay\(false\)/);
  assert.match(canvas, /Hide FPS graph/);
  assert.match(canvas, /Show FPS graph/);
  assert.match(canvas, /Close FPS graph/);
  assert.match(canvas, /fpsSmoothedRef/);
  assert.match(canvas, /previousSmoothedFps \+ \(measuredFps - previousSmoothedFps\)/);
  assert.match(canvas, /setFpsSamples/);
  assert.match(canvas, /buildFpsGraphPoints/);
  assert.match(canvas, /buildFpsGraphPath/);
  assert.match(canvas, /FPS_GRAPH_WIDTH - \(values\.length - 1 - index\) \* step/);
  assert.match(canvas, / C \$\{cp1x\.toFixed\(2\)\}/);
  assert.match(
    canvas,
    /showFpsOverlay \? \([\s\S]*<FpsGraph[\s\S]*fps=\{fps\}[\s\S]*samples=\{fpsSamples\}[\s\S]*onClose=\{\(\) => setShowFpsOverlay\(false\)\}/,
  );
  assert.match(canvas, /data-testid="firework-fps-meter"/);
  assert.match(canvas, /data-testid="firework-fps-close"/);
  assert.match(canvas, /variant="ghost"/);
  assert.match(canvas, /size="icon"/);
  assert.match(canvas, /absolute top-\[2px\] right-\[2px\] size-4/);
  assert.match(canvas, /bg-white\/10/);
  assert.match(canvas, /text-white\/85/);
  assert.match(canvas, /hover:text-destructive/);
  assert.match(canvas, /flex h-10 items-end justify-end/);
  assert.match(canvas, /w-\[10\.667rem\]/);
  assert.match(canvas, /aria-label="FPS history graph"/);
  assert.doesNotMatch(canvas, /Client FPS/);
  assert.match(canvas, /grid-cols-\[1\.35rem_1fr_1\.5rem\]/);
  assert.match(canvas, /text-\[9px\]/);
  assert.match(canvas, /Math\.max\(\.\.\.values\)/);
  assert.match(canvas, /Math\.min\(\.\.\.values\)/);
  assert.match(canvas, /stroke-white/);
  assert.match(canvas, /drop-shadow-\[0_0_5px_rgba\(255,255,255,0\.65\)\]/);
  assert.match(effectEditor, /<LazyFireworkReplayCanvas[\s\S]*showFps/);
  assert.match(fireworkEditor, /<LazyFireworkReplayCanvas[\s\S]*showFps/);
  assert.match(importPreview, /<LazyFireworkReplayCanvas[\s\S]*showFps/);
  assert.match(effectEditor, /muted=\{!isPlaying\}/);
  assert.match(fireworkEditor, /muted=\{!isPlaying\}/);
  assert.match(canvas, /resumeAudio/);
  assert.match(canvas, /document\.addEventListener\('pointerdown', unlockAudio/);
  // The trail width-guide overlay was removed with the Motion settings sheet,
  // so the editors no longer wire it up.
  assert.doesNotMatch(effectEditor, /showTrailWidthGuide/);
  assert.doesNotMatch(fireworkEditor, /showTrailWidthGuide/);
  assert.doesNotMatch(effectEditor, /trailWidthGuideDesign/);
  assert.doesNotMatch(fireworkEditor, /trailWidthGuideDesign/);
  assert.doesNotMatch(effectEditor, /onShowTrailWidthGuideChange/);
  assert.doesNotMatch(fireworkEditor, /onShowTrailWidthGuideChange/);
  assert.doesNotMatch(importPreview, /trailWidthGuideDesign/);
  assert.doesNotMatch(appReplayViewer, /showFps/);
  assert.doesNotMatch(templatePreview, /showFps/);
  assert.doesNotMatch(appReplayViewer, /trailWidthGuideDesign/);
  assert.doesNotMatch(templatePreview, /trailWidthGuideDesign/);
});

test('base effects seed default variants for missing effect families', () => {
  const migration = read('supabase/migrations/20260528220500_seed_default_firework_variants.sql');
  const expansion = read(
    'supabase/migrations/20260528233000_renderer_effect_geometry_expansion.sql',
  );

  for (const slug of [
    'brocade',
    'willow',
    'palm',
    'ring',
    'crossette',
    'horsetail',
    'comet',
    'mine',
    'crackle',
  ]) {
    assert.match(migration, new RegExp(`'${slug}'`));
  }
  for (const slug of ['pistil', 'pearls', 'tail', 'silver-fish', 'waterfall', 'whirl']) {
    assert.match(expansion, new RegExp(`'${slug}'`));
  }
  assert.match(migration, /where not exists/);
  assert.match(expansion, /where not exists/);
  assert.match(migration, /public\.firework_variants/);
  assert.match(expansion, /public\.firework_variants/);
});

test('catalogue and import mutations invalidate new admin firework caches', () => {
  const catalogue = read('app/actions/admin-catalogue.ts');
  const imports = read('app/actions/platform-admin.ts');

  assert.match(catalogue, /invalidateAdminEffectsCache/);
  assert.match(catalogue, /invalidateAdminFireworksCache/);
  assert.match(imports, /invalidateAdminEffectsCache\(baseEffect\.id\)/);
  assert.match(imports, /invalidateAdminFireworksCache\(catalogueItem\.id\)/);
});
