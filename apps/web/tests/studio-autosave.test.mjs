/** Deferred writes exercise acknowledgement, serial persistence and recoverable failure. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectTemplates } from '@showcrafter/fireworks';
import { DraftAutosave } from '../lib/studio/autosave.ts';
import { renameLayer } from '../lib/studio/document.ts';

const document = effectTemplates.find((item) => item.design.kind === 'shell').design;
const changed = (name) => renameLayer(document, 0, document.breaks[0].layers[0].id, name);
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup(save) {
  const statuses = [];
  const autosave = new DraftAutosave(document, null, save, (status) => statuses.push(status));
  return { autosave, statuses };
}
test('opening an unchanged document performs no write', async () => {
  let calls = 0;
  const { autosave, statuses } = setup(async () => {
    calls++;
    return { kind: 'saved', versionId: 'draft' };
  });
  autosave.update(document);
  await autosave.flush();
  assert.equal(calls, 0);
  assert.equal(statuses.at(-1).label, 'Saved');
  autosave.dispose();
});
test('queued edits are serial and only their exact saved snapshot receives Saved', async () => {
  const first = deferred();
  const second = deferred();
  const calls = [];
  const { autosave, statuses } = setup((next, id) => {
    calls.push({ next, id });
    return calls.length === 1 ? first.promise : second.promise;
  });
  autosave.update(changed('First'));
  const saving = autosave.flush();
  autosave.update(changed('Second'));
  await autosave.flush();
  assert.equal(calls.length, 1);
  first.resolve({ kind: 'saved', versionId: 'draft' });
  await Promise.resolve();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].id, 'draft');
  assert.equal(
    statuses.some((status) => status.label === 'Saved'),
    false,
  );
  second.resolve({ kind: 'saved', versionId: 'draft' });
  await saving;
  assert.equal(statuses.at(-1).label, 'Saved');
  autosave.dispose();
});
test('undo during an in-flight write saves the original again after acknowledgement', async () => {
  const pending = deferred();
  const calls = [];
  const { autosave, statuses } = setup((next, id) => {
    calls.push({ next, id });
    return calls.length === 1
      ? pending.promise
      : Promise.resolve({ kind: 'saved', versionId: 'draft' });
  });
  autosave.update(changed('Temporary'));
  const saving = autosave.flush();
  autosave.update(document);
  assert.equal(statuses.at(-1).label, 'Saving...');
  pending.resolve({ kind: 'saved', versionId: 'draft' });
  await saving;
  assert.deepEqual(calls[1].next, document);
  assert.equal(statuses.at(-1).label, 'Saved');
  autosave.dispose();
});
test('expected refusal and unexpected failure retain edits for manual retry', async () => {
  for (const refusal of [
    async () => ({ kind: 'error', message: 'Published version' }),
    async () => {
      throw new Error('Offline');
    },
  ]) {
    let calls = 0;
    const { autosave, statuses } = setup(() => {
      calls++;
      return calls === 1 ? refusal() : Promise.resolve({ kind: 'saved', versionId: 'draft' });
    });
    autosave.update(changed('Retained'));
    await autosave.flush();
    assert.equal(statuses.at(-1).label, 'Save failed');
    await autosave.flush();
    assert.equal(calls, 2);
    assert.equal(statuses.at(-1).label, 'Saved');
    autosave.dispose();
  }
});
test('disposed editor ignores an in-flight result and never saves its later queued edit', async () => {
  const pending = deferred();
  let calls = 0;
  const { autosave, statuses } = setup(() => {
    calls++;
    return pending.promise;
  });
  autosave.update(changed('First'));
  const saving = autosave.flush();
  autosave.update(changed('Second'));
  autosave.dispose();
  const count = statuses.length;
  pending.resolve({ kind: 'saved', versionId: 'draft' });
  await saving;
  assert.equal(calls, 1);
  assert.equal(statuses.length, count);
});
test('typing coalesces into one delayed save and disposal cancels its timer', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const calls = [];
  const { autosave } = setup(async (next) => {
    calls.push(next);
    return { kind: 'saved', versionId: 'draft' };
  });
  autosave.update(changed('First'));
  context.mock.timers.tick(500);
  autosave.update(changed('Second'));
  context.mock.timers.tick(600);
  await Promise.resolve();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].breaks[0].layers[0].name, 'Second');
  autosave.update(changed('Third'));
  autosave.dispose();
  context.mock.timers.tick(600);
  assert.equal(calls.length, 1);
});
