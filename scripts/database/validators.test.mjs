// Exercise generated validators with valid documents and rejected boundary input.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compositionSchema } from '../../apps/web/lib/documents/composition.generated.ts';
import { cuesSchema } from '../../apps/web/lib/documents/cues.generated.ts';

test('composition accepts nullable timing and enforces tube bounds and exact fields', () => {
  const tube = { i: 0, letter: 'a', t_ms: null, angle_deg: 0 };
  assert.equal(compositionSchema.safeParse({ tubes: [tube] }).success, true);
  for (const change of [
    { i: -1 },
    { letter: 'AAA' },
    { t_ms: -1 },
    { angle_deg: 91 },
    { seed: 4294967296 },
    { extra: true },
  ]) {
    assert.equal(compositionSchema.safeParse({ tubes: [{ ...tube, ...change }] }).success, false);
  }
  assert.equal(compositionSchema.safeParse({ tubes: [tube], unexpected: true }).success, false);
});

test('cues require products, non-negative milliseconds and a non-empty document', () => {
  const cue = {
    t_ms: 0,
    product_id: '60000000-0000-4000-8000-000000000001',
    position: 0,
    angle_deg: 0,
    beat: null,
  };
  assert.equal(cuesSchema.safeParse([cue]).success, true);
  assert.equal(cuesSchema.safeParse([]).success, false);
  for (const change of [
    { t_ms: -1 },
    { t_ms: 0.5 },
    { product_id: 'invalid' },
    { angle_deg: -91 },
    { beat: -1 },
    { extra: true },
  ]) {
    assert.equal(cuesSchema.safeParse([{ ...cue, ...change }]).success, false);
  }
});
