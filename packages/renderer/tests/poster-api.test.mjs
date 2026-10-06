/** Shared poster lifecycle and public browser boundaries without allocating WebGL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SharedPosterSurface } from '../src/poster/shared.ts';
import {
  poster,
  posterAll,
  stagePoster,
  disposePosters,
  developedTime,
} from '../src/poster/index.ts';
import { posterFraming } from '../src/poster/framing.ts';
import { reviewFixtureDesign } from '../src/fixtures/index.ts';
import { effectTemplates } from '../src/templates/index.ts';
import { resolveDesign } from '../src/schema/index.ts';

const design = reviewFixtureDesign('peony');
const options = { width: 160, height: 100, forceLdr: false };

function fakeSurface() {
  const pending = [];
  const sizes = [];
  let disposed = 0;
  return {
    pending,
    sizes,
    disposed: () => disposed,
    rig: {
      capture(design, time, options) {
        return new Promise((resolve, reject) =>
          pending.push({ design, time, options, resolve, reject }),
        );
      },
      resize: (width, height) => sizes.push([width, height]),
      dispose: () => {
        disposed++;
      },
    },
  };
}

test('one context serialises encoders, resizes separately and recovers from failures', async () => {
  const fake = fakeSurface();
  let allocations = 0;
  const surface = new SharedPosterSurface(() => {
    allocations++;
    return fake.rig;
  });
  const first = surface.capture(design, 1, options);
  const failed = surface.capture(design, 2, options);
  const failedCheck = assert.rejects(failed, /encoding/);
  const last = surface.capture(design, 3, { ...options, width: 320 });
  await Promise.resolve();
  assert.equal(fake.pending.length, 1);
  const png = new Blob(['PNG']);
  fake.pending.shift().resolve(png);
  assert.equal(await first, png);
  await Promise.resolve();
  assert.equal(fake.pending.length, 1);
  fake.pending.shift().reject(new Error('encoding'));
  await failedCheck;
  await Promise.resolve();
  fake.pending.shift().resolve(png);
  assert.equal(await last, png);
  assert.equal(allocations, 1);
  assert.deepEqual(fake.sizes, [[320, 100]]);
  await surface.dispose();
  await surface.dispose();
  assert.equal(fake.disposed(), 1);
});

test('output mode changes release the old context before allocating another', async () => {
  const order = [];
  const surface = new SharedPosterSurface((options) => {
    order.push(['create', options.forceLdr]);
    return {
      capture: async () => new Blob(['PNG']),
      resize: () => assert.fail('same size'),
      dispose: () => order.push(['dispose']),
    };
  });
  await surface.capture(design, 0, options);
  await surface.capture(design, 0, { ...options, forceLdr: true });
  assert.deepEqual(order, [['create', false], ['dispose'], ['create', true]]);
  await surface.dispose();
});

test('public blob captures select developed time and validate dimensions and empty sequences', async (t) => {
  const calls = [];
  const png = new Blob(['PNG']);
  t.mock.method(SharedPosterSurface.prototype, 'capture', async (...args) => {
    calls.push(args);
    return png;
  });
  assert.equal(await poster(null, design, options), png);
  assert.equal(calls[0][1], developedTime(design));
  assert.equal(calls[0][2].width, 160);
  await poster(null, design, { shots: [{ design, t0: 4 }], t: 0 });
  assert.equal(calls[1][1], 0);
  await poster(null, design, { shots: [{ design, t0: 4 }] });
  assert.equal(calls[2][1], 4 + developedTime(design));
  await assert.rejects(poster(null, design, { width: NaN }), /dimensions/);
  await assert.rejects(poster(null, design, { t: -1 }), /time/);
  await assert.rejects(poster(null, design, { t: Infinity }), /time/);
  await assert.rejects(poster(null, design, { shots: [] }), /empty/);
  await assert.rejects(
    posterAll({ querySelectorAll: () => [{ dataset: { poster: 'invalid' } }] }),
    /Unknown poster/,
  );
  await disposePosters();
});

test('public canvas batches copy encoded pixels in DOM order without leaking bitmaps', async (t) => {
  const calls = [];
  const png = new Blob(['PNG']);
  t.mock.method(SharedPosterSurface.prototype, 'capture', async (design, time, options) => {
    calls.push({ kind: design.kind, framing: options.framing });
    return png;
  });
  let closed = 0;
  const original = globalThis.createImageBitmap;
  globalThis.createImageBitmap = async () => ({
    width: 160,
    height: 100,
    close() {
      closed++;
    },
  });
  t.after(() => {
    if (original === undefined) delete globalThis.createImageBitmap;
    else globalThis.createImageBitmap = original;
  });
  const copied = [];
  const canvases = ['peony', 'comet', 'skyRocket'].map((key) => ({
    dataset: { poster: key },
    getBoundingClientRect: () => ({ width: 160, height: 100 }),
    getContext: () => ({ drawImage: () => copied.push(key) }),
  }));
  await posterAll({ querySelectorAll: () => canvases });
  assert.deepEqual(
    calls.map(({ kind }) => kind),
    ['shell', 'comet', 'shell'],
  );
  assert.equal(calls[2].framing.position[1], 1.7);
  assert.deepEqual(copied, ['peony', 'comet', 'skyRocket']);
  assert.equal(closed, 3);
  assert.deepEqual(
    canvases.map(({ width, height }) => [width, height]),
    [
      [160, 100],
      [160, 100],
      [160, 100],
    ],
  );
  await assert.rejects(
    poster({ getBoundingClientRect: () => ({}), getContext: () => null }, design),
    /2D canvas/,
  );
});

test('developed moments match prototype formulas for every kind without changing stored designs', () => {
  const before = structuredClone(effectTemplates);
  for (const entry of effectTemplates) {
    const resolved = resolveDesign(entry.design);
    const time = developedTime(entry.design);
    assert.ok(Number.isFinite(time) && time >= 0, entry.key);
    if (resolved.kind === 'shell' || resolved.kind === 'rocket') {
      const burst = resolved.breaks[0];
      const layer = burst?.layers[0];
      assert.equal(
        time,
        resolved.launch.time_s +
          (burst?.at_s ?? 0) +
          (layer?.delay_s ?? 0) +
          Math.min(1.2, (layer?.life_s ?? 0) * 0.42),
      );
    }
  }
  for (const [key, time] of [
    ['mine', 0.9],
    ['fountain', 2.2],
    ['wheel', 2.5],
    ['spinners', 2],
  ]) {
    assert.equal(developedTime(effectTemplates.find((entry) => entry.key === key).design), time);
  }
  const comet = reviewFixtureDesign('comet');
  assert.equal(developedTime(comet), comet.ground.comets.time_s * 0.8);
  comet.ground.comets.pattern = 'sequence';
  assert.equal(developedTime(comet), comet.ground.comets.time_s * 0.8 + 1);
  const adjusted = reviewFixtureDesign('peony');
  adjusted.adjustments = { 'launch.climb': 2 };
  assert.notEqual(developedTime(adjusted), developedTime(design));
  assert.equal(developedTime(adjusted), developedTime(resolveDesign(adjusted)));
  assert.deepEqual(effectTemplates, before);
});

test('shell posters tighten the burst while rockets retain audience-height climb framing', () => {
  const shell = posterFraming([{ design }], 1.6, 45);
  assert.equal(shell.target[1], design.launch.height_m);
  const narrow = posterFraming([{ design }], 1, 45);
  assert.ok(narrow.position[2] > shell.position[2]);
  const rocket = { ...structuredClone(design), kind: 'rocket' };
  assert.equal(posterFraming([{ design: rocket }], 1.6, 45).position[1], 1.7);
});

test('a stalled encoder releases its surface and the next queued capture can finish', async () => {
  const stalled = fakeSurface();
  const recovered = fakeSurface();
  let allocations = 0;
  const surface = new SharedPosterSurface(
    () => (++allocations === 1 ? stalled.rig : recovered.rig),
    5,
  );
  const first = surface.capture(design, 1, options);
  const next = surface.capture(design, 2, options);
  await assert.rejects(first, /timed out/);
  assert.equal(stalled.disposed(), 1);
  await Promise.resolve();
  assert.equal(recovered.pending.length, 1);
  const png = new Blob(['PNG']);
  recovered.pending.shift().resolve(png);
  assert.equal(await next, png);
  // Completing the old callback cannot alter the replacement surface.
  stalled.pending.shift().resolve(new Blob(['late PNG']));
  await surface.dispose();
  assert.equal(recovered.disposed(), 1);
});

test('identical posters share pending and completed captures, while changes and failures invalidate reuse', async () => {
  const fake = fakeSurface();
  const surface = new SharedPosterSurface(() => fake.rig);
  const first = surface.capture(design, 1, options);
  assert.equal(surface.capture(structuredClone(design), 1, { ...options }), first);
  await Promise.resolve();
  const blob = new Blob(['PNG']);
  fake.pending.shift().resolve(blob);
  await first;
  assert.equal(await surface.capture(design, 1, options), blob);
  assert.equal(fake.pending.length, 0);
  const failed = surface.capture(design, 2, options);
  const rejection = assert.rejects(failed, /failed/);
  await new Promise((resolve) => setImmediate(resolve));
  fake.pending.shift().reject(new Error('failed'));
  await rejection;
  const retry = surface.capture(design, 2, options);
  await Promise.resolve();
  assert.equal(fake.pending.length, 1);
  fake.pending.shift().resolve(blob);
  await retry;
  await surface.dispose();
  const afterDisposal = surface.capture(design, 1, options);
  await Promise.resolve();
  assert.equal(fake.pending.length, 1, 'disposal clears retained blobs');
  fake.pending.shift().resolve(blob);
  await afterDisposal;
});

test('poster reuse is bounded and changing appearance requires new pixels', async () => {
  const { SETTINGS } = await import('../src/view/settings.ts');
  const savedGround = SETTINGS.ground;
  const fake = fakeSurface();
  const surface = new SharedPosterSurface(() => fake.rig);
  const blob = new Blob(['PNG']);
  const finish = async (time) => {
    const capture = surface.capture(design, time, options);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(fake.pending.length, 1);
    fake.pending.shift().resolve(blob);
    await capture;
  };
  try {
    for (let time = 0; time < 33; time++) await finish(time);
    await finish(0); // Oldest poster has been evicted from the bounded working set.
    SETTINGS.ground = !savedGround;
    await finish(0);
    // Queued preferences must not leave pixels cached under the old appearance.
    const queued = surface.capture(design, 40, options);
    SETTINGS.ground = savedGround;
    await new Promise((resolve) => setImmediate(resolve));
    fake.pending.shift().resolve(blob);
    await queued;
    SETTINGS.ground = !savedGround;
    await finish(40);
  } finally {
    SETTINGS.ground = savedGround;
    await surface.dispose();
  }
});

test('empty backdrops use the shared serial poster surface without allocating another context', async () => {
  const original = SharedPosterSurface.prototype.capture;
  const blob = new Blob(['stage'], { type: 'image/png' });
  let calls = 0;
  SharedPosterSurface.prototype.capture = async (design, time, options) => {
    calls++;
    assert.equal(time, 0);
    assert.deepEqual(options.shots, []);
    assert.equal(options.width, 768);
    assert.equal(options.height, 960);
    return blob;
  };
  try {
    assert.equal(await stagePoster({ width: 768, height: 960 }), blob);
    assert.equal(calls, 1);
    assert.throws(() => stagePoster({ width: -1 }), /dimensions/);
  } finally {
    SharedPosterSurface.prototype.capture = original;
  }
});
