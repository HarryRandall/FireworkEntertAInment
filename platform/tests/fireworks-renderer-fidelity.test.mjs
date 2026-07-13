/** Static-analysis "grep the source" test guarding the fireworks renderer fidelity invariants (do not modify test bodies). */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('firework replay compiles fireworks, render overrides, and cache-busts old shapes', () => {
  const engine = read('lib/fireworks/FireworksEngine.ts');
  const showMappers = read('lib/shows/mappers.ts');
  const showTypes = read('lib/shows/types.ts');
  const showDomain = read('lib/show-domain.ts');
  const importJobs = read('lib/import-jobs.ts');

  assert.match(
    engine,
    /cue\.firework\.renderDesign \?\? compileFireworkDesign\(\{ legacySpec: cue\.firework\.rawSpec \}\)/,
  );
  assert.match(showMappers, /rawSpec: row\.render_overrides_json/);
  assert.match(showMappers, /mapFireworkVariantSpecification/);
  assert.match(showMappers, /baseModel: effect\?\.model_json/);
  assert.match(showTypes, /CACHE_PREFIX = 'shows:v12'/);
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
  assert.match(engine, /const isBackwardSeek = delta < -0\.0001/);
  assert.match(engine, /const useSnapshots = this\.scheduler\.size\(\) > 1/);
  assert.match(
    engine,
    /if \(isBackwardSeek\) \{\s*this\.seekTo\(next, \{ useSnapshots \}\);\s*return;/,
  );
  assert.match(engine, /this\.seekTo\(next, \{ useSnapshots \}\)/);
  assert.match(
    engine,
    /private seekTo\(target: number, options: \{ useSnapshots\?: boolean \} = \{\}\): void/,
  );
  assert.match(engine, /options\.useSnapshots === false \? null : this\.findSnapshot\(target\)/);
  assert.match(engine, /this\.advanceTo\(target, false\)/);
  assert.match(
    engine,
    /this\.scheduler\.size\(\) > 1 &&\s*!this\.scrubbing &&\s*!this\.primed &&\s*cursor >= this\.nextSnapshotAt/,
  );
  assert.match(engine, /const SCRUB_DT = 1 \/ 24/);
  // Timeline-drag scrub mode: lossy restores are accepted (never a from-zero
  // rebuild mid-drag), advances run at the coarse drag step, and ending the
  // drag repairs any approximate state with an accurate re-seek.
  assert.match(engine, /const SCRUB_DRAG_DT = 1 \/ 12/);
  assert.match(engine, /setScrubbing\(active: boolean\): void/);
  assert.match(engine, /if \(this\.scrubbing\) this\.needsAccurateReseek = true/);
  assert.match(
    engine,
    /if \(!restore && this\.scrubbing && snap && snap\.time <= target\) restore = snap/,
  );
  // Accurate seeks whose nearest snapshot is lossy resimulate from the nearest
  // clean snapshot instead of rebuilding from zero, and a from-zero rebuild
  // never wipes a primed snapshot cache.
  // Accurate (non-scrub) seeks never accept a lossy restore: they fall back to
  // the nearest clean snapshot so behaviour-driven effects (launch trails,
  // brocade heads) replay exactly.
  assert.match(
    engine,
    /if \(!restore && snap\) restore = this\.findCleanSnapshotAtOrBefore\(target\)/,
  );
  // Lossy-snapshot detection must count hidden heads (shape <=
  // HIDDEN_PARTICLE_SHAPE): they fly invisibly while their effect callback
  // emits trail particles, so a snapshot taken while they are alive restores
  // without their trails.
  assert.match(
    engine,
    /p\.mass >= 0\.1 \|\| p\.shape > 1\.5 \|\| p\.shape <= HIDDEN_PARTICLE_SHAPE/,
  );
  // The post-drag repair is asynchronous (budgeted slices driven by the render
  // loop) and fully accurate; geometry sync is suppressed until it lands.
  assert.match(engine, /isRepairing\(\): boolean/);
  assert.match(engine, /stepRepair\(budgetMs: number, target\?: number\): \{ done: boolean \}/);
  assert.match(engine, /this\.beginRepair\(this\.elapsed\)/);
  // Priming plants a clean snapshot at the end of every lossy stretch so
  // repairs resimulate at most the overlapping burst.
  assert.match(engine, /\(!lossyNow && this\.lastPrimeCaptureLossy\)/);
  // Pausing the show suspends the effect-audio context: in-flight booms and
  // crackles cut off with the timeline and resume their remainder on play,
  // and the audio-unlock gesture handler cannot un-suspend a paused context.
  assert.match(sound, /setPlaybackPaused\(paused: boolean\): void/);
  assert.match(sound, /if \(this\.playbackPaused\) return;/);
  assert.match(sound, /if \(this\.muted \|\| this\.playbackPaused\) return;/);
  const canvas = read('app/components/app/FireworkReplayCanvas.tsx');
  assert.match(canvas, /engine\.setPlaybackPaused\(muted\)/);
  assert.match(canvas, /eng\.isRepairing\(\)/);
  // The repair chases the live playhead so play-during-repair needs no
  // follow-up synchronous catch-up seek.
  assert.match(canvas, /eng\.stepRepair\(REPAIR_BUDGET_MS, repairTarget\)/);
  // Content-identical cue arrays from parent re-renders must not re-clear the
  // scene (visible particle blink on play/pause spam).
  assert.match(canvas, /appliedCuesSignatureRef\.current === applySignature\) return/);
  // Dense snapshot cache: every seek resimulates at most half a second.
  assert.match(engine, /SNAPSHOT_INTERVAL = 0\.5/);
  assert.match(engine, /MAX_SNAPSHOTS = 1200/);
  assert.match(engine, /if \(!this\.primed\) \{\s*this\.snapshots\.length = 0/);
  assert.match(
    engine,
    /if \(!this\.needsAccurateReseek\) return;[\s\S]*this\.beginRepair\(this\.elapsed\)/,
  );
  assert.match(engine, /poolHasLiveCallbackParticles/);
  assert.match(engine, /p\.mass >= 0\.1 \|\| p\.shape > 1\.5/);
  assert.match(engine, /this\.lights\.reset\(\)/);
  assert.match(effects, /audible: boolean/);
  assert.match(effects, /if \(audible\)/);
  assert.match(sound, /rng\?: RandomSource/);
});

test('firework audio separates launch and burst reports', () => {
  const design = read('lib/fireworks/design.ts');
  const engine = read('lib/fireworks/FireworksEngine.ts');
  const effects = read('lib/fireworks/Effects.ts');
  const controls = read('app/components/admin/FireworkRenderControls.tsx');

  assert.match(design, /launch: z\.boolean\(\)\.default\(true\)/);
  assert.match(design, /boom: z\.enum\(\['none', 'auto', 'light', 'heavy'\]\)\.default\('auto'\)/);
  assert.match(design, /function launchSoundFromSource/);
  assert.match(
    design,
    /compiled\.sound = deepMergeDesign\(compiled\.sound, \{ launch: variantLaunchSound \}\)/,
  );
  assert.match(engine, /this\.effects\.setAudible\(audible\);/);
  assert.match(engine, /this\.effects\.setAudible\(true\);/);
  assert.match(effects, /private audible = false/);
  assert.match(effects, /setAudible\(audible: boolean\): void \{\s*this\.audible = audible;\s*\}/);
  assert.match(
    effects,
    /action: \(p, dt, t\) => \{[\s\S]*this\.detonate\(p, dt, t, design, color, seed, rng, this\.audible\);[\s\S]*\},/,
  );
  assert.match(effects, /options\.audible && design\.sound\.launch/);
  assert.match(effects, /boom !== 'none'/);
  assert.match(controls, /label="Launch sound"/);
  assert.match(controls, /sound\.launch = value/);
  assert.match(controls, /mortar\.sound = value/);
  assert.match(controls, /<FieldLabel>Burst report<\/FieldLabel>/);
});

test('renderer effects drive shell and trail colours from the selected design', () => {
  const effects = read('lib/fireworks/Effects.ts');

  assert.match(effects, /resolveColor\(design\.color, rng\)/);
  assert.match(effects, /streakTrailPalette\(design\.stars\.outer\.burstTrail, color\)/);
  assert.match(effects, /switch \(trail\.colourMode\)/);
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
  assert.match(seed, /'peony-default'/);
  assert.match(seed, /'whirl-azure'/);
  assert.match(seed, /'strobe-default'/);
  assert.doesNotMatch(seed, /'fib-[^']+'/);
  assert.doesNotMatch(seed, /'wave-(cyan|purple|rainbow)'/);
  assert.doesNotMatch(seed, /'strobe-(mixed|red|white)'/);
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
  }
  for (const key of [
    'crown',
    'weeping',
    'radial_arms',
    'ring',
    'single_tail',
    'upward_fan',
    'pearls',
    'fish',
    'waterfall',
    'whirl',
  ]) {
    assert.match(effects, new RegExp(`'${key}'`));
  }
  assert.match(design, /hasExplicitSectionEnabled/);
  assert.match(effects, /split: layerKey === 'outer' && design\.split\.enabled/);
  assert.match(design, /geometry: design\.geometry === 'pistil' \? 'sphere' : design\.geometry/);
  assert.match(design, /extractBaseDefaults/);
  assert.match(design, /trailProfileToSettings/);
  assert.match(
    effects,
    /this\.spawnStarLayer\('outer', particle, design, color, seed, rng, audible\)/,
  );
  assert.match(
    effects,
    /this\.spawnStarLayer\('core', particle, design, color, seed, rng, audible\)/,
  );
  assert.doesNotMatch(effects, /spawnPistil|design\.pistil/);
  assert.match(effects, /splitCrossette/);
  assert.match(effects, /fireMine/);
  assert.match(effects, /spawnFishSwarm/);
  assert.match(effects, /spawnWaterfall/);
  assert.match(effects, /spawnWhirl/);
  assert.doesNotMatch(effects, /Math\.max\((44|52|18|72|60|80|90), Math\.round/);
  // Geometry count scaling is design-driven via `geometryTuning` (defaults
  // preserve the old constants), not hardcoded multipliers.
  assert.match(effects, /Math\.max\(1, Math\.round\(layer\.count \* \(countPercent \/ 100\)\)\)/);
  assert.match(
    effects,
    /Math\.max\(1, Math\.round\(design\.size \* \(shape\.countPercent \/ 100\)\)\)/,
  );
  assert.match(design, /geometryTuning: GeometryTuningSchema/);
  for (const slug of ['pistil', 'pearls', 'tail', 'silver-fish', 'waterfall', 'whirl']) {
    assert.match(migration, new RegExp(`'${slug}'`));
  }
});

test('replay carries multishot fan angles into launch physics', () => {
  const queries = read('lib/shows/queries.server.ts');
  const domain = read('lib/show-domain.ts');
  const engine = read('lib/fireworks/FireworksEngine.ts');
  const effects = read('lib/fireworks/Effects.ts');

  assert.match(queries, /multishot_fireworks/);
  assert.match(queries, /pan_degrees,[\s\S]*tilt_degrees,[\s\S]*position_override_json/);
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
  assert.match(effects, /const shellSize = Math\.max\(size, 110\)/);
  assert.match(effects, /Star count can be tiny[\s\S]*trigger detonation/);
  assert.match(effects, /clampStarGravity\(rangeRand\(design\.burst\.gravity, rng\)\)/);
  assert.match(effects, /starDrag\(design\)/);
  assert.match(effects, /const lockToShellPath = liftTubeRadius <= 0/);
  assert.match(effects, /gravity: lockToShellPath[\s\S]*liftParticles\.motion\.gravity/);
  assert.match(effects, /vx: lockToShellPath[\s\S]*\? 0/);
  assert.match(effects, /function estimateShellRiseHeight/);
  assert.match(effects, /const liftHeightPercent = clamp\(liftParticles\.height \/ 100, 0, 1\)/);
  assert.match(effects, /const liftStopY = liftOriginY \+ liftRiseHeight \* liftHeightPercent/);
  assert.match(effects, /smoke\.height/);
  assert.match(particle, /drag = 0/);
  assert.match(particle, /maxLife = 0/);
  assert.match(particle, /Math\.exp\(-this\.drag \* dt\)/);
  assert.match(particle, /applyDragStep\(this\.vy, ay \* dt\) \+ this\.gravity \* dt/);
  assert.match(engine, /SNAPSHOT_STRIDE = 21/);
  assert.match(engine, /state\.data\[o \+ 8\] = p\.alpha/);
  assert.match(engine, /state\.data\[o \+ 20\] = p\.fadeIn \? 1 : 0/);
  assert.match(engine, /state\.data\[o \+ 15\] = p\.drag/);
  assert.match(engine, /state\.data\[o \+ 16\] = p\.maxLife/);
  assert.match(engine, /state\.data\[o \+ 17\] = p\.shape/);
  assert.match(engine, /state\.data\[o \+ 18\] = p\.rotation/);
  assert.match(engine, /state\.data\[o \+ 19\] = p\.spin/);
  assert.match(engine, /p\.alpha = state\.data\[o \+ 8\] \|\| 0/);
  assert.match(engine, /p\.drag = state\.data\[o \+ 15\]/);
  assert.match(engine, /p\.maxLife = state\.data\[o \+ 16\] \|\| p\.life/);
  assert.match(engine, /p\.shape = state\.data\[o \+ 17\] \|\| 0/);
  assert.match(engine, /p\.rotation = state\.data\[o \+ 18\] \|\| 0/);
  assert.match(engine, /p\.spin = state\.data\[o \+ 19\] \|\| 0/);
});

test('renderer draws compact mixed round, square, and triangle particles', () => {
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
  assert.match(particle, /alpha = 1/);
  assert.match(particle, /rotation = 0/);
  assert.match(particle, /spin = 0/);
  assert.match(pool, /alpha\?: number/);
  assert.match(pool, /shape\?: number/);
  assert.match(pool, /rotation\?: number/);
  assert.match(pool, /spin\?: number/);
  assert.match(pool, /fadeIn\?: boolean/);
  assert.match(pool, /p\.shape = prop\.shape \?\? 0/);
  assert.match(pool, /p\.alpha = prop\.alpha \?\? 1/);
  assert.match(pool, /p\.fadeIn = prop\.fadeIn \?\? true/);
  assert.match(pool, /p\.rotation = prop\.rotation \?\? 0/);
  assert.match(engine, /const live = this\.pool\.aliveIndices/);
  assert.match(engine, /let drawCount = 0/);
  assert.match(engine, /renderParticleSize\(p\)/);
  assert.match(
    engine,
    /renderParticleAlpha\(\s*p,\s*this\.headHoldOuter[\s\S]*?\)\s*\*\s*twinkle\s*\*\s*clamp\(p\.alpha, 0, 1\)/,
  );
  assert.match(engine, /shapeAttribute/);
  assert.match(engine, /rotationAttribute/);
  assert.match(engine, /this\.geometry\.setAttribute\('shape', this\.shapeAttribute\)/);
  assert.match(engine, /this\.geometry\.setAttribute\('rotation', this\.rotationAttribute\)/);
  assert.match(engine, /shapes\[drawCount\] = p\.shape/);
  assert.match(engine, /rotations\[drawCount\] = p\.rotation/);
  assert.match(engine, /p\.color\.r \* alpha/);
  assert.match(engine, /this\.geometry\.setDrawRange\(0, drawCount\)/);
  assert.match(engine, /addUpdateRange\(0, positionCount\)/);
  assert.doesNotMatch(engine, /TextureLoader|SPARK_TEXTURE_URL/);
  // The main additive points geometry bakes alpha into colour, so it must not
  // gain an alpha attribute. No shader may declare alpha as a vertex attribute.
  assert.doesNotMatch(engine, /this\.geometry\.setAttribute\('alpha'/);
  assert.doesNotMatch(shaders, /texture2D|sampler2D|pointTexture/);
  assert.doesNotMatch(shaders, /attribute float alpha/);
  assert.doesNotMatch(shaders, /varying float vAlpha/);
  assert.match(shaders, /attribute float shape/);
  assert.match(shaders, /attribute float rotation/);
  assert.match(shaders, /varying float vShape/);
  assert.match(shaders, /varying float vRotation/);
  assert.match(shaders, /float roundDistance = length\(centered\)/);
  assert.match(shaders, /float squareDistance = max\(squareX, squareY\)/);
  assert.match(shaders, /float isTriangle/);
  assert.match(
    shaders,
    /if \(isHead < 0\.5 && isSquare < 0\.5 && isTriangle < 0\.5 && roundDistance > 0\.58\) discard/,
  );
  assert.match(shaders, /float squareBody/);
  assert.match(shaders, /float triangleBody/);
  assert.match(shaders, /if \(isTriangle > 0\.5 && triangleDistance > 0\.0\) discard/);
  assert.match(design, /export const BURST_TRAIL_SHAPES = \['circle', 'square', 'triangle'\]/);
  assert.match(design, /export const BURST_TRAIL_MAX_STOPS = 5/);
  assert.match(design, /export const BURST_TRAIL_PARTICLES_PER_STAR_MAX = 2000/);
  assert.match(design, /export const BURST_TRAIL_FLICKER_LIFE_MAX = 0\.5/);
  assert.doesNotMatch(design, /BURST_TRAIL_PARTICLE_CAP/);
  assert.match(design, /const BurstTrailSchema = z/);
  assert.match(
    design,
    /particlesPerStar: z\.coerce[\s\S]*\.transform\(\(value\) => Math\.min\(BURST_TRAIL_PARTICLES_PER_STAR_MAX, value\)\)[\s\S]*\.default\(24\)/,
  );
  assert.match(
    design,
    /lifetimeMultiplier: z\.coerce[\s\S]*\.transform\(\(value\) => Math\.min\(BURST_TRAIL_FLICKER_LIFE_MAX, value\)\)[\s\S]*\.default\(0\.45\)/,
  );
  assert.match(design, /size: z\.coerce\.number\(\)\.min\(0\.08\)\.max\(24\)\.default\(1\)/);
  assert.match(design, /shapeWeights: BurstTrailShapeWeightsSchema/);
  assert.match(effects, /function burstTrailParticlesPerStar/);
  assert.match(effects, /return Math\.min\(requested, BURST_TRAIL_PARTICLES_PER_STAR_MAX\)/);
  assert.doesNotMatch(effects, /BURST_TRAIL_PARTICLE_CAP|maxPerStar/);
  assert.match(effects, /emitBurstTrailParticle/);
  assert.match(effects, /BROCADE_MAX_STREAKS = \d+/);
  assert.match(effects, /spawnBrocadeBurst/);
  assert.doesNotMatch(effects, /emitBrocadeTrailCluster/);
  assert.doesNotMatch(shaders, /rectStretch|rectYLimit/);
  assert.match(shaders, /softHalo/);
  assert.match(shaders, /gl_FragColor = vec4\(sparkColor \* intensity, alpha\)/);
  assert.match(shaders, /float pointSize = clamp\(coreSize \+ haloPad \* 2\.0/);
  assert.match(shaders, /vec3 headSparkColor = mix\(vColor, vec3\(1\.0\), whiteCore\)/);
  assert.doesNotMatch(shaders, /projectionScale = projectionMatrix\[1\]\[1\]/);
  assert.match(canvas, /MAX_DEVICE_PIXEL_RATIO = 1\.25/);
  assert.match(canvas, /DEFAULT_CAMERA_POSITION = new THREE\.Vector3\(0, 64, 2850\)/);
  assert.match(canvas, /DEFAULT_CAMERA_TARGET = new THREE\.Vector3\(0, 1000, 0\)/);
  assert.match(canvas, /renderOverscanPx\?: number/);
  assert.match(canvas, /const renderOverscan = Math\.max\(0, renderOverscanPx\)/);
  assert.match(canvas, /const renderSurfaceLeft = renderOverscan > 0 \? -renderOverscan \/ 2 : 0/);
  assert.match(canvas, /renderOverscan > 0 \? `calc\(100% \+ \$\{renderOverscan\}px\)` : '100%'/);
  assert.match(canvas, /style=\{\{ left: renderSurfaceLeft, width: renderSurfaceWidth \}\}/);
  assert.doesNotMatch(canvas, /cameraViewOffset|setViewOffset|clearViewOffset/);
  assert.match(canvas, /trailWidthGuideDesign\?: FireworkDesign \| null/);
  assert.match(canvas, /TRAIL_WIDTH_GUIDE_STAR_INDEX = 0/);
  assert.match(canvas, /function buildTrailWidthGuideVelocity\(design: FireworkDesign\)/);
  assert.match(canvas, /function shellApexSeconds\(design: FireworkDesign, cue\?: ReplayCue\)/);
  assert.match(canvas, /const visibleAge = Math\.min\(starAge, starLife\)/);
  assert.match(canvas, /new THREE\.LineSegments\(geometry, material\)/);
  assert.match(canvas, /function disposeTrailWidthGuide\(group: THREE\.Group \| null\): void/);
  assert.match(canvas, /scene\.add\(guide\)/);
  assert.match(canvas, /scene\.remove\(guide\)/);
  assert.match(canvas, /playbackRef \? playbackRef\.current : internalElapsedRef\.current/);
  assert.match(canvas, /const isLargeJump = delta > 0\.15 && !Number\.isNaN\(renderedElapsed\)/);
  assert.match(canvas, /const isBackwardSeek =[\s\S]*targetElapsed < renderedElapsed - 0\.0001/);
  assert.match(canvas, /const isSeek = isLargeJump \|\| isBackwardSeek/);
  assert.match(canvas, /const engineMayUpdate = !isSeek \|\| now - lastEngineUpdate >= 45/);
  assert.match(canvas, /MIN_CAMERA_HEIGHT = 24/);
  assert.match(canvas, /ORBIT_FLOOR_OVERSHOOT = 0\.35/);
  assert.match(canvas, /maxPolarAngle = Math\.PI \/ 2 \+ ORBIT_FLOOR_OVERSHOOT/);
  assert.match(canvas, /function liftCameraRig/);
  assert.match(canvas, /floorLiftRef = useRef\(0\)/);
  assert.match(canvas, /if \(floorLiftRef\.current !== 0\) liftCameraRig/);
  assert.match(canvas, /if \(controls\.target\.y < GROUND_PLANE_Y\)/);
  assert.match(canvas, /MIN_CAMERA_HEIGHT - \(cam\.position\.y \+ floorLift\)/);
  assert.match(canvas, /floorLiftRef\.current = floorLift/);
  assert.match(canvas, /controls\.enableDamping = false/);
  assert.doesNotMatch(canvas, /THREE\.MathUtils\.damp\(/);
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
  // Antialias is a prop that defaults to false so the heavy full-show renderer
  // stays cheap; card hover previews opt in to avoid aliased upscaled edges.
  assert.match(canvas, /antialias = false/);
  assert.match(canvas, /antialias,/);
  assert.match(canvas, /renderer\.sortObjects = false/);
});

test('renderer keeps glow bounded while adding realistic spark density', () => {
  const engine = read('lib/fireworks/FireworksEngine.ts');
  const effects = read('lib/fireworks/Effects.ts');

  assert.match(engine, /Math\.sqrt\(Math\.max\(0, p\.size\)\)/);
  assert.match(engine, /BRIGHTNESS_BOOST = 1\.55/);
  assert.match(engine, /MAX_COLOR_INTENSITY = 1\.75/);
  assert.match(engine, /peak = 0\.14/);
  assert.match(engine, /fadeIn = p\.fadeIn && p\.mass <= 0\.003/);
  assert.match(engine, /isSmoke/);
  assert.match(engine, /clamp\(peak \* fadeIn \* fade, 0, 0\.82\)/);
  assert.match(engine, /tickPhysics\(next - cursor\)/);
  assert.match(engine, /this\.syncGeometry\(\);[\s\S]*private tickPhysics/);
  assert.match(effects, /SHELL_TRAIL_DENSITY = 0\.68/);
  assert.match(effects, /function burstTrailParticlesPerStar\(trail: BurstTrail\): number/);
  assert.match(effects, /const requested = Math\.max\(0, Math\.round\(trail\.particlesPerStar\)\)/);
  assert.match(effects, /return Math\.min\(requested, BURST_TRAIL_PARTICLES_PER_STAR_MAX\)/);
  assert.doesNotMatch(effects, /Math\.floor\(BURST_TRAIL_PARTICLE_CAP|maxPerStar/);
  assert.match(effects, /if \(!stop \|\| stop\.density <= 0\) return 0/);
  assert.match(effects, /function burstTrailBalancedAge/);
  assert.match(effects, /function burstTrailSegmentProgress/);
  assert.match(effects, /function burstTrailParticleColorAt/);
  assert.match(effects, /function burstTrailParticleSizeAt/);
  assert.match(effects, /function burstTrailHeadGapOffset/);
  assert.match(effects, /trailDistanceCredit \+= segment/);
  assert.doesNotMatch(effects, /trailDistanceCredit \+= segment \* burstTrail/);
  assert.match(effects, /const spin = clamp\(motion\.spin, 0, 8\)/);
  assert.match(effects, /rotation: spin > 0 \? rng\.next\(\) \* Math\.PI \* 2 : 0/);
  assert.match(effects, /p\.color\.setRGB\(nextTone\.r, nextTone\.g, nextTone\.b\)/);
  assert.match(effects, /p\.size = burstTrailParticleSizeAt\(particleAge, headSize, tailSize\)/);
  assert.doesNotMatch(effects, /clusterCount/);
  assert.match(effects, /const lifeMultiplier = clamp\(trail\.lifetime\.percent, 0, 2\)/);
  assert.match(effects, /Math\.max\(0, headRemainingLife\) \*/);
  assert.match(effects, /function burstTrailWideTailAlpha/);
  assert.match(effects, /const initialFadePosition = pathPosition/);
  assert.match(effects, /p\.alpha = burstTrailWideTailAlpha\(trail, fadePosition\)/);
  assert.doesNotMatch(effects, /dynamicLifeCeiling|fixedLifeCeiling/);
  assert.match(effects, /mass: 0\.006/);
  assert.match(effects, /mass: 0\.002/);
});

test('detonation only spawns designed stars and trails', () => {
  const effects = read('lib/fireworks/Effects.ts');

  assert.doesNotMatch(effects, /explodeBurst|spawnBrocadeCore|flairEffect/);
  assert.doesNotMatch(effects, /fullQuality|Brief dense white-hot flash/);
  assert.doesNotMatch(effects, /emitSparkTrail/);
  assert.match(effects, /this\.spawnEffectStar\(\{/);
  assert.match(effects, /this\.spawnBrocadeBurst\(particle, design, rng\)/);
  assert.match(effects, /this\.emitBurstTrailParticle\(/);
});

test('outer and core star layers own their heads, burst physics, and trails', () => {
  const controls = read('app/components/admin/FireworkRenderControls.tsx');
  const design = read('lib/fireworks/design.ts');
  const effects = read('lib/fireworks/Effects.ts');
  const starAppearance = controls.slice(
    controls.indexOf('function renderStarAppearance('),
    controls.indexOf('function currentBurstTrail('),
  );

  assert.match(
    controls,
    /const outerEnabled = isBrocade \? headsEnabled : design\.stars\.outer\.enabled/,
  );
  assert.match(controls, /const coreEnabled = design\.stars\.core\.enabled/);
  assert.match(controls, /renderStarLayerControls\('outer', 'Star'\)/);
  assert.match(controls, /renderStarLayerControls\('core', 'Star Inner'\)/);
  assert.match(
    controls,
    /const starControlsAlwaysOpen = controlScope === 'star' \|\| controlScope === 'starInner'/,
  );
  assert.match(controls, /collapsible=\{!starControlsAlwaysOpen\}/);
  assert.match(controls, /defaultExpanded=\{[\s\S]*starControlsAlwaysOpen/);
  assert.match(controls, /setStarLayerEnabled\(layerKey, value\)/);
  assert.match(controls, /setStarBurstRangeMid\(layerKey, 'speed'/);
  assert.match(controls, /setStarGravityUpper\(layerKey, value\)/);
  assert.match(controls, /setStarHeadSize\(layerKey, value\)/);
  assert.match(controls, /leadingControls\?: ReactNode/);
  assert.match(controls, /layerKey === 'outer' \? starControls : undefined/);
  assert.match(
    controls,
    /<div className="space-y-2\.5">[\s\S]*\{leadingControls\}[\s\S]*renderStarOpeningControls\(layerKey, controlDisabled\)[\s\S]*<SubSection title="Core">/,
  );
  assert.doesNotMatch(controls, /defaultExpanded=\{layerKey === 'outer'\}/);
  assert.doesNotMatch(starAppearance, /<SubSection title="Opening" defaultExpanded/);
  assert.doesNotMatch(starAppearance, /<SubSection title="Core" defaultExpanded/);
  assert.doesNotMatch(
    starAppearance,
    /subsectionsCollapsible|collapsible=\{subsectionsCollapsible\}/,
  );
  assert.doesNotMatch(starAppearance, /<SubSection title="Particles" defaultExpanded/);
  assert.doesNotMatch(starAppearance, /<SubSection title="Placement" defaultExpanded/);
  assert.match(controls, /renderBurstTrailControls\(layerKey\)/);
  assert.match(controls, /const title = layerKey === 'core' \? 'Trail Inner' : 'Trail'/);
  assert.match(controls, /aria-label=\{`Show \$\{title\.toLowerCase\(\)\}`\}/);
  assert.match(design, /outer: StarLayerSchema/);
  assert.match(design, /core: StarLayerSchema/);
  assert.match(design, /core: StarLayerSchema\.default\(\{[\s\S]*enabled: true/);
  assert.match(design, /core: StarLayerSchema\.parse\(\{ enabled: true \}\)/);
  assert.match(design, /enabled: outer\.enabled/);
  assert.match(design, /core: \{ enabled: headSize != null \}/);
  assert.match(design, /const StarColourPatternSchema/);
  assert.match(design, /axis: z\.enum\(\['vertical', 'horizontal'\]\)\.default\('vertical'\)/);
  assert.match(design, /\.transform\(\(value\) => Math\.min\(6, value\)\)/);
  assert.match(design, /colourPattern: StarColourPatternSchema/);
  assert.match(design, /const StarHeadOpeningSchema/);
  assert.match(design, /opening: StarHeadOpeningSchema/);
  assert.match(design, /fadePercent: z\.coerce\.number\(\)\.min\(1\)\.max\(100\)\.default\(24\)/);
  assert.match(design, /growPercent: z\.coerce\.number\(\)\.min\(1\)\.max\(100\)\.default\(22\)/);
  assert.match(design, /const StarHeadClosingSchema/);
  assert.match(design, /closing: StarHeadClosingSchema/);
  assert.match(design, /endPercent: z\.coerce\.number\(\)\.min\(0\)\.max\(100\)\.default\(0\)/);
  assert.match(design, /shrinkPercent: z\.coerce\.number\(\)\.min\(1\)\.max\(100\)\.default\(22\)/);
  assert.match(controls, /function renderStarClosingControls/);
  assert.match(controls, /<SubSection title="Closing">/);
  assert.match(controls, /label="Burn time"/);
  assert.match(controls, /label="Burn spread"/);
  assert.match(controls, /label="Closing colour"/);
  assert.match(controls, /function SwitchField[\s\S]*<InfoTooltip text=\{hint\} \/>/);
  assert.doesNotMatch(controls, /<FieldHint>\{hint\}<\/FieldHint>/);
  assert.match(
    controls,
    /\{colourEnabled \? \([\s\S]*label="Closing colour"[\s\S]*label="Colour close time"/,
  );
  assert.match(controls, /\{sizeEnabled \? \([\s\S]*label="Final size"[\s\S]*label="Shrink time"/);
  assert.match(controls, /setLayerBurstLifeHalfWidth/);
  assert.match(design, /function legacyOuterLayerFallback/);
  assert.match(design, /parseStarLayerInput\(stars\.outer, outerFallback\)/);
  assert.match(design, /parseStarLayerInput\(stars\.core, coreLayerFallback\(outer\)\)/);
  assert.match(effects, /private spawnStarLayer/);
  assert.match(effects, /const layer = design\.stars\[layerKey\]/);
  assert.match(effects, /if \(!layer\.enabled\) return/);
  assert.match(effects, /const styleIndex = layerKey === 'core' \? 1 : 0/);
  assert.match(effects, /this\.starColor\(design, layer, layerKey, color, i, count, rng\)/);
  assert.match(effects, /function starOpeningProgress/);
  assert.match(effects, /lifeReferenceSeconds \* clamp\(percent \/ 100, 0\.01, 1\)/);
  assert.match(effects, /function starOpeningColor/);
  assert.match(effects, /function starOpeningSize/);
  assert.match(effects, /function starClosingProgress/);
  assert.match(effects, /function starClosingColor/);
  assert.match(effects, /function starClosingSize/);
  assert.match(effects, /function starClosingOpacity/);
  assert.match(effects, /private starOpeningLifeReference/);
  assert.match(effects, /private starLifeRandomness/);
  assert.match(
    effects,
    /const openingLifeReference = this\.starOpeningLifeReference\(design, layer\)/,
  );
  assert.match(effects, /const lifeRandomness = this\.starLifeRandomness\(layer\)/);
  assert.match(effects, /openingLifeReference,/);
  assert.match(
    effects,
    /const elapsedSeconds =[\s\S]*Math\.max\(0, particle\.maxLife - particle\.life\)/,
  );
  assert.match(
    effects,
    /const initialOpeningColor = starOpeningColor\(layer\.head, color, 0, openingLifeReference\)/,
  );
  assert.match(effects, /const initialColor = starClosingColor\(/);
  assert.match(
    effects,
    /const initialOpeningSize = starOpeningSize\(layer\.head, sizeBudget, 0, openingLifeReference\)/,
  );
  assert.match(effects, /const initialClosingSize = starClosingSize\(/);
  assert.match(effects, /const initialSize = Math\.min\(initialOpeningSize, initialClosingSize\)/);
  assert.match(effects, /const initialAlpha = starClosingOpacity\(layer\.head, o\.life, o\.life\)/);
  assert.match(effects, /alpha: initialAlpha/);
  assert.match(effects, /layer\.head\.opening\.colour\.enabled/);
  assert.match(effects, /layer\.head\.opening\.size\.enabled/);
  assert.match(effects, /!layer\.head\.closing\.colour\.enabled/);
  assert.match(effects, /layer\.head\.closing\.colour\.enabled/);
  assert.match(effects, /layer\.head\.closing\.size\.enabled/);
  assert.match(effects, /const closingLifeReference = Math\.max\(0\.1, particle\.maxLife\)/);
  assert.match(
    effects,
    /particle\.alpha = starClosingOpacity\(layer\.head, particle\.life, closingLifeReference\)/,
  );
  assert.match(effects, /private starColourPatternColor/);
  assert.match(effects, /const pattern = layer\.colourPattern/);
  assert.match(effects, /function starPatternPosition/);
  assert.match(effects, /axis: 'vertical' \| 'horizontal'/);
  assert.match(effects, /axis === 'horizontal' \? Math\.cos\(angle\) : Math\.sin\(angle\)/);
  assert.match(effects, /axis === 'horizontal' \? direction\.x : direction\.y/);
  assert.match(effects, /pattern\.mode === 'bands'/);
  assert.match(effects, /pattern\.mode === 'stripes'/);
  assert.match(effects, /const weightedColourAt = \(position: number\): THREE\.Color =>/);
  assert.match(effects, /clamp\(position, 0, 0\.999999\) \* totalWeight/);
  assert.match(
    effects,
    /weightedColourAt\(starPatternPosition\(design, pattern\.axis, index, count\)\)/,
  );
  assert.match(effects, /const baseColor = layerColor \?\? color/);
  assert.match(
    effects,
    /this\.starColourPatternColor\(design, layer, baseColor, index, count, rng\)/,
  );
  assert.match(effects, /return rng\.next\(\) > 1 - accentRatio \? secondary : baseColor/);
  assert.match(effects, /this\.spawnEffectStar\(\{[\s\S]*layer,[\s\S]*styleIndex/);
  assert.match(effects, /const trailsVisible = trailBudget > 0/);
  assert.match(effects, /shape: particleShape/);
  assert.match(effects, /mass: 0\.0005/);
  assert.doesNotMatch(
    effects,
    /headsVisible|stars\.heads|starSizeFor|starDecay|mass: heads \?|shape: heads \?/,
  );
  assert.doesNotMatch(effects, /spawnPistil|design\.pistil|this\.flairEffect\(p, dt, t, o\.seed/);
});

test('unified burst trails are validated, migrated, and exposed through shared controls', () => {
  const controls = read('app/components/admin/FireworkRenderControls.tsx');
  const burstTrailControls = controls.slice(
    controls.indexOf('function renderBurstTrailControls'),
    controls.indexOf('function renderStarLayerControls'),
  );
  const design = read('lib/fireworks/design.ts');
  const timing = read('lib/fireworks/timing.ts');
  const migration = read('supabase/migrations/20260615143000_unified_burst_trail_model.sql');
  const squareTrailMigration = read(
    'supabase/migrations/20260617060841_calibrated_square_trail_defaults.sql',
  );
  const slider = read('app/components/ui/SliderField.tsx');

  assert.match(design, /burstTrail: BurstTrailSchema/);
  assert.match(design, /FIREWORK_RENDER_DEFAULT_KEYS[\s\S]*'burstTrail'/);
  assert.match(design, /export function makeBurstTrailPreset/);
  assert.match(design, /export function normaliseBurstTrailStops/);
  assert.match(design, /\.slice\(0, BURST_TRAIL_MAX_STOPS\)/);
  assert.match(design, /\.sort\(\(a, b\) => a\.position - b\.position\)/);
  assert.match(design, /total > 0[\s\S]*circle: round2\(\(weights\.circle \/ total\) \* 100\)/);
  assert.match(design, /density: round2\(Math\.min\(4, Math\.max\(0, stop\.density\)\)\)/);
  assert.doesNotMatch(design, /export function applyBurstTrailFrontClump/);
  assert.match(design, /inferBurstTrailFromLegacy/);
  assert.match(design, /compiled\.burstTrail/);
  assert.match(
    timing,
    /layers\.map\(\(layer, index\) =>[\s\S]*layer\.burstTrail\.enabled[\s\S]*layer\.burstTrail\.lifetime\.percent/,
  );
  assert.match(timing, /function launchTrailEndSeconds/);
  assert.match(timing, /liftParticles\.lifetime\.afterglowSeconds/);
  assert.match(timing, /liftTrailEndSeconds/);

  // The trail panel groups controls into collapsible SubSection dropdowns. The
  // old per-section density editor is replaced by particle size, placement,
  // spacing curve, angle spread, rotation, and per-particle life controls.
  assert.match(controls, /const TRAIL_PRESET_OPTIONS/);
  assert.match(controls, /value=\{burstTrail\.preset\}/);
  assert.match(controls, /function SubSection/);
  assert.match(controls, /title="Particles"/);
  assert.match(controls, /title="Placement"/);
  assert.match(controls, /label="Amount"/);
  assert.match(controls, /max=\{BURST_TRAIL_PARTICLES_PER_STAR_MAX\}/);
  assert.doesNotMatch(controls, /numberInputMax=\{null\}/);
  assert.match(controls, /Particle shape/);
  assert.match(controls, /label="Particle size"/);
  assert.match(controls, /label="Head scale"/);
  assert.match(controls, /label="Tail scale"/);
  assert.match(controls, /label="Size random"/);
  assert.match(controls, /label="Rotation"/);
  assert.match(controls, /weights\.square >= 99\.5/);
  assert.match(controls, /weights\.triangle <= 0\.5/);
  assert.doesNotMatch(controls, /const TRAIL_ENDPOINT_LABELS|function trailEndpointStops/);
  assert.match(controls, /function setTrailBias/);
  assert.match(controls, /label="Head-tail balance"/);
  assert.match(controls, /label="Spacing curve"/);
  assert.match(controls, /label="Gap random"/);
  assert.match(controls, /label="Head gap"/);
  assert.match(controls, /label="Front angle"/);
  assert.match(controls, /const TRAIL_FRONT_SPREAD_ANGLE_MIN = 1/);
  assert.match(
    controls,
    /label="Front angle"[\s\S]*min=\{TRAIL_FRONT_SPREAD_ANGLE_MIN\}[\s\S]*max=\{TRAIL_FRONT_SPREAD_ANGLE_MAX\}/,
  );
  assert.match(controls, /label="Tail angle"/);
  assert.match(controls, /label="Particle life"/);
  assert.match(controls, /label="Life random"/);
  assert.doesNotMatch(controls, /<FieldLabel>Fade mode<\/FieldLabel>/);
  assert.doesNotMatch(controls, /label="Fade time"/);
  assert.doesNotMatch(controls, /TRAIL_FADE_MODE_OPTIONS/);
  assert.doesNotMatch(controls, /\$\{label\} weight/);
  assert.doesNotMatch(controls, /\$\{label\} size/);
  assert.doesNotMatch(controls, /label="Trail length"/);
  assert.doesNotMatch(controls, /label="Front width"/);
  assert.doesNotMatch(controls, /label="Tail width"/);
  assert.match(controls, /label="Brightness"/);
  assert.match(controls, /label="Fade softness"/);
  assert.match(controls, /label="Flicker"/);
  assert.match(design, /preset: 'custom'[\s\S]*colourMode: 'starFade'[\s\S]*particlesPerStar: 178/);
  assert.match(design, /BURST_TRAIL_FRONT_SPREAD_ANGLE_MAX = 10/);
  assert.match(design, /width: \{ front: 10, tail: 0, curve: 1 \}/);
  assert.match(
    design,
    /front: z\.coerce[\s\S]*Math\.min\(BURST_TRAIL_FRONT_SPREAD_ANGLE_MAX, value\)/,
  );
  assert.match(design, /particleSize: \{ base: 1\.2, headScale: 1, tailScale: 0\.35/);
  assert.match(design, /placement: \{ headGapPercent: 60 \}/);
  assert.match(design, /spacing: \{ curve: 1, jitterPercent: 18 \}/);
  assert.match(
    design,
    /lifetime: \{[\s\S]*mode: 'dynamic'[\s\S]*percent: 0\.18[\s\S]*baseSeconds: 8/,
  );
  assert.match(design, /spin: 0/);
  assert.match(
    design,
    /burstTrailStop\(0, 1, 2\.68, 0, \{ circle: 0, square: 100, triangle: 0 \}\)/,
  );
  assert.match(
    design,
    /burstTrailStop\(100, 1, 0\.08, 0, \{ circle: 0, square: 100, triangle: 0 \}\)/,
  );
  assert.match(squareTrailMigration, /'particlesPerStar', 178/);
  assert.match(squareTrailMigration, /'colourMode', 'starFade'/);
  assert.match(squareTrailMigration, /'width'[\s\S]*'front', 20[\s\S]*'tail', 0/);
  assert.match(squareTrailMigration, /'particleSize'[\s\S]*'base', 1\.2[\s\S]*'tailScale', 0\.35/);
  assert.match(squareTrailMigration, /'placement'[\s\S]*'headGapPercent', 60/);
  assert.match(squareTrailMigration, /'spacing'[\s\S]*'curve', 1[\s\S]*'jitterPercent', 18/);
  assert.match(squareTrailMigration, /'mode', 'dynamic'[\s\S]*'percent', 18/);
  assert.match(squareTrailMigration, /'spin', 0/);
  assert.match(
    squareTrailMigration,
    /'shapeWeights'[\s\S]*'circle', 0[\s\S]*'square', 100[\s\S]*'triangle', 0/,
  );
  assert.match(
    squareTrailMigration,
    /coalesce\(render_overrides_json #>> '\{burstTrail,preset\}', ''\) <> 'custom'/,
  );
  // Cut / replaced controls.
  assert.doesNotMatch(controls, /label="Clump"|applyBurstTrailFrontClump/);
  assert.doesNotMatch(controls, /label="Trail weighting"|TRAIL_WEIGHTING_OPTIONS/);
  assert.doesNotMatch(controls, /Size variation/);
  assert.doesNotMatch(controls, /Taper curve/);
  assert.doesNotMatch(controls, /Life variation/);
  assert.doesNotMatch(burstTrailControls, /Flicker chance|Flicker strength|Flicker life/);
  // The Motion settings sheet was removed entirely.
  assert.doesNotMatch(controls, /Motion settings|Trail motion|Width guide|SheetContent/);
  // Head-orb appearance is a shared, grouped helper with Opening/Core/Glow dropdowns.
  assert.match(controls, /function renderStarAppearance/);
  assert.match(controls, /title="Opening"/);
  assert.match(controls, /title="Core"/);
  assert.match(controls, /title="Glow"/);
  assert.match(controls, /label="Colour fade"/);
  assert.match(controls, /label="Opening colour"/);
  assert.match(controls, /label="Colour fade time"/);
  assert.match(controls, /label="Size growth"/);
  assert.match(controls, /label="Start size"/);
  assert.match(controls, /label="Grow time"/);
  assert.match(controls, /function setLayerHeadOpeningValue/);
  assert.match(controls, /label="Core blur"/);
  assert.match(controls, /label="Star glow radius"/);
  assert.match(controls, /label="Star glow blur"/);
  assert.match(controls, /label="Star glow fade"/);
  assert.match(controls, /label="Background glow strength"/);
  assert.match(controls, /label="Background glow size"/);
  assert.match(controls, /label="Background blur"/);
  assert.match(controls, /label="Background fade"/);
  assert.match(controls, /label="Core fade"/);
  assert.match(controls, /function CalibratedSliderField/);
  assert.match(controls, /function rawToCalibrated/);
  assert.match(controls, /function calibratedToRaw/);
  assert.match(controls, /function withCalibrationDefault/);
  assert.match(controls, /const CALIBRATED_APPEARANCE_DEFAULT = 50/);
  assert.match(controls, /calibrationDefaults\?: JsonRecord/);
  assert.match(controls, /const calibrationSource = calibrationDefaults \?\? defaults/);
  assert.match(controls, /range=\{backgroundGlowSizeRange\}/);
  assert.doesNotMatch(controls, /label="Glow padding"/);
  assert.doesNotMatch(controls, /formatPixels/);
  assert.doesNotMatch(controls, /label="White core size"|label="White core blur"/);
  assert.doesNotMatch(controls, /Reset to preset/);
  assert.doesNotMatch(controls, /Advanced trails|Shape stops|Add stop|Remove trail stop/);
  assert.doesNotMatch(controls, /normaliseWeights|updateStop|canAddStop/);
  assert.match(controls, /showNumberInput/);
  // SliderField number inputs: no native spinners, no step-validation tooltip.
  assert.match(slider, /showNumberInput\?: boolean/);
  assert.match(slider, /numberInputMax\?: number \| null/);
  assert.match(slider, /max=\{inputMax \?\? undefined\}/);
  assert.match(slider, /<Input/);
  assert.match(slider, /step="any"/);
  assert.match(slider, /appearance:textfield/);

  assert.match(migration, /jsonb_set\([\s\S]*model_json,[\s\S]*'\{renderDefaults,burstTrail\}'/);
  assert.match(
    migration,
    /jsonb_set\([\s\S]*coalesce\(fw\.render_overrides_json, '\{\}'::jsonb\),[\s\S]*'\{burstTrail\}'/,
  );
  assert.match(migration, /denseBrocade/);
  assert.doesNotMatch(migration, /alter table/i);
});

test('launch smoke and lift particles are schema-driven, tunable, and RNG-isolated', () => {
  const controls = read('app/components/admin/FireworkRenderControls.tsx');
  const design = read('lib/fireworks/design.ts');
  const effects = read('lib/fireworks/Effects.ts');
  const engine = read('lib/fireworks/FireworksEngine.ts');
  const smokeSchemaStart = design.indexOf('    smoke: z');
  const smokeSchemaEnd = design.indexOf('  });', smokeSchemaStart);
  const smokeSchema = design.slice(smokeSchemaStart, smokeSchemaEnd);

  assert.match(design, /const LaunchSchema = z/);
  assert.match(design, /const LaunchShellSchema = z/);
  assert.match(
    design,
    /export const LAUNCH_SHELL_SHAPES = \['circle', 'orb', 'square', 'triangle'\]/,
  );
  assert.match(design, /shell: LaunchShellSchema/);
  assert.match(design, /const LaunchLiftParticlesSchema = z/);
  assert.match(design, /liftParticles: LaunchLiftParticlesSchema/);
  assert.match(design, /const LaunchShellTrailSchema = z/);
  assert.match(design, /shape: z\.enum\(LAUNCH_SHELL_SHAPES\)/);
  assert.match(design, /visible: z\.boolean\(\)\.default\(true\)/);
  assert.match(design, /sizeScale: z\.coerce\.number\(\)\.min\(0\.25\)\.max\(4\)\.default\(1\)/);
  assert.match(design, /brightness: z\.coerce\.number\(\)\.min\(0\)\.max\(3\)\.default\(1\)/);
  assert.match(design, /glowStrength:[\s\S]*DEFAULT_HEAD_GLOW_STRENGTH/);
  assert.match(design, /trail: LaunchShellTrailSchema/);
  assert.match(design, /tubeDiameter: z\.coerce\.number\(\)\.min\(0\)\.max\(90\)\.default\(0\)/);
  assert.match(design, /frontAngle: z\.coerce\.number\(\)\.min\(0\)\.max\(60\)\.default\(0\)/);
  assert.match(design, /tailAngle: z\.coerce\.number\(\)\.min\(0\)\.max\(60\)\.default\(0\)/);
  assert.match(
    design,
    /amount: z\.coerce\.number\(\)\.int\(\)\.min\(0\)\.max\(1000\)\.default\(100\)/,
  );
  assert.match(design, /height: z\.coerce[\s\S]*Math\.min\(100, value\)[\s\S]*\.default\(100\)/);
  assert.match(design, /shapeWeights: BurstTrailShapeWeightsSchema/);
  assert.match(design, /particleSize:[\s\S]*headScale:[\s\S]*tailScale/);
  assert.match(design, /lifetime:[\s\S]*baseSeconds:[\s\S]*afterglowSeconds/);
  assert.match(design, /spacing:[\s\S]*clusterStrength[\s\S]*pathSamples/);
  assert.match(
    design,
    /motion:[\s\S]*gravity:[\s\S]*drag:[\s\S]*spin[\s\S]*swirlStrength[\s\S]*swirlLoopCount[\s\S]*swirlLoopLength[\s\S]*swirlLoopHeight/,
  );
  assert.match(design, /smoke:[\s\S]*enabled:[\s\S]*particles:[\s\S]*drift:[\s\S]*height/);
  assert.doesNotMatch(smokeSchema, /colour:/);
  assert.match(design, /DEFAULT_LAUNCH_SMOKE_COLOR/);
  assert.match(design, /launch: LaunchSchema/);
  assert.match(design, /FIREWORK_RENDER_DEFAULT_KEYS[\s\S]*'launch'/);
  assert.match(design, /FIREWORK_RENDER_DEFAULT_KEYS[\s\S]*'colour'/);
  assert.match(design, /function legacySmokeParticlesFromSource/);
  assert.match(design, /function legacyLiftParticlesFromSource/);
  assert.match(design, /variantLegacySmokeParticles/);
  assert.match(design, /colourEnabled/);
  assert.match(design, /if \(!colourEnabled\) \{[\s\S]*compiled\.color = \{ r: 1, g: 1, b: 1 \}/);
  assert.match(design, /delete compiled\.secondaryColor/);
  assert.match(design, /for \(const layerKey of \['outer', 'core'\]\)/);
  assert.match(design, /layer\.color = \{ r: 1, g: 1, b: 1 \}/);
  assert.match(design, /layer\.colourPattern = \{/);
  assert.match(design, /count: 1/);
  assert.doesNotMatch(design, /compiled\.pistil/);

  assert.match(engine, /smokeRng: createSeededRng\(mixSeed\(seed, 'launch-smoke'\)\)/);
  assert.match(engine, /liftRng: createSeededRng\(mixSeed\(seed, 'lift-particles'\)\)/);
  assert.match(effects, /smokeRng\?: RandomSource/);
  assert.match(effects, /liftRng\?: RandomSource/);
  assert.match(effects, /this\.spawnMortarSmoke\(position, design, smokeRng\)/);
  assert.match(effects, /let liftPreviousPosition: Pos \| null = null/);
  assert.match(effects, /function launchShellShapeValue/);
  assert.match(effects, /headShapeValue\(shell\.glowStrength, 0\)/);
  assert.match(effects, /resolveLaunchColor\(shell\.colour, liftColor, rng\)\.multiplyScalar/);
  assert.match(effects, /Math\.max\(size, 110\) \* shell\.sizeScale/);
  assert.match(effects, /const guidedShellVisible = shell\.visible && usesGuidedLiftPath/);
  assert.match(
    effects,
    /shape:[\s\S]*shell\.visible && !guidedShellVisible[\s\S]*launchShellShapeValue\(shell\)[\s\S]*HIDDEN_PARTICLE_SHAPE/,
  );
  assert.match(effects, /previousPosition = liftPreviousPosition/);
  assert.match(effects, /this\.shellEffect\([\s\S]*previousPosition/);
  assert.match(effects, /const liftCount =[\s\S]*liftParticles\.amount \/ 100/);
  assert.match(effects, /const brocadeLift = isBrocadeCrown\(design\)/);
  assert.doesNotMatch(effects, /const brocadeLift = streakLift/);
  assert.match(effects, /liftParticles\.spacing\.pathSamples/);
  assert.match(effects, /function liftPathPoint/);
  assert.match(effects, /function shellTrailSpreadAngle/);
  assert.match(effects, /function shellTrailTubeRadius/);
  assert.match(effects, /SHELL_TRAIL_CLEAR_AGE_START/);
  assert.match(effects, /SHELL_TRAIL_CLEAR_AGE_END/);
  assert.match(effects, /const lockToShellPath = liftTubeRadius <= 0/);
  assert.match(effects, /const scatter = brocadeLift[\s\S]*burstTrailScatterOffset/);
  assert.match(effects, /function flatLiftScatterOffset/);
  assert.match(effects, /: flatLiftScatterOffset\(liftTubeRadius, liftRng\)/);
  assert.match(effects, /function usesGuidedLiftPath/);
  assert.match(effects, /function liftGuidedPosition/);
  assert.match(effects, /private spawnGuidedLaunchShell/);
  assert.match(
    effects,
    /this\.spawnGuidedLaunchShell\(guidedShellPoint, design, shellColor, shellSize, dt\)/,
  );
  assert.match(effects, /applyLiftSwirlToShell/);
  assert.match(effects, /applyLiftSwirlToShell\(particle, dt, time, liftParticles, liftAge\)/);
  assert.doesNotMatch(effects, /particle\.vz \+= Math\.sin\(phase\) \* force \* dt/);
  assert.match(effects, /liftParticles\.motion\.swirlStrength/);
  assert.match(effects, /liftParticles\.motion\.swirlLoopCount/);
  assert.match(effects, /liftParticles\.motion\.swirlLoopLength/);
  assert.match(effects, /liftParticles\.motion\.swirlLoopHeight/);
  assert.match(effects, /liftParticles\.spacing\.clusterStrength/);
  assert.match(effects, /y: Math\.max\(liftOriginY, base\.y \+ swirl\.y\)/);
  assert.match(effects, /LIFT_SWIRL_START_AGE/);
  assert.match(effects, /LIFT_SWIRL_FULL_AGE/);
  assert.match(effects, /function liftLoopProgress/);
  assert.match(effects, /function liftSwirlPhase/);
  assert.match(effects, /const pathPhase = loopCount > 0 \? liftLoopProgress/);
  assert.match(effects, /z: 0/);
  assert.match(effects, /const sampleTime = from \? time - \(1 - progress\) \* dt : time/);
  assert.match(effects, /Math\.max\(visibleRadius, visibleLoopHeight \* 0\.55\)/);
  assert.match(effects, /const smokeCount =[\s\S]*smoke\.particles \/ 100/);
  assert.match(effects, /const smokeColor = DEFAULT_LAUNCH_SMOKE_COLOR/);
  assert.match(effects, /liftParticleDensityScale/);
  assert.doesNotMatch(effects, /spawnMortarSmoke\(position, design\.mortar\.smokeParticles, rng\)/);

  assert.match(controls, /function renderLiftParticleControls/);
  assert.match(controls, /function renderLaunchShellParticleControls/);
  assert.match(controls, /function renderLaunchShellTrailControls/);
  assert.match(controls, /title="Shell particle"/);
  assert.match(controls, /label="Show shell particle"[\s\S]*setLaunchValue\('shell', 'visible'/);
  assert.match(controls, /<FieldLabel>Shell shape<\/FieldLabel>/);
  assert.match(controls, /label="Shell colour"[\s\S]*setLaunchValue\('shell', 'colour'/);
  assert.match(controls, /label="Shell size"[\s\S]*setLaunchValue\('shell', 'sizeScale'/);
  assert.match(controls, /label="Shell brightness"[\s\S]*setLaunchValue\('shell', 'brightness'/);
  assert.match(controls, /label="Shell glow"[\s\S]*setLaunchValue\('shell', 'glowStrength'/);
  assert.match(controls, /title="Shell trail"/);
  assert.match(
    controls,
    /label="Tube diameter"[\s\S]*max=\{SHELL_TRAIL_TUBE_DIAMETER_MAX\}[\s\S]*setLaunchNestedValue\('shell', 'trail', 'tubeDiameter'/,
  );
  assert.match(
    controls,
    /label="Front angle"[\s\S]*setLaunchNestedValue\('shell', 'trail', 'frontAngle'/,
  );
  assert.match(
    controls,
    /label="Tail angle"[\s\S]*setLaunchNestedValue\('shell', 'trail', 'tailAngle'/,
  );
  assert.match(
    controls,
    /label="Width curve"[\s\S]*setLaunchNestedValue\('shell', 'trail', 'curve'/,
  );
  assert.match(controls, /function renderSmokeControls/);
  assert.match(controls, /title="Lift particles"/);
  assert.match(controls, /title="Smoke"/);
  assert.match(controls, /checked=\{liftParticlesEnabled\}/);
  assert.match(controls, /checked=\{smokeEnabled\}/);
  assert.match(
    controls,
    /const LIFT_PARTICLE_AMOUNT_MAX = 1000[\s\S]*label="Amount"[\s\S]*setLaunchValue\('liftParticles', 'amount'/,
  );
  assert.match(
    controls,
    /label="Colour"[\s\S]*setLaunchValue\([\s\S]*'liftParticles',[\s\S]*'colour'/,
  );
  assert.match(
    controls,
    /<FieldLabel>Particle shape<\/FieldLabel>[\s\S]*onChange=\{setParticleShape\}/,
  );
  assert.match(controls, /label="Head scale"/);
  assert.match(controls, /label="Tail scale"/);
  assert.match(controls, /label="Afterglow"/);
  assert.match(controls, /label="Flicker chance"/);
  assert.match(controls, /label="Flicker strength"/);
  assert.match(controls, /label="Flicker life"/);
  assert.match(controls, /inputAriaLabel="Lift gravity value"/);
  assert.match(controls, /inputAriaLabel="Lift drag value"/);
  assert.match(controls, /inputAriaLabel="Lift inherited speed value"/);
  assert.match(controls, /inputAriaLabel="Lift turbulence value"/);
  assert.match(controls, /label="Path fill"/);
  assert.match(controls, /label="Cluster strength"/);
  assert.match(controls, /label="Ascent swirl"/);
  assert.match(controls, /label="Swirl radius"/);
  assert.match(controls, /label="Loop count"/);
  assert.match(controls, /label="Loop length"/);
  assert.match(controls, /label="Loop height"/);
  assert.match(controls, /label="Loop speed"/);
  assert.match(
    controls,
    /controlScope === 'launchTrail'[\s\S]*renderLaunchShellTrailControls\(\)[\s\S]*renderLiftParticleControls\(\)/,
  );
  assert.match(
    controls,
    /label="Rise height"[\s\S]*formatValue=\{formatPercent\}[\s\S]*setLaunchValue\('liftParticles', 'height'/,
  );
  assert.match(controls, /label="Smoke particles"[\s\S]*setLaunchValue\('smoke', 'particles'/);
  assert.doesNotMatch(controls, /label="Smoke colour"|setLaunchValue\('smoke', 'colour'/);
  assert.match(controls, /label="Smoke size"/);
  assert.match(controls, /label="Smoke life"/);
  assert.match(controls, /label="Smoke spread"/);
  assert.match(controls, /label="Smoke drift"/);
  assert.match(controls, /label="Rise height"[\s\S]*setLaunchValue\('smoke', 'height'/);
});

test('effect editor canonicalises render defaults for shared controls', () => {
  const editor = read('app/(admin)/admin/effects/[id]/EffectEditor.tsx');
  const controls = read('app/components/admin/FireworkRenderControls.tsx');
  const design = read('lib/fireworks/design.ts');

  assert.match(design, /export function canonicaliseEffectModelJson/);
  assert.match(design, /FIREWORK_RENDER_DEFAULT_KEYS[\s\S]*'size'/);
  assert.match(design, /FIREWORK_RENDER_DEFAULT_KEYS[\s\S]*'liftVelocity'/);
  assert.match(design, /FIREWORK_RENDER_DEFAULT_KEYS[\s\S]*'launch'/);
  assert.match(design, /FIREWORK_RENDER_DEFAULT_KEYS[\s\S]*'geometryTuning'/);
  assert.match(
    design,
    /`renderDefaults` wins so old top-level values cannot fight the live editor/,
  );
  assert.match(design, /deepMergeDesign\(topLevelDefaults, existingDefaults\)/);
  assert.match(design, /return canonicaliseEffectModelJson\(baseModel\)\.renderDefaults/);
  assert.match(
    editor,
    /JSON\.stringify\(canonicaliseEffectModelJson\(effect\.modelJson\), null, 2\)/,
  );
  assert.match(
    editor,
    /const draft = cloneRecord\(canonicaliseEffectModelJson\(parsedModel\.value\)\)/,
  );
  assert.match(
    editor,
    /const savedModel = copySelectedStyleDefaultsIntoModel\(parsedModel\.value\)/,
  );
  assert.match(editor, /modelJson: savedModelText/);
  assert.match(controls, /const STAR_COUNT_MAX = 100/);
  assert.match(controls, /const STAR_SIZE_MIN = 10/);
  assert.match(controls, /const STAR_SIZE_MAX = 1000/);
  assert.match(controls, /function setStarCount\(layerKey: StarLayerKey, value: number\)/);
  assert.match(controls, /brocade\.streakCount = count/);
  assert.doesNotMatch(controls, /draft\.size = value/);
  assert.match(controls, /const usesBrocadeStarPath = isBrocade && layerKey === 'outer'/);
  assert.match(
    controls,
    /<SliderField\s+label="Star count"[\s\S]*max=\{STAR_COUNT_MAX\}[\s\S]*setStarCount\(layerKey, value\)/,
  );
  assert.match(
    controls,
    /const starCount = usesBrocadeStarPath[\s\S]*design\.brocade\.streakCount \?\? design\.size[\s\S]*: layer\.count/,
  );
  assert.match(
    controls,
    /setStarBurstRangeMid\(layerKey, 'speed', value, BROCADE_SPEED_HALF_WIDTH\)/,
  );
  assert.match(controls, /setStarHeadSize\(layerKey, value\)/);
  assert.match(controls, /setStarGlowStrength\(layerKey, value\)/);
  assert.match(
    controls,
    /const LIFT_VELOCITY_OPTIONS = \[[\s\S]*velocity: 7[\s\S]*velocity: 15[\s\S]*velocity: 20[\s\S]*value: 'custom'/,
  );
  assert.match(controls, /role="radiogroup"[\s\S]*aria-label="Lift velocity"/);
  assert.match(controls, /role="radio"[\s\S]*aria-checked=\{active\}/);
  assert.match(
    controls,
    /<PanelSection title="Launch" collapsible defaultExpanded=\{false\}>[\s\S]*renderLiftVelocityControl\([\s\S]*renderBoomControl\(\)[\s\S]*<\/PanelSection>/,
  );
  assert.match(
    controls,
    /\{afterBurst\}[\s\S]*renderLiftParticleControls\(\)[\s\S]*renderSmokeControls\(\)/,
  );
  assert.match(controls, /title="Lift particles"[\s\S]*checked=\{liftParticlesEnabled\}/);
  assert.match(controls, /title="Smoke"[\s\S]*checked=\{smokeEnabled\}/);
  assert.doesNotMatch(controls, /title="Pistil"|aria-label="Show stars"/);
  assert.match(
    controls,
    /label="Custom velocity"[\s\S]*max=\{40\}[\s\S]*setRenderValue\('liftVelocity', round2\(value\)\)/,
  );
  assert.match(
    controls,
    /label="Star size"[\s\S]*min=\{usesBrocadeStarPath \? BROCADE_HEAD_SIZE_MIN : STAR_SIZE_MIN\}[\s\S]*max=\{usesBrocadeStarPath \? BROCADE_HEAD_SIZE_MAX : STAR_SIZE_MAX\}/,
  );
  assert.match(
    design,
    /const DEFAULT_STAR_HEAD_SIZE = 360[\s\S]*size: z\.coerce\.number\(\)\.min\(10\)\.max\(1000\)\.default\(DEFAULT_STAR_HEAD_SIZE\)/,
  );
  assert.doesNotMatch(`${editor}\n${controls}\n${design}`, /MIN_RENDER_SIZE|Math\.max\(20/);
});

test('world uses a crisp procedural grid floor and instanced launch hardware', () => {
  const world = read('lib/fireworks/World.ts');
  const engine = read('lib/fireworks/FireworksEngine.ts');
  const canvas = read('app/components/app/FireworkReplayCanvas.tsx');

  assert.match(world, /export type FireworkSceneMode = 'night' \| 'day'/);
  assert.match(world, /MINOR_GRID_STEP = 62\.5/);
  assert.match(world, /MAJOR_GRID_STEP = MINOR_GRID_STEP \* 4/);
  assert.match(world, /MINOR_GRID_LINE_WIDTH = 0\.3/);
  assert.match(world, /MAJOR_GRID_LINE_WIDTH = 0\.55/);
  assert.match(world, /HORIZON_GROUND_RADIUS = 28000/);
  assert.match(world, /HORIZON_GROUND_SEGMENTS = 192/);
  assert.match(world, /STAR_COUNT = 410/);
  assert.match(world, /STAR_MIN_HEIGHT = 0\.08/);
  assert.match(world, /STAR_HEIGHT_EXPONENT = 0\.55/);
  assert.match(world, /uniform float uDaylight/);
  assert.match(world, /varying vec3 vSkyDirection/);
  assert.match(world, /varying float vSignedHeight/);
  assert.match(world, /vHeight = clamp\(vSignedHeight, 0\.0, 1\.0\)/);
  assert.match(world, /vec3 dayBelowHorizon = vec3\(0\.018, 0\.11, 0\.22\)/);
  assert.match(world, /vec3 dayHorizon = vec3\(0\.12, 0\.34, 0\.62\)/);
  assert.match(world, /vec3 dayMid = vec3\(0\.06, 0\.28, 0\.62\)/);
  assert.match(world, /vec3 dayZenith = vec3\(0\.008, 0\.07, 0\.26\)/);
  assert.match(world, /smoothstep\(0\.0, 0\.38, vHeight\)/);
  assert.match(world, /smoothstep\(0\.24, 0\.76, vHeight\)/);
  assert.match(world, /smoothstep\(-0\.04, 0\.08, vSignedHeight\)/);
  assert.match(world, /vec3 sunDirection = normalize\(vec3\(0\.58, 0\.68, -0\.46\)\)/);
  assert.match(world, /float sunHalo = pow\(sunAlignment, 72\.0\)/);
  assert.match(world, /float sunCore = pow\(sunAlignment, 420\.0\)/);
  assert.match(world, /vec3 color = nightColor/);
  assert.match(world, /float alpha = nightAlpha/);
  assert.match(world, /float alpha = feather \* 0\.96/);
  assert.match(world, /float horizonOffset = vSignedHeight - 0\.026/);
  assert.match(world, /float horizonWidth = horizonOffset > 0\.0 \? 0\.5 : 0\.018/);
  assert.match(world, /const heightRoll = Math\.pow\(rng\(\), STAR_HEIGHT_EXPONENT\)/);
  assert.match(world, /const y = STAR_MIN_HEIGHT \+ heightRoll \* \(1 - STAR_MIN_HEIGHT\)/);
  assert.match(world, /setSceneMode\(sceneMode: FireworkSceneMode\)/);
  assert.match(world, /this\.starfield\.visible = daylight < 0\.5/);
  assert.match(
    world,
    /new THREE\.CircleGeometry\(HORIZON_GROUND_RADIUS, HORIZON_GROUND_SEGMENTS\)/,
  );
  assert.match(world, /function createHorizonGroundMaterial\(\)/);
  assert.match(world, /smoothstep\(0\.58, 1\.0, radial\)/);
  assert.match(engine, /setSceneMode\(sceneMode: FireworkSceneMode\)/);
  assert.match(canvas, /useState<FireworkSceneMode>\('night'\)/);
  assert.match(canvas, /scene\.background = new THREE\.Color\(0x020409\)/);
  assert.match(canvas, /scene\.fog = new THREE\.FogExp2\(0x05070f, 0\.00012\)/);
  assert.match(canvas, /<Sun size=\{16\} strokeWidth=\{2\} \/>/);
  assert.match(canvas, /sceneMode === 'day' \? 'Night preview' : 'Day preview'/);
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
  const fireworkEditor = read('app/(admin)/admin/fireworks/[id]/FireworkEditor.tsx');
  const controls = read('app/components/admin/FireworkRenderControls.tsx');
  const canvas = read('app/components/app/FireworkReplayCanvas.tsx');
  const tuning = read('lib/fireworks/render-tuning.ts');
  const migration = read('supabase/migrations/20260610121500_brocade_admin_calibration_params.sql');
  const calibrationMigration = read(
    'supabase/migrations/20260617040846_calibrated_star_head_defaults.sql',
  );

  // Brocade tuning lives in the design schema, not renderer constants.
  assert.match(design, /brocade: z/);
  assert.match(
    design,
    /streakCount: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(100\)\.optional\(\)/,
  );
  assert.match(design, /estimateDesignDurationSeconds/);
  assert.match(effects, /design\.brocade/);
  assert.match(effects, /BROCADE_MAX_STREAKS = 100/);
  assert.match(
    effects,
    /clamp\(Math\.round\(brocade\.streakCount \?\? design\.size\), 1, BROCADE_MAX_STREAKS\)/,
  );
  assert.match(effects, /headShapeValue\(glow, 0\)/);
  assert.match(effects, /BROCADE_MAX_HEAD_GRAVITY = 0/);
  assert.match(effects, /BROCADE_MAX_TRAIL_EMISSIONS_PER_STEP = 32/);
  // Heads sustain a scene-light tint that decays with their life.
  assert.match(effects, /sustainHemi/);
  assert.match(effects, /const speed = burstSpeed \* \(0\.985 \+ rng\.next\(\) \* 0\.03\)/);
  assert.match(
    effects,
    /const sampleAge = burstTrailBalancedAge\([\s\S]*Math\.max\(0, headAge - \(\(1 - progress\) \* dt\) \/ maxLife\)/,
  );
  assert.match(effects, /const agedLife = life - ageOffset/);
  assert.match(effects, /particle\.maxLife = life/);
  assert.match(effects, /const progress = burstTrailSegmentProgress\(/);
  assert.doesNotMatch(
    effects,
    /const progress = clamp\(\(emitted \+ rng\.next\(\)\) \/ emissionCount/,
  );
  assert.doesNotMatch(effects, /const stepX = dx \/ emissionCount/);
  assert.doesNotMatch(effects, /p\.life < 0\.35/);
  // Heads escape the shared point-size ceiling so they stay dominant
  // over trail squares at close zoom, and glow scales per particle.
  assert.match(shaders, /maxPointSize = mix\(96\.0, 1280\.0, isHead\)/);
  assert.match(shaders, /headGlowStrength/);
  // Compressed perspective keeps sprites readable at every zoom level, and
  // background glow room is compensated so the solid orb size is glow-independent.
  assert.match(shaders, /float exponent = mix\(0\.7, 0\.55, isHead\)/);
  assert.match(shaders, /uniform vec2 glowPadding/);
  assert.match(shaders, /uniform vec2 whiteCoreSizePercent/);
  assert.match(shaders, /uniform vec2 whiteCoreBlurPercent/);
  assert.match(shaders, /varying float vHeadStyle/);
  assert.match(shaders, /float headStyle = step\(3\.0, shape\) \* isHead/);
  assert.match(
    shaders,
    /float selectedGlowPadding = mix\(glowPadding\.x, glowPadding\.y, headStyle\)/,
  );
  assert.match(
    shaders,
    /float backgroundGlowScale = clamp\(selectedGlowPadding \/ 100\.0, 0\.0, 3\.0\) \* isHead/,
  );
  assert.match(
    shaders,
    /float maxCoreSize = maxPointSize \/ max\(1\.0 \+ backgroundGlowScale \* 2\.0, 1\.0\)/,
  );
  assert.match(shaders, /float haloPad = coreSize \* backgroundGlowScale/);
  assert.match(shaders, /float headCoreRadius = coreSize \/ max\(pointSize \* 2\.0, 0\.0001\)/);
  assert.match(shaders, /vHeadCoreRadius = headCoreRadius/);
  assert.match(
    shaders,
    /float whiteCoreVisualRadius = headCoreRadius \* clamp\(selectedWhiteCoreSizePercent \/ 100\.0, 0\.0, 1\.0\)/,
  );
  assert.match(shaders, /vHeadWhiteCoreRadius = min\(/);
  assert.match(shaders, /whiteCoreVisualRadius/);
  assert.match(shaders, /headCoreRadius/);
  assert.match(shaders, /float coreEdge = max\(fwidth\(roundDistance\) \* 1\.5, 0\.0015\)/);
  assert.match(
    shaders,
    /float headCore = 1\.0 - smoothstep\(coreRadius - coreEdge, coreRadius \+ coreEdge, roundDistance\)/,
  );
  assert.match(shaders, /float whiteCoreRadius = clamp\(vHeadWhiteCoreRadius, 0\.0, coreRadius\)/);
  assert.match(
    shaders,
    /float whiteCoreBlur = clamp\(selectedWhiteCoreBlurPercent \/ 100\.0, 0\.0, 1\.0\)/,
  );
  assert.match(shaders, /float whiteCoreSizeT = whiteCoreRadius \/ max\(coreRadius, 0\.001\)/);
  assert.match(shaders, /float whiteCoreStrength = smoothstep\(0\.0, 0\.08, whiteCoreSizeT\)/);
  assert.match(
    shaders,
    /float whiteCoreBlurWidth = max\(whiteCoreRadius \* 1\.85, coreRadius \* 0\.01\) \* pow\(whiteCoreBlur, 1\.05\)/,
  );
  assert.match(
    shaders,
    /float whiteCoreFeatherStart = max\(whiteCoreRadius - whiteCoreBlurWidth \* 0\.5, 0\.0\)/,
  );
  assert.match(
    shaders,
    /float whiteCoreFeatherEnd = min\(coreRadius, whiteCoreRadius \+ max\(whiteCoreBlurWidth, whiteCoreEdge\)\)/,
  );
  assert.match(shaders, /float whiteCoreSharpMask = 1\.0 - step\(whiteCoreRadius, roundDistance\)/);
  assert.match(
    shaders,
    /float whiteCoreBlurMask = 1\.0 - smoothstep\(whiteCoreFeatherStart, whiteCoreFeatherEnd, roundDistance\)/,
  );
  assert.match(
    shaders,
    /float whiteCoreDissolve = mix\(1\.0, 0\.16, pow\(whiteCoreBlur, 1\.15\)\)/,
  );
  assert.match(
    shaders,
    /float whiteCore = step\(0\.0005, whiteCoreRadius\) \* whiteCoreStrength \* mix\(/,
  );
  assert.match(shaders, /whiteCoreBlurMask \* whiteCoreDissolve/);
  assert.match(
    shaders,
    /float whiteCoreColourBlur = step\(0\.0005, whiteCoreRadius\) \* whiteCoreStrength \* whiteCoreBlur \* \(1\.0 - whiteCore\)/,
  );
  assert.match(shaders, /whiteCoreColourBlur \* 1\.15/);
  assert.match(shaders, /whiteCoreColourBlur \* 0\.65/);
  assert.match(shaders, /float coreGain = clamp\(selectedCoreBrightness \/ 100\.0, 0\.0, 3\.0\)/);
  assert.match(
    shaders,
    /float coreSoftOverdrive = clamp\(\(selectedCoreSoftness - 100\.0\) \/ 10\.0, 0\.0, 1\.0\)/,
  );
  assert.match(shaders, /float coreBlurT = pow\(coreSoft, 1\.08\)/);
  assert.match(
    shaders,
    /float softCoreRadius = max\(coreRadius \* mix\(0\.92, mix\(0\.56, 0\.48, coreSoftOverdrive\), coreBlurT\), 0\.001\)/,
  );
  assert.match(
    shaders,
    /float softCoreFalloff = mix\(0\.45, mix\(2\.35, 2\.8, coreSoftOverdrive\), coreBlurT\)/,
  );
  assert.match(
    shaders,
    /float softCore = exp\(-pow\(roundDistance \/ softCoreRadius, 2\.0\) \* softCoreFalloff\)/,
  );
  assert.match(shaders, /softCore = pow\(softCore, mix\(0\.9, 1\.1, coreBlurT\)\)/);
  assert.match(
    shaders,
    /float coreOpacityT = clamp\(selectedCoreOpacityFalloff \/ 100\.0, 0\.0, 1\.0\)/,
  );
  assert.match(
    shaders,
    /float coreOpacityOverdrive = clamp\(\(selectedCoreOpacityFalloff - 100\.0\) \/ 20\.0, 0\.0, 1\.0\)/,
  );
  assert.match(shaders, /float headCoreAlpha = mix\(headCore, headCoreShaped, coreOpacityT\)/);
  assert.match(shaders, /headCoreAlpha \*= mix\(1\.0, 0\.82, coreOpacityOverdrive\)/);
  assert.match(
    shaders,
    /float glowRadiusOverdrive = clamp\(\(selectedGlowSize - 100\.0\) \/ 80\.0, 0\.0, 1\.0\)/,
  );
  assert.match(
    shaders,
    /float glowSoftnessOverdrive = clamp\(\(selectedGlowSoftness - 100\.0\) \/ 100\.0, 0\.0, 1\.0\)/,
  );
  assert.match(
    shaders,
    /float closeGlowRadius = coreRadius \+ haloSpan \* mix\(0\.18, mix\(0\.96, 1\.18, glowRadiusOverdrive\), glowRadiusT\)/,
  );
  assert.match(
    shaders,
    /float closeGlowFalloff = mix\(28\.0, mix\(0\.08, 0\.018, glowSoftnessOverdrive\), pow\(glowSoftnessT, 1\.24\)\)/,
  );
  assert.match(shaders, /float closeGlowClipStart = min\(closeGlowRadius, 0\.5\)/);
  assert.match(
    shaders,
    /float closeGlowClipEnd = min\(0\.5, closeGlowClipStart \+ coreEdge \* mix\(4\.0, 7\.0, glowRadiusOverdrive\)\)/,
  );
  assert.match(shaders, /headGlow \*= mix\(0\.22, 1\.0, outsideCore\)/);
  assert.match(shaders, /headGlow \*= smoothstep\(0\.0, 0\.05, glowRadiusT\)/);
  assert.match(
    shaders,
    /float glowOpacityT = clamp\(selectedGlowOpacityFalloff \/ 100\.0, 0\.0, 1\.0\)/,
  );
  assert.match(
    shaders,
    /float glowOpacityOverdrive = clamp\(\(selectedGlowOpacityFalloff - 100\.0\) \/ 100\.0, 0\.0, 1\.0\)/,
  );
  assert.match(
    shaders,
    /float glowEdgeStart = mix\(0\.98, mix\(0\.48, 0\.28, glowOpacityOverdrive\), glowOpacityT\)/,
  );
  assert.match(
    shaders,
    /float glowEdgeFade = 1\.0 - smoothstep\(glowEdgeStart, 1\.0, spriteDistance\)/,
  );
  assert.match(shaders, /headGlow \*= glowEdgeFade/);
  assert.match(
    shaders,
    /float backgroundGlowSize = clamp\(selectedGlowPadding \/ 300\.0, 0\.0, 1\.0\)/,
  );
  assert.match(
    shaders,
    /float backgroundRoom = smoothstep\(0\.0, 0\.28, 0\.5 - coreRadius\) \* smoothstep\(0\.0, 0\.03, backgroundGlowSize\)/,
  );
  assert.match(
    shaders,
    /float backgroundBlurT = clamp\(selectedBackgroundGlowSoftness \/ 100\.0, 0\.0, 1\.0\)/,
  );
  assert.match(
    shaders,
    /float backgroundFalloff = mix\(30\.0, 0\.035, pow\(backgroundBlurT, 1\.32\)\)/,
  );
  assert.match(shaders, /backgroundFalloff \*= mix\(1\.0, 0\.72, backgroundGlowSize\)/);
  assert.match(
    shaders,
    /float backgroundGlow = exp\(-backgroundDistance \* backgroundDistance \* backgroundFalloff\)/,
  );
  assert.match(
    shaders,
    /float backgroundOpacityT = clamp\(selectedBackgroundGlowOpacityFalloff \/ 100\.0, 0\.0, 1\.0\)/,
  );
  assert.match(
    shaders,
    /float backgroundOpacityOverdrive = clamp\(\(selectedBackgroundGlowOpacityFalloff - 100\.0\) \/ 50\.0, 0\.0, 1\.0\)/,
  );
  assert.match(
    shaders,
    /float backgroundEdgeStart = mix\(0\.99, mix\(0\.34, 0\.18, backgroundOpacityOverdrive\), backgroundOpacityT\)/,
  );
  assert.match(
    shaders,
    /float backgroundEdgeFade = 1\.0 - smoothstep\(backgroundEdgeStart, 1\.0, backgroundDistance\)/,
  );
  assert.match(
    shaders,
    /backgroundGlow \*= backgroundRoom \* backgroundEdgeFade \* clamp\(selectedGlowBlur \/ 100\.0, 0\.0, 1\.0\)/,
  );
  assert.match(shaders, /backgroundGlow \* 1\.25/);
  assert.match(shaders, /backgroundGlow \* 0\.72/);
  assert.match(shaders, /varying float vHeadSizeAtten/);
  assert.match(
    shaders,
    /vHeadSizeAtten = mix\(1\.0, clamp\(pow\(16\.0 \/ max\(size, 1\.0\), 0\.38\), 0\.58, 1\.22\), isHead\)/,
  );
  assert.match(
    shaders,
    /vHeadSizeAtten = clamp\(pow\(16\.0 \/ max\(instanceSize, 1\.0\), 0\.38\), 0\.58, 1\.22\)/,
  );
  assert.match(shaders, /\(headCoreShaped \* coreGain \+ headHaloIntensity\) \* vHeadSizeAtten/);
  assert.doesNotMatch(shaders, /whiteCoreBlendStart|whiteCoreBlendEnd|whiteCoreFeatherWidth/);
  assert.doesNotMatch(shaders, /float haze/);
  assert.doesNotMatch(shaders, /whiteCore = pow\(whiteCore/);
  assert.doesNotMatch(shaders, /sqrt\(glowT\)|vHeadGrow/);
  assert.doesNotMatch(shaders, /headBody \*/);
  assert.match(engine, /readMaxPointSize/);
  assert.match(engine, /ALIASED_POINT_SIZE_RANGE/);
  assert.match(engine, /new THREE\.InstancedBufferGeometry/);
  assert.match(engine, /HEAD_BILLBOARD_VERTEX_SHADER/);
  assert.match(engine, /this\.headBillboardGeometry\.instanceCount = headDrawCount/);
  assert.match(engine, /p\.shape > 1\.5 &&/);
  assert.match(engine, /clamp\(base, 4, 240\)/);
  assert.match(particle, /const isBrocadeHead = this\.shape > 1\.5/);
  assert.match(particle, /const lateralLimit = isBrocadeHead \? 18 : VMAX_LATERAL/);
  assert.match(particle, /const downwardLimit = isBrocadeHead \? 18 : VMAX_DOWN/);
  // Admin editor exposes a full-duration scrub timeline and brocade sliders.
  assert.match(editor, /estimateDesignDurationSeconds/);
  assert.match(editor, /FireworkRenderControls/);
  assert.match(
    editor,
    /renderTuning=\{\{ glowPadding, whiteCoreSizePercent, whiteCoreBlurPercent \}\}/,
  );
  assert.match(editor, /coreOpacityFalloff/);
  assert.match(editor, /glowOpacityFalloff/);
  assert.match(editor, /backgroundGlowOpacityFalloff/);
  assert.match(editor, /backgroundGlowSoftness/);
  assert.match(fireworkEditor, /coreOpacityFalloff/);
  assert.match(fireworkEditor, /glowOpacityFalloff/);
  assert.match(fireworkEditor, /backgroundGlowOpacityFalloff/);
  assert.match(fireworkEditor, /backgroundGlowSoftness/);
  assert.match(controls, /SliderField/);
  assert.match(controls, /CalibratedSliderField/);
  assert.match(controls, /range=\{headGlowStrengthRange\}/);
  assert.match(controls, /range=\{brocadeGlowStrengthRange\}/);
  assert.match(editor, /calibrationDefaults=\{calibrationDefaults\}/);
  assert.match(fireworkEditor, /calibrationDefaults=\{calibrationDefaults\}/);
  assert.match(controls, /setBrocadeValue/);
  assert.match(controls, /ensureDraftStarLayer\(draft, 'outer'\)\.count = count/);
  assert.match(controls, /setBrocadeGravityUpper/);
  assert.match(controls, /label="Floatiness"[\s\S]*max=\{0\}/);
  assert.match(controls, /label="Burst size"[\s\S]*max=\{12\}/);
  // Outer, Core, and brocade Heads expose the full head appearance set via the
  // shared renderStarAppearance helper, written onto each star layer's head.
  assert.match(controls, /label="Head size"/);
  assert.match(controls, /label="Star size"/);
  assert.match(
    controls,
    /renderStarAppearance\('outer', sectionDisabled\.heads, undefined, false\)/,
  );
  assert.match(controls, /renderStarAppearance\(\s*layerKey,\s*controlDisabled,/);
  assert.match(controls, /showOpeningControls = true/);
  assert.match(controls, /label="White dot size"/);
  assert.match(controls, /label="White dot blur"/);
  assert.match(controls, /label="Core blur"/);
  assert.match(controls, /label="Core fade"/);
  assert.match(controls, /label="Star glow blur"/);
  assert.match(controls, /label="Star glow fade"/);
  assert.match(controls, /label="Background blur"/);
  assert.match(controls, /label="Background fade"/);
  assert.match(controls, /setLayerNestedValue\(layerKey, 'head', 'whiteCoreSizePercent', value\)/);
  assert.match(controls, /setLayerNestedValue\(layerKey, 'head', 'whiteCoreBlurPercent', value\)/);
  assert.match(controls, /setLayerNestedValue\(layerKey, 'head', 'coreOpacityFalloff', value\)/);
  assert.match(controls, /setLayerNestedValue\(layerKey, 'head', 'glowOpacityFalloff', value\)/);
  assert.match(
    controls,
    /setLayerNestedValue\(layerKey, 'head', 'backgroundGlowSoftness', value\)/,
  );
  assert.match(controls, /label="Background glow size"/);
  assert.match(controls, /range=\{backgroundGlowSizeRange\}/);
  assert.match(controls, /setLayerNestedValue\(layerKey, 'head', 'glowPadding', value\)/);
  assert.match(
    controls,
    /setLayerNestedValue\(layerKey, 'head', 'backgroundGlowOpacityFalloff', value\)/,
  );
  // The granular head sliders write directly, not via removed preview-only props.
  assert.doesNotMatch(controls, /onGlowPaddingChange|onWhiteCoreSizePercentChange/);
  assert.match(controls, /formatValue=\{formatPercent\}/);
  assert.match(tuning, /DEFAULT_HEAD_GLOW_STRENGTH = 1\.5/);
  assert.match(tuning, /MAX_HEAD_GLOW_STRENGTH = 3/);
  assert.match(canvas, /renderTuning\?: Partial<FireworkRenderTuning>/);
  assert.match(
    canvas,
    /engine\.setRenderTuning\(\{ glowPadding, whiteCoreSizePercent, whiteCoreBlurPercent \}\)/,
  );
  assert.match(tuning, /DEFAULT_GLOW_PADDING = 150/);
  assert.match(tuning, /MAX_GLOW_PADDING = 300/);
  assert.match(tuning, /MIN_CORE_BRIGHTNESS = 0/);
  assert.match(tuning, /DEFAULT_CORE_BRIGHTNESS = 50/);
  assert.match(tuning, /MAX_CORE_BRIGHTNESS = 100/);
  assert.match(tuning, /DEFAULT_GLOW_BLUR = 45/);
  assert.match(tuning, /MAX_GLOW_BLUR = 100/);
  assert.match(tuning, /HEAD_SPRITE_MAX_SIZE = 1280/);
  assert.match(tuning, /DEFAULT_CORE_SOFTNESS = 55/);
  assert.match(tuning, /MAX_CORE_SOFTNESS = 110/);
  assert.match(tuning, /DEFAULT_CORE_OPACITY_FALLOFF = 60/);
  assert.match(tuning, /MAX_CORE_OPACITY_FALLOFF = 120/);
  assert.match(tuning, /DEFAULT_GLOW_SIZE = 90/);
  assert.match(tuning, /MAX_GLOW_SIZE = 180/);
  assert.match(tuning, /DEFAULT_GLOW_SOFTNESS = 100/);
  assert.match(tuning, /MAX_GLOW_SOFTNESS = 200/);
  assert.match(tuning, /DEFAULT_GLOW_OPACITY_FALLOFF = 100/);
  assert.match(tuning, /MAX_GLOW_OPACITY_FALLOFF = 200/);
  assert.match(tuning, /DEFAULT_BACKGROUND_GLOW_OPACITY_FALLOFF = 75/);
  assert.match(tuning, /MAX_BACKGROUND_GLOW_OPACITY_FALLOFF = 150/);
  assert.match(tuning, /DEFAULT_BACKGROUND_GLOW_SOFTNESS = 50/);
  assert.match(tuning, /DEFAULT_WHITE_CORE_SIZE_PERCENT = 20/);
  assert.match(tuning, /MAX_WHITE_CORE_SIZE_PERCENT = 40/);
  assert.match(tuning, /DEFAULT_WHITE_CORE_BLUR_PERCENT = 15/);
  assert.match(tuning, /MAX_WHITE_CORE_BLUR_PERCENT = 30/);
  assert.match(migration, /'streakCount', 60/);
  assert.match(migration, /'glowStrength', 1/);
  assert.match(calibrationMigration, /update public\.firework_effects/);
  assert.match(calibrationMigration, /update public\.fireworks/);
  assert.match(calibrationMigration, /- 'glowStrength'/);
  assert.match(calibrationMigration, /- 'backgroundGlowSoftness'/);
  assert.match(calibrationMigration, /\{renderDefaults,brocade\}/);
  assert.match(calibrationMigration, /\{brocade\}/);
  assert.match(calibrationMigration, /calibrated_heads/);
  assert.match(calibrationMigration, /'glowStrength', 1\.5/);
  assert.match(calibrationMigration, /'backgroundGlowSoftness', 50/);
  // Head-orb appearance is saved on effect settings and can be customised on
  // firework overrides; renderer fallbacks only cover missing or malformed data.
  assert.match(design, /glowPadding: z\.coerce/);
  assert.match(design, /whiteCoreSizePercent: z\.coerce/);
  assert.match(design, /whiteCoreBlurPercent: z\.coerce/);
  assert.match(design, /coreOpacityFalloff: z\.coerce/);
  assert.match(design, /glowOpacityFalloff: z\.coerce/);
  assert.match(design, /backgroundGlowOpacityFalloff: z\.coerce/);
  assert.match(design, /backgroundGlowSoftness: z\.coerce/);
  assert.match(design, /const MAX_STAR_COUNT = 100/);
  assert.match(design, /\.transform\(\(value\) => Math\.min\(MAX_STAR_COUNT, value\)\)/);
  assert.match(
    design,
    /count: Math\.round\(Math\.max\(1, Math\.min\(MAX_STAR_COUNT, layer\.count \* scale\)\)\)/,
  );
});

test('preview duration estimate uses shared design-aware timing', () => {
  const design = read('lib/fireworks/design.ts');
  const timing = read('lib/fireworks/timing.ts');

  assert.match(design, /estimateFireworkDesignTiming\(design\)\.endSeconds/);
  assert.match(timing, /geometryLifeBounds/);
  assert.match(timing, /design\.split\.lifeBaseSeconds/);
  assert.match(timing, /design\.split\.lifeVariationSeconds/);
  assert.match(timing, /emittedDurationSeconds/);
  assert.doesNotMatch(design, /Math\.max\(1,\s*1\.25 \* design\.trail\.length\)/);
});
