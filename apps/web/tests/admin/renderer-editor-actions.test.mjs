import '../../../../scripts/renderer/register-typescript.mjs';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
const state = { allowed: true, calls: [], version: null, saveFailure: null, rpcFailure: null };
globalThis.rendererEditorTest = state;
function moduleSource(source) {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
const noop = 'async () => {}';
const modules = new Map([
  ['server-only', 'export {};'],
  ['next/headers', `export const cookies = ${noop};`],
  ['next/cache', 'export function revalidatePath() {}'],
  ['next/navigation', 'export function redirect() {}'],
  [
    '@/lib/access/current-profile.server',
    'export async function requirePermission() { return globalThis.rendererEditorTest.allowed ? {id:"admin"} : null; }',
  ],
  [
    '@/lib/admin/cache-keys',
    [
      'invalidateAdminEffectsCache',
      'invalidateAdminFireworksCache',
      'invalidateAdminMultishotsCache',
      'invalidateAdminStyleDefaultsCache',
      'invalidateAdminCatalogueCache',
    ]
      .map((name) => `export const ${name} = ${noop};`)
      .join('\n'),
  ],
  ['@/lib/shows/cache-keys', `export const invalidateFireworkCatalogueCaches = ${noop};`],
  [
    '@/lib/supabase/server',
    `export function createClient() { return { from() { const query = { select(){return query}, eq(){return query}, async maybeSingle(){ return { data: globalThis.rendererEditorTest.version, error: null }; } }; return query; }, async rpc(name,args) { const state=globalThis.rendererEditorTest; state.calls.push({name,args}); return { data: '95000000-0000-4000-8000-000000000003', error: state.rpcFailure }; } }; }`,
  ],
  [
    '@/lib/admin/render-snapshot.server',
    'export function validateRenderSnapshot(value) { return {ok:true,value}; } export function createRenderSnapshot() {}',
  ],
  [
    '@/lib/admin/editor-persistence.server',
    `export async function saveEditorRecord(client,input) { const state=globalThis.rendererEditorTest; state.calls.push(input); if(state.saveFailure) return {ok:false,error:state.saveFailure}; return {ok:true,saved:{id:input.id, ...input.patch, updated_at:'2026-10-06T02:00:00Z'}, historyVersion:{id:input.historyVersionId, snapshotJson:input.patch}, styleDefault:null}; }`,
  ],
]);
registerHooks({
  resolve(specifier, context, next) {
    return next(modules.has(specifier) ? moduleSource(modules.get(specifier)) : specifier, context);
  },
});
const { effectTemplates } = await import('@showcrafter/renderer');
const { DEFAULT_DESIGN } = await import('@showcrafter/fireworks/design');
const { updateEffect, restoreEffectEditorVersion } =
  await import('../../app/(admin)/admin/effects/actions.ts');
const { updateFirework, restoreFireworkEditorVersion } =
  await import('../../app/(admin)/admin/fireworks/actions.ts');
const { createFireworkFromTemplate } =
  await import('../../app/(admin)/admin/fireworks/template-actions.ts');
const design = effectTemplates[0].design;
const id = '95000000-0000-4000-8000-000000000001';
const versionId = '95000000-0000-4000-8000-000000000002';
const effectInput = {
  id,
  expectedUpdatedAt: '2026-10-06T00:00:00Z',
  name: 'Effect',
  patternKey: 'sphere',
  sortOrder: 0,
  modelJson: JSON.stringify({ renderDefaults: DEFAULT_DESIGN }),
  design,
};
const fireworkInput = {
  id,
  expectedUpdatedAt: effectInput.expectedUpdatedAt,
  name: 'Firework',
  fireworkEffectId: id,
  renderOverridesJson: JSON.stringify(DEFAULT_DESIGN),
  design,
};
function reset() {
  state.allowed = true;
  state.calls = [];
  state.saveFailure = null;
  state.rpcFailure = null;
  state.version = null;
}
test('both save actions validate designs and include them in the existing atomic save', async () => {
  for (const [action, input] of [
    [updateEffect, effectInput],
    [updateFirework, fireworkInput],
  ]) {
    reset();
    const result = await action(input);
    assert.equal(result.ok, true);
    assert.deepEqual(state.calls[0].patch.design, design);
    assert.deepEqual(result.saved.design, design);
    reset();
    assert.equal((await action({ ...input, design: {} })).ok, false);
    assert.equal(state.calls.length, 0);
    state.allowed = false;
    assert.equal((await action(input)).ok, false);
    assert.equal(state.calls.length, 0);
    reset();
    state.saveFailure = 'Concurrent edit';
    assert.deepEqual(await action(input), { ok: false, error: 'Concurrent edit' });
  }
});
test('restore actions validate saved designs, target identity and preserve legacy fields', async () => {
  const snapshots = [
    {
      kind: 'effect',
      id,
      name: 'Effect',
      patternKey: 'sphere',
      sortOrder: 0,
      modelJson: { renderDefaults: DEFAULT_DESIGN },
      design,
    },
    {
      kind: 'firework',
      id,
      name: 'Firework',
      fireworkEffectId: id,
      renderOverridesJson: DEFAULT_DESIGN,
      design,
    },
  ];
  for (const [index, action] of [
    restoreEffectEditorVersion,
    restoreFireworkEditorVersion,
  ].entries()) {
    reset();
    state.version = { id: versionId, snapshot_json: snapshots[index] };
    const input = {
      effectId: id,
      fireworkId: id,
      versionId,
      expectedUpdatedAt: effectInput.expectedUpdatedAt,
    };
    assert.equal((await action(input)).ok, true);
    assert.deepEqual(state.calls[0].patch.design, design);
    assert.equal(state.calls[0].restoreVersionId, versionId);
    assert.ok(
      index === 0 ? state.calls[0].patch.model_json : state.calls[0].patch.render_overrides_json,
    );
    reset();
    state.version = { id: versionId, snapshot_json: { ...snapshots[index], design: {} } };
    assert.equal((await action(input)).ok, false);
    assert.equal(state.calls.length, 0);
    reset();
    state.version = { id: versionId, snapshot_json: { ...snapshots[index], id: versionId } };
    assert.equal((await action(input)).ok, false);
    reset();
    state.version = { id: versionId, snapshot_json: { ...snapshots[index], design: null } };
    assert.equal((await action(input)).ok, true);
    assert.equal(
      'design' in state.calls[0].patch,
      false,
      'Older snapshots retain the current design',
    );
  }
});
test('template creation checks permissions and template selection and uses one typed RPC', async () => {
  reset();
  state.allowed = false;
  assert.equal(
    (await createFireworkFromTemplate({ name: 'Custom', templateKey: 'peony' })).ok,
    false,
  );
  assert.equal(state.calls.length, 0);
  reset();
  assert.equal(
    (await createFireworkFromTemplate({ name: 'Custom', templateKey: 'unknown' })).ok,
    false,
  );
  assert.equal(state.calls.length, 0);
  assert.equal(
    (await createFireworkFromTemplate({ name: 'Custom', templateKey: 'peony' })).ok,
    true,
  );
  assert.equal(state.calls.length, 1);
  assert.equal(state.calls[0].name, 'create_firework_from_template');
  assert.equal(state.calls[0].args.p_template_key, 'peony');
  assert.deepEqual(
    state.calls[0].args.p_design,
    effectTemplates.find((item) => item.key === 'peony').design,
  );
  reset();
  state.rpcFailure = { message: 'Catalogue insert failed' };
  assert.deepEqual(await createFireworkFromTemplate({ name: 'Custom', templateKey: 'peony' }), {
    ok: false,
    error: 'Catalogue insert failed',
  });
});
