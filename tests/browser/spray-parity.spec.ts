/** Transform-feedback parity against the unchanged CPU kernel, using the live GPU upload format. */
import { test, expect } from '@playwright/test';
import { simulate } from '../../packages/fireworks/src/sim/index';
import { reviewFixtures } from '../../packages/fireworks/src/fixtures/index';
import { effectTemplates } from '../../packages/fireworks/src/templates/index';
import {
  BIRTH_TEXTURE_WIDTH,
  sprayDirections,
} from '../../packages/fireworks/src/view/spray-births';
import { sprayVertex } from '../../packages/fireworks/src/view/gpu-sprays';
import { readSprayFeedback } from './spray-feedback';
import {
  buildParityFrame,
  modifierParityFrame,
  parityError,
  FIXED_TIMES_S,
  packed,
  feedbackFrame,
} from './spray-expectations';

function compare(actual: number[], expected: number[]) {
  const result = parityError(actual, expected);
  expect(result.worstRatio, result.message).toBeLessThanOrEqual(1);
}

const cases = [
  ...reviewFixtures,
  ...effectTemplates.filter((entry) =>
    ['fountain', 'sparkler', 'wheel', 'silverDragon', 'glitterWillow'].includes(entry.key),
  ),
];
for (const entry of cases) {
  test(`${entry.key}: GPU spray attributes match CPU at fixed times and direct seeks`, async ({
    page,
  }) => {
    await page.goto('/dev');
    const frames = FIXED_TIMES_S.map((time) => buildParityFrame(entry.design, time));
    const populated = frames.filter((frame) => frame.births.count > 0);
    expect(populated.length, 'fixture must exercise spray candidates').toBeGreaterThan(0);
    for (const [index, time] of FIXED_TIMES_S.entries()) {
      // An intervening source pass must not change sampled identities or packed uploads.
      simulate(entry.design, time + 0.17, { sprayBirth: () => {} });
      const replay = buildParityFrame(entry.design, time);
      expect(feedbackFrame(replay)).toEqual(feedbackFrame(frames[index]));
    }
    const actual = await page.evaluate(readSprayFeedback, {
      vertex: sprayVertex,
      directions: packed(sprayDirections()),
      width: BIRTH_TEXTURE_WIDTH,
      frames: populated.map(feedbackFrame),
    });
    for (const [index, frame] of populated.entries()) {
      compare(actual[index * 2], frame.expected);
      const replay = parityError(actual[index * 2 + 1], actual[index * 2]);
      expect(replay.worstRatio, replay.message).toBe(0);
    }
  });
}

test('fork children, dormant and flashing glitter, directed gerbs and capped streaks match CPU', async ({
  page,
}) => {
  await page.goto('/dev');
  const frame = modifierParityFrame();
  const [actual] = await page.evaluate(readSprayFeedback, {
    vertex: sprayVertex,
    directions: packed(sprayDirections()),
    width: BIRTH_TEXTURE_WIDTH,
    frames: [feedbackFrame(frame)],
  });
  compare(actual, frame.expected);
});
