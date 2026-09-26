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

  const shell = read('ui/shell/AdminShell.tsx');
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
});

test('base effect edits validate model JSON and use conflict detection', () => {
  const actions = read('app/(admin)/admin/effects/actions.ts');
  const updateBody = functionBody(actions, 'updateEffect');
  const restoreBody = functionBody(actions, 'restoreEffectEditorVersion');
  const createBody = functionBody(actions, 'createCustomStarEffect');

  assert.match(actions, /Model JSON must be an object/);
  assert.match(actions, /CUSTOM_STAR_EFFECT_MODEL/);
  assert.match(actions, /canonicaliseEffectModelJson/);
  assert.match(actions, /fireworkDesignFragmentError/);
  assert.match(
    actions,
    /function parseModelJson[\s\S]*canonicaliseEffectModelJson\(parsed\)[\s\S]*fireworkDesignFragmentError\(canonical\.renderDefaults\)/,
  );
  assert.match(actions, /recordEffectVersion/);
  assert.match(actions, /firework_editor_versions/);
  assert.doesNotMatch(actions, /hasEffectVersionHistory/);
  assert.doesNotMatch(actions, /Current version before editor changes/);
  assert.doesNotMatch(actions, /filterValidStyleDefaultAssignments/);
  assert.match(updateBody, /\.from\('firework_effects'\)/);
  assert.match(updateBody, /\.eq\('updated_at', parsed\.data\.expectedUpdatedAt\)/);
  assert.match(updateBody, /model_json: model\.value/);
  assert.match(updateBody, /pattern_key: parsed\.data\.patternKey/);
  assert.doesNotMatch(updateBody, /star_style_default_id|trail_style_default_id/);
  assert.doesNotMatch(updateBody, /type: parsed\.data\.type/);
  assert.match(updateBody, /recordEffectVersion/);
  assert.match(updateBody, /historyVersionId: parsed\.data\.historyVersionId/);
  assert.match(updateBody, /const historyRecorded = await recordEffectVersion/);
  assert.match(updateBody, /return \{ ok: true,[\s\S]*historyVersion, historyRecorded \}/);
  assert.ok(
    updateBody.indexOf('await recordEffectVersion') <
      updateBody.indexOf('invalidateAdminEffectsCache'),
    'effect history must be observed before its caches are invalidated',
  );
  assert.match(updateBody, /action: 'update'/);
  assert.match(restoreBody, /parseEffectEditorSnapshot/);
  assert.match(restoreBody, /fireworkDesignFragmentError\(restoredModel\.renderDefaults\)/);
  assert.doesNotMatch(restoreBody, /replaceEffectStyleDefaultLinks/);
  assert.doesNotMatch(restoreBody, /star_style_default_id|trail_style_default_id/);
  assert.match(restoreBody, /action: 'restore'/);
  assert.match(restoreBody, /historyVersionId: parsed\.data\.historyVersionId/);
  assert.match(restoreBody, /const historyRecorded = await recordEffectVersion/);
  assert.match(restoreBody, /return \{ ok: true,[\s\S]*historyVersion, historyRecorded \}/);
  assert.ok(
    restoreBody.indexOf('await recordEffectVersion') <
      restoreBody.indexOf('invalidateAdminEffectsCache'),
    'effect restore history must be observed before its caches are invalidated',
  );
  assert.match(restoreBody, /Restored version from/);
  assert.match(updateBody, /invalidateAdminEffectsCache\(parsed\.data\.id\)/);
  assert.match(updateBody, /invalidateAdminFireworksCache\(\)/);
  assert.match(updateBody, /invalidateAdminMultishotsCache\(\)/);
  assert.match(updateBody, /invalidateFireworkCatalogueCaches\(\)/);
  assert.match(updateBody, /revalidatePath\('\/admin\/multishots'\)/);
  assert.match(createBody, /\.from\('firework_effects'\)/);
  assert.match(createBody, /\.insert\(\{/);
  assert.match(createBody, /slug = `custom-star-\$\{Date\.now\(\)\.toString\(36\)\}`/);
  assert.match(createBody, /pattern_key: 'custom-star'/);
  assert.match(createBody, /source: 'manual'/);
  assert.match(createBody, /model_json: CUSTOM_STAR_EFFECT_MODEL/);
  assert.doesNotMatch(createBody, /type,/);
  assert.match(createBody, /redirect\(`\/admin\/effects\/\$\{data\.id\}`\)/);
  assert.doesNotMatch(updateBody, /effect_specs|spec_json|FireworkSpecSchema/);
  assert.doesNotMatch(actions, /from 'next\/server'|\bafter\(|confirmEffectEditorVersions/);
});

test('base effect classification column is removed from schema and migrations', () => {
  const types = read('lib/database.types.ts');
  const start = types.indexOf('firework_effects: {');
  const end = types.indexOf('firework_style_defaults: {', start);
  const fireworkEffectsTypes = types.slice(start, end);

  assert.doesNotMatch(fireworkEffectsTypes, /\n\s+type\??:/);
  assert.doesNotMatch(fireworkEffectsTypes, /\n\s+family\??:/);
});

test('firework edits use conflict detection and immutable version history', () => {
  const actions = read('app/(admin)/admin/fireworks/actions.ts');
  const updateBody = functionBody(actions, 'updateFirework');
  const restoreBody = functionBody(actions, 'restoreFireworkEditorVersion');

  assert.match(actions, /expectedUpdatedAt/);
  assert.match(actions, /recordFireworkVersion/);
  assert.match(actions, /firework_editor_versions/);
  assert.match(actions, /function parseJsonObject[\s\S]*fireworkDesignFragmentError\(parsed\)/);
  assert.doesNotMatch(actions, /hasFireworkVersionHistory/);
  assert.doesNotMatch(actions, /Current version before editor changes/);
  assert.doesNotMatch(actions, /filterValidStyleDefaultAssignments/);
  assert.match(updateBody, /\.eq\('updated_at', parsed\.data\.expectedUpdatedAt\)/);
  assert.match(updateBody, /select\(FIREWORK_MUTATION_SELECT\)/);
  assert.match(updateBody, /mapSavedFirework\(data as FireworkMutationRow\)/);
  assert.doesNotMatch(updateBody, /star_style_default_id|trail_style_default_id/);
  assert.match(updateBody, /recordFireworkVersion/);
  assert.match(updateBody, /historyVersion/);
  assert.match(updateBody, /historyVersionId: parsed\.data\.historyVersionId/);
  assert.match(updateBody, /const historyRecorded = await recordFireworkVersion/);
  assert.match(updateBody, /return \{ ok: true,[\s\S]*historyVersion, historyRecorded \}/);
  assert.ok(
    updateBody.indexOf('await recordFireworkVersion') < updateBody.indexOf('await refresh'),
    'firework history must be observed before its caches are invalidated',
  );
  assert.match(updateBody, /action: 'update'/);
  assert.match(updateBody, /This firework changed in another session/);
  assert.match(restoreBody, /parseFireworkEditorSnapshot/);
  assert.match(restoreBody, /fireworkDesignFragmentError\(snapshot\.renderOverridesJson\)/);
  assert.doesNotMatch(restoreBody, /replaceFireworkStyleDefaultLinks/);
  assert.doesNotMatch(restoreBody, /star_style_default_id|trail_style_default_id/);
  assert.match(restoreBody, /action: 'restore'/);
  assert.match(restoreBody, /historyVersionId: parsed\.data\.historyVersionId/);
  assert.match(restoreBody, /const historyRecorded = await recordFireworkVersion/);
  assert.match(restoreBody, /return \{ ok: true,[\s\S]*historyVersion, historyRecorded \}/);
  assert.ok(
    restoreBody.indexOf('await recordFireworkVersion') < restoreBody.indexOf('await refresh'),
    'firework restore history must be observed before its caches are invalidated',
  );
  assert.match(restoreBody, /Restored version from/);
  assert.match(restoreBody, /refresh\(parsed\.data\.fireworkId\)/);
  assert.doesNotMatch(actions, /from 'next\/server'|\bafter\(|confirmFireworkEditorVersions/);
});

test('editor version history migration is permission-gated and typed', () => {
  const types = read('lib/database.types.ts');
  const adminTypes = read('lib/admin.types.ts');
  const effectsServer = read('lib/admin/effects.server.ts');
  const fireworksServer = read('lib/admin/fireworks.server.ts');
  const styleDefaultsServer = read('lib/admin/style-defaults.server.ts');
  const editorVersions = read('lib/admin/editor-versions.server.ts');
  const styleDefaultSchema = read('lib/admin/style-default-schema.ts');

  assert.match(types, /firework_editor_versions: \{/);
  assert.match(types, /snapshot_json: Json/);
  assert.match(types, /previous_snapshot_json: Json \| null/);
  assert.match(types, /foreignKeyName: "firework_editor_versions_firework_id_fkey"/);
  assert.match(types, /foreignKeyName: "firework_editor_versions_firework_effect_id_fkey"/);
  assert.match(types, /foreignKeyName: "firework_editor_versions_firework_style_default_id_fkey"/);
  assert.match(
    adminTypes,
    /AdminEditorVersionTargetKind = 'firework' \| 'effect' \| 'style_default'/,
  );
  assert.match(adminTypes, /export type AdminEditorVersion/);
  assert.match(adminTypes, /fireworkStyleDefaultId: string \| null/);
  assert.match(adminTypes, /history: AdminEditorVersion\[\]/);
  assert.match(effectsServer, /listEffectEditorVersions/);
  assert.match(fireworksServer, /listFireworkEditorVersions/);
  assert.match(styleDefaultsServer, /listStyleDefaultEditorVersions/);
  assert.match(
    styleDefaultsServer,
    /history: await listStyleDefaultEditorVersions\(supabase, defaultId\)/,
  );
  assert.match(effectsServer, /type CachedAdminEffectDetail = Omit<AdminEffectDetail, 'history'>/);
  assert.match(
    fireworksServer,
    /type CachedAdminFireworkDetail = Omit<AdminFireworkDetail, 'history'>/,
  );
  assert.match(effectsServer, /history: await listEffectEditorVersions\(supabase, effectId\)/);
  assert.match(
    fireworksServer,
    /history: await listFireworkEditorVersions\(supabase, fireworkId\)/,
  );
  assert.match(editorVersions, /isSyntheticCurrentVersion/);
  assert.match(editorVersions, /row\.changes_json\.currentVersion === true/);
  assert.match(editorVersions, /\.filter\(\(row\) => !isSyntheticCurrentVersion\(row\)\)/);
  assert.match(editorVersions, /listStyleDefaultEditorVersions/);
  assert.match(editorVersions, /\.eq\('firework_style_default_id', styleDefaultId\)/);
  assert.match(editorVersions, /function throwHistoryReadError\(/);
  assert.match(editorVersions, /const LEGACY_EDITOR_VERSION_SELECT/);
  assert.match(editorVersions, /isMissingStyleDefaultEditorVersionColumnError/);
  assert.match(editorVersions, /listFireworkEditorVersionsLegacy/);
  assert.match(editorVersions, /listEffectEditorVersionsLegacy/);
  assert.match(editorVersions, /fireworkStyleDefaultId: row\.firework_style_default_id \?\? null/);
  assert.match(styleDefaultSchema, /isMissingEditorVersionTableError/);
  assert.match(styleDefaultSchema, /isMissingStyleDefaultEditorVersionColumnError/);
  assert.match(styleDefaultSchema, /includes\('firework_style_default_id'\)/);
});

test('effect and product editors compose the shared parts tree and draft tools', () => {
  const effects = read('app/(admin)/admin/effects/[id]/_components/EffectEditor.tsx');
  const fireworks = read('app/(admin)/admin/fireworks/[id]/_components/FireworkEditor.tsx');
  const shell = read('ui/firework-editor/FireworkEditorShell.tsx');
  for (const editor of [effects, fireworks]) {
    assert.match(editor, /rendererTabs/);
    assert.match(editor, /useDraftHistory/);
    assert.match(editor, /validateFireworkDesign/);
    assert.match(editor, /EditorHistoryPanel/);
    assert.match(editor, /JsonReadOnlyPanel/);
    assert.doesNotMatch(editor, /Math\.random/);
  }
  assert.match(shell, /RendererPartsTree/);
  assert.match(shell, /ReplayTransportControls/);
  assert.match(shell, /history\.undo/);
  assert.match(shell, /history\.redo/);
});

test('admin replay previews opt into FPS diagnostics', () => {
  const canvas = read('ui/replay/FireworkReplayCanvas.tsx');
  const effectEditor = read('app/(admin)/admin/effects/[id]/_components/EffectEditor.tsx');
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/_components/FireworkEditor.tsx');
  const importPreview = read(
    'app/(admin)/admin/imports/[id]/_components/FireworkImportPreview.tsx',
  );
  const appReplayViewer = read('ui/replay/FireworkReplayViewer.tsx');
  const templatePreview = read('ui/replay/TemplateReplayPreview.tsx');

  assert.match(canvas, /showFps\?: boolean/);
  assert.match(canvas, /FPS_SAMPLE_WINDOW_MS = 100/);
  assert.match(canvas, /FPS_HISTORY_SIZE = 80/);
  assert.match(canvas, /FPS_GRAPH_WIDTH = 184/);
  assert.match(canvas, /FPS_GRAPH_HEIGHT = 40/);
  assert.match(canvas, /FPS_GRAPH_MAX = 120/);
  assert.match(canvas, /FPS_CURVE_TENSION = 0\.22/);
  assert.match(canvas, /FPS_SMOOTHING_FACTOR = 0\.16/);
  assert.match(canvas, /Activity/);
  assert.match(canvas, /X/);
  assert.match(canvas, /import \{ Button \} from '@\/ui\/patterns\/Button'/);
  assert.match(canvas, /showFpsRef/);
  assert.match(canvas, /showFpsOverlay/);
  assert.match(
    canvas,
    /const targetElapsed = playbackRef \? playbackRef\.current : internalElapsedRef\.current/,
  );
  assert.match(
    canvas,
    /engine\.clear\(\)[\s\S]*engine\.setCues\(cues,[\s\S]*engine\.setElapsed\(0\)/,
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
  assert.match(effectEditor, /const previewCues = useMemo/);
  assert.match(fireworkEditor, /const previewCues = useMemo/);
  assert.match(effectEditor, /cues=\{previewCues\}/);
  assert.match(fireworkEditor, /cues=\{previewCues\}/);
  assert.doesNotMatch(effectEditor, /cues=\{\[previewCue\]\}/);
  assert.doesNotMatch(fireworkEditor, /cues=\{\[previewCue\]\}/);
  assert.match(canvas, /resumeAudio/);
  assert.match(canvas, /document\.addEventListener\('pointerdown', unlockAudio/);
  // The trail width-guide overlay was removed with the Motion settings sheet,
  // so the editors no longer wire it up.
  assert.doesNotMatch(effectEditor, /showTrailWidthGuide/);
  assert.doesNotMatch(fireworkEditor, /showTrailWidthGuide/);
  assert.doesNotMatch(effectEditor, /onShowTrailWidthGuideChange/);
  assert.doesNotMatch(fireworkEditor, /onShowTrailWidthGuideChange/);
  assert.doesNotMatch(appReplayViewer, /showFps/);
  assert.doesNotMatch(templatePreview, /showFps/);
});

test('catalogue and import mutations invalidate new admin firework caches', () => {
  const catalogue = read('app/(admin)/admin/catalogue/actions.ts');
  const imports = read('app/(admin)/admin/imports/actions.ts');

  assert.match(catalogue, /invalidateAdminEffectsCache/);
  assert.match(catalogue, /invalidateAdminFireworksCache/);
  assert.match(
    imports,
    /approval\.firework_ids\.map\(\(fireworkId\) => invalidateAdminFireworksCache\(fireworkId\)\)/,
  );
  assert.match(imports, /\.map\(\(effectId\) => invalidateAdminEffectsCache\(effectId\)\)/);
});
