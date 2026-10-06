/** Production transport and frame scheduling with deterministic clocks and stub output submission. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Viewer } from '../src/view/viewer.ts';
import { ParticleLayers } from '../src/view/buffers.ts';
import { GpuSprays } from '../src/view/gpu-sprays.ts';
import { StageControls } from '../src/view/stage-controls.ts';
import { FrameTimes } from '../src/view/frame-times.ts';
import { SOURCE_SCALARS, SOURCE_COMPONENTS } from '../src/view/source-layout.ts';
import { entries } from './support/review-catalogue.ts';
import { framingFor } from '../src/sim/framing.ts';
import { makeWorld, disposeTree } from '../src/view/world.ts';
import { makeProps } from '../src/view/props.ts';
import { ViewerSound } from '../src/view/sound/scheduler.ts';

// Replay instants are show seconds; RAF timestamps below are wall-clock milliseconds.
const SHOW_TIME_S = 2.2;

test('static world uses a midnight sky, static stars above the horizon and the polar grid', () => {
  const scene = new THREE.Scene();
  const world = makeWorld(scene);
  const [sky, ground] = scene.children;
  assert.equal(scene.children.length, 2, 'the static world contains only sky and ground');
  assert.equal(sky.type, 'Mesh');
  assert.equal(ground.type, 'Mesh');
  assert.match(sky.material.fragmentShader, /VISUAL_TUNING_HORIZON_COLOUR/);
  assert.match(sky.material.fragmentShader, /VISUAL_TUNING_HORIZON_BAND_HALF_WIDTH/);
  assert.match(sky.material.fragmentShader, /VISUAL_TUNING_OVERHEAD_COLOUR/);
  assert.match(sky.material.fragmentShader, /vec3\(0.0020, 0.0040, 0.0100\)/);
  assert.match(sky.material.fragmentShader, /step\(VISUAL_TUNING_STAR_MIN_ELEVATION,direction.y\)/);
  assert.doesNotMatch(sky.material.fragmentShader, /uniform.*time/);
  assert.equal(
    scene.children.some((child) => child.isPoints),
    false,
    'stars share the sky pass',
  );
  assert.match(ground.material.fragmentShader, /VISUAL_TUNING_RING_SPACING_M/);
  assert.match(ground.material.fragmentShader, /VISUAL_TUNING_SPOKE_SPACING_DEG/);
  assert.match(ground.material.fragmentShader, /fwidth\(distanceToLineM\)/);
  assert.doesNotMatch(ground.material.fragmentShader, /DOT_/);
  world.setSettings(false);
  assert.equal(ground.material.uniforms.uGrid.value, 0, 'the polar grid remains user-toggleable');
  disposeTree(scene);
});

test('wheel live viewer seek replay preserves every render input at 2.2 seconds', () => {
  const saved = {
    window: globalThis.window,
    document: globalThis.document,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  const callbacks = new Map();
  let nextId = 1;
  let draws = 0;
  const snapshot = () => ({
    camera: {
      matrix: camera.matrix.toArray(),
      world: camera.matrixWorld.toArray(),
      inverse: camera.matrixWorldInverse.toArray(),
      projection: camera.projectionMatrix.toArray(),
      projectionInverse: camera.projectionMatrixInverse.toArray(),
    },
    layers: renderObjects.map((object) => ({
      visible: object.visible,
      renderOrder: object.renderOrder,
      matrix: object.matrixWorld.toArray(),
      range: { ...object.geometry.drawRange },
      count: object.geometry.instanceCount,
      attributes: Object.fromEntries(
        Object.entries(object.geometry.attributes).map(([name, attribute]) => {
          const count = attribute.updateRanges[0]?.count ?? attribute.array.length;
          return [name, Array.from(attribute.array.slice(0, count))];
        }),
      ),
      uniforms: Object.fromEntries(
        Object.entries(object.material.uniforms ?? {}).map(([name, uniform]) => {
          const value = uniform.value;
          if (!value?.isTexture) return [name, value];
          const image = value.image;
          const count =
            name === 'uSources'
              ? sprays.sources.sources * SOURCE_SCALARS
              : name === 'uSourceClocks'
                ? sprays.sources.sources * SOURCE_COMPONENTS
                : image.data.length;
          return [
            name,
            {
              width: image.width,
              height: image.height,
              data: Array.from(image.data.slice(0, count)),
            },
          ];
        }),
      ),
    })),
    sourceData: Array.from(sprays.sources.data.slice(0, sprays.sources.sources * SOURCE_SCALARS)),
    sourceClocks: Array.from(
      sprays.sources.clocks.slice(0, sprays.sources.sources * SOURCE_COMPONENTS),
    ),
    sourceCount: sprays.sources.count,
  });
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  globalThis.document = { hidden: false };
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    callbacks.delete(id);
  };
  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 4000);
  const controls = new StageControls(camera, new EventTarget(), () => {});
  const design = entries.find((entry) => entry.key === 'wheel').design;
  camera.aspect = 390 / 844;
  camera.updateProjectionMatrix();
  controls.frame(framingFor([{ design }], false, camera.aspect, camera.fov), true);
  const layers = new ParticleLayers();
  const sprays = new GpuSprays(layers.uniforms);
  const scene = new THREE.Scene();
  const world = makeWorld(scene);
  scene.add(layers.group, sprays.points, makeProps([{ design }], 'mortar'));
  const renderObjects = [];
  scene.traverse((object) => {
    if (object.geometry) renderObjects.push(object);
  });
  const sound = new ViewerSound();
  sound.setShots([{ design }]);
  const viewer = Object.create(Viewer.prototype);
  Object.assign(viewer, {
    disposed: false,
    onScreen: true,
    raf: 0,
    dirty: false,
    playing: true,
    cameraMoving: true,
    last: 1000,
    t: SHOW_TIME_S,
    duration: 30,
    speed: 1,
    options: {},
    shots: [{ design }],
    listeners: new Set(),
    controls,
    camera,
    shake: [],
    shakeOffset: [0, 0, 0],
    cameraPosition: [0, 0, 0],
    layers,
    gpuSprays: sprays,
    sprayMode: 'gpu',
    sound,
    profiler: { waiting: false, requested: false, poll: () => false },
    frameTimes: new FrameTimes(),
    count: 0,
    fillMs: 0,
    frameMs: 0,
    renderer: { domElement: { dataset: {} } },
    scene,
    output: {
      render() {
        scene.updateMatrixWorld();
        camera.updateMatrixWorld();
        draws++;
      },
    },
    // Invoke the production frame method, replacing only the bound constructor callback.
    frame: (now) => viewer.drawFrame(now),
  });
  try {
    viewer.schedule();
    const queued = viewer.raf;
    assert.equal(callbacks.size, 1);
    assert.equal(viewer.renderer.domElement.dataset.drawnTime, undefined);
    viewer.pause();
    assert.equal(viewer.playing, false);
    assert.equal(viewer.t, SHOW_TIME_S);
    assert.equal(callbacks.has(queued), false, 'queued playing callback is cancelled');
    assert.equal(callbacks.size, 1, 'one paused draw replaces it');
    const runFrame = (now) => {
      const [id, callback] = callbacks.entries().next().value;
      callbacks.delete(id);
      callback(now);
    };
    runFrame(2000);
    assert.equal(draws, 1);
    assert.equal(viewer.t, SHOW_TIME_S);
    assert.equal(viewer.renderer.domElement.dataset.drawnTime, SHOW_TIME_S.toFixed(6));
    assert.equal(callbacks.size, 0, 'no idle RAF or GPU draws after the paused frame');
    assert.equal(viewer.liveDrawPending, false);
    assert.ok(sprays.sources.sources > 0, 'wheel must evaluate GPU spray records');
    const firstFrame = snapshot();
    viewer.seek(0.5);
    runFrame(2500);
    assert.notDeepEqual(
      snapshot(),
      firstFrame,
      'the intermediate seek must evaluate another frame',
    );
    viewer.seek(SHOW_TIME_S);
    runFrame(3000);
    assert.deepEqual(
      snapshot(),
      firstFrame,
      'every submitted wheel render input must replay exactly',
    );
    assert.equal(callbacks.size, 0);
  } finally {
    layers.dispose();
    sprays.dispose();
    controls.dispose();
    sound.dispose();
    disposeTree(scene);
    Object.assign(globalThis, saved);
  }
});
