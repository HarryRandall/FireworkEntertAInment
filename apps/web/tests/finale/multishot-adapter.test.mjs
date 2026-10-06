import assert from 'node:assert/strict';
import test from 'node:test';
import { exportMultishotCake, importedMultishotShots } from '../../lib/finale/multishot.ts';
import { previewCakeImport } from '../../lib/finale/import.ts';
const effects = ['Red', 'Blue'].map((name, index) => ({
  id: `40000000-0000-4000-8000-00000000000${index + 1}`,
  name,
  document: { kind: 'shell', breaks: [{}] },
}));
const shot = (index, time, effect, angle = 0) => ({
  sequence_index: index,
  time_offset_seconds: time,
  pan_degrees: angle,
  tilt_degrees: 0,
  firework_id: effects[effect].id,
});

test('row adapter binds fireworks and preserves millisecond gaps, signed pan and simultaneous order', () => {
  const rows = [shot(3, 0.251, 0, 30), shot(1, 0, 0, -30), shot(2, 0.251, 1)];
  const original = structuredClone(rows);
  const exported = exportMultishotCake(rows, effects, 'CAKE');
  assert.equal(exported.kind, 'export', exported.message);
  assert.match(exported.csv, /-30a251\/0b0\/30a\/CAK/);
  const preview = previewCakeImport(exported.csv, effects);
  assert.equal(preview.kind, 'preview');
  const imported = importedMultishotShots(preview.tubes);
  assert.equal(imported.kind, 'shots');
  assert.deepEqual(imported.shots, [rows[1], rows[2], rows[0]]);
  assert.deepEqual(rows, original);
});

test('non-zero depth tilt, unsupported names and unmatched fireworks return expected errors', () => {
  assert.equal(
    exportMultishotCake([{ ...shot(1, 0, 0), tilt_degrees: 1 }], effects, '').kind,
    'error',
  );
  for (const name of ['Red + Gold', 'Red (Gold)', 'Red Cake']) {
    assert.equal(exportMultishotCake([shot(1, 0, 0)], [{ ...effects[0], name }], '').kind, 'error');
  }
  const preview = previewCakeImport('1 Shot 0s (a) Unknown Cake, 1 Row (0a/CAK)', effects);
  assert.equal(importedMultishotShots(preview.tubes).kind, 'error');
});

test('valid Finale syntax beyond persisted pan or duration constraints is previewed but cannot save', () => {
  const preview = previewCakeImport(
    '2 Shot 3601s (a) Red Cake, 1 Row (31a3601000/0a/CAK)',
    effects,
  );
  assert.equal(preview.kind, 'preview');
  assert.equal(importedMultishotShots(preview.tubes).kind, 'error');
});
