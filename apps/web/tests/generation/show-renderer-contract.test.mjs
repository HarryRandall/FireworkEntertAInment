import assert from 'node:assert/strict';
import { test } from 'node:test';
await import('../../../../scripts/renderer/register-typescript.mjs');
const { effectTemplates, simulate, shotDuration } = await import('@showcrafter/renderer');
const { readShowDesign, resolvedShowDesign, showLiftTimeSeconds } =
  await import('../../lib/shows/renderer-design.ts');
const { buildShowRendererShots, LEGACY_LAUNCH_UNIT_METRES } =
  await import('../../lib/shows/renderer-shots.ts');
const { scheduleProductForCueSlot } = await import('../../lib/cue-generation/impact-timing.ts');
const { buildProductTimingProfile } = await import('../../lib/fireworks/timing-profile.ts');
const { isGroundEffect } = await import('../../lib/cue-generation/show-options.ts');
const frameSeconds = 1 / 60;
const shell = effectTemplates.find((entry) => entry.design.kind === 'shell').design;
const kinds = [
  'shell',
  'rocket',
  'mine',
  'comet',
  'candle',
  'fountain',
  'tourbillon',
  'wheel',
  'spinner',
];
const product = (kind) => {
  const design =
    kind === 'rocket'
      ? { ...structuredClone(shell), kind }
      : kind === 'candle'
        ? {
            ...structuredClone(
              effectTemplates.find((entry) => entry.design.kind === 'comet').design,
            ),
            kind,
          }
        : effectTemplates.find((entry) => entry.design.kind === kind).design;
  return {
    id: kind,
    name: 'A misleading fountain name',
    design,
    kind,
    caliber: '100mm',
    shotCount: 1,
  };
};

for (const kind of kinds)
  for (const emphasis of ['normal', 'accent', 'peak']) {
    test(`${kind} ${emphasis} uses the same resolved lift for planning and replay within one frame`, () => {
      const firework = product(kind);
      const timing = scheduleProductForCueSlot({
        product: firework,
        emphasis,
        targetTimeSeconds: 10,
      });
      assert.ok(timing);
      const result = buildShowRendererShots([
        {
          id: kind,
          timeSeconds: timing.launchTimeSeconds,
          launchPositionIndex: 1,
          firework,
          emphasis,
        },
      ]);
      assert.equal(result.ok, true);
      const shot = result.shots[0];
      const lift = showLiftTimeSeconds(shot.design);
      assert.ok(Math.abs(shot.t0 + lift - 10) <= frameSeconds);
      assert.equal(lift, kind === 'shell' || kind === 'rocket' ? shot.design.launch.time_s : 0);
      assert.equal(isGroundEffect(firework), kind !== 'shell' && kind !== 'rocket');
      assert.ok(simulate(shot.design, lift + frameSeconds, { seed: 11 }).kinds.length > 0);
      assert.equal(
        buildProductTimingProfile({ product: firework, emphasis }).totalDurationSeconds,
        shotDuration(shot.design),
      );
    });
  }

test('invalid stored designs are typed errors and never use a legacy design', () => {
  assert.equal(readShowDesign(null, 1).ok, false);
  assert.equal(readShowDesign(shell, 2).ok, false);
  assert.equal(
    buildShowRendererShots([{ firework: { name: 'Broken', renderDesign: shell } }]).ok,
    false,
  );
});

test('legacy positions convert once, while authored aiming and seed overrides survive', () => {
  const result = buildShowRendererShots([
    {
      timeSeconds: 1.234,
      launchPositionIndex: 2,
      firework: product('shell'),
      seedOverride: 42,
      shotPanDegrees: -20,
      shotTiltDegrees: 15,
    },
  ]);
  assert.equal(LEGACY_LAUNCH_UNIT_METRES, 0.01);
  assert.equal(result.ok, true);
  assert.deepEqual(result.shots[0].position, [2, 0]);
  assert.equal(result.shots[0].design.launch.tilt_deg, -20);
  assert.equal(result.shots[0].tilt_deg, 15);
  assert.equal(result.shots[0].seed, 42);
  assert.equal(result.shots[0].t0, 1.234);
});

test('mixed multishots derive each child impact and duration from its design', () => {
  const parent = { ...product('shell'), shotCount: 3 };
  const children = ['fountain', 'rocket', 'mine'].map((kind, i) => ({
    firework: product(kind),
    timeOffsetSeconds: i * 0.3,
  }));
  const profile = buildProductTimingProfile({ product: parent, emphasis: 'peak', children });
  assert.equal(profile.completeness, 'complete');
  for (const child of children) {
    const design = resolvedShowDesign(child.firework, 'peak');
    const shot = profile.shots.find((shot) => shot.productId === child.firework.id);
    assert.equal(shot.impactOffsetSeconds, child.timeOffsetSeconds + showLiftTimeSeconds(design));
    assert.equal(shot.endOffsetSeconds, child.timeOffsetSeconds + shotDuration(design));
  }
});

test('inch calibre resolves identically to its millimetre equivalent and repeated layer IDs adjust once', () => {
  assert.deepEqual(
    resolvedShowDesign({ design: shell, caliber: '3in' }),
    resolvedShowDesign({ design: shell, caliber: '76.2mm' }),
  );
  const multi = {
    ...structuredClone(shell),
    breaks: [structuredClone(shell.breaks[0]), structuredClone(shell.breaks[0])],
  };
  const once = resolvedShowDesign({ design: shell, caliber: '75mm' }, 'accent');
  const twice = resolvedShowDesign({ design: multi, caliber: '75mm' }, 'accent');
  assert.equal(twice.breaks[0].layers[0].radius_m, once.breaks[0].layers[0].radius_m);
});
