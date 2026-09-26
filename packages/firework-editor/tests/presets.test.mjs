import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { applyCopiedPreset, resetCopiedPreset, presetSourceStatus } from '../src/presets.ts';
import { revertSection, sectionChanged } from '../src/sections.ts';
import { compileFireworkDesign } from '../../fireworks/src/design.ts';
import {
  compileStyleDefaultPreviewDesign,
  extractStyleDefaultsFromDesign,
  INITIAL_STYLE_DEFAULT_JSON,
  makeTrailPreviewStarDefaults,
} from '../../fireworks/src/style-defaults.ts';

test('disabled colours retain both layer palettes through copied presets, status, reset and section revert', () => {
  const settings = JSON.parse(
    readFileSync(new URL('../../fireworks/tests/fixtures/disabled-colours.json', import.meta.url)),
  );
  for (const [kind, layer, section] of [
    ['star', 'outer', 'colour'],
    ['innerStar', 'core', 'inner-colour'],
  ]) {
    const draft = compileFireworkDesign({ variantOverrides: { colour: { enabled: false } } });
    applyCopiedPreset(draft, kind, { id: kind, name: 'Copied colours', defaultsJson: settings });
    assert.deepEqual(
      draft.stars[layer].colourPattern.colours,
      settings.stars[layer].colourPattern.colours,
    );
    assert.equal(presetSourceStatus(draft, kind).modified, false);
    const saved = compileFireworkDesign({ variantOverrides: draft });
    draft.stars[layer].colourPattern.colours[0].weight = 99;
    assert.equal(presetSourceStatus(draft, kind).modified, true);
    resetCopiedPreset(draft, kind);
    assert.equal(presetSourceStatus(draft, kind).modified, false);
    draft.stars[layer].colourPattern.colours[0].weight = 88;
    revertSection(section, draft, saved);
    assert.deepEqual(draft.stars[layer].colourPattern, saved.stars[layer].colourPattern);
    draft.colour.enabled = true;
    const enabled = compileFireworkDesign({ variantOverrides: draft });
    assert.deepEqual(
      enabled.stars[layer].colourPattern.colours,
      settings.stars[layer].colourPattern.colours,
    );
    assert.equal(presetSourceStatus(draft, kind).modified, false);
  }
});

test('presets copy only their declared layer, preserve identity and keep their original snapshot', () => {
  const draft = { ...compileFireworkDesign({}), productName: 'Example', price: 25 };
  const inner = structuredClone(draft.stars.core);
  const trails = structuredClone(draft.stars.outer.burstTrail);
  const source = {
    id: 'preset',
    name: 'Large stars',
    defaultsJson: { stars: { outer: { count: 12, head: { size: 700 } }, core: { count: 99 } } },
  };
  applyCopiedPreset(draft, 'star', source);
  assert.equal(draft.stars.outer.count, 12);
  assert.deepEqual(draft.stars.core, inner);
  assert.deepEqual(draft.stars.outer.burstTrail, trails);
  assert.equal(draft.productName, 'Example');
  assert.equal(draft.price, 25);
  source.defaultsJson.stars.outer.count = 30;
  assert.equal(draft.stars.outer.count, 12);
  draft.stars.outer.count = 10;
  assert.equal(presetSourceStatus(draft, 'star').modified, true);
  assert.equal(resetCopiedPreset(draft, 'star'), true);
  assert.equal(draft.stars.outer.count, 12);
});

test('section revert preserves sibling appearance, colours and trails', () => {
  const saved = compileFireworkDesign({});
  const draft = structuredClone(saved);
  draft.stars.outer.head.size = 800;
  draft.stars.core.head.size = 900;
  assert.equal(sectionChanged('star', draft, saved), true);
  revertSection('star', draft, saved);
  assert.equal(sectionChanged('star', draft, saved), false);
  assert.equal(draft.stars.core.head.size, 900);
});

