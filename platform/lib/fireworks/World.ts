import * as THREE from "three";
import type { LaunchPosition } from "@/lib/fireworks/design";

const MORTAR_TEXTURE_URL = "/textures/mortar.png";

/** Soft radial gradient — white at centre, transparent at edge. */
function buildGroundGlowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  grad.addColorStop(0, "rgba(80, 90, 120, 0.55)");
  grad.addColorStop(0.45, "rgba(40, 45, 70, 0.25)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class World {
  group: THREE.Group;
  private mortarPositions: LaunchPosition[] = [];
  private texture: THREE.Texture | null = null;
  private glowTexture: THREE.Texture | null = null;
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

    // Radial glow disc just above the ground, fading to transparent so
    // the world isn't pitch-black around the launch site.
    if (typeof document !== "undefined") {
      this.glowTexture = buildGroundGlowTexture();
      const glowGeo = new THREE.PlaneGeometry(3500, 3500);
      const glowMat = new THREE.MeshBasicMaterial({
        map: this.glowTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.5;
      this.group.add(glow);
      this.geometries.push(glowGeo);
      this.materials.push(glowMat);
    }

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
    this.glowTexture?.dispose();
    this.group.parent?.remove(this.group);
  }
}
