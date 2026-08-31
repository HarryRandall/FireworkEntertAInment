import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith('@/')) {
        return nextResolve(
          pathToFileURL(`${join(process.cwd(), specifier.slice(2))}.ts`).href,
          context,
        );
      }
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const {
  ImportReconstructionValidationError,
  IMPORT_RECONSTRUCTION_EFFECT_SLUGS,
  adaptLegacyImportedFireworkSpec,
  buildImportReconstructionPersistencePlan,
  parseImportReconstruction,
  parseImportReconstructionOrThrow,
  reconstructionToReplayCues,
} = await import('../lib/import-reconstruction.ts');
const { DEFAULT_DESIGN, estimateDesignDurationSeconds } =
  await import('../lib/fireworks/design.ts');
const { importedSpecToReplayCues, latestImportedSpecFromOutputs, parseImportedFireworkSpec } =
  await import('../lib/import-jobs.ts');

function reconstructionInput(overrides = {}) {
  return {
    version: 1,
    source: 'video_inferred',
    name: 'Three shot fan',
    description: 'Red, green, then gold.',
    durationSeconds: 12,
    heightMeters: 42,
    caliber: '30mm',
    confidence: 0.91,
    designs: [
      {
        key: 'fan-shell',
        effectSlug: 'peony',
        label: 'Fan shell',
        durationSeconds: 9.2,
        heightMeters: 42,
        caliber: '30mm',
        confidence: 0.89,
        colorPalette: ['#ff2d55', '#14fc56', '#ffd166'],
        design: structuredClone(DEFAULT_DESIGN),
      },
    ],
    shots: [
      {
        designKey: 'fan-shell',
        timeOffsetSeconds: 2,
        position: { x: 20, y: 0, z: 3 },
        launchPositionIndex: 2,
        panDegrees: 18,
        tiltDegrees: 12,
        seed: 303,
        scale: 1.5,
      },
      {
        designKey: 'fan-shell',
        timeOffsetSeconds: 0,
        position: { x: -20, y: 0, z: -3 },
        launchPositionIndex: 0,
        panDegrees: -18,
        tiltDegrees: 10,
        seed: 101,
        scale: 0.5,
      },
      {
        designKey: 'fan-shell',
        timeOffsetSeconds: 1,
        observedBurstTimeSeconds: 2.2,
        observedFadeEndSeconds: 4.7,
        position: { x: 0, y: 0, z: 0 },
        launchPositionIndex: 1,
        panDegrees: 0,
        tiltDegrees: 11,
        seed: 202,
        scale: 1,
      },
    ],
    observations: {
      observedEvents: [{ timeSeconds: 2.2, type: 'burst', confidence: 0.94 }],
      fieldConfidence: { geometry: 0.88 },
      unknowns: [],
    },
    ...overrides,
  };
}

test('renderer-native reconstruction emits one deterministic ReplayCue per shot', () => {
  const parsed = parseImportReconstruction(reconstructionInput());
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  const cues = reconstructionToReplayCues(parsed.data, { idPrefix: 'import-42' });
  assert.equal(cues.length, 3);
  assert.deepEqual(
    cues.map((cue) => cue.timeSeconds),
    [0, 1, 2],
  );
  assert.deepEqual(
    cues.map((cue) => cue.seedOverride),
    [101, 202, 303],
  );
  assert.deepEqual(
    cues.map((cue) => cue.firework.caliber),
    ['15mm', '30mm', '45mm'],
  );
  assert.deepEqual(cues[0].shotPositionOverride, { x: -20, y: 0, z: -3 });
  assert.equal(cues[0].shotPanDegrees, -18);
  assert.equal(cues[0].shotTiltDegrees, 10);
  assert.equal(cues[0].launchPositionIndex, 0);
  assert.equal(cues[0].firework.renderDesign, parsed.data.designs[0].design);
});

test('renderer and persistence share fixed-step shot boundaries without losing source timing', () => {
  const input = reconstructionInput();
  input.shots[1].timeOffsetSeconds = 0.251;
  input.shots[1].sourceTimeOffsetSeconds = 0.251;
  const parsed = parseImportReconstruction(input);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  const cues = reconstructionToReplayCues(parsed.data);
  const persistence = buildImportReconstructionPersistencePlan(parsed.data);
  assert.equal(cues[0].timeSeconds, 0.25);
  assert.equal(persistence.shots[1].timeOffsetSeconds, 0.25);
  assert.equal(persistence.shots[1].metadata.sourceTimeOffsetSeconds, 0.251);
});

