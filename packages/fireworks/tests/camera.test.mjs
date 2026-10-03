/** Audience framing, gesture maths and acoustic shake are testable without WebGL or a browser. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera } from 'three';
import { framingFor, EYE_HEIGHT_M } from '../src/sim/framing.ts';
import { StageControls } from '../src/view/stage-controls.ts';
import { effectTemplates } from '../src/templates/index.ts';
const template = (key) => effectTemplates.find((entry) => entry.key === key).design;
const peony = template('peony');
class Surface extends EventTarget {
  setPointerCapture() {}
}
function pointer(surface, type, options = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, {
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    button: 0,
    shiftKey: false,
    ...options,
  });
  surface.dispatchEvent(event);
  return event;
}
function settle(controls) {
  let moving = true;
  for (let frame = 1; frame <= 120; frame++)
    moving = controls.update(performance.now() + frame * 100);
  assert.equal(moving, false, 'easing eventually stops requesting frames');
}
function rig() {
  const camera = new PerspectiveCamera(45, 1.6, 0.5, 4000);
  const surface = new Surface();
  let invalidations = 0;
  const controls = new StageControls(camera, surface, () => invalidations++);
  controls.frame(framingFor([{ design: peony }]), true);
  return { camera, controls, surface, invalidations: () => invalidations };
}
test('orbit, wheel and touch pinch wake paused rendering and never lower the eye underground', () => {
  const { camera, controls, surface, invalidations } = rig();
  const initial = camera.position.clone();
  pointer(surface, 'pointerdown');
  pointer(surface, 'pointermove', { clientX: 80, clientY: -500 });
  pointer(surface, 'pointerup');
  settle(controls);
  assert.notEqual(camera.position.x, initial.x);
  assert.ok(camera.position.y >= EYE_HEIGHT_M);
  const beforeZoom = camera.position.clone();
  const wheel = pointer(surface, 'wheel', { deltaY: -300, deltaMode: 0 });
  assert.equal(wheel.defaultPrevented, true);
  settle(controls);
  assert.ok(camera.position.distanceTo(beforeZoom) > 1);
  assert.ok(
    Math.abs(camera.position.y - EYE_HEIGHT_M) < 1e-5,
    'ground zoom keeps audience eye height',
  );
  const beforePinch = camera.position.clone();
  pointer(surface, 'pointerdown', { pointerId: 10, clientX: 0 });
  pointer(surface, 'pointerdown', { pointerId: 11, clientX: 100 });
  pointer(surface, 'pointermove', { pointerId: 11, clientX: 160 });
  pointer(surface, 'pointercancel', { pointerId: 10 });
  pointer(surface, 'pointerup', { pointerId: 11 });
  settle(controls);
  assert.ok(camera.position.distanceTo(beforePinch) > 1);
  assert.ok(invalidations() >= 4);
  controls.dispose();
});
test('free pan, reset, disabled controls and disposal preserve their boundaries', () => {
  const { camera, controls, surface, invalidations } = rig();
  const original = camera.position.clone();
  controls.setFree(true);
  pointer(surface, 'pointerdown', { shiftKey: true });
  pointer(surface, 'pointermove', { clientX: 100, clientY: 50 });
  pointer(surface, 'pointerup');
  settle(controls);
  assert.ok(camera.position.distanceTo(original) > 1);
  controls.frame(framingFor([{ design: peony }]), true);
  assert.ok(camera.position.distanceTo(original) < 1e-9);
  assert.equal(controls.touched, false);
  controls.enabled = false;
  const count = invalidations();
  pointer(surface, 'pointerdown');
  pointer(surface, 'pointermove', { clientX: 40 });
  pointer(surface, 'wheel', { deltaY: -200, deltaMode: 0 });
  assert.equal(invalidations(), count);
  controls.dispose();
  controls.enabled = true;
  pointer(surface, 'wheel', { deltaY: -200, deltaMode: 0 });
  assert.equal(invalidations(), count);
});
