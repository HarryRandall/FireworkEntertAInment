import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { finaleMappingFields } from '../../lib/finale/mapping.ts';
const schema = z.object(finaleMappingFields);

test('mapping fields allow blank and optional values, trim names and enforce database lengths and controls', () => {
  assert.deepEqual(schema.parse({}), {});
  assert.deepEqual(schema.parse({ finaleProductId: ' FIN-1 ', finaleEffectName: ' Name ' }), {
    finaleProductId: 'FIN-1',
    finaleEffectName: 'Name',
  });
  assert.equal(schema.safeParse({ finaleProductId: '', finaleEffectName: '' }).success, true);
  assert.equal(
    schema.safeParse({ finaleProductId: 'x'.repeat(128), finaleEffectName: 'x'.repeat(256) })
      .success,
    true,
  );
  assert.equal(schema.safeParse({ finaleProductId: 'x'.repeat(129) }).success, false);
  assert.equal(schema.safeParse({ finaleEffectName: 'x'.repeat(257) }).success, false);
  for (const value of ['a\nb', 'a\0b', 'a\tb', 'a\x7fb']) {
    assert.equal(schema.safeParse({ finaleProductId: value }).success, false);
    assert.equal(schema.safeParse({ finaleEffectName: value }).success, false);
  }
});
