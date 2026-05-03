import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("firework renderer uses the live shader source with transition and spin attributes", () => {
  const gpuSystem = read("lib/fireworks/GpuParticleSystem.ts");
  const shader = read("lib/fireworks/shaders.ts");

  assert.match(gpuSystem, /from "@\/lib\/fireworks\/shaders"/);
  assert.match(shader, /attribute vec2 aMotion;/);
  assert.match(shader, /attribute float aTransition;/);
  assert.match(shader, /spinPhase/);
  assert.match(shader, /transitionAt/);
});

test("firework compiler applies catalogue height, duration, cue scale, and comet lift trails", () => {
  const compiler = read("lib/fireworks/EffectCompiler.ts");

  assert.match(compiler, /HEIGHT_METERS_TO_SCENE/);
  assert.match(compiler, /cue\.firework\.heightMeters/);
  assert.match(compiler, /cue\.firework\.durationSeconds/);
  assert.match(compiler, /scaleSpecForCue/);
  assert.match(compiler, /spinRadius/);
  assert.match(compiler, /liftGlitterFor/);
  assert.match(compiler, /compileShotSequenceCueEvents/);
  assert.match(compiler, /colorPalette/);
});