test('sealed design duration follows the longest referenced shot pan', () => {
  const input = reconstructionInput();
  const angledDesign = {
    ...structuredClone(DEFAULT_DESIGN),
    liftVelocity: 21.1043,
    shellLife: 2.3,
  };
  input.designs[0].design = angledDesign;
  input.designs[0].durationSeconds = estimateDesignDurationSeconds(angledDesign, 30);
  input.shots.forEach((shot) => {
    shot.panDegrees = 30;
    shot.scale = 1;
  });

  assert.ok(estimateDesignDurationSeconds(angledDesign) > input.designs[0].durationSeconds + 0.2);
  assert.equal(parseImportReconstruction(input).success, true);

  input.shots[1].panDegrees = 0;
  const mixedPan = parseImportReconstruction(input);
  assert.equal(mixedPan.success, false);
  if (!mixedPan.success) {
    assert.equal(
      mixedPan.issues.some((issue) => issue.message.includes('at 0 degrees pan')),
      true,
    );
  }
});

test('import effect taxonomy includes manual heart and outlined-star effects', () => {
  assert.equal(IMPORT_RECONSTRUCTION_EFFECT_SLUGS.includes('heart-shell'), true);
  assert.equal(IMPORT_RECONSTRUCTION_EFFECT_SLUGS.includes('outlined-star-shell'), true);
});

test('renderer-native reconstruction rejects invalid, unknown, and lossy design values', () => {
  const invalidRange = reconstructionInput();
  invalidRange.designs[0].design.stars.outer.burst.gravity = [0, -1];
  invalidRange.designs[0].design.burst.gravity = [0, -1];
  const rangeResult = parseImportReconstruction(invalidRange);
  assert.equal(rangeResult.success, false);
  if (!rangeResult.success) {
    assert.equal(
      rangeResult.issues.some((issue) => issue.message.includes('must already be canonical')),
      true,
    );
  }

  const unknownField = reconstructionInput();
  unknownField.designs[0].design.stars.outer.videoOnlyGravityCurve = [0, 1];
  const unknownResult = parseImportReconstruction(unknownField);
  assert.equal(unknownResult.success, false);
  if (!unknownResult.success) {
    assert.deepEqual(
      unknownResult.issues.find((issue) => issue.message === 'Unknown renderer field.')?.path,
      ['designs', 0, 'design', 'stars', 'outer', 'videoOnlyGravityCurve'],
    );
  }

  const invalidVelocity = reconstructionInput();
  invalidVelocity.designs[0].design.liftVelocity = 99;
  assert.throws(
    () => parseImportReconstructionOrThrow(invalidVelocity),
    ImportReconstructionValidationError,
  );
});

test('ground emitters accept a zero lift phase while aerial shells remain bounded', () => {
  const mine = reconstructionInput();
  mine.designs[0].effectSlug = 'mine';
  mine.designs[0].design.geometry = 'upward_fan';
  mine.designs[0].design.liftVelocity = 0;
  assert.equal(parseImportReconstruction(mine).success, true);

  const aerial = reconstructionInput();
  aerial.designs[0].design.geometry = 'sphere';
  aerial.designs[0].design.liftVelocity = 0;
  const parsed = parseImportReconstruction(aerial);
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.equal(
      parsed.issues.some((issue) => issue.message.includes('lift velocity of at least 4')),
      true,
    );
  }
});

test('renderer-native reconstruction rejects missing design references and impossible timing', () => {
  const input = reconstructionInput();
  input.shots[0].designKey = 'missing';
  input.shots[1].timeOffsetSeconds = 13;
  input.shots[2].observedBurstTimeSeconds = 0.5;
  input.shots[2].observedFadeEndSeconds = 13;
  const parsed = parseImportReconstruction(input);
  assert.equal(parsed.success, false);
  if (parsed.success) return;

  assert.equal(
    parsed.issues.some((issue) => issue.message.includes('Unknown design key')),
    true,
  );
  assert.equal(
    parsed.issues.some((issue) => issue.message.includes('product duration')),
    true,
  );
  assert.equal(
    parsed.issues.some((issue) => issue.message.includes('precede the launch')),
    true,
  );
  assert.equal(
    parsed.issues.some((issue) => issue.message.includes('fade end exceeds')),
    true,
  );
  const fractionalAngle = reconstructionInput();
  fractionalAngle.shots[2].panDegrees = 0.5;
  const fractionalResult = parseImportReconstruction(fractionalAngle);
  assert.equal(fractionalResult.success, false);
  if (!fractionalResult.success) {
    assert.equal(
      fractionalResult.issues.some((issue) => issue.path.join('.') === 'shots.2.panDegrees'),
      true,
    );
  }
});

