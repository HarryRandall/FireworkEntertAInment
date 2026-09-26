import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
registerHooks({
  resolve(specifier, context, next) {
    return next(
      specifier === 'server-only' ? 'data:text/javascript,export {};' : specifier,
      context,
    );
  },
});
const { saveEditorRecord } = await import('../../lib/admin/editor-persistence.server.ts');
const input = {
  kind: 'effect',
  id: 'effect-id',
  expectedUpdatedAt: '2026-09-26T00:00:00Z',
  patch: { name: 'Saved' },
  historyVersionId: 'version-id',
};
function reply() {
  return {
    ok: true,
    kind: 'effect',
    saved: {
      id: 'effect-id',
      name: 'Saved',
      description: null,
      updated_at: '2026-09-26T01:00:00Z',
      pattern_key: 'sphere',
      sort_order: 0,
      model_json: {},
    },
    historyVersion: {
      id: 'version-id',
      target_kind: 'effect',
      firework_id: null,
      firework_effect_id: 'effect-id',
      firework_style_default_id: null,
      action: 'update',
      summary: 'Updated effect',
      snapshot_json: {},
      previous_snapshot_json: {},
      changes_json: {},
      created_by: 'admin',
      created_by_label: 'Admin',
      created_at: '2026-09-26T01:00:00Z',
    },
    styleDefault: null,
  };
}
test('editor persistence sends one transaction and returns its confirmed record and history', async () => {
  const calls = [];
  const client = {
    async rpc(...args) {
      calls.push(args);
      return { data: reply(), error: null };
    },
  };
  const result = await saveEditorRecord(client, input);
  assert.equal(result.ok, true);
  assert.equal(result.saved.name, 'Saved');
  assert.equal(result.historyVersion.id, 'version-id');
  assert.deepEqual(calls, [
    [
      'save_firework_editor',
      {
        p_kind: 'effect',
        p_id: 'effect-id',
        p_expected_updated_at: input.expectedUpdatedAt,
        p_patch: input.patch,
        p_history_id: 'version-id',
        p_action: 'update',
      },
    ],
  ]);
});
test('editor persistence rejects conflicts, failed history writes and incomplete confirmation', async () => {
  for (const response of [
    { data: null, error: { message: 'History write failed' } },
    { data: { ok: false, code: 'conflict' }, error: null },
    { data: { ok: true, saved: reply().saved }, error: null },
    { data: { ...reply(), saved: { ...reply().saved, id: 'another-record' } }, error: null },
    {
      data: { ...reply(), historyVersion: { ...reply().historyVersion, id: 'another-version' } },
      error: null,
    },
  ]) {
    const result = await saveEditorRecord(
      {
        async rpc() {
          return response;
        },
      },
      input,
    );
    assert.equal(result.ok, false);
    assert.equal(Object.hasOwn(result, 'saved'), false);
  }
});
