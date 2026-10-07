/** Launch hardware anchors metre-space firing positions to the ground. */
import * as THREE from 'three';
import { resolveDesign } from '../schema/index';
import type { Shot } from './types';
import { batchProps } from './prop-batch';

// Prototype cake geometry, in metres: five rows, tube spacing and lid height.
const CAKE_ROWS = 5;
const CAKE_SPACING_M = 0.4;
export const CAKE_TOP_M = 1.17;
/** Cake footprint width in metres, shared by show staging. */
export const CAKE_WIDTH_M = 2.2;
const CAKE_HEIGHT_M = 1.1;
const LID_WIDTH_M = 2.25;
const LID_DEPTH_M = 0.08;
const LID_CENTRE_M = 1.12;
// Prototype tube geometry in metres, with mesh segment counts for rounded hardware.
const TUBE_TOP_RADIUS_M = 0.34;
const TUBE_BASE_RADIUS_M = 0.4;
const TUBE_HEIGHT_M = 1.8;
const LIP_RADIUS_M = 0.06;
const FOOT_RADIUS_M = 0.7;
const FOOT_HEIGHT_M = 0.1;
const HOLE_RADIUS_M = 0.16;
const POST_TOP_RADIUS_M = 0.08;
const POST_BASE_RADIUS_M = 0.1;
const ROUND_SEGMENTS = 20;
const LIP_SEGMENTS = 8;
const HOLE_SEGMENTS = 16;
const POST_SEGMENTS = 10;
const HALF_TURN_DEG = 180;
// Prototype hardware palette, expressed as sRGB material colours.
const DARK = 0x1b1f28;
const RIM = 0x2c3240;
const BOX = 0x3a1618;
const LID = 0x5a2226;
const HOLE = 0x0a0b0e;

/** Computes horizontal [x,z] metres for a cake tube index, wrapping every 25 shots. */
export function cakeHole(index: number): readonly [number, number] {
  const centre = (CAKE_ROWS - 1) / 2;
  return [
    ((index % CAKE_ROWS) - centre) * CAKE_SPACING_M,
    ((Math.floor(index / CAKE_ROWS) % CAKE_ROWS) - centre) * CAKE_SPACING_M,
  ];
}

/** Builds mixed show hardware, retaining the single origin cake for editor previews. */
export function makeProps(shots: readonly Shot[], kind: 'mortar' | 'cake'): THREE.Group {
  const group = new THREE.Group();
  const dark = new THREE.MeshBasicMaterial({ color: DARK });
  const rim = new THREE.MeshBasicMaterial({ color: RIM });
  if (kind === 'cake') {
    fillCake(group);
    dark.dispose();
    rim.dispose();
    return batchProps(group);
  }

  const seen = new Set<string>();
  addShowCakes(group, shots);
  const mortarShots = shots.filter((entry) => entry.hardware !== 'cake');
  for (const shot of mortarShots) {
    const design = resolveDesign(shot.design);
    const [x, z] = shot.position ?? [0, 0];
    if (design.kind === 'fountain' || design.kind === 'spinner') continue;
    if (design.kind === 'wheel') {
      const height = design.ground.wheel.height_m;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(POST_TOP_RADIUS_M, POST_BASE_RADIUS_M, height, POST_SEGMENTS),
        dark,
      );
      post.position.set(x, height / 2, z);
      group.add(post);
      continue;
    }
    const key = `mortar:${String(x)}:${String(z)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const tube = makeMortar(dark, rim);
    tube.position.set(x, 0, z);
    tube.rotation.x = forwardTilt(shot);
    tube.rotation.z = -((design.launch?.tilt_deg ?? 0) * Math.PI) / HALF_TURN_DEG;
    group.add(tube);
  }
  disposeUnusedHardwareMaterials(group, mortarShots, dark, rim);
  return batchProps(group);
}

function addShowCakes(group: THREE.Group, shots: readonly Shot[]): void {
  const seen = new Set<string>();
  for (const shot of shots) {
    if (shot.hardware !== 'cake') continue;
    const [x, z] = shot.hardwarePosition ?? shot.position ?? [0, 0];
    const key = `${String(x)}:${String(z)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cake = new THREE.Group();
    fillCake(cake);
    cake.position.set(x, 0, z);
    group.add(cake);
  }
}

function fillCake(group: THREE.Group): void {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(CAKE_WIDTH_M, CAKE_HEIGHT_M, CAKE_WIDTH_M),
    new THREE.MeshBasicMaterial({ color: BOX }),
  );
  box.position.y = CAKE_HEIGHT_M / 2;
  group.add(box);
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(LID_WIDTH_M, LID_DEPTH_M, LID_WIDTH_M),
    new THREE.MeshBasicMaterial({ color: LID }),
  );
  lid.position.y = LID_CENTRE_M;
  group.add(lid);
  const geometry = new THREE.CircleGeometry(HOLE_RADIUS_M, HOLE_SEGMENTS);
  const material = new THREE.MeshBasicMaterial({ color: HOLE });
  for (let i = 0; i < CAKE_ROWS * CAKE_ROWS; i++) {
    const hole = new THREE.Mesh(geometry, material);
    const [x, z] = cakeHole(i);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(x, CAKE_TOP_M, z);
    group.add(hole);
  }
}
function makeMortar(dark: THREE.Material, rim: THREE.Material): THREE.Group {
  const tube = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(
      TUBE_TOP_RADIUS_M,
      TUBE_BASE_RADIUS_M,
      TUBE_HEIGHT_M,
      ROUND_SEGMENTS,
    ),
    dark,
  );
  body.position.y = TUBE_HEIGHT_M / 2;
  tube.add(body);
  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(TUBE_TOP_RADIUS_M, LIP_RADIUS_M, LIP_SEGMENTS, ROUND_SEGMENTS),
    rim,
  );
  lip.rotation.x = Math.PI / 2;
  lip.position.y = TUBE_HEIGHT_M;
  tube.add(lip);
  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(FOOT_RADIUS_M, FOOT_RADIUS_M, FOOT_HEIGHT_M, ROUND_SEGMENTS),
    rim,
  );
  foot.position.y = FOOT_HEIGHT_M / 2;
  tube.add(foot);

  return tube;
}

function disposeUnusedHardwareMaterials(
  group: THREE.Group,
  shots: readonly Shot[],
  dark: THREE.Material,
  rim: THREE.Material,
): void {
  // Unused materials have no mesh owner to release them during scene disposal.
  if (shots.length === 0) {
    dark.dispose();
    rim.dispose();
  } else if (group.children.length === 0) {
    dark.dispose();
    rim.dispose();
  } else if (
    shots.every(
      (shot) =>
        shot.design.kind === 'wheel' ||
        shot.design.kind === 'fountain' ||
        shot.design.kind === 'spinner',
    )
  )
    rim.dispose();
}

function forwardTilt(shot: Shot): number {
  return ((shot.tilt_deg ?? 0) * Math.PI) / HALF_TURN_DEG;
}
