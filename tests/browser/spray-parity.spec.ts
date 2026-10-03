/** Transform-feedback parity against the unchanged CPU kernel, using the live GPU upload format. */
import { test, expect } from '@playwright/test';
import { simulate } from '../../packages/fireworks/src/sim/index';
import { reviewFixtures } from '../../packages/fireworks/src/fixtures/index';
import { effectTemplates } from '../../packages/fireworks/src/templates/index';
import {
  BIRTH_TEXTURE_WIDTH,
  sprayDirections,
} from '../../packages/fireworks/src/view/spray-births';
import { sprayVertex, sourceSprayVertex } from '../../packages/fireworks/src/view/gpu-sprays';
import { readSprayFeedback } from './spray-feedback';
import { sourceBirthKernel } from '../../packages/fireworks/src/view/source-birth-kernel';
import { SpraySources } from '../../packages/fireworks/src/view/spray-sources';
import { SOURCE_TEXTURE_WIDTH } from '../../packages/fireworks/src/view/source-layout';
import { birthParityFrame, expectBirthParity } from './spray-birth-expectations';
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

// Each birth case has a bounded readback and its own timeout below the owner's 20 s budget.
const BIRTH_CASE_TIMEOUT_MS = 19000;
const birthCases = [
  ...reviewFixtures,
  ...effectTemplates.filter((entry) =>
    [
      'fountain',
      'wheel',
      'spinners',
      'tourbillon',
      'silverDragon',
      'fish',
      'bees',
      'fallingLeaves',
      'crossette',
      'spiral',
      'skyRocket',
      'bottleRocket',
    ].includes(entry.key),
  ),
];
const birthVertex = `${sourceBirthKernel}
attribute vec2 candidate;
out float tfId;
void main() {
  Birth birth = sampleBirth(int(candidate.x));
  tfPosition = birth.visible ? birth.origin : vec3(0);
  tfColour = birth.visible ? birth.inherited : vec3(0);
  tfSize = birth.visible ? birth.time : 0.0;
  tfAlpha = birth.visible ? 1.0 : 0.0;
  tfId = float(birth.id);
  gl_Position = vec4(0);
}`;
for (const entry of birthCases) {
  test(`${entry.key}: GPU births retain CPU slots, source origins and inherited velocity on direct seeks`, async ({
    page,
  }) => {
    test.setTimeout(BIRTH_CASE_TIMEOUT_MS);
    await page.goto('/dev');
    const end = entry.design.launch?.time_s;
    // Sample the shutdown edge and the last 16 ms where inheritance uses a backward difference.
    const times = end ? [...FIXED_TIMES_S, end - 0.008, end, end + 0.05] : [...FIXED_TIMES_S];
    // Straddle the one-second acceleration boundary with both 16 ms sampling directions.
    if (entry.design.kind === 'wheel') times.push(0.992, 1, 1.008);
    const frames = times.map((time) => birthParityFrame(entry.design, time));
    const populated = frames.filter((frame) => frame.feedback.count > 0);
    expect(populated.some((frame) => frame.liveBirths > 0)).toBe(true);
    for (const [index, time] of times.entries()) {
      birthParityFrame(entry.design, time + 0.17);
      expect(birthParityFrame(entry.design, time).feedback).toEqual(frames[index].feedback);
    }
    const actual = await page.evaluate(readSprayFeedback, {
      vertex: birthVertex,
      birthMode: true,
      sourceMode: true,
      directions: packed(sprayDirections()),
      width: SOURCE_TEXTURE_WIDTH,
      frames: populated.map((frame) => frame.feedback),
    });
    const appearance = await page.evaluate(readSprayFeedback, {
      vertex: `attribute vec2 candidate;\n${sourceSprayVertex.replace('evaluateSourceSpark(gl_VertexID)', 'evaluateSourceSpark(int(candidate.x))')}`,
      sourceMode: true,
      directions: packed(sprayDirections()),
      width: SOURCE_TEXTURE_WIDTH,
      frames: populated.map((frame) => frame.feedback),
    });
    for (const [index, frame] of populated.entries()) {
      compare(appearance[index * 2], frame.appearance);
      expect(appearance[index * 2 + 1]).toEqual(appearance[index * 2]);
      expect(expectBirthParity(actual[index * 2], frame.expected)).toEqual([]);
      expect(actual[index * 2 + 1]).toEqual(actual[index * 2]);
    }
  });
}

// These include exact integer tick boundaries, cancellation, zero and both signed ID extremes.
const clockCases = [
  { now: 2.2, id: 100 },
  { now: 1.6, id: 200 },
  { now: 0.4, id: 300 },
  { now: 3.1, id: 450 },
  { now: 5, id: 500 },
  { now: 0, id: 0 },
  { now: 0.000001, id: -1 },
  { now: 2.2, id: -100 },
  { now: 1.6, id: 2147483647 },
  { now: 1.6, id: -2147483648 },
];
test('source flicker clock retains binary64 integer rounding and signed hash inputs', async ({
  page,
}) => {
  test.setTimeout(BIRTH_CASE_TIMEOUT_MS);
  await page.goto('/dev');
  const sources = new SpraySources();
  sources.reset(0);
  const indices = new Float32Array(clockCases.length * 2);
  // Signed IDs use exact 16-bit limbs rather than a rounded Float32 candidate attribute.
  for (const [index, entry] of clockCases.entries()) {
    sources.receive({ kind: 'fixed', origin: [0, 0, 0] }, 0, 10, entry.now, {
      count: 20,
      life: 1,
      spread: 1,
      size: 1,
      flicker: 1,
      colour: [1, 1, 1],
      seed: entry.id,
    });
    indices[index * 2] = index;
  }
  const vertex = `${sourceBirthKernel}
attribute vec2 candidate;
void main() {
  int source = int(candidate.x);
  vec4 identity = sourceLane(source, L_identity);
  int id = joinWord(identity.x, identity.y);
  tfPosition = vec3(0); tfColour = vec3(0);
  int tick = sourceFlickerClock(source, id);
  tfColour = vec3(float(uint(tick) & LIMB_MASK), float(uint(tick) >> LIMB_BITS), 0);
  tfSize = float(tick); tfAlpha = 0.0;
  gl_Position = vec4(0);
}`;
  const actual = await page.evaluate(readSprayFeedback, {
    vertex,
    sourceMode: true,
    directions: packed(sprayDirections()),
    width: SOURCE_TEXTURE_WIDTH,
    frames: [
      {
        births: packed(sources.data),
        clocks: packed(sources.clocks),
        indices: packed(indices),
        count: clockCases.length,
        time: 0,
        sourceCount: sources.sources,
      },
    ],
  });
  // Readback converts the final signed integer to Float32, matching the feedback varying.
  const expected = clockCases.map((entry) =>
    Math.fround(Math.floor((entry.now + entry.id * 0.013) * 28)),
  );
  expect(expected.map((_, index) => actual[0][index * 8 + 6])).toEqual(expected);
  for (const [index, entry] of clockCases.entries()) {
    const tick = Math.floor((entry.now + entry.id * 0.013) * 28);
    expect(actual[0].slice(index * 8 + 3, index * 8 + 5)).toEqual([tick & 0xffff, tick >>> 16]);
  }
  expect(actual[1]).toEqual(actual[0]);
});
