/** Night sky, fixed stars and ground provide a shared world for every firework view. */
import * as THREE from 'three';

// Prototype scene dimensions in metres, and tessellation chosen for a smooth horizon.
const SKY_RADIUS_M = 1400;
const STAR_RADIUS_M = 1300;
const GROUND_RADIUS_M = 1350;
const SKY_SEGMENTS = 48;
const SKY_RINGS = 24;
const GROUND_SEGMENTS = 96;
// Prototype starfield count, seed and magnitude exponent (dimensionless visual tuning).
const STAR_COUNT = 1300;
const STAR_SEED = 20260930;
const MAGNITUDE_POWER = 6;
// Prototype star horizon cutoff, normalised unit-sphere height.
const STAR_MIN_ELEVATION = 0.06;
// Prototype thumbnail scaling: full sky detail at 820 CSS pixels, minimum scale 0.35.
const STAR_REFERENCE_HEIGHT_PX = 820;
const STAR_MIN_SCALE = 0.35;
// Packed star positions and colours each have three scalar components.
const VECTOR_COMPONENTS = 3;
// Prototype Mulberry32 starfield sequence: unsigned 32-bit arithmetic constants and shifts.
const RANDOM_INCREMENT = 0x6d2b79f5;
const RANDOM_MIX = 61;
const UINT32_RANGE = 4294967296;
const MIX_SHIFT_A = 15;
const MIX_SHIFT_B = 7;
const MIX_SHIFT_C = 14;
const skyVertex =
  'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const skyFragment = `
// Prototype linear RGB sky palette and elevation bands, in unit sphere heights.
const vec3 GROUND = vec3(0.0009,0.0010,0.0014);
const vec3 HORIZON = vec3(0.0012,0.0032,0.0100);
const vec3 MID = vec3(0.0008,0.0013,0.0034);
const vec3 TOP = vec3(0.0002,0.0003,0.0009);
const float HORIZON_LOW = -0.01, HORIZON_HIGH = 0.03, MID_HIGH = 0.18, TOP_HIGH = 0.7;
varying vec3 vD;
void main(){ vec3 c = mix(GROUND,HORIZON,smoothstep(HORIZON_LOW,HORIZON_HIGH,vD.y)); c = mix(c,MID,smoothstep(HORIZON_HIGH,MID_HIGH,vD.y)); c = mix(c,TOP,smoothstep(MID_HIGH,TOP_HIGH,vD.y)); gl_FragColor = vec4(c,1.0); }`;
const groundVertex =
  'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const groundFragment = `
