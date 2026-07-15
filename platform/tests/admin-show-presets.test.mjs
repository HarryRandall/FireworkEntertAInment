/** Static guards for the admin curated Explore/Home show preset editor. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('admin show preset routes and navigation are wired without old header bands', () => {
  for (const path of [
    'app/(admin)/admin/show-presets/page.tsx',
    'app/(admin)/admin/show-presets/loading.tsx',
    'app/(admin)/admin/show-presets/[id]/page.tsx',
    'app/(admin)/admin/show-presets/[id]/loading.tsx',
    'app/(admin)/admin/show-presets/[id]/ShowPresetEditor.tsx',
    'app/(admin)/admin/show-presets/ShowPresetActions.tsx',
  ]) {
    assert.equal(existsSync(join(root, path)), true, `${path} exists`);
    assert.doesNotMatch(read(path), /AppPageHeader|AdminRouteHeaderSkeleton/);
  }

  const shell = read('app/components/admin/AdminShell.tsx');
  const actions = read('app/(admin)/admin/show-presets/ShowPresetActions.tsx');
  assert.match(shell, /href: '\/admin\/show-presets'/);
  assert.match(shell, /label: 'Explore shows'/);
  assert.match(shell, /href: '\/admin\/cover-posters'/);
  assert.match(shell, /label: 'Cover posters'/);
  assert.match(actions, /href="\/admin\/cover-posters"/);
  assert.match(actions, /Cover posters/);
});

test('show preset publication migration and generated types protect drafts', () => {
  const migration = read('supabase/migrations/20260709134609_admin_show_presets_publication.sql');
  const types = read('lib/database.types.ts');
  const showPresetsTypes = types.match(/show_presets: \{[\s\S]*?show_timeline_items:/)?.[0] ?? '';

  assert.match(migration, /add column if not exists is_published boolean not null default true/);
  assert.match(migration, /add column if not exists published_at timestamptz/);
  assert.match(migration, /where is_published = true/);
  assert.match(migration, /grant select on public\.show_presets to anon/);
  assert.match(migration, /show_presets_read_published_or_admin/);
  assert.match(
    migration,
    /for select[\s\S]*?using \([\s\S]*?is_published[\s\S]*?current_user_has_permission\('admin\.manage_catalogue'\)/,
  );
  assert.match(migration, /show_presets_admin_modify/);
  assert.match(
    migration,
    /with check \(public\.current_user_has_permission\('admin\.manage_catalogue'\)\)/,
  );
  assert.doesNotMatch(migration, /show_presets_read_anyone[\s\S]*?for select using \(true\)/);

  assert.match(showPresetsTypes, /is_published: boolean/);
  assert.match(showPresetsTypes, /published_at: string \| null/);
  assert.match(showPresetsTypes, /is_published\?: boolean/);
  assert.match(showPresetsTypes, /published_at\?: string \| null/);
});

test('public reads only use published presets while admin helpers include drafts', () => {
  const templates = read('lib/admin/templates.server.ts');
  const timing = read('lib/show-preset-timing.server.ts');
  const actions = read('app/actions/admin-show-presets.ts');
  const index = read('lib/admin/index.ts');
  const homePage = read('app/(app)/home/page.tsx');
  const libraryPage = read('app/(browse)/library/page.tsx');
  const libraryDetailPage = read('app/(browse)/library/[id]/page.tsx');

  assert.match(templates, /getShowTemplatesCacheKey\(\)/);
  assert.match(templates, /\.eq\('is_published', true\)/);
  assert.match(templates, /listAdminShowPresets/);
  assert.match(templates, /getAdminShowPresetById/);
  assert.match(templates, /listAdminShowPresetImportShows/);
  assert.match(templates, /catalogueResolutionKeys/);
  assert.doesNotMatch(templates, /async function mapAdminSummary/);
  assert.match(templates, /requirePermission\('admin\.manage_catalogue'\)/);
  assert.match(templates, /SHOW_TEMPLATES_FALLBACK_SELECTS/);
  assert.doesNotMatch(templates, /SHOW_TEMPLATES_LEGACY_SELECT/);
  assert.ok(
    (templates.match(/\.eq\('is_published', true\)/g) ?? []).length >= 4,
    'every public list and detail fallback remains publication-scoped',
  );
  assert.match(timing, /const endSeconds = cue\.timeSeconds \+ durationSeconds/);
  assert.match(timing, /ends at.*show duration/);

  for (const action of [
    'createShowPreset',
    'duplicateShowPreset',
    'importAllGeneratedShowsAsPresets',
    'updateShowPresetDetails',
    'replaceShowPresetCues',
    'setShowPresetPublished',
    'importGeneratedShowAsPreset',
  ]) {
    assert.match(actions, new RegExp(`export async function ${action}`));
  }
  assert.match(index, /getAdminShowPresetById/);
  assert.match(index, /listAdminShowPresets/);
  assert.match(index, /listAdminShowPresetImportShows/);
  assert.match(actions, /validatePublishablePreset/);
  assert.match(
    actions,
    /currentPreset\.is_published[\s\S]*validatePresetTimeline\([\s\S]*parsed\.data\.durationSeconds/,
  );
  assert.match(actions, /is_published: false/);
  assert.match(actions, /published_at: null/);
  assert.match(actions, /createServiceRoleSupabase/);
  assert.match(actions, /loadCompletedGeneratedShows/);
  assert.match(actions, /loadTimelineCuesForShows/);
  assert.match(actions, /importedGeneratedShowSlug/);
  assert.match(actions, /skippedCount/);
  assert.match(actions, /show_timeline_items/);
  assert.match(actions, /catalogue_items\(part_number, name\)/);
  assert.match(actions, /catalogueItemId: cue\.catalogue_item_id/);
  assert.match(actions, /catalogueItemSlug: item\.part_number/);
  assert.match(actions, /source_show_id: show\.id/);

  assert.match(homePage, /listFireworkProducts/);
  assert.doesNotMatch(libraryPage, /listFireworkProducts/);
  assert.doesNotMatch(libraryDetailPage, /listFireworkProducts/);
  assert.match(libraryDetailPage, /listReferencedShowTemplateSpecifications/);
});

test('cue parsing, previews, clone and import paths support catalogue-item cues', () => {
  const mappers = read('lib/admin/mappers.ts');
  const replayCues = read('app/components/app/template-replay-cues.ts');
  const cloneAction = read('app/actions/show-templates.ts');
  const presetActions = read('app/actions/admin-show-presets.ts');
  const seedMigration = read('supabase/migrations/20260629171000_seed_library_explore_shelves.sql');

  assert.match(mappers, /catalogueItemId/);
  assert.match(mappers, /catalogueItemSlug/);
  assert.match(mappers, /fireworkSlug/);
  assert.match(mappers, /normaliseCueEmphasis/);
  assert.match(mappers, /unresolvedTemplateCue/);
  assert.match(mappers, /return value\.map\(\(item, index\)/);
  assert.match(mappers, /launchPositionIndex < 0[\s\S]*launchPositionIndex > 2/);

  assert.match(replayCues, /FIREWORK_SLUG_ALIASES/);
  assert.match(replayCues, /spec\.variant\?\.slug === slug/);
  assert.match(replayCues, /spec\.baseEffect\?\.slug === slug/);
  assert.match(replayCues, /cue\.catalogueItemId/);
  assert.match(replayCues, /cue\.catalogueItemSlug/);

  assert.match(cloneAction, /validatePresetTimeline/);
  assert.match(cloneAction, /resolvedCues/);
  assert.match(cloneAction, /cue\.catalogueItemId/);
  assert.match(cloneAction, /cue\.catalogueItemSlug/);
  assert.match(cloneAction, /cue\.fireworkSlug/);
  assert.match(cloneAction, /FIREWORK_SLUG_ALIASES/);
  assert.match(cloneAction, /launch_position_index: cue\.launchPositionIndex/);
  assert.match(cloneAction, /emphasis: cue\.emphasis/);
  assert.match(cloneAction, /cloneToken/);
  assert.match(cloneAction, /existingShow/);
  assert.match(cloneAction, /cloneCueCount/);
  assert.match(cloneAction, /removeIncompleteClone/);
  assert.match(cloneAction, /INCOMPLETE_CLONE_GRACE_MS/);
  assert.match(cloneAction, /redirectToCloneError/);

  assert.match(presetActions, /Timeline cue \$\{cue\.position\} has no usable catalogue item/);
  assert.doesNotMatch(presetActions, /\.not\('time_seconds', 'is', null\)/);
  assert.match(presetActions, /if \(!convertedCues\.ok\)/);

  assert.match(seedMigration, /'fireworkSlug'/);
  assert.match(seedMigration, /'timeSeconds'/);
});

test('admin show preset editor exposes replay, timeline, catalogue picker and publish controls', () => {
  const editor = read('app/(admin)/admin/show-presets/[id]/ShowPresetEditor.tsx');
  const loading = read('app/(admin)/admin/show-presets/[id]/loading.tsx');
  const detailPage = read('app/(admin)/admin/show-presets/[id]/page.tsx');
  const listPage = read('app/(admin)/admin/show-presets/page.tsx');
  const createActions = read('app/(admin)/admin/show-presets/ShowPresetActions.tsx');

  assert.match(detailPage, /getAdminShowPresetById/);
  assert.match(detailPage, /listFireworkProducts/);
  assert.match(listPage, /New draft/);
  assert.match(createActions, /duplicateShowPreset/);
  assert.match(createActions, /importAllGeneratedShowsAsPresets/);
  assert.match(createActions, /Import all shows/);
  assert.match(createActions, /importGeneratedShowAsPreset/);
  assert.match(createActions, /Import show/);

  assert.match(editor, /LazyFireworkReplayCanvas/);
  assert.match(editor, /EditorPreviewTransport/);
  assert.match(editor, /PreviewFullscreenBackdrop/);
  assert.match(editor, /usePreviewFullscreen/);
  assert.match(editor, /Timeline/);
  assert.match(editor, /Insert catalogue item/);
  assert.match(editor, /ProductPickerDialog/);
  assert.match(editor, /flex min-h-0 flex-1 flex-col gap-5/);
  assert.match(editor, /grid shrink-0 items-stretch gap-5/);
  assert.match(editor, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(editor, /lg:h-\[min\(560px,calc\(100dvh-14rem\)\)\]/);
  assert.match(editor, /lg:grid-cols-\[minmax\(280px,1fr\)_minmax\(0,2fr\)\]/);
  assert.match(
    editor,
    /initialSelectedId=\{pickerMode === 'replace' \? selectedProduct\?\.id : undefined\}/,
  );
  assert.match(editor, /onPointerEnter=\{\(\) => setSelectedId\(product\.id\)\}/);
  assert.match(editor, /aria-label="Filter catalogue type"/);
  assert.match(editor, /showCameraControls=\{false\}/);
  assert.match(editor, /primeOnCueChanges=\{false\}/);
  assert.match(editor, /setPointerCapture/);
  assert.match(editor, /onPointerMove=\{handlePointerMove\}/);
  assert.match(editor, /Drag a cue to change its timing/);
  assert.match(editor, /Edit preset details/);
  assert.match(editor, /More settings/);
  assert.match(editor, /Cue options/);
  assert.match(editor, /Effect preview/);
  assert.doesNotMatch(editor, /selectedProduct\?\.description/);
  assert.match(editor, /Save timeline/);
  assert.match(editor, /Save details/);
  assert.match(editor, /Not ready to publish/);
  assert.match(editor, /unresolvedCueCount/);
  assert.match(editor, /saving is blocked until each one is[\s\S]*replaced or removed/);
  assert.match(editor, /replaceShowPresetCues/);
  assert.match(editor, /updateShowPresetDetails/);
  assert.match(editor, /setShowPresetPublished/);
  assert.match(loading, /grid shrink-0 items-stretch gap-5/);
  assert.match(loading, /grid grid-cols-2 gap-3/);
  assert.match(loading, /sm:flex-row sm:items-center sm:justify-between/);
});
