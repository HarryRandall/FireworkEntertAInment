/** Exercises the published entry points as a DOM-free consumer. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { effectTemplates, upgradeDesign, DESIGN_SCHEMA_VERSION } from '@showcrafter/renderer';
import { designSchema } from '@showcrafter/renderer/schema';
import schema from '@showcrafter/renderer/schema/design.v1.json' with { type: 'json' };
import { simulate, shotDuration } from '@showcrafter/renderer/sim';
import * as fixtures from '@showcrafter/renderer/fixtures';

// Catalogue size captured and checked against the supplied template JSON files.
const TEMPLATE_COUNT = 102;

const packageRequire = createRequire(new URL('../package.json', import.meta.url));
const webRequire = createRequire(new URL('../../../apps/web/package.json', import.meta.url));

test('public designs validate and simulate without a browser', () => {
  assert.equal(effectTemplates.length, TEMPLATE_COUNT);
  assert.ok(Object.keys(fixtures).length > 0);
  assert.ok(schema.oneOf.length > 0);
  for (const { design } of effectTemplates) {
    assert.deepEqual(upgradeDesign(design, DESIGN_SCHEMA_VERSION), design);
    assert.ok(designSchema.safeParse(design).success);
    assert.ok(shotDuration(design) > 0);
  }
  assert.equal(typeof simulate, 'function');
});

test('renderer validation retains its own Zod version beside web validation', () => {
  assert.equal(packageRequire('zod/package.json').version, '3.25.76');
  assert.match(webRequire('zod/package.json').version, /^4\./);
  assert.notEqual(packageRequire.resolve('zod'), webRequire.resolve('zod'));
});
