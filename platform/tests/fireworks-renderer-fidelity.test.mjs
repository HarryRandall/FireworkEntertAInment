/** Static-analysis "grep the source" test guarding the fireworks renderer fidelity invariants (do not modify test bodies). */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('firework replay compiles variants, raw spec_json, and cache-busts old shapes', () => {
  const engine = read('lib/fireworks/FireworksEngine.ts');
  const showMappers = read('lib/shows/mappers.ts');
  const showTypes = read('lib/shows/types.ts');
  const showDomain = read('lib/show-domain.ts');
  const importJobs = read('lib/import-jobs.ts');

  assert.match(
    engine,
    /cue\.firework\.renderDesign \?\? compileFireworkDesign\(\{ legacySpec: cue\.firework\.rawSpec \}\)/,
  );
  assert.match(showMappers, /rawSpec: row\.spec_json/);
  assert.match(showMappers, /mapFireworkVariantSpecification/);
  assert.match(showMappers, /baseModel: effect\?\.model_json/);
  assert.match(showTypes, /CACHE_PREFIX = 'shows:v7'/);
  assert.match(showDomain, /rawSpec: unknown/);
  assert.match(showDomain, /renderDesign: FireworkDesign \| null/);
  assert.match(importJobs, /renderDesign: compileFireworkDesign\(\{ legacySpec: spec \}\)/);
});

test('firework replay is deterministic and silent when rebuilding after scrub', () => {
  const engine = read('lib/fireworks/FireworksEngine.ts');
  const effects = read('lib/fireworks/Effects.ts');
  const sound = read('lib/fireworks/SoundHandler.ts');

  assert.match(engine, /createSeededRng/);
  assert.match(engine, /mixSeed/);
  assert.match(engine, /this\.seekTo\(next\)/);
  assert.match(engine, /this\.advanceTo\(target, false\)/);
  assert.match(engine, /const SCRUB_DT = 1 \/ 24/);
  assert.match(engine, /poolHasLiveCallbackParticles/);
  assert.match(engine, /p\.mass >= 0\.1 \|\| p\.shape > 1\.5/);
  assert.match(engine, /this\.lights\.reset\(\)/);
  assert.match(effects, /audible: boolean/);
  assert.match(effects, /if \(audible\)/);
  assert.match(sound, /rng\?: RandomSource/);
});

test('renderer effects drive shell and trail colours from the selected design', () => {
  const effects = read('lib/fireworks/Effects.ts');

  assert.match(effects, /resolveColor\(design\.color, rng\)/);
  assert.match(effects, /flairColor\(design, color, rng\)/);
  assert.match(effects, /r: color\.r/);
  assert.match(effects, /g: color\.g/);
  assert.match(effects, /b: color\.b/);
  assert.doesNotMatch(effects, /r:\s*1\.0,\s*g:\s*0,\s*b:\s*0/s);
});

test('QA seed creates pattern, colour, and replay test shows for every user', () => {
  const seed = read('supabase/seed-qa-test-shows.sql');

  assert.match(seed, /for demo_user in/);
  assert.match(seed, /from auth\.users/);
  assert.match(seed, /qa-pattern-check/);
  assert.match(seed, /qa-colour-check/);
  assert.match(seed, /qa-replay-scrub-check/);
  assert.match(seed, /launch_position_index/);
  assert.match(seed, /'fib-gold'/);
  assert.match(seed, /'wave-cyan'/);
  assert.match(seed, /'strobe-white'/);
});

