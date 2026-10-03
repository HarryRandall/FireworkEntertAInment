/** Stateless source hand-off, unchanged CPU callback evidence and density-independent CPU work. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/sim/index.ts';
import { effectTemplates } from '../src/templates/index.ts';
import { ParticleWriter } from '../src/sim/particles.ts';
import { sourceSpray } from '../src/sim/spray-source.ts';
import { packSourcePhases } from '../src/view/source-phases.ts';
import { SOURCE_SCALARS, sourceLane, SOURCE_COMPONENTS } from '../src/view/source-layout.ts';
import { SpraySources } from '../src/view/spray-sources.ts';
import { birthParityFrame } from '../../../tests/browser/spray-birth-expectations.ts';

const TIMES_S = [0.4, 1.6, 2.2, 3.1, 5];
for (const entry of effectTemplates) {
  test(`${entry.key}: analytic hand-off retains reference callbacks and direct-seek records`, () => {
    for (const time of TIMES_S) {
      const original = [];
      const dual = [];
      const capture = (target) => (slot, origin, inherited, alpha) => {
        target.push({ ...slot, origin: [...origin], inherited: [...inherited], alpha });
      };
      const frame = simulate(entry.design, time, { sprayBirth: capture(original) });
      const sources = new SpraySources();
      sources.reset(time);
      const replay = simulate(entry.design, time, {
        spraySource: sources.receive,
        sprayBirth: capture(dual),
      });
      assert.deepEqual(dual, original);
      assert.deepEqual(replay, frame);
      const data = sources.data.slice();
      const count = sources.count;
      sources.reset(time + 0.17);
      simulate(entry.design, time + 0.17, { spraySource: sources.receive });
      sources.reset(time);
      simulate(entry.design, time, { spraySource: sources.receive });
      assert.deepEqual(
        sources.data.subarray(0, sources.sources * SOURCE_SCALARS),
        data.subarray(0, sources.sources * SOURCE_SCALARS),
      );
      assert.equal(sources.count, count);
    }
  });
}

test('CPU source submissions stay constant when spray candidate density grows', () => {
  const writer = new ParticleWriter();
  const sources = new SpraySources();
  writer.spraySource = sources.receive;
  const callback = () => {
    throw new Error('GPU path sampled a CPU trajectory');
  };
  const options = {
    count: 20,
    life: 1,
    spread: 2,
    size: 1,
    flicker: 0.6,
    colour: [1, 0.5, 0.2],
    seed: -2147483648,
  };
  sources.reset(0.4);
  sourceSpray(writer, callback, -0.1, 1, 0.4, options, () => ({
    kind: 'fixed',
    origin: [0, 1, 0],
  }));
  const candidates = sources.count;
  const capacity = sources.data.length;
  sources.reset(0.4);
  sourceSpray(writer, callback, -0.1, 1, 0.4, { ...options, count: 2000 }, () => ({
    kind: 'fixed',
    origin: [0, 1, 0],
  }));
  assert.equal(sources.sources, 1);
  assert.equal(sources.data.length, capacity);
  assert.ok(sources.count > candidates * 90);
});

test('birth readback sampling is bounded and includes live reference initial conditions', () => {
  for (const entry of effectTemplates) {
    const frame = birthParityFrame(entry.design, 1.6);
    assert.ok(frame.feedback.count <= 256);
    assert.equal(frame.expected.length, frame.feedback.count * 9);
  }
});

test('phase anchors preserve Float64 reduction and independent bee harmonics', () => {
  const design = effectTemplates.find((entry) => entry.key === 'bees').design;
  let checked = 0;
  simulate(design, 2.2, {
    spraySource: (trajectory, start, end, now, options) => {
      if (
        trajectory.kind !== 'star' ||
        !trajectory.layer.modifiers.some((modifier) => modifier.kind === 'bees')
      )
        return;
      const sources = new SpraySources();
      sources.reset(1000000);
      sources.receive(trajectory, start, end, now, options);
      const interval = (options.life / options.count) * 1.15;
      const slot = Math.floor(Math.min(now, end) / interval);
      const anchor = slot * interval;
      assert.equal(sources.data[sourceLane.clock * SOURCE_COMPONENTS], Math.fround(anchor));
      assert.equal(
        sources.data[sourceLane.clock * SOURCE_COMPONENTS + 1],
        Math.fround(now - anchor),
      );
      assert.equal(sources.data[sourceLane.clock * SOURCE_COMPONENTS + 2], slot);
      let index = 0;
      for (const modifier of trajectory.layer.modifiers) {
        if (!['twist', 'fish', 'bees', 'flutter'].includes(modifier.kind)) continue;
        if (modifier.kind === 'bees') {
          const phase = anchor * 7 + trajectory.direction.ph;
          const expected = [
            phase * 1.3,
            phase * 2.9,
            phase * 1.7 + 1,
            phase * 3.3,
            phase * 1.1 + 2,
            phase * 2.3,
          ];
          const offset = (sourceLane.modifierPhases + index * 2) * SOURCE_COMPONENTS;
          assert.deepEqual(
            [...sources.data.slice(offset, offset + expected.length)],
            expected.map((value) => Math.fround(value % (2 * Math.PI))),
          );
          checked++;
        }
        index++;
      }
    },
  });
  assert.ok(checked > 0);
});

test('wheel Float32 inherited motion keeps a shared phase through forward and backward samples', (context) => {
  const speed = 2 * Math.PI * 8;
  const radius = 2;
  const step = 0.016;
  const interval = (1.1 / 400) * 1.15;
  const phase = (time) => speed * (time < 1 ? 0.5 * time * time : time - 0.5);
  const advance = (anchor, local) => {
    const time = anchor + local;
    if (anchor < 1 && time < 1) return local * (anchor + local * 0.5);
    if (anchor < 1) return local - 0.5 * (anchor - 1) ** 2;
    if (time < 1) return local + 0.5 * (time - 1) ** 2;
    return local;
  };
  const round = Math.fround;
  let largestError = 0;
  for (const now of [0.992, 1, 1.008, 3.1, 5]) {
    const slot = Math.floor(now / interval);
    const anchor = slot * interval;
    const phases = new Float32Array(SOURCE_SCALARS);
    packSourcePhases(
      phases,
      { kind: 'wheel', centre: [21, 3, -14], speed, radius, phase: 0 },
      anchor,
    );
    for (let older = 0; older < 200; older++) {
      const local = round(round(-older + round(0.713)) * round(interval));
      const time = anchor + (-older + 0.713) * interval;
      const angle = round(
        phases[sourceLane.phases * SOURCE_COMPONENTS] +
          round(round(speed) * round(advance(round(anchor), local))),
      );
      for (const delta of [-step, step]) {
        const rotation = round(round(speed) * round(advance(round(anchor + local), round(delta))));
        for (const cosine of [false, true]) {
          const sine = round(Math.sin(angle));
          const cos = round(Math.cos(angle));
          const base = cosine ? cos : sine;
          const shifted = cosine
            ? round(
                round(cos * round(Math.cos(rotation))) - round(sine * round(Math.sin(rotation))),
              )
            : round(
                round(sine * round(Math.cos(rotation))) + round(cos * round(Math.sin(rotation))),
              );
          const velocity = round(
            round(round(shifted * radius) - round(base * radius)) / round(delta),
          );
          const trig = cosine ? Math.cos : Math.sin;
          const expected = ((trig(phase(time + delta)) - trig(phase(time))) * radius) / delta;
          largestError = Math.max(largestError, Math.abs(velocity - expected));
        }
      }
    }
  }
  context.diagnostic(`Largest modelled inherited error: ${largestError} m/s`);
  // The model's 0.25 mm/s budget propagates through wheel drag (1.8/s) by at most
  // (1 - exp(-1.8 * age)) / 1.8, hence 0.139 mm of final position error as age grows.
  // The observed 0.2393 mm/s remains below this bound; browser tolerances are unchanged.
  const inheritedBudgetMPerS = 0.00025;
  assert.ok(
    largestError < inheritedBudgetMPerS,
    `Float32 model inherited error ${largestError} m/s`,
  );
});

test('source record caching retains signed zero independently of the previous source', () => {
  const sources = new SpraySources();
  const options = {
    count: 20,
    life: 1,
    spread: 2,
    size: 1,
    flicker: 0.6,
    colour: [1, 0.5, 0.2],
    seed: 1,
  };
  const originOffset = sourceLane.origin * SOURCE_COMPONENTS;
  const receive = (x) => {
    sources.reset(2.2);
    sources.receive({ kind: 'fixed', origin: [x, 1, 0] }, 0, 3, 2.2, options);
  };
  receive(-0);
  assert.equal(sources.data[originOffset], -0, 'fresh allocation must preserve the authored sign');
  const negativeFrame = sources.data.slice(0, SOURCE_SCALARS);
  receive(0);
  assert.equal(sources.data[originOffset], 0);
  assert.equal(sources.dirty, true, 'a changed zero sign needs a texture upload');
  receive(-0);
  assert.deepEqual(sources.data.slice(0, SOURCE_SCALARS), negativeFrame);
  assert.equal(sources.dirty, true);
  receive(-0);
  assert.equal(sources.dirty, false, 'an identical record still reuses its texture');
});
