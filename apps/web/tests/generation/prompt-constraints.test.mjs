import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parsePromptConstraints,
  productMatchesPromptConstraints,
  validatePromptConstraints,
} from '../../lib/cue-generation/prompt-constraints.ts';

function product({ id, colour, crackle = false, shotCount = 1 }) {
  return {
    id,
    name: `${colour} ${crackle ? 'crackling' : 'clean'} firework`,
    description: null,
    shotCount,
    spec: {
      color: colour,
      colorPalette: [],
      crackle,
      strobe: false,
      ring: false,
      crossette: false,
      horsetail: false,
      floral: false,
      fallingLeaves: false,
      glitter: 'none',
    },
    variant: null,
    baseEffect: null,
  };
}

test('negative wording is a hard exclusion rather than a positive effect hint', () => {
  const constraints = parsePromptConstraints(
    'Use blue and gold multishots only, with no crackle and absolutely no red.',
  );

  assert.deepEqual(constraints.requiredColours, ['blue', 'gold']);
  assert.deepEqual(constraints.forbiddenColours, ['red']);
  assert.deepEqual(constraints.requestedEffects, []);
  assert.deepEqual(constraints.forbiddenEffects, ['crackle']);
  assert.equal(constraints.multishots, 'required');
});

test('catalogue filtering enforces requested type, palette and exclusions', () => {
  const constraints = parsePromptConstraints('Blue and gold multishots only, no crackle.');

  assert.equal(
    productMatchesPromptConstraints(
      product({ id: 'blue-multi', colour: 'blue', shotCount: 12 }),
      constraints,
    ),
    true,
  );
  assert.equal(
    productMatchesPromptConstraints(
      product({ id: 'blue-single', colour: 'blue', shotCount: 1 }),
      constraints,
    ),
    false,
  );
  assert.equal(
    productMatchesPromptConstraints(
      product({ id: 'gold-crackle', colour: 'gold', crackle: true, shotCount: 12 }),
      constraints,
    ),
    false,
  );
});

test('final validation reports missing requested palette and effect coverage', () => {
  const blue = product({ id: 'blue', colour: 'blue', shotCount: 12 });
  const constraints = parsePromptConstraints('Blue and gold multishots with strobe, no crackle.');

  assert.deepEqual(
    validatePromptConstraints({
      productIds: [blue.id],
      products: [blue],
      constraints,
    }),
    [
      { kind: 'missing_colour', value: 'gold' },
      { kind: 'missing_effect', value: 'strobe' },
    ],
  );
});

test('patriotic expands into required red, white and blue coverage', () => {
  const constraints = parsePromptConstraints('A patriotic show without crackle.');

  assert.deepEqual(constraints.requiredColours, ['red', 'white', 'blue']);
});
