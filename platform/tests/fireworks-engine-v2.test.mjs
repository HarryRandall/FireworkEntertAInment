import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import Module from "node:module";
import { dirname, join } from "node:path";
import ts from "typescript";
import { test } from "node:test";

const root = process.cwd();
const require = createRequire(import.meta.url);

function loadTsModule(relativePath, mocks = {}) {
  const filename = join(root, relativePath);
  const source = readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  });
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  mod.require = (id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith("@/")) return loadTsModule(`${id.slice(2)}.ts`, mocks);
    return require(id);
  };
  mod._compile(outputText, filename);
  return mod.exports;
}

const specV2 = loadTsModule("lib/fireworks/spec-v2.ts");
const specV3 = loadTsModule("lib/fireworks/spec-v3.ts", {
  "@/lib/fireworks/spec-v2": specV2,
});
const random = loadTsModule("lib/fireworks/random.ts");
const legacyAdapter = loadTsModule("lib/fireworks/legacy-adapter.ts", {
  "@/lib/fireworks/spec-v2": specV2,
});
const effectCompiler = loadTsModule("lib/fireworks/EffectCompiler.ts", {
  "@/lib/fireworks/spec-v2": specV2,
  "@/lib/fireworks/spec-v3": specV3,
  "@/lib/fireworks/random": random,
  "@/lib/fireworks/legacy-adapter": legacyAdapter,
});

test("FireworkEffectSpecV2 Zod schema validates fixture specs and observations", () => {
  const fixture = JSON.parse(
    readFileSync(join(root, "tests/fixtures/fireworks-v2/red-peony.json"), "utf8"),
  );
  const observation = JSON.parse(
    readFileSync(
      join(root, "tests/fixtures/fireworks-v2/fanned-cake-observation.json"),
      "utf8",
    ),
  );

  const parsed = specV2.FireworkEffectSpecV2Schema.parse(fixture);
  assert.equal(parsed.version, 2);
  assert.equal(parsed.shotSequence.shotCount, 1);
  assert.equal(parsed.shotSequence.shots[0].breakSpec.layers[0].trail.lengthSeconds, 0.45);

  const parsedObservation = specV2.VideoInferenceObservationSchema.parse(observation);
  assert.equal(parsedObservation.suggestedManualReviewFields.includes("fanAngles"), true);
});

test("legacy adapter maps old render fields into v2 particle layers and sub-breaks", () => {
  const legacy = JSON.parse(
    readFileSync(
      join(root, "tests/fixtures/fireworks-v2/legacy-render-spec.json"),
      "utf8",
    ),
  );
  const migrated = legacyAdapter.legacyFireworkRenderSpecToEffectSpecV2(legacy, {
    name: "Legacy fixture",
    slug: "willow",
    seed: 99,
  });
  const layer = migrated.shotSequence.shots[0].breakSpec.layers[0];

  assert.equal(migrated.version, 2);
  assert.equal(layer.particleCount, legacy.particleCount);
  assert.equal(layer.trail.lengthSeconds, legacy.trailLength);
  assert.equal(migrated.shotSequence.shots[0].breakSpec.subBreaks.length, 2);
  assert.equal(migrated.heightMeters, legacy.launchHeight * 28);
});

test("same seed and cue time produce the same emitted particle attributes", () => {
  const legacy = JSON.parse(
    readFileSync(
      join(root, "tests/fixtures/fireworks-v2/legacy-render-spec.json"),
      "utf8",
    ),
  );
  const cue = {
    id: "cue-deterministic",
    position: 1,
    timeSeconds: 4,
    description: "Determinism check",
    fireworkSpecificationId: "spec-1",
    renderParams: null,
    firework: {
      id: "spec-1",
      slug: "peony",
      name: "Legacy peony",
      description: null,
      sortOrder: 1,
      spec: legacy,
    },
  };
  const [event] = effectCompiler
    .compileCueEvents(cue)
    .filter((item) => item.kind === "layer");

  function collect() {
    const particles = [];
    const trails = [];
    const smoke = [];
    const targets = {
      particles: { write: (particle) => particles.push(JSON.parse(JSON.stringify(particle))) },
      trails: { write: (particle) => trails.push(JSON.parse(JSON.stringify(particle))) },
      smoke: { write: (particle) => smoke.push(JSON.parse(JSON.stringify(particle))) },
    };
    effectCompiler.emitCompiledEvent(event, targets);
    return { particles: particles.slice(0, 12), trails: trails.slice(0, 12), smoke };
  }

  assert.deepEqual(collect(), collect());
});

