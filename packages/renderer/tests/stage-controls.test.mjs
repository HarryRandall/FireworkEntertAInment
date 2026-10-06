/** Browser-free regression checks for shared zoom gestures and burst frustum framing. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { StageControls, NORMAL_FAR_SCALE, FREE_FAR_SCALE } from '../src/view/stage-controls.ts';
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

test('normal and free zoom-out limits give four and eight framed distances', () => {
  const r = rig(shots);
  try {
    const base = vector(r.framing.position).distanceTo(vector(r.framing.target));
    for (const [free, factor] of [
      [false, NORMAL_FAR_SCALE],
      [true, FREE_FAR_SCALE],
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

test('closest normal and free views fit every aerial burst in landscape and portrait', () => {
  for (const entry of effectTemplates.filter((e) => e.design.kind === 'shell')) {
    for (const aspect of [1.6, 390 / 844]) {
      for (const free of [false, true]) {
        const r = rig([{ design: entry.design }], aspect);
        try {
          const initialPosition = r.camera.position.clone();
          const initialQuaternion = r.camera.quaternion.clone();
          r.controls.setFree(free);
          r.controls.zoom(0.0001);
          r.settle();
          const centre = r.framing.focus.target;
          const radius = r.framing.focus.radius_m;
          for (const [dx, dy, dz] of [
            [0, radius, 0],
            [0, -radius, 0],
            [radius, 0, 0],
            [-radius, 0, 0],
            [0, 0, radius],
          ])
            inside(
              r.camera,
              [centre[0] + dx, centre[1] + dy, centre[2] + dz],
              `${entry.key} free=${free}`,
            );
          assert.ok(r.camera.position.y >= EYE_HEIGHT_M);
          assert.ok(
            r.camera.position.y > EYE_HEIGHT_M,
            'close-up raises the eye towards the burst',
          );
          assert.ok(r.camera.position.z < initialPosition.z, 'zoom in moves closer');
          r.controls.zoom(
            vector(r.framing.position).distanceTo(vector(r.framing.target)) /
              r.camera.position.distanceTo(vector(centre)),
          );
          r.settle();
          assert.ok(
            r.camera.position.distanceTo(initialPosition) < 1e-5,
            'framed position unchanged',
          );
          assert.ok(
            r.camera.quaternion.angleTo(initialQuaternion) < 1e-5,
            'framed pitch unchanged',
          );
        } finally {
          r.controls.dispose();
        }
      }
    }
  }
});

test('wheel, pinch and UI zoom share the same minimum fit', () => {
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

test('ground extent tops and rocket aliases remain visible at the closest zoom', () => {
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
        const { target, radius_m } = r.framing.focus;
        inside(r.camera, [target[0], target[1] + radius_m, target[2]], `${design.kind} top`);
        assert.ok(r.camera.position.y >= EYE_HEIGHT_M);
      } finally {
        r.controls.dispose();
      }
    }
  }
});

test('a scene larger than its original framing still has a finite zoom-out range', () => {
  const r = rig(shots);
  try {
    r.controls.frame(
      {
        position: [0, EYE_HEIGHT_M, 100],
        target: [0, 30, 0],
        focus: { target: [0, 60, 0], radius_m: 200, spherical: true },
      },
      true,
    );
    r.controls.zoom(0.0001);
    r.settle();
    const near = r.camera.position.distanceTo(vector([0, 60, 0]));
    for (const [free, scale] of [
      [false, NORMAL_FAR_SCALE],
      [true, FREE_FAR_SCALE],
    ]) {
      r.controls.setFree(free);
      r.controls.zoom(1000);
      r.settle();
      assert.ok(r.camera.position.toArray().every(Number.isFinite));
      const far = r.camera.position.distanceTo(vector([0, 60, 0]));
      assert.ok(Math.abs(far / near - scale) < 1e-6);
      inside(r.camera, [0, 260, 0], 'large scene top');
    }
  } finally {
    r.controls.dispose();
  }
});
