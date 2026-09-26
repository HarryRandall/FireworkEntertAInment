import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EFFECT_FIELDS, displayedFieldValue, storedFieldValue } from '../src/effect-fields.ts';
import { GEOMETRY_TUNING_SLIDERS } from '../src/geometry-fields.ts';
import { compileFireworkDesign, validateFireworkDesign } from '../../fireworks/src/design.ts';

test('every numeric effect control preserves both endpoints through validation and compilation', () => {
  const defaults = compileFireworkDesign({});
  for (const [section, fields] of Object.entries(EFFECT_FIELDS)) {
    for (const [key, field] of Object.entries(fields)) {
      assert.equal(typeof defaults[section][key], 'number', `${section}.${key} must exist`);
      for (const value of [field.min, defaults[section][key], field.max]) {
        const result = compileFireworkDesign({ variantOverrides: { [section]: { [key]: value } } });
        assert.equal(
          result[section][key],
          value,
          `${section}.${key} must not silently clamp ${value}`,
        );
        const shown = displayedFieldValue(value, field);
        const stored = storedFieldValue(shown, field);
        assert.ok(Math.abs(stored - value) < 1e-10, `${section}.${key} display round trip`);
      }
      for (const value of [field.min - field.step, field.max + field.step]) {
        assert.equal(
          validateFireworkDesign({ variantOverrides: { [section]: { [key]: value } } }).ok,
          false,
          `${section}.${key} outside range`,
        );
      }
    }
  }
});

test('every geometry control points to a real value and respects the model range', () => {
  const defaults = compileFireworkDesign({});
  for (const [group, fields] of Object.entries(GEOMETRY_TUNING_SLIDERS)) {
    for (const field of fields) {
      assert.equal(
        typeof defaults.geometryTuning[group][field.key],
        'number',
        `${group}.${field.key}`,
      );
      for (const value of [field.min, field.max]) {
        const result = compileFireworkDesign({
          variantOverrides: { geometryTuning: { [group]: { [field.key]: value } } },
        });
        assert.equal(
          result.geometryTuning[group][field.key],
          value,
          `${group}.${field.key} must preserve ${value}`,
        );
      }
    }
  }
});

test('ignition chance is displayed per second without changing simulation probability', () => {
  const field = EFFECT_FIELDS.crackle.probability;
  assert.ok(Math.abs(displayedFieldValue(0.05, field) - 95.3930201) < 0.000001);
  const perStep = storedFieldValue(50, field);
  assert.ok(Math.abs(1 - Math.pow(1 - perStep, 60) - 0.5) < 1e-12);
});

test('unavailable controls explain ground emitters and disabled parent layers', async () => {
  const { unavailableControlReason } = await import('../src/availability.ts');
  const design = compileFireworkDesign({ variantOverrides: { geometry: 'fountain' } });
  for (const scope of ['launch', 'launchShell', 'launchTrail', 'split']) {
    assert.match(unavailableControlReason(design, scope), /ground|Ground/);
  }
  assert.equal(unavailableControlReason(design, 'smoke'), null);
  design.geometry = 'sphere';
  assert.equal(unavailableControlReason(design, 'launch'), null);
  design.stars.outer.enabled = false;
  assert.match(unavailableControlReason(design, 'split'), /outer stars/);
  assert.match(unavailableControlReason(design, 'trail', 'outer'), /outer stars/);
  design.stars.core.enabled = false;
  assert.match(unavailableControlReason(design, 'strobe'), /Enable/);
});
