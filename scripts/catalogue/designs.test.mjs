import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectTemplates, upgradeDesign, shotDuration } from '../../packages/renderer/src/index.ts';
import { buildCatalogue } from './generate.mjs';
import { catalogueDesign } from './designs.mjs';

const peony = effectTemplates.find((template) => template.key === 'peony').design;
const input = {
  primary_color: '#ff0000',
  color_palette: [],
  height_meters: null,
  render_overrides_json: {},
};

test('colours and height adapt main stars without mutating templates or inner layers', () => {
  const original = structuredClone(peony);
  const result = catalogueDesign(peony, {
    ...input,
    height_meters: peony.launch.height_m * 4,
    color_palette: ['#ff0000', '#00ff00'],
  });
  assert.equal(result.launch.time_s, peony.launch.time_s * 2);
  assert.equal(result.launch.height_m, peony.launch.height_m * 4);
  assert.equal(result.breaks[0].layers[0].colour.mode, 'alternate');
  assert.deepEqual(result.breaks[0].layers[0].colour.stops[0][1], ['#ff0000', '#00ff00']);
  assert.deepEqual(result.breaks[0].layers[0].trail, peony.breaks[0].layers[0].trail);
  assert.deepEqual(peony, original);
  const pistil = effectTemplates.find((template) => template.key === 'pistil').design;
  assert.deepEqual(catalogueDesign(pistil, input).breaks[0].layers[1], pistil.breaks[0].layers[1]);
  const saturn = effectTemplates.find((template) => template.key === 'saturn').design;
  for (const layer of catalogueDesign(saturn, input).breaks[0].layers) {
    assert.deepEqual(layer.colour.stops[0][1], ['#ff0000']);
  }
});

test('zero height remains schema-valid and explicit metallic overrides retain their chemistry', () => {
  const result = catalogueDesign(peony, {
    ...input,
    height_meters: 0,
    render_overrides_json: { burstTrail: { colourMode: 'ember' } },
  });
  assert.equal(result.launch.height_m, 0);
  assert.equal(result.launch.time_s, 0.001);
  assert.equal(result.breaks[0].layers[0].trail.colour, '#ffce8b');
  assert.deepEqual(upgradeDesign(result, 1), result);
});

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
