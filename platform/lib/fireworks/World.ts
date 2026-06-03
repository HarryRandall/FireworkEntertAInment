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
const GRID_TEXTURE_SIZE = 1024;

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

    this.groundTexture = createGroundTexture();
    const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 1, 1);
    const groundMat = new THREE.MeshBasicMaterial({
      map: this.groundTexture,
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

  ctx.fillStyle = '#03050a';
  ctx.fillRect(0, 0, GRID_TEXTURE_SIZE, GRID_TEXTURE_SIZE);

  drawGridLayer(ctx, 64, 'rgba(80, 98, 138, 0.4)', 1);
  drawGridLayer(ctx, 256, 'rgba(132, 154, 206, 0.54)', 2);

  const gradient = ctx.createRadialGradient(
    GRID_TEXTURE_SIZE / 2,
    GRID_TEXTURE_SIZE / 2,
    0,
    GRID_TEXTURE_SIZE / 2,
    GRID_TEXTURE_SIZE / 2,
    GRID_TEXTURE_SIZE / 2,
  );
  gradient.addColorStop(0, 'rgba(42, 52, 76, 0.4)');
  gradient.addColorStop(0.36, 'rgba(8, 12, 22, 0.08)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GRID_TEXTURE_SIZE, GRID_TEXTURE_SIZE);

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
