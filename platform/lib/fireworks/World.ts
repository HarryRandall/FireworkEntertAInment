import * as THREE from "three";
import type { LaunchPosition } from "@/lib/fireworks/design";

const MORTAR_TEXTURE_URL = "/textures/mortar.png";

/**
 * Smooth radial ground glow — computed per-fragment so it stays crisp
 * regardless of the plane's world-space size (no texture banding).
 */
function buildGroundGlowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColorInner: { value: new THREE.Color(0x6878a8) },
      uColorOuter: { value: new THREE.Color(0x10131c) },
      uIntensity: { value: 0.55 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform vec3 uColorInner;
      uniform vec3 uColorOuter;
      uniform float uIntensity;
      void main() {
        float d = length(vUv - vec2(0.5)) * 2.0;
        // smooth quartic falloff — no visible banding, no harsh edge
        float a = clamp(1.0 - d, 0.0, 1.0);
        a = a * a * (3.0 - 2.0 * a); // smoothstep
        a *= a;
        vec3 col = mix(uColorOuter, uColorInner, a);
        gl_FragColor = vec4(col * uIntensity, a);
      }
    `,
  });
}

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

    // Radial glow disc just above the ground, fading to transparent so
    // the world isn't pitch-black around the launch site. Procedural
    // shader instead of a stretched canvas texture (no banding).
    const glowGeo = new THREE.PlaneGeometry(3500, 3500, 1, 1);
    const glowMat = buildGroundGlowMaterial();
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.5;
    glow.renderOrder = -1;
    this.group.add(glow);
    this.geometries.push(glowGeo);
    this.materials.push(glowMat);

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
