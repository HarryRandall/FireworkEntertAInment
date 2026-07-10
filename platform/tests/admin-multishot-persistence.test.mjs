import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  clampMultishotPanDegrees,
  clampMultishotTimeSeconds,
  clampMultishotTiltDegrees,
  MULTISHOT_CALIBER_MAX_LENGTH,
  MULTISHOT_DESCRIPTION_MAX_LENGTH,
  MULTISHOT_MAX_DURATION_SECONDS,
  MULTISHOT_MAX_SHOT_COUNT,
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
  assert.equal(clampMultishotPanDegrees(-31), -30);
  assert.equal(clampMultishotPanDegrees(31), 30);
  assert.equal(clampMultishotTiltDegrees(-51), -50);
  assert.equal(clampMultishotTiltDegrees(51), 50);
  assert.equal(clampMultishotTimeSeconds(-0.1), 0);
  assert.equal(clampMultishotTimeSeconds(3600.1), 3600);
});

test('multishot database constraints mirror the admin action contract', () => {
  const migration = read(
    'supabase/migrations/20260710013955_align_multishot_constraints_and_catalogue.sql',
  );

  assert.equal(MULTISHOT_NAME_MAX_LENGTH, 180);
  assert.equal(MULTISHOT_DESCRIPTION_MAX_LENGTH, 5000);
  assert.equal(MULTISHOT_MAX_SHOT_COUNT, 2000);
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

  assert.match(migration, /check \(char_length\(name\) between 1 and 180\)/);
  assert.match(
    migration,
    /check \(duration_seconds is null or duration_seconds between 0 and 3600\)/,
  );
  assert.match(migration, /check \(shot_count between 0 and 2000\)/);
  assert.match(migration, /check \(sequence_index between 1 and 2000\)/);
  assert.match(migration, /check \(time_offset_seconds between 0 and 3600\)/);
  assert.match(migration, /check \(pan_degrees between -30 and 30\)/);
  assert.match(migration, /check \(tilt_degrees between -50 and 50\)/);
  assert.match(
    migration,
    /create unique index if not exists catalogue_items_multishot_id_key[\s\S]*?where multishot_id is not null/,
  );
  assert.match(
    migration,
    /after insert or update of slug, name, description, duration_seconds[\s\S]*?execute function public\.ensure_catalogue_item_for_multishot\(\)/,
  );
  assert.match(
    migration,
    /revoke execute on function public\.ensure_catalogue_item_for_multishot\(\)[\s\S]*?from public, anon, authenticated/,
  );
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
    actions.indexOf('async function syncShotCount'),
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
  assert.match(upsert, /if \(!parsed\.data\.id\) await syncShotCount/);
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
