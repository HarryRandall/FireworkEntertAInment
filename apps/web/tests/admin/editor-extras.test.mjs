import '../../../../scripts/renderer/register-typescript.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const { effectTemplates, resolveDesign } = await import('@showcrafter/renderer');
const { quickGroups, levelWords, sharedLayerId } =
  await import('../../lib/renderer-editor/quick-adjustments.ts');
const { setAdjustment } = await import('../../lib/renderer-editor/inspector.ts');
const { rollVariations } = await import('../../lib/renderer-editor/variations.ts');
const { applyLibrary, libraryEntries, partEnvelope, canSavePart, savedPartSchema } =
  await import('../../lib/renderer-editor/library.ts');
const { authoredChecks, measureParticlePeak, PARTICLE_BUDGET } =
  await import('../../lib/renderer-editor/checks.ts');
const { referenceTime } = await import('../../lib/renderer-editor/reference.ts');
const { clearDraft, draftStorageKey, readDraft, writeDraft } =
  await import('../../lib/admin/draft-autosave.ts');

const template = (key) => effectTemplates.find((item) => item.key === key).design;
const peony = template('peony');
const layerId = peony.breaks[0].layers[0].id;

// The VDL importer (PR #508, lib/finale/vdl) stores these words as layer adjustment levels.
const VDL_WORDS = {
  size: ['Small', 'Big'],
  stars: ['Sparse', 'Dense'],
  burn: ['Short', 'Long'],
  brightness: ['Dim', 'Bright'],
  star_size: ['Dim tip', 'Bright tip'],
  'trail.length': ['Short trail', 'Long trail'],
  'trail.density': ['Thin', 'Thick'],
  'trail.spray': ['Skinny', 'Fat'],
  spread: ['Uniform', 'Ragged'],
  droop: [null, 'Droopy'],
  'modifier.amount': ['Slow', 'Fast'],
};

test('quick rows use the VDL adjustment keys and words for a star group', () => {
  const withEffect = structuredClone(peony);
  withEffect.breaks[0].layers[0].modifiers = [template('strobe').breaks[0].layers[0].modifiers[0]];
  const rows = quickGroups(withEffect, layerId).flatMap((group) => group.controls);
  for (const [target, [low, high]] of Object.entries(VDL_WORDS)) {
    const row = rows.find((control) => control.key === `layer.${layerId}.${target}`);
    assert.ok(row, `missing quick row for ${target}`);
    if (low) assert.equal(row.low, low);
    assert.equal(row.high, high);
  }
  const size = rows.find((control) => control.key === `layer.${layerId}.size`);
  assert.equal(levelWords(size, 1), 'Slightly Big');
  assert.equal(levelWords(size, 2), 'Big');
  assert.equal(levelWords(size, -3), 'Very Small');
  assert.equal(levelWords(size, 0), 'Original');
});

test('every quick row stores a level the renderer resolves', () => {
  for (const key of ['peony', 'fountain', 'comet', 'tourbillon', 'mine', 'strobe']) {
    const design = template(key);
    const layer = design.breaks[0]?.layers[0]?.id;
    for (const control of quickGroups(design, layer).flatMap((group) => group.controls)) {
      const result = setAdjustment(design, control.key, 3);
      assert.equal(result.kind, 'edited', `${key} ${control.key}`);
      assert.doesNotThrow(() => resolveDesign(result.document), `${key} ${control.key}`);
    }
  }
  const bare = structuredClone(peony);
  bare.breaks[0].layers[0].modifiers = [];
  const titles = quickGroups(bare, layerId).map((group) => group.title);
  assert.ok(!titles.includes('Effects'), 'effect rows need a modifier');
  assert.ok(!titles.includes('Ground'));
  assert.equal(sharedLayerId(peony, layerId), false);
});

test('variations are deterministic, valid, keep locks and never change the source', () => {
  const before = structuredClone(peony);
  const first = rollVariations(peony, [], new Set(), 42);
  assert.equal(first.length, 6);
  assert.deepEqual(rollVariations(peony, [], new Set(), 42), first);
  assert.notDeepEqual(first[0], first[1]);
  const second = rollVariations(peony, first, new Set([2]), 7);
  assert.equal(second[2], first[2]);
  assert.notDeepEqual(second[0], first[0]);
  assert.deepEqual(peony, before);
});

