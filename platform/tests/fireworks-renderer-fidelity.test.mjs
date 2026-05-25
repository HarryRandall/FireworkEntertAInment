import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("firework replay uses raw spec_json and cache-busts old shapes", () => {
  const engine = read("lib/fireworks/FireworksEngine.ts");
  const showsServer = read("lib/shows.server.ts");
  const showDomain = read("lib/show-domain.ts");
  const importJobs = read("lib/import-jobs.ts");

  assert.match(engine, /safeParseFireworkDesign\(cue\.firework\.rawSpec\)/);
  assert.match(showsServer, /rawSpec: row\.spec_json/);
  assert.match(showsServer, /CACHE_PREFIX = "shows:v5"/);
  assert.match(showDomain, /rawSpec: unknown/);
  assert.match(importJobs, /rawSpec: spec/);
});

test("firework replay is deterministic and silent when rebuilding after scrub", () => {
  const engine = read("lib/fireworks/FireworksEngine.ts");
  const effects = read("lib/fireworks/Effects.ts");
  const sound = read("lib/fireworks/SoundHandler.ts");

  assert.match(engine, /createSeededRng/);
  assert.match(engine, /mixSeed/);
  assert.match(engine, /this\.seekTo\(next\)/);
  assert.match(engine, /this\.advanceTo\(target, false\)/);
  assert.match(engine, /this\.lights\.reset\(\)/);
  assert.match(effects, /audible: boolean/);
  assert.match(effects, /if \(audible\)/);
  assert.match(sound, /rng\?: RandomSource/);
});

test("renderer effects drive shell and trail colours from the selected design", () => {
  const effects = read("lib/fireworks/Effects.ts");

  assert.match(effects, /resolveColor\(design\.color, rng\)/);
  assert.match(effects, /flairColor\(design, color, rng\)/);
  assert.match(effects, /r: color\.r/);
  assert.match(effects, /g: color\.g/);
  assert.match(effects, /b: color\.b/);
  assert.doesNotMatch(effects, /r:\s*1\.0,\s*g:\s*0,\s*b:\s*0/s);
});

test("QA seed creates pattern, colour, and replay test shows for every user", () => {
  const seed = read("supabase/seed-qa-test-shows.sql");

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

test("burst patterns distribute over the full sphere", () => {
  const effects = read("lib/fireworks/Effects.ts");
  // Fibonacci pattern previously wrapped vy in Math.abs, leaving only the
  // upper hemisphere visible. The fix unwraps it; lock that in.
  assert.doesNotMatch(effects, /vy = Math\.abs\(i \* offset/);
  assert.match(effects, /vy = i \* offset - 1 \+ offset \/ 2;[\s\S]*case 2:/);
});

test("burst physics hang like firework stars instead of free-falling", () => {
  const effects = read("lib/fireworks/Effects.ts");
  const particle = read("lib/fireworks/Particle.ts");
  const engine = read("lib/fireworks/FireworksEngine.ts");

  assert.match(effects, /const STAR_DRAG = 2\.4/);
  assert.match(effects, /clampStarGravity\(rangeRand\(design\.burst\.gravity, rng\)\)/);
  assert.match(effects, /drag: STAR_DRAG/);
  assert.match(effects, /gravity: TRAIL_GRAVITY/);
  assert.match(particle, /drag = 0/);
  assert.match(particle, /maxLife = 0/);
  assert.match(particle, /Math\.exp\(-this\.drag \* dt\)/);
  assert.match(particle, /applyDragStep\(this\.vy, ay \* dt\) \+ this\.gravity \* dt/);
  assert.match(engine, /SNAPSHOT_STRIDE = 16/);
  assert.match(engine, /state\.data\[o \+ 14\] = p\.drag/);
  assert.match(engine, /state\.data\[o \+ 15\] = p\.maxLife/);
  assert.match(engine, /p\.drag = state\.data\[o \+ 14\]/);
  assert.match(engine, /p\.maxLife = state\.data\[o \+ 15\] \|\| p\.life/);
});

test("renderer draws only compact live square particles", () => {
  const engine = read("lib/fireworks/FireworksEngine.ts");
  const pool = read("lib/fireworks/ParticlePool.ts");
  const shaders = read("lib/fireworks/shaders.ts");
  const canvas = read("app/components/app/FireworkReplayCanvas.tsx");

  assert.match(pool, /aliveIndices: Uint32Array/);
  assert.match(pool, /activeSlots/);
  assert.match(pool, /return this\.activeCount/);
  assert.match(pool, /p\.reset\(\);[\s\S]*return p;/);
  assert.match(pool, /p\.color\.setRGB\(1, 1, 1\)/);
  assert.match(engine, /const live = this\.pool\.aliveIndices/);
  assert.match(engine, /let drawCount = 0/);
  assert.match(engine, /renderParticleSize\(p\)/);
  assert.match(engine, /renderParticleAlpha\(p\)/);
  assert.match(engine, /p\.color\.r \* alpha/);
  assert.match(engine, /this\.geometry\.setDrawRange\(0, drawCount\)/);
  assert.match(engine, /addUpdateRange\(0, positionCount\)/);
  assert.doesNotMatch(engine, /TextureLoader|SPARK_TEXTURE_URL/);
  assert.doesNotMatch(engine, /alphaAttribute|setAttribute\("alpha"/);
  assert.doesNotMatch(shaders, /texture2D|sampler2D|pointTexture/);
  assert.doesNotMatch(shaders, /attribute float alpha|vAlpha/);
  assert.match(shaders, /gl_FragColor = vec4\(vColor, 1\.0\)/);
  assert.match(shaders, /gl_PointSize = clamp/);
  assert.match(canvas, /MAX_DEVICE_PIXEL_RATIO = 1\.5/);
  assert.match(canvas, /antialias: false/);
});

test("renderer avoids blown-out additive blobs and excessive trail churn", () => {
  const engine = read("lib/fireworks/FireworksEngine.ts");
  const effects = read("lib/fireworks/Effects.ts");

  assert.match(engine, /Math\.sqrt\(Math\.max\(0, p\.size\)\)/);
  assert.match(engine, /peak = 0\.055/);
  assert.match(engine, /fadeIn = p\.mass <= 0\.003/);
  assert.match(effects, /SHELL_TRAIL_DENSITY = 0\.35/);
  assert.match(effects, /STAR_TRAIL_PARTICLES_PER_SECOND = 9/);
  assert.match(effects, /rng\.next\(\) > Math\.min\(1, STAR_TRAIL_PARTICLES_PER_SECOND \* dt\)/);
  assert.match(effects, /const count = 60 \+ Math\.floor\(rng\.next\(\) \* 120\)/);
});
