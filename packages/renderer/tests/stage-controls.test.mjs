/** Browser-free regression checks for shared zoom gestures and burst frustum framing. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  StageControls,
  CLOSE_ORBIT_SPHERE_MARGIN,
  FAR_SCALE,
  FREE_FAR,
  MIN_ORBIT_DISTANCE_SCALE,
  PINCH_ZOOM_RESPONSE,
  SINGLE_FIREWORK_START_PITCH_DEG,
  WHEEL_ZOOM_PER_PIXEL,
} from '../src/view/stage-controls.ts';
import { framingFor, EYE_HEIGHT_M } from '../src/sim/framing.ts';
import { effectTemplates } from '../src/templates/index.ts';

function rig(shots, aspect = 1.6) {
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 10000);
  const element = new EventTarget();
  element.setPointerCapture = () => {};
  const controls = new StageControls(camera, element, () => {});
  const framing = framingFor(shots, false, aspect, camera.fov);
  controls.frame(framing, true);
  let now = performance.now();
  const settle = () => {
    for (let i = 0; i < 160; i++) controls.update((now += 100));
  };
  return { camera, controls, framing, element, settle };
}
const shots = [{ design: effectTemplates.find((e) => e.key === 'peony').design }];
const vector = (v) => new THREE.Vector3(...v);
const inside = (camera, point, label) => {
  const ndc = vector(point).project(camera);
  assert.ok(
    Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && Math.abs(ndc.z) <= 1,
    `${label}: ${ndc.toArray()}`,
  );
};
const event = (element, name, fields) => {
  const e = new Event(name, { cancelable: true });
  Object.assign(e, fields);
  element.dispatchEvent(e);
};

test('normal and free zoom-out limits restore the framed-distance caps', () => {
  const r = rig(shots);
  try {
    const base = vector(r.framing.position).distanceTo(vector(r.framing.target));
    for (const [free, factor] of [
      [false, FAR_SCALE],
      [true, FREE_FAR],
    ]) {
      r.controls.setFree(free);
      r.controls.zoom(1000);
      r.settle();
      assert.ok(
        Math.abs(r.camera.position.distanceTo(vector(r.framing.target)) - base * factor) < 1e-6,
      );
      inside(r.camera, [0, 105, 0], 'tallest authored ceiling');
      inside(r.camera, [52, 48, 0], 'widest mine');
    }
  } finally {
    r.controls.dispose();
  }
});

test('framed and farthest starts preserve the target and pitch, and reset to their selected start', () => {
  for (const [startDistance, factor] of [
    ['framed', 1],
    ['farthest', FAR_SCALE],
  ]) {
    const r = rig(shots);
    try {
      r.controls.frame(r.framing, true, startDistance);
      const target = vector(r.framing.target);
      const initialDirection = r.camera.position.clone().sub(target).normalize();
      const base = vector(r.framing.position).distanceTo(target);
      assert.ok(Math.abs(r.camera.position.distanceTo(target) - base * factor) < 1e-6);

      r.controls.zoom(0.2);
      r.settle();
      r.controls.frame(r.framing, true, startDistance);
      assert.ok(Math.abs(r.camera.position.distanceTo(target) - base * factor) < 1e-6);
      assert.ok(
        r.camera.position.clone().sub(target).normalize().distanceTo(initialDirection) < 1e-10,
      );
    } finally {
      r.controls.dispose();
    }
  }
});

test('the elevated single-firework start uses the furthest normal distance and restores its pose', () => {
  const r = rig(shots);
  try {
    const target = vector(r.framing.target);
    const base = vector(r.framing.position).distanceTo(target);
    r.controls.frame(r.framing, true, 'elevated');
    const pose = r.camera.position.clone().sub(target);
    assert.ok(Math.abs(pose.length() - base * FAR_SCALE) < 1e-6);
    assert.ok(
      Math.abs(
        Math.asin(pose.y / pose.length()) - (SINGLE_FIREWORK_START_PITCH_DEG * Math.PI) / 180,
      ) < 1e-10,
    );
    assert.deepEqual(r.controls.target.toArray(), r.framing.target);

    r.controls.zoom(0.2);
    r.settle();
    r.controls.frame(r.framing, true, 'elevated');
    const resetPose = r.camera.position.clone().sub(target);
    assert.ok(Math.abs(resetPose.length() - base * FAR_SCALE) < 1e-6);
    assert.ok(
      Math.abs(
        Math.asin(resetPose.y / resetPose.length()) -
          (SINGLE_FIREWORK_START_PITCH_DEG * Math.PI) / 180,
      ) < 1e-10,
    );
  } finally {
    r.controls.dispose();
  }
});

test('zoom is a straight dolly that preserves target, pitch and yaw', () => {
  for (const entry of effectTemplates.filter((e) => e.design.kind === 'shell')) {
    for (const aspect of [1.6, 390 / 844]) {
      for (const free of [false, true]) {
        const r = rig([{ design: entry.design }], aspect);
        try {
          const initialPosition = r.camera.position.clone();
          const target = vector(r.framing.target);
          const initialGoal = { ...r.controls.goal };
          r.controls.setFree(free);
          r.controls.zoom(0.0001);
          r.settle();
          assert.deepEqual(r.controls.target.toArray(), r.framing.target);
          assert.equal(r.controls.goal.yaw, initialGoal.yaw);
          assert.equal(r.controls.goal.pitch, initialGoal.pitch);
          assert.ok(
            r.camera.position
              .clone()
              .sub(target)
              .normalize()
              .distanceTo(initialPosition.sub(target).normalize()) < 1e-10,
          );
          const base = vector(r.framing.position).distanceTo(target);
          const minimum = Math.max(
            base * (free ? 0.15 : MIN_ORBIT_DISTANCE_SCALE),
            r.framing.focus.radius_m * CLOSE_ORBIT_SPHERE_MARGIN,
          );
          assert.ok(Math.abs(r.camera.position.distanceTo(target) - minimum) < 1e-6);
          assert.ok(r.camera.position.y >= EYE_HEIGHT_M);
        } finally {
          r.controls.dispose();
        }
      }
    }
  }
});

test('wheel, pinch and UI zoom use the faster visual-tuning response', () => {
  const poses = [];
  for (const gesture of ['button', 'wheel', 'pinch']) {
    const r = rig(shots);
    try {
      if (gesture === 'button') r.controls.zoom(0.0001);
      if (gesture === 'wheel') event(r.element, 'wheel', { deltaY: -10000, deltaMode: 0 });
      if (gesture === 'pinch') {
        event(r.element, 'pointerdown', { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
        event(r.element, 'pointerdown', { pointerId: 2, clientX: 1, clientY: 0, button: 0 });
        event(r.element, 'pointermove', { pointerId: 2, clientX: 10000, clientY: 0 });
      }
      r.settle();
      poses.push([...r.camera.position.toArray(), ...r.camera.quaternion.toArray()]);
    } finally {
      r.controls.dispose();
    }
  }
  assert.deepEqual(poses[0], poses[1]);
  assert.deepEqual(poses[0], poses[2]);

  const r = rig(shots);
  try {
    const base = r.controls.goal.dist;
    event(r.element, 'wheel', { deltaY: -100, deltaMode: 0 });
    assert.equal(r.controls.goal.dist, base * Math.exp(-100 * WHEEL_ZOOM_PER_PIXEL));
    event(r.element, 'pointerdown', { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
    event(r.element, 'pointerdown', { pointerId: 2, clientX: 100, clientY: 0, button: 0 });
    event(r.element, 'pointermove', { pointerId: 2, clientX: 120, clientY: 0 });
    assert.equal(
      r.controls.goal.dist,
      base * Math.exp(-100 * WHEEL_ZOOM_PER_PIXEL) * 1.2 ** -PINCH_ZOOM_RESPONSE,
    );
  } finally {
    r.controls.dispose();
  }
});

test('ground clamp survives close zoom, downward orbit and free pan', () => {
  const r = rig(shots);
  try {
    r.controls.setFree(true);
    r.controls.zoom(0.0001);
    event(r.element, 'pointerdown', { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
    event(r.element, 'pointermove', { pointerId: 1, clientX: 0, clientY: -10000 });
    r.settle();
    assert.ok(r.camera.position.y >= EYE_HEIGHT_M);
    event(r.element, 'pointerup', { pointerId: 1 });
    event(r.element, 'pointerdown', { pointerId: 2, clientX: 0, clientY: 0, button: 2 });
    event(r.element, 'pointermove', { pointerId: 2, clientX: 0, clientY: 10000 });
    r.settle();
    assert.ok(r.camera.position.y >= EYE_HEIGHT_M);
  } finally {
    r.controls.dispose();
  }
});

test('close zoom remains outside each single-shot spherical burst margin', () => {
  const rocket = structuredClone(shots[0].design);
  rocket.kind = 'rocket';
  for (const design of [
    ...effectTemplates.filter((e) => e.design.kind !== 'shell').map((e) => e.design),
    rocket,
  ]) {
    for (const free of [false, true]) {
      const r = rig([{ design }]);
      try {
        r.controls.setFree(free);
        r.controls.zoom(0.0001);
        r.settle();
        const { target, radius_m, spherical } = r.framing.focus;
        if (spherical)
          assert.ok(
            r.camera.position.distanceTo(vector(target)) >= radius_m * CLOSE_ORBIT_SPHERE_MARGIN,
          );
        assert.ok(r.camera.position.y >= EYE_HEIGHT_M);
      } finally {
        r.controls.dispose();
      }
    }
  }
});

test('a scene larger than its original framing preserves its close safety floor without widening normal zoom-out', () => {
  const r = rig(shots);
  try {
    r.controls.frame(
      {
        position: [0, EYE_HEIGHT_M, 100],
        target: [0, 60, 0],
        focus: { target: [0, 60, 0], radius_m: 200, spherical: true },
      },
      true,
    );
    r.controls.zoom(0.0001);
    r.settle();
    const base = vector([0, EYE_HEIGHT_M, 100]).distanceTo(vector([0, 60, 0]));
    const near = r.camera.position.distanceTo(vector([0, 60, 0]));
    for (const [free, scale] of [
      [false, FAR_SCALE],
      [true, FREE_FAR],
    ]) {
      r.controls.setFree(free);
      r.controls.zoom(1000);
      r.settle();
      assert.ok(r.camera.position.toArray().every(Number.isFinite));
      const far = r.camera.position.distanceTo(vector([0, 60, 0]));
      assert.ok(Math.abs(far - Math.max(base * scale, near)) < 1e-6);
    }
  } finally {
    r.controls.dispose();
  }
});
