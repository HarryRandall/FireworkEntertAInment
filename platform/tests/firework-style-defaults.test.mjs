/** Static guards for copy-on-apply firework style defaults. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('style default schema keeps saved defaults and prunes live links', () => {
  const baseMigrationPath = 'supabase/migrations/20260618051341_live_firework_style_defaults.sql';
  const generalisedMigrationPath =
    'supabase/migrations/20260618081656_generalised_firework_style_defaults.sql';
  const copyMigrationPath =
    'supabase/migrations/20260709082959_copy_style_defaults_and_clean_indexes.sql';
  assert.equal(existsSync(join(root, baseMigrationPath)), true);
  assert.equal(existsSync(join(root, generalisedMigrationPath)), true);
  assert.equal(existsSync(join(root, copyMigrationPath)), true);

  const baseMigration = read(baseMigrationPath);
  const generalisedMigration = read(generalisedMigrationPath);
  const copyMigration = read(copyMigrationPath);
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

  assert.match(showTypes, /CACHE_PREFIX = 'shows:v11'/);
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
  assert.match(effectEditor, /setStyleDefaultIds\(\{ \.\.\.savedSnapshot\.styleDefaultIds \}\)/);
  assert.match(fireworkEditor, /function copySelectedStyleDefaultsIntoOverrides/);
  assert.match(fireworkEditor, /setStyleDefaultIds\(\{ \.\.\.savedSnapshot\.styleDefaultIds \}\)/);
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
  for (const kind of ['star', 'trail', 'launch', 'strobe', 'crackle', 'split', 'smoke', 'sound']) {
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
  for (const kind of ['star', 'trail', 'launch', 'strobe', 'crackle', 'split', 'smoke', 'sound']) {
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

  for (const kind of ['star', 'trail', 'launch', 'smoke', 'strobe', 'crackle', 'split', 'sound']) {
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
  assert.match(styleDefaults, /removeStyleDefaultOverridesFromRecord/);
  assert.match(styleDefaults, /deleteNested\(defaults, \['launch', 'smoke'\]\)/);
  assert.match(styleDefaults, /deleteNested\(defaults, \['mortar', 'sound'\]\)/);
  assert.match(styleDefaults, /hydrateBurstTrailDefaults\(source\)/);
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
