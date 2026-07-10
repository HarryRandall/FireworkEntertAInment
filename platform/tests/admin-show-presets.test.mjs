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
  assert.match(shell, /href: '\/admin\/show-presets'/);
  assert.match(shell, /label: 'Explore shows'/);
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
  const actions = read('app/actions/admin-show-presets.ts');
  const index = read('lib/admin/index.ts');
  const homePage = read('app/(app)/home/page.tsx');
  const libraryPage = read('app/(app)/library/page.tsx');
  const libraryDetailPage = read('app/(app)/library/[id]/page.tsx');

  assert.match(templates, /getShowTemplatesCacheKey\(\)/);
  assert.match(templates, /\.eq\('is_published', true\)/);
  assert.match(templates, /listAdminShowPresets/);
  assert.match(templates, /getAdminShowPresetById/);
  assert.match(templates, /listAdminShowPresetImportShows/);
  assert.match(templates, /requirePermission\('admin\.manage_catalogue'\)/);

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
  assert.doesNotMatch(actions, /source_show_id/);

  assert.match(homePage, /listFireworkProducts/);
  assert.match(libraryPage, /listFireworkProducts/);
  assert.match(libraryDetailPage, /listFireworkProducts/);
});

test('cue parsing, previews, clone and import paths support catalogue-item cues', () => {
  const mappers = read('lib/admin/mappers.ts');
  const replayCues = read('app/components/app/template-replay-cues.ts');
  const cloneAction = read('app/actions/show-templates.ts');
  const seedTemplates = read('lib/library-seed-templates.ts');

  assert.match(mappers, /catalogueItemId/);
  assert.match(mappers, /catalogueItemSlug/);
  assert.match(mappers, /fireworkSlug/);
  assert.match(mappers, /normaliseCueEmphasis/);
  assert.match(mappers, /normaliseLaunchPositionIndex/);

  assert.match(replayCues, /FIREWORK_SLUG_ALIASES/);
  assert.match(replayCues, /spec\.variant\?\.slug === slug/);
  assert.match(replayCues, /spec\.baseEffect\?\.slug === slug/);
  assert.match(replayCues, /cue\.catalogueItemId/);
  assert.match(replayCues, /cue\.catalogueItemSlug/);

  assert.match(cloneAction, /catalogueItemIds/);
  assert.match(cloneAction, /cue\.catalogueItemId/);
  assert.match(cloneAction, /cue\.catalogueItemSlug/);
  assert.match(cloneAction, /cue\.fireworkSlug/);
  assert.match(cloneAction, /multishots/);
  assert.match(cloneAction, /launch_position_index: cue\.launchPositionIndex/);
  assert.match(cloneAction, /emphasis: cue\.emphasis/);

  assert.match(seedTemplates, /catalogueItemId: null/);
  assert.match(seedTemplates, /catalogueItemSlug: null/);
  assert.match(seedTemplates, /launchPositionIndex/);
  assert.match(seedTemplates, /emphasis/);
});

test('admin show preset editor exposes replay, timeline, catalogue picker and publish controls', () => {
  const editor = read('app/(admin)/admin/show-presets/[id]/ShowPresetEditor.tsx');
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
  assert.match(editor, /onPointerEnter=\{\(\) => setSelectedId\(product\.id\)\}/);
  assert.match(editor, /showCameraControls=\{false\}/);
  assert.match(editor, /Save timeline/);
  assert.match(editor, /Save details/);
  assert.match(editor, /Publishing checklist/);
  assert.match(editor, /replaceShowPresetCues/);
  assert.match(editor, /updateShowPresetDetails/);
  assert.match(editor, /setShowPresetPublished/);
});
