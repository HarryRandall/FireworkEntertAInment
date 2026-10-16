/** A midnight (or Finale-style dusk) sky and ground lattice provide a shared world for every view. */
import * as THREE from 'three';

// Prototype scene dimensions in metres, and tessellation chosen for a smooth horizon.
const SKY_RADIUS_M = 1400;
const GROUND_RADIUS_M = 1350;
const SKY_SEGMENTS = 48;
const SKY_RINGS = 24;
const GROUND_SEGMENTS = 96;
const skyVertex =
  'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const skyFragment = `
// Visual tuning: dim linear RGB sky colours and elevation fade stops.
// Horizon band bounds are unit-sphere elevations, centred at the ground-sky boundary.
const vec3 VISUAL_TUNING_HORIZON_COLOUR = vec3(0.0020, 0.0040, 0.0100);
const vec3 VISUAL_TUNING_MID_SKY_COLOUR = vec3(0.0003, 0.0006, 0.0015);
const vec3 VISUAL_TUNING_OVERHEAD_COLOUR = vec3(0.0);
const float VISUAL_TUNING_HORIZON_START = -0.02;
const float VISUAL_TUNING_HORIZON_END = 0.10;
const float VISUAL_TUNING_OVERHEAD_START = 0.18;
const float VISUAL_TUNING_OVERHEAD_END = 0.72;
const float VISUAL_TUNING_HORIZON_BAND_CENTRE = 0.0;
const float VISUAL_TUNING_HORIZON_BAND_HALF_WIDTH = 0.035;
const vec3 VISUAL_TUNING_HORIZON_BAND_COLOUR = vec3(0.0035);
// Visual tuning: angular cells per unit direction, occupied fraction, linear RGB intensity.
const float VISUAL_TUNING_STAR_CELLS = 180.0;
const float VISUAL_TUNING_STAR_DENSITY = 0.003;
const float VISUAL_TUNING_STAR_INTENSITY = 0.055;
const float VISUAL_TUNING_STAR_RADIUS_CELLS = 0.055;
const float VISUAL_TUNING_STAR_MIN_ELEVATION = 0.025;
// Visual tuning: Finale 3D's default dusk, sampled from its viewport in sRGB and converted
// to linear RGB: red horizon glow (90,45,45), slate mid sky (35,45,65), navy zenith (15,20,30).
const vec3 VISUAL_TUNING_DUSK_HORIZON_COLOUR = vec3(0.100, 0.026, 0.026);
const vec3 VISUAL_TUNING_DUSK_MID_SKY_COLOUR = vec3(0.016, 0.026, 0.053);
const vec3 VISUAL_TUNING_DUSK_OVERHEAD_COLOUR = vec3(0.005, 0.007, 0.013);
varying vec3 vD; uniform float uDusk;
float starHash(vec2 cell){return fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);}
float starfield(vec3 direction){
  if(direction.y<VISUAL_TUNING_STAR_MIN_ELEVATION)return 0.0;
  vec2 angular=vec2(atan(direction.z,direction.x),asin(clamp(direction.y,-1.0,1.0)))*VISUAL_TUNING_STAR_CELLS;
  vec2 cell=floor(angular);
  float selected=step(1.0-VISUAL_TUNING_STAR_DENSITY,starHash(cell));
  if(selected==0.0)return 0.0;
  vec2 centre=vec2(starHash(cell+17.0),starHash(cell+43.0))*0.6+0.2;
  float distanceCells=length(fract(angular)-centre);
  float coverage=max(fwidth(distanceCells),0.001);
  float dotCoverage=1.0-smoothstep(VISUAL_TUNING_STAR_RADIUS_CELLS,VISUAL_TUNING_STAR_RADIUS_CELLS+coverage,distanceCells);
  return selected*dotCoverage*VISUAL_TUNING_STAR_INTENSITY*step(VISUAL_TUNING_STAR_MIN_ELEVATION,direction.y);
}
void main(){ vec3 horizon=mix(VISUAL_TUNING_HORIZON_COLOUR,VISUAL_TUNING_DUSK_HORIZON_COLOUR,uDusk); vec3 mid=mix(VISUAL_TUNING_MID_SKY_COLOUR,VISUAL_TUNING_DUSK_MID_SKY_COLOUR,uDusk); vec3 overhead=mix(VISUAL_TUNING_OVERHEAD_COLOUR,VISUAL_TUNING_DUSK_OVERHEAD_COLOUR,uDusk); vec3 c = mix(horizon,mid,smoothstep(VISUAL_TUNING_HORIZON_START,VISUAL_TUNING_HORIZON_END,vD.y)); c = mix(c,overhead,smoothstep(VISUAL_TUNING_OVERHEAD_START,VISUAL_TUNING_OVERHEAD_END,vD.y)); float horizonBand=1.0-smoothstep(0.0,VISUAL_TUNING_HORIZON_BAND_HALF_WIDTH,abs(vD.y-VISUAL_TUNING_HORIZON_BAND_CENTRE)); gl_FragColor = vec4(c+VISUAL_TUNING_HORIZON_BAND_COLOUR*horizonBand+vec3(starfield(normalize(vD)))*(1.0-uDusk),1.0); }`;
const groundVertex =
  'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const groundFragment = `
