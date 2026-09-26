import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCopiedPreset, resetCopiedPreset, presetSourceStatus } from '../src/presets.ts';
import { revertSection, sectionChanged } from '../src/sections.ts';
import { compileFireworkDesign } from '../../fireworks/src/design.ts';

test('presets copy only their declared layer, preserve identity and keep their original snapshot', () => {
  const draft = { ...compileFireworkDesign({}), productName: 'Example', price: 25 };
  const inner = structuredClone(draft.stars.core);
  const trails = structuredClone(draft.stars.outer.burstTrail);
  const source = {
    id: 'preset',
    name: 'Large stars',
    defaultsJson: { stars: { outer: { count: 12, head: { size: 700 } }, core: { count: 99 } } },
  };
  applyCopiedPreset(draft, 'star', source);
  assert.equal(draft.stars.outer.count, 12);
  assert.deepEqual(draft.stars.core, inner);
  assert.deepEqual(draft.stars.outer.burstTrail, trails);
  assert.equal(draft.productName, 'Example');
  assert.equal(draft.price, 25);
  source.defaultsJson.stars.outer.count = 30;
  assert.equal(draft.stars.outer.count, 12);
  draft.stars.outer.count = 10;
  assert.equal(presetSourceStatus(draft, 'star').modified, true);
  assert.equal(resetCopiedPreset(draft, 'star'), true);
  assert.equal(draft.stars.outer.count, 12);
});

test('section revert preserves sibling appearance, colours and trails', () => {
  const saved = compileFireworkDesign({});
  const draft = structuredClone(saved);
  draft.stars.outer.head.size = 800;
  draft.stars.core.head.size = 900;
  assert.equal(sectionChanged('star', draft, saved), true);
  revertSection('star', draft, saved);
  assert.equal(sectionChanged('star', draft, saved), false);
  assert.equal(draft.stars.core.head.size, 900);
});
