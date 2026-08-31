import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  applyFireworkTimelineBoundaryEdit,
  applyFireworkTimelineEdit,
  deriveFireworkEditorTimeline,
  estimateFireworkDesignTiming,
  estimateFireworkLaunchSmokeEndSeconds,
  estimateFireworkLaunchTrailEndSeconds,
  estimateFireworkLiftTimeSeconds,
  usesLegacyLaunchLiftAppearance,
} from '../../lib/fireworks/timing.ts';

function starLayer(life = [1, 1]) {
  return {
    enabled: true,
    burst: { life },
    head: {
      brightnessHoldPercent: 82,
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
    trail: { length: 1 },
    launch: {
      liftParticles: {
        enabled: false,
        amount: 0,
        height: 100,
        lifetime: { baseSeconds: 0.8, afterglowSeconds: 0.1, variationPercent: 0 },
      },
      smoke: { enabled: false, particles: 0, lifeSeconds: 3.2 },
    },
    ...overrides,
  };
}

function mergeDesign(base, patch) {
  if (Array.isArray(patch)) return structuredClone(patch);
  if (typeof patch !== 'object' || patch === null) return patch;
  const next =
    typeof base === 'object' && base !== null && !Array.isArray(base) ? structuredClone(base) : {};
  for (const [key, value] of Object.entries(patch)) {
    next[key] = mergeDesign(next[key], value);
  }
  return next;
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

test('lift timing uses the same pan-adjusted vertical velocity as the engine', () => {
  const angled = design({ liftVelocity: 21.1043, shellLife: 2.3 });

  assert.ok(Math.abs(estimateFireworkLiftTimeSeconds(angled, 30) - 1.8) < 0.0001);
  assert.ok(Math.abs(estimateFireworkLiftTimeSeconds(angled) - 2.0666666667) < 0.0001);
  assert.ok(
    Math.abs(
      estimateFireworkDesignTiming(angled, 30).liftTimeSeconds -
        estimateFireworkLiftTimeSeconds(angled, 30),
    ) < 0.0001,
  );
});

test('legacy launch timing retains mortar smoke without extending it through ascent', () => {
  const outer = starLayer([1, 1]);
  outer.burstTrail = {
    enabled: true,
    particlesPerStar: 24,
    lifetime: { percent: 1, variationPercent: 0 },
  };
  const inherited = design({
    stars: { outer, core: { ...starLayer(), enabled: false } },
    trail: { length: 1, streakLife: 1 },
    launch: {
      liftParticles: {
        appearanceMode: 'inherit',
        enabled: true,
        amount: 100,
        height: 100,
        lifetime: { baseSeconds: 4, afterglowSeconds: 1, variationPercent: 0 },
      },
      smoke: {
        enabled: true,
        particles: 100,
        lifeSeconds: 8,
        lifeVariationPercent: 40,
        height: 360,
      },
    },
  });
  const custom = structuredClone(inherited);
  custom.launch.liftParticles.appearanceMode = 'custom';
  const liftTime = estimateFireworkLiftTimeSeconds(inherited);

  assert.equal(usesLegacyLaunchLiftAppearance(inherited), true);
  assert.ok(Math.abs(estimateFireworkLaunchTrailEndSeconds(inherited) - (liftTime + 0.38)) < 0.001);
  assert.ok(Math.abs(estimateFireworkLaunchSmokeEndSeconds(inherited) - 11.2) < 0.001);
  assert.ok(estimateFireworkLaunchTrailEndSeconds(custom) > liftTime + 4.9);
  assert.ok(Math.abs(estimateFireworkLaunchSmokeEndSeconds(custom) - (liftTime + 11.2)) < 0.001);
});

test('ground effects exclude lift particles but retain mortar smoke in timeline tails', () => {
  const ground = design({
    geometry: 'fountain',
    launch: {
      liftParticles: {
        appearanceMode: 'custom',
        enabled: true,
        amount: 100,
        height: 100,
        lifetime: { baseSeconds: 8, afterglowSeconds: 6, variationPercent: 100 },
      },
      smoke: {
        enabled: true,
        particles: 100,
        lifeSeconds: 12,
        lifeVariationPercent: 100,
        height: 360,
      },
    },
  });

  assert.equal(estimateFireworkLaunchTrailEndSeconds(ground), 0);
  assert.equal(estimateFireworkLaunchSmokeEndSeconds(ground), 24);
  assert.equal(estimateFireworkDesignTiming(ground).endSeconds, 24);
  assert.equal(deriveFireworkEditorTimeline(ground).tailEditable, false);
});

test('zero-height aerial smoke retains only the mortar smoke tail', () => {
  const aerial = design({
    launch: {
      liftParticles: { appearanceMode: 'custom' },
      smoke: {
        enabled: true,
        particles: 100,
        lifeSeconds: 4,
        lifeVariationPercent: 75,
        height: 0,
      },
    },
  });

  assert.equal(estimateFireworkLaunchSmokeEndSeconds(aerial), 7);
});

test('preview ticks consume the shared design-aware timing helper', () => {
  const source = readFileSync(
    new URL('../../components/admin/editor-preview-timing.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /estimateFireworkDesignTiming/);
  assert.doesNotMatch(source, /lifeScaleForGeometry|2\.25/);
});

test('effect canonicalisation routes geometry tuning into render defaults', () => {
  const source = readFileSync(new URL('../../lib/fireworks/design.ts', import.meta.url), 'utf8');
  const keyBlock = source.match(/const FIREWORK_RENDER_DEFAULT_KEYS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(keyBlock, 'render-default key list should remain discoverable');
  const keys = new Set([...keyBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]));
  const input = { geometryTuning: { ring: { lifePercent: 175 } } };
  const renderDefaults = Object.fromEntries(Object.entries(input).filter(([key]) => keys.has(key)));

  assert.deepEqual(renderDefaults.geometryTuning, input.geometryTuning);
  assert.match(source, /deepMergeDesign\(topLevelDefaults, existingDefaults\)/);
});

test('editor timeline derives ordered phases that sum to the visible duration', () => {
  const timeline = deriveFireworkEditorTimeline(design());
  const summed = Object.values(timeline.phases).reduce((total, value) => total + value, 0);

  assert.ok(timeline.phases.ascent > 0);
  assert.ok(timeline.phases.burn >= 0);
  assert.ok(timeline.phases.fade >= 0);
  assert.ok(timeline.phases.tail >= 0);
  assert.ok(Math.abs(summed - timeline.totalDurationSeconds) <= 0.02);
});

test('total timeline edits proportionally extend ascent, burn and fade', () => {
  const current = design({
    stars: {
      outer: starLayer([2, 4]),
      core: { ...starLayer([2, 4]), enabled: false },
    },
  });
  const before = deriveFireworkEditorTimeline(current);
  const patch = {};
  applyFireworkTimelineEdit(patch, current, 'total', before.totalDurationSeconds * 1.25);
  const after = deriveFireworkEditorTimeline(mergeDesign(current, patch));

  assert.ok(after.phases.ascent > before.phases.ascent);
  assert.ok(after.phases.burn > before.phases.burn);
  assert.ok(after.phases.fade > before.phases.fade);
  assert.ok(Math.abs(after.totalDurationSeconds - before.totalDurationSeconds * 1.25) < 0.2);
});

test('total edits preserve inherited streak appearance while scaling its life', () => {
  const outer = starLayer([2, 4]);
  outer.burstTrail = {
    enabled: true,
    particlesPerStar: 24,
    lifetime: { percent: 1, variationPercent: 0 },
  };
  const current = design({
    stars: { outer, core: { ...starLayer([2, 4]), enabled: false } },
    trail: { length: 1, streakLife: 1 },
    launch: {
      liftParticles: {
        appearanceMode: 'inherit',
        enabled: true,
        amount: 100,
        height: 100,
        lifetime: { baseSeconds: 0.8, afterglowSeconds: 0.1, variationPercent: 0 },
      },
      smoke: { enabled: true, particles: 100, lifeSeconds: 3.2 },
    },
  });
  const before = deriveFireworkEditorTimeline(current);
  const patch = {};
  applyFireworkTimelineEdit(patch, current, 'total', before.totalDurationSeconds * 1.2);

  assert.equal(patch.launch?.liftParticles?.appearanceMode, undefined);
  assert.ok(patch.trail.streakLife > current.trail.streakLife);
});

test('fade edits align the renderer hold and enabled closing transitions', () => {
  const layer = starLayer([4, 4]);
  layer.head.closing.colour = { enabled: true, fadePercent: 18 };
  layer.head.closing.size = { enabled: true, shrinkPercent: 18 };
  const current = design({
    stars: { outer: layer, core: { ...starLayer([4, 4]), enabled: false } },
  });
  const patch = {};
  applyFireworkTimelineEdit(patch, current, 'fade', 2);

  const fadePercent = patch.stars.outer.head.closing.colour.fadePercent;
  assert.equal(patch.stars.outer.head.brightnessHoldPercent + fadePercent, 100);
  assert.equal(patch.stars.outer.head.closing.size.shrinkPercent, fadePercent);
  const after = deriveFireworkEditorTimeline(mergeDesign(current, patch));
  assert.ok(Math.abs(after.phases.fade - 2) <= 0.02);
});

test('head phase sliders can claim the full shared life range', () => {
  const current = design({
    stars: {
      outer: starLayer([8, 8]),
      core: { ...starLayer([8, 8]), enabled: false },
    },
  });
  const burnPatch = {};
  applyFireworkTimelineEdit(burnPatch, current, 'burn', 8);
  const burnTimeline = deriveFireworkEditorTimeline(mergeDesign(current, burnPatch));
  assert.ok(Math.abs(burnTimeline.phases.burn - 8) <= 0.02);
  assert.ok(burnTimeline.phases.fade <= 0.02);

  const fadePatch = {};
  applyFireworkTimelineEdit(fadePatch, current, 'fade', 8);
  const fadeTimeline = deriveFireworkEditorTimeline(mergeDesign(current, fadePatch));
  assert.ok(Math.abs(fadeTimeline.phases.fade - 8) <= 0.02);
  assert.ok(fadeTimeline.phases.burn <= 0.02);
});

test('timeline boundary edits redistribute adjacent phases', () => {
  const layer = starLayer([4, 4]);
  layer.head.brightnessHoldPercent = 50;
  const current = design({
    stars: { outer: layer, core: { ...starLayer([4, 4]), enabled: false } },
  });
  const before = deriveFireworkEditorTimeline(current);
  const headEnd = before.phases.ascent + before.phases.burn + before.phases.fade;
  const patch = {};
  applyFireworkTimelineBoundaryEdit(
    patch,
    current,
    'burn',
    before.phases.ascent + before.phases.burn + 1,
  );
  const after = deriveFireworkEditorTimeline(mergeDesign(current, patch));

  assert.ok(after.phases.burn > before.phases.burn);
  assert.ok(after.phases.fade < before.phases.fade);
  assert.ok(
    Math.abs(after.phases.ascent + after.phases.burn + after.phases.fade - headEnd) <= 0.03,
  );
});

test('tail edits extend active burst trails without enabling inactive systems', () => {
  const outer = starLayer([4, 4]);
  outer.burstTrail = {
    enabled: true,
    particlesPerStar: 24,
    preset: 'sparkDust',
    lifetime: { percent: 1, variationPercent: 0 },
  };
  const current = design({
    stars: { outer, core: { ...starLayer([4, 4]), enabled: false } },
  });
  const patch = {};
  applyFireworkTimelineEdit(patch, current, 'tail', 2);
  const after = deriveFireworkEditorTimeline(mergeDesign(current, patch));

  assert.equal(patch.stars.outer.burstTrail.preset, 'custom');
  assert.equal(patch.stars.outer.burstTrail.lifetime.percent, 1.5);
  assert.equal(patch.split, undefined);
  assert.ok(Math.abs(after.phases.tail - 2) <= 0.02);
});

test('ground-effect timeline edits never introduce an ascent phase', () => {
  const current = design({ geometry: 'roman_candle' });
  const patch = {};
  applyFireworkTimelineEdit(patch, current, 'ascent', 4);

  assert.equal(patch.liftVelocity, undefined);
  assert.equal(deriveFireworkEditorTimeline(current).phases.ascent, 0);
});
