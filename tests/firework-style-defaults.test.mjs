/** Static guards for copy-on-apply firework style defaults. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function readDollarQuotedJson(source, tag) {
  const marker = `$${tag}$`;
  const start = source.indexOf(marker);
  const end = source.indexOf(marker, start + marker.length);
  assert.notEqual(start, -1, `${marker} opening marker not found`);
  assert.notEqual(end, -1, `${marker} closing marker not found`);
  return JSON.parse(source.slice(start + marker.length, end));
}

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} not found`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(brace + 1, index);
  }
  throw new Error(`${name} body was not closed`);
}

test('style default schema keeps saved defaults and prunes live links', () => {
  const baseMigrationPath = 'supabase/migrations/20260618051341_live_firework_style_defaults.sql';
  const generalisedMigrationPath =
    'supabase/migrations/20260618081656_generalised_firework_style_defaults.sql';
  const copyMigrationPath =
    'supabase/migrations/20260709082959_copy_style_defaults_and_clean_indexes.sql';
  const geometryMigrationPath =
    'supabase/migrations/20260715031905_add_geometry_style_defaults.sql';
  assert.equal(existsSync(join(root, baseMigrationPath)), true);
  assert.equal(existsSync(join(root, generalisedMigrationPath)), true);
  assert.equal(existsSync(join(root, copyMigrationPath)), true);
  assert.equal(existsSync(join(root, geometryMigrationPath)), true);

  const baseMigration = read(baseMigrationPath);
  const generalisedMigration = read(generalisedMigrationPath);
  const copyMigration = read(copyMigrationPath);
  const geometryMigration = read(geometryMigrationPath);
  const types = read('lib/database.types.ts');

  assert.match(baseMigration, /create table if not exists public\.firework_style_defaults/);
  assert.match(
    baseMigration,
    /alter table public\.firework_style_defaults enable row level security/,
  );
  assert.match(
    baseMigration,
    /grant select, insert, update, delete on public\.firework_style_defaults to authenticated/,
  );
  assert.match(baseMigration, /public\.current_user_has_permission\('admin\.manage_catalogue'\)/);

  assert.match(
    generalisedMigration,
    /drop constraint if exists firework_style_defaults_kind_check/,
  );
  assert.match(
    generalisedMigration,
    /check \(kind in \('star', 'trail', 'launch', 'smoke', 'strobe', 'crackle', 'split', 'sound'\)\)/,
  );
  for (const slug of [
    'standard-launch',
    'standard-smoke',
    'standard-strobe',
    'standard-crackle',
    'standard-split',
    'standard-sound',
  ]) {
    assert.match(generalisedMigration, new RegExp(`'${slug}'`));
  }

  assert.match(copyMigration, /deep_merge_jsonb/);
  assert.match(copyMigration, /drop table if exists public\.firework_effect_style_default_links/);
  assert.match(copyMigration, /drop table if exists public\.firework_style_default_links/);
  assert.match(copyMigration, /drop column if exists star_style_default_id/);
  assert.match(copyMigration, /drop column if exists trail_style_default_id/);
  assert.match(copyMigration, /drop index if exists public\.show_analyses_show_latest_idx/);
  assert.match(copyMigration, /drop index if exists public\.show_analyses_user_created_idx/);
  assert.match(geometryMigration, /'geometry'/);
  assert.match(geometryMigration, /firework_style_defaults_kind_check/);
  assert.doesNotMatch(types, /firework_effect_style_default_links: \{/);
  assert.doesNotMatch(types, /firework_style_default_links: \{/);
  assert.doesNotMatch(types, /star_style_default_id:/);
  assert.doesNotMatch(types, /trail_style_default_id:/);
});

test('resolved render designs use copied JSON instead of live default links', () => {
  const design = read('lib/fireworks/design.ts');
  const showTypes = read('lib/shows/types.ts');
  const showMappers = read('lib/shows/mappers.ts');
  const adminFireworks = read('lib/admin/fireworks.server.ts');
  const adminEffects = read('lib/admin/effects.server.ts');

  assert.match(
    design,
    /const effectStyleDefaults = mergeDefaultFragments\(params\.effectStyleDefaults\)/,
  );
  assert.match(
    design,
    /const fireworkStyleDefaults = mergeDefaultFragments\(params\.fireworkStyleDefaults\)/,
  );
  assert.match(design, /deepMergeDesign\(merged, hydrateBurstTrailDefaults\(fragment\)\)/);
  assert.match(
    design,
    /deepMergeDesign\(\s*deepMergeDesign\(legacyOrDefault, effectStyleDefaults\),\s*baseDefaults,?\s*\)/,
  );
  assert.match(
    design,
    /deepMergeDesign\(\s*deepMergeDesign\(withBase, fireworkStyleDefaults\),\s*variantOverrides,\s*\)/,
  );

  assert.match(showTypes, /CACHE_PREFIX = 'shows:v13'/);
  assert.doesNotMatch(showTypes, /style_default_links:firework_style_default_links/);
  assert.doesNotMatch(showTypes, /style_default_links:firework_effect_style_default_links/);
  assert.doesNotMatch(showMappers, /styleDefaultArrayFromLinks/);
  assert.match(showMappers, /variantOverrides: row\.render_overrides_json/);

  assert.doesNotMatch(adminEffects, /loadEffectStyleDefaultLinkMap/);
  assert.doesNotMatch(adminEffects, /styleDefaultIdMapFromLinks/);
  assert.doesNotMatch(adminFireworks, /loadFireworkStyleDefaultLinkMap/);
  assert.match(adminFireworks, /render_overrides_json/);
});

test('admin actions save copied default settings without live assignments', () => {
  const styleActions = read('app/actions/admin-style-defaults.ts');
  const effectActions = read('app/actions/admin-effects.ts');
  const fireworkActions = read('app/actions/admin-fireworks.ts');
  const effectEditor = read('app/(admin)/admin/effects/[id]/EffectEditor.tsx');
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/FireworkEditor.tsx');

  assert.match(styleActions, /z\.enum\(FIREWORK_STYLE_DEFAULT_KINDS\)/);
  assert.match(styleActions, /styleDefault: AdminStyleDefaultOption/);
  assert.match(styleActions, /styleDefault: \{/);
  assert.match(styleActions, /INITIAL_STYLE_DEFAULT_JSON\[parsedKind\]/);
  assert.match(styleActions, /styleDefaultKindLabel\(parsedKind\)\.toLowerCase\(\)/);
  assert.match(styleActions, /is_archived: true/);
  assert.match(styleActions, /invalidateAdminStyleDefaultsCache\(defaultId\)/);

  assert.match(effectActions, /StyleDefaultAssignmentsSchema/);
  assert.doesNotMatch(effectActions, /normaliseStyleDefaultAssignments/);
  assert.doesNotMatch(effectActions, /replaceEffectStyleDefaultLinks/);
  assert.doesNotMatch(effectActions, /star_style_default_id|trail_style_default_id/);
  assert.match(effectActions, /styleDefaultIds: emptyStyleDefaultIdMap\(\)/);

  assert.match(fireworkActions, /StyleDefaultAssignmentsSchema/);
  assert.doesNotMatch(fireworkActions, /replaceFireworkStyleDefaultLinks/);
  assert.doesNotMatch(fireworkActions, /star_style_default_id|trail_style_default_id/);
  assert.match(fireworkActions, /styleDefaultIds: emptyStyleDefaultIdMap\(\)/);

  assert.match(effectEditor, /function copySelectedStyleDefaultsIntoModel/);
  assert.match(effectEditor, /applySnapshot\(savedSnapshot\)/);
  assert.match(fireworkEditor, /function copySelectedStyleDefaultsIntoOverrides/);
  assert.match(fireworkEditor, /applySnapshot\(savedSnapshot\)/);
});

test('style default saves, archives, and restores record live editor history', () => {
  const migration = read(
    'supabase/migrations/20260715032141_add_style_default_editor_version_history.sql',
  );
  const types = read('lib/database.types.ts');
  const adminTypes = read('lib/admin.types.ts');
  const snapshots = read('lib/admin/editor-snapshots.ts');
  const actions = read('app/actions/admin-style-defaults.ts');
  const loader = read('lib/admin/style-defaults.server.ts');
  const versions = read('lib/admin/editor-versions.server.ts');
  const editor = read('app/(admin)/admin/effects/defaults/[id]/StyleDefaultEditor.tsx');

  assert.match(migration, /add column firework_style_default_id uuid/);
  assert.match(migration, /references public\.firework_style_defaults\(id\) on delete cascade/);
  assert.match(migration, /target_kind in \('firework', 'effect', 'style_default'\)/);
  assert.match(migration, /target_kind = 'style_default'/);
  assert.match(migration, /firework_editor_versions_style_default_created_at_idx/);
  assert.match(types, /firework_style_default_id: string \| null/);
  assert.match(types, /foreignKeyName: "firework_editor_versions_firework_style_default_id_fkey"/);
  assert.match(
    adminTypes,
    /AdminEditorVersionTargetKind = 'firework' \| 'effect' \| 'style_default'/,
  );
  assert.match(adminTypes, /AdminStyleDefaultDetail = AdminStyleDefaultSummary & \{/);
  assert.match(adminTypes, /history: AdminEditorVersion\[\]/);
  assert.match(snapshots, /export type StyleDefaultEditorSnapshot/);
  assert.match(snapshots, /export function makeStyleDefaultEditorSnapshot/);
  assert.match(snapshots, /export function parseStyleDefaultEditorSnapshot/);

  assert.match(loader, /listStyleDefaultEditorVersions/);
  assert.match(loader, /history: await listStyleDefaultEditorVersions\(supabase, defaultId\)/);
  assert.match(versions, /export async function listStyleDefaultEditorVersions/);
  assert.match(versions, /\.eq\('firework_style_default_id', styleDefaultId\)/);
  assert.match(versions, /throwHistoryReadError\('listStyleDefaultEditorVersions', error\)/);

  for (const name of [
    'updateStyleDefault',
    'archiveStyleDefault',
    'restoreStyleDefaultEditorVersion',
  ]) {
    const body = functionBody(actions, name);
    assert.match(body, /historyVersionId: parsed\.data\.historyVersionId/);
    assert.match(body, /const historyRecorded = await recordStyleDefaultVersion/);
    assert.match(body, /return \{ ok: true,[\s\S]*historyVersion, historyRecorded \}/);
    assert.ok(
      body.indexOf('await recordStyleDefaultVersion') < body.indexOf('await refresh'),
      `${name} must observe history before invalidating caches`,
    );
  }
  const restoreBody = functionBody(actions, 'restoreStyleDefaultEditorVersion');
  assert.match(restoreBody, /parseStyleDefaultEditorSnapshot/);
  assert.match(restoreBody, /action: 'restore'/);
  assert.match(restoreBody, /Restored version from/);

  assert.match(editor, /restoreStyleDefaultEditorVersion/);
  assert.match(editor, /parseStyleDefaultEditorSnapshot/);
  assert.match(editor, /id: 'history'/);
  assert.match(editor, /label: 'History'/);
  assert.match(editor, /<EditorHistoryPanel/);
  assert.match(editor, /versions=\{editorHistory\.versions\}/);
  assert.match(editor, /pendingVersionIds=\{editorHistory\.pendingIds\}/);
  assert.match(editor, /onRestore=\{restoreVersion\}/);
  assert.doesNotMatch(editor, /router\.refresh\(\)/);
});

test('inline style-default creation and parent editor saves are atomic', () => {
  const migration = read(
    'supabase/migrations/20260715034851_atomically_create_editor_style_defaults.sql',
  );
  const effectActions = read('app/actions/admin-effects.ts');
  const fireworkActions = read('app/actions/admin-fireworks.ts');
  const effectEditor = read('app/(admin)/admin/effects/[id]/EffectEditor.tsx');
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/FireworkEditor.tsx');

  for (const target of ['effect', 'firework']) {
    assert.match(
      migration,
      new RegExp(`create or replace function public\\.create_style_default_and_update_${target}`),
    );
  }
  assert.match(migration, /security definer/g);
  assert.match(migration, /set search_path = ''/g);
  assert.match(migration, /auth\.uid\(\) is null/);
  assert.match(migration, /current_user_has_permission\('admin\.manage_catalogue'\)/);
  assert.match(migration, /revoke execute[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute[\s\S]*to authenticated/);
  assert.match(migration, /and updated_at = p_expected_updated_at/);

  assert.match(effectActions, /export async function createStyleDefaultAndUpdateEffect/);
  assert.match(effectActions, /rpc\('create_style_default_and_update_effect'/);
  assert.match(fireworkActions, /export async function createStyleDefaultAndUpdateFirework/);
  assert.match(fireworkActions, /rpc\('create_style_default_and_update_firework'/);
  assert.match(effectEditor, /createStyleDefaultAndUpdateEffect\(\{/);
  assert.match(fireworkEditor, /createStyleDefaultAndUpdateFirework\(\{/);
  assert.doesNotMatch(effectEditor, /await createStyleDefault\(\{/);
  assert.doesNotMatch(fireworkEditor, /await createStyleDefault\(\{/);
});

test('style default admin UI exposes every kind without the black accent badge', () => {
  const effectsBrowser = read('app/(admin)/admin/effects/EffectsBrowser.tsx');
  const defaultsEditor = read('app/(admin)/admin/effects/defaults/[id]/StyleDefaultEditor.tsx');
  const effectEditor = read('app/(admin)/admin/effects/[id]/EffectEditor.tsx');
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/FireworkEditor.tsx');
  const sectionPanels = read('app/components/admin/EditorSectionPanels.tsx');
  const selectField = read('app/components/ui/SelectField.tsx');
  const controls = read('app/components/admin/FireworkRenderControls.tsx');
  const styleDefaults = read('lib/fireworks/style-defaults.ts');

  assert.match(effectsBrowser, /FIREWORK_STYLE_DEFAULT_KINDS\.map/);
  assert.match(effectsBrowser, /function StyleDefaultCreateAction/);
  assert.match(effectsBrowser, /name="kind"/);
  assert.match(effectsBrowser, /Add new/);
  assert.doesNotMatch(
    effectsBrowser,
    /New \{styleDefaultKindLabel\(kind\)\.toLowerCase\(\)\} default/,
  );
  assert.match(effectsBrowser, /styleDefaultBadgeTone/);
  assert.doesNotMatch(effectsBrowser, /tone=\{styleDefault\.kind === 'star' \? 'accent' : 'sky'\}/);
  assert.doesNotMatch(effectsBrowser, /formatEffectType|effect\.type|Effect type/);
  assert.doesNotMatch(effectsBrowser, /tone="accent" solid icon=\{Sparkles\}/);
  assert.doesNotMatch(effectsBrowser, /Linked effects/);
  assert.doesNotMatch(effectsBrowser, /Linked fireworks/);

  assert.match(defaultsEditor, /const KIND_OPTIONS = FIREWORK_STYLE_DEFAULT_KINDS\.map/);
  assert.match(defaultsEditor, /FireworkEditorShell/);
  assert.match(defaultsEditor, /EditorPreviewTransport/);
  assert.match(defaultsEditor, /estimatePreviewTicks/);
  assert.match(defaultsEditor, /estimateLaunchPreviewDurationSeconds/);
  assert.match(defaultsEditor, /estimateLaunchPreviewTicks/);
  assert.match(defaultsEditor, /JsonReadOnlyPanel/);
  assert.match(defaultsEditor, /id: kind/);
  assert.match(defaultsEditor, /icon: KIND_ICON\[kind\]/);
  assert.match(defaultsEditor, /controlScope=\{kind\}/);
  assert.match(defaultsEditor, /showLaunch=\{kind === 'launch'\}/);
  assert.match(defaultsEditor, /type TrailPreviewStarMode = 'none' \| 'default' \| 'custom'/);
  assert.match(defaultsEditor, /useState<TrailPreviewStarMode>\('none'\)/);
  assert.match(
    defaultsEditor,
    /InfoTooltip text="Adds an optional star only for judging this trail in the preview/,
  );
  assert.match(defaultsEditor, /controlScope="star"/);
  assert.match(defaultsEditor, /Archive default/);
  assert.match(defaultsEditor, /showStarfield=\{false\}/);
  assert.doesNotMatch(defaultsEditor, /id: 'star'|id: 'trail'|id: 'launch'|id: 'fx'/);

  assert.match(effectEditor, /EditorStyleDefaultControls/);
  for (const kind of [
    'geometry',
    'star',
    'trail',
    'launch',
    'strobe',
    'crackle',
    'split',
    'smoke',
    'sound',
  ]) {
    assert.match(effectEditor, new RegExp(`renderStyleDefaultControls\\('${kind}'\\)`));
  }
  assert.doesNotMatch(effectEditor, /id: 'defaults'/);
  assert.doesNotMatch(effectEditor, /PanelSection title="Style defaults"/);
  assert.match(effectEditor, /removeStyleDefaultOverridesFromRecord/);
  assert.match(effectEditor, /createdStyleDefaults/);
  assert.match(effectEditor, /result\.styleDefault/);
  assert.match(effectEditor, /Style default created and saved/);
  assert.match(effectEditor, /function materialiseStyleDefault/);
  assert.match(effectEditor, /updateModelDefaultsForStyle\('star'/);
  assert.match(effectEditor, /updateModelDefaultsForStyle\('trail'/);
  assert.match(styleDefaults, /function isBrocadeCrownDesign/);
  assert.match(styleDefaults, /function makeLaunchPreviewStarLayers/);
  assert.match(styleDefaults, /kind === 'launch'[\s\S]*makeLaunchPreviewStarLayers/);
  assert.match(styleDefaults, /starDefaults\.burst = cloneJson\(design\.burst\)/);
  assert.match(styleDefaults, /brocadeDefaults\.streakCount = design\.stars\.outer\.count/);
  assert.match(styleDefaults, /starDefaults\.brocade = brocadeDefaults/);
  assert.match(fireworkEditor, /EditorStyleDefaultControls/);
  for (const kind of [
    'geometry',
    'star',
    'trail',
    'launch',
    'strobe',
    'crackle',
    'split',
    'smoke',
    'sound',
  ]) {
    assert.match(fireworkEditor, new RegExp(`renderStyleDefaultControls\\('${kind}'\\)`));
  }
  assert.doesNotMatch(fireworkEditor, /Effect default: \$\{inherited\.name\}/);
  assert.doesNotMatch(fireworkEditor, /PanelSection title="Style defaults"/);
  assert.match(fireworkEditor, /createdStyleDefaults/);
  assert.match(fireworkEditor, /result\.styleDefault/);
  assert.match(fireworkEditor, /Style default created and saved/);
  assert.doesNotMatch(fireworkEditor, /orderedStyleDefaultValues\(selectedEffectStyleDefaults\)/);
  assert.match(fireworkEditor, /orderedStyleDefaultValues\(selectedFireworkStyleDefaults\)/);
  assert.match(fireworkEditor, /function materialiseStyleDefault/);
  assert.match(fireworkEditor, /mutateOverridesForStyle\('star'/);
  assert.match(fireworkEditor, /mutateOverridesForStyle\('trail'/);
  assert.doesNotMatch(fireworkEditor, /selectedEffectStyleDefaults\[kind\] != null/);
  assert.match(sectionPanels, /Save as effect/);
  assert.match(sectionPanels, /variant="destructive"/);
  assert.match(sectionPanels, /AlertDialog/);
  assert.doesNotMatch(sectionPanels, /Save changes/);
  assert.match(selectField, /<SelectValue placeholder=\{placeholder\}>/);

  assert.match(controls, /\| 'launch'/);
  assert.match(controls, /\| 'smoke'/);
  assert.match(controls, /\| 'starInner'/);
  assert.match(controls, /\| 'strobe'/);
  assert.match(controls, /\| 'crackle'/);
  assert.match(controls, /\| 'split'/);
  assert.match(controls, /\| 'sound'/);
  assert.match(controls, /if \(controlScope === 'launch'\)/);
  assert.match(controls, /label="Show shell particle"/);
  assert.match(controls, /if \(controlScope === 'smoke'\)/);
  assert.match(controls, /if \(controlScope === 'starInner'\)/);
  assert.match(controls, /if \(controlScope === 'sound'\)/);
});

test('style default helpers extract only the requested section', () => {
  const styleDefaults = read('lib/fireworks/style-defaults.ts');

  for (const kind of [
    'geometry',
    'star',
    'trail',
    'launch',
    'smoke',
    'strobe',
    'crackle',
    'split',
    'sound',
  ]) {
    assert.match(styleDefaults, new RegExp(`'${kind}'`));
  }

  assert.match(
    styleDefaults,
    /launch: \{\s*shell: cloneJson\(design\.launch\.shell\),\s*liftParticles: cloneJson\(design\.launch\.liftParticles\)/,
  );
  assert.match(styleDefaults, /smoke: cloneJson\(design\.launch\.smoke\)/);
  assert.match(styleDefaults, /strobe: cloneJson\(design\.strobe\)/);
  assert.match(styleDefaults, /crackle: cloneJson\(design\.crackle\)/);
  assert.match(styleDefaults, /split: cloneJson\(design\.split\)/);
  assert.match(styleDefaults, /sound: cloneJson\(design\.sound\)/);
  assert.match(styleDefaults, /geometryTuning: cloneJson\(design\.geometryTuning\)/);
  assert.match(styleDefaults, /removeStyleDefaultOverridesFromRecord/);
  assert.match(
    styleDefaults,
    /case 'star':[\s\S]*delete defaults\.stars;[\s\S]*delete defaults\.burst;[\s\S]*delete defaults\.brocade;/,
  );
  assert.match(styleDefaults, /deleteNested\(defaults, \['launch', 'smoke'\]\)/);
  assert.match(styleDefaults, /deleteNested\(defaults, \['mortar', 'sound'\]\)/);
  assert.match(styleDefaults, /hydrateBurstTrailDefaults\(source\)/);
});

test('style default writes reject invalid renderer fragments', () => {
  const actions = read('app/actions/admin-style-defaults.ts');

  assert.match(actions, /fireworkDesignFragmentError\(parsed\)/);
  assert.match(actions, /fireworkDesignFragmentError\(snapshot\.defaultsJson\)/);
});

test('built-in partial trail defaults are hydrated by follow-up migration', () => {
  const migration = read(
    'supabase/migrations/20260618070216_hydrate_firework_style_default_trails.sql',
  );

  for (const [slug, preset, particles] of [
    ['spark-dust-trail', 'sparkDust', 24],
    ['solid-streaks-trail', 'solidStreaks', 84],
    ['willow-hang-trail', 'willowHang', 72],
    ['comet-tail-trail', 'cometTail', 96],
    ['dense-brocade-trail', 'denseBrocade', 120],
  ]) {
    assert.match(migration, new RegExp(`'${slug}'`));
    assert.match(migration, new RegExp(`"preset":"${preset}"`));
    assert.match(migration, new RegExp(`"particlesPerStar":${particles}`));
  }

  assert.match(migration, /"enabled":true/);
  assert.match(migration, /"stops":\[/);
  assert.match(migration, /defaults\.defaults_json #> '\{burstTrail,enabled\}' is null/);
  assert.match(migration, /defaults\.defaults_json #> '\{burstTrail,particlesPerStar\}' is null/);
  assert.match(migration, /defaults\.defaults_json #> '\{burstTrail,stops\}' is null/);
  assert.doesNotMatch(migration, /square-star-fade-trail/);
});

test('realistic preset and shaped-effect seeds stay reusable without creating base fireworks', () => {
  const defaultsMigration = read(
    'supabase/migrations/20260715065634_seed_realistic_firework_style_defaults.sql',
  );
  const effectsMigration = read(
    'supabase/migrations/20260715071512_add_heart_and_outlined_star_effects.sql',
  );
  const defaults = readDollarQuotedJson(defaultsMigration, 'seed');
  const effects = readDollarQuotedJson(effectsMigration, 'effects');

  assert.equal(defaults.length, 51);
  assert.deepEqual(
    new Set(defaults.map((entry) => entry.kind)),
    new Set([
      'geometry',
      'star',
      'trail',
      'launch',
      'smoke',
      'strobe',
      'crackle',
      'split',
      'sound',
    ]),
  );
  assert.match(defaultsMigration, /insert into public\.firework_style_defaults/);

  assert.deepEqual(
    effects.map((entry) => ({
      slug: entry.slug,
      family: entry.family,
      source: entry.source,
      geometry: entry.model_json?.renderDefaults?.geometry,
    })),
    [
      {
        slug: 'heart-shell',
        family: 'aerial_burst',
        source: 'manual',
        geometry: 'heart',
      },
      {
        slug: 'outlined-star-shell',
        family: 'aerial_burst',
        source: 'manual',
        geometry: 'five_point_star',
      },
    ],
  );
  assert.match(effectsMigration, /insert into public\.firework_effects/);
  assert.doesNotMatch(
    effectsMigration,
    /insert into public\.(?:fireworks|firework_variants|catalogue_items|products)/,
  );
});
