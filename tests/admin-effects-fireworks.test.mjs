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
  const dropDraft = read(
    'supabase/migrations/20260701054406_drop_firework_effect_classification.sql',
  );
  const dropFollowUp = read('supabase/migrations/20260701061429_drop_firework_effect_type.sql');
  const types = read('lib/database.types.ts');
  const start = types.indexOf('firework_effects: {');
  const end = types.indexOf('firework_style_defaults: {', start);
  const fireworkEffectsTypes = types.slice(start, end);

  for (const migration of [dropDraft, dropFollowUp]) {
    assert.match(migration, /drop constraint firework_effects_type_check/);
    assert.match(migration, /drop constraint firework_effects_family_check/);
    assert.match(migration, /alter table public\.firework_effects drop column type/);
    assert.match(migration, /alter table public\.firework_effects drop column family/);
    assert.match(migration, /snapshot_json = snapshot_json - 'family' - 'type'/);
  }

  assert.doesNotMatch(fireworkEffectsTypes, /\n\s+type\??:/);
  assert.doesNotMatch(fireworkEffectsTypes, /\n\s+family\??:/);
});

test('firework edits use conflict detection and immutable version history', () => {
  const actions = read('app/actions/admin-fireworks.ts');
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
  const migration = read('supabase/migrations/20260622035601_admin-editor-version-history.sql');
  const styleDefaultMigration = read(
    'supabase/migrations/20260715032141_add_style_default_editor_version_history.sql',
  );
  const types = read('lib/database.types.ts');
  const adminTypes = read('lib/admin.types.ts');
  const effectsServer = read('lib/admin/effects.server.ts');
  const fireworksServer = read('lib/admin/fireworks.server.ts');
  const styleDefaultsServer = read('lib/admin/style-defaults.server.ts');
  const editorVersions = read('lib/admin/editor-versions.server.ts');
  const styleDefaultSchema = read('lib/admin/style-default-schema.ts');

  assert.match(migration, /create table if not exists public\.firework_editor_versions/);
  assert.match(migration, /target_kind text not null/);
  assert.match(migration, /check \(target_kind in \('firework', 'effect'\)\)/);
  assert.match(migration, /check \(action in \('update', 'restore'\)\)/);
  assert.match(migration, /firework_id uuid references public\.fireworks\(id\) on delete cascade/);
  assert.match(
    migration,
    /firework_effect_id uuid references public\.firework_effects\(id\) on delete cascade/,
  );
  assert.match(migration, /firework_editor_versions_target_fk_check/);
  assert.match(migration, /firework_editor_versions_firework_created_at_idx/);
  assert.match(migration, /firework_editor_versions_effect_created_at_idx/);
  assert.match(
    migration,
    /grant select, insert on public\.firework_editor_versions to authenticated/,
  );
  assert.match(migration, /alter table public\.firework_editor_versions enable row level security/);
  assert.match(migration, /firework_editor_versions_admin_select/);
  assert.match(migration, /firework_editor_versions_admin_insert/);
  assert.match(migration, /public\.current_user_has_permission\('admin\.manage_catalogue'\)/);
  assert.doesNotMatch(migration, /for update|for delete/);
  assert.match(styleDefaultMigration, /add column firework_style_default_id uuid/);
  assert.match(
    styleDefaultMigration,
    /references public\.firework_style_defaults\(id\) on delete cascade/,
  );
  assert.match(
    styleDefaultMigration,
    /check \(target_kind in \('firework', 'effect', 'style_default'\)\)/,
  );
  assert.match(styleDefaultMigration, /target_kind = 'style_default'/);
  assert.match(styleDefaultMigration, /firework_editor_versions_style_default_created_at_idx/);

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

test('admin effects UI is wired to base effect fields', () => {
  const page = read('app/(admin)/admin/effects/page.tsx');
  const browser = read('app/(admin)/admin/effects/EffectsBrowser.tsx');
  const editor = read('app/(admin)/admin/effects/[id]/EffectEditor.tsx');
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/FireworkEditor.tsx');
  const shell = read('app/components/admin/FireworkEditorShell.tsx');
  const inspectorPanels = read('app/components/admin/EditorInspectorPanels.tsx');
  const routeSkeletons = read('app/components/app/RouteSkeletons.tsx');
  const design = read('lib/fireworks/design.ts');

  assert.match(page, /listAdminEffects/);
  assert.match(page, /listAdminStyleDefaults/);
  assert.match(page, /<EffectsBrowser/);
  assert.match(browser, /effect\.patternKey/);
  assert.match(browser, /effect\.variantCount/);
  assert.match(browser, /createCustomStarEffect/);
  assert.match(browser, /New custom effect/);
  assert.match(browser, /<Plus size=\{16\} \/>/);
  assert.doesNotMatch(browser, /effect\.type|formatEffectType|name="type"|Effect type|>Type</);
  assert.doesNotMatch(browser, /effect\.durationSeconds|effect\.heightMeters|effect\.productCount/);
  assert.match(editor, /modelJson/);
  assert.match(editor, /patternKey/);
  assert.match(editor, /FireworkReplayCanvas/);
  assert.match(editor, /showStarfield=\{false\}/);
  assert.match(editor, /compileFireworkDesign/);
  assert.match(editor, /renderDefaults/);
  assert.match(editor, /FireworkRenderControls/);
  assert.match(editor, /FireworkEditorShell/);
  assert.match(editor, /EditorPreviewTransport/);
  assert.match(editor, /estimatePreviewTicks/);
  assert.match(editor, /EditorHistoryPanel/);
  assert.match(editor, /JsonReadOnlyPanel/);
  assert.match(editor, /restoreEffectEditorVersion/);
  assert.match(editor, /canonicaliseEffectModelJson/);
  assert.match(editor, /EditorStyleDefaultControls/);
  assert.match(editor, /renderStyleDefaultControls\('star'\)/);
  assert.match(editor, /renderStyleDefaultControls\('trail'\)/);
  assert.doesNotMatch(editor, /effectType|TYPE_OPTIONS|Effect type|type: effectType/);
  assert.doesNotMatch(editor, /id: 'defaults'/);
  assert.match(editor, /id: 'star-inner'/);
  assert.match(editor, /controlScope="starInner"/);
  assert.match(editor, /id: 'trail'/);
  assert.match(editor, /controlScope="trail"/);
  assert.match(editor, /renderStyleDefaultControls\('geometry'\)/);
  assert.match(editor, /controlScope="geometry"/);
  assert.match(editor, /id: 'history'/);
  assert.match(editor, /id: 'json'/);
  assert.doesNotMatch(editor, /id: 'colour'/);
  assert.match(design, /FIREWORK_RENDER_DEFAULT_KEYS/);
  assert.doesNotMatch(editor, /Math\.random/);
  assert.doesNotMatch(fireworkEditor, /Math\.random/);
  assert.match(shell, /Editor sections/);
  assert.match(shell, /utilityTabIds/);
  assert.match(shell, /primaryTabs\.map\(renderRailTab\)/);
  assert.match(shell, /utilityTabs\.map\(renderRailTab\)/);
  assert.match(shell, /role="tab"/);
  assert.match(shell, /ReplayTransportControls/);
  assert.match(shell, /if \(loading\) return null/);
  assert.match(shell, /currentTabId !== activeTab/);
  assert.doesNotMatch(shell, /EditorPreviewTransportLoading|Loading preview controls/);
  assert.match(shell, /aria-selected=\{selected\}/);
  assert.match(shell, /const \[inspectorCollapsed, setInspectorCollapsed\] = useState\(true\)/);
  assert.doesNotMatch(shell, /collapsedCurrent/);
  assert.match(shell, /inspectorCollapsed \? 'lg:border-l-0' : 'lg:border-l'/);
  assert.match(shell, /lg:h-full lg:w-full lg:flex-col lg:items-center/);
  assert.match(shell, /mb-1 h-px w-full shrink-0 bg-\[color:var\(--color-border-subtle\)\]/);
  assert.match(shell, /h-full min-h-0 w-full min-w-0 flex-1/);
  assert.match(shell, /eyebrow\?: string \| null/);
  assert.match(shell, /dirty/);
  assert.match(shell, /Revert/);
  assert.match(shell, /saveLabel/);
  assert.match(shell, /pr-16 sm:pr-\[4\.5rem\]/);
  assert.doesNotMatch(shell, /previewNotice|EditorVersionPreviewNotice/);
  assert.match(inspectorPanels, /EditorHistoryPanel/);
  assert.match(inspectorPanels, /JsonReadOnlyPanel/);
  assert.doesNotMatch(
    inspectorPanels,
    /currentVersion|Current saved version|Current working version/,
  );
  assert.match(inspectorPanels, /No saved versions yet/);
  assert.match(inspectorPanels, /authorInitials/);
  assert.match(inspectorPanels, /versionDetail/);
  assert.match(inspectorPanels, /grid-cols-\[1\.5rem_2\.25rem_minmax\(0,1fr\)\]/);
  assert.match(inspectorPanels, /showTimelineMarker = versions\.length > 1/);
  assert.match(inspectorPanels, /formatDate\(version\.createdAt, now\)/);
  assert.match(inspectorPanels, /Revert to here/);
  assert.doesNotMatch(inspectorPanels, />\s*Preview\s*<|onPreview|selectedVersionId/);
  assert.doesNotMatch(inspectorPanels, /version\.action === 'restore' \? 'Restored' : 'Saved'/);
  assert.doesNotMatch(inspectorPanels, /Previewing/);
  assert.match(inspectorPanels, /flex min-h-\[420px\] flex-1 flex-col/);
  assert.match(inspectorPanels, /fullScreen/);
  assert.match(inspectorPanels, /Maximize2/);
  assert.match(routeSkeletons, /AdminVisualEditorSkeleton/);
  assert.match(routeSkeletons, /ReplayPanelLoadingStage/);
  assert.doesNotMatch(
    routeSkeletons,
    /grid h-full min-h-0 lg:grid-cols-\[minmax\(0,1fr\)_minmax\(360px,408px\)\]/,
  );
  assert.match(routeSkeletons, /bg-stage-night/);
  assert.doesNotMatch(routeSkeletons, /EditorTransportSkeleton|Loading preview controls/);
  assert.doesNotMatch(routeSkeletons, /Array\.from\(\{ length: 8 \}\)/);
  assert.doesNotMatch(routeSkeletons, /Array\.from\(\{ length: 2 \}\)/);
  assert.doesNotMatch(routeSkeletons, /bg-\[color:var\(--color-bg-emphasis\)\] dark:bg-white\/10/);
  assert.doesNotMatch(shell, /from-black\/82/);
  assert.doesNotMatch(shell, /h-40 bg-gradient-to-b/);
  assert.match(fireworkEditor, /initial-main/);
  assert.match(fireworkEditor, /nextColourStopIdRef/);
  assert.doesNotMatch(
    fireworkEditor,
    /<PanelSection title="Details" collapsible defaultExpanded=\{false\}>/,
  );
  assert.match(fireworkEditor, /const detailsContent = \(\s*<div className="space-y-4">/);
  assert.doesNotMatch(fireworkEditor, /label: 'Height'/);
  assert.doesNotMatch(fireworkEditor, /icon: MoveUp/);
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
  assert.doesNotMatch(fireworkEditor, /<SubSection[\s\S]*title="Colour"[\s\S]*action=\{/);
  assert.match(fireworkEditor, /role="radiogroup"[\s\S]*aria-label="Star colour pattern"/);
  assert.match(fireworkEditor, /aria-label=\{colourPatternQuestion\(colourMode\)\}/);
  assert.match(fireworkEditor, /role="radio"/);
  assert.match(fireworkEditor, /colourAxis === option\.value/);
  assert.match(fireworkEditor, /<Plus size=\{16\} \/>/);
  assert.doesNotMatch(fireworkEditor, /\{colourStops\.length\}\/\{MAX_STAR_COLOURS\}/);
  assert.match(fireworkEditor, /Add colour/);
  assert.match(fireworkEditor, /<ColourPatternBar/);
  assert.match(fireworkEditor, /Move colour split/);
  assert.match(fireworkEditor, /const \[draftColourStops, setDraftColourStops\]/);
  assert.match(fireworkEditor, /setPointerCapture\(event\.pointerId\)/);
  assert.match(fireworkEditor, /onPointerMove=\{\(event\) => continueHandleDrag\(index, event\)\}/);
  assert.match(fireworkEditor, /onChange\(latestStops\)/);
  assert.doesNotMatch(fireworkEditor, /document\.addEventListener\('pointermove'/);
  assert.match(fireworkEditor, /label="Accent share"/);
  assert.match(fireworkEditor, /aria-label="Colour"[\s\S]*checked=\{colourEnabled\}/);
  assert.match(fireworkEditor, /const outer = ensureRecord\(stars, 'outer'\)/);
  assert.match(fireworkEditor, /outer\.color = hexToRgbObject\(colour\.mainColor\)/);
  assert.match(fireworkEditor, /outer\.colourPattern = \{/);
  assert.match(fireworkEditor, /mode: colour\.colourMode/);
  assert.match(fireworkEditor, /axis: colour\.colourAxis/);
  assert.match(fireworkEditor, /count: clampStarPatternCount\(colour\.validColourStops\.length\)/);
  assert.match(fireworkEditor, /weight: stop\.share/);
  assert.doesNotMatch(fireworkEditor, /delete core\.color/);
  assert.doesNotMatch(fireworkEditor, /delete core\.colourPattern/);
  assert.match(
    fireworkEditor,
    /mutate=\{\(updater\) => mutateOverridesForStyle\('star', updater\)\}[\s\S]*?controlScope="starInner"/,
  );
  assert.match(fireworkEditor, /FireworkEditorShell/);
  assert.match(fireworkEditor, /EditorPreviewTransport/);
  assert.match(fireworkEditor, /cameraMenuActions=\{previewMenuActions\}/);
  assert.match(fireworkEditor, /showStarfield=\{false\}/);
  assert.match(fireworkEditor, /showLoadingBar/);
  assert.match(fireworkEditor, /estimatePreviewTicks/);
  assert.match(fireworkEditor, /EditorHistoryPanel/);
  assert.match(fireworkEditor, /JsonReadOnlyPanel/);
  assert.match(fireworkEditor, /restoreFireworkEditorVersion/);
  assert.match(fireworkEditor, /id: 'details'/);
  assert.match(fireworkEditor, /id: 'colour'/);
  assert.match(fireworkEditor, /id: 'star'/);
  assert.match(fireworkEditor, /id: 'star-inner'/);
  assert.match(fireworkEditor, /controlScope="starInner"/);
  assert.match(fireworkEditor, /id: 'trail'/);
  assert.match(fireworkEditor, /controlScope="trail"/);
  assert.match(fireworkEditor, /renderStyleDefaultControls\('geometry'\)/);
  assert.match(fireworkEditor, /controlScope="geometry"/);
  assert.match(fireworkEditor, /id: 'launch-dot'/);
  assert.match(fireworkEditor, /controlScope="launchShell"/);
  assert.match(fireworkEditor, /id: 'launch-trail'/);
  assert.match(fireworkEditor, /controlScope="launchTrail"/);
  assert.match(fireworkEditor, /id: 'fx-strobe'/);
  assert.match(fireworkEditor, /id: 'fx-crackle'/);
  assert.match(fireworkEditor, /id: 'fx-split'/);
  assert.match(fireworkEditor, /id: 'smoke'/);
  assert.match(fireworkEditor, /id: 'sound'/);
  assert.match(fireworkEditor, /id: 'history'/);
  assert.match(fireworkEditor, /id: 'json'/);
  assert.doesNotMatch(fireworkEditor, /EditorVersionPreviewNotice|previewVersion/);
  assert.doesNotMatch(fireworkEditor, /Current vs Proposed|Proposed|comparison switch/);
  assert.doesNotMatch(fireworkEditor, /eyebrow="Firework editor"/);
  assert.doesNotMatch(
    fireworkEditor,
    /ROLE_HINT|ColorRole|ColorSlot|core: 'Star Inner'|initial-core/,
  );
  assert.doesNotMatch(fireworkEditor, /afterBurst=\{colourSection\}/);
  assert.match(editor, /PREVIEW_COLOR/);
  assert.match(editor, /cameraMenuActions=\{previewMenuActions\}/);
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
  assert.match(
    effectEditor,
    /const previewCues = useMemo\(\(\) => \[previewCue\], \[previewCue\]\)/,
  );
  assert.match(
    fireworkEditor,
    /const previewCues = useMemo\(\(\) => \[previewCue\], \[previewCue\]\)/,
  );
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

test('base effects seed default variants for missing effect types', () => {
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

test('catalogue reseed preserves retained editor links and history', () => {
  const migration = read(
    'supabase/migrations/20260629043858_reseed_firework_catalogue_from_scratch.sql',
  );
  const generator = read('supabase/catalogue/generate-firework-catalogue-migration.mjs');

  for (const source of [migration, generator]) {
    assert.doesNotMatch(source, /delete from public\.firework_style_default_links/);
    assert.doesNotMatch(source, /delete from public\.firework_effect_style_default_links/);
    assert.doesNotMatch(source, /delete from public\.firework_editor_versions/);
  }
  assert.match(generator, /existingReseedMigration/);
  assert.match(migration, /retained style-default links and editor/);
});

test('catalogue and import mutations invalidate new admin firework caches', () => {
  const catalogue = read('app/actions/admin-catalogue.ts');
  const imports = read('app/actions/platform-admin.ts');

  assert.match(catalogue, /invalidateAdminEffectsCache/);
  assert.match(catalogue, /invalidateAdminFireworksCache/);
  assert.match(
    imports,
    /approval\.firework_ids\.map\(\(fireworkId\) => invalidateAdminFireworksCache\(fireworkId\)\)/,
  );
  assert.match(imports, /\.map\(\(effectId\) => invalidateAdminEffectsCache\(effectId\)\)/);
});