// Prototype grid intervals and fade distances in metres; palette is linear RGB.
const float FINE_M = 5.0, COARSE_M = 25.0, FADE_START_M = 15.0, FADE_END_M = 140.0;
const float FINE_FADE_START_M = 20.0, FINE_FADE_END_M = 60.0;
const float FINE_GAIN = 0.3, COARSE_GAIN = 0.9;
const vec3 BASE = vec3(0.0022,0.0024,0.0032), GRID = vec3(0.005,0.008,0.014);
varying vec3 vW; uniform float uGrid;
float line(vec2 p,float s){vec2 q=p/s;vec2 g=abs(fract(q-0.5)-0.5)/fwidth(q);return 1.0-min(min(g.x,g.y),1.0);}
void main(){float d=length(vW.xz);float fade=1.0-smoothstep(FADE_START_M,FADE_END_M,d);float g=max(line(vW.xz,FINE_M)*FINE_GAIN*(1.0-smoothstep(FINE_FADE_START_M,FINE_FADE_END_M,d)),line(vW.xz,COARSE_M)*COARSE_GAIN);gl_FragColor=vec4(BASE+GRID*g*fade*uGrid,1.0);}`;
const starVertex = `
// Prototype star size, in CSS pixels, and magnitude gain (normalised).
const float BASE_PX = 0.8, MAG_GAIN_PX = 1.4;
attribute float mag; uniform float uDpr; uniform float uView; varying float vM;
void main(){vM=mag*uView;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=max(1.0,(BASE_PX+mag*MAG_GAIN_PX)*uDpr*uView);}`;
const starFragment = `
// Prototype soft star edge radius, linear RGB tint and normalised brightness.
const float EDGE = 0.4, BASE = 0.03, GAIN = 0.42;
const vec3 TINT = vec3(0.55,0.6,0.75);
varying float vM;void main(){vec2 c=gl_PointCoord*2.0-1.0;float a=1.0-smoothstep(EDGE,1.0,length(c));gl_FragColor=vec4(TINT*(BASE+vM*GAIN)*a,a);}`;

/** Creates the static world and returns its starfield uniforms for viewport scaling. */
export function makeWorld(scene: THREE.Scene) {
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(SKY_RADIUS_M, SKY_SEGMENTS, SKY_RINGS),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
      }),
    ),
  );
  const { stars, uniforms } = makeStars();
  scene.add(stars);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(GROUND_RADIUS_M, GROUND_SEGMENTS),
    new THREE.ShaderMaterial({
      uniforms: { uGrid: { value: 1 } },
      vertexShader: groundVertex,
      fragmentShader: groundFragment,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  return {
    setSettings(showStars: boolean, showGrid: boolean) {
      stars.visible = showStars;
      ground.material.uniforms.uGrid = { value: showGrid ? 1 : 0 };
    },
    resize(height: number, dpr: number) {
      uniforms.uDpr.value = dpr;
      uniforms.uView.value = Math.max(
        STAR_MIN_SCALE,
        Math.min(1, height / STAR_REFERENCE_HEIGHT_PX),
      );
    },
  };
}

/** Releases geometries and materials in a scene subtree, once per shared resource. */
export function disposeTree(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
      const geometry: unknown = object.geometry;
      if (!(geometry instanceof THREE.BufferGeometry))
        throw new TypeError('Drawable geometry must be a buffer geometry');
      geometries.add(geometry as THREE.BufferGeometry);
      const material: unknown = object.material;
      const ownedMaterials: unknown[] = Array.isArray(material) ? material : [material];
      for (const owned of ownedMaterials) {
        if (!(owned instanceof THREE.Material))
          throw new TypeError('Drawable material must be a Three material');
        materials.add(owned as THREE.Material);
      }
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

function makeStars() {
  const positions = new Float32Array(STAR_COUNT * VECTOR_COMPONENTS);
  const magnitudes = new Float32Array(STAR_COUNT);
  let seed = STAR_SEED;
  const random = () => {
    seed = (seed + RANDOM_INCREMENT) | 0;
    let value = Math.imul(seed ^ (seed >>> MIX_SHIFT_A), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> MIX_SHIFT_B), RANDOM_MIX | value)) ^ value;
    return ((value ^ (value >>> MIX_SHIFT_C)) >>> 0) / UINT32_RANGE;
  };
  for (let i = 0; i < STAR_COUNT; i++) {
    const elevation = STAR_MIN_ELEVATION + random() * (1 - STAR_MIN_ELEVATION);
    const azimuth = random() * Math.PI * 2;
    const radius = Math.sqrt(1 - elevation * elevation);
    positions.set(
      [
        radius * Math.cos(azimuth) * STAR_RADIUS_M,
        elevation * STAR_RADIUS_M,
        radius * Math.sin(azimuth) * STAR_RADIUS_M,
      ],
      i * VECTOR_COMPONENTS,
    );
    magnitudes[i] = random() ** MAGNITUDE_POWER;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, VECTOR_COMPONENTS));
  geometry.setAttribute('mag', new THREE.BufferAttribute(magnitudes, 1));
  const uniforms = { uDpr: { value: 1 }, uView: { value: 1 } };
  const stars = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms,
      vertexShader: starVertex,
      fragmentShader: starFragment,
    }),
  );
  stars.frustumCulled = false;

  return { stars, uniforms };
}
