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

const schema = JSON.parse(readFileSync(new URL('../schema/design.v1.json', import.meta.url)));
const ajv = new Ajv({ allErrors: true, strict: true });
const validate = ajv.compile(schema);
const golden = JSON.parse(
  readFileSync(new URL('./fixtures/template-goldens.json', import.meta.url)),
);
// Float32 reference outputs use the same absolute tolerance as the core simulation goldens.
const FLOAT32_TOLERANCE = 1e-6;
// Catalogue size audited from the reference PRESETS, including all six library groups.
const TEMPLATE_COUNT = 99;
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

test('catalogue covers every captured preset exactly once in prototype order', () => {
  const metadata = ({ key, name, group }) => ({ key, name, group });
  assert.equal(effectTemplates.length, TEMPLATE_COUNT);
  assert.deepEqual(effectTemplates.map(metadata), golden.templates.map(metadata));
  assert.equal(new Set(effectTemplates.map((e) => e.key)).size, effectTemplates.length);
  assert.deepEqual(
    readdirSync(new URL('../src/templates/', import.meta.url))
      .filter((n) => n.endsWith('.json'))
      .sort(),
    effectTemplates.map((e) => `${e.key}.json`).sort(),
  );
});
for (const entry of effectTemplates) {
  test(`${entry.key}: stored template validates, resolves and matches full prototype frames`, () => {
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
    for (const f of reference.frames) {
      const label = `${entry.key} t=${f.time_s}`;
      const p = simulate(d, f.time_s);
      assert.equal(p.kinds.length, f.count, label);
      f.samples.forEach((s) => compare(row(p, s.index), s.values, `${label} particle=${s.index}`));
      assert.equal(p.smoke.sizes.length, f.smoke.count, `${label} smoke`);
      f.smoke.samples.forEach((s) =>
        compare(smokeRow(p.smoke, s.index), s.values, `${label} smoke=${s.index}`),
      );
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
      simulate(d, shotDuration(d));
      simulate(d, 0);
      assert.deepEqual(simulate(d, f.time_s), p, `${label} scrub`);
    }
    assert.deepEqual(entry.design, before);
  });
}
