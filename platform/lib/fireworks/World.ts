/**
 * Static scene geometry: ground plane, mortar tubes, ambient props.
 *
 * Owns its own `THREE.Group` so the engine can attach/detach the world
 * without touching the global scene. Mortar positions come from the show's
 * launch positions so the visible tubes always match the cue tube indices.
 */
import * as THREE from 'three';
import type { LaunchPosition } from '@/lib/fireworks/design';

export type FireworkSceneMode = 'night' | 'day';

const GROUND_SIZE = 8000;
const HORIZON_GROUND_RADIUS = 28000;
const HORIZON_GROUND_SEGMENTS = 192;
const MINOR_GRID_STEP = 62.5;
const MAJOR_GRID_STEP = MINOR_GRID_STEP * 4;
const MINOR_GRID_LINE_WIDTH = 0.3;
const MAJOR_GRID_LINE_WIDTH = 0.55;
const SKY_RADIUS = 30000;
const STAR_COUNT = 620;
const STAR_RADIUS = SKY_RADIUS * 0.9;
const STAR_MIN_HEIGHT = 0.24;

function sceneModeToDaylight(sceneMode: FireworkSceneMode): number {
  return sceneMode === 'day' ? 1 : 0;
}

/** Small deterministic PRNG so the starfield is identical across rebuilds. */
function makeStarRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SKY_VERTEX_SHADER = /* glsl */ `
varying float vHeight;
varying float vSignedHeight;
varying vec3 vSkyDirection;

void main() {
  vSignedHeight = position.y / ${SKY_RADIUS.toFixed(1)};
  vHeight = clamp(vSignedHeight, 0.0, 1.0);
  vSkyDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
uniform float uDaylight;
varying float vHeight;
varying float vSignedHeight;
varying vec3 vSkyDirection;

void main() {
  // Dark-blue glow that holds almost full strength from the floor up to a low
  // band, then fades into the black night sky above. Downward it stays blue
  // right down to the ground with only a slight (~5%) dip at the very bottom,
  // so the colour meets the floor softly instead of being lifted off it.
  vec3 night = vec3(0.0, 0.0, 0.0);
  vec3 horizonGlow = vec3(0.013, 0.03, 0.08);
  // Above the band peak: gaussian fade up into black (keeps the good height).
  float up = max(vHeight - 0.105, 0.0) / 0.075;
  float upper = exp(-up * up);
  // Below the peak: hold the blue down to the floor, fading only ~5% at the base.
  float lower = mix(0.95, 1.0, smoothstep(0.0, 0.05, vHeight));
  float band = upper * lower;
  vec3 nightSky = mix(night, horizonGlow, band);
  vec3 dayBelowHorizon = vec3(0.018, 0.11, 0.22);
  vec3 dayHorizon = vec3(0.12, 0.34, 0.62);
  vec3 dayMid = vec3(0.06, 0.28, 0.62);
  vec3 dayZenith = vec3(0.008, 0.07, 0.26);
  vec3 daySky = mix(dayHorizon, dayMid, smoothstep(0.0, 0.38, vHeight));
  daySky = mix(daySky, dayZenith, smoothstep(0.24, 0.76, vHeight));
  daySky = mix(dayBelowHorizon, daySky, smoothstep(-0.04, 0.08, vSignedHeight));
  vec3 sunDirection = normalize(vec3(0.58, 0.68, -0.46));
  float sunAlignment = max(dot(normalize(vSkyDirection), sunDirection), 0.0);
  float sunHalo = pow(sunAlignment, 72.0);
  float sunCore = pow(sunAlignment, 420.0);
  vec3 sunGlow = vec3(1.0, 0.94, 0.76) * (sunHalo * 0.04 + sunCore * 0.14);
  daySky += sunGlow;
  vec3 sky = mix(nightSky, daySky, uDaylight);
  gl_FragColor = vec4(sky, 1.0);
}
`;

const STAR_VERTEX_SHADER = /* glsl */ `
attribute float aSize;
attribute float aBright;
varying float vBright;

void main() {
  vBright = aBright;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize;
}
`;

const STAR_FRAGMENT_SHADER = /* glsl */ `
varying float vBright;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float d = length(coord);
  if (d > 0.5) discard;
  float core = 1.0 - smoothstep(0.0, 0.5, d);
  float alpha = core * vBright;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(vec3(0.82, 0.88, 1.0), alpha);
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
uniform float uDaylight;
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

  vec3 nightColor = poolColor + gridColor;
  float nightAlpha = clamp((pool * 0.11 + centerGlow * 0.065) * edgeFade + gridAlpha, 0.0, 0.42);

  vec3 color = nightColor;
  float alpha = nightAlpha;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(color, alpha);
}
`;

const HORIZON_GROUND_FRAGMENT_SHADER = /* glsl */ `
uniform float uDaylight;
varying vec2 vWorldXZ;

void main() {
  float radial = length(vWorldXZ) / ${HORIZON_GROUND_RADIUS.toFixed(1)};
  float edgeFade = 1.0 - smoothstep(0.58, 1.0, radial);
  float centreHold = 1.0 - smoothstep(0.0, 0.34, radial);
  float feather = max(centreHold, pow(edgeFade, 1.45));
  float alpha = feather * 0.96;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
}
`;

