import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readSnapshot, snapshotSql } from './bootstrap-content.mjs';
import { repositoryRoot } from './runtime.mjs';

const directory = join(repositoryRoot, 'supabase/bootstrap');

test('handover snapshot is complete, portable and keeps the approved content', () => {
  const { tables, manifest } = readSnapshot(directory);
  assert.equal(tables.firework_effects.length, 26);
  assert.equal(tables.fireworks.length, 90);
  assert.equal(tables.multishots.length, 39);
  assert.equal(tables.multishot_fireworks.length, 882);
  assert.deepEqual(tables.supplier_profiles.map((row) => row.name).sort(), [
    'Hammer & Anvil',
    'Queen City Fireworks',
  ]);
  assert.deepEqual(tables.assortments.map((row) => row.name).sort(), [
    'Backyard Bash Assortment',
    'Comet Trail Assortment',
  ]);
  assert.deepEqual(tables.show_presets.map((row) => row.slug).sort(), [
    'colour-burst',
    'midnight-pulse',
    'outback-gold',
  ]);
  assert.equal(manifest.media.length, 157);
  assert.equal(tables.roles.length, 3);
  for (const rows of Object.values(tables))
    for (const row of rows) {
      for (const key of ['created_by', 'updated_by', 'source_show_id']) {
        if (Object.hasOwn(row, key)) assert.equal(row[key], null);
      }
    }
  const media = new Set(manifest.media.map((entry) => `${entry.bucket}/${entry.path}`));
  for (const row of tables.firework_preview_images) {
    if (row.storage_path) assert.ok(media.has(`firework-previews/${row.storage_path}`));
  }
  for (const row of tables.show_presets) {
    if (row.cover_image_path) assert.ok(media.has(`covers/${row.cover_image_path}`));
    assert.equal(row.is_published, true);
    assert.ok(row.preview_cues.length > 0);
  }
});

test('tampered content and media fail integrity checks before SQL is generated', () => {
  const temp = mkdtempSync(join(tmpdir(), 'showcrafter-snapshot-test-'));
  try {
    cpSync(directory, temp, { recursive: true });
    writeFileSync(join(temp, 'fireworks.json'), '[]');
    assert.throws(() => readSnapshot(temp), /integrity check failed for fireworks/);
    cpSync(join(directory, 'fireworks.json'), join(temp, 'fireworks.json'));
    const media = JSON.parse(readFileSync(join(temp, 'manifest.json'))).media[0];
    writeFileSync(join(temp, media.file), 'altered image');
    assert.throws(() => readSnapshot(temp), /integrity check failed for a media/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('bootstrap SQL is transactional and refuses a populated application database', () => {
  const sql = snapshotSql(readSnapshot(directory));
  assert.ok(sql.startsWith('begin;'));
  assert.ok(sql.endsWith('commit;\n'));
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /lock table public\.%I in access exclusive mode/);
  assert.match(sql, /Bootstrap requires an empty application database/);
  assert.doesNotMatch(sql, /truncate |delete from |disable trigger all|session_replication_role/i);
  assert.match(sql, /assert_all_published_show_presets/);
});
