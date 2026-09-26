import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  convertEmissionDesign,
  convertEmissionPart,
  convertEmissionHistory,
} from '../../../scripts/renderer/convert-emission-settings.mjs';
import { compileFireworkDesign } from '../src/design.ts';
import { groundEmissionDuration, starEmissionCount } from '../src/emission.ts';

test('waterfall width conversion removes count coupling and is idempotent', () => {
  const input = {
    geometry: 'waterfall',
    stars: { outer: { count: 62, emissionRate: 112 } },
    geometryTuning: { waterfall: { curtainWidth: 2.2, scatterX: 0 } },
  };
  const converted = convertEmissionDesign(input);
  assert.equal(converted.geometryTuning.waterfall.width, 136.4);
  assert.equal(converted.geometryTuning.waterfall.curtainWidth, undefined);
  assert.deepEqual(convertEmissionDesign(converted), converted);
  assert.equal(input.geometryTuning.waterfall.curtainWidth, 2.2);
  const part = convertEmissionPart({ geometryTuning: { waterfall: { curtainWidth: 3 } } });
  assert.deepEqual(part, { geometryTuning: { waterfall: { width: 300 } } });
  assert.deepEqual(convertEmissionPart(part), part);
});

test('one-off conversion resolves rate, duration and actual counts without retaining old tuning', () => {
  const original = {
    geometry: 'fountain',
    shellLife: 30,
    stars: { outer: { count: 90 }, core: { count: 12, enabled: false } },
    geometryTuning: {
      fountain: {
        ratePercent: 140,
        durationPercent: 26,
        durationMinSeconds: 2.5,
        durationMaxSeconds: 10,
      },
    },
  };
  const before = structuredClone(original);
  const result = convertEmissionDesign(original);
  assert.equal(result.stars.outer.emissionRate, 126);
  assert.equal(result.stars.core.emissionRate, 16.8);
  assert.equal(result.stars.core.enabled, false);
  assert.deepEqual(result.geometryTuning.fountain, { durationSeconds: 7.8 });
  const design = compileFireworkDesign({ variantOverrides: result });
  assert.equal(groundEmissionDuration(design), 7.8);
  assert.equal(starEmissionCount(design, 'outer'), 982);
  assert.deepEqual(convertEmissionDesign(result), result);
  assert.deepEqual(original, before);
  const ring = convertEmissionDesign({
    geometry: 'ring',
    stars: { outer: { count: 60 }, core: { count: 50 } },
  });
  assert.equal(ring.stars.outer.count, 43);
  assert.equal(ring.stars.core.count, 36);
});

test('part conversion preserves ownership and refuses to guess unresolved history', () => {
  const part = { stars: { core: { count: 10, enabled: false } } };
  const result = convertEmissionPart(part);
  assert.deepEqual(result, { stars: { core: { count: 10, enabled: false, emissionRate: 14 } } });
  assert.deepEqual(convertEmissionPart(result), result);
  assert.deepEqual(convertEmissionPart({ launch: { smoke: { enabled: false } } }), {
    launch: { smoke: { enabled: false } },
  });
  assert.throws(
    () => convertEmissionHistory({ kind: 'firework', renderOverridesJson: { stars: part.stars } }),
    /unresolved/,
  );
  assert.throws(
    () =>
      convertEmissionDesign({
        geometry: 'fountain',
        stars: { outer: { count: 100 } },
        geometryTuning: { fountain: { ratePercent: 99999 } },
      }),
    /emissionRate/,
  );
});

