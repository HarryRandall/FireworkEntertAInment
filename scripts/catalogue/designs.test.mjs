import { readFileSync } from 'node:fs';
import { FireworkDesignSchema } from '../../packages/fireworks/src/design.ts';
import { measureVariety } from './variety.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectTemplates, upgradeDesign, shotDuration } from '../../packages/renderer/src/index.ts';
import { buildCatalogue } from './generate.mjs';
import { catalogueDesign, resolvedOldDesign } from './designs.mjs';

const peony = effectTemplates.find((template) => template.key === 'peony').design;
const input = {
  primary_color: '#ff0000',
  color_palette: [],
  height_meters: null,
  render_overrides_json: {},
};

test('all stored designs validate; each template has exactly one effect and missing templates get hidden products', () => {
  const result = buildCatalogue();
  assert.equal(result.report.fireworks.length, 90);
  assert.equal(result.report.newRowsPerTable, 76);
  assert.equal(result.tables.firework_effects.length, effectTemplates.length);
  assert.equal(
    new Set(result.tables.firework_effects.map((effect) => effect.template_key)).size,
    effectTemplates.length,
  );
  for (const table of ['firework_effects', 'fireworks']) {
    for (const row of result.tables[table])
      assert.deepEqual(upgradeDesign(row.design, row.design_schema), row.design);
  }
  for (const item of result.tables.catalogue_items.filter((item) =>
    item.part_number.startsWith('renderer-'),
  )) {
    const firework = result.tables.fireworks.find((firework) => firework.id === item.firework_id);
    assert.equal(item.is_listed, false);
    assert.equal(item.finale_product_id, null);
    assert.equal(item.firework_type, firework.design.kind);
    assert.equal(item.duration_seconds, Math.round(shotDuration(firework.design) * 100) / 100);
    for (const target of [firework.id, firework.firework_effect_id]) {
      assert.equal(
        result.tables.firework_preview_images.filter(
          (preview) => (preview.firework_id ?? preview.firework_effect_id) === target,
        ).length,
        1,
      );
    }
  }
  assert.equal(
    result.report.fireworks.filter((row) =>
      row.notes.some((note) => note.includes('fountain colour')),
    ).length,
    3,
  );
  assert.deepEqual(result, buildCatalogue());
});

test('Nishiki is an honestly labelled denser, longer-burning brocade approximation', () => {
  const nishiki = effectTemplates.find((template) => template.key === 'nishiki');
  const brocade = effectTemplates.find((template) => template.key === 'brocade');
  const layer = nishiki.design.breaks[0].layers[0];
  const reference = brocade.design.breaks[0].layers[0];
  assert.match(nishiki.description, /approximation/);
  assert.ok(layer.life_s > reference.life_s);
  assert.ok(layer.trail.sparks > reference.trail.sparks);
  assert.ok(layer.trail.length_s > reference.trail.length_s);
});

function convert(settings, key = 'peony', fields = {}) {
  return catalogueDesign(effectTemplates.find((template) => template.key === key).design, {
    ...input,
    slug: 'mapping-test',
    render_snapshot_json: FireworkDesignSchema.parse(settings),
    ...fields,
  });
}

test('outer and inner layers retain independent counts, spread, life, heads, colours and trails', () => {
  const original = structuredClone(peony);
  const design = convert({
    color: { r: 1, g: 0, b: 0 },
    secondaryColor: { r: 0, g: 1, b: 0 },
    stars: {
      outer: { count: 80, burst: { speed: [2, 4], life: [2, 4] }, head: { size: 170 } },
      core: {
        enabled: true,
        count: 20,
        burst: { speed: [1, 2], life: [1, 2] },
        head: { size: 85 },
        burstTrail: { enabled: false },
      },
    },
  });
  const [outer, inner] = design.breaks[0].layers;
  assert.equal(outer.count, 80);
  assert.equal(inner.count, 20);
  assert.equal(outer.radius_m, inner.radius_m * 2);
  assert.equal(outer.life_s, inner.life_s * 2);
  assert.equal(outer.speed_var, 0.5);
  assert.equal(outer.life_var, 2 / 3);
  assert.equal(outer.head.size, inner.head.size * 2);
  assert.deepEqual(inner.colour.stops[0][1], ['#00ff00']);
  assert.equal(inner.trail.sparks, 0);
  assert.deepEqual(peony, original);
  const larger = convert({ stars: { outer: { count: 80, burst: { speed: [2, 4] } } } }, 'peony', {
    caliber: '60mm',
  });
  assert.ok(larger.breaks[0].layers[0].radius_m > outer.radius_m);
  assert.ok(larger.breaks[0].layers[0].count > outer.count);
});