// Visual tuning: polar rings/spokes are measured from the launch origin in metres/degrees.
const float VISUAL_TUNING_RING_SPACING_M = 10.0;
const float VISUAL_TUNING_SPOKE_SPACING_DEG = 15.0;
const float VISUAL_TUNING_RADIANS_PER_DEGREE = 0.01745329252;
// Line width is expressed in screen pixels via derivative-sized world-metre coverage.
const float VISUAL_TUNING_LINE_WIDTH_PX = 0.85;
const float VISUAL_TUNING_GRID_FADE_START_M = 18.0;
const float VISUAL_TUNING_GRID_FADE_END_M = 150.0;
const vec3 VISUAL_TUNING_GROUND_COLOUR = vec3(0.0015);
const vec3 VISUAL_TUNING_GRID_COLOUR = vec3(0.018);
// Visual tuning: Finale 3D's dusk grass, sRGB (20,30,20) as linear RGB.
const vec3 VISUAL_TUNING_DUSK_GROUND_COLOUR = vec3(0.0037, 0.0089, 0.0037);
varying vec3 vW; uniform float uGrid; uniform float uDusk;
float polarLine(float distanceToLineM){float antialiasWidthM=max(fwidth(distanceToLineM)*VISUAL_TUNING_LINE_WIDTH_PX,0.00001);return 1.0-smoothstep(0.0,antialiasWidthM,distanceToLineM);}
void main(){float radiusM=length(vW.xz);float ringDistanceM=abs(fract(radiusM/VISUAL_TUNING_RING_SPACING_M+0.5)-0.5)*VISUAL_TUNING_RING_SPACING_M;float angleRad=atan(vW.z,vW.x);float spokePhase=angleRad/(VISUAL_TUNING_SPOKE_SPACING_DEG*VISUAL_TUNING_RADIANS_PER_DEGREE);float spokeDistanceM=abs(sin(spokePhase*3.14159265359))*radiusM;float polarGrid=max(polarLine(ringDistanceM),polarLine(spokeDistanceM));float horizonFade=1.0-smoothstep(VISUAL_TUNING_GRID_FADE_START_M,VISUAL_TUNING_GRID_FADE_END_M,radiusM);gl_FragColor=vec4(mix(VISUAL_TUNING_GROUND_COLOUR,VISUAL_TUNING_DUSK_GROUND_COLOUR,uDusk)+VISUAL_TUNING_GRID_COLOUR*polarGrid*horizonFade*uGrid,1.0);}`;

/** Creates the static world shared by the live viewer and detached poster renderer. */
export function makeWorld(scene: THREE.Scene) {
  // Shared by sky and ground: 0 for the midnight world, 1 for Finale-style dusk.
  const dusk = { value: 0 };
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(SKY_RADIUS_M, SKY_SEGMENTS, SKY_RINGS),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uDusk: dusk },
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
      }),
    ),
  );
  const groundUniforms = { uGrid: { value: 1 }, uDusk: dusk };
  const groundMaterial = new THREE.ShaderMaterial({
    uniforms: groundUniforms,
    vertexShader: groundVertex,
    fragmentShader: groundFragment,
  });
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(GROUND_RADIUS_M, GROUND_SEGMENTS),
    groundMaterial,
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  return {
    setSettings(showGround: boolean, duskSky = false) {
      groundUniforms.uGrid.value = showGround ? 1 : 0;
      dusk.value = duskSky ? 1 : 0;
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
