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
  assert.match(actions, /fireworkDesignFragmentError/);
  assert.match(restoreBody, /parseEffectEditorSnapshot/);
  for (const body of [updateBody, restoreBody]) {
    assert.match(body, /await saveEditorRecord/);
    assert.match(body, /expectedUpdatedAt: parsed\.data\.expectedUpdatedAt/);
    assert.match(body, /historyVersionId: parsed\.data\.historyVersionId/);
    assert.doesNotMatch(body, /\.update\(/);
  }
  assert.match(restoreBody, /restoreVersionId: parsed\.data\.versionId/);
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
  assert.match(actions, /fireworkDesignFragmentError/);
  assert.match(restoreBody, /parseFireworkEditorSnapshot/);
  for (const body of [updateBody, restoreBody]) {
    assert.match(body, /await saveEditorRecord/);
    assert.match(body, /expectedUpdatedAt: parsed\.data\.expectedUpdatedAt/);
    assert.match(body, /historyVersionId: parsed\.data\.historyVersionId/);
    assert.doesNotMatch(body, /\.update\(/);
  }
  assert.match(restoreBody, /restoreVersionId: parsed\.data\.versionId/);
});

test('editor version history migration is permission-gated and typed', () => {
  const types = read('lib/database.types.ts');
  const adminTypes = read('lib/admin.types.ts');
  const effectsServer = read('lib/admin/effects.server.ts');
  const fireworksServer = read('lib/admin/fireworks.server.ts');
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

  assert.match(effectsServer, /listEffectEditorVersions\(supabase, row.id\)/);
  assert.match(fireworksServer, /listFireworkEditorVersions\(supabase, row.id\)/);
  assert.match(editorVersions, /isSyntheticCurrentVersion/);
  assert.match(editorVersions, /row\.changes_json\.currentVersion === true/);
  assert.match(editorVersions, /\.filter\(\(row\) => !isSyntheticCurrentVersion\(row\)\)/);
  assert.match(editorVersions, /function throwHistoryReadError\(/);
  assert.doesNotMatch(editorVersions, /LEGACY_EDITOR_VERSION_SELECT|isMissing/);
  assert.match(editorVersions, /fireworkStyleDefaultId: row\.firework_style_default_id \?\? null/);
  assert.doesNotMatch(styleDefaultSchema, /isMissing/);
});

test('effect and product editors compose the shared parts tree and draft tools', () => {
  const effects = read('app/(admin)/admin/effects/[id]/_components/EffectEditor.tsx');
  const fireworks = read('app/(admin)/admin/fireworks/[id]/_components/FireworkEditor.tsx');
  const shell = read('ui/firework-editor/FireworkEditorShell.tsx');
  for (const editor of [effects, fireworks]) {
    assert.match(editor, /useDesignTabs/);
    assert.match(editor, /useDraftHistory/);
    assert.match(editor, /validateEditorDesign/);
    assert.match(editor, /EditorHistoryPanel/);
    assert.match(editor, /JsonReadOnlyPanel/);
    assert.doesNotMatch(editor, /Math\.random/);
  }
  assert.match(shell, /RendererPartsTree/);
  assert.match(shell, /ReplayTransportControls/);
  assert.match(shell, /history\.undo/);
  assert.match(shell, /history\.redo/);
});

test('admin editors preview through the stored-design renderer', () => {
  const effectEditor = read('app/(admin)/admin/effects/[id]/_components/EffectEditor.tsx');
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/_components/FireworkEditor.tsx');
  const appReplayViewer = read('ui/replay/FireworkReplayViewer.tsx');
  const templatePreview = read('ui/replay/TemplateReplayPreview.tsx');

  assert.match(effectEditor, /<DesignPreview/);
  assert.match(fireworkEditor, /<DesignPreview/);
  const rendererPreview = read('ui/firework-editor/renderer-design/preview-surface.tsx');
  assert.match(rendererPreview, /new Viewer/);
  assert.match(rendererPreview, /ui: false/);
  assert.match(rendererPreview, /instance.dispose\(\)/);
  // The trail width-guide overlay was removed with the Motion settings sheet,
  // so the editors no longer wire it up.
  assert.doesNotMatch(effectEditor, /showTrailWidthGuide/);
  assert.doesNotMatch(fireworkEditor, /showTrailWidthGuide/);
  assert.doesNotMatch(effectEditor, /onShowTrailWidthGuideChange/);
  assert.doesNotMatch(fireworkEditor, /onShowTrailWidthGuideChange/);
  assert.doesNotMatch(appReplayViewer, /showFps/);
  assert.doesNotMatch(templatePreview, /showFps/);
});

test('show previews render the shared FPS graph from the viewer frame rate', () => {
  const fpsGraph = read('ui/replay/FpsGraph.tsx');
  const viewerStats = read('ui/replay/ReplayViewerSettings.tsx');
  const showCanvas = read('ui/replay/ShowRendererCanvas.tsx');

  assert.match(fpsGraph, /FPS_HISTORY_SIZE = 80/);
  assert.match(fpsGraph, /data-testid="firework-fps-meter"/);
  assert.match(fpsGraph, /aria-label="Close FPS graph"/);
  assert.match(viewerStats, /Math\.round\(instance\.fps\)/);
  assert.match(viewerStats, /slice\(-\(FPS_HISTORY_SIZE - 1\)\)/);
  assert.match(viewerStats, /<FpsGraph[\s\S]*onClose=\{\(\) => setSetting\('stats', false\)\}/);
  assert.match(
    showCanvas,
    /props\.showStaging \? <ReplayViewerStats viewerRef=\{viewer\} \/> : null/,
  );
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
