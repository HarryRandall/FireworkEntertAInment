import assert from 'node:assert/strict';
import { test } from 'node:test';
await import('../../../../scripts/renderer/register-typescript.mjs');
const { compileFireworkDesign } = await import('@showcrafter/fireworks/design');
const { fireworkColourMetadata } = await import('@showcrafter/firework-editor/colour-metadata');

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
  document.colour.enabled = false;
  assert.deepEqual(fireworkColourMetadata(document).colorPalette, ['#ffffff']);
  document.colour.enabled = true;
  assert.deepEqual(document, before);
});
