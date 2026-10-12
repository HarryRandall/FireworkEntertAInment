import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compileFireworkDesign, validateFireworkDesign } from '../src/design.ts';
import { parseCaliberMm } from '../src/model/scaling.ts';

test('disabled colours survive compilation and re-enabling without changing authored settings', () => {
  const settings = JSON.parse(
    readFileSync(new URL('./fixtures/disabled-colours.json', import.meta.url)),
  );
  const before = structuredClone(settings);
  const design = compileFireworkDesign({ variantOverrides: settings });
  assert.equal(design.color, settings.color);
  assert.deepEqual(design.secondaryColor, settings.secondaryColor);
  assert.equal(design.secondaryColorRatio, settings.secondaryColorRatio);
  for (const layer of ['outer', 'core']) {
    assert.deepEqual(design.stars[layer].color, settings.stars[layer].color);
    assert.deepEqual(
      design.stars[layer].colourPattern.colours,
      settings.stars[layer].colourPattern.colours,
    );
  }
  assert.deepEqual(settings, before);
  const reopened = JSON.parse(JSON.stringify(design));
  reopened.colour.enabled = true;
  assert.deepEqual(
    compileFireworkDesign({ variantOverrides: reopened }),
    compileFireworkDesign({ variantOverrides: { ...settings, colour: { enabled: true } } }),
  );
  const explicit = compileFireworkDesign({
    variantOverrides: settings,
    colorPalette: ['#ff0000', '#0000ff'],
  });
  assert.deepEqual(explicit.color, { r: 1, g: 0, b: 0 });
  assert.deepEqual(explicit.secondaryColor, { r: 0, g: 0, b: 1 });
});

test('invalid saved values produce field diagnostics, never a default firework', () => {
  for (const value of [
    { geometry: 'unknown' },
    { stars: { outer: { count: -1 } } },
    { stars: { core: { burstTrail: { stops: 'wrong' } } } },
    [],
  ]) {
    const result = validateFireworkDesign({ variantOverrides: value });
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.length);
    assert.equal('design' in result, false);
  }
  const result = validateFireworkDesign({
    variantOverrides: { stars: { outer: { head: { glowStrength: -1 } } } },
  });
  assert.deepEqual(result.diagnostics[0].path, ['stars', 'outer', 'head', 'glowStrength']);
});

test('calibres accept millimetres and every common inch notation', () => {
  assert.equal(parseCaliberMm('30mm'), 30);
  for (const value of ['3"', '3”', '3″', '3 in', '3 inch']) {
    assert.ok(Math.abs(parseCaliberMm(value) - 76.2) < 1e-9, value);
  }
  assert.equal(parseCaliberMm('large'), null);
});
