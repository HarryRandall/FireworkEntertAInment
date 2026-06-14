/**
 * Static scene geometry: ground plane, mortar tubes, ambient props.
 *
 * Owns its own `THREE.Group` so the engine can attach/detach the world
 * without touching the global scene. Mortar positions come from the show's
 * launch positions so the visible tubes always match the cue tube indices.
 */
import * as THREE from 'three';
import type { LaunchPosition } from '@/lib/fireworks/design';

const GROUND_SIZE = 8000;
const BASE_GROUND_SIZE = 40000;
const MINOR_GRID_STEP = 62.5;
const MAJOR_GRID_STEP = MINOR_GRID_STEP * 4;
const MINOR_GRID_LINE_WIDTH = 0.3;
const MAJOR_GRID_LINE_WIDTH = 0.55;
const SKY_RADIUS = 30000;

const SKY_VERTEX_SHADER = /* glsl */ `
varying float vHeight;

void main() {
  vHeight = clamp(position.y / ${SKY_RADIUS.toFixed(1)}, 0.0, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
varying float vHeight;

void main() {
  // Pure black at and below the ground line (so the floor melts seamlessly
  // into the distance) fading steadily up into night-time navy at the zenith.
  vec3 horizon = vec3(0.0, 0.0, 0.0);
  vec3 mid = vec3(0.012, 0.024, 0.068);
  vec3 zenith = vec3(0.024, 0.048, 0.125);
  vec3 sky = mix(horizon, mid, smoothstep(0.0, 0.45, vHeight));
  sky = mix(sky, zenith, smoothstep(0.45, 1.0, vHeight));
  gl_FragColor = vec4(sky, 1.0);
}
`;

const GROUND_VERTEX_SHADER = /* glsl */ `
varying vec2 vWorldXZ;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldXZ = worldPosition.xz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const GROUND_FRAGMENT_SHADER = /* glsl */ `
varying vec2 vWorldXZ;

float gridLine(vec2 coord, float step, float width) {
  vec2 wrapped = abs(mod(coord + step * 0.5, step) - step * 0.5);
  float distanceToLine = min(wrapped.x, wrapped.y);
  float aa = max(min(fwidth(coord.x), fwidth(coord.y)) * 1.15, 1.0);
  return 1.0 - smoothstep(width, width + aa, distanceToLine);
}