test('burst patterns distribute over the full sphere', () => {
  const effects = read('lib/fireworks/Effects.ts');
  // Fibonacci bursts must stay a full sphere rather than folding the lower
  // hemisphere upward.
  assert.doesNotMatch(effects, /vy = Math\.abs\(i \* offset/);
  assert.match(effects, /function fibonacciDirection/);
  assert.match(effects, /const y = index \* offset - 1 \+ offset \/ 2/);
});

test('renderer preserves named firework geometry and trail profiles', () => {
  const design = read('lib/fireworks/design.ts');
  const effects = read('lib/fireworks/Effects.ts');
  const migration = read(
    'supabase/migrations/20260528233000_renderer_effect_geometry_expansion.sql',
  );

  for (const key of [
    'crown',
    'weeping',
    'radial_arms',
    'ring',
    'split_cross',
    'single_tail',
    'upward_fan',
    'pearls',
    'fish',
    'waterfall',
    'whirl',
  ]) {
    assert.match(design, new RegExp(`'${key}'`));
    assert.match(effects, new RegExp(`'${key}'`));
  }
  assert.match(design, /extractBaseDefaults/);
  assert.match(design, /trailProfileToSettings/);
  assert.match(effects, /spawnPistil/);
  assert.match(effects, /splitCrossette/);
  assert.match(effects, /fireMine/);
  assert.match(effects, /spawnFishSwarm/);
  assert.match(effects, /spawnWaterfall/);
  assert.match(effects, /spawnWhirl/);
  for (const slug of ['pistil', 'pearls', 'tail', 'silver-fish', 'waterfall', 'whirl']) {
    assert.match(migration, new RegExp(`'${slug}'`));
  }
});

test('replay carries product-shot fan angles into launch physics', () => {
  const queries = read('lib/shows/queries.server.ts');
  const domain = read('lib/show-domain.ts');
  const engine = read('lib/fireworks/FireworksEngine.ts');
  const effects = read('lib/fireworks/Effects.ts');

  assert.match(queries, /pan_degrees, tilt_degrees, position_override_json/);
  assert.match(queries, /shotPanDegrees: shots\[i\]\.panDegrees/);
  assert.match(queries, /shotTiltDegrees: shots\[i\]\.tiltDegrees/);
  assert.match(domain, /shotPanDegrees\?: number \| null/);
  assert.match(engine, /panDegrees: cue\.shotPanDegrees \?\? 0/);
  assert.match(engine, /shotPositionOverride/);
  assert.match(effects, /const panRadians/);
  assert.match(effects, /lateralVelocity/);
});

test('burst physics hang like firework stars instead of free-falling', () => {
  const effects = read('lib/fireworks/Effects.ts');
  const particle = read('lib/fireworks/Particle.ts');
  const engine = read('lib/fireworks/FireworksEngine.ts');

  assert.match(effects, /const STAR_DRAG = 2\.15/);
  assert.match(effects, /const MIN_STAR_GRAVITY = -1\.85/);
  assert.match(effects, /const MAX_STAR_GRAVITY = 0\.28/);
  assert.match(effects, /clampStarGravity\(rangeRand\(design\.burst\.gravity, rng\)\)/);
  assert.match(effects, /starDrag\(design\)/);
  assert.match(effects, /gravity: TRAIL_GRAVITY/);
  assert.match(particle, /drag = 0/);
  assert.match(particle, /maxLife = 0/);
  assert.match(particle, /Math\.exp\(-this\.drag \* dt\)/);
  assert.match(particle, /applyDragStep\(this\.vy, ay \* dt\) \+ this\.gravity \* dt/);
  assert.match(engine, /SNAPSHOT_STRIDE = 17/);
  assert.match(engine, /state\.data\[o \+ 14\] = p\.drag/);
  assert.match(engine, /state\.data\[o \+ 15\] = p\.maxLife/);
  assert.match(engine, /state\.data\[o \+ 16\] = p\.shape/);
  assert.match(engine, /p\.drag = state\.data\[o \+ 14\]/);
  assert.match(engine, /p\.maxLife = state\.data\[o \+ 15\] \|\| p\.life/);
  assert.match(engine, /p\.shape = state\.data\[o \+ 16\] \|\| 0/);
});

test('renderer draws compact mixed round and streak particles', () => {
  const engine = read('lib/fireworks/FireworksEngine.ts');
  const design = read('lib/fireworks/design.ts');
  const particle = read('lib/fireworks/Particle.ts');
  const pool = read('lib/fireworks/ParticlePool.ts');
  const shaders = read('lib/fireworks/shaders.ts');
  const effects = read('lib/fireworks/Effects.ts');
  const canvas = read('app/components/app/FireworkReplayCanvas.tsx');

  assert.match(pool, /aliveIndices: Uint32Array/);
  assert.match(pool, /activeSlots/);
  assert.match(pool, /return this\.activeCount/);
  assert.match(pool, /p\.reset\(\);[\s\S]*return p;/);
  assert.match(pool, /p\.color\.setRGB\(1, 1, 1\)/);
  assert.match(particle, /shape = 0/);
  assert.match(pool, /shape\?: number/);
  assert.match(pool, /p\.shape = prop\.shape \?\? 0/);
  assert.match(engine, /const live = this\.pool\.aliveIndices/);
  assert.match(engine, /let drawCount = 0/);
  assert.match(engine, /renderParticleSize\(p\)/);
  assert.match(engine, /renderParticleAlpha\(p\)/);
  assert.match(engine, /shapeAttribute/);
  assert.match(engine, /this\.geometry\.setAttribute\('shape', this\.shapeAttribute\)/);
  assert.match(engine, /shapes\[drawCount\] = p\.shape/);
  assert.match(engine, /p\.color\.r \* alpha/);
  assert.match(engine, /this\.geometry\.setDrawRange\(0, drawCount\)/);
  assert.match(engine, /addUpdateRange\(0, positionCount\)/);
  assert.doesNotMatch(engine, /TextureLoader|SPARK_TEXTURE_URL/);
  assert.doesNotMatch(engine, /alphaAttribute|setAttribute\("alpha"/);
  assert.doesNotMatch(shaders, /texture2D|sampler2D|pointTexture/);
  assert.doesNotMatch(shaders, /attribute float alpha|vAlpha/);
  assert.match(shaders, /attribute float shape/);
  assert.match(shaders, /varying float vShape/);
  assert.match(shaders, /float roundDistance = length\(centered\)/);
  assert.match(shaders, /float squareDistance = max\(squareX, squareY\)/);
  assert.match(shaders, /if \(isSquare < 0\.5 && roundDistance > 0\.58\) discard/);
  assert.match(shaders, /float squareBody/);
  assert.match(design, /streakSize: z\.coerce\.number\(\)\.min\(0\.4\)\.max\(4\)\.default\(1\)/);
  assert.match(design, /streakLength: z\.coerce\.number\(\)\.min\(0\.4\)\.max\(4\)\.default\(1\)/);
  assert.match(design, /streakLife: z\.coerce\.number\(\)\.min\(0\.2\)\.max\(4\)\.default\(1\)/);
  assert.match(effects, /design\.trail\.streakSize/);
  assert.match(effects, /design\.trail\.streakLength/);
  assert.match(effects, /design\.trail\.streakLife/);
  assert.match(effects, /BROCADE_MAX_STREAKS = \d+/);
  assert.match(effects, /spawnBrocadeBurst/);
  assert.match(effects, /emitBrocadeTrailCluster/);
  assert.doesNotMatch(shaders, /rectStretch|rectYLimit/);
  assert.match(shaders, /softHalo/);
  assert.match(shaders, /gl_FragColor = vec4\(sparkColor \* intensity, alpha\)/);
  assert.match(shaders, /gl_PointSize = clamp/);
  assert.doesNotMatch(shaders, /projectionScale = projectionMatrix\[1\]\[1\]/);
  assert.match(canvas, /MAX_DEVICE_PIXEL_RATIO = 1\.25/);
  assert.match(canvas, /DEFAULT_CAMERA_POSITION = new THREE\.Vector3\(0, 64, 1850\)/);
  assert.match(canvas, /DEFAULT_CAMERA_TARGET = new THREE\.Vector3\(0, 120, 0\)/);
  assert.match(canvas, /FLOOR_PAN_TRIGGER_HEIGHT = 92/);
  assert.match(canvas, /FLOOR_PAN_TARGET_EPSILON = 1/);
  assert.match(canvas, /FLOOR_PAN_DRAG_RATIO = 0\.1/);
  assert.match(canvas, /FLOOR_PAN_UP_ANGLE_PER_PULL = THREE\.MathUtils\.degToRad\(22\)/);
  assert.match(canvas, /FLOOR_PAN_UP_MAX_ANGLE_NEAR = THREE\.MathUtils\.degToRad\(12\)/);
  assert.match(canvas, /FLOOR_PAN_UP_MAX_ANGLE_FAR = THREE\.MathUtils\.degToRad\(22\)/);
  assert.match(canvas, /FLOOR_PAN_UP_POLAR_OVERSHOOT = 0\.22/);
  assert.match(canvas, /maxPolarAngle = Math\.PI \/ 2 \+ FLOOR_PAN_UP_POLAR_OVERSHOOT/);
  assert.match(canvas, /function floorPanMaxAngle\(distance: number\)/);
  assert.match(canvas, /function isAtFloorPanLimit/);
  assert.match(canvas, /controls\.target\.y <= GROUND_PLANE_Y \+ FLOOR_PAN_TARGET_EPSILON/);
  assert.match(canvas, /function applyFloorLookPitch/);
  assert.match(canvas, /function updateFloorLookPitch/);
  assert.match(canvas, /event\.clientY - floorDragLastY/);
  assert.match(canvas, /floorPushDelta = -deltaY/);
  assert.match(canvas, /!isAtFloorPanLimit\(camera, controls\)/);
  assert.match(
    canvas,
    /const angleDelta = \(floorPushDelta \* FLOOR_PAN_UP_ANGLE_PER_PULL\) \/ maxDragPixels/,
  );
  assert.match(
    canvas,
    /const handled = Math\.abs\(deltaY\) >= 0\.1 \|\| currentPitch > 0 \|\| clamped/,
  );
  assert.match(canvas, /floorLookPitchRef = useRef\(0\)/);
  assert.match(canvas, /panModeRef = useRef\(false\)/);
  assert.match(canvas, /panModeRef\.current = panMode/);
  assert.match(canvas, /!panModeRef\.current/);
  assert.match(canvas, /controls\.enableDamping = false/);
  assert.match(canvas, /event\.stopImmediatePropagation\(\)/);
  assert.match(canvas, /function stopOrbitControlMomentum/);
  assert.match(canvas, /function syncOrbitControlDragCursor/);
  assert.match(canvas, /function panCameraHorizontally/);
  assert.match(canvas, /const horizontalPanned = panCameraHorizontally/);
  assert.match(canvas, /camera\.rotateX\(pitchOffset\)/);
  assert.match(canvas, /floorLookPitchRef\.current = nextFloorPitch\.pitch/);
  assert.doesNotMatch(canvas, /THREE\.MathUtils\.damp\(/);
  assert.match(canvas, /applyFloorLookPitch\(cam, controls, floorLookPitchRef\.current\)/);
  assert.match(
    canvas,
    /renderer\.domElement\.addEventListener\('pointerdown', onFloorDragPointerDown\)/,
  );
  assert.match(
    canvas,
    /window\.addEventListener\('pointermove', onFloorDragPointerMove, \{ capture: true \}\)/,
  );
  assert.match(canvas, /function adjustZoom\(factor: number\)/);
  assert.match(canvas, /MAX_CAMERA_DISTANCE = 3000/);
  assert.match(canvas, /adjustZoom\(0\.85\)/);
  assert.match(canvas, /adjustZoom\(1\.2\)/);
  assert.match(canvas, /label="Zoom in"/);
  assert.match(canvas, /label="Zoom out"/);
  assert.doesNotMatch(canvas, /CLOSE_CAMERA_ZOOM/);
  assert.doesNotMatch(canvas, /CAMERA_ZOOM_TRANSITION_MS/);
  assert.doesNotMatch(canvas, /controls\.enableZoom = false/);
  assert.doesNotMatch(canvas, /setCameraZoomLevel/);
  assert.doesNotMatch(canvas, /camera\.zoom = THREE\.MathUtils\.lerp/);
  assert.doesNotMatch(canvas, /CLOSE_CAMERA_DISTANCE/);
  assert.match(canvas, /EffectComposer/);
  assert.match(canvas, /UnrealBloomPass/);
  assert.match(canvas, /antialias: false/);
  assert.match(canvas, /renderer\.sortObjects = false/);
});

test('renderer keeps glow bounded while adding realistic spark density', () => {
  const engine = read('lib/fireworks/FireworksEngine.ts');
  const effects = read('lib/fireworks/Effects.ts');

  assert.match(engine, /Math\.sqrt\(Math\.max\(0, p\.size\)\)/);
  assert.match(engine, /BRIGHTNESS_BOOST = 1\.55/);
  assert.match(engine, /MAX_COLOR_INTENSITY = 1\.75/);
  assert.match(engine, /peak = 0\.14/);
  assert.match(engine, /fadeIn = p\.mass <= 0\.003/);
  assert.match(engine, /isSmoke/);
  assert.match(engine, /clamp\(peak \* fadeIn \* fade, 0, 0\.82\)/);
  assert.match(engine, /tickPhysics\(next - cursor\)/);
  assert.match(engine, /this\.syncGeometry\(\);[\s\S]*private tickPhysics/);
  assert.match(effects, /SHELL_TRAIL_DENSITY = 0\.68/);
  assert.match(effects, /STAR_TRAIL_PARTICLES_PER_SECOND = 11/);
  assert.match(effects, /STAR_TRAIL_PARTICLES_PER_SECOND \*[\s\S]*design\.trail\.density/);
  assert.match(effects, /design\.trailProfile === 'none'/);
  assert.match(effects, /fullQuality\s*\?\s*90 \+ Math\.floor\(rng\.next\(\) \* 120\)/);
  assert.match(effects, /mass: 0\.006/);
});

test('world uses a crisp procedural grid floor and instanced launch hardware', () => {
  const world = read('lib/fireworks/World.ts');

  assert.match(world, /MINOR_GRID_STEP = 62\.5/);
  assert.match(world, /MAJOR_GRID_STEP = MINOR_GRID_STEP \* 4/);
  assert.match(world, /MINOR_GRID_LINE_WIDTH = 0\.3/);
  assert.match(world, /MAJOR_GRID_LINE_WIDTH = 0\.55/);
  assert.match(world, /minorOnly \* 0\.05 \+ majorLine \* 0\.11/);
  assert.match(world, /createGroundMaterial/);
  assert.match(world, /new THREE\.ShaderMaterial/);
  assert.match(world, /fwidth\(coord\.x\)/);
  assert.match(world, /smoothstep\(0\.0, 0\.62, radial\)/);
  assert.match(world, /centerGlow = pow\(1\.0 - smoothstep\(0\.0, 0\.32, radial\), 1\.35\)/);
  assert.match(world, /vec3\(0\.31, 0\.32, 0\.34\)/);
  assert.match(world, /vec3\(0\.37, 0\.39, 0\.42\)/);
  assert.match(world, /vec3\(0\.58, 0\.6, 0\.64\)/);
  assert.match(world, /pool \* 0\.15/);
  assert.match(world, /centerGlow \* 0\.09/);
  assert.match(world, /pool \* 0\.11 \+ centerGlow \* 0\.065/);
  assert.match(world, /smoothstep\(0\.58, 0\.94, radial\)/);
  assert.match(world, /new THREE\.InstancedMesh/);
  assert.match(world, /CylinderGeometry\(5\.5, 5\.5, 28, 16\)/);
  assert.match(world, /TorusGeometry\(5\.7, 0\.75, 8, 24\)/);
  assert.match(world, /color: 0xaeb3bb/);
  assert.match(world, /color: 0xc3c8d0/);
  assert.doesNotMatch(world, /CanvasTexture|LinearMipmapLinearFilter|GridHelper|LineSegments/);
});

test('brocade calibration is data-driven and admin-tunable', () => {
  const design = read('lib/fireworks/design.ts');
  const effects = read('lib/fireworks/Effects.ts');
  const particle = read('lib/fireworks/Particle.ts');
  const shaders = read('lib/fireworks/shaders.ts');
  const engine = read('lib/fireworks/FireworksEngine.ts');
  const editor = read('app/(admin)/admin/effects/[id]/EffectEditor.tsx');
  const migration = read('supabase/migrations/20260610121500_brocade_admin_calibration_params.sql');

  // Brocade tuning lives in the design schema, not renderer constants.
  assert.match(design, /brocade: z/);
  assert.match(design, /streakCount: z\.coerce\.number\(\)/);
  assert.match(design, /estimateDesignDurationSeconds/);
  assert.match(effects, /design\.brocade/);
  assert.match(effects, /brocade\.streakCount \?\? design\.size/);
  assert.match(effects, /BROCADE_GLOW_SHAPE_SCALE/);
  assert.match(effects, /BROCADE_MAX_HEAD_GRAVITY = 0/);
  assert.match(effects, /BROCADE_MAX_TRAIL_EMISSIONS_PER_STEP = 32/);
  // Heads sustain a scene-light tint that decays with their life.
  assert.match(effects, /sustainHemi/);
  assert.match(effects, /const speed = burstSpeed \* \(0\.985 \+ rng\.next\(\) \* 0\.03\)/);
  assert.match(
    effects,
    /const sampleAge = Math\.max\(0, headAge - \(\(1 - progress\) \* dt\) \/ p\.maxLife\)/,
  );
  assert.match(effects, /const agedLife = life - ageOffset/);
  assert.match(effects, /particle\.maxLife = life/);
  assert.match(effects, /const stepX = dx \/ emissionCount/);
  assert.doesNotMatch(effects, /p\.life < 0\.35/);
  // Heads escape the shared point-size ceiling so they stay dominant
  // over trail squares at close zoom, and glow scales per particle.
  assert.match(shaders, /maxPointSize = mix\(96\.0, 640\.0, isHead\)/);
  assert.match(shaders, /headGlowStrength/);
  // Compressed perspective keeps sprites readable at every zoom level, and
  // glow growth is compensated so the solid orb size is glow-independent.
  assert.match(shaders, /float exponent = mix\(0\.7, 0\.55, isHead\)/);
  assert.match(shaders, /vHeadGrow = pointSize \/ max\(baseSize, 0\.0001\)/);
  assert.match(engine, /clamp\(base, 4, 240\)/);
  assert.match(particle, /const isBrocadeHead = this\.shape > 1\.5/);
  assert.match(particle, /const lateralLimit = isBrocadeHead \? 18 : VMAX_LATERAL/);
  assert.match(particle, /const downwardLimit = isBrocadeHead \? 18 : VMAX_DOWN/);
  // Admin editor exposes a full-duration scrub timeline and brocade sliders.
  assert.match(editor, /estimateDesignDurationSeconds/);
  assert.match(editor, /SliderField/);
  assert.match(editor, /setBrocadeValue/);
  assert.match(editor, /MIN_RENDER_SIZE = 20/);
  assert.match(editor, /defaults\.size = Math\.max\(MIN_RENDER_SIZE, value\)/);
  assert.match(editor, /setBrocadeGravityUpper/);
  assert.match(editor, /label="Floatiness"[\s\S]*max=\{0\}/);
  assert.match(editor, /label="Burst size"[\s\S]*max=\{12\}/);
  assert.match(migration, /'streakCount', 60/);
  assert.match(migration, /'glowStrength', 1/);
});
