/** Independent planar-outline geometry and CPU/GPU trajectory packing checks. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { directions } from '../src/sim/directions.ts';
import { starPos } from '../src/sim/motion.ts';
import { reviewFixtureDesign } from '../src/fixtures/index.ts';
import { packTrajectory } from '../src/view/source-trajectory.ts';
import { SOURCE_SCALARS, SOURCE_COMPONENTS, sourceLane } from '../src/view/source-layout.ts';

const EPSILON = 1e-12;
const close = (a, b) => assert.ok(Math.abs(a - b) < EPSILON, `${a} != ${b}`);
const point = (q) => [q.x * q.radius, q.y * q.radius, q.z * q.radius];
for (const pattern of ['bowtie', 'star']) {
  test(`${pattern}: exact counts, unit vectors, tilted planarity and deterministic samples`, () => {
    for (const count of [0, 1, 2, 3, 64, 101]) {
      for (const tilt of [-2, -0.7, 0, 0.4, 1, 2]) {
        const samples = directions(count, pattern, 137, tilt);
        assert.equal(samples.length, count);
        assert.deepEqual(samples, directions(count, pattern, 137, tilt));
        const flat = directions(count, pattern, 137);
        samples.forEach((q, i) => {
          close(Math.hypot(q.x, q.y, q.z), 1);
          close(q.z * Math.cos((tilt * Math.PI) / 2) - q.y * Math.sin((tilt * Math.PI) / 2), 0);
          close(q.x, flat[i].x);
          close(q.radius, flat[i].radius);
          assert.ok(q.radius > 0 && q.radius <= 1 + EPSILON);
        });
      }
    }
    const a = directions(64, pattern, 137);
    const b = directions(64, pattern, 138);
    assert.notDeepEqual(
      a.map((q) => q.h),
      b.map((q) => q.h),
    );
    assert.deepEqual(a.map(point), b.map(point));
  });

  test(`${pattern}: outline travel honours speed variation in CPU and GPU source controls`, () => {
    const design = reviewFixtureDesign('peony');
    const layer = design.breaks[0].layers[0];
    layer.pattern = pattern;
    layer.gravity_m_s2 = 0;
    layer.tilt = 0.4;
    const age = 0.7;
    for (const speedVar of [0, 0.3, 1]) {
      layer.speed_var = speedVar;
      for (const direction of directions(21, pattern, 137, layer.tilt)) {
        const reach = layer.radius_m * direction.radius * (1 - speedVar + speedVar * direction.h);
        const distance = reach * (1 - Math.exp(-layer.drag_per_s * age));
        const position = starPos(layer, direction, age, [0, 0, 0]);
        close(Math.hypot(...position), distance);
        const data = new Float32Array(SOURCE_SCALARS);
        packTrajectory(data, 0, {
          kind: 'star',
          layer,
          direction,
          centre: [0, 0, 0],
          fade: design.breaks[0].fade,
          life: layer.life_s,
          fading: true,
        });
        assert.equal(data[sourceLane.travel * SOURCE_COMPONENTS], Math.fround(reach));
        assert.deepEqual(
          Array.from(
            data.slice(
              sourceLane.starDirection * SOURCE_COMPONENTS,
              sourceLane.starDirection * SOURCE_COMPONENTS + 3,
            ),
          ),
          [direction.x, direction.y, direction.z].map(Math.fround),
        );
      }
    }
  });
}

test('bowtie: balanced opposed lobes and equal arc spacing without a vertical fan', () => {
  const samples = directions(65, 'bowtie', 137);
  assert.equal(samples.filter((q) => q.x > 0).length, 33);
  assert.equal(samples.filter((q) => q.x < 0).length, 32);
  for (const lobe of [samples.slice(0, 33), samples.slice(33)]) {
    const angles = lobe.map((q) => Math.atan2(q.y, Math.abs(q.x)));
    const gap = angles[1] - angles[0];
    angles.forEach((angle, i) => {
      assert.ok(Math.abs(angle) < Math.PI / 6);
      if (i) close(angle - angles[i - 1], gap);
      close(lobe[i].radius, 1);
    });
    close(angles[0], -angles.at(-1));
  }
});

test('star: five upward-oriented tips, inner vertices and equal spacing on all ten edges', () => {
  const samples = directions(100, 'star', 137).map(point);
  const vertices = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 ? 0.44 : 1;
    const angle = Math.PI / 2 + (i * Math.PI) / 5;
    return [radius * Math.cos(angle), radius * Math.sin(angle)];
  });
  close(samples[0][0], 0);
  close(samples[0][1], 1);
  const edgeLength = Math.hypot(vertices[1][0] - vertices[0][0], vertices[1][1] - vertices[0][1]);
  samples.forEach((p, i) => {
    const edge = Math.floor(i / 10);
    const mix = (i % 10) / 10;
    const a = vertices[edge],
      b = vertices[(edge + 1) % 10];
    close(p[0], a[0] + (b[0] - a[0]) * mix);
    close(p[1], a[1] + (b[1] - a[1]) * mix);
    close(
      Math.hypot(p[0] - samples[(i + 1) % 100][0], p[1] - samples[(i + 1) % 100][1]),
      edgeLength / 10,
    );
  });
});
