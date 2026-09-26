import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
await import('../../../../scripts/renderer/register-typescript.mjs');
const { compileFireworkDesign } = await import('@showcrafter/fireworks/design');
const { useRenderControls } = await import('@showcrafter/firework-editor/use-render-controls');
const { fireworkColourMetadata } = await import('@showcrafter/firework-editor/colour-metadata');

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

test('catalogue colour metadata never changes renderer colours, weights or pattern on opening', () => {
  const document = compileFireworkDesign({});
  document.stars.outer.colourPattern = {
    mode: 'stripes',
    axis: 'horizontal',
    count: 5,
    colours: [
      { color: { r: 0.123456789, g: 0.987654321, b: 0.234567891 }, weight: 0.375 },
      { color: { r: 0.7, g: 0.2, b: 0.3 }, weight: 1.625 },
    ],
  };
  document.stars.core.enabled = false;
  const before = structuredClone(document);
  assert.deepEqual(fireworkColourMetadata(document), {
    primaryColor: '#1ffc3c',
    secondaryColor: '#b3334d',
    colorPalette: ['#1ffc3c', '#b3334d'],
  });
  assert.deepEqual(document, before);
  controlsFor(document);
  assert.deepEqual(document, before);
  document.colour.enabled = false;
  assert.deepEqual(fireworkColourMetadata(document).colorPalette, ['#ffffff']);
  document.colour.enabled = true;
  assert.deepEqual(document, before);
});

test('pattern changes and added colours start from the chosen layer, without hard-coded palette substitutions', () => {
  for (const layer of ['outer', 'core']) {
    const document = compileFireworkDesign({});
    document.stars[layer].color = { r: 0.321, g: 0.654, b: 0.987 };
    document.stars[layer].colourPattern.colours = [];
    const sibling = layer === 'core' ? 'outer' : 'core';
    const other = structuredClone(document.stars[sibling]);
    controlsFor(document).setStarColourPatternValue(layer, 'mode', 'stripes');
    assert.deepEqual(document.stars[layer].colourPattern.colours, [
      { color: document.stars[layer].color, weight: 100 },
    ]);
    controlsFor(document).addStarColourPatternEntry(layer);
    assert.deepEqual(
      document.stars[layer].colourPattern.colours[1].color,
      document.stars[layer].color,
    );
    controlsFor(document).updateStarColourPatternEntry(layer, 1, { weight: 0.375 });
    controlsFor(document).setStarColourPatternValue(layer, 'mode', 'solid');
    controlsFor(document).setStarColourPatternValue(layer, 'mode', 'stripes');
    assert.equal(document.stars[layer].colourPattern.colours[1].weight, 0.375);
    assert.deepEqual(document.stars[sibling], other);
  }
});
