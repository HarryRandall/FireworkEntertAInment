import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  effectTemplates,
  upgradeDesign,
  TEMPLATE_HEIGHT_BANDS,
  templateApexM,
} from '../../packages/renderer/src/index.ts';
import { buildCatalogue } from './generate.mjs';
import { catalogueDesign, matchTemplate, MATCH_RULES } from './designs.mjs';

const expectations = [
  ['Brocade Crackling Palm Red and Green', 'crackPalm'],
  ['Red and Green Palm Crackle', 'crackPalm'],
  ['Silver Crysanthemum Crackle', 'crackleChrys'],
  ['Red Green Blue Crackling Chrysanthemum', 'crackleChrys'],
  ['Gold Willow to Blue', 'willow'],
  ['Glitter Willow', 'glitterWillow'],
  ['Brocade to Red Green and Blue', 'brocadeTips'],
  ['Glittering Brocade to Red', 'brocade'],
  ['Horsetail', 'horsetail'],
  ['Nishiki', 'nishiki'],
  ['Kamuro', 'kamuro'],
  ['Palm', 'palm'],
  ['Crossette', 'crossette'],
  ['Chrysanthemum', 'chrysanthemum'],
  ['Peony', 'peony'],
  ['Pistil', 'pistil'],
  ['Blue and Red Strobe', 'strobe'],
  ['Crackle', 'crackle'],
  ['Double Break', 'multiBreak'],
  ['Roman Candle', 'romanCandle'],
  ['Silver Fish', 'fish'],
  ['Bow Tie', 'bowtie'],
  ['Five Point Star', 'fivePointStar'],
  ['Saturn', 'saturn'],
  ['Waterfall', 'waterfall'],
  ['Whirl', 'whirlwind'],
  ['Pearls', 'pearls'],
  ['Ring', 'ring'],
  ['Comet', 'comet'],
  ['Mine', 'mine'],
  ['Fountain', 'fountain'],
  ['Silver Fountain', 'silverFountain'],
  ['Spray Fountain', 'sprayFountain'],
  ['Crackling Mine', 'crackleMine'],
  ['Glitter Mine', 'glitterMine'],
  ['Silver Mine', 'silverMine'],
  ['Strobe Pistil', 'strobePistil'],
  ['Dahlia Strobe', 'dahliaStrobe'],
  ['Comet Crossette', 'cometCrossette'],
  ['Silver Chrysanthemum', 'silverChrys'],
];
for (const [name, key] of expectations)
  test(`matches ${name}`, () => {
    assert.equal(matchTemplate({ name }, { pattern_key: 'peony' }).key, key);
  });

test('equally suitable siblings vary without choosing a lower priority match', () => {
  const usage = new Map();
  assert.equal(
    matchTemplate({ name: 'Crossette Default' }, { pattern_key: 'crossette' }, usage).key,
    'crossette',
  );
  assert.equal(
    matchTemplate({ name: 'Crossette Crimson' }, { pattern_key: 'crossette' }, usage).key,
    'redCrossette',
  );
  assert.equal(
    matchTemplate({ name: 'Crackling Palm' }, { pattern_key: 'brocade' }, usage).key,
    'crackPalm',
  );
  assert.equal(
    matchTemplate(
      { name: 'test', render_snapshot_json: { strobe: { enabled: true } } },
      { pattern_key: 'strobe' },
    ).key,
    'strobe',
  );
  for (const [, keys] of MATCH_RULES)
    for (const key of keys) assert.ok(effectTemplates.some((t) => t.key === key));
});

function withoutPermittedChanges(design) {
  const copy = structuredClone(design);
  delete copy.seed;
  function omitValues(control) {
    return typeof control === 'string'
      ? '<colour>'
      : {
          ...control,
          stops: control.stops.map(([at, colours]) => [
            at,
            Array.isArray(colours) ? colours.map(() => '<colour>') : '<colour>',
          ]),
        };
  }
  for (const burst of copy.breaks)
    for (const layer of burst.layers) layer.colour = omitValues(layer.colour);
  for (const part of Object.values(copy.ground ?? {}))
    if (part && typeof part === 'object' && part.colour) part.colour = omitValues(part.colour);
  return copy;
}