test('renderer-native reconstruction rejects a shot whose design would be truncated', () => {
  const input = reconstructionInput({ durationSeconds: 6 });
  input.shots[0].timeOffsetSeconds = 2;
  const parsed = parseImportReconstruction(input);
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.equal(
      parsed.issues.some((issue) => issue.message.includes('extend beyond')),
      true,
    );
  }
});

test('persistence plan keeps colourless base snapshots and exact canonical overrides', () => {
  const parsed = parseImportReconstruction(reconstructionInput());
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  const persistence = buildImportReconstructionPersistencePlan(parsed.data);
  assert.equal(persistence.isMultishot, true);
  assert.equal(persistence.fireworks.length, 1);
  assert.equal(persistence.shots.length, 3);
  assert.equal(persistence.fireworks[0].baseEffectSnapshot.version, 3);
  assert.equal(persistence.fireworks[0].baseEffectSnapshot.geometry, 'sphere');
  assert.equal(persistence.fireworks[0].effectSlug, 'peony');
  assert.equal(persistence.fireworks[0].durationSeconds, 9.2);
  assert.equal(persistence.fireworks[0].heightMeters, 42);
  assert.equal(persistence.fireworks[0].confidence, 0.89);
  assert.deepEqual(persistence.fireworks[0].colorPalette, ['#ff2d55', '#14fc56', '#ffd166']);
  assert.equal('color' in persistence.fireworks[0].baseEffectSnapshot.renderDefaults, false);
  assert.deepEqual(persistence.fireworks[0].renderOverridesJson, parsed.data.designs[0].design);
  assert.equal(persistence.shots[0].seedOverride, 303);
  assert.equal(persistence.shots[0].scale, 1.5);
  assert.equal(persistence.shots[0].caliber, '45mm');
  assert.equal(persistence.catalogueMetadata.shotCount, 3);
});

test('contract enforces current base effects, database bounds, and used design keys', () => {
  const invalid = reconstructionInput();
  invalid.designs[0].effectSlug = 'made-up-effect';
  invalid.designs.push({
    ...structuredClone(invalid.designs[0]),
    key: 'unused-shell',
    effectSlug: 'ring',
  });
  invalid.shots[0].panDegrees = 31;
  invalid.shots[1].tiltDegrees = -51;
  invalid.shots[2].position.x = 1_001;
  const parsed = parseImportReconstruction(invalid);
  assert.equal(parsed.success, false);
  if (parsed.success) return;

  assert.equal(
    parsed.issues.some((issue) => issue.message === 'Unknown base-effect slug.'),
    true,
  );
  assert.equal(
    parsed.issues.some((issue) => issue.path.join('.') === 'shots.0.panDegrees'),
    true,
  );
  assert.equal(
    parsed.issues.some((issue) => issue.path.join('.') === 'shots.1.tiltDegrees'),
    true,
  );
  assert.equal(
    parsed.issues.some((issue) => issue.path.join('.') === 'shots.2.position.x'),
    true,
  );

  const unused = reconstructionInput();
  unused.designs.push({
    ...structuredClone(unused.designs[0]),
    key: 'unused-shell',
    effectSlug: 'ring',
  });
  const unusedResult = parseImportReconstruction(unused);
  assert.equal(unusedResult.success, false);
  if (!unusedResult.success) {
    assert.equal(
      unusedResult.issues.some((issue) => issue.message.includes('not used')),
      true,
    );
  }

  const tooManyDesigns = reconstructionInput();
  tooManyDesigns.designs = Array.from({ length: 65 }, (_, index) => ({
    ...structuredClone(tooManyDesigns.designs[0]),
    key: `shell-${index + 1}`,
  }));
  tooManyDesigns.shots = tooManyDesigns.designs.map((design) => ({
    ...structuredClone(tooManyDesigns.shots[0]),
    designKey: design.key,
  }));
  const tooManyDesignsResult = parseImportReconstruction(tooManyDesigns);
  assert.equal(tooManyDesignsResult.success, false);
  if (!tooManyDesignsResult.success) {
    assert.equal(
      tooManyDesignsResult.issues.some((issue) => issue.path.join('.') === 'designs'),
      true,
    );
  }
});

