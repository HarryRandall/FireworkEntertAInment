import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recurringMotifIds } from '../../lib/cue-generation/motifs.ts';

const catalogue = ['blue-peony', 'gold-willow', 'silver-ring', 'red-strobe', 'green-crossette'];

test('repeated section families reuse the same compact product motif', () => {
  const firstChorus = recurringMotifIds(catalogue, 'chorus');
  const repeatedChorus = recurringMotifIds(catalogue, 'chorus');

  assert.deepEqual(repeatedChorus, firstChorus);
  assert.equal(firstChorus.length, 3);
  assert.equal(new Set(firstChorus).size, firstChorus.length);
});

test('different section families can use distinct motifs from the same catalogue', () => {
  const verse = recurringMotifIds(catalogue, 'verse');
  const chorus = recurringMotifIds(catalogue, 'chorus');

  assert.notDeepEqual(verse, chorus);
  assert.equal(
    verse.every((id) => catalogue.includes(id)),
    true,
  );
  assert.equal(
    chorus.every((id) => catalogue.includes(id)),
    true,
  );
});

test('small catalogues remain intact rather than inventing or duplicating products', () => {
  assert.deepEqual(recurringMotifIds(['blue', 'gold', 'blue'], 'finale'), ['blue', 'gold']);
});
