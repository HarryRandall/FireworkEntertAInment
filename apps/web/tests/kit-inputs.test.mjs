/** Behaviour checks for pasted tags, bounded quantities and shared upload acceptance. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isEmailTag, parseTags, stepValue } from '../ui/kit/input-logic.ts';
import { fileError } from '../ui/kit/file-upload-logic.ts';

test('tag parsing accepts paste delimiters, removes duplicates and preserves existing phrases', () => {
  const existing = ['low noise', 'gold'];
  assert.deepEqual(parseTags('gold,crackle; blue\nred\tgreen', existing), [
    'low noise',
    'gold',
    'crackle',
    'blue',
    'red',
    'green',
  ]);
  assert.deepEqual(existing, ['low noise', 'gold']);
  assert.deepEqual(parseTags(' ,; \n'), []);
  assert.deepEqual(parseTags('sam@shop.test,invalid;jo@shop.test'), [
    'sam@shop.test',
    'invalid',
    'jo@shop.test',
  ]);
});
test('invalid email tags remain distinguishable rather than disappearing', () => {
  assert.equal(isEmailTag('sam@shop.test'), true);
  for (const text of ['sam@shop', 'not-an-email', 'a b@shop.test', '@shop.test']) {
    assert.equal(isEmailTag(text), false);
  }
});
test('quantity steps clamp both boundaries and retain decimal precision', () => {
  const bounds = { min: 1, max: 20, step: 1 };
  assert.equal(stepValue(1, -1, bounds), 1);
  assert.equal(stepValue(20, 1, bounds), 20);
  assert.equal(stepValue(2, 1, bounds), 3);
  const decimals = { min: 0, max: 1, step: 0.1 };
  assert.equal(stepValue(0.2, 1, decimals), 0.3);
  assert.equal(stepValue(0.2, -1, decimals), 0.1);
  assert.equal(stepValue(0.95, 1, decimals), 1);
});
test('invalid quantity contracts fail visibly', () => {
  for (const bounds of [
    { min: 2, max: 1, step: 1 },
    { min: 0, max: 1, step: 0 },
    { min: 0, max: Infinity, step: 1 },
  ]) {
    assert.throws(() => stepValue(1, 1, bounds), RangeError);
  }
  assert.throws(() => stepValue(NaN, 1, { min: 0, max: 1, step: 1 }), RangeError);
});
test('file acceptance handles extensions, MIME patterns, exact sizes and invalid types', () => {
  const csv = { name: 'STOCK.CSV', type: '', size: 100 };
  assert.equal(fileError(csv, '.csv,.xlsx', 100), null);
  assert.equal(fileError(csv, '.csv', 99), 'The file exceeds the size limit.');
  assert.equal(fileError(csv, '.xlsx', 100), 'Choose a supported file type.');
  assert.equal(fileError({ ...csv, type: 'image/png' }, 'image/*', 100), null);
  assert.equal(fileError({ ...csv, type: 'text/csv' }, 'text/csv', 100), null);
  assert.equal(fileError(csv, '', 100), null);
  assert.throws(() => fileError(csv, '.csv', 0), RangeError);
});

test('quantity steps retain scientific-notation precision', () => {
  assert.equal(stepValue(0.0000002, 1, { min: 0, max: 1, step: 0.0000001 }), 0.0000003);
});