test('snapshot wins; absent snapshots use effect model and layer overrides through the old compiler', () => {
  const model = {
    geometry: 'ring',
    trailProfile: 'none',
    renderDefaults: { stars: { outer: { count: 17 } } },
  };
  const row = {
    ...input,
    slug: 'fallback',
    render_overrides_json: { stars: { outer: { count: 29 } } },
  };
  assert.equal(resolvedOldDesign(row, model).stars.outer.count, 29);
  assert.equal(catalogueDesign(peony, row, model).breaks[0].layers[0].pattern, 'ring');
  row.render_snapshot_json = FireworkDesignSchema.parse({ stars: { outer: { count: 41 } } });
  assert.equal(resolvedOldDesign(row, model).stars.outer.count, 41);
});

for (const [family, settings, kind] of [
  ['strobe', { strobe: { enabled: true, frequencyHz: 18 } }, 'strobe'],
  ['crackle', { crackle: { enabled: true, probability: 0.3, fragmentCount: 19 } }, 'crackle'],
  ['crossette', { geometry: 'split_cross', split: { enabled: true, fragments: 6 } }, 'crossette'],
  ['split', { geometry: 'bowtie', split: { enabled: true } }, 'split'],
  ['glitter', { trailProfile: 'glitter' }, 'glitter'],
  ['twinkle', { trailProfile: 'blink' }, 'twinkle'],
  ['fish', { geometry: 'fish', geometryTuning: { fish: { wiggleRate: 21 } } }, 'fish'],
  ['whirl', { geometry: 'whirl' }, 'twist'],
])
  test(`${family} retains its behaviour and tuning`, () => {
    const result = convert(settings);
    const modifier = result.breaks[0].layers[0].modifiers.find((entry) => entry.kind === kind);
    assert.ok(modifier);
    if (family === 'strobe') assert.equal(modifier.rate_hz, 18);
    if (family === 'crackle') {
      assert.equal(modifier.count, 19);
      assert.equal(modifier.rate_hz, 18);
    }
    if (family === 'crossette') assert.equal(modifier.count, 6);
    if (family === 'fish') assert.equal(modifier.rate_rad_s, 21);
  });

test('ghost and falling leaves retain template-only behaviours and ghost reignition', () => {
  for (const [key, kind] of [
    ['ghost', 'ghost'],
    ['fallingLeaves', 'flutter'],
  ]) {
    const result = convert({}, key);
    assert.ok(result.breaks[0].layers[0].modifiers.some((entry) => entry.kind === kind));
    if (kind === 'ghost') assert.ok(result.breaks[0].layers[0].colour.reignition);
  }
});

test('pistil, ring, horsetail and waterfall use separate inner stars and appropriate patterns', () => {
  assert.equal(convert({ geometry: 'ring' }, 'ring').breaks[0].layers[0].pattern, 'ring');
  assert.equal(
    convert({ geometry: 'falling_tail' }, 'horsetail').breaks[0].layers[0].pattern,
    'bottom',
  );
  const waterfall = convert(
    { geometry: 'waterfall', geometryTuning: { waterfall: { width: 200 } } },
    'waterfall',
  );
  assert.equal(waterfall.breaks[0].layers[0].radius_m, 100);
  const pistil = convert({ stars: { core: { enabled: true, count: 15 } } }, 'pistil');
  assert.equal(pistil.breaks[0].layers[1].count, 15);
  assert.equal(pistil.breaks[0].core.count, 0);
});