test('inner presets preview their own layer without an outer-star substitute', () => {
  for (const kind of ['innerStar', 'innerTrail']) {
    const design = compileStyleDefaultPreviewDesign(kind, INITIAL_STYLE_DEFAULT_JSON[kind]);
    assert.equal(design.stars.core.enabled, true);
    assert.equal(design.stars.outer.enabled, false);
    if (kind === 'innerTrail') {
      assert.equal(design.stars.core.head.visible, false);
      assert.equal(design.stars.core.burstTrail.enabled, true);
    }
  }
  const previewCarrier = makeTrailPreviewStarDefaults('core');
  previewCarrier.stars.core.head.size = 333;
  const design = compileStyleDefaultPreviewDesign(
    'innerTrail',
    INITIAL_STYLE_DEFAULT_JSON.innerTrail,
    previewCarrier,
  );
  assert.equal(design.stars.core.head.size, 333);
  assert.equal(design.stars.core.head.visible, true);
  assert.equal(design.stars.outer.enabled, false);
  const saved = extractStyleDefaultsFromDesign(design, 'innerTrail');
  assert.deepEqual(Object.keys(saved.stars.core), ['burstTrail']);
  assert.equal(saved.stars.outer, undefined);
});

test('star presets copy colours and movement while preserving sibling trails', () => {
  const draft = structuredClone(compileFireworkDesign({}));
  const inner = structuredClone(draft.stars.core);
  const trail = structuredClone(draft.stars.outer.burstTrail);
  const source = {
    id: 'colourful',
    name: 'Colourful',
    defaultsJson: {
      stars: {
        outer: {
          color: { r: 0, g: 1, b: 0 },
          colourPattern: {
            mode: 'bands',
            axis: 'horizontal',
            count: 2,
            colours: [
              { color: { r: 0, g: 1, b: 0 }, weight: 25 },
              { color: { r: 0, g: 0, b: 1 }, weight: 75 },
            ],
          },
        },
      },
    },
  };
  applyCopiedPreset(draft, 'star', source);
  assert.equal(draft.stars.outer.colourPattern.mode, 'bands');
  assert.equal(draft.stars.outer.colourPattern.colours[1].weight, 75);
  assert.deepEqual(draft.stars.outer.color, { r: 0, g: 1, b: 0 });
  assert.deepEqual(draft.stars.core, inner);
  assert.deepEqual(draft.stars.outer.burstTrail, trail);
  draft.stars.outer.colourPattern.axis = 'vertical';
  assert.equal(presetSourceStatus(draft, 'star').modified, true);
  resetCopiedPreset(draft, 'star');
  assert.equal(draft.stars.outer.colourPattern.axis, 'horizontal');
});

test('launch presets retain maximum flight time without replacing smoke', () => {
  const draft = structuredClone(compileFireworkDesign({}));
  const smoke = structuredClone(draft.launch.smoke);
  applyCopiedPreset(draft, 'launch', {
    id: 'flight',
    name: 'Long ascent',
    defaultsJson: { shellLife: 30, liftVelocity: 20 },
  });
  assert.equal(draft.shellLife, 30);
  assert.deepEqual(draft.launch.smoke, smoke);
});

test('geometry presets include distribution without replacing star settings', () => {
  const draft = structuredClone(compileFireworkDesign({}));
  const stars = structuredClone(draft.stars);
  applyCopiedPreset(draft, 'geometry', {
    id: 'shape',
    name: 'Wave ring',
    defaultsJson: { geometry: 'ring', pattern: 'wave' },
  });
  assert.equal(draft.geometry, 'ring');
  assert.equal(draft.pattern, 'wave');
  assert.deepEqual(draft.stars, stars);
});

test('invalid preset application leaves the entire draft unchanged', () => {
  const draft = structuredClone(compileFireworkDesign({}));
  const before = structuredClone(draft);
  assert.throws(() =>
    applyCopiedPreset(draft, 'star', {
      id: 'bad',
      name: 'Bad',
      defaultsJson: { stars: { outer: { count: -10 } } },
    }),
  );
  assert.deepEqual(draft, before);
});

test('reverting launch and burst audio leaves crackle audio unchanged', () => {
  const saved = compileFireworkDesign({});
  const draft = structuredClone(saved);
  draft.crackle.soundVolume = 0.2;
  draft.sound.launch = !saved.sound.launch;
  revertSection('sound', draft, saved);
  assert.deepEqual(draft.sound, saved.sound);
  assert.equal(draft.crackle.soundVolume, 0.2);
});
