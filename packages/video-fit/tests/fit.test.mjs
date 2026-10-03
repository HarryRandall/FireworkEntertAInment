/** Behavioural acceptance of canonical validation, deterministic CPU projection and bounded scoring. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { effectTemplates } from '@showcrafter/fireworks';
import { reviewFixtureDesign } from '@showcrafter/fireworks/fixtures';
import {
  parseEvidence,
  parseProposal,
  proposalDesign,
  parametersFor,
  parameterValue,
  applyParameters,
  renderFeatures,
  scoreFeatures,
} from '../src/index.ts';

const evidence = parseEvidence({
  duration_ms: 5000,
  shots: [{ t_ms: 500, x: 0.5, angle_deg: 0 }],
  features: [
    {
      shot_index: 0,
      content_box_px: [0, 0, 256, 192],
      apex_ratio: 0.8,
      radius_ratio: 0.2,
      life_ms: 3000,
      trail_present: false,
      trail_length_ratio: 0.4,
      crackle: null,
      strobe: false,
      truncated: false,
      colours: [],
      colours_over_time: [],
    },
  ],
});
const design = reviewFixtureDesign('peony');
const proposal = {
  effects: { a: { template: 'peony', overrides: design } },
  composition: { tubes: [{ i: 0, letter: 'a', t_ms: 500, angle_deg: 0 }] },
};

test('all catalogue effects have a bounded four to eight dimensional search', () => {
  for (const template of effectTemplates) {
    const parameters = parametersFor(template.design);
    assert.ok(parameters.length >= 4 && parameters.length <= 8, template.key);
    for (const parameter of parameters)
      assert.ok(parameter.minimum < parameter.maximum, parameter.path);
  }
});
test('model proposals preserve exact shot coverage and canonical design constraints', () => {
  assert.equal(proposalDesign(parseProposal(proposal, evidence).effects.a).kind, 'shell');
  for (const mutation of [
    (value) => (value.effects.a.template = 'invented'),
    (value) => (value.effects.a.overrides.launch.height_m = Infinity),
    (value) => (value.effects.a.overrides.kind = 'comet'),
    (value) => (value.composition.tubes[0].t_ms = 501),
    (value) => (value.composition.tubes[0].letter = 'b'),
    (value) => (value.effects.b = value.effects.a),
    (value) => (value.effects.a.overrides = JSON.parse('{"__proto__":{"polluted":true}}')),
  ]) {
    const value = structuredClone(proposal);
    mutation(value);
    assert.throws(() => parseProposal(value, evidence));
  }
  assert.throws(() => parseEvidence({ ...evidence, features: [] }));
});
test('identical CPU inputs produce identical descriptors; a biased height reduces similarity', () => {
  const expected = renderFeatures(design, evidence, 0);
  assert.deepEqual(renderFeatures(design, evidence, 0), expected);
  assert.equal(scoreFeatures(expected, expected).overall, 1);
  const vector = parametersFor(design).map(
    (parameter) =>
      (parameterValue(design, parameter.path) - parameter.minimum) /
      (parameter.maximum - parameter.minimum),
  );
  vector[0] = 0;
  const changed = applyParameters(design, vector);
  assert.ok(scoreFeatures(expected, renderFeatures(changed, evidence, 0)).overall < 1);
  assert.equal(design.launch.height_m, 56);
  assert.throws(() => applyParameters(design, [Infinity, 0, 0, 0, 0, 0]));
});
test('truncated life uses a lower bound and silent crackle is unscored', () => {
  const observed = { ...evidence.features[0], truncated: true };
  const rendered = { ...observed, life_ms: observed.life_ms + 500, crackle: false };
  assert.equal(scoreFeatures(observed, rendered).distances.life, 0);
  assert.equal(scoreFeatures(observed, rendered).distances.crackle, null);
});
