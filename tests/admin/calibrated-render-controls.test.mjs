import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calibratedToRaw,
  rawToCalibrated,
  withCalibrationDefault,
} from '../../components/admin/firework-render-controls/calibrated-slider.ts';

const range = { min: 0, defaultValue: 10, max: 30 };

test('calibrated renderer controls preserve the saved default at their midpoint', () => {
  assert.equal(rawToCalibrated(0, range), 0);
  assert.equal(rawToCalibrated(10, range), 50);
  assert.equal(rawToCalibrated(20, range), 75);
  assert.equal(rawToCalibrated(30, range), 100);

  assert.equal(calibratedToRaw(0, range), 0);
  assert.equal(calibratedToRaw(50, range), 10);
  assert.equal(calibratedToRaw(75, range), 20);
  assert.equal(calibratedToRaw(100, range), 30);
});

test('calibrated renderer controls clamp external values to their supported range', () => {
  assert.equal(rawToCalibrated(-10, range), 0);
  assert.equal(rawToCalibrated(50, range), 100);
  assert.equal(calibratedToRaw(-10, range), 0);
  assert.equal(calibratedToRaw(120, range), 30);
  assert.deepEqual(withCalibrationDefault(range, 50), { ...range, defaultValue: 30 });
  assert.deepEqual(withCalibrationDefault(range, 'invalid'), range);
});