test("FireworkEffectSpecV3 validates CodePen-style standalone effects", () => {
  const spec = specV3.FireworkEffectSpecV3Schema.parse({
    version: 3,
    name: "CodePen test willow",
    source: "catalogue",
    confidence: 1,
    seed: 3001,
    type: "shell",
    durationSeconds: 6,
    colorPalette: ["#ffbf36", "#ffffff"],
    shell: {
      family: "willow",
      size: 3,
      starDensity: 1,
      color: "#ffbf36",
      glitter: "willow",
      smokeAmount: 0.4,
    },
    launch: {
      enabled: true,
      liftTimeSeconds: 1.15,
      heightMeters: 90,
      tracerColor: "#ffbf36",
    },
    shots: [
      {
        index: 0,
        timeOffsetSeconds: 0,
        position: { x: 0, y: 0, z: 0 },
        scale: 1,
        seedOffset: 0,
      },
    ],
  });
  const converted = specV3.fireworkEffectSpecV3ToV2(spec);
  assert.equal(converted.version, 2);
  assert.equal(converted.shotSequence.shotCount, 1);
  assert.equal(converted.colorPalette[0], "#ffbf36");
  assert.equal(converted.effectLayers[0].trail.enabled, true);
});

test("v3 standalone effects can be reused by multiple positioned cues", () => {
  const spec = specV3.FireworkEffectSpecV3Schema.parse({
    version: 3,
    name: "Reusable blue ring",
    source: "catalogue",
    confidence: 1,
    seed: 3002,
    type: "shell",
    durationSeconds: 4.4,
    colorPalette: ["#1e7fff", "#ffffff"],
    shell: {
      family: "ring",
      size: 2.7,
      starDensity: 1,
      color: "#1e7fff",
      glitter: "light",
      ring: true,
      pistil: true,
    },
    launch: {
      enabled: true,
      liftTimeSeconds: 1.15,
      heightMeters: 82,
      tracerColor: "#1e7fff",
    },
  });
  const cues = [0, 1].map((index) => ({
    id: `cue-v3-${index}`,
    position: index + 1,
    timeSeconds: 2,
    description: "Reusable ring",
    fireworkSpecificationId: null,
    effectSpecId: "effect-ring",
    renderParams: null,
    positionMeters: { x: index === 0 ? -2 : 2, y: 0, z: 0 },
    rotation: { pan: 0, tilt: 90, roll: 0 },
    scale: 1,
    firework: {
      id: "effect-ring",
      slug: "codepen-blue-ring",
      name: spec.name,
      description: null,
      sortOrder: 1,
      spec,
    },
  }));
  const events = cues.flatMap(effectCompiler.compileCueEvents);
  const layerEvents = events.filter((event) => event.kind === "layer");
  assert.equal(layerEvents.length, 4);
  assert.notEqual(layerEvents[0].origin.x, layerEvents[2].origin.x);
});

test("scrub rebuilds select the same active events for the same elapsed time", () => {
  const spec = specV2.FireworkEffectSpecV2Schema.parse(
    JSON.parse(readFileSync(join(root, "tests/fixtures/fireworks-v2/red-peony.json"), "utf8")),
  );
  const cue = {
    id: "cue-scrub",
    position: 1,
    timeSeconds: 3,
    description: "Scrub check",
    fireworkSpecificationId: "fixture-v2",
    renderParams: null,
    firework: {
      id: "fixture-v2",
      slug: "shell",
      name: spec.name,
      description: spec.description,
      sortOrder: 1,
      spec,
    },
  };
  const activeA = effectCompiler
    .compileCueEvents(cue)
    .filter((event) => effectCompiler.eventIsActiveAt(event, 4.4))
    .map((event) => event.id);
  const activeB = effectCompiler
    .compileCueEvents(cue)
    .filter((event) => effectCompiler.eventIsActiveAt(event, 4.4))
    .map((event) => event.id);

  assert.deepEqual(activeA, activeB);
});

test("v2 database migration adds normalized tables and 20+ preset seeds", () => {
  const migration = readFileSync(
    join(root, "supabase/migrations/0009_firework_effect_spec_v2.sql"),
    "utf8",
  );
  const seededRows = migration.match(/\('[-a-z]+',/g) ?? [];
  assert.match(migration, /create table if not exists public\.products/);
  assert.match(migration, /create table if not exists public\.effect_specs/);
  assert.match(migration, /create table if not exists public\.inferred_video_observations/);
  assert.equal(seededRows.length >= 20, true);
});

test("v3 CodePen seed SQL stores standalone effect_specs with exact palette", () => {
  const seedSql = readFileSync(
    join(root, "supabase/seed-codepen-fireworks-v3.sql"),
    "utf8",
  );
  assert.match(seedSql, /insert into public\.effect_specs/);
  assert.match(seedSql, /'version', 3/);
  for (const color of ["#ff0043", "#14fc56", "#1e7fff", "#e60aff", "#ffbf36", "#ffffff"]) {
    assert.match(seedSql, new RegExp(color));
  }
});
