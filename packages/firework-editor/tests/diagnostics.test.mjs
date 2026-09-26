import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sectionForField } from '../src/sections.ts';
import { uniqueRenderDiagnostics, renderDiagnosticSignature } from '../src/diagnostics.ts';
import { validateFireworkDesign } from '../../fireworks/src/design.ts';

test('compiler errors lead to the part which owns the invalid field', () => {
  const result = validateFireworkDesign({
    variantOverrides: {
      stars: {
        outer: { head: { size: -1 } },
        core: { burstTrail: { particlesPerStar: -1 }, burst: { life: -1 } },
      },
    },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.diagnostics.map((issue) => sectionForField(issue.path)).sort(), [
    'inner-movement',
    'inner-trail',
    'star',
  ]);
  assert.equal(sectionForField(['launch', 'smoke', 'enabled']), 'smoke');
  assert.equal(sectionForField(['liftVelocity']), 'launch-flight');
  assert.equal(
    sectionForField(['stars', 'core', 'colourPattern', 'colours', '0', 'weight']),
    'inner-colour',
  );
  assert.equal(sectionForField(['sound', 'burst', 'volume']), 'sound');
});

test('unknown fields and malformed documents do not point to an unrelated control', () => {
  for (const path of [[], ['stars'], ['stars', 'outer', 'headExtra'], ['unknown']]) {
    assert.equal(sectionForField(path), null);
  }
});

test('repeated and reordered errors share a notification signature without hiding distinct failures', () => {
  const size = { path: ['stars', 'outer', 'head', 'size'], message: 'Must be positive' };
  const life = { path: ['stars', 'core', 'burst', 'life'], message: 'Must be positive' };
  assert.deepEqual(uniqueRenderDiagnostics([size, size, life]), [size, life]);
  assert.equal(
    renderDiagnosticSignature([size, life, size]),
    renderDiagnosticSignature([life, size]),
  );
  assert.notEqual(
    renderDiagnosticSignature([size]),
    renderDiagnosticSignature([{ ...size, recordId: 'other' }]),
  );
  assert.notEqual(
    renderDiagnosticSignature([size]),
    renderDiagnosticSignature([{ ...size, message: 'Must be below 1000' }]),
  );
});