test('all 90 designs equal matched templates apart from colours and seed; identities are preserved', () => {
  const result = buildCatalogue();
  assert.equal(result.report.fireworks.length, 90);
  assert.equal(result.report.newRowsPerTable, 76);
  assert.equal(result.tables.firework_effects.length, effectTemplates.length);
  assert.equal(
    new Set(result.tables.firework_effects.map((row) => row.template_key)).size,
    effectTemplates.length,
  );
  const seeds = new Set();
  for (const row of result.report.fireworks) {
    const firework = result.tables.fireworks.find((f) => f.slug === row.slug);
    const template = effectTemplates.find((t) => t.key === row.templateKey);
    assert.deepEqual(
      withoutPermittedChanges(firework.design),
      withoutPermittedChanges(template.design),
    );
    seeds.add(firework.design.seed);
    assert.ok(row.reason);
  }
  assert.equal(seeds.size, 90);
  for (const table of ['firework_effects', 'fireworks']) {
    const original = JSON.parse(
      readFileSync(new URL(`../../supabase/bootstrap/${table}.json`, import.meta.url)),
    );
    for (const row of result.tables[table]) {
      assert.deepEqual(upgradeDesign(row.design, 1), row.design);
      const band = TEMPLATE_HEIGHT_BANDS[row.design.kind];
      assert.ok(
        templateApexM(row.design) >= band.apex_m[0] && templateApexM(row.design) <= band.apex_m[1],
      );
      const before = original.find((f) => f.id === row.id);
      const { design: a, ...restA } = before;
      const { design: b, ...restB } = row;
      assert.deepEqual(restA, restB);
    }
  }
  assert.deepEqual(
    result.tables.catalogue_items.slice().sort((a, b) => a.id.localeCompare(b.id)),
    JSON.parse(
      readFileSync(new URL('../../supabase/bootstrap/catalogue_items.json', import.meta.url)),
    ),
  );
  assert.deepEqual(result, buildCatalogue());
});

test('colour substitution retains stops, modes, contrast identities and template immutability', () => {
  const template = effectTemplates.find((t) => t.key === 'peonyRedGreen').design;
  const before = structuredClone(template);
  const result = catalogueDesign(template, {
    slug: 'colour-test',
    primary_color: '#123456',
    secondary_color: '#abcdef',
    color_palette: [],
  });
  assert.deepEqual(result.breaks[0].layers[0].colour.stops[0][1], ['#123456', '#abcdef']);
  assert.equal(result.breaks[0].layers[0].colour.mode, template.breaks[0].layers[0].colour.mode);
  assert.deepEqual(template, before);
});

test('base effects keep their mapped templates and library products remain unlisted', () => {
  const result = buildCatalogue();
  for (const effect of result.tables.firework_effects) {
    assert.deepEqual(
      effect.design,
      effectTemplates.find((template) => template.key === effect.template_key).design,
    );
  }
  for (const item of result.tables.catalogue_items.filter((row) =>
    row.part_number.startsWith('renderer-'),
  )) {
    assert.equal(item.is_listed, false);
    assert.equal(item.finale_product_id, null);
    const firework = result.tables.fireworks.find((row) => row.id === item.firework_id);
    assert.equal(item.firework_type, firework.design.kind);
    for (const target of [firework.id, firework.firework_effect_id]) {
      assert.equal(
        result.tables.firework_preview_images.filter(
          (row) => (row.firework_id ?? row.firework_effect_id) === target,
        ).length,
        1,
      );
    }
  }
});

test('Nishiki retains its documented denser, longer-burning brocade approximation', () => {
  const nishiki = effectTemplates.find((template) => template.key === 'nishiki');
  const brocade = effectTemplates.find((template) => template.key === 'brocade');
  const layer = nishiki.design.breaks[0].layers[0];
  const reference = brocade.design.breaks[0].layers[0];
  assert.match(nishiki.description, /approximation/);
  assert.ok(layer.life_s > reference.life_s);
  assert.ok(layer.trail.sparks > reference.trail.sparks);
  assert.ok(layer.trail.length_s > reference.trail.length_s);
});
