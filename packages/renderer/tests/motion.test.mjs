/** Motion policy tests use the real developed-frame sampling without allocating WebGL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { observeMotionPreference, representativeTime } from '../src/view/motion.ts';
import { reviewFixtureDesign } from '../src/fixtures/index.ts';

for (const reduced of [false, true]) {
  test(`initial motion preference ${reduced} selects autoplay and a representative still`, () => {
    const saved = globalThis.window;
    const media = new EventTarget();
    media.matches = reduced;
    globalThis.window = { matchMedia: () => media };
    const viewer = {
      options: {},
      shots: [{ design: reviewFixtureDesign('peony'), t0: 3 }],
      duration: 20,
      pause() {
        this.playing = false;
      },
      seek(time) {
        this.t = time;
      },
    };
    try {
      const cleanup = observeMotionPreference(viewer);
      assert.equal(viewer.playing, !reduced);
      assert.equal(viewer.t, reduced ? representativeTime(viewer.shots) : 0);
      assert.ok(representativeTime(viewer.shots) > 3);
      // Explicit play is allowed, then enabling the preference cancels it.
      viewer.playing = true;
      media.matches = true;
      media.dispatchEvent(new Event('change'));
      assert.equal(viewer.playing, false);
      assert.equal(viewer.t, representativeTime(viewer.shots));
      media.matches = false;
      media.dispatchEvent(new Event('change'));
      assert.equal(viewer.playing, false, 'changing preference does not restart playback');
      cleanup();
      viewer.playing = true;
      media.matches = true;
      media.dispatchEvent(new Event('change'));
      assert.equal(viewer.playing, true, 'disposed viewers no longer receive changes');
      assert.equal(representativeTime([]), 0);
    } finally {
      globalThis.window = saved;
    }
  });
}

test('explicit start time and disabled autoplay survive the motion policy', () => {
  const saved = globalThis.window;
  const media = new EventTarget();
  media.matches = true;
  globalThis.window = { matchMedia: () => media };
  try {
    const viewer = { options: { startAt: 5, autoplay: false }, duration: 10, shots: [] };
    observeMotionPreference(viewer)();
    assert.equal(viewer.t, 5);
    assert.equal(viewer.playing, false);
  } finally {
    globalThis.window = saved;
  }
});
