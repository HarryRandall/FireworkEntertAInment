/** Catalogue coverage, schema validation, scrub determinism and independent prototype parity. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import Ajv from 'ajv';
import {
  effectTemplates,
  designSchema,
  resolveDesign,
  simulate,
  shotDuration,
} from '../src/index.ts';

import { prototypeTemplate } from './prototype-template.mjs';
import { TEMPLATE_HEIGHT_BANDS, templateApexM } from '../src/templates/height-bands.ts';

const schema = JSON.parse(readFileSync(new URL('../schema/design.v1.json', import.meta.url)));
const ajv = new Ajv({ allErrors: true, strict: true });
const validate = ajv.compile(schema);
const golden = JSON.parse(
  readFileSync(new URL('./fixtures/template-goldens.json', import.meta.url)),
);
// Float32 reference outputs use the same absolute tolerance as the core simulation goldens.
const FLOAT32_TOLERANCE = 1e-6;
// Captured prototype catalogue plus two visually tuned planar shells.
const TEMPLATE_COUNT = 101;
const NEW_TEMPLATE_KEYS = ['bowtie', 'fivePointStar'];
const compare = (actual, expected, label) => {
  assert.equal(actual.length, expected.length, label);
  actual.forEach((v, i) =>
    assert.ok(
      Math.abs(v - expected[i]) <= FLOAT32_TOLERANCE,
      `${label} field=${i}: ${v} != ${expected[i]}`,
    ),
  );
};
const row = (p, i) => [
  p.kinds[i],
  ...p.positions.slice(i * 3, i * 3 + 3),
  ...p.colours.slice(i * 3, i * 3 + 3),
  p.sizes[i],
  p.alphas[i],
];
const smokeRow = (p, i) => [
  ...p.positions.slice(i * 3, i * 3 + 3),
  ...p.colours.slice(i * 3, i * 3 + 3),
  p.sizes[i],
  p.alphas[i],
  p.seeds[i],
  p.ages[i],
];

test('catalogue preserves captured preset order and adds two planar shells exactly once', () => {
  const metadata = ({ key, name, group }) => ({ key, name, group });
  assert.equal(effectTemplates.length, TEMPLATE_COUNT);
  assert.deepEqual(
    effectTemplates.filter((entry) => !NEW_TEMPLATE_KEYS.includes(entry.key)).map(metadata),
    golden.templates.map(metadata),
  );
  assert.equal(new Set(effectTemplates.map((e) => e.key)).size, effectTemplates.length);
  assert.deepEqual(
    readdirSync(new URL('../src/templates/', import.meta.url))
      .filter((n) => n.endsWith('.json'))
      .sort(),
    effectTemplates.map((e) => `${e.key}.json`).sort(),
  );
});
for (const entry of effectTemplates) {
  test(`${entry.key}: stored template validates, resolves and reproduces deterministic frames`, () => {
    const raw = JSON.parse(
      readFileSync(new URL(`../src/templates/${entry.key}.json`, import.meta.url)),
    );
    assert.deepEqual(raw, entry);
    assert.equal(validate(raw.design), true, ajv.errorsText(validate.errors));
    assert.deepEqual(designSchema.parse(raw.design), raw.design);
    const before = structuredClone(entry.design);
    const d = resolveDesign(entry.design);
    assert.deepEqual(d, entry.design);
    assert.ok(Number.isFinite(shotDuration(d)) && shotDuration(d) > 0);
    const reference = golden.templates.find((e) => e.key === entry.key);
    assert.ok(reference || NEW_TEMPLATE_KEYS.includes(entry.key), `${entry.key}: missing capture`);
    // New shells have no prototype capture: verify finite, deterministic frames without inventing goldens.
    const frames =
      reference?.frames ?? [0, 0.5, 1.4, 3].map((age) => ({ time_s: d.launch.time_s + age }));
    for (const f of frames) {
      const label = `${entry.key} t=${f.time_s}`;
      // Captured templates replay their original inputs; new shells check finite frames only.
      const original = reference ? prototypeTemplate(entry) : d;
      const p = simulate(original, f.time_s);
      if (reference) {
        assert.equal(p.kinds.length, f.count, label);
        f.samples.forEach((s) =>
          compare(row(p, s.index), s.values, `${label} particle=${s.index}`),
        );
        assert.equal(p.smoke.sizes.length, f.smoke.count, `${label} smoke`);
        f.smoke.samples.forEach((s) =>
          compare(smokeRow(p.smoke, s.index), s.values, `${label} smoke=${s.index}`),
        );
      }
      for (const values of [
        p.positions,
        p.colours,
        p.sizes,
        p.alphas,
        p.smoke.positions,
        p.smoke.colours,
        p.smoke.sizes,
        p.smoke.alphas,
      ])
        assert.ok(values.every(Number.isFinite), label);
      simulate(original, shotDuration(original));
      simulate(original, 0);
      assert.deepEqual(simulate(original, f.time_s), p, `${label} scrub`);
    }
    assert.deepEqual(entry.design, before);
  });
}

for (const entry of effectTemplates) {
  test(`${entry.key}: authored apex and burst top satisfy the kind height band`, () => {
    const d = entry.design;
    const apex = templateApexM(d);
    const radius = Math.max(0, ...d.breaks.flatMap((b) => b.layers.map((l) => l.radius_m)));
    const band = TEMPLATE_HEIGHT_BANDS[d.kind];
    for (const [value, limits, label] of [
      [apex, band.apex_m, 'apex'],
      [apex + radius, band.burst_top_m, 'burst top'],
    ])
      assert.ok(value >= limits[0] && value <= limits[1], `${entry.key} ${label}: ${value} m`);
    const original = prototypeTemplate(entry);
    const block = d.launch ?? d.ground?.comets;
    const old = original.launch ?? original.ground?.comets;
    if (old) {
      assert.equal(block.time_s, old.time_s * Math.sqrt(block.height_m / old.height_m));
      Object.assign(original.launch ?? original.ground.comets, {
        height_m: block.height_m,
        time_s: block.time_s,
      });
    }
    assert.deepEqual(original, d, 'only height and climb time change');
    for (const t of [0, shotDuration(d) * 0.4, shotDuration(d) * 0.8]) {
      const frame = simulate(d, t);
      simulate(d, 0);
      assert.deepEqual(simulate(d, t), frame, 'tuned template scrubs exactly');
      assert.ok(frame.positions.every(Number.isFinite));
    }
  });
}
