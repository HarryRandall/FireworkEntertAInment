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
const GRID_TEXTURE_SIZE = 1024;
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

export class World {
  group: THREE.Group;
  private mortarPositions: LaunchPosition[] = [];
  private groundTexture: THREE.Texture | null = null;
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

    this.groundTexture = createGroundTexture();
    const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 1, 1);
    const groundMat = new THREE.MeshBasicMaterial({
      map: this.groundTexture,
      transparent: true,
      depthWrite: true,
      toneMapped: false,
    });
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

    const mortarGeo = new THREE.CylinderGeometry(8, 8, 40, 16);
    const mortarMat = new THREE.MeshBasicMaterial({
      color: 0x7f8da8,
      toneMapped: false,
    });
    const mortars = new THREE.InstancedMesh(mortarGeo, mortarMat, this.mortarPositions.length);
    mortars.frustumCulled = false;

    const rimGeo = new THREE.TorusGeometry(8.2, 1.1, 8, 24);
    const rimMat = new THREE.MeshBasicMaterial({
      color: 0xb1c3dd,
      toneMapped: false,
    });
    const rims = new THREE.InstancedMesh(rimGeo, rimMat, this.mortarPositions.length);
    rims.frustumCulled = false;

    const transform = new THREE.Object3D();
    for (let i = 0; i < this.mortarPositions.length; i++) {
      const pos = this.mortarPositions[i];
      transform.position.set(pos.x, pos.y + 20, pos.z);
      transform.rotation.set(0, 0, 0);
      transform.scale.setScalar(1);
      transform.updateMatrix();
      mortars.setMatrixAt(i, transform.matrix);

      transform.position.set(pos.x, pos.y + 40.5, pos.z);
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
    this.groundTexture?.dispose();
    this.groundTexture = null;
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
    this.groundTexture?.dispose();
    this.group.parent?.remove(this.group);
  }
}

function createGroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = GRID_TEXTURE_SIZE;
  canvas.height = GRID_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create firework ground texture');

  const half = GRID_TEXTURE_SIZE / 2;

  // The texture is alpha-blended over the giant black base plane, so it only
  // carries the lit show area: a pale pool of light around the launch site
  // plus grid lines, all fading to fully transparent at the edges.
  ctx.clearRect(0, 0, GRID_TEXTURE_SIZE, GRID_TEXTURE_SIZE);

  const pool = ctx.createRadialGradient(half, half, 0, half, half, half * 0.62);
  pool.addColorStop(0, 'rgba(132, 150, 188, 0.32)');
  pool.addColorStop(0.45, 'rgba(86, 102, 140, 0.14)');
  pool.addColorStop(1, 'rgba(70, 84, 116, 0)');
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, GRID_TEXTURE_SIZE, GRID_TEXTURE_SIZE);

  drawMaskedGrid(ctx, half);

  // Erase toward the edges so the grid melts into the black floor instead of
  // ending at a visible rectangle.
  ctx.globalCompositeOperation = 'destination-out';
  const fade = ctx.createRadialGradient(half, half, 0, half, half, half);
  fade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  fade.addColorStop(0.45, 'rgba(0, 0, 0, 0.1)');
  fade.addColorStop(0.75, 'rgba(0, 0, 0, 0.72)');
  fade.addColorStop(0.95, 'rgba(0, 0, 0, 1)');
  fade.addColorStop(1, 'rgba(0, 0, 0, 1)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, GRID_TEXTURE_SIZE, GRID_TEXTURE_SIZE);
  ctx.globalCompositeOperation = 'source-over';

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  return texture;
}

function drawGridLayer(
  ctx: CanvasRenderingContext2D,
  step: number,
  color: string,
  width: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let i = 0; i <= GRID_TEXTURE_SIZE; i += step) {
    const p = i + 0.5;
    ctx.moveTo(p, 0);
    ctx.lineTo(p, GRID_TEXTURE_SIZE);
    ctx.moveTo(0, p);
    ctx.lineTo(GRID_TEXTURE_SIZE, p);
  }
  ctx.stroke();
}

function drawMaskedGrid(ctx: CanvasRenderingContext2D, half: number): void {
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = GRID_TEXTURE_SIZE;
  gridCanvas.height = GRID_TEXTURE_SIZE;
  const gridCtx = gridCanvas.getContext('2d');
  if (!gridCtx) throw new Error('Unable to create firework ground grid texture');

  drawGridLayer(gridCtx, 64, 'rgba(124, 146, 192, 0.5)', 1);
  drawGridLayer(gridCtx, 256, 'rgba(168, 188, 228, 0.66)', 2);

  // Keep grid pixels out of the transparent outer band before mipmaps are
  // generated, otherwise oblique views smear faint strokes into curved edge
  // artefacts around the floor.
  gridCtx.globalCompositeOperation = 'destination-in';
  const gridMask = gridCtx.createRadialGradient(half, half, 0, half, half, half * 0.82);
  gridMask.addColorStop(0, 'rgba(0, 0, 0, 1)');
  gridMask.addColorStop(0.58, 'rgba(0, 0, 0, 1)');
  gridMask.addColorStop(0.82, 'rgba(0, 0, 0, 0.2)');
  gridMask.addColorStop(1, 'rgba(0, 0, 0, 0)');
  gridCtx.fillStyle = gridMask;
  gridCtx.fillRect(0, 0, GRID_TEXTURE_SIZE, GRID_TEXTURE_SIZE);
  gridCtx.globalCompositeOperation = 'source-over';

  ctx.drawImage(gridCanvas, 0, 0);
}
