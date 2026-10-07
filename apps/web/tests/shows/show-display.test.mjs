/** Behaviour checks for the shared show-page display formatters. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCueTime, formatShowCurrency } from '../../ui/shows/show-display.ts';

test('show currency keeps thousands separators and two decimal places', () => {
  assert.equal(formatShowCurrency(220000), '$2,200.00');
  assert.equal(formatShowCurrency(1119525), '$11,195.25');
  assert.equal(formatShowCurrency(0), '$0.00');
  assert.equal(formatShowCurrency(null), 'Price TBC');
  assert.equal(formatShowCurrency(Number.NaN), 'Price TBC');
});

test('cue time includes zero and stays valid at minute boundaries', () => {
  assert.equal(formatCueTime(0), '0:00');
  assert.equal(formatCueTime(59.99), '0:59');
  assert.equal(formatCueTime(60), '1:00');
  assert.equal(formatCueTime(6000), '100:00');
  assert.equal(formatCueTime(null), '-');
});