test('legacy V3-normalised specs retain every shot through the explicit compatibility adapter', () => {
  const legacy = adaptLegacyImportedFireworkSpec({
    name: 'Legacy fan',
    description: 'Two inferred shots.',
    durationSeconds: 5,
    heightMeters: 35,
    caliber: '25mm',
    confidence: 0.67,
    fieldConfidence: { shellType: 0.8 },
    spec: {
      shellType: 'ring',
      spreadSize: 4,
      starLifeMs: 1_400,
      color: '#ff0000',
      shots: [
        {
          timeOffsetSeconds: 0,
          color: '#ff0000',
          position: { x: -10, y: 0, z: 0 },
          panDegrees: -12,
          tiltDegrees: 10,
          scale: 0.8,
          seedOffset: 11,
        },
        {
          timeOffsetSeconds: 1.25,
          color: '#00ff00',
          position: { x: 10, y: 0, z: 0 },
          panDegrees: 12,
          tiltDegrees: 10,
          scale: 1.2,
          seedOffset: 22,
        },
      ],
    },
  });
  assert.equal(legacy.success, true);
  if (!legacy.success) return;

  assert.equal(legacy.data.shots.length, 2);
  assert.equal(reconstructionToReplayCues(legacy.data).length, 2);
  assert.deepEqual(
    legacy.data.shots.map((shot) => shot.seed),
    [11, 22],
  );
  assert.equal(legacy.data.observations.unknowns[0].includes('legacy'), true);
});

test('import job parsing prefers nested worker reconstruction and previews every native shot', () => {
  const payload = {
    reconstruction: reconstructionInput(),
    validation: { accepted: true, attempts: 2 },
    spec: {
      name: 'Legacy compatibility copy',
      description: 'This must not replace native metadata.',
      durationSeconds: 3,
      confidence: 0.4,
      spec: {
        shellType: 'ring',
        spreadSize: 4,
        starLifeMs: 1_400,
        color: '#ff0000',
      },
    },
  };

  const parsed = parseImportedFireworkSpec(payload);
  assert.ok(parsed);
  assert.equal(parsed.name, 'Three shot fan');
  assert.equal(parsed.reconstruction?.version, 1);
  assert.equal(importedSpecToReplayCues(parsed).length, 3);

  const latest = latestImportedSpecFromOutputs([{ outputType: 'generated_spec', payload }]);
  assert.ok(latest);
  assert.equal(latest.reconstruction?.shots.length, 3);
  assert.deepEqual(
    importedSpecToReplayCues(latest).map((cue) => cue.timeSeconds),
    [0, 1, 2],
  );
});

test('invalid native payload falls back through marked lossy V3 reconstruction', () => {
  const invalidNative = reconstructionInput();
  invalidNative.designs[0].effectSlug = 'not-real';
  const parsed = parseImportedFireworkSpec({
    reconstruction: invalidNative,
    spec: {
      name: 'Legacy fallback',
      description: 'Two legacy shots.',
      durationSeconds: 4,
      heightMeters: 30,
      caliber: '25mm',
      confidence: 0.6,
      spec: {
        shellType: 'ring',
        spreadSize: 4,
        starLifeMs: 1_400,
        color: '#ff0000',
        shots: [
          { timeOffsetSeconds: 0, color: '#ff0000', seedOffset: 10 },
          { timeOffsetSeconds: 1, color: '#00ff00', seedOffset: 20 },
        ],
      },
    },
  });

  assert.ok(parsed);
  assert.equal(parsed.reconstruction?.shots.length, 2);
  assert.equal(parsed.reconstruction?.observations.unknowns[0].includes('legacy'), true);
  assert.equal(importedSpecToReplayCues(parsed).length, 2);
});