export class World {
  group: THREE.Group;
  private mortarPositions: LaunchPosition[] = [];
  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private sceneMode: FireworkSceneMode;
  private skyMaterial: THREE.ShaderMaterial | null = null;
  private groundMaterial: THREE.ShaderMaterial | null = null;
  private horizonGroundMaterial: THREE.ShaderMaterial | null = null;
  private starfield: THREE.Points | null = null;

  constructor(
    scene: THREE.Scene,
    positions: LaunchPosition[],
    sceneMode: FireworkSceneMode = 'night',
  ) {
    this.group = new THREE.Group();
    this.sceneMode = sceneMode;
    scene.add(this.group);
    this.build(positions);
  }

  private build(positions: LaunchPosition[]): void {
    this.mortarPositions = positions.slice(0, 3);

    this.addSkyDome();
    this.addStarfield();

    // Soft circular horizon floor: it keeps the grid grounded while avoiding a
    // square edge against the sky at low camera angles.
    const horizonGeo = new THREE.CircleGeometry(HORIZON_GROUND_RADIUS, HORIZON_GROUND_SEGMENTS);
    const horizonMat = createHorizonGroundMaterial();
    const horizonGround = new THREE.Mesh(horizonGeo, horizonMat);
    this.horizonGroundMaterial = horizonMat;
    horizonGround.rotation.x = -Math.PI / 2;
    // Keep a real gap below the grid plane: at multi-thousand-unit view
    // distances the depth buffer cannot separate planes a fraction of a unit
    // apart, which showed up as flickering black z-fighting bars.
    horizonGround.position.y = -6;
    horizonGround.frustumCulled = false;
    this.group.add(horizonGround);
    this.geometries.push(horizonGeo);
    this.materials.push(horizonMat);

    const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 1, 1);
    const groundMat = createGroundMaterial();
    const ground = new THREE.Mesh(groundGeo, groundMat);
    this.groundMaterial = groundMat;
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    this.group.add(ground);
    this.geometries.push(groundGeo);
    this.materials.push(groundMat);

    this.addMortars();
    this.applySceneMode();
  }

  /** Navy gradient sky, black at the horizon rising to navy at the zenith. */
  private addSkyDome(): void {
    // Full sphere: elevated cameras can look well past the ground line, and a
    // dome that stops near the horizon leaves a visible rim against the clear
    // colour. Below the horizon the gradient is pure black anyway.
    const skyGeo = new THREE.SphereGeometry(SKY_RADIUS, 32, 24);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uDaylight: { value: 0 },
      },
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.frustumCulled = false;
    this.skyMaterial = skyMat;
    // Sort is disabled on the renderer, so the dome must be the first child
    // to draw behind the ground and particles.
    this.group.add(sky);
    this.geometries.push(skyGeo);
    this.materials.push(skyMat);
  }

  /**
   * Scattered pinprick stars across the upper sky. Positions are seeded so they
   * stay put across rebuilds, kept above the horizon so none sit on the ground,
   * and drawn additively behind the fireworks.
   */
  private addStarfield(): void {
    const rng = makeStarRng(0x5eed1e);
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const brightness = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      // Uniform `y` over a sphere gives an even spread per solid angle; clamp it
      // above the horizon so stars never appear below the ground line.
      const y = STAR_MIN_HEIGHT + rng() * (1 - STAR_MIN_HEIGHT);
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const azimuth = rng() * Math.PI * 2;
      positions[i * 3] = Math.cos(azimuth) * radius * STAR_RADIUS;
      positions[i * 3 + 1] = y * STAR_RADIUS;
      positions[i * 3 + 2] = Math.sin(azimuth) * radius * STAR_RADIUS;
      const sizeRoll = rng();
      // Square the roll so most stars are tiny and only a few are slightly larger.
      sizes[i] = 0.9 + sizeRoll * sizeRoll * 1.2;
      brightness[i] = 0.28 + rng() * 0.6;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    starGeo.setAttribute('aBright', new THREE.BufferAttribute(brightness, 1));

    const starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    });

    const stars = new THREE.Points(starGeo, starMat);
    stars.frustumCulled = false;
    this.starfield = stars;
    this.group.add(stars);
    this.geometries.push(starGeo);
    this.materials.push(starMat);
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
    this.skyMaterial = null;
    this.groundMaterial = null;
    this.horizonGroundMaterial = null;
    this.starfield = null;
    this.build(positions);
  }

  setSceneMode(sceneMode: FireworkSceneMode): void {
    this.sceneMode = sceneMode;
    this.applySceneMode();
  }

  private applySceneMode(): void {
    const daylight = sceneModeToDaylight(this.sceneMode);
    for (const material of [this.skyMaterial, this.groundMaterial, this.horizonGroundMaterial]) {
      if (material) material.uniforms.uDaylight.value = daylight;
    }
    if (this.starfield) this.starfield.visible = daylight < 0.5;
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
    uniforms: {
      uDaylight: { value: 0 },
    },
    vertexShader: GROUND_VERTEX_SHADER,
    fragmentShader: GROUND_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: true,
    fog: false,
    toneMapped: false,
  });
  material.userData.isGroundMaterial = true;
  return material;
}

function createHorizonGroundMaterial(): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uDaylight: { value: 0 },
    },
    vertexShader: GROUND_VERTEX_SHADER,
    fragmentShader: HORIZON_GROUND_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: true,
    fog: false,
    toneMapped: false,
  });
  material.userData.isHorizonGroundMaterial = true;
  return material;
}
