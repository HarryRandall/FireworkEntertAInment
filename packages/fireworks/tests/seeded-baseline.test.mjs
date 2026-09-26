import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { captureSeededBaseline } from '../../../scripts/renderer/seeded-baseline.mjs';

test('catalogue simulations match the seeded regression fixture', () => {
  const baseline = JSON.parse(
    readFileSync(new URL('./fixtures/seeded-baseline.json', import.meta.url)),
  );
  const stripMeasurement = ({ simulationMs, ...record }) => record;
  assert.deepEqual(captureSeededBaseline().map(stripMeasurement), baseline.map(stripMeasurement));
});