void main() {
  float radial = length(vWorldXZ) / ${(GROUND_SIZE / 2).toFixed(1)};
  float pool = 1.0 - smoothstep(0.0, 0.62, radial);
  float centerGlow = pow(1.0 - smoothstep(0.0, 0.32, radial), 1.35);
  float gridFade = 1.0 - smoothstep(0.58, 0.94, radial);
  float edgeFade = 1.0 - smoothstep(0.82, 1.0, radial);

  float minorLine = gridLine(vWorldXZ, ${MINOR_GRID_STEP.toFixed(1)}, ${MINOR_GRID_LINE_WIDTH.toFixed(1)});
  float majorLine = gridLine(vWorldXZ, ${MAJOR_GRID_STEP.toFixed(1)}, ${MAJOR_GRID_LINE_WIDTH.toFixed(1)});
  float minorOnly = minorLine * (1.0 - majorLine);
  float gridAlpha = (minorOnly * 0.05 + majorLine * 0.11) * gridFade;

  vec3 poolColor = vec3(0.31, 0.32, 0.34) * (pool * 0.15 + centerGlow * 0.09);
  vec3 minorColor = vec3(0.37, 0.39, 0.42) * minorOnly * 0.52;
  vec3 majorColor = vec3(0.58, 0.6, 0.64) * majorLine;
  vec3 gridColor = (minorColor * 0.22 + majorColor * 0.24) * gridFade;

  float alpha = clamp((pool * 0.11 + centerGlow * 0.065) * edgeFade + gridAlpha, 0.0, 0.42);
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(poolColor + gridColor, alpha);
}
`;

export class World {
  group: THREE.Group;
  private mortarPositions: LaunchPosition[] = [];
  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];

  constructor(scene: THREE.Scene, positions: LaunchPosition[]) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.build(positions);
  }

  private build(positions: LaunchPosition[]): void {
    this.mortarPositions = positions.slice(0, 3);

    this.addSkyDome();

    // Giant matte-black base plane: the world floor runs out to the horizon
    // in black, so the gridded show area never reads as a floating rectangle.
    const baseGeo = new THREE.PlaneGeometry(BASE_GROUND_SIZE, BASE_GROUND_SIZE, 1, 1);
    // Pure black to match the sky gradient at the ground line, so the plane
    // edge never reads against the horizon.
    const baseMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      depthWrite: true,
      toneMapped: false,
    });
    const basePlane = new THREE.Mesh(baseGeo, baseMat);
    basePlane.rotation.x = -Math.PI / 2;
    // Keep a real gap below the grid plane: at multi-thousand-unit view
    // distances the depth buffer cannot separate planes a fraction of a unit
    // apart, which showed up as flickering black z-fighting bars.
    basePlane.position.y = -6;
    basePlane.frustumCulled = false;
    this.group.add(basePlane);
    this.geometries.push(baseGeo);
    this.materials.push(baseMat);

    const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 1, 1);
    const groundMat = createGroundMaterial();
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    this.group.add(ground);
    this.geometries.push(groundGeo);
    this.materials.push(groundMat);

    this.addMortars();
  }

  /** Navy gradient sky, black at the horizon rising to navy at the zenith. */
  private addSkyDome(): void {
    // Full sphere: elevated cameras can look well past the ground line, and a
    // dome that stops near the horizon leaves a visible rim against the clear
    // colour. Below the horizon the gradient is pure black anyway.
    const skyGeo = new THREE.SphereGeometry(SKY_RADIUS, 32, 24);
    const skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.frustumCulled = false;
    // Sort is disabled on the renderer, so the dome must be the first child
    // to draw behind the ground and particles.
    this.group.add(sky);
    this.geometries.push(skyGeo);
    this.materials.push(skyMat);
  }

  private addMortars(): void {
    if (this.mortarPositions.length === 0) return;

    const mortarGeo = new THREE.CylinderGeometry(5.5, 5.5, 28, 16);
    const mortarMat = new THREE.MeshBasicMaterial({
      color: 0xaeb3bb,
      toneMapped: false,
    });
    const mortars = new THREE.InstancedMesh(mortarGeo, mortarMat, this.mortarPositions.length);
    mortars.frustumCulled = false;

    const rimGeo = new THREE.TorusGeometry(5.7, 0.75, 8, 24);
    const rimMat = new THREE.MeshBasicMaterial({
      color: 0xc3c8d0,
      toneMapped: false,
    });
    const rims = new THREE.InstancedMesh(rimGeo, rimMat, this.mortarPositions.length);
    rims.frustumCulled = false;

    const transform = new THREE.Object3D();
    for (let i = 0; i < this.mortarPositions.length; i++) {
      const pos = this.mortarPositions[i];
      transform.position.set(pos.x, pos.y + 14, pos.z);
      transform.rotation.set(0, 0, 0);
      transform.scale.setScalar(1);
      transform.updateMatrix();
      mortars.setMatrixAt(i, transform.matrix);

      transform.position.set(pos.x, pos.y + 28.5, pos.z);
      transform.rotation.set(Math.PI / 2, 0, 0);
      transform.updateMatrix();
      rims.setMatrixAt(i, transform.matrix);
    }
    mortars.instanceMatrix.needsUpdate = true;
    rims.instanceMatrix.needsUpdate = true;

    this.group.add(mortars, rims);
    this.geometries.push(mortarGeo, rimGeo);
    this.materials.push(mortarMat, rimMat);
  }

  rebuild(positions: LaunchPosition[]): void {
    while (this.group.children.length) {
      this.group.remove(this.group.children[0]);
    }
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.geometries.length = 0;
    this.materials.length = 0;
    this.build(positions);
  }

  getLaunchPosition(index: number): LaunchPosition {
    const idx = Math.max(0, Math.min(2, Math.floor(index)));
    return this.mortarPositions[idx] ?? this.mortarPositions[0];
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.group.parent?.remove(this.group);
  }
}

function createGroundMaterial(): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    vertexShader: GROUND_VERTEX_SHADER,
    fragmentShader: GROUND_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: true,
    fog: false,
    toneMapped: false,
  });
  return material;
}
