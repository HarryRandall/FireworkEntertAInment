/** Curve and colour editing checks use the actual renderer sampling contract. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brightnessAt, colourAt } from '@showcrafter/fireworks/sim';
import { brightnessSchema, colourSchema } from '@showcrafter/fireworks/schema';
import {
  addCurveKey,
  addGradientStop,
  curvePath,
  gradientCss,
  insertionTime,
  moveCurveKey,
  moveGradientStop,
  pointerFraction,
  removeKey,
} from '../ui/kit/editor-maths.ts';

const curve = [
  [0, 0.2],
  [0.25, 1],
  [0.75, 0.5],
  [1, 0],
];
const gradient = {
  mode: 'solid',
  stops: [
    [0, '#ffffff'],
    [0.5, '#ff0000'],
    [1, '#000000'],
  ],
};
const options = { pinEnds: true, maxValue: 1 };
const colourOptions = { pinEnds: true, maxTime: 1 };

test('curve moves clamp value, pin endpoint time and prevent crossing neighbours', () => {
  const before = structuredClone(curve);
  assert.deepEqual(moveCurveKey(curve, 0, [0.4, 2], options)[0], [0, 1]);
  const moved = moveCurveKey(curve, 1, [1, -1], options);
  assert.ok(moved[1][0] < moved[2][0]);
  assert.equal(moved[1][1], 0);
  assert.deepEqual(curve, before);
  assert.deepEqual(moveCurveKey(curve, 1, [NaN, 1], options), curve);
  assert.ok(brightnessSchema.safeParse(moved).success);
});
test('curve insertion samples existing interpolation and preserves the whole renderer curve', () => {
  const updated = addCurveKey(curve, 0.5);
  assert.equal(updated.find(([time]) => time === 0.5)[1], brightnessAt(curve, 0.5));
  for (let sample = 0; sample <= 100; sample++) {
    assert.ok(
      Math.abs(brightnessAt(updated, sample / 100) - brightnessAt(curve, sample / 100)) < 1e-12,
    );
  }
  assert.deepEqual(addCurveKey(curve, 0.25), curve);
  assert.equal(insertionTime(curve), 0.5);
  assert.equal(
    curvePath(
      [
        [0, 0],
        [1, 1],
      ],
      1,
    ).split(' ')[32],
    'L0.5,0.5',
  );
});
test('key removal retains required stops and protects pinned endpoints', () => {
  assert.deepEqual(removeKey(curve, 0, true), curve);
  assert.deepEqual(removeKey(curve, 3, true), curve);
  assert.equal(removeKey(curve, 1, true).length, 3);
  assert.equal(
    removeKey(
      [
        [0, 1],
        [1, 0],
      ],
      1,
      false,
    ).length,
    2,
  );
  assert.equal(removeKey(curve, 0, false).length, 3);
});
test('schema capacity and coincident times are retained under repeated additions', () => {
  let keys = [
    [0, 0],
    [1, 1],
  ];
  for (let index = 0; index < 40; index++) keys = addCurveKey(keys, insertionTime(keys));
  assert.equal(keys.length, 32);
  assert.ok(brightnessSchema.safeParse(keys).success);
  for (let index = 1; index < keys.length; index++) assert.ok(keys[index][0] > keys[index - 1][0]);
});
test('gradient movement retains palettes and does not mutate input', () => {
  const authored = {
    ...gradient,
    mode: 'alternate',
    stops: [
      [0, ['#ffffff', '#ff0000']],
      [0.5, '#00ff00'],
      [1, '#000000'],
    ],
  };
  const before = structuredClone(authored);
  const updated = moveGradientStop(authored.stops, 1, 2, colourOptions);
  assert.ok(updated[1][0] < 1);
  assert.deepEqual(moveGradientStop(authored.stops, 0, 0.3, colourOptions)[0], authored.stops[0]);
  assert.deepEqual(moveGradientStop(authored.stops, 1, NaN, colourOptions), authored.stops);
  updated[0][1][0] = '#123456';
  assert.deepEqual(authored, before);
});
test('gradient display and insertion use linear RGB rather than a CSS sRGB shortcut', () => {
  const blackWhite = {
    mode: 'solid',
    stops: [
      [0, '#000000'],
      [1, '#ffffff'],
    ],
  };
  const sampled = colourAt(blackWhite, 0.5, 0, 0);
  const display = Math.round(sampled[0] ** (1 / 2.2) * 255);
  assert.equal(display, 186);
  assert.ok(gradientCss(blackWhite).includes('rgb(186 186 186) 50%'));
  assert.equal(addGradientStop(blackWhite, 0.5)[1][1], '#bababa');
  assert.ok(
    colourSchema.safeParse({ ...gradient, stops: addGradientStop(gradient, 0.25) }).success,
  );
  assert.deepEqual(addGradientStop(gradient, 0.5), gradient.stops);
});
test('extended colour life and pointer bounds use declared coordinate units', () => {
  const extended = [
    [0, '#ffffff'],
    [1, '#ff0000'],
    [2, '#000000'],
  ];
  assert.equal(moveGradientStop(extended, 2, 4, { pinEnds: false, maxTime: 2 })[2][0], 2);
  assert.equal(pointerFraction(50, 0, 100), 0.5);
  assert.equal(pointerFraction(-5, 0, 100), 0);
  assert.equal(pointerFraction(200, 0, 100), 1);
  assert.equal(pointerFraction(20, 0, 0), 0);
});

test('curve clicks can author a value instead of using interpolation', () => {
  assert.deepEqual(
    addCurveKey(curve, 0.5, 0.4).find(([time]) => time === 0.5),
    [0.5, 0.4],
  );
});
test('gradient additions retain alternate star palettes', () => {
  const value = {
    mode: 'alternate',
    stops: [
      [0, ['#000000', '#ffffff']],
      [1, ['#ffffff', '#000000']],
    ],
  };
  const added = addGradientStop(value, 0.5);
  assert.deepEqual(added[1][1], ['#bababa', '#bababa']);
  assert.ok(colourSchema.safeParse({ ...value, stops: added }).success);
});

test('tightly spaced stored keys remain strictly ordered during editing', () => {
  const tight = [
    [0, 0],
    [0.00001, 1],
    [0.00002, 0],
    [1, 1],
  ];
  const moved = moveCurveKey(tight, 1, [0.5, 0.8], options);
  assert.ok(moved[1][0] > moved[0][0]);
  assert.ok(moved[1][0] < moved[2][0]);
  assert.throws(() => curvePath(curve, 0), RangeError);
});

test('unpinned endpoints cannot overlap their nearest neighbour', () => {
  const movedFirst = moveCurveKey(curve, 0, [1, 0.2], { ...options, pinEnds: false });
  const movedLast = moveCurveKey(curve, 3, [0, 0.2], { ...options, pinEnds: false });
  assert.ok(movedFirst[0][0] < movedFirst[1][0]);
  assert.ok(movedLast[3][0] > movedLast[2][0]);
});