test('colour patterns, opening and closing stops retain layer colours and report spatial limits', () => {
  for (const mode of ['random', 'bands', 'stripes']) {
    const notes = [];
    const row = {
      ...input,
      slug: 'colour-test',
      render_snapshot_json: FireworkDesignSchema.parse({
        stars: {
          outer: {
            colourPattern: {
              mode,
              colours: [{ color: { r: 1, g: 0, b: 0 } }, { color: { r: 0, g: 0, b: 1 } }],
            },
            head: {
              opening: { colour: { enabled: true, color: { r: 1, g: 1, b: 1 }, fadePercent: 20 } },
              closing: { colour: { enabled: true, color: { r: 0, g: 1, b: 0 }, fadePercent: 20 } },
            },
          },
        },
      }),
    };
    const colour = catalogueDesign(peony, row, {}, notes).breaks[0].layers[0].colour;
    assert.equal(colour.mode, mode === 'random' ? 'random' : 'alternate');
    assert.deepEqual(colour.stops, [
      [0, ['#ffffff']],
      [0.2, ['#ff0000', '#0000ff']],
      [0.8, ['#ff0000', '#0000ff']],
      [1, ['#00ff00']],
    ]);
    if (mode !== 'random') assert.ok(notes.some((note) => note.includes('spatial colour masks')));
  }
});

for (const [preset, colourMode, expected] of [
  ['none', 'star', 'star'],
  ['sparkDust', 'star', 'star'],
  ['solidStreaks', 'gold', '#fff3ce'],
  ['cometTail', 'silver', '#f8fcff'],
  ['willowHang', 'ember', '#ffce8b'],
]) {
  test(`trail ${preset} maps budget, length and ${colourMode} chemistry`, () => {
    const result = convert({
      stars: {
        outer: {
          burstTrail: {
            preset,
            colourMode,
            enabled: preset !== 'none',
            particlesPerStar: 35,
            lifetime: { mode: 'fixed', baseSeconds: 2, afterglowSeconds: 0 },
          },
        },
      },
    });
    const trail = result.breaks[0].layers[0].trail;
    assert.equal(trail.sparks, preset === 'none' ? 0 : 35);
    assert.equal(trail.colour, expected);
    assert.equal(trail.length_s, 2);
  });
}

test('launch adapts tail and smoke while height and timing keep existing logic', () => {
  const result = convert(
    { launch: { liftParticles: { enabled: false }, smoke: { enabled: false } } },
    'peony',
    { height_meters: peony.launch.height_m * 4 },
  );
  assert.equal(result.launch.tail, 'dark');
  assert.equal(result.launch.smoke, 0);
  assert.equal(result.launch.height_m, peony.launch.height_m * 4);
  assert.equal(result.launch.time_s, peony.launch.time_s * 2);
  assert.deepEqual(
    result.breaks.map((burst) => burst.at_s),
    peony.breaks.map((burst) => burst.at_s),
  );
  assert.equal(convert({}, 'peony', { height_meters: 0 }).launch.time_s, 0.001);
});

test('siblings with different old settings retain structural variation independently of seeds', () => {
  const rows = JSON.parse(
    readFileSync(new URL('../../supabase/bootstrap/fireworks.json', import.meta.url)),
  );
  const defaults = rows.find((row) => row.slug === 'palm-default');
  const crimson = rows.find((row) => row.slug === 'palm-crimson');
  const template = effectTemplates.find((entry) => entry.key === 'palm').design;
  const a = catalogueDesign(template, defaults);
  const b = catalogueDesign(template, crimson);
  assert.notEqual(a.seed, b.seed);
  assert.notEqual(a.breaks[0].layers[0].count, b.breaks[0].layers[0].count);
  assert.equal(measureVariety(rows).distinctDesigns, 90);
  assert.equal(
    new Set(rows.filter((row) => !row.slug.startsWith('renderer-')).map((row) => row.design.seed))
      .size,
    90,
  );
});
