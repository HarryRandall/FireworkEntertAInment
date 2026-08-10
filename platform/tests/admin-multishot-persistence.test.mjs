import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  clampMultishotPanDegrees,
  clampMultishotTimeSeconds,
  clampMultishotTiltDegrees,
  clampMultishotTrackIndex,
  MULTISHOT_CALIBER_MAX_LENGTH,
  MULTISHOT_DESCRIPTION_MAX_LENGTH,
  MULTISHOT_MAX_DURATION_SECONDS,
  MULTISHOT_MAX_SHOT_COUNT,
  MULTISHOT_MAX_TRACK_COUNT,
  MULTISHOT_NAME_MAX_LENGTH,
  MULTISHOT_NOTES_MAX_LENGTH,
  MULTISHOT_PAN_LIMIT_DEGREES,
  MULTISHOT_TILT_LIMIT_DEGREES,
} from '../lib/admin/multishot-constraints.ts';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('multishot aim and timing helpers enforce the action bounds', () => {
  assert.equal(MULTISHOT_PAN_LIMIT_DEGREES, 30);
  assert.equal(MULTISHOT_TILT_LIMIT_DEGREES, 50);
  assert.equal(MULTISHOT_MAX_DURATION_SECONDS, 3600);
  assert.equal(MULTISHOT_MAX_TRACK_COUNT, 2000);
  assert.equal(clampMultishotPanDegrees(-31), -30);
  assert.equal(clampMultishotPanDegrees(31), 30);
  assert.equal(clampMultishotTiltDegrees(-51), -50);
  assert.equal(clampMultishotTiltDegrees(51), 50);
  assert.equal(clampMultishotTimeSeconds(-0.1), 0);
  assert.equal(clampMultishotTimeSeconds(3600.1), 3600);
  assert.equal(clampMultishotTrackIndex(-1), 0);
  assert.equal(clampMultishotTrackIndex(undefined), 0);
  assert.equal(clampMultishotTrackIndex(Number.NaN), 0);
  assert.equal(clampMultishotTrackIndex(4.9), 4);
  assert.equal(clampMultishotTrackIndex(2000), 1999);
});

