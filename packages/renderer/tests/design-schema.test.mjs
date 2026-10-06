/** Validation and public-version checks for the firework design schema. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import Ajv from 'ajv';
import { z } from 'zod';
import { kindCases } from './kind-cases.mjs';
import {
  designSchema,
  upgradeDesign,
  DESIGN_SCHEMA_VERSION,
  RENDERER_VERSION,
} from '../src/index.ts';
import { reviewFixtureDesign } from '../src/fixtures/index.ts';

const schema = JSON.parse(readFileSync(new URL('../schema/design.v1.json', import.meta.url)));
const ajv = new Ajv({ allErrors: true, strict: true });
const validate = ajv.compile(schema);
const fixture = reviewFixtureDesign;
const peony = fixture('peony');

for (const name of ['peony', 'comet', 'multi-break']) {
  test(`${name} is accepted unchanged by JSON Schema and generated Zod`, () => {
    const doc = fixture(name);
    assert.equal(validate(doc), true, ajv.errorsText(validate.errors));
    assert.deepEqual(designSchema.parse(doc), doc);
    assert.deepEqual(upgradeDesign(doc, 1), doc);
  });
}

test('v1 upgrade is pure and schema/version metadata is public', () => {
  const doc = fixture('multi-break');
  const before = structuredClone(doc);
  function freeze(value) {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
  }
  freeze(doc);
  const result = upgradeDesign(doc, 1);
  assert.deepEqual(doc, before);
  assert.deepEqual(result, before);
  assert.notEqual(result, doc);
  result.breaks[0].layers[0].name = 'Edited copy';
  assert.deepEqual(doc, before);
  assert.equal(DESIGN_SCHEMA_VERSION, 1);
  assert.match(RENDERER_VERSION, /^\d+\.\d+\.\d+$/);
});

for (const version of [0, 2, -1, 1.5, NaN, Infinity, '1', null]) {
  test(`upgrade rejects unsupported version ${String(version)}`, () => {
    assert.throws(() => upgradeDesign(peony, version), /Unsupported design schema version/);
  });
}

const invalid = [
  ['missing launch height', (d) => delete d.launch.height_m, 'launch.height_m'],
  [
    'wrong height unit',
    (d) => {
      d.launch.height_cm = d.launch.height_m;
      delete d.launch.height_m;
    },
    'launch',
  ],
  [
    'unit-bearing string',
    (d) => {
      d.launch.time_s = '1.8s';
    },
    'launch.time_s',
  ],
  [
    'unknown kind',
    (d) => {
      d.kind = 'cake';
    },
    'kind',
  ],
  [
    'wrong ground block',
    (d) => {
      d.ground = { kind: 'wheel' };
    },
    'ground',
  ],
  ['missing break time', (d) => delete d.breaks[0].at_s, 'breaks.0.at_s'],
  [
    'old layer delay spelling',
    (d) => {
      d.breaks[0].layers[0].delay = 1;
    },
    'breaks.0.layers.0',
  ],
  ['missing stable id', (d) => delete d.breaks[0].layers[0].id, 'breaks.0.layers.0.id'],
  [
    'empty stable id',
    (d) => {
      d.breaks[0].layers[0].id = '';
    },
    'breaks.0.layers.0.id',
  ],
  [
    'invalid colour',
    (d) => {
      d.breaks[0].layers[0].colour.stops[0][1] = 'red';
    },
    'breaks.0.layers.0.colour.stops.0.1',
  ],
  [
    'empty palette',
    (d) => {
      d.breaks[0].layers[0].colour.stops[0][1] = [];
    },
    'breaks.0.layers.0.colour.stops.0.1',
  ],
  [
    'malformed gradient tuple',
    (d) => {
      d.breaks[0].layers[0].colour.stops[0].push('extra');
    },
    'breaks.0.layers.0.colour.stops.0',
  ],
  [
    'zero drag',
    (d) => {
      d.breaks[0].layers[0].drag_per_s = 0;
    },
    'breaks.0.layers.0.drag_per_s',
  ],
  [
    'negative life',
    (d) => {
      d.breaks[0].layers[0].life_s = -1;
    },
    'breaks.0.layers.0.life_s',
  ],
  [
    'fractional particle count',
    (d) => {
      d.breaks[0].layers[0].count = 3.5;
    },
    'breaks.0.layers.0.count',
  ],
  [
    'too much variation',
    (d) => {
      d.breaks[0].layers[0].life_var = 2;
    },
    'breaks.0.layers.0.life_var',
  ],
  [
    'negative seed',
    (d) => {
      d.seed = -1;
    },
    'seed',
  ],
  [
    'overflow seed',
    (d) => {
      d.seed = 4294967296;
    },
    'seed',
  ],
  [
    'sound above one',
    (d) => {
      d.sound.lift = 1.01;
    },
    'sound.lift',
  ],
];
for (const [name, change, path] of invalid) {
  test(`both validators reject ${name} with a useful path`, () => {
    const doc = structuredClone(peony);
    change(doc);
    assert.equal(validate(doc), false);
    const result = designSchema.safeParse(doc);
    assert.equal(result.success, false);
    assert.ok(
      result.error.issues.some((issue) => issue.path.join('.').startsWith(path)),
      result.error.message,
    );
    assert.throws(() => upgradeDesign(doc, 1), z.ZodError);
  });
}

test('unknown properties are rejected at every object in all fixtures', () => {
  for (const name of ['peony', 'comet', 'multi-break']) {
    const doc = fixture(name);
    function visit(value, path = []) {
      if (!value || typeof value !== 'object') return;
      if (!Array.isArray(value)) {
        const changed = structuredClone(doc);
        const node = path.reduce((parent, key) => parent[key], changed);
        node.typo = true;
        assert.equal(validate(changed), false, `${name}: ${path.join('.')}`);
        assert.equal(designSchema.safeParse(changed).success, false, `${name}: ${path.join('.')}`);
      }
      for (const [key, child] of Object.entries(value)) visit(child, [...path, key]);
    }
    visit(doc);
  }
});

test('defaults are valid annotations and never repair missing required properties', () => {
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if ('default' in node) {
      const check = ajv.compile({ ...node, definitions: schema.definitions });
      assert.equal(check(node.default), true, ajv.errorsText(check.errors));
    }
    for (const child of Object.values(node)) visit(child);
  }
  visit(schema);
  for (const missing of ['launch', 'breaks', 'ground', 'sound', 'seed']) {
    const doc = structuredClone(peony);
    delete doc[missing];
    assert.equal(validate(doc), false);
    assert.equal(designSchema.safeParse(doc).success, false);
  }
});

test('zero seed, optional contextual halo and multiple modifiers survive validation', () => {
  const doc = fixture('multi-break');
  doc.seed = 0;
  delete doc.breaks[0].layers[0].head.halo;
  assert.equal(validate(doc), true, ajv.errorsText(validate.errors));
  const parsed = upgradeDesign(doc, 1);
  assert.equal(parsed.seed, 0);
  assert.equal(parsed.breaks[0].layers[0].head.halo, undefined);
  assert.deepEqual(
    parsed.breaks[0].layers[0].modifiers.map((m) => m.kind),
    ['crackle', 'strobe'],
  );
  assert.equal(parsed.breaks[1].at_s, 0.8);
  assert.deepEqual(parsed.breaks[1].layers[0].offset_m, [0, 8, 0]);
});

test('palette changes, ghost steps and late changes are expressible', () => {
  const doc = structuredClone(peony);
  const colour = doc.breaks[0].layers[0].colour;
  colour.mode = 'random';
  colour.stops = [
    [0, ['#ff3048', '#2fe06a']],
    [0.98, ['#ff3048', '#2fe06a']],
    [1.06, '#ffffff'],
  ];
  colour.reignition = { at: 0.98, duration: 0.1, amount: 0.5 };
  assert.equal(validate(doc), true, ajv.errorsText(validate.errors));
  assert.deepEqual(upgradeDesign(doc, 1), doc);
  colour.stops = [
    [0, ['#ff3048', '#2fe06a']],
    [0.55, ['#ff3048', '#2fe06a']],
    [0.55, '#ffffff'],
    [1, '#ffffff'],
  ];
  assert.equal(validate(doc), true, ajv.errorsText(validate.errors));
  assert.deepEqual(upgradeDesign(doc, 1), doc);
});

test('the root discriminator requires matching kind blocks and rejects unrelated ones', () => {
  const base = fixture('comet');
  const cases = [
    ['comet', { comets: base.ground.comets }],
    ['candle', { comets: { ...base.ground.comets, count: 8, pattern: 'sequence', gap_s: 1 } }],
    [
      'fountain',
      {
        fountain: {
          duration_s: 7,
          rate_per_s: 1600,
          speed_m_s: 20,
          cone: 0.1,
          colour: '#ffd98a',
          life_s: 1.2,
          emitters: 1,
          spacing_m: 1.2,
          height_m: 0.6,
          direction: [0, 1, 0],
          streak: 2,
          gravity_m_s2: 14,
          drag_per_s: 0.9,
          size: 1,
          flicker: 0.3,
          glitter: 0,
          fork: 0,
          glow: 3,
          glow_alpha: 0.2,
        },
      },
    ],
    [
      'tourbillon',
      {
        tourbillon: {
          height_m: 38,
          time_s: 2.4,
          radius_m: 1.2,
          spin_rad_s: 60,
          count: 5,
          sparks: 110,
        },
      },
    ],
    [
      'wheel',
      {
        wheel: {
          radius_m: 3,
          height_m: 6,
          spin_hz: 2,
          drivers: 6,
          duration_s: 7,
          colour: '#f4f6ff',
          sparks: 240,
          glitter: 0,
        },
      },
    ],
    [
      'spinner',
      {
        spinner: {
          count: 4,
          duration_s: 4,
          spin_rad_s: 70,
          wander_m: 1,
          sparks: 260,
          colours: ['#ff4655', '#35d06b'],
        },
      },
    ],
  ];
  for (const [kind, block] of cases) {
    const doc = { ...base, kind, ground: { kind, ...block } };
    assert.equal(validate(doc), true, `${kind}: ${ajv.errorsText(validate.errors)}`);
    assert.deepEqual(upgradeDesign(doc, 1), doc);
    const missing = { ...doc, ground: { kind } };
    assert.equal(validate(missing), false);
    assert.equal(designSchema.safeParse(missing).success, false);
    const mismatch = { ...doc, ground: { ...doc.ground, kind: 'shell' } };
    assert.equal(validate(mismatch), false);
    assert.equal(designSchema.safeParse(mismatch).success, false);
    const extra = { ...doc, ground: { ...doc.ground, unwanted: {} } };
    assert.equal(validate(extra), false);
    assert.equal(designSchema.safeParse(extra).success, false);
  }
  for (const kind of ['shell', 'mine', 'rocket']) {
    const doc = { ...peony, kind };
    assert.equal(validate(doc), true);
    assert.deepEqual(upgradeDesign(doc, 1), doc);
    assert.equal(validate({ ...doc, breaks: [] }), false);
    assert.equal(designSchema.safeParse({ ...doc, breaks: [] }).success, false);
  }
});

for (const bad of [null, [], 'shell', 1, {}, { kind: 'shell' }]) {
  test(`invalid document ${JSON.stringify(bad)} is rejected`, () => {
    assert.equal(validate(bad), false);
    assert.throws(() => upgradeDesign(bad, 1), z.ZodError);
  });
}

test('ring tilt accepts a half turn either way and the Saturn orientation', () => {
  // Dimensionless orientation from Saturn; the half-turn range follows tilt * PI / 2.
  const saturnTilt = 1.15;
  const halfTurnLimit = 2;
  // A hundredth beyond the authored bound checks rejection without floating-point ambiguity.
  const outsideLimit = 2.01;
  for (const tilt of [-halfTurnLimit, saturnTilt, halfTurnLimit]) {
    const doc = structuredClone(peony);
    doc.breaks[0].layers[0].pattern = 'ring';
    doc.breaks[0].layers[0].tilt = tilt;
    assert.equal(validate(doc), true, ajv.errorsText(validate.errors));
    assert.deepEqual(designSchema.parse(doc), doc);
  }
  for (const tilt of [-outsideLimit, outsideLimit]) {
    const doc = structuredClone(peony);
    doc.breaks[0].layers[0].tilt = tilt;
    assert.equal(validate(doc), false);
    assert.equal(designSchema.safeParse(doc).success, false);
  }
});

test('fountain glow height is optional, bounded and retained without filling defaults', () => {
  const doc = kindCases().find((c) => c.name === 'kind-fountain').design;
  const fountain = doc.ground.fountain;
  // Height in metres from the prototype's default glow and the stored emitter-height bounds.
  const prototypeGlowHeightM = 1.2;
  const maximumHeightM = 1000;
  assert.equal(validate(doc), true, ajv.errorsText(validate.errors));
  assert.equal(upgradeDesign(doc, 1).ground.fountain.glow_height_m, undefined);
  for (const height of [0, prototypeGlowHeightM, maximumHeightM]) {
    fountain.glow_height_m = height;
    assert.equal(validate(doc), true, ajv.errorsText(validate.errors));
    assert.deepEqual(upgradeDesign(doc, 1), doc);
  }
  for (const height of [-1, maximumHeightM + 1, null, '1.2m']) {
    fountain.glow_height_m = height;
    assert.equal(validate(doc), false);
    assert.equal(designSchema.safeParse(doc).success, false);
  }
});
