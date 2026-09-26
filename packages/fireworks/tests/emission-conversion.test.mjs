import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  convertEmissionDesign,
  convertEmissionPart,
  convertEmissionHistory,
} from '../../../scripts/renderer/convert-emission-settings.mjs';
import { compileFireworkDesign } from '../src/design.ts';
import { groundEmissionDuration, starEmissionCount } from '../src/emission.ts';

test('one-off conversion resolves rate, duration and actual counts without retaining old tuning', () => {
  const original = {
    geometry: 'fountain',
    shellLife: 30,
    stars: { outer: { count: 90 }, core: { count: 12, enabled: false } },
    geometryTuning: {
      fountain: {
        ratePercent: 140,
        durationPercent: 26,
        durationMinSeconds: 2.5,
        durationMaxSeconds: 10,
      },
    },
  };
  const before = structuredClone(original);
  const result = convertEmissionDesign(original);
  assert.equal(result.stars.outer.emissionRate, 126);
  assert.equal(result.stars.core.emissionRate, 16.8);
  assert.equal(result.stars.core.enabled, false);
  assert.deepEqual(result.geometryTuning.fountain, { durationSeconds: 7.8 });
  const design = compileFireworkDesign({ variantOverrides: result });
  assert.equal(groundEmissionDuration(design), 7.8);
  assert.equal(starEmissionCount(design, 'outer'), 982);
  assert.deepEqual(convertEmissionDesign(result), result);
  assert.deepEqual(original, before);
  const ring = convertEmissionDesign({
    geometry: 'ring',
    stars: { outer: { count: 60 }, core: { count: 50 } },
  });
  assert.equal(ring.stars.outer.count, 43);
  assert.equal(ring.stars.core.count, 36);
});

test('part conversion preserves ownership and refuses to guess unresolved history', () => {
  const part = { stars: { core: { count: 10, enabled: false } } };
  const result = convertEmissionPart(part);
  assert.deepEqual(result, { stars: { core: { count: 10, enabled: false, emissionRate: 14 } } });
  assert.deepEqual(convertEmissionPart(result), result);
  assert.deepEqual(convertEmissionPart({ launch: { smoke: { enabled: false } } }), {
    launch: { smoke: { enabled: false } },
  });
  assert.throws(
    () => convertEmissionHistory({ kind: 'firework', renderOverridesJson: { stars: part.stars } }),
    /unresolved/,
  );
  assert.throws(
    () =>
      convertEmissionDesign({
        geometry: 'fountain',
        stars: { outer: { count: 100 } },
        geometryTuning: { fountain: { ratePercent: 99999 } },
      }),
    /emissionRate/,
  );
});