test('copied preset conversion preserves reset values, metadata and modified status', async () => {
  const { presetSourceStatus, resetCopiedPreset } =
    await import('../../firework-editor/src/presets.ts');
  const source = compileFireworkDesign({
    variantOverrides: { geometry: 'ring', stars: { outer: { count: 60 } } },
  });
  // Recreate the stored representation before direct counts and rates existed.
  delete source.stars.outer.emissionRate;
  delete source.stars.core.emissionRate;
  source.geometryTuning.ring.countPercent = 72;
  const preset = structuredClone(source.stars.outer);
  const { burstTrail, ...settings } = preset;
  source.presetSources = {
    star: {
      id: 'original',
      name: "Preset's original",
      updatedAt: '2026-09-26',
      settings: { stars: { outer: settings } },
    },
  };
  const converted = convertEmissionDesign(source);
  assert.equal(converted.stars.outer.count, 43);
  assert.equal(converted.presetSources.star.settings.stars.outer.count, 43);
  assert.equal(presetSourceStatus(converted, 'star').modified, false);
  converted.stars.outer.count = 20;
  assert.equal(presetSourceStatus(converted, 'star').modified, true);
  resetCopiedPreset(converted, 'star');
  assert.equal(converted.stars.outer.count, 43);
  assert.equal(converted.stars.outer.emissionRate, 84);
  assert.equal(converted.presetSources.star.name, "Preset's original");
  assert.deepEqual(convertEmissionDesign(converted), converted);
  assert.deepEqual(
    convertEmissionHistory({ kind: 'firework', renderOverridesJson: source }).renderOverridesJson,
    converted,
  );
});

test('backfill planning is structural, idempotent and refuses partial or tampered plans', async () => {
  const { planEmissionBackfill, emissionBackfillStatements, emissionTables } =
    await import('../../../scripts/renderer/emission-backfill-plan.mjs');
  const tables = Object.fromEntries(emissionTables.map((name) => [name, []]));
  const id = '00000000-0000-0000-0000-000000000001';
  tables.firework_effects.push({
    id,
    updated_at: '2026-09-26T00:00:00Z',
    model_json: {
      geometry: 'ring',
      stars: { outer: { count: 60 } },
      name: "'); $emission_conversion$ --",
    },
  });
  const plan = planEmissionBackfill(tables);
  assert.equal(plan.updates.length, 1);
  assert.deepEqual(plan.originals, tables);
  assert.match(emissionBackfillStatements(plan), /share row exclusive/);
  assert.match(emissionBackfillStatements(plan), /updated_at = clock_timestamp/);
  const updated = structuredClone(tables);
  Object.assign(updated.firework_effects[0], plan.updates[0].patch);
  assert.equal(planEmissionBackfill(updated).updates.length, 0);
  const tampered = structuredClone(plan);
  tampered.updates[0].patch.model_json.geometry = 'sphere';
  assert.throws(() => emissionBackfillStatements(tampered), /plan has changed/);
  tables.fireworks.push({ id, render_snapshot_json: null });
  assert.throws(() => emissionBackfillStatements(planEmissionBackfill(tables)), /diagnostic/);
});

test('fresh-install conversion copies resolved settings and retains original overrides', async () => {
  const { convertBootstrapSettings } =
    await import('../../../scripts/renderer/convert-bootstrap-settings.mjs');
  const original = {
    firework_effects: [
      {
        id: 'effect',
        model_json: {
          renderDefaults: { geometry: 'fountain', shellLife: 30, stars: { outer: { count: 90 } } },
        },
      },
    ],
    firework_style_defaults: [],
    fireworks: [
      {
        id: 'firework',
        firework_effect_id: 'effect',
        render_overrides_json: { stars: { outer: { count: 50 } } },
        primary_color: '#ff0000',
      },
    ],
  };
  const converted = convertBootstrapSettings(original);
  const snapshot = converted.fireworks[0].render_snapshot_json;
  assert.equal(snapshot.stars.outer.emissionRate, 70);
  assert.equal(snapshot.geometryTuning.fountain.durationSeconds, 7.8);
  assert.equal(snapshot.color.r, 1);
  assert.deepEqual(
    converted.fireworks[0].render_overrides_json,
    original.fireworks[0].render_overrides_json,
  );
  assert.deepEqual(convertBootstrapSettings(converted), converted);
  converted.firework_effects[0].model_json.renderDefaults.stars.outer.emissionRate = 600;
  assert.equal(snapshot.stars.outer.emissionRate, 70);
});
