import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
await import('../../../../scripts/renderer/register-typescript.mjs');
const { compileFireworkDesign } = await import('@showcrafter/fireworks/design');
const { useRenderControls } = await import('@showcrafter/firework-editor/use-render-controls');
const { rangeHalfWidth, rangeMid } = await import('@showcrafter/firework-editor/control-values');

function controlsFor(document) {
  let context;
  function Fixture() {
    context = useRenderControls({
      design: compileFireworkDesign({ variantOverrides: document }),
      defaults: document,
      mutate: (update) => update(document),
    });
    return null;
  }
  renderToStaticMarkup(React.createElement(Fixture));
  return context;
}

test('gravity and variation edit a symmetric range without replacing the other layer', () => {
  for (const layer of ['outer', 'core']) {
    const document = compileFireworkDesign({});
    const sibling = layer === 'outer' ? 'core' : 'outer';
    document.stars[layer].burst.gravity = [-0.7, -0.2];
    const other = structuredClone(document.stars[sibling]);
    controlsFor(document).setStarGravitySpread(layer, 0.1);
    assert.deepEqual(document.stars[layer].burst.gravity, [-0.55, -0.35]);
    controlsFor(document).setStarBurstRangeMid(layer, 'gravity', 0.3, 0.1);
    assert.deepEqual(document.stars[layer].burst.gravity, [0.2, 0.4]);
    controlsFor(document).setStarGravitySpread(layer, 0);
    controlsFor(document).setStarBurstRangeMid(layer, 'gravity', 0, 0);
    assert.deepEqual(document.stars[layer].burst.gravity, [0, 0]);
    assert.deepEqual(document.stars[sibling], other);
  }
});

test('gravity editing respects both bounds without moving the chosen average', () => {
  const document = compileFireworkDesign({});
  for (const [mid, expected] of [
    [-1.9, [-2, -1.8]],
    [0.95, [0.9, 1]],
  ]) {
    controlsFor(document).setStarBurstRangeMid('outer', 'gravity', mid, 0.5);
    const range = document.stars.outer.burst.gravity;
    assert.deepEqual(range, expected);
    assert.equal(rangeMid(range), mid);
    assert.ok(rangeHalfWidth(range) <= 0.5);
  }
});

test('fountain rate edits preserve duration, star count and the other layer', () => {
  const document = compileFireworkDesign({ variantOverrides: { geometry: 'fountain' } });
  for (const layer of ['outer', 'core']) {
    const before = structuredClone(document);
    controlsFor(document).setStarEmissionRate(layer, 12.5);
    before.stars[layer].emissionRate = 12.5;
    assert.deepEqual(document, before);
  }
});
