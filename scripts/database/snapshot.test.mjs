import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  portableRow,
  readTable,
  snapshotTables,
  storageObjectPath,
  selectSnapshotContent,
} from './snapshot.mjs';

test('curation removes excluded suppliers and assortments with only their dependent rows', () => {
  const tables = {
    supplier_profiles: [{ id: 'keep' }, { id: 'test' }],
    supplier_inventory_items: [{ supplier_id: 'keep' }, { supplier_id: 'test' }],
    assortments: [{ id: 'keep' }, { id: 'test' }],
    assortment_items: [{ assortment_id: 'keep' }, { assortment_id: 'test' }],
    show_presets: [
      { slug: 'example', is_published: true },
      { slug: 'other', is_published: true },
    ],
    fireworks: [{ id: 'every-firework' }],
  };
  const selected = selectSnapshotContent(tables, {
    excludedSupplierIds: ['test'],
    excludedAssortmentIds: ['test'],
    examplePresetSlugs: ['example'],
  });
  assert.equal(selected.supplier_profiles.length, 1);
  assert.deepEqual(selected.supplier_inventory_items, [{ supplier_id: 'keep' }]);
  assert.deepEqual(selected.assortment_items, [{ assortment_id: 'keep' }]);
  assert.equal(selected.show_presets.length, 1);
  assert.deepEqual(selected.fireworks, tables.fireworks);
  assert.equal(tables.supplier_profiles.length, 2);
});

test('portable content drops account references while retaining catalogue identifiers', () => {
  const original = { id: 'catalogue-id', created_by: 'old-user', updated_by: 'old-user' };
  assert.deepEqual(portableRow('assortments', original), {
    id: 'catalogue-id',
    created_by: null,
    updated_by: null,
  });
  assert.equal(original.created_by, 'old-user');
  assert.equal(portableRow('show_presets', { source_show_id: 'old-show' }).source_show_id, null);
  for (const table of [
    'users',
    'user_roles',
    'shows',
    'song_analyses',
    'ai_credit_transactions',
    'import_jobs',
    'firework_editor_versions',
  ]) {
    assert.equal(
      snapshotTables.some(([name]) => name === table),
      false,
    );
  }
});

test('table export continues when server page limits are smaller than requested', async () => {
  const offsets = [];
  const rows = await readTable({
    url: 'https://example.supabase.co',
    key: 'test',
    table: 'fireworks',
    order: 'id',
    fetchImpl: async (url) => {
      const offset = Number(url.searchParams.get('offset'));
      offsets.push(offset);
      return new Response(JSON.stringify([{ id: offset }]), {
        headers: { 'content-range': `${offset}-${offset}/3` },
      });
    },
  });
  assert.deepEqual(offsets, [0, 1, 2]);
  assert.equal(rows.length, 3);
});

test('missing or changing counts fail instead of reporting a partial export as complete', async () => {
  for (const mode of ['missing', 'changed', 'empty']) {
    let calls = 0;
    await assert.rejects(
      readTable({
        url: 'https://example.supabase.co',
        key: 'test',
        table: 'fireworks',
        order: 'id',
        fetchImpl: async () => {
          calls++;
          return new Response(JSON.stringify(mode === 'empty' ? [] : [{ id: calls }]), {
            headers: mode === 'missing' ? {} : { 'content-range': `0-0/${calls === 1 ? 2 : 3}` },
          });
        },
      }),
      /Missing exact|changed during|Incomplete/,
    );
  }
});

test('storage paths cannot escape their bucket or local export directory', () => {
  for (const path of ['../private', '/absolute', 'a/../b', 'a\\b', 'a//b', '']) {
    assert.throws(() => storageObjectPath(path), /Invalid Storage/);
  }
  assert.equal(storageObjectPath('effects/blue shell.png'), 'effects/blue%20shell.png');
  assert.equal(storageObjectPath('effects/%2e%2e.png'), 'effects/%252e%252e.png');
});
