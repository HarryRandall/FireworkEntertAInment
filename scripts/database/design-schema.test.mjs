/** Ensure schema drift fails even when an earlier migration still matches. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { assertCurrentSchema, schemaSql } from './design-schema.mjs';

test('the latest generated helper must match, preserving migration history', () => {
  const original = { type: 'object', additionalProperties: false };
  const changed = { ...original, required: ['kind'] };
  assert.doesNotThrow(() => assertCurrentSchema([schemaSql(original)], original));
  assert.throws(() => assertCurrentSchema([schemaSql(original)], changed), /stale/);
  assert.doesNotThrow(() =>
    assertCurrentSchema([schemaSql(original), schemaSql(changed)], changed),
  );
  assert.throws(
    () => assertCurrentSchema([schemaSql(original), schemaSql(changed)], original),
    /stale/,
  );
  assert.throws(() => assertCurrentSchema([], original), /stale/);
  assert.throws(() => schemaSql({ description: '$design_schema$' }), /delimiter/);
});