test('library parts copy into the selected group without touching other parts', () => {
  const address = `layer:0:${layerId}`;
  const willow = libraryEntries().find((entry) => entry.id === 'trail:willow');
  const trail = applyLibrary(peony, address, willow);
  assert.equal(trail.kind, 'edited');
  assert.notDeepEqual(trail.document.breaks[0].layers[0].trail, peony.breaks[0].layers[0].trail);
  assert.deepEqual(trail.document.launch, resolveDesign(peony).launch);

  const stars = libraryEntries().find((entry) => entry.category === 'stars');
  const added = applyLibrary(peony, address, stars);
  assert.equal(added.kind, 'edited');
  assert.equal(added.document.breaks[0].layers.length, peony.breaks[0].layers.length + 1);
  assert.equal(added.document.breaks[0].layers.at(-1).id, 'library-1');

  const strobe = libraryEntries().find((entry) => entry.id === 'effect:strobe');
  assert.equal(applyLibrary(peony, '', strobe).kind, 'invalid');
  const tail = libraryEntries().find((entry) => entry.id === 'tail:gold');
  assert.equal(applyLibrary(template('fountain'), '', tail).kind, 'invalid');
});

test('saved parts round-trip through validation and envelopes hold one group', () => {
  const address = `layer:0:${layerId}`;
  const envelope = partEnvelope(template('multiBreak'), address);
  assert.equal(envelope.breaks.length <= 1, true);
  const part = savedPartSchema.parse({
    id: '00000000-0000-4000-8000-000000000001',
    name: ' Red peony stars ',
    category: 'stars',
    design: partEnvelope(peony, address),
  });
  assert.equal(part.name, 'Red peony stars');
  assert.equal(libraryEntries([part])[0].saved, true);
  assert.equal(savedPartSchema.safeParse({ ...part, design: {} }).success, false);
  assert.equal(canSavePart(template('fountain'), '', 'tails'), false);
  assert.equal(canSavePart(peony, address, 'stars'), true);
});

test('particle budget passes templates and blocks an overloaded design', () => {
  const peak = measureParticlePeak(peony);
  assert.equal(peak.exceeded, false);
  assert.ok(peak.count > 0 && peak.count < PARTICLE_BUDGET);
  const heavy = structuredClone(peony);
  for (const layer of heavy.breaks[0].layers) {
    layer.count = 2000;
    layer.trail.sparks = 200;
  }
  const blocked = measureParticlePeak(heavy);
  assert.equal(blocked.exceeded, true);
  assert.ok(blocked.count > PARTICLE_BUDGET);
  const tall = structuredClone(peony);
  tall.launch.height_m = 300;
  assert.equal(authoredChecks(tall).find((check) => check.id === 'height').passed, false);
  assert.ok(authoredChecks(template('fountain')).every((check) => check.id !== 'height'));
});

test('reference time follows the preview clock from the firing offset', () => {
  assert.equal(referenceTime(1, 10, 2.5), 3.5);
  assert.equal(referenceTime(20, 10, 0), 10);
  assert.equal(referenceTime(0, 10, 0), 0);
});

test('draft autosave stores, offers and clears one record', () => {
  const store = new Map();
  const storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
  const key = draftStorageKey('firework', 'abc');
  assert.equal(readDraft(storage, key, 'abc'), null);
  const value = { id: 'abc', signature: 's1', name: 'Red' };
  assert.equal(writeDraft(storage, key, value, '2026-10-12T00:00:00Z', new Date(0)), true);
  const draft = readDraft(storage, key, 'abc');
  assert.deepEqual(draft.value, value);
  assert.equal(draft.baseUpdatedAt, '2026-10-12T00:00:00Z');
  assert.equal(readDraft(storage, key, 'other'), null);
  store.set(key, '{not json');
  assert.equal(readDraft(storage, key, 'abc'), null);
  clearDraft(storage, key);
  assert.equal(store.has(key), false);
  const full = {
    ...storage,
    setItem: () => {
      throw new Error('quota');
    },
  };
  assert.equal(writeDraft(full, key, value, 'x'), false);
  assert.equal(writeDraft(null, key, value, 'x'), false);
});
