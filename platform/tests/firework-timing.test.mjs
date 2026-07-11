import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  estimateFireworkDesignTiming,
  estimateFireworkLiftTimeSeconds,
} from '../lib/fireworks/timing.ts';

function starLayer(life = [1, 1]) {
  return {
    enabled: true,
    burst: { life },
    head: {
      closing: {
        colour: { enabled: false, fadePercent: 0 },
        size: { enabled: false, shrinkPercent: 0 },
      },
    },
    burstTrail: {
      enabled: false,
      particlesPerStar: 0,
      lifetime: { percent: 1, variationPercent: 0 },
    },
  };
}

function design(overrides = {}) {
  return {
    geometry: 'sphere',
    size: 80,
    shellLife: 20,
    liftVelocity: 15,
    stars: {
      outer: starLayer(),
      core: { ...starLayer(), enabled: false },
    },
    geometryTuning: {
      ring: { lifePercent: 82 },
      weeping: { lifePercent: 125 },
      fallingTail: { lifePercent: 125 },
      waterfall: { lifePercent: 135 },
      pearls: { lifePercent: 62 },
      singleTail: { lifePercent: 90, trailLifePercent: 125 },
      upwardFan: { lifePercent: 72, trailLifePercent: 60 },
      romanCandle: {
        durationPercent: 40,
        durationMinSeconds: 3,
        durationMaxSeconds: 10,
        lifePercent: 92,
        trailLifePercent: 85,
      },
      fountain: {
        durationPercent: 26,
        durationMinSeconds: 2.5,
        durationMaxSeconds: 10,
        lifePercent: 60,
        trailLifePercent: 40,
      },
      fish: { lifeBaseSeconds: 0.8, lifeVariationSeconds: 1.8, trailLifePercent: 60 },
      whirl: { lifeBaseSeconds: 1, lifeVariationSeconds: 2, trailLifePercent: 70 },
    },
    split: {
      enabled: false,
      delayRatio: 0.42,
      lifeBaseSeconds: 0.65,
      lifeVariationSeconds: 1.6,
    },
    crackle: { enabled: false, probability: 0 },
    ...overrides,
  };
}

test('geometry life tuning expands the editor timing window', () => {
  const normal = design({ geometry: 'ring' });
  const tuned = design({
    geometry: 'ring',
    geometryTuning: {
      ...normal.geometryTuning,
      ring: { lifePercent: 300 },
    },
  });

  const normalTiming = estimateFireworkDesignTiming(normal);
  const tunedTiming = estimateFireworkDesignTiming(tuned);

  assert.ok(tunedTiming.fadeFinishSeconds > normalTiming.fadeFinishSeconds + 2);
  assert.ok(tunedTiming.endSeconds >= tunedTiming.fadeFinishSeconds);
});

test('split fragment life extends beyond the parent head', () => {
  const timing = estimateFireworkDesignTiming(
    design({
      split: {
        enabled: true,
        delayRatio: 0.5,
        lifeBaseSeconds: 6,
        lifeVariationSeconds: 6,
      },
    }),
  );

  assert.ok(timing.endSeconds - timing.effectStartSeconds >= 12.5);
});

test('ground emitters skip lift and include their sequence duration', () => {
  const base = design({
    geometry: 'roman_candle',
    stars: {
      outer: starLayer([2, 2]),
      core: { ...starLayer(), enabled: false },
    },
  });
  const candle = design({
    ...base,
    geometryTuning: {
      ...base.geometryTuning,
      romanCandle: {
        ...base.geometryTuning.romanCandle,
        durationPercent: 100,
        lifePercent: 300,
      },
    },
  });
  const timing = estimateFireworkDesignTiming(candle);

  assert.equal(estimateFireworkLiftTimeSeconds(candle), 0);
  assert.equal(timing.effectStartSeconds, 0);
  assert.equal(timing.fadeFinishSeconds, 16);
});

test('preview ticks consume the shared design-aware timing helper', () => {
  const source = readFileSync(
    new URL('../app/components/admin/editor-preview-timing.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /estimateFireworkDesignTiming/);
  assert.doesNotMatch(source, /lifeScaleForGeometry|2\.25/);
});

test('effect canonicalisation routes geometry tuning into render defaults', () => {
  const source = readFileSync(new URL('../lib/fireworks/design.ts', import.meta.url), 'utf8');
  const keyBlock = source.match(/const FIREWORK_RENDER_DEFAULT_KEYS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(keyBlock, 'render-default key list should remain discoverable');
  const keys = new Set([...keyBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]));
  const input = { geometryTuning: { ring: { lifePercent: 175 } } };
  const renderDefaults = Object.fromEntries(Object.entries(input).filter(([key]) => keys.has(key)));

  assert.deepEqual(renderDefaults.geometryTuning, input.geometryTuning);
  assert.match(source, /deepMergeDesign\(topLevelDefaults, existingDefaults\)/);
});