test('multishot database constraints mirror the admin action contract', () => {
  const migration = read(
    'supabase/migrations/20260710013955_align_multishot_constraints_and_catalogue.sql',
  );
  const tracksMigration = read(
    'supabase/migrations/20260810003120_add_multishot_timeline_tracks.sql',
  );

  assert.equal(MULTISHOT_NAME_MAX_LENGTH, 180);
  assert.equal(MULTISHOT_DESCRIPTION_MAX_LENGTH, 5000);
  assert.equal(MULTISHOT_MAX_SHOT_COUNT, 2000);
  assert.match(tracksMigration, /add column timeline_track_index integer not null default 0/);
  assert.match(tracksMigration, /constraint multishot_fireworks_timeline_track_range/);
  assert.match(tracksMigration, /check \(timeline_track_index between 0 and 1999\)/);
  assert.equal(MULTISHOT_CALIBER_MAX_LENGTH, 40);
  assert.equal(MULTISHOT_NOTES_MAX_LENGTH, 500);
  assert.match(
    migration,
    /set pan_degrees = greatest\(-30, least\(30, pan_degrees\)\),\s+tilt_degrees = greatest\(-50, least\(50, tilt_degrees\)\)/,
  );
  assert.match(migration, /drop constraint if exists multishot_fireworks_tilt_degrees_check/);

  for (const constraint of [
    'multishots_name_length',
    'multishots_description_length',
    'multishots_duration_range',
    'multishots_shot_count_range',
    'multishot_fireworks_sequence_range',
    'multishot_fireworks_time_range',
    'multishot_fireworks_pan_range',
    'multishot_fireworks_tilt_range',
    'multishot_fireworks_caliber_length',
    'multishot_fireworks_notes_length',
  ]) {
    assert.match(migration, new RegExp(`add constraint ${constraint}`));
  }

  assert.match(migration, /check \(char_length\(btrim\(name\)\) between 1 and 180\)/);
  assert.match(migration, /check \(char_length\(coalesce\(description, ''\)\) <= 5000\)/);
  assert.match(
    migration,
    /check \(duration_seconds is null or duration_seconds between 0 and 3600\)/,
  );
  assert.match(migration, /check \(shot_count between 0 and 2000\)/);
  assert.match(migration, /check \(sequence_index between 1 and 2000\)/);
  assert.match(migration, /check \(time_offset_seconds between 0 and 3600\)/);
  assert.match(migration, /check \(pan_degrees between -30 and 30\)/);
  assert.match(migration, /check \(tilt_degrees between -50 and 50\)/);
  assert.match(migration, /check \(char_length\(coalesce\(caliber, ''\)\) <= 40\)/);
  assert.match(migration, /check \(char_length\(coalesce\(notes, ''\)\) <= 500\)/);
  assert.match(
    migration,
    /add constraint catalogue_items_multishot_id_key unique \(multishot_id\)/,
  );
  const databaseTypes = read('lib/database.types.ts');
  assert.match(databaseTypes, /timeline_track_index: number/);
  assert.match(
    databaseTypes,
    /foreignKeyName: "catalogue_items_multishot_id_fkey"[\s\S]*?isOneToOne: true/,
  );
  assert.match(
    migration,
    /create or replace function public\.ensure_catalogue_item_for_multishot\(\)[\s\S]*?security definer[\s\S]*?set search_path = ''/,
  );
  const catalogueCreator = migration.slice(
    migration.indexOf('create or replace function public.ensure_catalogue_item_for_multishot()'),
    migration.indexOf('revoke execute on function public.ensure_catalogue_item_for_multishot()'),
  );
  assert.match(
    catalogueCreator,
    /insert into public\.catalogue_items[\s\S]*?part_number_value,[\s\S]*?new\.name,[\s\S]*?new\.description/,
  );
  assert.doesNotMatch(catalogueCreator, /update public\.catalogue_items/);
  assert.match(
    migration,
    /create trigger multishots_ensure_catalogue_item[\s\S]*?after insert on public\.multishots[\s\S]*?execute function public\.ensure_catalogue_item_for_multishot\(\)/,
  );
  assert.match(
    migration,
    /revoke execute on function public\.ensure_catalogue_item_for_multishot\(\)[\s\S]*?from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /create or replace function private\.multishot_minimum_duration\(p_multishot_id uuid\)[\s\S]*?ceil\([\s\S]*?greatest\([\s\S]*?0\.5::numeric/,
  );
  assert.match(
    migration,
    /create or replace function private\.sync_multishot_derived_state\(p_multishot_id uuid\)[\s\S]*?for update[\s\S]*?set shot_count = derived_shot_count,[\s\S]*?duration_seconds = case/,
  );
  assert.match(
    migration,
    /create trigger multishot_fireworks_sync_derived_state[\s\S]*?after insert or update or delete on public\.multishot_fireworks/,
  );
  assert.match(
    migration,
    /create trigger fireworks_sync_multishot_dependencies[\s\S]*?after update of duration_seconds on public\.fireworks/,
  );
  assert.match(
    migration,
    /create trigger catalogue_items_sync_multishot_dependencies_insert[\s\S]*?after insert on public\.catalogue_items/,
  );
  assert.match(
    migration,
    /create trigger catalogue_items_sync_multishot_dependencies_update[\s\S]*?after update of duration_seconds, firework_id on public\.catalogue_items/,
  );
  assert.match(
    migration,
    /create or replace function public\.sync_multishot_derived_state\(p_multishot_id uuid\)[\s\S]*?current_user_has_permission\('admin\.manage_catalogue'\)[\s\S]*?grant execute on function public\.sync_multishot_derived_state\(uuid\)[\s\S]*?to authenticated, service_role/,
  );
  const safeCatalogueBackfill = migration.slice(
    migration.indexOf('-- Backfill only missing links.'),
  );
  assert.doesNotMatch(safeCatalogueBackfill, /set part_number|set name|set description/);
  assert.match(
    safeCatalogueBackfill,
    /set duration_seconds = multishot\.duration_seconds[\s\S]*?item\.duration_seconds < multishot\.duration_seconds/,
  );
});

test('multishot actions validate and resynchronise conservative derived duration', () => {
  const actions = read('app/actions/admin-multishots.ts');
  const derivation = actions.slice(
    actions.indexOf('async function deriveMultishotState'),
    actions.indexOf('async function resynchroniseMultishotDerivedState'),
  );
  const metadataUpdate = actions.slice(
    actions.indexOf('export async function updateMultishot'),
    actions.indexOf('export async function upsertMultishotShot'),
  );
  const shotMutations = actions.slice(actions.indexOf('export async function upsertMultishotShot'));

  assert.match(actions, /MIN_PRODUCT_DURATION_SECONDS/);
  assert.match(derivation, /fireworks\(duration_seconds, catalogue_items\(duration_seconds\)\)/);
  assert.match(derivation, /Math\.max\([\s\S]*?MIN_PRODUCT_DURATION_SECONDS/);
  assert.match(derivation, /Math\.ceil\(maximumEndSeconds \* 100\) \/ 100/);
  assert.match(metadataUpdate, /deriveMultishotState\(supabase, parsed\.data\.id\)/);
  assert.match(
    metadataUpdate,
    /requestedDuration \+ Number\.EPSILON < derived\.minimumDurationSeconds/,
  );
  assert.match(metadataUpdate, /Duration must be at least/);
  assert.equal(
    [
      ...shotMutations.matchAll(
        /resynchroniseMultishotDerivedState\(supabase, parsed\.data\.multishotId\)/g,
      ),
    ].length,
    2,
  );
  assert.match(shotMutations, /existingShot\.time_offset_seconds/);
  assert.match(
    actions,
    /timelineTrackIndex: z\.coerce[\s\S]*?\.min\(0\)[\s\S]*?\.max\(MULTISHOT_MAX_TRACK_COUNT - 1\)/,
  );
  assert.match(shotMutations, /timeline_track_index: parsed\.data\.timelineTrackIndex/);
});

test('multishot saves are serial, revision-aware, and flushed before leaving', () => {
  const editor = read('app/(admin)/admin/multishots/[id]/MultishotEditor.tsx');
  const persistence = editor.slice(
    editor.indexOf('// --- Persistence'),
    editor.indexOf('// --- Preview interaction'),
  );

  assert.match(editor, /const saveChainsRef = useRef<Map<string, Promise<void>>>/);
  assert.match(editor, /const saveRevisionsRef = useRef<Map<string, number>>/);
  assert.match(editor, /const persistedShotIdsRef = useRef<Map<string, string>>/);
  assert.match(persistence, /const previousSave = saveChainsRef\.current\.get\(uid\)/);
  assert.match(persistence, /previousSave\s*\.catch\(\(\) => undefined\)\s*\.then\(async \(\) =>/);
  assert.match(persistence, /saveRevisionsRef\.current\.get\(uid\) !== revision/);
  assert.match(persistence, /persistedShotIdsRef\.current\.set\(uid, result\.id\)/);
  assert.match(persistence, /shotPersistenceSignature\(currentShot\)/);
  assert.match(persistence, /timelineTrackIndex: shot\.timelineTrackIndex/);
  assert.match(persistence, /const flushPendingSaves = useCallback/);
  assert.match(persistence, /visibilitychange/);
  assert.match(persistence, /pagehide/);
  assert.match(persistence, /beforeunload/);
  assert.match(persistence, /void flushPendingSaves\(\{ updateUi: false \}\)/);
  assert.doesNotMatch(persistence, /setTimeout\(\(\) => saveShotByUid\(uid\), 0\)/);
});

test('optimistic shot deletion waits for inserts and rolls back failed deletes', () => {
  const editor = read('app/(admin)/admin/multishots/[id]/MultishotEditor.tsx');
  const deletion = editor.slice(
    editor.indexOf('const deleteShot = useCallback'),
    editor.indexOf('// --- Preview interaction'),
  );
  const inspector = editor.slice(editor.indexOf('function Inspector('));

  assert.match(deletion, /saveRevisionsRef\.current\.set/);
  assert.match(deletion, /if \(pendingSave\) await pendingSave/);
  assert.match(deletion, /persistedShotIdsRef\.current\.get\(uid\) \?\? shot\.id/);
  assert.match(
    deletion,
    /nextShots\.splice\(Math\.min\(originalIndex, nextShots\.length\), 0, restoredShot\)/,
  );
  assert.match(deletion, /if \(wasSelected\) setSelectedUid\(uid\)/);
  assert.match(inspector, /<AlertDialog open=\{deleteDialogOpen\}/);
  assert.match(inspector, /<AlertDialogTitle>Delete shot\?<\/AlertDialogTitle>/);
  assert.match(inspector, /<AlertDialogAction variant="destructive" onClick=\{onDelete\}>/);
});

test('shot actions scope updates and avoid catalogue-wide invalidation for aim-only edits', () => {
  const actions = read('app/actions/admin-multishots.ts');
  const upsert = actions.slice(
    actions.indexOf('export async function upsertMultishotShot'),
    actions.indexOf('export async function deleteMultishotShot'),
  );
  const detailRefresh = actions.slice(
    actions.indexOf('async function refreshMultishotDetail'),
    actions.indexOf('export async function createMultishot'),
  );

  assert.match(
    upsert,
    /\.eq\('id', parsed\.data\.id\)\s*\.eq\('multishot_id', parsed\.data\.multishotId\)/,
  );
  assert.match(
    upsert,
    /if \(parsed\.data\.caliber === undefined\) nextCaliber = existingShot\.caliber/,
  );
  assert.match(upsert, /const id = data\?\.id as string \| undefined/);
  assert.match(upsert, /const syncResult = await resynchroniseMultishotDerivedState/);
  assert.match(upsert, /if \(catalogueChanged\) \{\s*await refreshMultishotCatalogue/);
  assert.match(upsert, /else \{\s*await refreshMultishotDetail/);
  assert.match(detailRefresh, /deleteCachedKeys\(\[getAdminMultishotCacheKey\(multishotId\)\]\)/);
  assert.doesNotMatch(
    detailRefresh,
    /invalidateAdminCatalogueCache|invalidateFireworkCatalogueCaches/,
  );
});

test('multishot controls share bounds and commit slider interactions immediately', () => {
  const editor = read('app/(admin)/admin/multishots/[id]/MultishotEditor.tsx');
  const slider = read('app/components/ui/SliderField.tsx');

  assert.match(editor, /clampMultishotTimeSeconds\(nextPatch\.timeOffsetSeconds\)/);
  assert.match(editor, /clampMultishotTrackIndex\(nextPatch\.timelineTrackIndex\)/);
  assert.match(editor, /caliber: spec\?\.caliber \?\? null/);
  assert.match(editor, /maxLength=\{MULTISHOT_NAME_MAX_LENGTH\}/);
  assert.match(editor, /maxLength=\{MULTISHOT_DESCRIPTION_MAX_LENGTH\}/);
  assert.match(
    editor,
    /onValueCommit=\{\(next\) => onChange\(next\[0\] \?\? value, \{ immediate: true \}\)\}/,
  );
  assert.match(slider, /onValueCommit=\{\(next\) => onCommit\?\.\(next\[0\] \?\? value\)\}/);
  assert.match(editor, /onCommit=\{onCommitTime\}/);
});
