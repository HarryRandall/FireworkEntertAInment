/**
 * Static scene geometry: ground plane, mortar tubes, ambient props.
 *
 * Owns its own `THREE.Group` so the engine can attach/detach the world
 * without touching the global scene. Mortar positions come from the show's
 * launch positions so the visible tubes always match the cue tube indices.
 */
import * as THREE from 'three';
import type { LaunchPosition } from '@/lib/fireworks/design';

const MORTAR_TEXTURE_URL = '/textures/mortar.png';

export class World {
  group: THREE.Group;
  private mortarPositions: LaunchPosition[] = [];
  private texture: THREE.Texture | null = null;
  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];

  constructor(scene: THREE.Scene, positions: LaunchPosition[]) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.build(positions);
  }

  private build(positions: LaunchPosition[]): void {
    this.mortarPositions = positions.slice(0, 3);

    // Ground slab — large flat dark plane (no buildings).
    const groundGeo = new THREE.BoxGeometry(8000, 8000, 5);
    const groundMat = new THREE.MeshPhongMaterial({ color: 0x0a0d12 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.5;
    this.group.add(ground);
    this.geometries.push(groundGeo);
    this.materials.push(groundMat);

    // Subtle reference grid on the ground so the scene reads as a real
    // surface rather than a void. GridHelper is a single LineSegments
    // draw call — effectively free.
    const grid = new THREE.GridHelper(6000, 60, 0x6a7a9a, 0x394560);
    grid.position.y = 0.6;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.8;
    (grid.material as THREE.Material).depthWrite = false;
    this.group.add(grid);
    this.materials.push(grid.material as THREE.Material);
    this.geometries.push(grid.geometry);

    // Load mortar texture (cylinder body).
    this.texture = new THREE.TextureLoader().load(MORTAR_TEXTURE_URL);
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;

    for (const pos of this.mortarPositions) {
      this.addMortar(pos);
    }
  }

  private addMortar(pos: LaunchPosition): void {
    const cannonGeo = new THREE.CylinderGeometry(8, 8, 40, 32);
    const cannonMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      map: this.texture ?? undefined,
    });
    const cannon = new THREE.Mesh(cannonGeo, cannonMat);
    cannon.position.set(pos.x, pos.y + 15, pos.z);
    this.group.add(cannon);
    this.geometries.push(cannonGeo);
    this.materials.push(cannonMat);

    const baseGeo = new THREE.BoxGeometry(30, 30, 2);
    const baseMat = new THREE.MeshPhongMaterial({ color: 0x000000 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.rotation.x = -Math.PI / 2;
    base.position.set(pos.x, pos.y + 1, pos.z);
    this.group.add(base);
    this.geometries.push(baseGeo);
    this.materials.push(baseMat);
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
    this.texture?.dispose();
    this.group.parent?.remove(this.group);
  }
}
